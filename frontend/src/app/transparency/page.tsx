// src/app/transparency/page.tsx
import styles from "./page.module.css";
import Header from "@/componets/UI/Header_bar/Header_bar";
import Footer from "@/componets/UI/Footer/Footer";
import TransparencyHero from "@/componets/Sections/Transparency/TransparencyHero/TransparencyHero";

import ActivityPanel from "@/componets/Sections/Transparency/TransparencyHero/ActivityPanel/ActivityPanel";

import { BRAND_NAME, LINKS } from "@/lib/site";
import {
  getTransparencyAsOf,
  getTransparencySummaryForUI,
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
  const [asOfRes, summaryRes] = await Promise.allSettled([
    getTransparencyAsOf(),
    getTransparencySummaryForUI(),
  ]);

  const asOf = asOfRes.status === "fulfilled" ? asOfRes.value : "—";
  const summary = summaryRes.status === "fulfilled" ? summaryRes.value : EMPTY_SUMMARY;

  return (
    <div className={styles.page}>
      <Header brand={BRAND_NAME} links={[...LINKS]} />

      <main className={styles.main}>
        <TransparencyHero asOf={asOf} summary={summary} />
        {/* NEW: Account Activity */}
        <ActivityPanel />
        <section id="activity" className={styles.receipts}>
          <div className={styles.sectionTop}>
            <div>
              <div className={styles.sectionTitle}>Activity</div>
            </div>
          </div>

          <div className={styles.sectionBody}>
            <ActivityPanel />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
