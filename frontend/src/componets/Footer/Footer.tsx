import styles from "./page.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <div className={styles.brand}>The Obvious Trades</div>
          <p className={styles.tagline}>
            A public record of decisions, performance, and process.
          </p>
        </div>

        <div className={styles.links}>
          <a href="/portfolio">Portfolio</a>
          <a href="/performance">Performance</a>
          <a href="/login">Login</a>
          <a href="/transparency">Transparency</a>
        </div>

        <div className={styles.meta}>
          <span>Data timestamped</span>
          <span>•</span>
          <span>No hindsight edits</span>
        </div>
      </div>

      <div className={styles.bottom}>
        <span>© {new Date().getFullYear()} The Obvious Trades</span>
        <span>Not investment advice</span>
      </div>
    </footer>
  );
}