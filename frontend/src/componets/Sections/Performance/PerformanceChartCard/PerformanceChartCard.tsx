"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import styles from "./PerformanceChartCard.module.css";
import EquityPreview from "@/componets/UI/EquityPreview/EquityPreview";

type EquityPoint = { d: string; v: number };
type RangeKey = "5D" | "1M" | "6M" | "1Y" | "ALL";

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
  const start = points[0].v;
  const end = points[points.length - 1].v;
  if (start <= 0 || end <= 0) return null;

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
    if (p.v > peak) peak = p.v;
    const dd = (p.v - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }

  return maxDD;
}

function computeSharpe(points: EquityPoint[]): number | null {
  if (points.length < 20) return null;

  const rets: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const r = points[i].v / points[i - 1].v - 1;
    if (Number.isFinite(r)) rets.push(r);
  }

  if (rets.length < 10) return null;

  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance =
    rets.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (rets.length - 1);
  const sd = Math.sqrt(variance);
  if (!Number.isFinite(sd) || sd === 0) return null;

  return (mean / sd) * Math.sqrt(252);
}

export default function PerformanceChartCard() {
  const [range, setRange] = useState<RangeKey>("1Y");
  const [points, setPoints] = useState<EquityPoint[]>([]);
  const [updatedOn, setUpdatedOn] = useState<string>("—");

  const lastKeyRef = useRef<string>("");

  const handleChartData = useCallback((pts: any[]) => {
    const cleaned: EquityPoint[] = Array.isArray(pts)
      ? pts
          .map((p) => ({
            d: String(p?.d ?? "").slice(0, 10),
            v: Number(p?.v),
          }))
          .filter((p) => p.d.length === 10 && Number.isFinite(p.v))
      : [];

    const last = cleaned.at(-1);
    const key = `${cleaned.length}:${last?.d}:${last?.v?.toFixed(6)}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    setPoints(cleaned);
    setUpdatedOn(last?.d ?? "—");
  }, []);

  const cagr = useMemo(() => computeCAGR(points), [points]);
  const maxDD = useMemo(() => computeMaxDrawdown(points), [points]);
  const sharpe = useMemo(() => computeSharpe(points), [points]);

  const ranges: RangeKey[] = ["5D", "1M", "6M", "1Y", "ALL"];

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
                className={`${styles.rangeBtn} ${
                  range === r ? styles.rangeActive : ""
                }`}
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
          height={230}
          showControls={false}
          range={range as any}
          onRangeChange={setRange as any}
          mode="index"
          benchmarkMode="voo_index"
          secondaryBenchmarkMode="qqq_index"
          rebaseTo100={true}
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
          <div className={styles.k}>Sharpe</div>
          <div className={styles.v}>{numStr(sharpe, 2)}</div>
        </div>
      </div>
    </section>
  );
}
