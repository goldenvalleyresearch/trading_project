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

type RangeKey = "5D" | "1M" | "3M" | "6M" | "1Y" | "ALL";

type Props = {
  height?: number;
  showControls?: boolean;
  range?: RangeKey;
  onRangeChange?: (r: RangeKey) => void;
  onData?: (points: Point[]) => void;

  // index modes
  mode?: "index" | "voo_index" | "qqq_index";
  benchmarkMode?: "voo_index" | "qqq_index";
  secondaryBenchmarkMode?: "voo_index" | "qqq_index";

  rebaseTo100?: boolean;
};

type Point = { d: string; v: number };
type ChartRow = { d: string; p: number | null; b: number | null; b2: number | null };
type ChartRowT = { d: string; t: number; p: number | null; b: number | null; b2: number | null };

const TZ = "America/Chicago";

function parseDayToUtcMs(d: string) {
  return Date.parse(String(d).slice(0, 10) + "T12:00:00Z");
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
  return Math.min(5000, desiredPoints(range) + 600);
}

function normalizeSeries(input: unknown): Point[] {
  const root = input as any;
  const arr: any[] = Array.isArray(root?.series) ? root.series : Array.isArray(root) ? root : [];
  return arr
    .map((p) => ({
      d: String(p?.date ?? p?.d ?? "").slice(0, 10),
      v: Number(p?.balance ?? p?.v),
    }))
    .filter((p) => p.d.length === 10 && Number.isFinite(p.v));
}

function uniqByDayKeepLast(points: Point[]) {
  const m = new Map<string, number>();
  for (const p of points) m.set(p.d, p.v);
  return [...m.entries()]
    .sort((a, b) => parseDayToUtcMs(a[0]) - parseDayToUtcMs(b[0]))
    .map(([d, v]) => ({ d, v }));
}

function buildTimeline(port: Point[], bench1: Point[], bench2: Point[]) {
  const pMap = new Map(port.map((x) => [x.d, x.v]));
  const bMap = new Map(bench1.map((x) => [x.d, x.v]));
  const b2Map = new Map(bench2.map((x) => [x.d, x.v]));

  const dates = Array.from(new Set([...pMap.keys(), ...bMap.keys(), ...b2Map.keys()])).sort(
    (a, b) => parseDayToUtcMs(a) - parseDayToUtcMs(b)
  );

  let started = false;
  let lastP: number | null = null;

  return dates.map<ChartRow>((d) => {
    if (pMap.has(d)) {
      started = true;
      lastP = pMap.get(d)!;
    }
    return {
      d,
      p: started ? lastP : null,
      b: bMap.get(d) ?? null,
      b2: b2Map.get(d) ?? null,
    };
  });
}

function rebaseTo100(rows: ChartRow[]) {
  // find first date where all three exist (best)
  const baseAll = rows.find((r) => r.p != null && r.b != null && r.b2 != null);
  const base = baseAll ?? rows.find((r) => r.p != null && (r.b != null || r.b2 != null));
  if (!base || base.p == null) return rows;

  const p0 = base.p;
  const b0 = base.b ?? null;
  const b20 = base.b2 ?? null;

  return rows.map((r) => ({
    d: r.d,
    p: r.p == null ? null : (r.p / p0) * 100,
    b: r.b == null || b0 == null ? null : (r.b / b0) * 100,
    b2: r.b2 == null || b20 == null ? null : (r.b2 / b20) * 100,
  }));
}

function makeTickFormatter(range: RangeKey) {
  return (ms: number) => {
    const d = new Date(ms);
    if (range === "5D" || range === "1M" || range === "3M" || range === "6M") {
      return d.toLocaleDateString(undefined, { timeZone: TZ, month: "short", day: "2-digit" });
    }
    return d.toLocaleDateString(undefined, { timeZone: TZ, month: "short", year: "numeric" });
  };
}

