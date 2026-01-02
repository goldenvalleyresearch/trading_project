// new-frontend/src/lib/research.ts
// DROP-IN FIX: move ALL “page helper” formatting/sort helpers here
// so page.tsx stays dumb + SSR/CSR stays deterministic (no hydration mismatch).

import { apiGet, apiPostForm } from "@/lib/api";

export type ResearchKind = "fundamentals" | "factors" | "merged" | "unknown";

export type ResearchRow = {
  rank: number | null;
  symbol: string;

  company_name: string | null;
  price: number | null;
  change_pct: number | null;
  quant_rating: number | null;

  sector_industry: string | null;
  market_cap: string | null;
  pe_ttm: string | null;
  net_income_ttm: string | null;
  yield_fwd: string | null;
  perf_1m: string | null;
  perf_6m: string | null;
  sa_analyst_ratings: number | null;
  ebitda_fwd: string | null;
  low_52w: number | null;
  high_52w: number | null;

  wall_street_ratings: number | null;
  valuation_grade: string | null;
  growth_grade: string | null;
  profitability_grade: string | null;
  momentum_grade: string | null;
  eps_rev_grade: string | null;

  report_type: ResearchKind;
  as_of: string | null;
};

export type ResearchPayload = {
  asOf: string;
  rows: ResearchRow[];
};

export type ResearchFileItem = {
  file_id: string;
  as_of: string;
  kind: ResearchKind;
  filename: string;
  inserted_rows: number;
  uploaded_at: string;
};

export type UploadResearchResp = {
  as_of: string;
  kind: ResearchKind;
  file_id: string;
  inserted_rows: number;
  sha256: string;
  columns_detected: Record<string, string | null>;
};


export const LOCALE = "en-US";


export const RESEARCH_COLLATOR = new Intl.Collator(LOCALE, {
  usage: "sort",
  sensitivity: "base",
  numeric: true,
});


export type Tone = "good" | "mid" | "bad" | "muted";

export function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function cleanText(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const s = x.trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (
    low === "nm" ||
    low === "n/a" ||
    low === "na" ||
    low === "null" ||
    s === "—" ||
    s === "-"
  )
    return null;
  return s;
}

const NF_1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

export function fmtPe(x: unknown): string {
  const s = cleanText(x);
  if (!s) return "—";
  const n = Number(s.replace(/[, ]/g, ""));
  if (!Number.isFinite(n)) return s;
  return NF_1.format(n);
}

