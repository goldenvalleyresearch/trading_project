import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Disclosures | Golden Valley Market Research",
  description:
    "Important disclosures, risk statements, and methodology notes for Golden Valley Market Research.",
};

export default function DisclosuresPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>Disclosures</h1>
        <p className={styles.lede}>
          This site is a public, process-first archive intended for educational
          and informational purposes only.
        </p>

        <section className={styles.card}>
          <h2>Educational / informational only</h2>
          <p>
            Golden Valley Market Research is a public portfolio and research
            journal intended for educational and informational purposes only.
            Nothing on this site should be construed as investment, tax, legal,
            or accounting advice.
          </p>

          <h2>No advisory relationship / no personalization</h2>
          <p>
            Content is general in nature and does not consider any individual’s
            objectives, financial situation, or needs. Viewing this site,
            subscribing, or contacting the author does not create an advisory,
            fiduciary, or client relationship.
          </p>

          <h2>No solicitation / no offer</h2>
          <p>
            Nothing on this site is an offer, solicitation, or recommendation to
            buy or sell any security or to engage in any investment strategy.
            Any references to securities, positions, or strategies are for
            discussion and transparency only.
          </p>

          <h2>Risk of loss</h2>
          <p>
            All investing involves risk, including the possible loss of
            principal. Markets are volatile and losses can exceed expectations.
            You are solely responsible for your investment decisions. Consider
            consulting a qualified financial professional.
          </p>

          <h2>Performance &amp; methodology</h2>
          <p>
            Any performance information shown reflects a personal account and is
            presented for transparency and educational purposes only. Results
            are unaudited and may differ from others’ results. Performance may
            not reflect all fees, taxes, spreads, commissions, slippage, or
            other trading costs. Past performance is not indicative of future
            results.
          </p>

          <h2>Conflicts of interest</h2>
          <p>
            The author may hold positions in securities discussed and may buy or
            sell such securities at any time without notice. This creates a
            potential conflict of interest.
          </p>

          <h2>Forward-looking statements</h2>
          <p>
            Statements about expectations, projections, or market views are
            forward-looking and inherently uncertain. Actual results may differ
            materially.
          </p>

          <h2>Independence / employer</h2>
          <p>
            Views expressed are solely those of the author in a personal
            capacity and do not represent the views of any employer, affiliate,
            or institution. This site is not affiliated with, sponsored by, or
            endorsed by any employer.
          </p>

          <div className={styles.backRow}>
            <Link href="/" className={styles.backLink}>
              ← Back to Home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}