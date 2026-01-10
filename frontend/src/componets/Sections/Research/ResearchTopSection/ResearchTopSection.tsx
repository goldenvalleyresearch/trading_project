"use client";

import styles from "./ResearchTopSection.module.css";

import ResearchHero from "@/componets/Sections/Research/ResearchHero/ResearchHero";
import ResearchOverviewCard from "@/componets/Sections/Research/ResearchOverviewCard/ResearchOverviewCard";
import ResearchRatingsCard from "@/componets/Sections/Research/ResearchRatingsCard/ResearchRatingsCard";
import { type ResearchRow, fmtNum, avg, isFiniteNum } from "@/lib/research";

export default function ResearchTopSection(props: {
  asOf: string;
  loading: boolean;
  errorMsg: string | null;

  viewRaw: "all" | "merged" | "fundamentals" | "factors";
  onlyRated: boolean;
  limit: number;

  total: number;
  fundamentalsCount: number;
  factorsCount: number;
  mergedCount: number;

  shownAll: ResearchRow[];
  ratingTop: ResearchRow[];
  bestMove: ResearchRow | null;
  worstMove: ResearchRow | null;

  topQuant: ResearchRow | null;
  topWS: ResearchRow | null;
  biggestCap: ResearchRow | null;

  linkWith: (params: Record<string, string | null>) => string;
}) {
  // ✅ ensure avg() only sees real numbers (not null, undefined, strings)
  const quantNums = props.shownAll
    .map((r) => r.quant_rating)
    .filter((x): x is number => isFiniteNum(x));

  const wsNums = props.shownAll
    .map((r) => r.wall_street_ratings)
    .filter((x): x is number => isFiniteNum(x));

  const avgQuant = avg(quantNums);
  const avgWS = avg(wsNums);

  const avgQuantLabel = avgQuant !== null ? fmtNum(avgQuant, 2) : "—";
  const avgWSLabel = avgWS !== null ? fmtNum(avgWS, 2) : "—";

  const counts = {
    shownAll: props.shownAll.length,
    total: props.total,
    merged: props.mergedCount,
    fundamentals: props.fundamentalsCount,
    factors: props.factorsCount,
  };

  return (
    <section className={styles.wrap}>
      <ResearchHero asOf={props.asOf} loading={props.loading} errorMsg={props.errorMsg} />

      <div className={styles.grid}>
        <ResearchOverviewCard
          loading={props.loading}
          viewRaw={props.viewRaw}
          onlyRated={props.onlyRated}
          linkWith={props.linkWith}
          counts={counts}
          avgQuantLabel={avgQuantLabel}
          avgWSLabel={avgWSLabel}
          bestMove={props.bestMove}
          worstMove={props.worstMove}
        />

        <ResearchRatingsCard
          loading={props.loading}
          ratingTop={props.ratingTop}
          topQuant={props.topQuant}
          topWSRow={props.topWS}
          biggestCap={props.biggestCap}
        />
      </div>
    </section>
  );
}