// src/lib/renderStock.ts
import { apiGet } from "../../../lib/api";

export type StockRange = "1M" | "3M" | "6M" | "1Y" | "5Y";

export type BackendStockPoint = {
  date: string;
  close: number;
};

export type StockChartPoint = {
  date: string;
  close: number;
};

function normalizeStockSeries(raw: unknown): BackendStockPoint[] {
  const root: any = raw;

  const arr: any[] =
    Array.isArray(root) ? root :
    Array.isArray(root?.series) ? root.series :
    Array.isArray(root?.data) ? root.data :
    [];

  return arr
    .map((x) => {
      const date = String(x?.date ?? x?.t ?? x?.time ?? "").slice(0, 10);
      const close = Number(x?.close ?? x?.c ?? x?.price ?? x?.value);
      return { date, close };
    })
    .filter((p) => p.date.length === 10 && Number.isFinite(p.close));
}

export async function fetchStockSeries(
  symbol: string,
  range: StockRange,
  endpoint = "/api/market/price-series"
): Promise<BackendStockPoint[]> {
  const sym = (symbol || "").trim().toUpperCase();
  if (!sym) return [];

  const qs = new URLSearchParams({ symbol: sym, range });
  const res = await apiGet<unknown>(`${endpoint}?${qs.toString()}`);
  return normalizeStockSeries(res);
}

export function toStockChartPoints(series: BackendStockPoint[]): StockChartPoint[] {
  return series.map((p) => ({ date: p.date, close: Number(p.close) }));
}