import Link from "next/link";
import styles from "./Footer.module.css";
import { LINKS } from "@/lib/site";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <div className={styles.brand}>Golden Valley Market Research</div>
          <p className={styles.tagline}>
            Research-driven analysis with disciplined risk management.
          </p>
        </div>

        <nav className={styles.links}>
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className={styles.meta}>
          <span>Current performance</span>
          <span>Research-driven</span>
          <span>Updated daily</span>
        </div>
      </div>

      <div className={styles.bottom}>
        <span>© {new Date().getFullYear()} Golden Valley Market Research</span>

        <span className={styles.disclaimer}>
          Educational purposes only — not investment advice or a solicitation.
          Investing involves risk, including loss of principal. Past performance
          is not indicative of future results.{" "}
          <Link className={styles.disclosureLink} href="/disclosures">
            See Disclosures
          </Link>
          .
        </span>
      </div>
    </footer>
  );
}