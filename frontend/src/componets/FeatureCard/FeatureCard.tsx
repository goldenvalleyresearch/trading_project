import styles from "./page.module.css";

export default function FeatureCard({
  title,
  body,
  href,
  linkLabel = "Open",
}: {
  title: string;
  body: string;
  href: string;
  linkLabel?: string;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.title}>{title}</div>
      <div className={styles.body}>{body}</div>
      <a className={styles.link} href={href}>
        {linkLabel} →
      </a>
    </div>
  );
}