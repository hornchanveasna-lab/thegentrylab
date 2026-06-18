import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const stripeKey     = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl   = process.env.SUPABASE_URL;
  const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceKey)
    return res.status(500).send("Not configured");

  const sig = req.headers["stripe-signature"] as string;

  // Vercel gives us the raw body as a Buffer when we read req via getRawBody
  // For webhook signature verification we need the raw bytes
  let rawBody: string;
  try {
    rawBody = await new Promise<string>((resolve, reject) => {
      let data = "";
      req.on("data", (chunk: Buffer) => { data += chunk.toString("utf8"); });
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
  } catch {
    return res.status(400).send("Could not read body");
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(stripeKey);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch {
    return res.status(400).send("Webhook signature failed");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, credits, packageId } = session.metadata ?? {};
    if (userId && credits) {
      await fetch(`${supabaseUrl}/rest/v1/rpc/add_credits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          p_user_id:     userId,
          p_amount:      parseInt(credits),
          p_type:        "purchase",
          p_description: `Purchased ${Number(credits).toLocaleString()} credits — ${packageId ?? "pack"}`,
        }),
      });
    }
  }

  return res.status(200).send("OK");
}
