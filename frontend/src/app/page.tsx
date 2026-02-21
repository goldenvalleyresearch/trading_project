"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

import Header from "../componets/UI/Header_bar/Header_bar";
import Footer from "../componets/UI/Footer/Footer";
import Hero from "../componets/Sections/Landing/Hero/Hero";
import Pillars from "../componets/Sections/Pillars/Pillars";


import { BRAND_NAME, LINKS } from "../lib/site";
import { getPortfolioSummaryForUI } from "../lib/portfolio";

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
  const [asOf, setAsOf] = useState<string>("—");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const s = await getPortfolioSummaryForUI();
        if (!alive) return;
        setAsOf(pickAsOfFromSnapshot(s));
      } catch {
        if (!alive) return;
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
        <Pillars />
      </main>

      <Footer />
    </div>
  );
}
