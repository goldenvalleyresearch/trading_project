// new-frontend/src/app/portfolio/page.tsx
import styles from "./page.module.css";
import Header from "../../componets/Header_bar/Header_bar";
import SnapshotCard from "../../componets/SnapshotCard/SnapshotCard";
import FeatureCard from "../../componets/FeatureCard/FeatureCard";
import Footer from "../../componets/Footer/Footer";
import StockChart from "../../componets/StockChart/StockChart";

import { BRAND_NAME, LINKS } from "../../lib/site";
import {
  getPortfolioAsOf,
  getPortfolioSummaryForUI,
  getAllocationForUI,
  getPositionsForUI,
} from "../../lib/portfolio";

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

function fmtPriceUpdated(s: any) {
  if (!s) return "—";
  const d = new Date(String(s));
  if (Number.isNaN(d.getTime())) return String(s).slice(0, 19).replace("T", " ");
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtCompactMoney(x: any) {
  const n = parseMoneyLike(x);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
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

    const priceUpdated =
      p.price_as_of ??
      p.priceAsOf ??
      p.last_price_as_of ??
      p.lastPriceAsOf ??
      p.updated_at ??
      p.updatedAt ??
      null;

    const name = String(p.name ?? "").trim();
    const valueN = parseMoneyLike(p.value ?? p.market_value);

    return { ...p, symbol, name, __valueN: valueN, __priceUpdated: priceUpdated };
  });

  const equityRows = rows.filter((p: any) => !String(p.symbol || "").includes("*"));
  const cashRows = rows.filter((p: any) => String(p.symbol || "").includes("*"));

  const topHoldings = [...equityRows]
    .filter((p: any) => Number.isFinite(p.__valueN))
    .sort((a, b) => (b.__valueN ?? 0) - (a.__valueN ?? 0))
    .slice(0, 5);

  const chartSymbol = topHoldings?.[0]?.symbol || "";

  const mobileBlocks: Array<{ type: "section"; title: string } | { type: "row"; p: any; isCash?: boolean }> = [];
  if (equityRows.length > 0) {
    mobileBlocks.push({ type: "section", title: "Stocks" });
    equityRows.forEach((p: any) => mobileBlocks.push({ type: "row", p }));
  }
  if (cashRows.length > 0) {
    mobileBlocks.push({ type: "section", title: "Cash & sweep" });
    cashRows.forEach((p: any) => mobileBlocks.push({ type: "row", p, isCash: true }));
  }

  return (
    <div className={styles.page}>
      <Header brand={BRAND_NAME} links={LINKS} ctaLabel="View Live" ctaHref="/portfolio" />

      <main className={styles.main}>
        <section className={styles.top}>
          <div>
            <h1 className={styles.h1}>Portfolio</h1>
            <div className={styles.asof}>As-of: {asOf}</div>
          </div>
          <a className={styles.ghostBtn} href="/performance">
            View performance →
          </a>
        </section>

        <section className={styles.grid2}>
          <div className={styles.cardStack}>
            <SnapshotCard note={summary.note} href={summary.href} kpis={summary.kpis} ctaLabel={summary.ctaLabel} />

            {topHoldings.length > 0 && (
              <div className={styles.topHoldings}>
                <div className={styles.cardTitle}>Top holdings</div>
                <div className={styles.chips}>
                  {topHoldings.map((p: any) => (
                    <div key={p.symbol} className={styles.chip}>
                      <div className={styles.chipSym}>{p.symbol}</div>
                      <div className={styles.chipVal}>{money(p.__valueN)}</div>
                      <div className={styles.chipMeta}>{p.weight ?? "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={styles.cardStack}>
            <div className={styles.allocCard}>
              <div className={styles.cardTitle}>Allocation</div>
              <div className={styles.allocGrid}>
                {allocation.map((x) => (
                  <div key={x.label} className={styles.allocItem}>
                    <div className={styles.k}>{x.label}</div>
                    <div className={styles.v}>{x.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {chartSymbol ? <StockChart symbol={chartSymbol} defaultRange="6M" height={240} /> : null}
          </div>
        </section>


        <section className={`${styles.tableCard} ${styles.desktopOnly}`}>
          <div className={styles.tableTop}>
            <div>
              <div className={styles.tableTitle}>Holdings</div>
              <div className={styles.tableSub}>Includes cash.</div>
            </div>
            <span className={styles.badge}>Positions</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th className={styles.num}>Qty</th>
                  <th className={styles.num}>Price</th>
                  <th className={styles.num}>Value</th>
                  <th className={styles.num}>Weight</th>
                  <th className={styles.num}>Updated</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.empty}>
                      No positions yet. Upload a positions CSV, then refresh.
                    </td>
                  </tr>
                ) : (
                  <>
                    {equityRows.map((p: any) => (
                      <tr key={p.symbol}>
                        <td className={styles.sym}>{p.symbol}</td>
                        <td className={styles.name}>{p.name || "—"}</td>
                        <td className={styles.num}>{p.qty ?? p.quantity ?? "—"}</td>
                        <td className={styles.num}>{p.price ?? p.last_price ?? "—"}</td>
                        <td className={styles.num}>{p.value ?? p.market_value ?? "—"}</td>
                        <td className={styles.num}>{p.weight ?? "—"}</td>
                        <td className={styles.num}>{fmtPriceUpdated(p.__priceUpdated)}</td>
                      </tr>
                    ))}

                    {cashRows.length > 0 && (
                      <>
                        <tr className={styles.sectionRow}>
                          <td colSpan={7} className={styles.sectionCell}>
                            Cash & sweep
                          </td>
                        </tr>
                        {cashRows.map((p: any) => (
                          <tr key={p.symbol} className={styles.cashRow}>
                            <td className={styles.sym}>{p.symbol}</td>
                            <td className={styles.name}>{p.name || "—"}</td>
                            <td className={styles.num}>{p.qty ?? p.quantity ?? "—"}</td>
                            <td className={styles.num}>{p.price ?? p.last_price ?? "—"}</td>
                            <td className={styles.num}>{p.value ?? p.market_value ?? "—"}</td>
                            <td className={styles.num}>{p.weight ?? "—"}</td>
                            <td className={styles.num}>{fmtPriceUpdated(p.__priceUpdated)}</td>
                          </tr>
                        ))}
                      </>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </section>


        <section className={`${styles.tableCard} ${styles.mobileOnly}`}>
          <div className={styles.tableTop}>
            <div>
              <div className={styles.tableTitle}>Holdings</div>
              <div className={styles.tableSub}>Includes cash.</div>
            </div>
            <span className={styles.badge}>Positions</span>
          </div>

          <div className={styles.mobileList}>
            {rows.length === 0 ? (
              <div className={styles.mobileEmpty}>No positions yet. Upload a positions CSV, then refresh.</div>
            ) : (
              mobileBlocks.map((b, idx) => {
                if (b.type === "section") {
                  return (
                    <div key={`sec-${idx}`} className={styles.mobileSection}>
                      {b.title}
                    </div>
                  );
                }

                const p = b.p;
                const qty = p.qty ?? p.quantity ?? "—";
                const price = p.price ?? p.last_price ?? "—";
                const value = p.value ?? p.market_value ?? "—";
                const weight = p.weight ?? "—";
                const updated = fmtPriceUpdated(p.__priceUpdated);

                return (
                  <div key={p.symbol || idx} className={`${styles.mobileRow} ${b.isCash ? styles.mobileCash : ""}`}>
                    <div className={styles.mobileTopLine}>
                      <div className={styles.mobileSym}>{p.symbol || "—"}</div>
                      <div className={styles.mobileValue}>{fmtCompactMoney(value)}</div>
                    </div>

                    <div className={styles.mobileName}>{p.name || "—"}</div>

                    <div className={styles.mobileMeta}>
                      <div className={styles.mobilePill}>
                        <span className={styles.mobileK}>Qty</span>
                        <span className={styles.mobileV}>{qty}</span>
                      </div>
                      <div className={styles.mobilePill}>
                        <span className={styles.mobileK}>Price</span>
                        <span className={styles.mobileV}>{String(price)}</span>
                      </div>
                      <div className={styles.mobilePill}>
                        <span className={styles.mobileK}>Wt</span>
                        <span className={styles.mobileV}>{String(weight)}</span>
                      </div>
                    </div>

                    <div className={styles.mobileUpdated}>Updated: {updated}</div>
                  </div>
                );
              })
            )}
          </div>
        </section>

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