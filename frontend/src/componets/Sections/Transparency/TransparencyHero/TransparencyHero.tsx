"use client";

import styles from "./TransparencyHero.module.css";

type Summary = {
  note: string;
  kpis: Array<{ label: string; value: string }>;
  href?: string;
  ctaLabel?: string;
};

export default function TransparencyHero({
  asOf,
  summary,
}: {
  asOf: string;
  summary: Summary;
}) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroLeft}>
        {/* Removed: "Audit log" eyebrow */}
        <h1 className={styles.h1}>Transparency</h1>

        <p className={styles.lede}>
          Account activity shows your buys and sells from uploaded activity.
        </p>

        <div className={styles.metaRow}>
          <span className={styles.dot} />
          <span className={styles.metaText}>As-of: {asOf}</span>
        </div>

        <div className={styles.actions}>
          <a className={styles.primaryBtn} href="#activity">
            View activity ↓
          </a>
          <a className={styles.ghostBtn} href="/portfolio">
            Open portfolio →
          </a>
          <a className={styles.ghostBtn} href="/performance">
            Performance →
          </a>
        </div>
      </div>

      {/* Removed: entire right-side "Latest receipt" card */}
      <div className={styles.heroRight} />
    </section>
  );
}
