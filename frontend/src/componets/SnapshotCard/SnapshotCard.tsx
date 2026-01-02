import styles from "./page.module.css";

type KPI = { label: string; value: string };

export default function SnapshotCard({
  title = "Latest snapshot",
  badge = "as-of",
  note,
  kpis,
  href,
  ctaLabel = "View Live",
}: {
  title?: string;
  badge?: string;
  note: string;
  kpis: KPI[];
  href: string;
  ctaLabel?: string;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <div className={styles.title}>{title}</div>
        <div className={styles.badge}>{badge}</div>
      </div>

      <div className={styles.kpiRow}>
        {kpis.map((k) => (
          <div key={k.label} className={styles.kpi}>
            <div className={styles.kpiLabel}>{k.label}</div>
            <div className={styles.kpiValue}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className={styles.bottom}>
        <div className={styles.note}></div>
        <a className={styles.cta} href={href}>
          {ctaLabel} →
        </a>
      </div>
    </div>
  );
}