"use client";

import React from "react";
import styles from "./ResearchBits.module.css";
import { fmtNum, cleanText, gradeChip, safeId, fmtPct, fmtMaybe, type Tone } from "@/lib/research";
import type { ResearchRow } from "@/lib/research";

export function MiniStat({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.miniStat}>
      <div className={styles.miniK}>{k}</div>
      <div className={styles.miniV}>{v}</div>
    </div>
  );
}

export function Chip({ label, tone }: { label: string; tone: Tone }) {
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

export function FactorRow({ r }: { r: ResearchRow }) {
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

export function Movers({
  loading,
  bestMove,
  worstMove,
}: {
  loading: boolean;
  bestMove: ResearchRow | null;
  worstMove: ResearchRow | null;
}) {
  return (
    <div className={styles.moversGrid}>
      <div className={styles.moverCard}>
        <div className={styles.moverK}>Best mover</div>
        <div className={styles.moverV}>
          {loading ? "…" : bestMove ? `${bestMove.symbol} ${fmtPct(bestMove.change_pct)}` : "—"}
        </div>
        <div className={styles.moverSub}>
          {loading ? "" : bestMove ? fmtMaybe(bestMove.company_name) : ""}
        </div>
      </div>

      <div className={styles.moverCard}>
        <div className={styles.moverK}>Worst mover</div>
        <div className={styles.moverV}>
          {loading ? "…" : worstMove ? `${worstMove.symbol} ${fmtPct(worstMove.change_pct)}` : "—"}
        </div>
        <div className={styles.moverSub}>
          {loading ? "" : worstMove ? fmtMaybe(worstMove.company_name) : ""}
        </div>
      </div>
    </div>
  );
}

export function RowAnchorLink({ r, children }: { r: ResearchRow; children: React.ReactNode }) {
  const sym = typeof r.symbol === "string" ? r.symbol : "";
  const href = sym ? `#row-${safeId(sym)}` : "#all-rows";
  return (
    <a className={styles.anchorLink} href={href}>
      {children}
    </a>
  );
}