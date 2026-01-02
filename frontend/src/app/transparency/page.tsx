// src/app/transparency/page.tsx
import styles from "./page.module.css";
import Header from "../../componets/Header_bar/Header_bar";
import SnapshotCard from "../../componets/SnapshotCard/SnapshotCard";
import TransparencyTimeline from "../../componets/TransparencyTimeline/TransparencyTimeline";
import Footer from "../../componets/Footer/Footer";

import { BRAND_NAME, LINKS } from "../../lib/site";

import {
  getTransparencyAsOf,
  getTransparencySummaryForUI,
  getTransparencyTimelineForUI,
} from "../../lib/transparency";

const EMPTY_SUMMARY = {
  note: "Could not load summary (API error).",
  href: "/transparency",
  ctaLabel: "Retry",
  kpis: [
    { label: "Last ingest", value: "—" },
    { label: "Net value", value: "—" },
    { label: "Day change", value: "—" },
    { label: "Cash", value: "—" },
  ],
};

export default async function TransparencyPage() {
  const [asOfRes, summaryRes, timelineRes] = await Promise.allSettled([
    getTransparencyAsOf(),
    getTransparencySummaryForUI(),
    getTransparencyTimelineForUI(),
  ]);

  const asOf = asOfRes.status === "fulfilled" ? asOfRes.value : "—";
  const summary = summaryRes.status === "fulfilled" ? summaryRes.value : EMPTY_SUMMARY;
  const typedEvents = timelineRes.status === "fulfilled" ? timelineRes.value : [];

  return (
    <div className={styles.page}>
      <Header brand={BRAND_NAME} links={[...LINKS]} />

      <main className={styles.main}>
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
               <SnapshotCard
                note={summary.note}
                kpis={summary.kpis}
                href={"/portfolio"}

              />
            </div>
          </div>
        </section>

        <section id="receipts" className={styles.receipts}>
          <div className={styles.sectionTop}>
            <div>
              <div className={styles.sectionTitle}>Receipts</div>
              <div className={styles.sectionSub}>
                Upload/compute + the actual BUY/SELL changes detected from snapshots.
              </div>
            </div>
            <span className={styles.badge}>
              {typedEvents.length ? `${typedEvents.length} events` : "empty"}
            </span>
          </div>

          <div className={styles.sectionBody}>
            {typedEvents.length ? (
              <TransparencyTimeline items={typedEvents} />
            ) : (
              <div className={styles.empty}>
                <div className={styles.emptyTitle}>No receipts yet</div>
                <div className={styles.emptySub}>
                  Upload two positions CSVs on two different as_of dates so /history/activity can detect sells/buys.
                </div>
              </div>
            )}
          </div>
        </section>

        <section className={styles.navRow}>
          <a className={styles.navLink} href="/portfolio">Portfolio</a>
          <span className={styles.navSep}>•</span>
          <a className={styles.navLink} href="/performance">Performance</a>
          <span className={styles.navSep}>•</span>
          <a className={styles.navLink} href="/trades">Journal</a>
        </section>
      </main>

      <Footer />
    </div>
  );
}