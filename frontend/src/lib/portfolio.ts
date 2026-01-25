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
type ApiPosition = {
  ticker: string;
  name?: string;
  quantity: number;

  last_price?: number;
  market_value?: number;

  cost_value?: number;
  avg_cost?: number;

  day_change?: number;
  day_change_pct?: number;
  unrealized_pl?: number;
  unrealized_pl_pct?: number;

  price_as_of?: string | null;

  // ✅ NEW: backend days/opened/as_of
  opened_at?: string | null;
  days_held?: number | null;
  as_of?: string | null;

  // legacy fallbacks
  priceAsOf?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
};


type ApiPositionsResp = {
  as_of?: string;
  data: ApiPosition[];
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
  let lastErr: unknown = null;
  for (const p of paths) {
    try {
      return await apiGet<T>(p);
    } catch (e) {
      lastErr = e;
    }
  }
  throw (lastErr as any) ?? new Error("All fallback endpoints failed");
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

export async function getAllocationForUI(): Promise<readonly { label: string; value: string }[]> {
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
  let r: ApiPositionsResp;

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

  const data: ApiPosition[] = Array.isArray(r?.data) ? r.data : [];

  const latest = await apiGetFallback<DashboardLatest>([
    "/api/history/dashboard-latest",
    "/history/dashboard-latest",
  ]);
  const total = Number(latest.total_value);

  // IMPORTANT:
  // Holdings.tsx wants raw numeric fields like avg_cost + cost_value so it can render:
  // cost/share, $ gain, % gain. So we pass those through.
  return data.map((p: ApiPosition) => {
    const market_value = typeof p.market_value === "number" ? p.market_value : Number(p.market_value ?? 0);
    const last_price = typeof p.last_price === "number" ? p.last_price : Number(p.last_price ?? 0);
    const quantity = typeof p.quantity === "number" ? p.quantity : Number(p.quantity ?? 0);

    const cost_value = typeof p.cost_value === "number" ? p.cost_value : Number(p.cost_value ?? 0);
    const avg_cost = typeof p.avg_cost === "number" ? p.avg_cost : Number(p.avg_cost ?? 0);

    const w =
      Number.isFinite(market_value) && Number.isFinite(total) && total > 0 ? market_value / total : NaN;

    const price_as_of =
      p.price_as_of ?? p.priceAsOf ?? p.updated_at ?? p.updatedAt ?? null;

    // return the "PositionRow"-like object, but include the raw fields too
        return {
          symbol: p.ticker,
          name: p.name ?? p.ticker,

          qty: quantity,
          avg: avg_cost,
          price: Number.isFinite(last_price) ? Number(last_price.toFixed(2)) : 0,
          value: Number.isFinite(market_value) ? Number(market_value.toFixed(2)) : 0,
          weight: Number.isFinite(w) ? pct(w) : "—",
          day: typeof p.day_change_pct === "number" ? pct(p.day_change_pct) : "—",
          pnl:
            typeof p.unrealized_pl === "number" && typeof p.unrealized_pl_pct === "number"
              ? `${money(p.unrealized_pl)} (${pct(p.unrealized_pl_pct)})`
              : "—",
          price_as_of,

          ticker: p.ticker,
          quantity,
          last_price,
          market_value,
          cost_value,
          avg_cost,

          // ✅ NEW passthroughs for holdings
          opened_at: p.opened_at ?? null,
          days_held: typeof p.days_held === "number" ? p.days_held : null,
          as_of: (r?.as_of ?? p.as_of ?? null) as any,
          portfolio_total_value: total,
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
