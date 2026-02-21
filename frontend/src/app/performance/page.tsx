"use client";

import styles from "./page.module.css";
import Header from "@/componets/UI/Header_bar/Header_bar";
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

        <div className={styles.disclosureBanner}>
          <strong>Disclosure:</strong> Performance shown reflects a personal
          account and is provided for transparency and educational purposes only.
          Results are unaudited and may not reflect fees, taxes, spreads,
          commissions, or slippage. This is not investment advice or an offer to
          manage money.
        </div>

        <PerformanceChartCard />
      </main>

      <Footer />
    </div>
  );
}