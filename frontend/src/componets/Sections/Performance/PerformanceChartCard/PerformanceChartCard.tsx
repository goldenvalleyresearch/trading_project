"use client";

import { useCallback, useRef, useState } from "react";
import styles from "./PerformanceChartCard.module.css";
import EquityPreview from "@/componets/UI/EquityPreview/EquityPreview";

type EquityPoint = { d: string; v: number };
type RangeKey = "5D" | "1M" | "3M" | "ALL";

export default function PerformanceChartCard() {
  const [range, setRange] = useState<RangeKey>("3M");
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

    setUpdatedOn(last?.d ?? "—");
  }, []);

  const ranges: RangeKey[] = ["5D", "1M", "3M", "ALL"];

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
    </section>
  );
}