"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  Tooltip,
  CartesianGrid,
  YAxis,
} from "recharts";
import { apiGet } from "@/lib/api";

type RangeKey = "1M" | "3M" | "1Y" | "ALL";

type Props = {
  height?: number;
  showControls?: boolean;

  range?: RangeKey;
  onRangeChange?: (r: RangeKey) => void;

  // sends back the SAME portfolio series used in the chart (so KPIs match)
  onData?: (points: Point[]) => void;

  showSpy?: boolean;
  spySymbol?: string;
  rebaseTo100?: boolean;
};

type Point = { d: string; v: number };
type ChartRow = { d: string; p: number | null; b: number | null };

const parseISO = (d: string) => new Date(String(d).slice(0, 10) + "T00:00:00");
const toISO = (dt: Date) => dt.toISOString().slice(0, 10);
const addDays = (dt: Date, days: number) => {
  const x = new Date(dt);
  x.setDate(x.getDate() + days);
  return x;
};

function rangeToWindow(range: RangeKey) {
  if (range === "1M") return 30;
  if (range === "3M") return 90;
  if (range === "1Y") return 365;
  return 10000;
}

function normalizeEquity(input: unknown): Point[] {
  const root = input as any;
  const arr: any[] =
    Array.isArray(root)
      ? root
      : Array.isArray(root?.series)
      ? root.series
      : Array.isArray(root?.data)
      ? root.data
      : [];

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
    Array.isArray(root)
      ? root
      : Array.isArray(root?.series)
      ? root.series
      : Array.isArray(root?.data)
      ? root.data
      : [];

  return arr
    .map((p) => ({
      d: String(p?.date ?? p?.d ?? "").slice(0, 10),
      v: Number(p?.close ?? p?.c ?? p?.price ?? p?.v),
    }))
    .filter((p) => p.d.length === 10 && Number.isFinite(p.v));
}

function sortByDate(points: Point[]) {
  return [...points].sort(
    (a, b) => parseISO(a.d).getTime() - parseISO(b.d).getTime()
  );
}

function fillDaily(points: Point[]): Point[] {
  if (points.length < 2) return points;
  const sorted = sortByDate(points);
  const out: Point[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    out.push(cur);

    const next = sorted[i + 1];
    if (!next) break;

    const curDt = parseISO(cur.d);
    const nextDt = parseISO(next.d);
    const gap = Math.round(
      (nextDt.getTime() - curDt.getTime()) / 86400000
    );

    if (gap <= 1) continue;

    // linear interpolate missing days
    for (let k = 1; k < gap; k++) {
      const t = k / gap;
      const v = cur.v + (next.v - cur.v) * t;
      out.push({ d: toISO(addDays(curDt, k)), v: Number(v.toFixed(2)) });
    }
  }
  return out;
}

function sliceForRangeDaily(data: ChartRow[], range: RangeKey) {
  const n = rangeToWindow(range);
  return data.slice(-n);
}

function makeTickFormatter(range: RangeKey) {
  return (label: string) => {
    const dt = parseISO(label);
    return range === "1M" || range === "3M"
      ? dt.toLocaleDateString(undefined, { month: "short", day: "2-digit" })
      : dt.toLocaleDateString(undefined, { month: "short" });
  };
}

