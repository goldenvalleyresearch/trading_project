import styles from "./page.module.css";

type KPI = { label: string; value: string };

function withSign(v: string) {
  if (!v || v === "—") return v;
  if (/^\s*[+-]/.test(v)) return v;
  const hasPositive = /(\d+(\.\d+)?)/.test(v) && !/-\d/.test(v);
  if (!hasPositive) return v;
  return `+${v}`.replace(/\((\d)/, "(+$1");
}

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
        {kpis.map((k) => {
          const showSigned =
            k.label.toLowerCase().includes("change") || k.value.includes("%");
          return (
            <div key={k.label} className={styles.kpi}>
              <div className={styles.kpiLabel}>{k.label}</div>
              <div className={styles.kpiValue}>
                {showSigned ? withSign(k.value) : k.value}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.bottom}>
        <div className={styles.note}>{note}</div>
        <a className={styles.cta} href={href}>
          {ctaLabel} →
        </a>
      </div>
    </div>
  );
}