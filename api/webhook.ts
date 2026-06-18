import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac } from "crypto";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const webhookSecret = process.env.LS_WEBHOOK_SECRET;
  const supabaseUrl   = process.env.SUPABASE_URL;
  const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSecret || !supabaseUrl || !serviceKey)
    return res.status(500).send("Not configured");

  // Read raw body for signature verification
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

  // Verify LemonSqueezy HMAC-SHA256 signature
  const sig = req.headers["x-signature"] as string;
  if (!sig) return res.status(400).send("Missing signature");

  const expected = createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  if (sig !== expected) return res.status(400).send("Signature mismatch");

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  // LemonSqueezy fires "order_created" for completed one-time purchases
  const eventName = payload.meta && (payload.meta as Record<string, unknown>).event_name;
  if (eventName === "order_created") {
    const data = payload.data as Record<string, unknown> | undefined;
    const attrs = data?.attributes as Record<string, unknown> | undefined;
    const custom = attrs?.first_order_item as Record<string, unknown> | undefined;

    // Custom data is nested under meta.custom_data
    const meta = payload.meta as Record<string, unknown>;
    const customData = meta?.custom_data as Record<string, string> | undefined;
    const { userId, credits, packageId } = customData ?? {};

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