function tooltipLabel(label: string) {
  const dt = parseISO(label);
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function rebaseBothTo100(rows: ChartRow[]) {
  // choose first date where BOTH exist (so comparison is fair)
  const baseRow = rows.find(
    (r) => Number.isFinite(r.p ?? NaN) && Number.isFinite(r.b ?? NaN)
  );
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

const fmtUSD = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { style: "currency", currency: "USD" })
    : "—";

// show percent change from rebased 100
const fmtPctFrom100 = (n: number) =>
  Number.isFinite(n) ? `${(n - 100).toFixed(2)}%` : "—";

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

  // ✅ prevent onData spam / loops
  const lastSentRef = useRef<string>("");

  // equity (TWR mode = performance only, excludes contributions)
  useEffect(() => {
    const controller = new AbortController();
    const window = rangeToWindow(range);

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const json = await apiGet<unknown>(
          `/api/portfolio/equity-curve?window=${window}&mode=twr`
        );
        setEquityRemote(json);
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setErr(e?.message ?? "Failed to load equity");
        setEquityRemote(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [range]);

  // send portfolio series up (same source of truth as the chart)
  useEffect(() => {
    if (!onData) return;

    const equityPts = fillDaily(sortByDate(normalizeEquity(equityRemote)));
    const lastD = equityPts.length ? equityPts[equityPts.length - 1].d : "";
    const key = `${equityPts.length}:${lastD}`;

    if (lastSentRef.current === key) return;
    lastSentRef.current = key;

    onData(equityPts);
  }, [equityRemote, onData]);

  // benchmark
  useEffect(() => {
    if (!showSpy) {
      setBenchRemote(null);
      setBenchErr(null);
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        setBenchErr(null);
        const sym = (spySymbol || "SPY").trim().toUpperCase();
        const json = await apiGet<unknown>(
          `/api/benchmark/price-series?symbol=${encodeURIComponent(
            sym
          )}&range=${encodeURIComponent(range)}`
        );
        setBenchRemote(json);
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setBenchErr(e?.message ?? "Failed to load benchmark");
        setBenchRemote(null);
      }
    })();

    return () => controller.abort();
  }, [range, showSpy, spySymbol]);

  const chartData = useMemo(() => {
    const equityPts = fillDaily(sortByDate(normalizeEquity(equityRemote)));
    const benchPts = fillDaily(sortByDate(normalizeSeriesClose(benchRemote)));

    if (equityPts.length === 0) return [];

    const pMap = new Map(equityPts.map((p) => [p.d, p.v]));
    const bMap = new Map(benchPts.map((p) => [p.d, p.v]));

    const dates = Array.from(new Set([...pMap.keys(), ...bMap.keys()])).sort(
      (a, b) => parseISO(a).getTime() - parseISO(b).getTime()
    );

    const merged: ChartRow[] = dates.map((d) => ({
      d,
      p: pMap.has(d) ? (pMap.get(d) as number) : null,
      b: bMap.has(d) ? (bMap.get(d) as number) : null,
    }));

    const sliced = sliceForRangeDaily(merged, range);
    return rebaseTo100 && showSpy ? rebaseBothTo100(sliced) : sliced;
  }, [equityRemote, benchRemote, range, rebaseTo100, showSpy]);

  const tickFormatter = useMemo(() => makeTickFormatter(range), [range]);
  const xInterval = range === "1M" ? 4 : range === "3M" ? 12 : "preserveStartEnd";

  const tooltipFmt = rebaseTo100 && showSpy ? fmtPctFrom100 : fmtUSD;

  if (loading && chartData.length === 0) {
    return (
      <div style={{ height, display: "grid", placeItems: "center", opacity: 0.7 }}>
        Loading…
      </div>
    );
  }
  if (err && chartData.length === 0) {
    return (
      <div style={{ height, display: "grid", placeItems: "center", opacity: 0.7 }}>
        Failed: {err}
      </div>
    );
  }
  if (chartData.length === 0) {
    return (
      <div style={{ height, display: "grid", placeItems: "center", opacity: 0.7 }}>
        No equity data.
      </div>
    );
  }

  return (
    <div>
      {showControls && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
          <button type="button" onClick={() => setRange("1M")} style={btn(range === "1M")}>
            1M
          </button>
          <button type="button" onClick={() => setRange("3M")} style={btn(range === "3M")}>
            3M
          </button>
          <button type="button" onClick={() => setRange("1Y")} style={btn(range === "1Y")}>
            1Y
          </button>
          <button type="button" onClick={() => setRange("ALL")} style={btn(range === "ALL")}>
            All
          </button>

          {showSpy && (
            <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8 }}>
              {benchErr ? "Benchmark: S&P 500 (off)" : "Benchmark: S&P 500"}
            </div>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
          <YAxis hide domain={["auto", "auto"]} />
          <XAxis
            dataKey="d"
            axisLine={false}
            tickLine={false}
            interval={xInterval as any}
            minTickGap={18}
            tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
            tickFormatter={tickFormatter}
          />

          <Tooltip
            labelFormatter={(label) => tooltipLabel(String(label))}
            formatter={(value, name) => {
              const n = Number(value);
              const label = name === "p" ? "Portfolio" : "S&P 500";
              return [tooltipFmt(n), label];
            }}
            contentStyle={{
              background: "rgba(10,12,18,0.92)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 12,
              color: "rgba(255,255,255,0.9)",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.65)" }}
          />

          <Line
            type="monotone"
            dataKey="p"
            stroke="rgba(110,160,255,0.9)"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />

          {showSpy && !benchErr && (
            <Line
              type="monotone"
              dataKey="b"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {rebaseTo100 && showSpy && (
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