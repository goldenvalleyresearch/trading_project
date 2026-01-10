"use client";

import React from "react";
import styles from "./ResearchRatingsCard.module.css";
import type { ResearchRow } from "@/lib/research";
import { fmtNum, fmtMaybe, fmtShortMoneyFromStringish, isFiniteNum, safeId } from "@/lib/research";

export default function ResearchRatingsCard({
  loading,
  topQuant,
  topWSRow,
  biggestCap,
  ratingTop,
}: {
  loading: boolean;
  topQuant: ResearchRow | null;
  topWSRow: ResearchRow | null;
  biggestCap: ResearchRow | null;
  ratingTop: ResearchRow[];
}) {
  return (
    <div className={styles.rightCard}>
      <div className={styles.cardTitle}>Stock rating (Top 5)</div>

      <div className={styles.rightBody}>
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
                ? `${biggestCap.symbol} (${fmtShortMoneyFromStringish(biggestCap.market_cap)})`
                : "—"}
            </span>
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
              <div className={styles.emptySub}>Try “All” or turn off “Rated only”.</div>
            </div>
          ) : (
            ratingTop.map((r, i) => {
              const q = isFiniteNum(r.quant_rating) ? fmtNum(r.quant_rating, 2) : "—";
              const ws = isFiniteNum(r.wall_street_ratings) ? fmtNum(r.wall_street_ratings, 2) : "—";
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
  );
}