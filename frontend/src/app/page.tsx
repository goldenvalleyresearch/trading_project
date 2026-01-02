"use client";

// src/app/page.tsx
import { useEffect, useState } from "react";
import styles from "./page.module.css";
import Header from "../componets/Header_bar/Header_bar";
import EquityPreview from "../componets/EquityPreview/EquityPreview";
import FeatureCard from "../componets/FeatureCard/FeatureCard";
import SnapshotCard from "../componets/SnapshotCard/SnapshotCard";
import Footer from "../componets/Footer/Footer";

import { BRAND_NAME, LINKS } from "../lib/site";
import { getPortfolioSummaryForUI } from "../lib/portfolio";

type EquityPoint = { d: string; v: number };

const EMPTY_SNAPSHOT = {
  note: "No snapshot yet. Upload a positions CSV to create the first one.",
  href: "/transparency",
  ctaLabel: "Go to ingest",
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


function pickLastDateFromOnData(payload: any): string {

  if (Array.isArray(payload) && payload.length) {
    const last = payload[payload.length - 1];
    return safeISODate(last?.d ?? last?.date);
  }

  const series = payload?.series;
  if (Array.isArray(series) && series.length) {
    const last = series[series.length - 1];
    return safeISODate(last?.d ?? last?.date);
  }

  return "—";
}

export default function Home() {
  const [snapshot, setSnapshot] = useState<any>(EMPTY_SNAPSHOT);
  const [updated, setUpdated] = useState<string>("—");
  const [updateErr, setUpdateErr] = useState<string>("");


  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const s = await getPortfolioSummaryForUI();
        if (alive) setSnapshot(s as any);
      } catch {
        if (alive) setSnapshot(EMPTY_SNAPSHOT);
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
          <div className={styles.left}>
            <div className={styles.pills}>
              <span className={styles.pill}>Daily snapshots</span>
              <span className={styles.pill}>Receipts-first</span>
              <span className={styles.pill}>Tracked over time</span>
            </div>

            <h1 className={styles.title}>Transparent portfolio tracking and documented decisions.</h1>

            <p className={styles.subtitle}>
              Real positions → clean dashboards, performance history, and a newsletter you can audit.
            </p>

            <div className={styles.actions}>
              <a className={styles.primary} href="/portfolio">
                Explore Dashboard
              </a>

              <a className={styles.secondary} href="/transparency">
                View receipts →
              </a>
            </div>

            <div className={styles.meta}>
              <span className={styles.dot} />
              <span>As-of dates shown on every metric</span>
            </div>
          </div>

          <div className={styles.right}>
            <div className={styles.chartCard}>
              <div className={styles.chartTop}>
                <div className={styles.chartTitle}>Equity curve</div>
                <div className={styles.chartTag}>preview</div>
              </div>

              <div className={styles.chartBody}>
                <EquityPreview
                  height={190}
                  range="1Y"
                  showControls={false}
                  showSpy={true}
                  spySymbol="SPY"
                  rebaseTo100={true}
                  onData={(pts: EquityPoint[] | any) => {
                    try {
                      setUpdateErr("");
                      setUpdated(pickLastDateFromOnData(pts));
                    } catch (e: any) {
                      setUpdateErr(e?.message ?? "Update parse failed");
                      setUpdated("—");
                    }
                  }}
                />
              </div>

              <div className={styles.chartBottom}>
                <div className={styles.kv}>
                  <div className={styles.k}>Range</div>
                  <div className={styles.v}>1Y</div>
                </div>
                <div className={styles.kv}>
                  <div className={styles.k}>Benchmark</div>
                  <div className={styles.v}>SPY</div>
                </div>
                <div className={styles.kv}>
                  <div className={styles.k}>Update</div>
                  <div className={styles.v}>{updated}</div>
                </div>
              </div>

              {updateErr ? (
                <div style={{ fontSize: 12, opacity: 0.7, paddingTop: 8 }}>
                  ⚠ {updateErr}
                </div>
              ) : null}
            </div>

            <div className={styles.note}>Data is time-stamped. History stays visible.</div>
          </div>
        </section>

        <div className={styles.grid}>
          <FeatureCard
            title="Portfolio"
            body="Positions, cash, weights, and exposure with clean tables that load fast."
            href="/portfolio"
            linkLabel="Open portfolio"
          />
          <FeatureCard
            title="Performance"
            body="Equity curve, drawdowns, and comparisons vs benchmarks over time."
            href="/performance"
            linkLabel="View performance"
          />
          <FeatureCard
            title="Newsletter"
            body="Weekly digest + trade notes, written for audit and clarity."
            href="/newsletter"
            linkLabel="Read newsletter"
          />

          <div className={styles.cardAltWrap}>
            <SnapshotCard
              note={snapshot.note}
              href={snapshot.href}
              kpis={snapshot.kpis}
              ctaLabel={snapshot.ctaLabel}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}