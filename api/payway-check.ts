import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function hmacSha512Base64(message: string, key: string): string {
  return crypto.createHmac("sha512", key).update(message).digest("base64");
}

function getReqTime(): string {
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

  const { tran_id } = req.body as { tran_id: string };
  if (!tran_id) return res.status(400).json({ error: "tran_id required" });

  // Verify this transaction belongs to the requesting user
  const { data: txn, error: txnErr } = await supabase
    .from("payway_transactions")
    .select("*")
    .eq("tran_id", tran_id)
    .eq("user_id", user.id)
    .single();

  if (txnErr || !txn) return res.status(404).json({ error: "Transaction not found" });

  // Already completed — return cached status without hitting PayWay
  if (txn.status !== "pending") {
    return res.status(200).json({ status: txn.status, credits: txn.credits });
  }

  const req_time = getReqTime();
  // Hash for check-transaction: req_time + merchant_id + tran_id
  const b4hash = req_time + merchantId + tran_id;
  const hash   = hmacSha512Base64(b4hash, apiKey);

  let paywayData: {
    data?: {
      payment_status: string;
      payment_status_code: number;
      payment_amount?: number;
    };
    status?: { code: string; message: string };
  };

  try {
    const paywayRes = await fetch(`${baseUrl}/api/payment-gateway/v1/payments/check-transaction-2`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ req_time, merchant_id: merchantId, tran_id, hash }),
    });
    paywayData = await paywayRes.json();
  } catch (err) {
    return res.status(502).json({ error: "PayWay unreachable", detail: String(err) });
  }

  const paymentStatus = paywayData.data?.payment_status ?? "PENDING";

  // On approval: add credits and mark transaction complete (idempotent)
  if (paymentStatus === "APPROVED") {
    // Upsert credits
    const { data: existing } = await supabase
      .from("user_credits")
      .select("balance, lifetime_earned")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      await supabase.from("user_credits").update({
        balance:         existing.balance + txn.credits,
        lifetime_earned: existing.lifetime_earned + txn.credits,
        updated_at:      new Date().toISOString(),
      }).eq("user_id", user.id);
    } else {
      await supabase.from("user_credits").insert({
        user_id:         user.id,
        balance:         txn.credits,
        lifetime_earned: txn.credits,
        lifetime_spent:  0,
      });
    }

    await supabase.from("payway_transactions").update({
      status:       "approved",
      completed_at: new Date().toISOString(),
    }).eq("tran_id", tran_id);

    return res.status(200).json({ status: "approved", credits: txn.credits });
  }

  // Map PayWay status codes to our status
  const statusMap: Record<string, string> = {
    "APPROVED":  "approved",
    "PENDING":   "pending",
    "DECLINED":  "declined",
    "CANCELLED": "cancelled",
    "REFUNDED":  "declined",
  };
  const ourStatus = statusMap[paymentStatus] ?? "pending";

  if (ourStatus !== "pending") {
    await supabase.from("payway_transactions").update({ status: ourStatus })
      .eq("tran_id", tran_id);
  }

  return res.status(200).json({ status: ourStatus, credits: txn.credits });
}
