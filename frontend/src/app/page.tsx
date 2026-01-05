"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import Header from "../componets/Header_bar/Header_bar";
import FeatureCard from "../componets/FeatureCard/FeatureCard";
import SnapshotCard from "../componets/SnapshotCard/SnapshotCard";
import Footer from "../componets/Footer/Footer";
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
  const asOf = kpis.find((k: any) => String(k?.label ?? "").toLowerCase().includes("as-of"))?.value;
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
        <section className={styles.hero}>
          <div className={styles.pills}>
            <span className={styles.pill}>Receipts-first</span>
            <span className={styles.pill}>Daily snapshots</span>
            <span className={styles.pill}>Audit-friendly</span>
          </div>

          <h1 className={styles.title}>Real performance. Real receipts. No cherry-picking.</h1>

         <p className={styles.subtitle}>
          Time-stamped snapshots and receipts — explained weekly in a no-cherry-picking newsletter.
        </p>

         <div className={styles.actions}>
        <a className={styles.primary} href="/newsletter">
          Subscribe
        </a>
        <a className={styles.secondary} href="/newsletter">
          See weekly recap →
        </a>
      </div>

          <div className={styles.meta}>
            <span className={styles.dot} />
            <span>Last snapshot: {asOf}</span>
          </div>
        </section>

        <section className={styles.grid}>
          <FeatureCard
          title="Performance"
          body="Full equity curve and benchmarks — explained weekly in the newsletter."
          href="/newsletter"
          linkLabel="Get the recap"
        />

        <FeatureCard
          title="Transparency"
          body="Daily snapshots and receipts, summarized every week."
          href="/newsletter"
          linkLabel="Subscribe"
        />

        <FeatureCard
          title="Newsletter"
          body="Weekly recap of what changed + why (no cherry-picking)."
          href="/newsletter"
          linkLabel="Subscribe"
        />
        </section>

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
      </main>

      <Footer />
    </div>
  );
}