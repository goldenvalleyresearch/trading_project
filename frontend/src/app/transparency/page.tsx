// src/app/transparency/page.tsx
import styles from "./page.module.css";
import Header from "@/componets/UI/Header_bar/Header_bar";
import TransparencyTimeline from "@/componets/UI/TransparencyTimeline/TransparencyTimeline";
import Footer from "@/componets/UI/Footer/Footer";

import TransparencyHero from "@/componets/Sections/Transparency/TransparencyHero/TransparencyHero";

import { BRAND_NAME, LINKS } from "@/lib/site";
import {
  getTransparencyAsOf,
  getTransparencySummaryForUI,
  getTransparencyTimelineForUI,
} from "@/lib/transparency";

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
        <TransparencyHero asOf={asOf} summary={summary} />

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
                  Upload two positions CSVs on two different as_of dates so /history/activity can
                  detect sells/buys.
                </div>
              </div>
            )}
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}