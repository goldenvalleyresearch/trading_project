"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, Tooltip, CartesianGrid, YAxis } from "recharts";
import { apiGet } from "@/lib/api";

type RangeKey = "5D" | "1M" | "3M" | "6M" | "1Y" | "ALL";

type Props = {
  height?: number;
  showControls?: boolean;
  range?: RangeKey;
  onRangeChange?: (r: RangeKey) => void;
  onData?: (points: Point[]) => void;
  showSpy?: boolean;
  spySymbol?: string;
  rebaseTo100?: boolean;
};

type Point = { d: string; v: number };
type ChartRow = { d: string; p: number | null; b: number | null };
type ChartRowT = { d: string; t: number; p: number | null; b: number | null };

const TZ = "America/Chicago";

function parseDayToUtcMs(d: string) {
  const day = String(d).slice(0, 10);
  return Date.parse(day + "T12:00:00Z");
}

function apiRangeForBenchmark(range: RangeKey): "1M" | "3M" | "1Y" | "5Y" {
  if (range === "5D" || range === "1M") return "1M";
  if (range === "3M") return "3M";
  if (range === "6M" || range === "1Y") return "1Y";
  return "5Y";
}

function desiredPoints(range: RangeKey) {
  if (range === "5D") return 6;
  if (range === "1M") return 22;
  if (range === "3M") return 63;
  if (range === "6M") return 126;
  if (range === "1Y") return 252;
  return 252 * 5;
}

function fetchWindow(range: RangeKey) {
  const need = desiredPoints(range);
  return Math.min(5000, need + 600);
}

function normalizeEquity(input: unknown): Point[] {
  const root = input as any;
  const arr: any[] =
    Array.isArray(root) ? root : Array.isArray(root?.series) ? root.series : Array.isArray(root?.data) ? root.data : [];

  return arr
    .map((p) => ({
      d: String(p?.date ?? p?.d ?? "").slice(0, 10),
      v: Number(p?.balance ?? p?.v),
    }))
    .filter((p) => p.d.length === 10 && Number.isFinite(p.v));
}

function normalizeSeriesClose(input: unknown): Point[] {
  const root = input as any;
  const arr: any[] =
    Array.isArray(root) ? root : Array.isArray(root?.series) ? root.series : Array.isArray(root?.data) ? root.data : [];

  return arr
    .map((p) => ({
      d: String(p?.date ?? p?.d ?? "").slice(0, 10),
      v: Number(p?.close ?? p?.c ?? p?.price ?? p?.v),
    }))
    .filter((p) => p.d.length === 10 && Number.isFinite(p.v));
}

function sortByDate(points: Point[]) {
  return [...points].sort((a, b) => parseDayToUtcMs(a.d) - parseDayToUtcMs(b.d));
}

function uniqByDayKeepLast(points: Point[]) {
  const m = new Map<string, number>();
  for (const p of points) m.set(p.d.slice(0, 10), p.v);
  const days = Array.from(m.keys()).sort((a, b) => parseDayToUtcMs(a) - parseDayToUtcMs(b));
  return days.map((d) => ({ d, v: m.get(d)! }));
}

function buildTimelineUnionDates(port: Point[], bench: Point[]) {
  const pMap = new Map(port.map((x) => [x.d.slice(0, 10), x.v]));
  const bMap = new Map(bench.map((x) => [x.d.slice(0, 10), x.v]));

  const dates = Array.from(new Set([...pMap.keys(), ...bMap.keys()])).sort(
    (a, c) => parseDayToUtcMs(a) - parseDayToUtcMs(c)
  );

  let startedP = false;
  let lastP: number | null = null;

  return dates.map<ChartRow>((d) => {
    const rawP = pMap.has(d) ? (pMap.get(d) as number) : null;
    const rawB = bMap.has(d) ? (bMap.get(d) as number) : null;

    if (rawP != null) {
      startedP = true;
      lastP = rawP;
    }

    return { d, p: startedP ? lastP : null, b: rawB };
  });
}

function rebaseBothTo100(rows: ChartRow[]) {
  const baseRow = rows.find((r) => Number.isFinite(r.p ?? NaN) && Number.isFinite(r.b ?? NaN));
  if (!baseRow) return rows;

  const p0 = baseRow.p as number;
  const b0 = baseRow.b as number;
  if (!p0 || !b0) return rows;

  return rows.map((r) => ({
    d: r.d,
    p: r.p == null ? null : Number(((r.p / p0) * 100).toFixed(2)),
    b: r.b == null ? null : Number(((r.b / b0) * 100).toFixed(2)),
  }));
}

