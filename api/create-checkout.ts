import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

const PACKAGES = {
  starter:  { credits: 1_000,  price_cents:  299,  label: "Starter"  },
  pro:      { credits: 5_000,  price_cents:  999,  label: "Pro"      },
  business: { credits: 20_000, price_cents: 2999,  label: "Business" },
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const stripeKey   = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey || !supabaseUrl || !serviceKey)
    return res.status(500).json({ error: "Server not configured" });

  const auth = req.headers["authorization"] as string | undefined;
  if (!auth?.startsWith("Bearer "))
    return res.status(401).json({ error: "Unauthorized" });

  let userId: string, userEmail: string;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: serviceKey },
      signal: ac.signal,
    });
    clearTimeout(t);
    if (!r.ok) throw new Error("invalid jwt");
    const { id, email } = await r.json();
    userId = id; userEmail = email;
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { packageId } = req.body ?? {};
  const pkg = PACKAGES[packageId as keyof typeof PACKAGES];
  if (!pkg) return res.status(400).json({ error: "Invalid package" });

  const stripe = new Stripe(stripeKey);
  const origin = (req.headers["origin"] as string) ?? "https://thegentrylab.io";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: `GentryLab ${pkg.label} Credits`,
          description: `${pkg.credits.toLocaleString()} AI credits for GentryLab Industrial Advisor & Chat`,
        },
        unit_amount: pkg.price_cents,
      },
      quantity: 1,
    }],
    customer_email: userEmail,
    metadata: { userId, packageId, credits: String(pkg.credits) },
    success_url: `${origin}/credits?success=1&pkg=${packageId}&cr=${pkg.credits}`,
    cancel_url:  `${origin}/credits?cancelled=1`,
  });

  return res.status(200).json({ url: session.url });
}
