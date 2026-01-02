// src/lib/portfolio.ts
import { apiGet } from "./api";
import type { TimelineEvent } from "./transparency";
import type { PositionRow } from "./types";


type DashboardLatest = {
  snapshot_as_of: string;
  total_value: number;
  cash_spaxx: number;
  pending_amount: number;
  non_cash_positions_value: number;
  todays_pnl_total: number;
};

type ApiPositionsResp = {
  as_of?: string;
  data: Array<{
    ticker: string;
    name?: string;
    quantity: number;

    last_price?: number;
    market_value?: number;
    cost_value?: number;

    day_change?: number;
    day_change_pct?: number;
    unrealized_pl?: number;
    unrealized_pl_pct?: number;


    price_as_of?: string | null;
  }>;
};

export type SnapshotCardData = {
  note: string;
  href: string;
  ctaLabel: string;
  kpis: { label: string; value: string }[];
};

const money = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { style: "currency", currency: "USD" })
    : "—";

const pct = (decimal: number) =>
  Number.isFinite(decimal) ? `${(decimal * 100).toFixed(2)}%` : "—";



async function apiGetFallback<T>(paths: string[]): Promise<T> {
  let lastErr: any = null;
  for (const p of paths) {
    try {
      return await apiGet<T>(p);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("All fallback endpoints failed");
}



export async function getPortfolioAsOf(): Promise<string> {
  const d = await apiGetFallback<DashboardLatest>([
    "/api/history/dashboard-latest",
    "/history/dashboard-latest",
  ]);
  return d.snapshot_as_of ?? "—";
}

export async function getPortfolioSummaryForUI(): Promise<SnapshotCardData> {
  const d = await apiGetFallback<DashboardLatest>([
    "/api/history/dashboard-latest",
    "/history/dashboard-latest",
  ]);

  const total = d.total_value ?? NaN;
  const dayAbs = d.todays_pnl_total ?? NaN;
  const cash = (d.cash_spaxx ?? NaN) + (d.pending_amount ?? NaN);

  const dayPct =
    Number.isFinite(dayAbs) && Number.isFinite(total) && total !== 0 ? dayAbs / total : NaN;

  return {
    note: "Live snapshot from backend.",
    href: "/portfolio",
    ctaLabel: "View Live",
    kpis: [
      { label: "as-of", value: d.snapshot_as_of ?? "—" },
      { label: "Net value", value: money(total) },
      { label: "Day change", value: `${money(dayAbs)} (${pct(dayPct)})` },
      { label: "Cash", value: money(cash) },
    ],
  };
}

export async function getAllocationForUI(): Promise<
  readonly { label: string; value: string }[]
> {
  const d = await apiGetFallback<DashboardLatest>([
    "/api/history/dashboard-latest",
    "/history/dashboard-latest",
  ]);

  const total = d.total_value ?? NaN;
  const cash = (d.cash_spaxx ?? NaN) + (d.pending_amount ?? NaN);

  const cashPct =
    Number.isFinite(cash) && Number.isFinite(total) && total > 0 ? cash / total : NaN;

  const investedPct = Number.isFinite(cashPct) ? Math.max(0, 1 - cashPct) : NaN;

  return [
    { label: "Cash", value: pct(cashPct) },
    { label: "Invested", value: pct(investedPct) },
  ] as const;
}

export async function getPositionsForUI(): Promise<PositionRow[]> {
  let r: any;

  try {
    r = await apiGet<ApiPositionsResp>("/api/portfolio/positions");
  } catch {
    const latest = await apiGetFallback<DashboardLatest>([
      "/api/history/dashboard-latest",
      "/history/dashboard-latest",
    ]);
    const asOf = latest.snapshot_as_of;

    r = await apiGetFallback<ApiPositionsResp>([
      `/api/history/positions?as_of=${encodeURIComponent(asOf)}`,
      `/history/positions?as_of=${encodeURIComponent(asOf)}`,
    ]);
  }

  const data = Array.isArray(r?.data) ? r.data : [];

  const latest = await apiGetFallback<DashboardLatest>([
    "/api/history/dashboard-latest",
    "/history/dashboard-latest",
  ]);
  const total = Number(latest.total_value);

  return data.map((p) => {
    const value = Number(p.market_value ?? 0);
    const price = Number(p.last_price ?? 0);
    const qty = Number(p.quantity ?? 0);

    const dayPct = typeof p.day_change_pct === "number" ? p.day_change_pct : null;
    const unrealPct = typeof p.unrealized_pl_pct === "number" ? p.unrealized_pl_pct : null;

    const w =
      Number.isFinite(value) && Number.isFinite(total) && total > 0 ? value / total : NaN;

    const price_as_of =
      (p as any).price_as_of ??
      (p as any).priceAsOf ??
      (p as any).updated_at ??
      (p as any).updatedAt ??
      null;

    return {
      symbol: p.ticker,
      name: p.name ?? p.ticker,
      qty,
      avg: 0,
      price: Number.isFinite(price) ? Number(price.toFixed(2)) : 0,
      value: Number.isFinite(value) ? Number(value.toFixed(2)) : 0,
      weight: Number.isFinite(w) ? pct(w) : "—",
      day: dayPct === null ? "—" : pct(dayPct),
      pnl:
        unrealPct === null || typeof p.unrealized_pl !== "number"
          ? "—"
          : `${money(p.unrealized_pl)} (${pct(unrealPct)})`,

      price_as_of,
    } as any;
  });
}



export const PORTFOLIO_ACTIVITY: readonly TimelineEvent[] = [
  {
    date: "2025-12-24",
    title: "Positions snapshot ingested",
    detail: "Holdings, pricing, and cash normalized.",
    href: "/transparency/snapshot-uploaded",
    tag: "Data",
  },
  {
    date: "2025-12-24",
    title: "Weights & exposure computed",
    detail: "Position weights and net exposure recalculated.",
    href: "/transparency/portfolio-totals",
    tag: "Compute",
  },
  {
    date: "2025-12-24",
    title: "Daily P/L marked",
    detail: "Market prices applied for end-of-day snapshot.",
    href: "/portfolio",
    tag: "Market",
  },
] as const;