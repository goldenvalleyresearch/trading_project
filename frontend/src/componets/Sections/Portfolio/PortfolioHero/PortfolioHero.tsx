import styles from "./PortfolioHero.module.css";

type Props = {
  asOf: string;
};

export default function PortfolioHero({ asOf }: Props) {
  return (
    <section className={styles.top}>
      <div>
        <h1 className={styles.h1}>Portfolio</h1>
        <div className={styles.asof}>As-of: {asOf}</div>
      </div>
      <a className={styles.ghostBtn} href="/performance">
        View performance →
      </a>
    </section>
  );
}