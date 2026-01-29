// src/lib/activity.ts
import { apiGet } from "./api";

export type ActivityRow = {
  trade_date: string;
  ticker: string;
  side: "BUY" | "SELL" | string;
  qty: number;
  price?: number | null;
  value?: number | null;
};

export type ActivityLatestResp = {
  trade_date: string;
  data: ActivityRow[];
  count: number;
};

export async function fetchLatestActivity(params?: { limit?: number }) {
  const limit = params?.limit ?? 500;
  return apiGet<ActivityLatestResp>(
    `/api/history/activity/latest?limit=${encodeURIComponent(String(limit))}`
  );
}
export type ActivityRecentResp = {
  start_date: string;
  end_date: string;
  data: ActivityRow[];
  count: number;
};

export async function fetchRecentActivity(params?: { days?: number; limit?: number }) {
  const days = params?.days ?? 30;
  const limit = params?.limit ?? 2000;

  return apiGet<ActivityRecentResp>(
    `/api/history/activity/recent?days=${encodeURIComponent(String(days))}&limit=${encodeURIComponent(String(limit))}`
  );
}

