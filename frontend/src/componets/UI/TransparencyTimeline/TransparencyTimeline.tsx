"use client";

import { useMemo } from "react";
import styles from "./page.module.css";
import type { TimelineEvent } from "../../../lib/transparency";

type Group = { date: string; items: TimelineEvent[] };

function groupByDate(events: readonly TimelineEvent[]): Group[] {
  const map = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const arr = map.get(e.date) ?? [];
    arr.push(e);
    map.set(e.date, arr);
  }

  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({ date, items }));
}

function tryParseJSON(detail?: string): any | null {
  if (!detail) return null;
  const s = detail.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function money(n: any) {
  const x = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function pickReceiptPayload(items: TimelineEvent[]) {
  for (const it of items) {
    const parsed = tryParseJSON(it.detail);
    if (parsed && Array.isArray(parsed.trades)) return parsed;
  }
  return null;
}

function summarizeTrades(trades: any[]) {
  let buy = 0;
  let sell = 0;

  for (const t of trades) {
    const val = Number(t.value ?? t.amount ?? 0);
    const side = String(t.side ?? t.action ?? "").toUpperCase();
    if (!Number.isFinite(val)) continue;
    if (side === "BUY") buy += val;
    if (side === "SELL") sell += val;
  }

  return { buy, sell, netFlow: sell - buy };
}

export default function TransparencyTimeline({ items }: { items: readonly TimelineEvent[] }) {
  const groups = useMemo(() => groupByDate(items), [items]);

  if (!groups.length) return <div className={styles.empty}>No receipts yet.</div>;

  return (
    <div className={styles.feed} aria-label="Receipts">
      {groups.map((g) => {
        const payload = pickReceiptPayload(g.items);

        if (!payload) {
          return (
            <section key={g.date} className={styles.day}>
              <div className={styles.dayLabel}>
                <span className={styles.dot} />
                <span className={styles.date}>{g.date}</span>
                <span className={styles.pill}>{g.items.length} events</span>
              </div>

              <div className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardTitle}>No trade details yet</div>
                  <div className={styles.cardSub}>
                    Your backend is only sending “snapshot uploaded / computed”. Add trades JSON to `detail`.
                  </div>
                </div>

                <div className={styles.faintList}>
                  {g.items.map((e, i) => (
                    <div key={i} className={styles.faintRow}>
                      <span className={styles.faintTag}>{e.tag}</span>
                      <span className={styles.faintTitle}>{e.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        }

        const receiptId = payload.receipt_id ?? payload.id ?? null;
        const netAfter = payload.net_after ?? payload.net_value ?? null;
        const delta = payload.delta ?? payload.day_change ?? null;

        const trades: any[] = Array.isArray(payload.trades) ? payload.trades : [];
        const { buy, sell, netFlow } = summarizeTrades(trades);

        return (
          <section key={g.date} className={styles.day}>
            <div className={styles.dayLabel}>
              <span className={styles.dot} />
              <span className={styles.date}>{g.date}</span>
              <span className={styles.pill}>{trades.length} trades</span>
              {receiptId ? <span className={styles.id}>#{String(receiptId)}</span> : null}
            </div>

            <div className={styles.card}>
              <div className={styles.headerRow}>
                <div className={styles.kv}>
                  <div className={styles.k}>Net</div>
                  <div className={styles.v}>{netAfter != null ? money(netAfter) : "—"}</div>
                </div>
                <div className={styles.kv}>
                  <div className={styles.k}>Δ</div>
                  <div className={styles.v}>{delta != null ? money(delta) : "—"}</div>
                </div>
                <div className={styles.kv}>
                  <div className={styles.k}>Sold</div>
                  <div className={styles.v}>{money(sell)}</div>
                </div>
                <div className={styles.kv}>
                  <div className={styles.k}>Bought</div>
                  <div className={styles.v}>{money(buy)}</div>
                </div>
                <div className={styles.kv}>
                  <div className={styles.k}>Net flow</div>
                  <div className={styles.v}>{money(netFlow)}</div>
                </div>
              </div>

              <div className={styles.table}>
                <div className={styles.th}>
                  <span>Ticker</span>
                  <span>Side</span>
                  <span className={styles.right}>Qty</span>
                  <span className={styles.right}>Value</span>
                </div>

                {trades.map((t, i) => {
                  const side = String(t.side ?? t.action ?? "").toUpperCase();
                  return (
                    <div key={i} className={styles.tr}>
                      <span className={styles.ticker}>{t.ticker ?? "—"}</span>
                      <span className={styles.side} data-side={side}>
                        {side || "—"}
                      </span>
                      <span className={`${styles.qty} ${styles.right}`}>x{t.qty ?? "—"}</span>
                      <span className={`${styles.value} ${styles.right}`}>
                        {money(t.value ?? t.amount ?? null)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}