"use client";

import React from "react";
import styles from "./ResearchTableSection.module.css";

import {
  type ResearchRow,
  isFiniteNum,
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
} from "@/lib/research";

/** ✅ Pull a real letter grade from messy strings */
function normalizeGrade(v: unknown): string | null {
  const s = cleanText(v as any);
  if (!s) return null;

  // Handles: "A", "A+", "B-", "A (Strong Buy)", "grade: b+"
  const m = s.toUpperCase().match(/\b([ABCDF])([+-])?\b/);
  return m ? `${m[1]}${m[2] ?? ""}` : null;
}

/** ✅ Do NOT rely on hasAnyFactorGrades() — we check ourselves */
function rowHasGrades(r: ResearchRow): boolean {
  return (
    normalizeGrade(r.valuation_grade) !== null ||
    normalizeGrade(r.growth_grade) !== null ||
    normalizeGrade(r.profitability_grade) !== null ||
    normalizeGrade(r.momentum_grade) !== null ||
    normalizeGrade(r.eps_rev_grade) !== null
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
    { k: "Val", v: normalizeGrade(r.valuation_grade) },
    { k: "Growth", v: normalizeGrade(r.growth_grade) },
    { k: "Prof", v: normalizeGrade(r.profitability_grade) },
    { k: "Mom", v: normalizeGrade(r.momentum_grade) },
    { k: "EPS", v: normalizeGrade(r.eps_rev_grade) },
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

function CardShell(props: {
  id: string;
  title: string;
  badge: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section id={props.id} className={styles.tableCard}>
      <div className={styles.tableTop}>
        <div>
          <div className={styles.tableTitle}>{props.title}</div>
          <div className={styles.tableSub}>{props.sub}</div>
        </div>
        <span className={styles.badge}>{props.badge}</span>
      </div>
      {props.children}
    </section>
  );
}

export default function ResearchTableSection(props: {
  loading: boolean;

  topPicks: ResearchRow[];
  shown: ResearchRow[];
  shownAllCount: number;

  canLoadMore: boolean;
  nextLimit: number;
  linkWith: (params: Record<string, string | null>) => string;
}) {
  const { loading, topPicks, shown, shownAllCount } = props;

  return (
    <div className={styles.wrap}>
      <CardShell
        id="top-picks"
        title="Top picks"
        badge="Highlights"
        sub={`First ${loading ? "…" : fmtNum(topPicks.length, 0)} rows (ranked).`}
      >
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
                      r.sa_analyst_ratings !== null ? fmtNum(r.sa_analyst_ratings, 2) : "—"
                    }`}
                    tone={r.sa_analyst_ratings !== null ? "mid" : "muted"}
                  />
                </div>

                {rowHasGrades(r) ? <FactorRow r={r} /> : null}
              </div>
            ))}
          </div>
        )}
      </CardShell>

      <CardShell
        id="all-rows"
        title="All rows"
        badge="Table"
        sub={
          loading
            ? "Loading rows…"
            : `Showing ${fmtNum(shown.length, 0)} of ${fmtNum(shownAllCount, 0)} rows.`
        }
      >
        {loading ? (
          <div className={styles.emptyBox}>
            <div className={styles.emptyTitle}>Loading…</div>
            <div className={styles.emptySub}>Fetching rows.</div>
          </div>
        ) : shown.length === 0 ? (
          <div className={styles.emptyBox}>
            <div className={styles.emptyTitle}>Nothing to show</div>
            <div className={styles.emptySub}>Try “All” or turn off “Rated only”.</div>
            <div className={styles.emptyActions}>
              <a className={styles.primaryBtn} href={props.linkWith({ view: "all", limit: "60" })}>
                View all →
              </a>
              <a className={styles.ghostBtn} href={props.linkWith({ rated: null, limit: "60" })}>
                Turn off rated only →
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* ---------------- desktop table ---------------- */}
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
                      const val = gradeChip(normalizeGrade(r.valuation_grade));
                      const gro = gradeChip(normalizeGrade(r.growth_grade));
                      const pro = gradeChip(normalizeGrade(r.profitability_grade));
                      const mom = gradeChip(normalizeGrade(r.momentum_grade));
                      const eps = gradeChip(normalizeGrade(r.eps_rev_grade));
                      const sym = typeof r.symbol === "string" ? r.symbol : "";

                      return (
                        <tr key={`${sym || "row"}-${idx}`} id={`row-${safeId(sym)}`}>
                          <td className={styles.mono}>{fmtNum(r.rank ?? idx + 1, 0)}</td>
                          <td className={styles.sym}>{sym || "—"}</td>
                          <td className={styles.name}>{fmtMaybe(r.company_name)}</td>
                          <td className={styles.num}>{fmtMoney(r.price)}</td>
                          <td className={styles.num}>{fmtPct(r.change_pct)}</td>
                          <td className={styles.num}>
                            {isFiniteNum(r.quant_rating) ? fmtNum(r.quant_rating, 2) : "—"}
                          </td>
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

            {/* ---------------- mobile cards ---------------- */}
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
                          <div className={styles.v}>
                            {isFiniteNum(r.quant_rating) ? fmtNum(r.quant_rating, 2) : "—"}
                          </div>
                        </div>

                        <div className={styles.cellWide}>
                          <div className={styles.k}>Sector</div>
                          <div className={styles.v}>{fmtMaybe(r.sector_industry)}</div>
                        </div>

                        <div className={styles.cell}>
                          <div className={styles.k}>Cap</div>
                          <div className={styles.v}>{fmtShortMoneyFromStringish(r.market_cap)}</div>
                        </div>
                        <div className={styles.cell}>
                          <div className={styles.k}>P/E</div>
                          <div className={styles.v}>{fmtPe(r.pe_ttm)}</div>
                        </div>

                        {rowHasGrades(r) ? (
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

            <div className={styles.loadRow}>
              {props.canLoadMore ? (
                <a
                  className={styles.primaryBtn}
                  href={props.linkWith({ limit: String(props.nextLimit) })}
                >
                  Load 60 more →
                </a>
              ) : (
                <span className={styles.badge}>All loaded</span>
              )}
            </div>
          </>
        )}
      </CardShell>
    </div>
  );
}