// new-frontend/src/app/portfolio/page.tsx
import styles from "./page.module.css";
import Header from "@/componets/UI/Header_bar/Header_bar";
import FeatureCard from "@/componets/UI/FeatureCard/FeatureCard";
import Footer from "@/componets/UI/Footer/Footer";

import PortfolioHero from "@/componets/Sections/Portfolio/PortfolioHero/PortfolioHero";
import SummaryGrid from "@/componets/Sections/Portfolio/SummaryGrid/SummaryGrid";
import Holdings from "@/componets/Sections/Portfolio/Holdings/Holdings";

import { BRAND_NAME, LINKS } from "@/lib/site";
import {
  getPortfolioAsOf,
  getPortfolioSummaryForUI,
  getAllocationForUI,
  getPositionsForUI,
} from "@/lib/portfolio";

const EMPTY_SUMMARY = {
  note: "No snapshot ingested yet. Upload a positions CSV to create the first snapshot.",
  href: "/transparency",
  ctaLabel: "Go to ingest",
  kpis: [
    { label: "as-of", value: "—" },
    { label: "Net value", value: "—" },
    { label: "Day change", value: "—" },
    { label: "Cash", value: "—" },
  ],
};

function parseMoneyLike(x: any): number {
  if (x == null) return NaN;
  if (typeof x === "number") return x;
  const s = String(x).trim();
  if (!s) return NaN;
  const neg = s.startsWith("(") && s.endsWith(")");
  const cleaned = s.replace(/[()$,%]/g, "").replace(/,/g, "").trim();
  const v = Number(cleaned);
  if (!Number.isFinite(v)) return NaN;
  return neg ? -v : v;
}

function money(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default async function PortfolioPage() {
  const [asOf, summary, allocation, positions] = await Promise.all([
    getPortfolioAsOf().catch(() => "—"),
    getPortfolioSummaryForUI().catch(() => EMPTY_SUMMARY),
    getAllocationForUI().catch(() => [
      { label: "Cash", value: "—" },
      { label: "Invested", value: "—" },
    ]),
    getPositionsForUI().catch(() => []),
  ]);

  const rows = (positions ?? []).map((p: any) => {
    const symbol = String(p.symbol ?? p.ticker ?? "").trim();
    const valueN = parseMoneyLike(p.value ?? p.market_value);
    return { ...p, symbol, __valueN: valueN };
  });

  const equityRows = rows.filter((p: any) => !String(p.symbol || "").includes("*"));

  const topHoldings = [...equityRows]
    .filter((p: any) => Number.isFinite(p.__valueN))
    .sort((a, b) => (b.__valueN ?? 0) - (a.__valueN ?? 0))
    .slice(0, 5);

  const chartSymbol = topHoldings?.[0]?.symbol || "";

  return (
    <div className={styles.page}>
      <Header brand={BRAND_NAME} links={[...LINKS]} />

      <main className={styles.main}>
        <PortfolioHero asOf={asOf} />

        <SummaryGrid
          summary={summary as any}
          topHoldings={topHoldings as any}
          allocation={allocation as any}
          chartSymbol={chartSymbol}
          money={money}
        />

        <Holdings rows={positions as any} />

        <section className={styles.grid3}>
          <FeatureCard title="Performance" body="Equity curve and drawdowns." href="/performance" linkLabel="Open" />
          <FeatureCard title="Newsletter" body="Notes tied to dates." href="/trades" linkLabel="Open" />
          <FeatureCard title="Transparency" body="Receipts-style timeline." href="/transparency" linkLabel="Open" />
        </section>
      </main>

      <Footer />
    </div>
  );
}