export default function EquityPreview({
  height = 230,
  showControls = false,
  range: rangeProp,
  onRangeChange,
  onData,
  mode = "index",
  benchmarkMode = "voo_index",
  secondaryBenchmarkMode = "qqq_index",
  rebaseTo100: doRebase = true,
}: Props) {
  const [rangeState, setRangeState] = useState<RangeKey>("1Y");
  const range = rangeProp ?? rangeState;

  const setRange = (r: RangeKey) => {
    onRangeChange?.(r);
    if (!rangeProp) setRangeState(r);
  };

  const [portRaw, setPortRaw] = useState<unknown>(null);
  const [b1Raw, setB1Raw] = useState<unknown>(null);
  const [b2Raw, setB2Raw] = useState<unknown>(null);

  const lastSentRef = useRef("");

  useEffect(() => {
    let alive = true;
    const windowN = fetchWindow(range);

    apiGet(`/api/portfolio/equity-curve?window=${windowN}&mode=${mode}`).then((j) => alive && setPortRaw(j));
    apiGet(`/api/portfolio/equity-curve?window=${windowN}&mode=${benchmarkMode}`).then((j) => alive && setB1Raw(j));
    apiGet(`/api/portfolio/equity-curve?window=${windowN}&mode=${secondaryBenchmarkMode}`).then((j) => alive && setB2Raw(j));

    return () => {
      alive = false;
    };
  }, [range, mode, benchmarkMode, secondaryBenchmarkMode]);

  const portPts = useMemo(() => uniqByDayKeepLast(normalizeSeries(portRaw)), [portRaw]);
  const b1Pts = useMemo(() => uniqByDayKeepLast(normalizeSeries(b1Raw)), [b1Raw]);
  const b2Pts = useMemo(() => uniqByDayKeepLast(normalizeSeries(b2Raw)), [b2Raw]);

  const chartData = useMemo<ChartRowT[]>(() => {
    if (!portPts.length) return [];

    const timeline = buildTimeline(portPts, b1Pts, b2Pts);
    const need = desiredPoints(range);
    const sliced = timeline.length > need ? timeline.slice(timeline.length - need) : timeline;

    const rebased = doRebase ? rebaseTo100(sliced) : sliced;

    return rebased.map((r) => ({
      d: r.d,
      t: parseDayToUtcMs(r.d),
      p: r.p,
      b: r.b,
      b2: r.b2,
    }));
  }, [portPts, b1Pts, b2Pts, range, doRebase]);

  useEffect(() => {
    if (!onData || !portPts.length) return;
    const last = portPts[portPts.length - 1];
    const key = `${portPts.length}:${last.d}:${last.v.toFixed(6)}`;
    if (lastSentRef.current === key) return;
    lastSentRef.current = key;
    onData(portPts);
  }, [portPts, onData]);

  const tickFormatter = useMemo(() => makeTickFormatter(range), [range]);

  return (
    <div>
      {showControls && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
          {(["5D", "1M", "3M", "6M", "1Y", "ALL"] as RangeKey[]).map((r) => (
            <button key={r} type="button" onClick={() => setRange(r)} style={btn(range === r)}>
              {r === "ALL" ? "5Y" : r}
            </button>
          ))}
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
            tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
            tickFormatter={tickFormatter as any}
            domain={["dataMin", "dataMax"]}
            padding={{ left: 6, right: 10 }}
            tickMargin={10}
            height={24}
          />

          <Tooltip
            labelFormatter={(label) => {
              const dt = new Date(Number(label));
              return Number.isFinite(dt.getTime())
                ? dt.toLocaleDateString(undefined, { timeZone: TZ, year: "numeric", month: "short", day: "2-digit" })
                : "—";
            }}
            formatter={(value, name) => {
              const n = Number(value);
              const labelName =
                name === "p" ? "Portfolio" : name === "b" ? "VOO" : "QQQ";
              return [Number.isFinite(n) ? n.toFixed(2) : "—", labelName];
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
          <Line type="monotone" dataKey="b" stroke="rgba(255,255,255,0.45)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
          <Line type="monotone" dataKey="b2" stroke="rgba(130,255,180,0.55)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>

      {doRebase && (
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
