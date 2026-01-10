import styles from "./page.module.css";
import { LINKS } from "@/lib/site";


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
        {LINKS.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
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