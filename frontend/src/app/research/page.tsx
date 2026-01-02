"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import Header from "../../componets/Header_bar/Header_bar";
import FeatureCard from "../../componets/FeatureCard/FeatureCard";
import Footer from "../../componets/Footer/Footer";

import { BRAND_NAME, LINKS } from "../../lib/site";

import {
  type ResearchRow,
  getResearchRows,
  sortResearchRows,
  isFiniteNum,
  hasAnyFactorGrades,
  avg,
  topN,
  fmtMaybe,
  fmtMoney,
  fmtNum,
  fmtPct,
  fmtPe,
  fmtShortMoneyFromStringish,
  cleanText,
  gradeChip,
  safeId,
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


export default function ResearchPage() {
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

  const fundamentalsRows = useMemo(
    () => sorted.filter((r) => r.report_type === "fundamentals"),
    [sorted]
  );
  const factorsRows = useMemo(
    () => sorted.filter((r) => r.report_type === "factors"),
    [sorted]
  );
  const mergedRows = useMemo(
    () => sorted.filter((r) => r.report_type === "merged"),
    [sorted]
  );

  const total = sorted.length;

  const avgQuant = useMemo(() => avg(shownAll.map((r) => r.quant_rating)), [shownAll]);
  const avgWS = useMemo(
    () => avg(shownAll.map((r) => r.wall_street_ratings)),
    [shownAll]
  );


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
  const topWSRow = byWS[0] ?? null;
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
      <Header
        brand={BRAND_NAME}
        links={LINKS}
        ctaLabel="View Live"
        ctaHref="/portfolio"
      />

      <main className={styles.main}>
        <section className={styles.top}>
          <div>
            <h1 className={styles.h1}>Research</h1>
            <div className={styles.sub}>
              View-only research feed.
              <span className={styles.asof}>
                {" "}
                As-of: {loading ? "Loading…" : asOf ?? "—"}
              </span>
            </div>

            {errorMsg ? (
              <div className={styles.errorBox}>
                <div className={styles.errorTitle}>Backend fetch failed</div>
                <div className={styles.errorMsg}>{errorMsg}</div>
                <div className={styles.errorHint}>
                  Check <code>NEXT_PUBLIC_API_BASE</code> and confirm your FastAPI
                  server is running.
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

        {/* Overview */}
        <section className={styles.grid2}>
          <div className={styles.kpiCard}>
            <div className={styles.cardTitle}>Overview</div>

            <div className={styles.kpiInner}>
              <div className={styles.statsGrid4}>
                <MiniStat k="Shown" v={loading ? "…" : fmtNum(shownAll.length, 0)} />
                <MiniStat
                  k="Avg Quant"
                  v={loading ? "…" : avgQuant !== null ? fmtNum(avgQuant, 2) : "—"}
                />
                <MiniStat
                  k="Avg WS"
                  v={loading ? "…" : avgWS !== null ? fmtNum(avgWS, 2) : "—"}
                />
                <MiniStat k="Total" v={loading ? "…" : fmtNum(total, 0)} />
              </div>

              <div className={styles.statsGrid3}>
                <MiniStat k="Merged" v={loading ? "…" : fmtNum(mergedRows.length, 0)} />
                <MiniStat
                  k="Fundamentals"
                  v={loading ? "…" : fmtNum(fundamentalsRows.length, 0)}
                />
                <MiniStat k="Factors" v={loading ? "…" : fmtNum(factorsRows.length, 0)} />
              </div>

              <div className={styles.controlsBar}>
                <div className={styles.controlsLabel}>View</div>

                <div className={styles.seg} role="tablist" aria-label="Research view mode">
                  <a
                    className={styles.segBtn}
                    href={linkWith({ view: "all", limit: "60" })}
                    data-active={viewRaw === "all" ? "true" : "false"}
                    role="tab"
                  >
                    All
                  </a>
                  <a
                    className={styles.segBtn}
                    href={linkWith({ view: "merged", limit: "60" })}
                    data-active={viewRaw === "merged" ? "true" : "false"}
                    role="tab"
                  >
                    Merged
                  </a>
                  <a
                    className={styles.segBtn}
                    href={linkWith({ view: "fundamentals", limit: "60" })}
                    data-active={viewRaw === "fundamentals" ? "true" : "false"}
                    role="tab"
                  >
                    Fundamentals
                  </a>
                  <a
                    className={styles.segBtn}
                    href={linkWith({ view: "factors", limit: "60" })}
                    data-active={viewRaw === "factors" ? "true" : "false"}
                    role="tab"
                  >
                    Factors
                  </a>
                </div>

                <div className={styles.controlsSpacer} />

                <a
                  className={styles.filterBtn}
                  href={linkWith({
                    rated: onlyRated ? null : "1",
                    limit: String(limit),
                  })}
                  data-active={onlyRated ? "true" : "false"}
                >
                  {onlyRated ? "Rated only ✓" : "Rated only"}
                </a>
              </div>

              <div className={styles.moversGrid}>
                <div className={styles.moverCard}>
                  <div className={styles.moverK}>Best mover</div>
                  <div className={styles.moverV}>
                    {loading
                      ? "…"
                      : bestMove
                      ? `${bestMove.symbol} ${fmtPct(bestMove.change_pct)}`
                      : "—"}
                  </div>
                  <div className={styles.moverSub}>
                    {loading ? "" : bestMove ? fmtMaybe(bestMove.company_name) : ""}
                  </div>
                </div>

                <div className={styles.moverCard}>
                  <div className={styles.moverK}>Worst mover</div>
                  <div className={styles.moverV}>
                    {loading
                      ? "…"
                      : worstMove
                      ? `${worstMove.symbol} ${fmtPct(worstMove.change_pct)}`
                      : "—"}
                  </div>
                  <div className={styles.moverSub}>
                    {loading ? "" : worstMove ? fmtMaybe(worstMove.company_name) : ""}
                  </div>
                </div>
              </div>
            </div>
          </div>


          <div className={styles.rightCard}>
            <div className={styles.cardTitle}>Stock rating (Top 5)</div>

            <div className={styles.rightBody}>
              <div className={styles.noteBody}>
                <div className={styles.noteList}>
                  <div className={styles.noteItem}>
                    <span className={styles.bullet} />
                    <span>
                      <b>Highest Quant:</b>{" "}
                      {loading
                        ? "Loading…"
                        : topQuant
                        ? `${topQuant.symbol} (${fmtNum(topQuant.quant_rating, 2)})`
                        : "—"}
                    </span>
                  </div>
                  <div className={styles.noteItem}>
                    <span className={styles.bullet} />
                    <span>
                      <b>Highest WS:</b>{" "}
                      {loading
                        ? "Loading…"
                        : topWSRow
                        ? `${topWSRow.symbol} (${fmtNum(topWSRow.wall_street_ratings, 2)})`
                        : "—"}
                    </span>
                  </div>
                  <div className={styles.noteItem}>
                    <span className={styles.bullet} />
                    <span>
                      <b>Largest Cap:</b>{" "}
                      {loading
                        ? "Loading…"
                        : biggestCap
                        ? `${biggestCap.symbol} (${fmtShortMoneyFromStringish(
                            biggestCap.market_cap
                          )})`
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.boardGrid}>
                {loading ? (
                  <div className={styles.emptyBox}>
                    <div className={styles.emptyTitle}>Loading…</div>
                    <div className={styles.emptySub}>Fetching ratings.</div>
                  </div>
                ) : ratingTop.length === 0 ? (
                  <div className={styles.emptyBox}>
                    <div className={styles.emptyTitle}>No rating data</div>
                    <div className={styles.emptySub}>
                      Try “All” or turn off “Rated only”.
                    </div>
                  </div>
                ) : (
                  ratingTop.map((r, i) => {
                    const q = isFiniteNum(r.quant_rating) ? fmtNum(r.quant_rating, 2) : "—";
                    const ws = isFiniteNum(r.wall_street_ratings)
                      ? fmtNum(r.wall_street_ratings, 2)
                      : "—";
                    const href = r.symbol ? `#row-${safeId(r.symbol)}` : "#all-rows";

                    return (
                      <a key={`${r.symbol}-${i}`} className={styles.boardItem} href={href}>
                        <div className={styles.boardTop}>
                          <div className={styles.boardTitle}>#{i + 1}</div>
                          <div className={styles.boardPill}>{`Q ${q}`}</div>
                        </div>

                        <div className={styles.boardMain}>
                          <div className={styles.boardSym}>{r.symbol}</div>
                          <div className={styles.boardMeta}>{fmtMaybe(r.company_name)}</div>
                        </div>

                        <div className={styles.boardSub}>
                          WS {ws} • {fmtShortMoneyFromStringish(r.market_cap)}
                        </div>
                      </a>
                    );
                  })
                )}
              </div>

              <div className={styles.rightActions}>
                <a className={styles.ghostBtn} href="#top-picks">
                  Jump to top picks →
                </a>
                <a className={styles.primaryBtn} href="#all-rows">
                  Jump to table →
                </a>
              </div>
            </div>
          </div>
        </section>


        <section id="top-picks" className={styles.tableCard}>
          <div className={styles.tableTop}>
            <div>
              <div className={styles.tableTitle}>Top picks</div>
              <div className={styles.tableSub}>
                First {loading ? "…" : fmtNum(topPicks.length, 0)} rows (ranked).
              </div>
            </div>
            <span className={styles.badge}>Highlights</span>
          </div>

          {loading ? (
            <div className={styles.emptyBox}>
              <div className={styles.emptyTitle}>Loading…</div>
              <div className={styles.emptySub}>Fetching top picks.</div>
            </div>
          ) : topPicks.length === 0 ? (
            <div className={styles.emptyBox}>
              <div className={styles.emptyTitle}>No research data</div>
              <div className={styles.emptySub}>Nothing to show yet.</div>
            </div>
          ) : (
            <div className={styles.pickGrid}>
              {topPicks.map((r, idx) => (
                <div key={`${r.symbol}-${idx}`} className={styles.pickCard}>
                  <div className={styles.pickTop}>
                    <div className={styles.pickLeft}>
                      <div className={styles.pickTitle}>
                        #{fmtNum(r.rank ?? idx + 1, 0)}{" "}
                        <span className={styles.pickSym}>
                          {typeof r.symbol === "string" ? r.symbol : "—"}
                        </span>
                      </div>
                      <div className={styles.pickCompany}>{fmtMaybe(r.company_name)}</div>

                      <div className={styles.chipRow}>
                        <Chip
                          label={`Type ${fmtMaybe(r.report_type)}`}
                          tone={r.report_type === "merged" ? "good" : "muted"}
                        />
                        <Chip
                          label={`Quant ${
                            r.quant_rating !== null ? fmtNum(r.quant_rating, 2) : "—"
                          }`}
                          tone={
                            r.quant_rating !== null && r.quant_rating >= 4.5
                              ? "good"
                              : r.quant_rating !== null
                              ? "mid"
                              : "muted"
                          }
                        />
                        <Chip
                          label={`Chg ${fmtPct(r.change_pct)}`}
                          tone={
                            r.change_pct !== null && r.change_pct > 0
                              ? "good"
                              : r.change_pct !== null
                              ? "bad"
                              : "muted"
                          }
                        />
                      </div>
                    </div>

                    <div className={styles.pickRight}>
                      <div className={styles.pickK}>Price</div>
                      <div className={styles.pickPrice}>{fmtMoney(r.price)}</div>
                      <div className={styles.pickK}>Sector</div>
                      <div className={styles.pickSector}>{fmtMaybe(r.sector_industry)}</div>
                    </div>
                  </div>

                  <div className={styles.chipRow}>
                    <Chip
                      label={`Cap ${fmtShortMoneyFromStringish(r.market_cap)}`}
                      tone={cleanText(r.market_cap) ? "mid" : "muted"}
                    />
                    <Chip
                      label={`P/E ${fmtPe(r.pe_ttm)}`}
                      tone={cleanText(r.pe_ttm) ? "mid" : "muted"}
                    />
                    <Chip
                      label={`1M ${cleanText(r.perf_1m) ?? "—"}`}
                      tone={cleanText(r.perf_1m) ? "mid" : "muted"}
                    />
                    <Chip
                      label={`6M ${cleanText(r.perf_6m) ?? "—"}`}
                      tone={cleanText(r.perf_6m) ? "mid" : "muted"}
                    />
                    <Chip
                      label={`SA ${
                        r.sa_analyst_ratings !== null
                          ? fmtNum(r.sa_analyst_ratings, 2)
                          : "—"
                      }`}
                      tone={r.sa_analyst_ratings !== null ? "mid" : "muted"}
                    />
                  </div>

                  {hasAnyFactorGrades(r) ? <FactorRow r={r} /> : null}
                </div>
              ))}
            </div>
          )}
        </section>


        <section id="all-rows" className={styles.tableCard}>
          <div className={styles.tableTop}>
            <div>
              <div className={styles.tableTitle}>All rows</div>
              <div className={styles.tableSub}>
                {loading
                  ? "Loading rows…"
                  : `Showing ${fmtNum(shown.length, 0)} of ${fmtNum(shownAll.length, 0)} rows.`}
              </div>
            </div>
            <span className={styles.badge}>Table</span>
          </div>

          {loading ? (
            <div className={styles.emptyBox}>
              <div className={styles.emptyTitle}>Loading…</div>
              <div className={styles.emptySub}>Fetching rows.</div>
            </div>
          ) : shown.length === 0 ? (
            <div className={styles.emptyBox}>
              <div className={styles.emptyTitle}>Nothing to show</div>
              <div className={styles.emptySub}>
                Try “All” or turn off “Rated only”.
              </div>
              <div className={styles.emptyActions}>
                <a className={styles.primaryBtn} href={linkWith({ view: "all", limit: "60" })}>
                  View all →
                </a>
                <a className={styles.ghostBtn} href={linkWith({ rated: null, limit: "60" })}>
                  Turn off rated only →
                </a>
              </div>
            </div>
          ) : (
            <>

              <div className={styles.desktopOnly}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Symbol</th>
                        <th>Company</th>
                        <th className={styles.num}>Price</th>
                        <th className={styles.num}>Chg</th>
                        <th className={styles.num}>Quant</th>
                        <th>Sector</th>
                        <th className={styles.num}>Cap</th>
                        <th className={styles.num}>P/E</th>
                        <th className={styles.num}>WS</th>
                        <th>Grades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r, idx) => {
                        const val = gradeChip(cleanText(r.valuation_grade));
                        const gro = gradeChip(cleanText(r.growth_grade));
                        const pro = gradeChip(cleanText(r.profitability_grade));
                        const mom = gradeChip(cleanText(r.momentum_grade));
                        const eps = gradeChip(cleanText(r.eps_rev_grade));
                        const sym = typeof r.symbol === "string" ? r.symbol : "";

                        return (
                          <tr key={`${sym || "row"}-${idx}`} id={`row-${safeId(sym)}`}>
                            <td className={styles.mono}>{fmtNum(r.rank ?? idx + 1, 0)}</td>
                            <td className={styles.sym}>{sym || "—"}</td>
                            <td className={styles.name}>{fmtMaybe(r.company_name)}</td>
                            <td className={styles.num}>{fmtMoney(r.price)}</td>
                            <td className={styles.num}>{fmtPct(r.change_pct)}</td>
                            <td className={styles.num}>{fmtNum(r.quant_rating)}</td>
                            <td className={styles.sector}>{fmtMaybe(r.sector_industry)}</td>
                            <td className={styles.num}>{fmtShortMoneyFromStringish(r.market_cap)}</td>
                            <td className={styles.num}>{fmtPe(r.pe_ttm)}</td>
                            <td className={styles.num}>
                              {r.wall_street_ratings !== null
                                ? fmtNum(r.wall_street_ratings, 2)
                                : "—"}
                            </td>
                            <td>
                              <span className={styles.gradeWrap}>
                                <Chip label={`V ${val.label}`} tone={val.tone} />
                                <Chip label={`G ${gro.label}`} tone={gro.tone} />
                                <Chip label={`P ${pro.label}`} tone={pro.tone} />
                                <Chip label={`M ${mom.label}`} tone={mom.tone} />
                                <Chip label={`E ${eps.label}`} tone={eps.tone} />
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>


              <div className={styles.mobileOnly}>
                <div className={styles.cards}>
                  {shown.map((r, idx) => {
                    const sym = typeof r.symbol === "string" ? r.symbol : "";
                    return (
                      <div
                        key={`${sym || "row"}-${idx}`}
                        className={styles.rowCard}
                        id={`row-${safeId(sym)}`}
                      >
                        <div className={styles.rowTop}>
                          <div className={styles.rowLeft}>
                            <div className={styles.rowSym}>{sym || "—"}</div>
                            <div className={styles.rowName}>{fmtMaybe(r.company_name)}</div>
                          </div>
                          <div className={styles.rankPill}>#{fmtNum(r.rank ?? idx + 1, 0)}</div>
                        </div>

                        <div className={styles.rowGrid}>
                          <div className={styles.cell}>
                            <div className={styles.k}>Price</div>
                            <div className={styles.v}>{fmtMoney(r.price)}</div>
                          </div>
                          <div className={styles.cell}>
                            <div className={styles.k}>Change</div>
                            <div className={styles.v}>{fmtPct(r.change_pct)}</div>
                          </div>
                          <div className={styles.cell}>
                            <div className={styles.k}>Quant</div>
                            <div className={styles.v}>{fmtNum(r.quant_rating)}</div>
                          </div>

                          <div className={styles.cellWide}>
                            <div className={styles.k}>Sector</div>
                            <div className={styles.v}>{fmtMaybe(r.sector_industry)}</div>
                          </div>

                          <div className={styles.cell}>
                            <div className={styles.k}>Cap</div>
                            <div className={styles.v}>
                              {fmtShortMoneyFromStringish(r.market_cap)}
                            </div>
                          </div>
                          <div className={styles.cell}>
                            <div className={styles.k}>P/E</div>
                            <div className={styles.v}>{fmtPe(r.pe_ttm)}</div>
                          </div>

                          {hasAnyFactorGrades(r) ? (
                            <div className={styles.cellWide}>
                              <div className={styles.k}>Factor grades</div>
                              <div className={styles.v}>
                                <FactorRow r={r} />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>


              <div className={styles.emptyActions} style={{ justifyContent: "flex-end" as any }}>
                {canLoadMore ? (
                  <a className={styles.primaryBtn} href={linkWith({ limit: String(nextLimit) })}>
                    Load 60 more →
                  </a>
                ) : (
                  <span className={styles.badge}>All loaded</span>
                )}
              </div>
            </>
          )}
        </section>

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