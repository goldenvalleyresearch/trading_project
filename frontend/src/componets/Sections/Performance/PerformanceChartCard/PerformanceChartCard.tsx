"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./PerformanceChartCard.module.css";
import EquityPreview from "@/componets/UI/EquityPreview/EquityPreview";
import { apiGet } from "@/lib/api";

type EquityPoint = { d: string; v: number };
type RangeKey = "5D" | "1M" | "6M" | "1Y" | "ALL";
type BenchRange = "1M" | "1Y" | "ALL";

function pctStr(x: number | null | undefined): string {
  if (typeof x !== "number" || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(2)}%`;
}

function numStr(x: number | null | undefined, digits = 2): string {
  if (typeof x !== "number" || !Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

function daysBetweenISO(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 0;
  return Math.max(0, (db - da) / 86400000);
}

function computeCAGR(points: EquityPoint[]): number | null {
  if (points.length < 2) return null;
  const start = Number(points[0].v);
  const end = Number(points[points.length - 1].v);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0) return null;

  const days = daysBetweenISO(points[0].d, points[points.length - 1].d);
  if (days <= 0) return null;

  const years = days / 365.25;
  return Math.pow(end / start, 1 / years) - 1;
}

function computeMaxDrawdown(points: EquityPoint[]): number | null {
  if (points.length < 2) return null;
  let peak = -Infinity;
  let maxDD = 0;

  for (const p of points) {
    const v = Number(p.v);
    if (!Number.isFinite(v)) continue;
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (v - peak) / peak;
      if (dd < maxDD) maxDD = dd;
    }
  }
  return Number.isFinite(maxDD) ? maxDD : null;
}

function computeSharpe(points: EquityPoint[]): number | null {
  if (points.length < 20) return null;

  const rets: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = Number(points[i - 1].v);
    const cur = Number(points[i].v);
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev <= 0) continue;
    const r = cur / prev - 1;
    if (Number.isFinite(r)) rets.push(r);
  }

  if (rets.length < 10) return null;

  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varr = rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (rets.length - 1);
  const sd = Math.sqrt(varr);
  if (!Number.isFinite(sd) || sd === 0) return null;

  return (mean / sd) * Math.sqrt(252);
}

function normalizeCloseSeries(input: any): EquityPoint[] {
  const arr: any[] = Array.isArray(input?.series) ? input.series : Array.isArray(input) ? input : [];
  return arr
    .map((p) => ({
      d: String(p?.date ?? p?.d ?? "").slice(0, 10),
      v: Number(p?.close ?? p?.c ?? p?.price ?? p?.v),
    }))
    .filter((p) => p.d.length === 10 && Number.isFinite(p.v));
}

function computeVsSPY(port: EquityPoint[], spy: EquityPoint[]): number | null {
  if (port.length < 2 || spy.length < 2) return null;

  const spyMap = new Map(spy.map((p) => [p.d, p.v]));
  const shared = port.filter((p) => spyMap.has(p.d));
  if (shared.length < 2) return null;

  const spyShared = shared.map((p) => ({ d: p.d, v: spyMap.get(p.d)! }));

  const portC = computeCAGR(shared);
  const spyC = computeCAGR(spyShared);
  if (portC == null || spyC == null) return null;

  return portC - spyC;
}

function apiRange(r: RangeKey): BenchRange {
  if (r === "5D" || r === "1M") return "1M";
  if (r === "6M" || r === "1Y") return "1Y";
  return "ALL";
}

export default function PerformanceChartCard() {
  const [range, setRange] = useState<RangeKey>("1Y");

  const [points, setPoints] = useState<EquityPoint[]>([]);
  const [updatedOn, setUpdatedOn] = useState<string>("—");

  const [spyPoints, setSpyPoints] = useState<EquityPoint[]>([]);
  const [spyErr, setSpyErr] = useState<string | null>(null);

  const lastKeyRef = useRef<string>("");

  const handleChartData = useCallback((pts: any[]) => {
    const cleaned: EquityPoint[] = Array.isArray(pts)
      ? pts
          .map((p) => ({ d: String(p?.d ?? "").slice(0, 10), v: Number(p?.v) }))
          .filter((p) => p.d.length === 10 && Number.isFinite(p.v))
      : [];

    const last = cleaned.length ? cleaned[cleaned.length - 1] : null;
    const lastD = last ? last.d : "—";
    const lastV = last ? last.v : NaN;

    const key = `${cleaned.length}:${lastD}:${Number.isFinite(lastV) ? lastV.toFixed(6) : "x"}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    setPoints(cleaned);
    setUpdatedOn(lastD);
  }, []);

  useEffect(() => {
    let alive = true;
    const pollMs = range === "5D" ? 15000 : 60000;

    const tick = async () => {
      try {
        setSpyErr(null);
        const j: any = await apiGet(
          `/api/benchmark/price-series?symbol=SPY&range=${encodeURIComponent(apiRange(range))}&max_age_sec=60`
        );
        if (!alive) return;
        setSpyPoints(normalizeCloseSeries(j));
      } catch (e: any) {
        if (!alive) return;
        setSpyErr(e?.message ?? "Benchmark failed");
        setSpyPoints([]);
      }
    };

    tick();
    const t = window.setInterval(tick, pollMs);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [range]);

  const cagr = useMemo(() => computeCAGR(points), [points]);
  const maxDD = useMemo(() => computeMaxDrawdown(points), [points]);
  const sharpe = useMemo(() => computeSharpe(points), [points]);

  const vsSPY = useMemo(() => {
    if (spyErr) return null;
    return computeVsSPY(points, spyPoints);
  }, [points, spyPoints, spyErr]);

  const ranges: RangeKey[] = ["5D", "1M", "6M", "1Y", "ALL"];

  return (
    <section className={styles.chartCard}>
      <div className={styles.chartTop}>
        <div>
          <div className={styles.chartTitle}>Equity curve</div>
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
            <span className={styles.benchmarkLabel}>Benchmark</span>
            <span className={styles.badge}>SPY{spyErr ? " (off)" : ""}</span>
          </div>
        </div>
      </div>

      <div className={styles.chartBody}>
        <EquityPreview
          height={230}
          showControls={false}
          range={range as any}
          onRangeChange={setRange as any}
          rebaseTo100={true}
          showSpy={true}
          spySymbol="SPY"
          onData={handleChartData}
        />
      </div>

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <div className={styles.k}>CAGR</div>
          <div className={styles.v}>{pctStr(cagr)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.k}>Max drawdown</div>
          <div className={styles.v}>{pctStr(maxDD)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.k}>vs SPY</div>
          <div className={styles.v}>{pctStr(vsSPY)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.k}>Sharpe</div>
          <div className={styles.v}>{numStr(sharpe, 2)}</div>
        </div>
      </div>
    </section>
  );
}