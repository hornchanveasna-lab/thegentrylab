import Stripe from "stripe";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const PACKAGES = {
  starter:  { credits: 1_000,  price_cents:  299,  label: "Starter"  },
  pro:      { credits: 5_000,  price_cents:  999,  label: "Pro"      },
  business: { credits: 20_000, price_cents: 2999,  label: "Business" },
} as const;

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const stripeKey  = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey)
    return new Response(JSON.stringify({ error: "Stripe not configured" }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer "))
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS },
    });

  let userId: string, userEmail: string;
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: serviceKey! },
    });
    if (!r.ok) throw new Error("invalid jwt");
    const { id, email } = await r.json();
    userId = id; userEmail = email;
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  let packageId: string;
  try { ({ packageId } = await req.json()); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }); }

  const pkg = PACKAGES[packageId as keyof typeof PACKAGES];
  if (!pkg)
    return new Response(JSON.stringify({ error: "Invalid package" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });

  const stripe = new Stripe(stripeKey);
  const origin = req.headers.get("origin") ?? "https://thegentrylab.io";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: `GentryLab ${pkg.label} Credits`,
          description: `${pkg.credits.toLocaleString()} AI credits for GentryLab Industrial Advisor & Chat`,
          images: [],
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

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const runtime = "nodejs";
