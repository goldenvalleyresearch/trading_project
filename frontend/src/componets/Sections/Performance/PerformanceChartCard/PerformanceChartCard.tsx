"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./PerformanceChartCard.module.css";
import EquityPreview from "@/componets/UI/EquityPreview/EquityPreview";
import { apiGet } from "@/lib/api";

type EquityPoint = { d: string; v: number };

// keep your page buttons
type RangeKey = "5D" | "1M" | "3M" | "ALL";

const INCEPTION_DATE = "2025-09-18";

// desired trading-day-ish sample sizes
const N_5D = 6;
const N_1M = 22;
const N_3M = 63;

function parseDayToUtcMs(d: string) {
  const day = String(d).slice(0, 10);
  return Date.parse(day + "T12:00:00Z");
}

function clampToInception(points: EquityPoint[], inceptionISO: string) {
  const t0 = parseDayToUtcMs(inceptionISO);
  return points.filter((p) => parseDayToUtcMs(p.d) >= t0);
}

function sortUniq(points: EquityPoint[]) {
  const m = new Map<string, number>();
  for (const p of points) {
    const d = String(p.d).slice(0, 10);
    const v = Number(p.v);
    if (d.length === 10 && Number.isFinite(v)) m.set(d, v);
  }
  const days = Array.from(m.keys()).sort((a, b) => parseDayToUtcMs(a) - parseDayToUtcMs(b));
  return days.map((d) => ({ d, v: m.get(d)! }));
}

function sliceLast(points: EquityPoint[], n: number) {
  if (points.length <= n) return points;
  return points.slice(points.length - n);
}

function pctReturn(points: EquityPoint[]) {
  if (points.length < 2) return null;
  const first = points.find((p) => Number.isFinite(p.v));
  const last = [...points].reverse().find((p) => Number.isFinite(p.v));
  if (!first || !last) return null;
  if (!first.v) return null;
  return (last.v / first.v - 1) * 100;
}