function makeTickFormatter(range: RangeKey) {
  return (ms: number) => {
    const dt = new Date(ms);
    if (!Number.isFinite(dt.getTime())) return "";

    if (range === "5D") {
      return dt.toLocaleDateString(undefined, { timeZone: TZ, weekday: "short", month: "short", day: "2-digit" });
    }

    if (range === "1M" || range === "3M" || range === "6M") {
      return dt.toLocaleDateString(undefined, { timeZone: TZ, month: "short", day: "2-digit" });
    }

    return dt.toLocaleDateString(undefined, { timeZone: TZ, month: "short", year: "numeric" });
  };
}

function tooltipLabelFromMs(ms: number) {
  const dt = new Date(ms);
  if (!Number.isFinite(dt.getTime())) return "—";
  return dt.toLocaleDateString(undefined, { timeZone: TZ, year: "numeric", month: "short", day: "2-digit" });
}

const fmtUSD = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "—";

const fmtPctFrom100 = (n: number) => (Number.isFinite(n) ? `${(n - 100).toFixed(2)}%` : "—");

function intervalFor(range: RangeKey, len: number) {
  if (len <= 2) return 0;
  if (range === "5D") return 0;

  const target =
    range === "1M"
      ? 10
      : range === "3M"
      ? 10
      : range === "6M"
      ? 7
      : range === "1Y"
      ? 12
      : 16;

  return Math.max(0, Math.ceil(len / target) - 1);
}

