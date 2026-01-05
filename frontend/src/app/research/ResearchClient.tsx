"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";

import Header from "../../componets/Header_bar/Header_bar";
import Footer from "../../componets/Footer/Footer";
import FeatureCard from "../../componets/FeatureCard/FeatureCard";

import { BRAND_NAME, LINKS } from "../../lib/site";
import {
  type ResearchRow,
  getResearchRows,
  sortResearchRows,
  isFiniteNum,
  hasAnyFactorGrades,
  avg,
  topN,
  fmtNum,
  cleanText,
  gradeChip,
  type Tone,
} from "../../lib/research";

function MiniStat({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.miniStat}>
      <div className={styles.miniK}>{k}</div>
      <div className={styles.miniV}>{v}</div>
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: Tone }) {
  const cls =
    tone === "good"
      ? styles.chipGood
      : tone === "mid"
      ? styles.chipMid
      : tone === "bad"
      ? styles.chipBad
      : styles.chipMuted;

  return <span className={`${styles.chip} ${cls}`}>{label}</span>;
}

function FactorRow({ r }: { r: ResearchRow }) {
  const items: Array<{ k: string; v: string | null }> = [
    { k: "Val", v: cleanText(r.valuation_grade) },
    { k: "Growth", v: cleanText(r.growth_grade) },
    { k: "Prof", v: cleanText(r.profitability_grade) },
    { k: "Mom", v: cleanText(r.momentum_grade) },
    { k: "EPS", v: cleanText(r.eps_rev_grade) },
  ];

  return (
    <div className={styles.factorRow}>
      <Chip
        label={`WS ${
          r.wall_street_ratings !== null ? fmtNum(r.wall_street_ratings, 2) : "—"
        }`}
        tone={r.wall_street_ratings !== null ? "mid" : "muted"}
      />
      {items.map((it) => {
        const g = gradeChip(it.v);
        return <Chip key={it.k} label={`${it.k} ${g.label}`} tone={g.tone} />;
      })}
    </div>
  );
}

export default function ResearchClient() {
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
    if (viewRaw === "fundamentals") return sorted.filter((r) => r.report_type === "fundamentals");
    if (viewRaw === "factors") return sorted.filter((r) => r.report_type === "factors");
    return sorted;
  }, [sorted, viewRaw]);

  const shownAll = useMemo(() => {
    return onlyRated ? filteredByType.filter(hasAnyFactorGrades) : filteredByType;
  }, [filteredByType, onlyRated]);

  const shown = useMemo(() => shownAll.slice(0, limit), [shownAll, limit]);

  // (these are currently unused in the UI, but harmless to keep)
  const total = sorted.length;
  const avgQuant = useMemo(() => avg(shownAll.map((r) => r.quant_rating)), [shownAll]);
  const avgWS = useMemo(() => avg(shownAll.map((r) => r.wall_street_ratings)), [shownAll]);
  const topPicks = useMemo(() => topN(shownAll, 10), [shownAll]);

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
      {/* ✅ FIX: removed ctaLabel/ctaHref because Header type doesn't support it yet */}
      <Header brand={BRAND_NAME} links={[...LINKS]} />

      <main className={styles.main}>
        <section className={styles.top}>
          <div>
            <h1 className={styles.h1}>Research</h1>
            <div className={styles.sub}>
              View-only research feed.
              <span className={styles.asof}> As-of: {asOf}</span>
            </div>

            {loading ? <div className={styles.sub}>Loading data…</div> : null}

            {errorMsg ? (
              <div className={styles.errorBox}>
                <div className={styles.errorTitle}>Backend fetch failed</div>
                <div className={styles.errorMsg}>{errorMsg}</div>
                <div className={styles.errorHint}>
                  Check <code>NEXT_PUBLIC_API_BASE_URL</code> and confirm FastAPI is running.
                </div>
              </div>
            ) : null}
          </div>

          <div className={styles.topRight}>
            <a className={styles.ghostBtn} href="/portfolio">
              Back to portfolio →
            </a>
          </div>
        </section>

        {!loading && !errorMsg && sorted.length === 0 ? (
          <div className={styles.emptyBox}>
            <div className={styles.emptyTitle}>No research rows</div>
            <div className={styles.emptySub}>
              Backend returned 0 rows. Upload/import research data or check the API endpoint.
            </div>
          </div>
        ) : null}

        <section className={styles.grid3}>
          <FeatureCard title="Portfolio" body="Compare research vs holdings." href="/portfolio" linkLabel="Open" />
          <FeatureCard title="Performance" body="Equity curve and benchmarks." href="/performance" linkLabel="Open" />
          <FeatureCard title="Transparency" body="Receipts-style timeline." href="/transparency" linkLabel="Open" />
        </section>
      </main>

      <Footer />
    </div>
  );
}