"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import Header from "../../componets/Header_bar/Header_bar";
import EquityPreview from "../../componets/EquityPreview/EquityPreview";
import FeatureCard from "../../componets/FeatureCard/FeatureCard";
import Footer from "../../componets/Footer/Footer";
import { BRAND_NAME, LINKS } from "../../lib/site";
import { apiGet } from "../../lib/api";

type EquityPoint = { d: string; v: number };
type RangeKey = "1M" | "3M" | "1Y" | "ALL";

function pctStr(x: number | null | undefined): string {
  if (typeof x !== "number" || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(2)}%`;
}

function numStr(x: number | null | undefined, digits = 2): string {
  if (typeof x !== "number" || !Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

function daysBetweenISO(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 0;
  return Math.max(0, (db - da) / 86400000);
}

function computeCAGR(points: EquityPoint[]): number | null {
  if (points.length < 2) return null;
  const start = Number(points[0].v);
  const end = Number(points[points.length - 1].v);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0) return null;

  const days = daysBetweenISO(points[0].d, points[points.length - 1].d);
  if (days <= 0) return null;

  const years = days / 365.25;
  return Math.pow(end / start, 1 / years) - 1;
}

function computeMaxDrawdown(points: EquityPoint[]): number | null {
  if (points.length < 2) return null;
  let peak = -Infinity;
  let maxDD = 0;

  for (const p of points) {
    const v = Number(p.v);
    if (!Number.isFinite(v)) continue;
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (v - peak) / peak;
      if (dd < maxDD) maxDD = dd;
    }
  }
  return Number.isFinite(maxDD) ? maxDD : null;
}

function computeSharpe(points: EquityPoint[]): number | null {
  if (points.length < 20) return null;

  const rets: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = Number(points[i - 1].v);
    const cur = Number(points[i].v);
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev <= 0) continue;
    const r = cur / prev - 1;
    if (Number.isFinite(r)) rets.push(r);
  }

  if (rets.length < 10) return null;

  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varr = rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (rets.length - 1);
  const sd = Math.sqrt(varr);
  if (!Number.isFinite(sd) || sd === 0) return null;

  return (mean / sd) * Math.sqrt(252);
}

function rangeToWindow(range: RangeKey) {
  if (range === "1M") return 30;
  if (range === "3M") return 90;
  if (range === "1Y") return 365;
  return 10000;
}

function normalizeEquitySeries(input: any): EquityPoint[] {
  const arr: any[] = Array.isArray(input?.series) ? input.series : [];
  return arr
    .map((p) => ({
      d: String(p?.date ?? "").slice(0, 10),
      v: Number(p?.balance),
    }))
    .filter((p) => p.d.length === 10 && Number.isFinite(p.v));
}

function normalizeCloseSeries(input: any): EquityPoint[] {
  const arr: any[] = Array.isArray(input?.series) ? input.series : [];
  return arr
    .map((p) => ({
      d: String(p?.date ?? "").slice(0, 10),
      v: Number(p?.close),
    }))
    .filter((p) => p.d.length === 10 && Number.isFinite(p.v));
}

function computeVsSPY(port: EquityPoint[], spy: EquityPoint[]): number | null {
  if (port.length < 2 || spy.length < 2) return null;

  const spyMap = new Map(spy.map((p) => [p.d, p.v]));
  const shared = port.filter((p) => spyMap.has(p.d));
  if (shared.length < 2) return null;

  const spyShared = shared.map((p) => ({ d: p.d, v: spyMap.get(p.d)! }));

  const portC = computeCAGR(shared);
  const spyC = computeCAGR(spyShared);
  if (portC == null || spyC == null) return null;

  return portC - spyC;
}

export default function PerformancePage() {
  const [range, setRange] = useState<RangeKey>("1Y");

  const [rawPoints, setRawPoints] = useState<EquityPoint[]>([]);
  const [apiUpdated, setApiUpdated] = useState<string>("—");

  const [spyPoints, setSpyPoints] = useState<EquityPoint[]>([]);
  const [spyErr, setSpyErr] = useState<string | null>(null);

  useEffect(() => {
    const window = rangeToWindow(range);

    (async () => {
      try {
        const j: any = await apiGet(`/api/portfolio/equity-curve?window=${window}`);
        const updated = String(j?.as_of ?? "").slice(0, 10);
        setApiUpdated(updated || "—");

        const pts = normalizeEquitySeries(j);
        setRawPoints(pts);
      } catch {
        setApiUpdated("—");
        setRawPoints([]);
      }
    })();
  }, [range]);

  useEffect(() => {
    const maxAgeSec = 3600;
    (async () => {
      try {
        setSpyErr(null);
        const j: any = await apiGet(
          `/api/benchmark/price-series?symbol=SPY&range=${encodeURIComponent(range)}&max_age_sec=${maxAgeSec}`
        );
        setSpyPoints(normalizeCloseSeries(j));
      } catch (e: any) {
        setSpyErr(e?.message ?? "Benchmark failed");
        setSpyPoints([]);
      }
    })();
  }, [range]);

  const updatedOn =
    apiUpdated !== "—" ? apiUpdated : rawPoints.length ? rawPoints[rawPoints.length - 1].d : "—";

  const cagr = useMemo(() => computeCAGR(rawPoints), [rawPoints]);
  const maxDD = useMemo(() => computeMaxDrawdown(rawPoints), [rawPoints]);
  const sharpe = useMemo(() => computeSharpe(rawPoints), [rawPoints]);

  const vsSPY = useMemo(() => {
    if (spyErr) return null;
    return computeVsSPY(rawPoints, spyPoints);
  }, [rawPoints, spyPoints, spyErr]);

  return (
    <div className={styles.page}>
      <Header brand={BRAND_NAME} links={[...LINKS]} />

      <main className={styles.main}>
        <section className={styles.top}>
          <div>
            <h1 className={styles.h1}>Performance</h1>
            <p className={styles.lede}>
              Equity curve, drawdowns, and benchmark comparisons. Clear enough to audit.
            </p>
          </div>

          <div className={styles.topActions}>
            <a className={styles.ghostBtn} href="/portfolio">
              Open portfolio →
            </a>
          </div>
        </section>

        <section className={styles.chartCard}>
          <div className={styles.chartTop}>
            <div>
              <div className={styles.chartTitle}>Equity curve</div>
              <div className={styles.chartSub}>Updated: {updatedOn}</div>
            </div>

            <div className={styles.controls}>
              <div className={styles.range}>
                <button
                  className={`${styles.rangeBtn} ${range === "1M" ? styles.rangeActive : ""}`}
                  onClick={() => setRange("1M")}
                  type="button"
                >
                  1M
                </button>
                <button
                  className={`${styles.rangeBtn} ${range === "3M" ? styles.rangeActive : ""}`}
                  onClick={() => setRange("3M")}
                  type="button"
                >
                  3M
                </button>
                <button
                  className={`${styles.rangeBtn} ${range === "1Y" ? styles.rangeActive : ""}`}
                  onClick={() => setRange("1Y")}
                  type="button"
                >
                  1Y
                </button>
                <button
                  className={`${styles.rangeBtn} ${range === "ALL" ? styles.rangeActive : ""}`}
                  onClick={() => setRange("ALL")}
                  type="button"
                >
                  All
                </button>
              </div>

              <div className={styles.benchmark}>
                <span className={styles.benchmarkLabel}>Benchmark</span>
                <span className={styles.badge}>SPY{spyErr ? " (off)" : ""}</span>
              </div>
            </div>
          </div>

          <div className={styles.chartBody}>
            <EquityPreview
              height={230}
              showControls={false}
              range={range}
              onRangeChange={setRange}
              rebaseTo100={true}
              showSpy={true}
              spySymbol="SPY"
            />
          </div>

          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <div className={styles.k}>CAGR</div>
              <div className={styles.v}>{pctStr(cagr)}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.k}>Max drawdown</div>
              <div className={styles.v}>{pctStr(maxDD)}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.k}>vs SPY</div>
              <div className={styles.v}>{pctStr(vsSPY)}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.k}>Sharpe</div>
              <div className={styles.v}>{numStr(sharpe, 2)}</div>
            </div>
          </div>
        </section>

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