"use client";

import styles from "./page.module.css";
import Header from "@/componets/UI/Header_bar/Header_bar";
import FeatureCard from "@/componets/UI/FeatureCard/FeatureCard";
import Footer from "@/componets/UI/Footer/Footer";

import PerformanceHero from "@/componets/Sections/Performance/PerformanceHero/PerformanceHero";
import PerformanceChartCard from "@/componets/Sections/Performance/PerformanceChartCard/PerformanceChartCard";

import { BRAND_NAME, LINKS } from "@/lib/site";

export default function PerformancePage() {
  return (
    <div className={styles.page}>
      <Header brand={BRAND_NAME} links={[...LINKS]} />

      <main className={styles.main}>
        <PerformanceHero />

        <PerformanceChartCard />

        <section className={styles.grid}>
          <FeatureCard
            title="Portfolio"
            body="Holdings, weights, and cash with clean tables that load fast."
            href="/portfolio"
            linkLabel="Open portfolio"
          />
          <FeatureCard
            title="Newsletter"
            body="Weekly digest + trade notes, written for audit and clarity."
            href="/newsletter"
            linkLabel="Read newsletter"
          />
          <FeatureCard
            title="Transparency"
            body="Receipts-style timeline for snapshots, updates, and decisions."
            href="/transparency"
            linkLabel="View timeline"
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}