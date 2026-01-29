// src/lib/activity.ts
import { apiGet, apiPost } from "./api";

export type ActivityRow = {
  trade_id: string;
  trade_date: string; // YYYY-MM-DD

  side: "BUY" | "SELL";
  ticker: string;

  description?: string | null;
  qty: number;

  price?: number | null;
  amount?: number | null; // optional, depending on your backend naming
  settlement_date?: string | null;

  thesis?: string | null;
};

export type ActivityLatestResp = {
  trade_date: string;
  data: ActivityRow[];
  count: number;
};

export async function fetchLatestActivity(params?: { limit?: number }) {
  const limit = params?.limit ?? 500;
  return apiGet<ActivityLatestResp>(`/api/history/activity/latest?limit=${encodeURIComponent(String(limit))}`);
}

export async function saveActivityThesis(input: { trade_id: string; thesis: string }) {
  return apiPost<{ ok: boolean }>(`/api/history/activity/thesis`, input);
}
