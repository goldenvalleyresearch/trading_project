
"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

import Header from "../componets/UI/Header_bar/Header_bar";
import Footer from "../componets/UI/Footer/Footer";

import Hero from "../componets/Sections/Landing/Hero/Hero";
import Features from "../componets/Sections/Landing/Features/Features";
import SnapshotCard from "../componets/UI/SnapshotCard/SnapshotCard";

import { BRAND_NAME, LINKS } from "../lib/site";
import { getPortfolioSummaryForUI } from "../lib/portfolio";

const EMPTY_SNAPSHOT = {
  note: "No snapshot yet. Upload a positions CSV to create the first one.",
  href: "/transparency",
  ctaLabel: "View transparency",
  kpis: [
    { label: "as-of", value: "—" },
    { label: "Net value", value: "—" },
    { label: "Day change", value: "—" },
    { label: "Cash", value: "—" },
  ],
};

function safeISODate(x: any) {
  const s = String(x ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "—";
}

function pickAsOfFromSnapshot(s: any): string {
  const kpis = Array.isArray(s?.kpis) ? s.kpis : [];
  const asOf = kpis.find((k: any) =>
    String(k?.label ?? "").toLowerCase().includes("as-of")
  )?.value;
  return safeISODate(asOf);
}

export default function Home() {
  const [snapshot, setSnapshot] = useState<any>(EMPTY_SNAPSHOT);
  const [asOf, setAsOf] = useState<string>("—");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const s = await getPortfolioSummaryForUI();
        if (!alive) return;
        setSnapshot(s as any);
        setAsOf(pickAsOfFromSnapshot(s));
      } catch {
        if (!alive) return;
        setSnapshot(EMPTY_SNAPSHOT);
        setAsOf("—");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className={styles.page}>
      <Header brand={BRAND_NAME} links={[...LINKS]} />

      <main className={styles.main}>

        <Hero asOf={asOf} />


        <div className={`${styles.container} ${styles.afterHero}`}>
          <Features />

          <section className={styles.snapshotSection}>
            <div className={styles.snapshotTitle}>Latest snapshot</div>
            <div className={styles.snapshotSub}>Receipts-style, time-stamped.</div>

            <div className={styles.snapshotWrap}>
              <SnapshotCard
                note={snapshot.note}
                href={snapshot.href}
                kpis={snapshot.kpis}
                ctaLabel={snapshot.ctaLabel}
              />
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}