export function fmtShortMoneyFromStringish(x: unknown): string {
  const s = cleanText(x);
  if (!s) return "—";
  const n = Number(s.replace(/[$,%\s,]/g, ""));
  if (!Number.isFinite(n)) return s;

  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function safeId(s: unknown): string {
  const t = typeof s === "string" ? s : "";
  return t.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function gradeChip(v: string | null): { label: string; tone: Tone } {
  const s = (v ?? "").trim().toUpperCase();
  if (!s) return { label: "—", tone: "muted" };
  if (s.startsWith("A")) return { label: s, tone: "good" };
  if (s.startsWith("B")) return { label: s, tone: "mid" };
  if (s.startsWith("C") || s.startsWith("D") || s.startsWith("F"))
    return { label: s, tone: "bad" };
  return { label: s, tone: "muted" };
}

export function hasAnyFactorGrades(r: ResearchRow): boolean {
  return Boolean(
    r.wall_street_ratings !== null ||
      cleanText(r.valuation_grade) ||
      cleanText(r.growth_grade) ||
      cleanText(r.profitability_grade) ||
      cleanText(r.momentum_grade) ||
      cleanText(r.eps_rev_grade)
  );
}

export function avg(nums: Array<number | null | undefined>): number | null {
  const v = nums.filter(
    (x): x is number => typeof x === "number" && Number.isFinite(x)
  );
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function topN<T>(arr: T[], n: number): T[] {
  return arr.slice(0, Math.max(0, n));
}

export function sortResearchRows(rows: ResearchRow[]): ResearchRow[] {
  return [...rows].sort((a, b) => {
    const ar = typeof a.rank === "number" ? a.rank : 999999;
    const br = typeof b.rank === "number" ? b.rank : 999999;
    if (ar !== br) return ar - br;

    const as = typeof a.symbol === "string" ? a.symbol : "";
    const bs = typeof b.symbol === "string" ? b.symbol : "";
    return RESEARCH_COLLATOR.compare(as, bs);
  });
}

export function fmtMaybe(s: string | null): string {
  return s && s.trim().length ? s : "—";
}

export function fmtNum(n: number | null, maxFrac = 2): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(LOCALE, { maximumFractionDigits: maxFrac });
}

export function fmtMoney(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(LOCALE, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toStr(v: unknown): string | null {
  if (typeof v === "string") {
    const s = v.trim();
    return s ? s : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function getStr(o: Record<string, unknown>, key: string): string | null {
  return toStr(o[key]);
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,%\s,]/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getNum(o: Record<string, unknown>, key: string): number | null {
  return toNum(o[key]);
}

function normSymbol(s: string | null): string {
  return (s ?? "").trim().toUpperCase();
}

function normKind(s: string | null): ResearchKind {
  const t = (s ?? "").trim().toLowerCase();
  if (t === "fundamentals" || t.startsWith("fund")) return "fundamentals";
  if (t === "factors" || t.startsWith("factor") || t.includes("grade"))
    return "factors";
  if (t === "merged") return "merged";
  return "unknown";
}

export function normalizeResearchRow(u: unknown): ResearchRow | null {
  if (!isRecord(u)) return null;

  const symbol = normSymbol(
    getStr(u, "symbol") ??
      getStr(u, "ticker") ??
      getStr(u, "Symbol") ??
      getStr(u, "Ticker") ??
      getStr(u, "SYM")
  );
  if (!symbol) return null;

  const report_type = normKind(
    getStr(u, "report_type") ??
      getStr(u, "reportType") ??
      getStr(u, "kind") ??
      getStr(u, "type")
  );

  const as_of =
    getStr(u, "as_of") ??
    getStr(u, "asOf") ??
    getStr(u, "asof") ??
    getStr(u, "date") ??
    null;

  return {
    rank: getNum(u, "rank") ?? getNum(u, "Rank") ?? null,
    symbol,

    company_name:
      getStr(u, "company_name") ??
      getStr(u, "companyName") ??
      getStr(u, "name") ??
      null,

    price: getNum(u, "price") ?? getNum(u, "Price") ?? null,
    change_pct:
      getNum(u, "change_pct") ??
      getNum(u, "changePct") ??
      getNum(u, "chg_pct") ??
      null,
    quant_rating:
      getNum(u, "quant_rating") ??
      getNum(u, "quantRating") ??
      getNum(u, "quant") ??
      null,

    sector_industry:
      getStr(u, "sector_industry") ??
      getStr(u, "sectorIndustry") ??
      getStr(u, "sector") ??
      null,
    market_cap: getStr(u, "market_cap") ?? getStr(u, "marketCap") ?? null,
    pe_ttm: getStr(u, "pe_ttm") ?? getStr(u, "peTtm") ?? getStr(u, "pe") ?? null,
    net_income_ttm: getStr(u, "net_income_ttm") ?? getStr(u, "netIncomeTtm") ?? null,
    yield_fwd: getStr(u, "yield_fwd") ?? getStr(u, "yieldFwd") ?? null,
    perf_1m: getStr(u, "perf_1m") ?? getStr(u, "perf1m") ?? null,
    perf_6m: getStr(u, "perf_6m") ?? getStr(u, "perf6m") ?? null,
    sa_analyst_ratings:
      getNum(u, "sa_analyst_ratings") ?? getNum(u, "saAnalystRatings") ?? null,
    ebitda_fwd: getStr(u, "ebitda_fwd") ?? getStr(u, "ebitdaFwd") ?? null,
    low_52w: getNum(u, "low_52w") ?? getNum(u, "low52w") ?? null,
    high_52w: getNum(u, "high_52w") ?? getNum(u, "high52w") ?? null,

    wall_street_ratings:
      getNum(u, "wall_street_ratings") ?? getNum(u, "wallStreetRatings") ?? null,
    valuation_grade:
      getStr(u, "valuation_grade") ?? getStr(u, "valuationGrade") ?? null,
    growth_grade: getStr(u, "growth_grade") ?? getStr(u, "growthGrade") ?? null,
    profitability_grade:
      getStr(u, "profitability_grade") ?? getStr(u, "profitabilityGrade") ?? null,
    momentum_grade:
      getStr(u, "momentum_grade") ?? getStr(u, "momentumGrade") ?? null,
    eps_rev_grade: getStr(u, "eps_rev_grade") ?? getStr(u, "epsRevGrade") ?? null,

    report_type,
    as_of,
  };
}

function pickRowsAnyShape(u: unknown): unknown[] {
  if (Array.isArray(u)) return u;

  if (isRecord(u)) {
    const candidates = ["rows", "data", "items", "results", "payload"];
    for (const k of candidates) {
      const v = u[k];
      if (Array.isArray(v)) return v;
    }

    const nested = u["rows"];
    if (isRecord(nested)) {
      const v = nested["rows"];
      if (Array.isArray(v)) return v;
    }
  }

  return [];
}

export function normalizeResearchPayload(u: unknown): ResearchPayload {
  const rowsRaw = pickRowsAnyShape(u);

  const rows: ResearchRow[] = rowsRaw
    .map(normalizeResearchRow)
    .filter((x): x is ResearchRow => x !== null);

  let asOf = rows[0]?.as_of ?? "—";
  if (isRecord(u)) {
    asOf =
      getStr(u, "asOf") ??
      getStr(u, "as_of") ??
      getStr(u, "asof") ??
      getStr(u, "date") ??
      rows[0]?.as_of ??
      "—";
  }

  return { asOf, rows };
}

export function normalizeFileItem(u: unknown): ResearchFileItem | null {
  if (!isRecord(u)) return null;

  const file_id = getStr(u, "file_id") ?? getStr(u, "fileId");
  const as_of = getStr(u, "as_of") ?? getStr(u, "asOf");
  const filename = getStr(u, "filename") ?? getStr(u, "file_name");
  if (!file_id || !as_of || !filename) return null;

  return {
    file_id,
    as_of,
    kind: normKind(
      getStr(u, "kind") ?? getStr(u, "report_type") ?? getStr(u, "reportType")
    ),
    filename,
    inserted_rows: getNum(u, "inserted_rows") ?? getNum(u, "insertedRows") ?? 0,
    uploaded_at: getStr(u, "uploaded_at") ?? getStr(u, "uploadedAt") ?? "",
  };
}


function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}


export async function getResearchRows(opts?: {
  limit?: number;
  kind?: ResearchKind;
}): Promise<ResearchPayload> {
  const limit = opts?.limit ?? 500;
  const kind =
    opts?.kind === "fundamentals" || opts?.kind === "factors" ? opts.kind : undefined;

  const raw = await apiGet<unknown>(`/api/research/latest${qs({ limit, kind })}`);
  return normalizeResearchPayload(raw);
}

export async function listResearchFiles(limit = 50): Promise<ResearchFileItem[]> {
  const raw = await apiGet<unknown>(`/api/research/files${qs({ limit })}`);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeFileItem).filter((x): x is ResearchFileItem => x !== null);
}

async function uploadTo(
  path: string,
  args: { file: File; as_of: string }
): Promise<UploadResearchResp> {
  const fd = new FormData();
  fd.append("file", args.file);

  const raw = await apiPostForm<unknown>(`${path}${qs({ as_of: args.as_of })}`, fd);
  if (!isRecord(raw)) throw new Error("upload failed: invalid json");

  return {
    as_of: getStr(raw, "as_of") ?? getStr(raw, "asOf") ?? args.as_of,
    kind: normKind(getStr(raw, "kind") ?? getStr(raw, "report_type") ?? getStr(raw, "reportType")),
    file_id: getStr(raw, "file_id") ?? getStr(raw, "fileId") ?? "",
    inserted_rows: getNum(raw, "inserted_rows") ?? getNum(raw, "insertedRows") ?? 0,
    sha256: getStr(raw, "sha256") ?? "",
    columns_detected: (() => {
      const cd = (isRecord(raw) ? raw["columns_detected"] : null) as unknown;
      if (!isRecord(cd)) return {};
      const out: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(cd)) out[k] = toStr(v);
      return out;
    })(),
  };
}

export async function uploadFundamentalsFile(args: { file: File; as_of: string }) {
  return uploadTo("/api/research/upload/fundamentals", args);
}

export async function uploadFactorsFile(args: { file: File; as_of: string }) {
  return uploadTo("/api/research/upload/factors", args);
}