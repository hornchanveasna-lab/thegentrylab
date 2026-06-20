import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const PACKAGES = {
  starter:  { credits: 1_000,  price_usd: 2.99  },
  pro:      { credits: 5_000,  price_usd: 9.99  },
  business: { credits: 20_000, price_usd: 29.99 },
} as const;

function hmacSha512Base64(message: string, key: string): string {
  return crypto.createHmac("sha512", key).update(message).digest("base64");
}

function getReqTime(): string {
  // YYYYMMDDHHmmss in UTC
  return new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const merchantId = process.env.PAYWAY_MERCHANT_ID;
  const apiKey     = process.env.PAYWAY_API_KEY;
  const baseUrl    = process.env.PAYWAY_BASE_URL ?? "https://checkout-sandbox.payway.com.kh";
  const supabaseUrl  = process.env.SUPABASE_URL;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!merchantId || !apiKey || !supabaseUrl || !serviceKey)
    return res.status(500).json({ error: "Server not configured" });

  const auth = req.headers["authorization"] as string | undefined;
  if (!auth?.startsWith("Bearer "))
    return res.status(401).json({ error: "Unauthorized" });

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.slice(7));
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const { packageId } = req.body as { packageId: string };
  const pkg = PACKAGES[packageId as keyof typeof PACKAGES];
  if (!pkg) return res.status(400).json({ error: "Invalid package" });

  const req_time       = getReqTime();
  const tran_id        = `gl${Date.now()}`;
  const amount         = pkg.price_usd.toFixed(2);
  const payment_option = "abapay_khqr_deeplink";
  const currency       = "USD";

  // Hash: concatenate all 24 fields in exact order (empty string for unused optional fields)
  // req_time, merchant_id, tran_id, amount, items, shipping, firstname, lastname, email, phone,
  // type, payment_option, return_url, cancel_url, continue_success_url, return_deeplink,
  // currency, custom_fields, return_params, payout, lifetime, additional_params,
  // google_pay_token, skip_success_page
  const b4hash = [
    req_time, merchantId, tran_id, amount,
    "", "", "", "", "", "",   // items, shipping, firstname, lastname, email, phone
    "",                       // type (default = purchase)
    payment_option,
    "", "", "", "",           // return_url, cancel_url, continue_success_url, return_deeplink
    currency,
    "", "", "", "", "", "", "", // custom_fields, return_params, payout, lifetime, additional_params, google_pay_token, skip_success_page
  ].join("");

  const hash = hmacSha512Base64(b4hash, apiKey);

  // POST as multipart/form-data
  const form = new FormData();
  form.append("req_time",       req_time);
  form.append("merchant_id",    merchantId);
  form.append("tran_id",        tran_id);
  form.append("amount",         amount);
  form.append("payment_option", payment_option);
  form.append("currency",       currency);
  form.append("hash",           hash);

  let paywayData: Record<string, unknown>;
  try {
    const paywayRes = await fetch(`${baseUrl}/api/payment-gateway/v1/payments/purchase`, {
      method: "POST",
      body: form,
    });
    const text = await paywayRes.text();
    try {
      paywayData = JSON.parse(text);
    } catch {
      // HTML response means wrong params / hash mismatch
      return res.status(502).json({ error: "PayWay returned HTML (hash or config issue)", detail: text.slice(0, 200) });
    }
  } catch (err) {
    return res.status(502).json({ error: "PayWay unreachable", detail: String(err) });
  }

  if (!paywayData.qr_string) {
    return res.status(502).json({ error: "No QR string from PayWay", detail: paywayData });
  }

  // Store pending transaction
  const { error: dbErr } = await supabase.from("payway_transactions").insert({
    tran_id,
    user_id:    user.id,
    package_id: packageId,
    credits:    pkg.credits,
    amount:     pkg.price_usd,
    currency:   "USD",
    status:     "pending",
  });
  if (dbErr) return res.status(500).json({ error: "DB insert failed", detail: dbErr.message });

  return res.status(200).json({
    tran_id,
    qr_string:        paywayData.qr_string,
    abapay_deeplink:  paywayData.abapay_deeplink,
    checkout_qr_url:  paywayData.checkout_qr_url,
    amount:           pkg.price_usd,
    credits:          pkg.credits,
  });
}
