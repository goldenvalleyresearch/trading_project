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
  Area,
} from "recharts";
import { apiGet } from "@/lib/api";

type RangeKey = "5D" | "1M" | "3M" | "6M" | "1Y" | "ALL";
type Mode = "equity" | "twr" | "pnl" | "index" | "voo_index" | "qqq_index";

type Props = {
  height?: number;
  showControls?: boolean;
  range?: RangeKey;
  onRangeChange?: (r: RangeKey) => void;
  onData?: (points: Point[]) => void;

  // existing benchmark toggle (legacy)
  showSpy?: boolean;
  spySymbol?: string;

  // rebasing
  rebaseTo100?: boolean;

  // new modes
  mode?: Mode;
  benchmarkMode?: Mode; // ex: "voo_index"
  secondaryBenchmarkMode?: Mode; // ex: "qqq_index"

  /**
   * Clamp chart to portfolio inception date (YYYY-MM-DD).
   * This prevents ALL from showing dates before your true start.
   */
  inceptionDate?: string;
};

type Point = { d: string; v: number };
type ChartRow = { d: string; p: number | null; b: number | null; b2: number | null };
type ChartRowT = { d: string; t: number; p: number | null; pGlow: number | null; b: number | null; b2: number | null };

const TZ = "America/Chicago";

function parseDayToUtcMs(d: string) {
  const day = String(d).slice(0, 10);
  return Date.parse(day + "T12:00:00Z");
}

function isWeekendISO(d: string) {
  const ms = parseDayToUtcMs(d);
  const day = new Date(ms).getUTCDay(); // 0=Sun,6=Sat
  return day === 0 || day === 6;
}

