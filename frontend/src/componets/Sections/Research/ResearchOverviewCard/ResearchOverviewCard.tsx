"use client";

import React, { useMemo } from "react";
import styles from "./ResearchOverviewCard.module.css";
import type { ResearchRow, Tone } from "@/lib/research";
import { avg, fmtNum, isFiniteNum } from "@/lib/research";
import { MiniStat, Movers } from "../ResearchBits/ResearchBits";

type ViewRaw = "all" | "merged" | "fundamentals" | "factors";

type Counts = {
  shownAll: number;
  total: number;
  merged: number;
  fundamentals: number;
  factors: number;
};

const ZERO_COUNTS: Counts = {
  shownAll: 0,
  total: 0,
  merged: 0,
  fundamentals: 0,
  factors: 0,
};

export default function ResearchOverviewCard(props: {
  loading: boolean;
  viewRaw: ViewRaw;
  onlyRated: boolean;
  linkWith: (params: Record<string, string | null>) => string;

  // ✅ new-style
  counts?: Counts;
  avgQuantLabel?: string;
  avgWSLabel?: string;

  // ✅ old-style (fallback)
  shownAll?: ResearchRow[];
  total?: number;
  mergedCount?: number;
  fundamentalsCount?: number;
  factorsCount?: number;

  bestMove: ResearchRow | null;
  worstMove: ResearchRow | null;
}) {
  const derivedCounts: Counts = useMemo(() => {
    if (props.counts) return props.counts;

    const arr = props.shownAll ?? [];
    return {
      shownAll: arr.length,
      total: props.total ?? 0,
      merged: props.mergedCount ?? 0,
      fundamentals: props.fundamentalsCount ?? 0,
      factors: props.factorsCount ?? 0,
    };
  }, [
    props.counts,
    props.shownAll,
    props.total,
    props.mergedCount,
    props.fundamentalsCount,
    props.factorsCount,
  ]);

  const derivedAvgQuantLabel = useMemo(() => {
    if (props.avgQuantLabel) return props.avgQuantLabel;
    const arr = props.shownAll ?? [];
    const nums = arr.map((r) => r.quant_rating).filter((x): x is number => isFiniteNum(x));
    const a = avg(nums);
    return a !== null ? fmtNum(a, 2) : "—";
  }, [props.avgQuantLabel, props.shownAll]);

  const derivedAvgWSLabel = useMemo(() => {
    if (props.avgWSLabel) return props.avgWSLabel;
    const arr = props.shownAll ?? [];
    const nums = arr
      .map((r) => r.wall_street_ratings)
      .filter((x): x is number => isFiniteNum(x));
    const a = avg(nums);
    return a !== null ? fmtNum(a, 2) : "—";
  }, [props.avgWSLabel, props.shownAll]);

  const c = derivedCounts ?? ZERO_COUNTS;

  return (
    <div className={styles.kpiCard}>
      <div className={styles.cardTitle}>Overview</div>

      <div className={styles.kpiInner}>
        <div className={styles.statsGrid4}>
          <MiniStat k="Shown" v={props.loading ? "…" : fmtNum(c.shownAll, 0)} />
          <MiniStat k="Avg Quant" v={props.loading ? "…" : derivedAvgQuantLabel} />
          <MiniStat k="Avg WS" v={props.loading ? "…" : derivedAvgWSLabel} />
          <MiniStat k="Total" v={props.loading ? "…" : fmtNum(c.total, 0)} />
        </div>

        <div className={styles.statsGrid3}>
          <MiniStat k="Merged" v={props.loading ? "…" : fmtNum(c.merged, 0)} />
          <MiniStat k="Fundamentals" v={props.loading ? "…" : fmtNum(c.fundamentals, 0)} />
          <MiniStat k="Factors" v={props.loading ? "…" : fmtNum(c.factors, 0)} />
        </div>

        <div className={styles.controlsBar}>
          <div className={styles.controlsLabel}>View</div>

          <div className={styles.seg} role="tablist" aria-label="Research view mode">
            <a
              className={styles.segBtn}
              href={props.linkWith({ view: "all", limit: "60" })}
              data-active={props.viewRaw === "all" ? "true" : "false"}
              role="tab"
            >
              All
            </a>
            <a
              className={styles.segBtn}
              href={props.linkWith({ view: "merged", limit: "60" })}
              data-active={props.viewRaw === "merged" ? "true" : "false"}
              role="tab"
            >
              Merged
            </a>
            <a
              className={styles.segBtn}
              href={props.linkWith({ view: "fundamentals", limit: "60" })}
              data-active={props.viewRaw === "fundamentals" ? "true" : "false"}
              role="tab"
            >
              Fundamentals
            </a>
            <a
              className={styles.segBtn}
              href={props.linkWith({ view: "factors", limit: "60" })}
              data-active={props.viewRaw === "factors" ? "true" : "false"}
              role="tab"
            >
              Factors
            </a>
          </div>

          <div className={styles.controlsSpacer} />

          <a
            className={styles.filterBtn}
            href={props.linkWith({ rated: props.onlyRated ? null : "1", limit: "60" })}
            data-active={props.onlyRated ? "true" : "false"}
          >
            {props.onlyRated ? "Rated only ✓" : "Rated only"}
          </a>
        </div>

        <Movers loading={props.loading} bestMove={props.bestMove} worstMove={props.worstMove} />
      </div>
    </div>
  );
}