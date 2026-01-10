// src/componets/Sections/Transparency/TransparencyHero/TransparencyHero.tsx
import styles from "./TransparencyHero.module.css";
import SnapshotCard from "@/componets/UI/SnapshotCard/SnapshotCard";

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
        <div className={styles.eyebrow}>Audit log</div>
        <h1 className={styles.h1}>Transparency</h1>
        <p className={styles.lede}>
          Receipts show what changed each day (snapshot → compute → trades).
        </p>

        <div className={styles.metaRow}>
          <span className={styles.dot} />
          <span className={styles.metaText}>As-of: {asOf}</span>
        </div>

        <div className={styles.actions}>
          <a className={styles.primaryBtn} href="#receipts">
            View receipts ↓
          </a>
          <a className={styles.ghostBtn} href="/portfolio">
            Open portfolio →
          </a>
          <a className={styles.ghostBtn} href="/performance">
            Performance →
          </a>
        </div>
      </div>

      <div className={styles.heroRight}>
        <div className={styles.cardLabel}>Latest snapshot</div>
        <div className={styles.snapWrap}>
          <SnapshotCard note={summary.note} kpis={summary.kpis} href={"/portfolio"} />
        </div>
      </div>
    </section>
  );
}