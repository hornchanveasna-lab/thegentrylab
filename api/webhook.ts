import Stripe from "stripe";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const stripeKey     = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl   = process.env.SUPABASE_URL;
  const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceKey)
    return new Response("Not configured", { status: 500 });

  const sig  = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(stripeKey);
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return new Response("Webhook signature failed", { status: 400 });
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
          p_user_id:    userId,
          p_amount:     parseInt(credits),
          p_type:       "purchase",
          p_description: `Purchased ${Number(credits).toLocaleString()} credits — ${packageId ?? "pack"}`,
        }),
      });
    }
  }

  return new Response("OK", { status: 200 });
}

// Node.js runtime is default for Vercel Functions — no declaration needed