function fmtPct(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

type StatRow = {
  label: string;
  portfolio: number | null;
  voo: number | null;
  qqq: number | null;
};

export default function PerformanceChartCard() {
  const [range, setRange] = useState<RangeKey>("3M");
  const [updatedOn, setUpdatedOn] = useState<string>("—");

  // cached series for stats cards
  const [portSeries, setPortSeries] = useState<EquityPoint[]>([]);
  const [vooSeries, setVooSeries] = useState<EquityPoint[]>([]);
  const [qqqSeries, setQqqSeries] = useState<EquityPoint[]>([]);

  const [statsErr, setStatsErr] = useState<string | null>(null);

  const lastKeyRef = useRef<string>("");

  // This is called by EquityPreview for portfolio series (already working in your file)
  const handleChartData = useCallback((pts: any[]) => {
    const cleaned: EquityPoint[] = Array.isArray(pts)
      ? pts
          .map((p) => ({
            d: String(p?.d ?? "").slice(0, 10),
            v: Number(p?.v),
          }))
          .filter((p) => p.d.length === 10 && Number.isFinite(p.v))
      : [];

    const uniq = sortUniq(cleaned);
    const clamped = clampToInception(uniq, INCEPTION_DATE);
    setPortSeries(clamped);

    const last = clamped.length ? clamped[clamped.length - 1] : null;
    const key = `${clamped.length}:${last?.d ?? ""}:${last && Number.isFinite(last.v) ? last.v.toFixed(6) : "x"}`;

    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    setUpdatedOn(last?.d ?? "—");
  }, []);

  // Fetch benchmarks once (for stats cards). We clamp to inception locally.
  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        setStatsErr(null);

        // "5Y" gives enough history; we'll clamp to inception anyway
        const [voo, qqq] = await Promise.all([
          apiGet<any>(`/api/benchmark/price-series?symbol=VOO&range=5Y&max_age_sec=60`),
          apiGet<any>(`/api/benchmark/price-series?symbol=QQQ&range=5Y&max_age_sec=60`),
        ]);

        if (!alive) return;

        const norm = (root: any): EquityPoint[] => {
          const arr: any[] =
            Array.isArray(root) ? root : Array.isArray(root?.series) ? root.series : Array.isArray(root?.data) ? root.data : [];
          const pts = arr
            .map((p) => ({
              d: String(p?.date ?? p?.d ?? "").slice(0, 10),
              v: Number(p?.close ?? p?.c ?? p?.price ?? p?.v),
            }))
            .filter((p) => p.d.length === 10 && Number.isFinite(p.v));
          return clampToInception(sortUniq(pts), INCEPTION_DATE);
        };

        setVooSeries(norm(voo));
        setQqqSeries(norm(qqq));
      } catch (e: any) {
        if (!alive) return;
        setStatsErr(e?.message ?? "Failed to load benchmarks");
        setVooSeries([]);
        setQqqSeries([]);
      }
    };

    tick();
    const t = window.setInterval(tick, 60000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const ranges: RangeKey[] = ["5D", "1M", "3M", "ALL"];

  // Build the 4 cards from the cached series (portfolio from EquityPreview, benchmarks from this component)
  const statRows = useMemo<StatRow[]>(() => {
    const port = portSeries;
    const voo = vooSeries;
    const qqq = qqqSeries;

    const r5d = {
      label: "5D",
      portfolio: pctReturn(sliceLast(port, N_5D)),
      voo: pctReturn(sliceLast(voo, N_5D)),
      qqq: pctReturn(sliceLast(qqq, N_5D)),
    };

    const r1m = {
      label: "1M",
      portfolio: pctReturn(sliceLast(port, N_1M)),
      voo: pctReturn(sliceLast(voo, N_1M)),
      qqq: pctReturn(sliceLast(qqq, N_1M)),
    };

    const r3m = {
      label: "3M",
      portfolio: pctReturn(sliceLast(port, N_3M)),
      voo: pctReturn(sliceLast(voo, N_3M)),
      qqq: pctReturn(sliceLast(qqq, N_3M)),
    };

    const rAll = {
      label: "Since inception",
      portfolio: pctReturn(port),
      voo: pctReturn(voo),
      qqq: pctReturn(qqq),
    };

    return [r5d, r1m, r3m, rAll];
  }, [portSeries, vooSeries, qqqSeries]);

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartTop}>
        <div>
          <div className={styles.chartTitle}>Performance Index</div>
          <div className={styles.chartSub}>Updated: {updatedOn}</div>
        </div>

        <div className={styles.controls}>
          <div className={styles.range}>
            {ranges.map((r) => (
              <button
                key={r}
                className={`${styles.rangeBtn} ${range === r ? styles.rangeActive : ""}`}
                onClick={() => setRange(r)}
                type="button"
              >
                {r}
              </button>
            ))}
          </div>

          <div className={styles.benchmark}>
            <span className={styles.badge}>Portfolio vs VOO vs QQQ</span>
          </div>
        </div>
      </div>

      <div className={styles.chartBody}>
        <EquityPreview
          // IMPORTANT: your buttons control range; EquityPreview should NOT render its own buttons
          showControls={false}
          range={range as any}
          onRangeChange={(r: any) => setRange(r)}
          onData={handleChartData}
          mode="index"
          benchmarkMode="voo_index"
          secondaryBenchmarkMode="qqq_index"
          rebaseTo100
          inceptionDate={INCEPTION_DATE}
        />

        {/* Stats cards row */}
        <div className={styles.statsRow}>
          {statRows.map((row) => (
            <div key={row.label} className={styles.statCard}>
              <div className={styles.statHeader}>{row.label}</div>

              <div className={styles.statLine}>
                <span className={styles.statKey}>Portfolio</span>
                <span className={styles.statVal}>{fmtPct(row.portfolio)}</span>
              </div>

              <div className={styles.statLine}>
                <span className={styles.statKey}>VOO</span>
                <span className={styles.statVal}>{fmtPct(row.voo)}</span>
              </div>

              <div className={styles.statLine}>
                <span className={styles.statKey}>QQQ</span>
                <span className={styles.statVal}>{fmtPct(row.qqq)}</span>
              </div>
            </div>
          ))}
        </div>

        {statsErr && <div className={styles.statsErr}>Benchmarks: {statsErr}</div>}
      </div>
    </section>
  );
}