function daysBetweenISO(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 0;
  return Math.max(0, (db - da) / 86400000);
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

function buildTimelineUnionDates(port: Point[], bench1: Point[], bench2: Point[]) {
  const pMap = new Map(port.map((x) => [x.d.slice(0, 10), x.v]));
  const b1Map = new Map(bench1.map((x) => [x.d.slice(0, 10), x.v]));
  const b2Map = new Map(bench2.map((x) => [x.d.slice(0, 10), x.v]));

  const dates = Array.from(new Set([...pMap.keys(), ...b1Map.keys(), ...b2Map.keys()])).sort(
    (a, c) => parseDayToUtcMs(a) - parseDayToUtcMs(c)
  );

  let startedP = false;
  let lastP: number | null = null;

  return dates.map<ChartRow>((d) => {
    const rawP = pMap.has(d) ? (pMap.get(d) as number) : null;
    const rawB = b1Map.has(d) ? (b1Map.get(d) as number) : null;
    const rawB2 = b2Map.has(d) ? (b2Map.get(d) as number) : null;

    if (rawP != null) {
      startedP = true;
      lastP = rawP;
    }

    return { d, p: startedP ? lastP : null, b: rawB, b2: rawB2 };
  });
}

function rebaseTo100(rows: ChartRow[]) {
  const baseRow = rows.find(
    (r) => Number.isFinite(r.p ?? NaN) && (Number.isFinite(r.b ?? NaN) || Number.isFinite(r.b2 ?? NaN))
  );
  if (!baseRow) return rows;

  const p0 = baseRow.p as number;
  if (!p0) return rows;

  const b0 = Number.isFinite(baseRow.b ?? NaN) ? (baseRow.b as number) : null;
  const b20 = Number.isFinite(baseRow.b2 ?? NaN) ? (baseRow.b2 as number) : null;

  return rows.map((r) => ({
    d: r.d,
    p: r.p == null ? null : Number(((r.p / p0) * 100).toFixed(2)),
    b: r.b == null || b0 == null ? null : Number(((r.b / b0) * 100).toFixed(2)),
    b2: r.b2 == null || b20 == null ? null : Number(((r.b2 / b20) * 100).toFixed(2)),
  }));
}

function tickStyleRange(requested: RangeKey, rows: ChartRowT[]): RangeKey {
  if (rows.length < 2) return requested;

  const first = rows[0]?.d;
  const last = rows[rows.length - 1]?.d;
  if (!first || !last) return requested;

  const spanDays = daysBetweenISO(first, last);
  if ((requested === "1Y" || requested === "ALL") && spanDays < 240) return "6M";
  return requested;
}

function makeTickFormatter(range: RangeKey) {
  if (range === "1Y" || range === "ALL") {
    let last = "";
    return (ms: number) => {
      const dt = new Date(ms);
      if (!Number.isFinite(dt.getTime())) return "";
      const lbl = dt.toLocaleDateString(undefined, { timeZone: TZ, month: "short", year: "numeric" });
      if (lbl === last) return "";
      last = lbl;
      return lbl;
    };
  }

  return (ms: number) => {
    const dt = new Date(ms);
    if (!Number.isFinite(dt.getTime())) return "";

    if (range === "5D") {
      return dt.toLocaleDateString(undefined, { timeZone: TZ, weekday: "short", month: "short", day: "2-digit" });
    }

    return dt.toLocaleDateString(undefined, { timeZone: TZ, month: "short", day: "2-digit" });
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

  const target = range === "1M" ? 10 : range === "3M" ? 10 : range === "6M" ? 7 : range === "1Y" ? 12 : 16;
  return Math.max(0, Math.ceil(len / target) - 1);
}

function symbolFromMode(mode: Mode | undefined, fallback: string) {
  if (mode === "voo_index") return "VOO";
  if (mode === "qqq_index") return "QQQ";
  return fallback;
}

function clampToInception(rows: ChartRowT[], inceptionDate?: string) {
  const inc = (inceptionDate ?? "").slice(0, 10);
  if (inc.length !== 10) return rows;
  return rows.filter((r) => r.d >= inc);
}

export default function EquityPreview({
  height = 190,
  showControls = false,
  range: rangeProp,
  onRangeChange,
  onData,
  showSpy = true,
  spySymbol = "SPY",
  rebaseTo100: rebaseFlag = true,
  mode = "twr",
  benchmarkMode,
  secondaryBenchmarkMode,
  inceptionDate,
}: Props) {
  const [rangeState, setRangeState] = useState<RangeKey>("1Y");
  const range = rangeProp ?? rangeState;

  const setRange = (r: RangeKey) => {
    onRangeChange?.(r);
    if (rangeProp === undefined) setRangeState(r);
  };

  const [equityRemote, setEquityRemote] = useState<unknown>(null);

  const [benchRemote, setBenchRemote] = useState<unknown>(null);
  const [benchErr, setBenchErr] = useState<string | null>(null);

  const [bench2Remote, setBench2Remote] = useState<unknown>(null);
  const [bench2Err, setBench2Err] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [hover, setHover] = useState<ChartRowT | null>(null);
  const lastSentRef = useRef<string>("");

  // ---- portfolio series ----
  useEffect(() => {
    let alive = true;
    const pollMs = range === "5D" ? 15000 : 60000;

    const tick = async () => {
      try {
        setLoading(true);
        setErr(null);
        const windowN = fetchWindow(range);

        const json = await apiGet<unknown>(
          `/api/portfolio/equity-curve?window=${encodeURIComponent(String(windowN))}&mode=${encodeURIComponent(
            mode
          )}&max_age_sec=60`
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
  }, [range, mode]);

  // ---- benchmark 1 ----
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

        const sym = symbolFromMode(benchmarkMode, (spySymbol || "SPY").trim().toUpperCase());
        const apiRange = apiRangeForBenchmark(range);

        const json = await apiGet<unknown>(
          `/api/benchmark/price-series?symbol=${encodeURIComponent(sym)}&range=${encodeURIComponent(
            apiRange
          )}&max_age_sec=60`
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
  }, [range, showSpy, spySymbol, benchmarkMode]);

  // ---- benchmark 2 ----
  useEffect(() => {
    if (!secondaryBenchmarkMode) {
      setBench2Remote(null);
      setBench2Err(null);
      return;
    }

    let alive = true;
    const pollMs = range === "5D" ? 15000 : 60000;

    const tick = async () => {
      try {
        setBench2Err(null);

        const sym = symbolFromMode(secondaryBenchmarkMode, "QQQ");
        const apiRange = apiRangeForBenchmark(range);

        const json = await apiGet<unknown>(
          `/api/benchmark/price-series?symbol=${encodeURIComponent(sym)}&range=${encodeURIComponent(
            apiRange
          )}&max_age_sec=60`
        );

        if (!alive) return;
        setBench2Remote(json);
      } catch (e: any) {
        if (!alive) return;
        setBench2Err(e?.message ?? "Failed to load 2nd benchmark");
        setBench2Remote(null);
      }
    };

    tick();
    const t = window.setInterval(tick, pollMs);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [range, secondaryBenchmarkMode]);

  const eqPoints = useMemo(() => {
    const pts = uniqByDayKeepLast(sortByDate(normalizeEquity(equityRemote)));
    const inc = (inceptionDate ?? "").slice(0, 10);
    if (inc.length !== 10) return pts;
    return pts.filter((p) => p.d >= inc);
  }, [equityRemote, inceptionDate]);

  const chartData = useMemo<ChartRowT[]>(() => {
    const eq = eqPoints;

    const bench1 = uniqByDayKeepLast(sortByDate(normalizeSeriesClose(benchRemote)));
    const bench2 = uniqByDayKeepLast(sortByDate(normalizeSeriesClose(bench2Remote)));

    if (eq.length === 0) return [];

    const useB1 = showSpy && !benchErr ? bench1 : [];
    const useB2 = secondaryBenchmarkMode && !bench2Err ? bench2 : [];

    const timeline = buildTimelineUnionDates(eq, useB1, useB2);

    const need = Math.min(timeline.length, desiredPoints(range));
    const sliced = timeline.length > need ? timeline.slice(timeline.length - need) : timeline;

    if (sliced.length < 2) return [];

    const hasAnyOverlap = sliced.some(
      (r) => Number.isFinite(r.p ?? NaN) && (Number.isFinite(r.b ?? NaN) || Number.isFinite(r.b2 ?? NaN))
    );

    const rebased = rebaseFlag && hasAnyOverlap ? rebaseTo100(sliced) : sliced;

    const rows = rebased
      .filter((r) => r.d.length === 10)
      .filter((r) => !isWeekendISO(r.d))
      .map((r) => ({ d: r.d, t: parseDayToUtcMs(r.d), p: r.p,pGlow: r.p, b: r.b, b2: r.b2 }))
      .filter((r) => Number.isFinite(r.t))
      .sort((a, b) => a.t - b.t);

    // Clamp to inception date so "ALL" doesn't show earlier history than your portfolio.
    return range === "ALL" ? clampToInception(rows, inceptionDate) : rows;
  }, [
    eqPoints,
    benchRemote,
    bench2Remote,
    range,
    rebaseFlag,
    showSpy,
    benchErr,
    bench2Err,
    secondaryBenchmarkMode,
    inceptionDate,
  ]);

  // send portfolio points back to parent
  useEffect(() => {
    if (!onData) return;

    const last = eqPoints.length ? eqPoints[eqPoints.length - 1] : null;
    const key = `${eqPoints.length}:${last?.d ?? ""}:${last && Number.isFinite(last.v) ? last.v.toFixed(6) : "x"}`;

    if (lastSentRef.current === key) return;
    lastSentRef.current = key;

    onData(eqPoints);
  }, [eqPoints, onData]);

  // ticks
  const tickStyle = useMemo(() => tickStyleRange(range, chartData), [range, chartData]);
  const tickFormatter = useMemo(() => makeTickFormatter(tickStyle), [tickStyle]);
  const xInterval = useMemo(() => intervalFor(tickStyle, chartData.length), [tickStyle, chartData.length]);

  const tooltipFmt = rebaseFlag ? fmtPctFrom100 : fmtUSD;

  const bench1Label = useMemo(() => symbolFromMode(benchmarkMode, (spySymbol || "SPY").trim().toUpperCase()), [
    benchmarkMode,
    spySymbol,
  ]);
  const bench2Label = useMemo(() => symbolFromMode(secondaryBenchmarkMode, "QQQ"), [secondaryBenchmarkMode]);

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
              {r}
            </button>
          ))}
          {showSpy && (
            <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8 }}>
              {benchErr ? `Benchmark: ${bench1Label} (off)` : `Benchmark: ${bench1Label}`}
            </div>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 18, left: 6, bottom: 18 }}
          onMouseMove={(state: any) => {
            const idx = state?.activeTooltipIndex;
            if (typeof idx === "number" && chartData[idx]) setHover(chartData[idx]);
          }}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="pFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(110,160,255,0.18)" />
              <stop offset="100%" stopColor="rgba(110,160,255,0.00)" />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
          <YAxis hide domain={["auto", "auto"]} />
          <XAxis
            dataKey="d"
            axisLine={false}
            tickLine={false}
            interval={xInterval as any}
            minTickGap={12}
            tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
            tickFormatter={(d: string) => {
              // reuse your existing formatter logic by converting d -> ms
              return tickFormatter(parseDayToUtcMs(d) as any);
            }}
            tickMargin={10}
            height={24}
          />

          {/* REAL tooltip (your previous content={() => null} suppressed it) */}
          <Tooltip
            labelFormatter={(label) => tooltipLabelFromMs(Number(label))}
            formatter={(value, name) => {
              if (name === "pGlow") return null; // <-- hides the gray duplicate row

              const n = Number(value);
              const labelName =
                name === "p" ? "Portfolio" : name === "b" ? bench1Label : name === "b2" ? bench2Label : String(name);
              return [tooltipFmt(n), labelName];
            }}
            contentStyle={{
              background: "rgba(10,12,18,0.92)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 12,
              color: "rgba(255,255,255,0.9)",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.65)" }}
            cursor={{ stroke: "rgba(255,255,255,0.10)" }}
          />

          {/* Under-fill for Portfolio */}
          <Area
            type="monotone"
            dataKey="p"
            fill="url(#pFill)"
            stroke="none"
            isAnimationActive={false}
            connectNulls
            tooltipType="none"
          />

          {/* Portfolio glow (draw a thicker, faint line under the real line) */}
          <Line
            type="monotone"
            dataKey="pGlow"
            stroke="rgba(212, 175, 55, 0.35)"   // gold glow layer
            strokeWidth={8}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />

          {/* Portfolio main line */}
          <Line
            type="monotone"
            dataKey="p"
            stroke="rgba(214, 168, 76, 0.95)" // gold
            strokeWidth={2.75}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />

          {showSpy && !benchErr && (
            <Line
              type="monotone"
              dataKey="b"
              stroke="rgba(165, 95, 255, 0.9)" // purple for VOO
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}

          {secondaryBenchmarkMode && !bench2Err && (
            <Line
              type="monotone"
              dataKey="b2"
              stroke="rgba(90, 150, 255, 0.9)" // blue for QQQ
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      <InspectorRow
        row={hover}
        rebaseTo100={rebaseFlag}
        bench1Label={bench1Label}
        bench2Label={bench2Label}
        showBench1={showSpy && !benchErr}
        showBench2={Boolean(secondaryBenchmarkMode && !bench2Err)}
      />
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

function InspectorRow({
  row,
  rebaseTo100,
  bench1Label,
  bench2Label,
  showBench1,
  showBench2,
}: {
  row: ChartRowT | null;
  rebaseTo100: boolean;
  bench1Label: string;
  bench2Label: string;
  showBench1: boolean;
  showBench2: boolean;
}) {
  if (!row) return null;

  const label = tooltipLabelFromMs(parseDayToUtcMs(row.d));
  const fmt = rebaseTo100 ? fmtPctFrom100 : fmtUSD;

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.18)",
        display: "flex",
        gap: 14,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.70)" }}>{label}</div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.86)" }}>Portfolio:</span>
        <span style={{ fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
          {row.p == null ? "—" : fmt(Number(row.p))}
        </span>
      </div>

      {showBench1 && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", opacity: 0.85 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.70)" }}>{bench1Label}:</span>
          <span style={{ fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
            {row.b == null ? "—" : fmt(Number(row.b))}
          </span>
        </div>
      )}

      {showBench2 && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", opacity: 0.85 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.70)" }}>{bench2Label}:</span>
          <span style={{ fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
            {row.b2 == null ? "—" : fmt(Number(row.b2))}
          </span>
        </div>
      )}
    </div>
  );
}