import { apiGet } from "./api";
import type { SnapshotCardData } from "./portfolio";

export type TransparencyTag =
  | "Data"
  | "Compute"
  | "Market"
  | "Journal"
  | "Fix"
  | "Policy"
  | "trades"
  | "event";

export type TimelineEvent = {
  date: string;
  title: string;
  detail: string;
  href: string;
  tag: TransparencyTag;
};

export type EvidenceItem = {
  title: string;
  body: string;
  href: string;
  linkLabel: string;
};

export type PolicyItem = {
  k: string;
  v: string;
};

export type TradeLine = {
  ticker: string;
  side: "BUY" | "SELL";
  qty: number;
  price?: number | null;
  value?: number | null;
};

export type ReceiptResp = {
  as_of: string;
  receipt_id: string;
  net_after: number;
  net_before?: number | null;
  delta?: number | null;
  trades: TradeLine[];
};

const API_HISTORY = "/history";

const money = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { style: "currency", currency: "USD" })
    : "—";

function safeDate(s: unknown): string {
  return typeof s === "string" && s.length >= 10 ? s.slice(0, 10) : "—";
}

function hasTrades(r: ReceiptResp | null | undefined): boolean {
  return Array.isArray(r?.trades) && r!.trades.length > 0;
}

function pickLatestReceiptWithTrades(receipts: ReceiptResp[]): ReceiptResp | null {
  if (!Array.isArray(receipts) || receipts.length === 0) return null;
  const sorted = [...receipts].sort((a, b) => (a.as_of < b.as_of ? 1 : -1));
  return sorted.find((r) => hasTrades(r)) ?? null;
}

export type TransparencyEntry = {
  slug: string;
  date: string;
  title: string;
  detail: string;
  tag: TimelineEvent["tag"];
  content: string[];
  receipts?: { label: string; href: string; kind?: string }[];
};

export async function getTransparencyEntry(
  slug: string
): Promise<TransparencyEntry | null> {
  const m = /^receipt-(\d{4}-\d{2}-\d{2})$/.exec(slug);
  if (!m) return null;

  const asOf = m[1];
  const all = await apiGet<ReceiptResp[]>(`${API_HISTORY}/receipts?limit=365`);
  const r = all.find((x) => safeDate(x.as_of) === asOf) ?? null;
  if (!r || !hasTrades(r)) return null;

  return {
    slug,
    date: asOf,
    title: "Receipt (derived)",
    detail: `Computed from consecutive snapshots. Source: ${API_HISTORY}/receipts`,
    tag: "trades",
    content: [
      `Receipt ID: ${r.receipt_id}`,
      `Net after: ${money(r.net_after)}`,
      `Net before: ${r.net_before == null ? "—" : money(r.net_before)}`,
      `Delta: ${r.delta == null ? "—" : money(r.delta)}`,
      `Trades: ${Array.isArray(r.trades) ? r.trades.length : 0}`,
    ],
    receipts: [{ label: "Receipts (JSON)", kind: "json", href: `${API_HISTORY}/receipts?limit=60` }],
  };
}

export async function getTransparencyAsOf(): Promise<string> {
  try {
    const receipts = await apiGet<ReceiptResp[]>(`${API_HISTORY}/receipts?limit=60`);
    const r = pickLatestReceiptWithTrades(receipts);
    return r?.as_of ?? "—";
  } catch {
    return "—";
  }
}

export async function getTransparencySummaryForUI(): Promise<SnapshotCardData> {
  let r: ReceiptResp | null = null;

  try {
    const receipts = await apiGet<ReceiptResp[]>(`${API_HISTORY}/receipts?limit=60`);
    r = pickLatestReceiptWithTrades(receipts);
  } catch {
    r = null;
  }

  const asOf = r?.as_of ?? "—";
  const total = r?.net_after ?? NaN;
  const delta = r?.delta ?? NaN;

  return {
    note: `Receipts-first log. Source: ${API_HISTORY}/receipts`,
    href: "/transparency",
    ctaLabel: "View receipts",
    kpis: [
      { label: "Latest receipt", value: asOf },
      { label: "Net value", value: money(total) },
      { label: "Delta vs prev", value: money(delta) },
      { label: "Trade lines", value: String(r?.trades?.length ?? 0) },
    ],
  };
}

export const EVIDENCE: readonly EvidenceItem[] = [
  {
    title: "Receipts (derived)",
    body: "Computed from consecutive snapshots and exposed as a stable API.",
    href: "/transparency",
    linkLabel: "View receipts",
  },
] as const;

export const POLICY: readonly PolicyItem[] = [
  { k: "Append-only", v: "Receipts are generated from historical snapshots; new data adds new receipts." },
  { k: "Time-stamped", v: "Every receipt is tied to an as-of date so it can be audited later." },
] as const;

export async function getTransparencyEvents(): Promise<readonly TimelineEvent[]> {
  try {
    const receipts = await apiGet<ReceiptResp[]>(`${API_HISTORY}/receipts?limit=60`);
    if (!Array.isArray(receipts)) return [];
    return receipts
      .filter((r) => hasTrades(r))
      .map((r) => ({
        date: safeDate(r.as_of),
        title: "Trades (derived)",
        detail: JSON.stringify(r),
        href: `/transparency/receipt-${safeDate(r.as_of)}`,
        tag: "trades" as TransparencyTag,
      }))
      .filter((e) => e.date !== "—");
  } catch {
    return [];
  }
}

export async function getTransparencyTimelineForUI(): Promise<readonly TimelineEvent[]> {
  return await getTransparencyEvents();
}