import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

export interface CreditBalance {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
}

export function useCredits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    if (!user || !supabase) { setCredits(null); return; }
    setLoading(true);
    const { data } = await supabase
      .from("user_credits")
      .select("balance, lifetime_earned, lifetime_spent")
      .eq("user_id", user.id)
      .maybeSingle();
    setCredits((data as CreditBalance | null) ?? { balance: 0, lifetime_earned: 0, lifetime_spent: 0 });
    setLoading(false);
  }

  useEffect(() => {
    if (user) refresh();
    else setCredits(null);
  }, [user?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  return { credits, loading, refresh };
}

export const CREDIT_COSTS = {
  chat:                 20,
  brief_standard:       75,
  brief_comprehensive: 150,
} as const;

export const CREDIT_PACKAGES = [
  { id: "starter",  label: "Starter",  credits: 1_000,  price_usd: 2.99,  price_cents: 299,   best: false },
  { id: "pro",      label: "Pro",       credits: 5_000,  price_usd: 9.99,  price_cents: 999,   best: true  },
  { id: "business", label: "Business",  credits: 20_000, price_usd: 29.99, price_cents: 2999,  best: false },
] as const;

export function formatCredits(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1_000)  return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