export default function EquityPreview({
  height = 190,
  showControls = false,
  range: rangeProp,
  onRangeChange,
  onData,
  showSpy = true,
  spySymbol = "SPY",
  rebaseTo100 = true,
}: Props) {
  const [rangeState, setRangeState] = useState<RangeKey>("1Y");
  const range = rangeProp ?? rangeState;

  const setRange = (r: RangeKey) => {
    onRangeChange?.(r);
    if (rangeProp === undefined) setRangeState(r);
  };

  const [equityRemote, setEquityRemote] = useState<unknown>(null);
  const [benchRemote, setBenchRemote] = useState<unknown>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [benchErr, setBenchErr] = useState<string | null>(null);

  const lastSentRef = useRef<string>("");

  useEffect(() => {
    let alive = true;
    const pollMs = range === "5D" ? 15000 : 60000;

    const tick = async () => {
      try {
        setLoading(true);
        setErr(null);
        const windowN = fetchWindow(range);
        const json = await apiGet<unknown>(
          `/api/portfolio/equity-curve?window=${encodeURIComponent(String(windowN))}&mode=twr&max_age_sec=60`
        );
        if (!alive) return;
        setEquityRemote(json);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load equity");
        setEquityRemote(null);
      } finally {
        if (alive) setLoading(false);
      }
    };

    tick();
    const t = window.setInterval(tick, pollMs);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [range]);

  useEffect(() => {
    if (!showSpy) {
      setBenchRemote(null);
      setBenchErr(null);
      return;
    }

    let alive = true;
    const pollMs = range === "5D" ? 15000 : 60000;

    const tick = async () => {
      try {
        setBenchErr(null);
        const sym = (spySymbol || "SPY").trim().toUpperCase();
        const apiRange = apiRangeForBenchmark(range);
        const json = await apiGet<unknown>(
          `/api/benchmark/price-series?symbol=${encodeURIComponent(sym)}&range=${encodeURIComponent(apiRange)}&max_age_sec=60`
        );
        if (!alive) return;
        setBenchRemote(json);
      } catch (e: any) {
        if (!alive) return;
        setBenchErr(e?.message ?? "Failed to load benchmark");
        setBenchRemote(null);
      }
    };

    tick();
    const t = window.setInterval(tick, pollMs);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [range, showSpy, spySymbol]);

  const eqPoints = useMemo(() => uniqByDayKeepLast(sortByDate(normalizeEquity(equityRemote))), [equityRemote]);

  const chartData = useMemo<ChartRowT[]>(() => {
    const eq = eqPoints;
    const bench = uniqByDayKeepLast(sortByDate(normalizeSeriesClose(benchRemote)));

    if (eq.length === 0) return [];

    const timeline = buildTimelineUnionDates(eq, showSpy && !benchErr ? bench : []);

    const need = Math.min(timeline.length, desiredPoints(range));
    const sliced = timeline.length > need ? timeline.slice(timeline.length - need) : timeline;

    if (sliced.length < 2) return [];

    const hasOverlap = sliced.some((r) => Number.isFinite(r.p ?? NaN) && Number.isFinite(r.b ?? NaN));
    const rebased = rebaseTo100 && showSpy && !benchErr && bench.length && hasOverlap ? rebaseBothTo100(sliced) : sliced;

    return rebased
      .map((r) => ({ d: r.d, t: parseDayToUtcMs(r.d), p: r.p, b: r.b }))
      .filter((r) => Number.isFinite(r.t))
      .sort((a, b) => a.t - b.t);
  }, [eqPoints, benchRemote, range, rebaseTo100, showSpy, benchErr]);

  useEffect(() => {
    if (!onData) return;

    const last = eqPoints.length ? eqPoints[eqPoints.length - 1] : null;
    const key = `${eqPoints.length}:${last?.d ?? ""}:${last && Number.isFinite(last.v) ? last.v.toFixed(6) : "x"}`;

    if (lastSentRef.current === key) return;
    lastSentRef.current = key;

    onData(eqPoints);
  }, [eqPoints, onData]);

  const tickFormatter = useMemo(() => makeTickFormatter(range), [range]);
  const xInterval = useMemo(() => intervalFor(range, chartData.length), [range, chartData.length]);
  const tooltipFmt = rebaseTo100 && showSpy && !benchErr ? fmtPctFrom100 : fmtUSD;

  if (loading && chartData.length === 0) {
    return <div style={{ height, display: "grid", placeItems: "center", opacity: 0.7 }}>Loading…</div>;
  }
  if (err && chartData.length === 0) {
    return <div style={{ height, display: "grid", placeItems: "center", opacity: 0.7 }}>Failed: {err}</div>;
  }
  if (chartData.length === 0) {
    return <div style={{ height, display: "grid", placeItems: "center", opacity: 0.7 }}>No equity data.</div>;
  }

  return (
    <div>
      {showControls && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
          {(["5D", "1M", "3M", "6M", "1Y", "ALL"] as RangeKey[]).map((r) => (
            <button key={r} type="button" onClick={() => setRange(r)} style={btn(range === r)}>
              {r === "ALL" ? "5Y" : r}
            </button>
          ))}
          {showSpy && (
            <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8 }}>
              {benchErr ? "Benchmark: S&P 500 (off)" : "Benchmark: S&P 500"}
            </div>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 10, right: 18, left: 6, bottom: 18 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
          <YAxis hide domain={["auto", "auto"]} />
          <XAxis
            type="number"
            scale="time"
            dataKey="t"
            axisLine={false}
            tickLine={false}
            interval={xInterval as any}
            minTickGap={12}
            tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
            tickFormatter={tickFormatter as any}
            domain={["dataMin", "dataMax"]}
            padding={{ left: 6, right: 10 }}
            allowDataOverflow
            tickMargin={10}
            height={24}
          />

          <Tooltip
            labelFormatter={(label) => tooltipLabelFromMs(Number(label))}
            formatter={(value, name) => {
              const n = Number(value);
              const labelName = name === "p" ? "Portfolio" : "S&P 500";
              return [tooltipFmt(n), labelName];
            }}
            contentStyle={{
              background: "rgba(10,12,18,0.92)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 12,
              color: "rgba(255,255,255,0.9)",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.65)" }}
          />

          <Line type="monotone" dataKey="p" stroke="rgba(110,160,255,0.9)" strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />

          {showSpy && !benchErr && (
            <Line type="monotone" dataKey="b" stroke="rgba(255,255,255,0.35)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>

      {rebaseTo100 && showSpy && !benchErr && (
        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 6 }}>
          Rebasing enabled (start = 100) using first shared date.
        </div>
      )}
    </div>
  );
}

function btn(active: boolean): CSSProperties {
  return {
    appearance: "none",
    border: "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.18)",
    color: "rgba(255,255,255,0.86)",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    cursor: "pointer",
  };
}