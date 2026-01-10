"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";

import Header from "@/componets/UI/Header_bar/Header_bar";
import FeatureCard from "@/componets/UI/FeatureCard/FeatureCard";
import Footer from "@/componets/UI/Footer/Footer";

import ResearchTopSection from "@/componets/Sections/Research/ResearchTopSection/ResearchTopSection";
import ResearchTableSection from "@/componets/Sections/Research/ResearchTableSection/ResearchTableSection";

import { BRAND_NAME, LINKS } from "@/lib/site";

import {
  type ResearchRow,
  getResearchRows,
  sortResearchRows,
  isFiniteNum,
  hasAnyFactorGrades,
  avg,
  topN,
} from "@/lib/research";

export default function ResearchPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className={styles.main}>Loading…</div>
        </div>
      }
    >
      <ResearchInner />
    </Suspense>
  );
}

function ResearchInner() {
  const sp = useSearchParams();

  const viewRaw = useMemo(() => {
    const v = sp.get("view");
    return v === "merged" || v === "fundamentals" || v === "factors" ? v : "all";
  }, [sp]);

  const onlyRated = useMemo(() => sp.get("rated") === "1", [sp]);

  const limit = useMemo(() => {
    const n = Number(sp.get("limit") ?? 60);
    return Number.isFinite(n) ? Math.min(Math.max(n, 25), 500) : 60;
  }, [sp]);

  const [asOf, setAsOf] = useState("—");
  const [rows, setRows] = useState<ResearchRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setErrorMsg(null);

    getResearchRows({ limit: Math.min(500, limit + 60) })
      .then((out) => {
        if (cancelled) return;
        setAsOf(out.asOf ?? "—");
        setRows(out.rows ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setErrorMsg(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [limit]);

  const sorted = useMemo(() => sortResearchRows(rows), [rows]);

  const filteredByType = useMemo(() => {
    if (viewRaw === "merged") return sorted.filter((r) => r.report_type === "merged");
    if (viewRaw === "fundamentals")
      return sorted.filter((r) => r.report_type === "fundamentals");
    if (viewRaw === "factors") return sorted.filter((r) => r.report_type === "factors");
    return sorted;
  }, [sorted, viewRaw]);

  const shownAll = useMemo(() => {
    return onlyRated ? filteredByType.filter(hasAnyFactorGrades) : filteredByType;
  }, [filteredByType, onlyRated]);

  const shown = useMemo(() => shownAll.slice(0, limit), [shownAll, limit]);

  const fundamentalsCount = useMemo(
    () => sorted.filter((r) => r.report_type === "fundamentals").length,
    [sorted]
  );
  const factorsCount = useMemo(
    () => sorted.filter((r) => r.report_type === "factors").length,
    [sorted]
  );
  const mergedCount = useMemo(
    () => sorted.filter((r) => r.report_type === "merged").length,
    [sorted]
  );

  const total = sorted.length;

  const avgQuant = useMemo(() => avg(shownAll.map((r) => r.quant_rating)), [shownAll]);
  const avgWS = useMemo(() => avg(shownAll.map((r) => r.wall_street_ratings)), [shownAll]);

  const { bestMove, worstMove } = useMemo(() => {
    let best: ResearchRow | null = null;
    let worst: ResearchRow | null = null;
    for (const r of shownAll) {
      const chg = r.change_pct;
      if (!isFiniteNum(chg)) continue;
      if (!best || (best.change_pct ?? -999) < chg) best = r;
      if (!worst || (worst.change_pct ?? 999) > chg) worst = r;
    }
    return { bestMove: best, worstMove: worst };
  }, [shownAll]);

  const topPicks = useMemo(() => topN(shownAll, 10), [shownAll]);

  const ratingPool = useMemo(
    () => shownAll.filter((r) => typeof r?.symbol === "string" && r.symbol.length > 0),
    [shownAll]
  );

  const byQuant = useMemo(() => {
    return ratingPool
      .filter((r) => isFiniteNum(r.quant_rating))
      .slice()
      .sort((a, b) => {
        const dq = (b.quant_rating ?? -999) - (a.quant_rating ?? -999);
        if (dq !== 0) return dq;
        const dws = (b.wall_street_ratings ?? -999) - (a.wall_street_ratings ?? -999);
        if (dws !== 0) return dws;
        return (a.rank ?? 999999) - (b.rank ?? 999999);
      });
  }, [ratingPool]);

  const byWS = useMemo(() => {
    return ratingPool
      .filter((r) => isFiniteNum(r.wall_street_ratings))
      .slice()
      .sort((a, b) => {
        const dws = (b.wall_street_ratings ?? -999) - (a.wall_street_ratings ?? -999);
        if (dws !== 0) return dws;
        const dq = (b.quant_rating ?? -999) - (a.quant_rating ?? -999);
        if (dq !== 0) return dq;
        return (a.rank ?? 999999) - (b.rank ?? 999999);
      });
  }, [ratingPool]);

  const byCap = useMemo(() => {
    return ratingPool
      .map((r) => {
        const n = Number(String(r.market_cap ?? "").replace(/[$,%\s,]/g, ""));
        return { r, cap: Number.isFinite(n) ? n : null };
      })
      .filter((x) => x.cap !== null)
      .sort((a, b) => (b.cap ?? -1) - (a.cap ?? -1))
      .map((x) => x.r);
  }, [ratingPool]);

  const ratingTop = useMemo(() => {
    if (byQuant.length > 0) return topN(byQuant, 5);
    if (byWS.length > 0) return topN(byWS, 5);
    return topN(ratingPool, 5);
  }, [byQuant, byWS, ratingPool]);

  const topQuant = byQuant[0] ?? null;
  const topWS = byWS[0] ?? null;
  const biggestCap = byCap[0] ?? null;

  function linkWith(params: Record<string, string | null>) {
    const url = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v === null) url.delete(k);
      else url.set(k, v);
    }
    const qs = url.toString();
    return qs ? `/research?${qs}` : "/research";
  }

  const canLoadMore = shownAll.length > shown.length;
  const nextLimit = Math.min(500, shown.length + 60);

  return (
    <div className={styles.page}>
      <Header brand={BRAND_NAME} links={[...LINKS]} />

      <main className={styles.main}>
        <ResearchTopSection
          asOf={asOf}
          loading={loading}
          errorMsg={errorMsg}
          viewRaw={viewRaw}
          onlyRated={onlyRated}
          limit={limit}
          total={total}
          fundamentalsCount={fundamentalsCount}
          factorsCount={factorsCount}
          mergedCount={mergedCount}
          shownAll={shownAll}
          ratingTop={ratingTop}
          bestMove={bestMove}
          worstMove={worstMove}
          topQuant={topQuant}
          topWS={topWS}
          biggestCap={biggestCap}
          linkWith={linkWith}
        />

        <ResearchTableSection
          loading={loading}
          topPicks={topPicks}
          shown={shown}
          shownAllCount={shownAll.length}
          canLoadMore={canLoadMore}
          nextLimit={nextLimit}
          linkWith={linkWith}
        />

        <section className={styles.grid3}>
          <FeatureCard
            title="Portfolio"
            body="Compare research vs holdings."
            href="/portfolio"
            linkLabel="Open"
          />
          <FeatureCard
            title="Performance"
            body="Equity curve and benchmarks."
            href="/performance"
            linkLabel="Open"
          />
          <FeatureCard
            title="Transparency"
            body="Receipts-style timeline."
            href="/transparency"
            linkLabel="Open"
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}