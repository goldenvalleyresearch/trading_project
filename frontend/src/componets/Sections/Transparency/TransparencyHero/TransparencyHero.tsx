"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./TransparencyHero.module.css";
import { apiGet } from "@/lib/api";

type Summary = {
  note: string;
  kpis: Array<{ label: string; value: string }>;
  href?: string;
  ctaLabel?: string;
};

type ReceiptApi = {
  as_of?: string | null;
  receipt_id?: string | null;
  net_after?: number | null;
  net_before?: number | null;
  delta?: number | null;
  trades?: any[] | null;
};

type ReceiptResp = {
  as_of?: string | null;
  id?: string | null;
  tag?: string | null;
  events?: number | null;
  trades?: number | null;
  lines?: number | null;
  net_after?: number | null;
  delta?: number | null;
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const t = String(d).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : String(d);
}

function money(x: any) {
  const n = Number(x);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function TransparencyHero({
  asOf,
  summary,
}: {
  asOf: string;
  summary: Summary;
}) {
  const [recent, setRecent] = useState<ReceiptResp | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const j = await apiGet<any>("/history/receipts?limit=1");
        if (!alive) return;

        const first: ReceiptApi | null = Array.isArray(j) && j.length ? j[0] : null;

        if (!first) {
          setRecent(null);
          return;
        }

        const tradeCount = Array.isArray(first.trades) ? first.trades.length : null;

        setRecent({
          as_of: first.as_of ?? null,
          id: first.receipt_id ?? null,
          tag: "rcpt",
          events: tradeCount,
          trades: tradeCount,
          lines: tradeCount,
          net_after: typeof first.net_after === "number" ? first.net_after : null,
          delta: typeof first.delta === "number" ? first.delta : null,
        });
      } catch {
        if (!alive) return;
        setRecent(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const right = useMemo(() => {
    const date = fmtDate(recent?.as_of) || asOf;
    const trades = recent?.trades ?? null;
    const events = recent?.events ?? trades;
    const netAfter = recent?.net_after ?? null;
    const delta = recent?.delta ?? null;

    return { date, events, trades, netAfter, delta };
  }, [recent, asOf]);

  return (
    <section className={styles.hero}>
      <div className={styles.heroLeft}>
        <div className={styles.eyebrow}>Audit log</div>
        <h1 className={styles.h1}>Transparency</h1>
        <p className={styles.lede}>
          Receipts show what changed each day (snapshot → compute → trades).
        </p>

        <div className={styles.metaRow}>
          <span className={styles.dot} />
          <span className={styles.metaText}>As-of: {asOf}</span>
        </div>

        <div className={styles.actions}>
          <a className={styles.primaryBtn} href="#receipts">
            View receipts ↓
          </a>
          <a className={styles.ghostBtn} href="/portfolio">
            Open portfolio →
          </a>
          <a className={styles.ghostBtn} href="/performance">
            Performance →
          </a>
        </div>
      </div>

      <div className={styles.heroRight}>
        <div className={styles.cardLabel}>Latest receipt</div>

        <div className={styles.receiptCard}>
          <div className={styles.receiptTop}>
            <div className={styles.receiptTitle}>Most recent</div>
            <div className={styles.receiptBadge}>as-of</div>
          </div>

          <div className={styles.receiptGrid}>
            <div className={styles.receiptKpi}>
              <div className={styles.receiptKpiLabel}>as-of</div>
              <div className={styles.receiptKpiValue}>{right.date}</div>
            </div>

            <div className={styles.receiptKpi}>
              <div className={styles.receiptKpiLabel}>net after</div>
              <div className={styles.receiptKpiValue}>{money(right.netAfter)}</div>
            </div>

            <div className={styles.receiptKpi}>
              <div className={styles.receiptKpiLabel}>delta</div>
              <div className={styles.receiptKpiValue}>{money(right.delta)}</div>
            </div>

            <div className={styles.receiptKpi}>
              <div className={styles.receiptKpiLabel}>trades</div>
              <div className={styles.receiptKpiValue}>{right.trades ?? "—"}</div>
            </div>

            <div className={styles.receiptKpi}>
              <div className={styles.receiptKpiLabel}>events</div>
              <div className={styles.receiptKpiValue}>{right.events ?? "—"}</div>
            </div>

            <div className={styles.receiptKpi}>
              <div className={styles.receiptKpiLabel}>lines</div>
              <div className={styles.receiptKpiValue}>{right.trades ?? "—"}</div>
            </div>
          </div>

          <div className={styles.receiptBottom}>
            <a className={styles.receiptCta} href="#receipts">
              View receipts →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}