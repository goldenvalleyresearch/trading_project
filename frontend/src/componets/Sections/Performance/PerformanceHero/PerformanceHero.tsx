// new-frontend/src/componets/Sections/Performance/PerformanceHero/PerformanceHero.tsx
import styles from "./PerformanceHero.module.css";

type Props = {
  title?: string;
  lede?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export default function PerformanceHero({
  title = "Performance",
  lede = "Equity curve, drawdowns, and benchmark comparisons. Clear enough to audit.",
  ctaHref = "/portfolio",
  ctaLabel = "Open portfolio →",
}: Props) {
  return (
    <section className={styles.top}>
      <div>
        <h1 className={styles.h1}>{title}</h1>
        <p className={styles.lede}>{lede}</p>
      </div>

      <div className={styles.topActions}>
        <a className={styles.ghostBtn} href={ctaHref}>
          {ctaLabel}
        </a>
      </div>
    </section>
  );
}