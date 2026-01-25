"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import styles from "./PerformanceChartCard.module.css";
import EquityPreview from "@/componets/UI/EquityPreview/EquityPreview";

type EquityPoint = { d: string; v: number };
type RangeKey = "5D" | "1M" | "3M" | "6M" | "1Y" | "ALL";

function pctPtsStr(x: number | null | undefined): string {
  if (typeof x !== "number" || !Number.isFinite(x)) return "—";
  return `${x.toFixed(2)}%`;
}

function perfFromLookback(points: EquityPoint[], lookbackPoints: number): number | null {
  if (points.length < lookbackPoints + 1) return null;

  const end = Number(points[points.length - 1].v);
  const base = Number(points[points.length - 1 - lookbackPoints].v);

  if (!Number.isFinite(end) || !Number.isFinite(base) || base <= 0) return null;
  return (end / base - 1) * 100;
}

function perfSinceInception(points: EquityPoint[]): number | null {
  if (points.length < 2) return null;
  const end = Number(points[points.length - 1].v);
  const base = Number(points[0].v);
  if (!Number.isFinite(end) || !Number.isFinite(base) || base <= 0) return null;
  return (end / base - 1) * 100;
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

    const last = cleaned.length ? cleaned[cleaned.length - 1] : null;
    const key = `${cleaned.length}:${last?.d ?? ""}:${last && Number.isFinite(last.v) ? last.v.toFixed(6) : "x"}`;

    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    setPoints(cleaned);
    setUpdatedOn(last?.d ?? "—");
  }, []);

  const perf5D = useMemo(() => perfFromLookback(points, 5), [points]);
  const perf1M = useMemo(() => perfFromLookback(points, 21), [points]);
  const perf3M = useMemo(() => perfFromLookback(points, 63), [points]);
  const perfSI = useMemo(() => perfSinceInception(points), [points]);

  const ranges: RangeKey[] = ["5D", "1M", "3M", "6M", "1Y", "ALL"];

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
          <div className={styles.k}>5D</div>
          <div className={styles.v}>{pctPtsStr(perf5D)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.k}>1M</div>
          <div className={styles.v}>{pctPtsStr(perf1M)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.k}>3M</div>
          <div className={styles.v}>{pctPtsStr(perf3M)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.k}>Since 9/18/25</div>
          <div className={styles.v}>{pctPtsStr(perfSI)}</div>
        </div>
      </div>
    </section>
  );
}
