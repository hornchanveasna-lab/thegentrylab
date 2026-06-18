import type { VercelRequest, VercelResponse } from "@vercel/node";

// LemonSqueezy variant IDs — set these in Vercel env vars after creating products
const PACKAGES = {
  starter:  { credits: 1_000,  label: "Starter",  variantEnv: "LS_VARIANT_STARTER"  },
  pro:      { credits: 5_000,  label: "Pro",       variantEnv: "LS_VARIANT_PRO"      },
  business: { credits: 20_000, label: "Business",  variantEnv: "LS_VARIANT_BUSINESS" },
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const lsApiKey    = process.env.LS_API_KEY;
  const lsStoreId   = process.env.LS_STORE_ID;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!lsApiKey || !lsStoreId || !supabaseUrl || !serviceKey)
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

  const variantId = process.env[pkg.variantEnv];
  if (!variantId) return res.status(500).json({ error: `Variant not configured: ${pkg.variantEnv}` });

  const origin = (req.headers["origin"] as string) ?? "https://thegentrylab.io";

  try {
    const lsRes = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        "Authorization": `Bearer ${lsApiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: {
              email: userEmail,
              custom: { userId, packageId, credits: String(pkg.credits) },
            },
            product_options: {
              redirect_url: `${origin}/credits?success=1&pkg=${packageId}&cr=${pkg.credits}`,
            },
          },
          relationships: {
            store:   { data: { type: "stores",   id: lsStoreId  } },
            variant: { data: { type: "variants", id: variantId  } },
          },
        },
      }),
    });

    if (!lsRes.ok) {
      const err = await lsRes.text();
      console.error("LemonSqueezy error:", err);
      return res.status(502).json({ error: "Payment provider error" });
    }

    const { data } = await lsRes.json();
    return res.status(200).json({ url: data.attributes.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({ error: "Failed to create checkout" });
  }
}
