"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchRecentActivity, type ActivityRow } from "@/lib/activity";

function fmtUsd(x: number | null | undefined) {
  const n = Number(x);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function fmtNum(x: number | null | undefined) {
  const n = Number(x);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function ActivityPanel() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);

  // collapsed state per date
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const resp = await fetchRecentActivity({ days: 30, limit: 2000 });
        if (!mounted) return;

        setRange({ start: resp.start_date, end: resp.end_date });
        setRows(resp.data || []);

        // default: expand the most recent 3 days
        const dates = Array.from(new Set((resp.data || []).map((r) => r.trade_date)));
        const seed: Record<string, boolean> = {};
        dates.slice(0, 3).forEach((d) => (seed[d] = true));
        setOpenDates(seed);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || "Failed to load recent activity");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, ActivityRow[]>();
    for (const r of rows) {
      const d = String(r.trade_date || "").slice(0, 10);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(r);
    }

    // Sort rows within each date
    for (const [d, arr] of m.entries()) {
      arr.sort((a, b) => {
        const sideOrder = (s: string) => (s === "SELL" ? 0 : s === "BUY" ? 1 : 2);
        const so = sideOrder(String(a.side)) - sideOrder(String(b.side));
        if (so !== 0) return so;
        return String(a.ticker).localeCompare(String(b.ticker));
      });
      m.set(d, arr);
    }

    // Dates already come in desc from backend, but enforce:
    const dates = Array.from(m.keys()).sort((a, b) => String(b).localeCompare(String(a)));
    return { dates, map: m };
  }, [rows]);

  function toggleDate(d: string) {
    setOpenDates((prev) => ({ ...prev, [d]: !prev[d] }));
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Account Activity</div>
          <div style={{ opacity: 0.8, marginTop: 4 }}>
            {range ? (
              <>
                Showing <b>{range.start}</b> → <b>{range.end}</b>
              </>
            ) : (
              " "
            )}
          </div>
        </div>
        <div style={{ opacity: 0.8 }}>{loading ? "Loading…" : `${rows.length} rows`}</div>
      </div>

      <div style={{ marginTop: 12 }}>
        {err ? (
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)" }}>
            <div style={{ fontWeight: 900 }}>Error</div>
            <div style={{ opacity: 0.85, marginTop: 6 }}>{err}</div>
          </div>
        ) : loading ? (
          <div style={{ padding: 12, opacity: 0.85 }}>Loading activity…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.85 }}>No activity found.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {grouped.dates.map((d) => {
              const dayRows = grouped.map.get(d) || [];
              const open = !!openDates[d];

              const sells = dayRows.filter((r) => String(r.side).toUpperCase() === "SELL").length;
              const buys = dayRows.filter((r) => String(r.side).toUpperCase() === "BUY").length;

              return (
                <div key={d} style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, overflow: "hidden" }}>
                  {/* header */}
                  <button
                    onClick={() => toggleDate(d)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.04)",
                      border: "none",
                      color: "inherit",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 12,
                      fontWeight: 900,
                    }}
                  >
                    <span style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                      <span>{d}</span>
                      <span style={{ opacity: 0.75, fontWeight: 700, fontSize: 13 }}>
                        {dayRows.length} trades • {sells} sells • {buys} buys
                      </span>
                    </span>
                    <span style={{ opacity: 0.75, fontWeight: 800 }}>{open ? "Hide" : "Show"}</span>
                  </button>

                  {/* body */}
                  {open && (
                    <div style={{ padding: 10, overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                        <thead>
                          <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
                            <th style={{ padding: "8px 8px" }}>Side</th>
                            <th style={{ padding: "8px 8px" }}>Ticker</th>
                            <th style={{ padding: "8px 8px" }}>Qty</th>
                            <th style={{ padding: "8px 8px" }}>Price</th>
                            <th style={{ padding: "8px 8px" }}>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayRows.map((r, idx) => {
                            const side = String(r.side || "").toUpperCase();
                            return (
                              <tr key={`${d}-${r.ticker}-${side}-${idx}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                <td style={{ padding: "8px 8px", fontWeight: 900 }}>{side}</td>
                                <td style={{ padding: "8px 8px", fontWeight: 900 }}>{r.ticker}</td>
                                <td style={{ padding: "8px 8px" }}>{fmtNum(r.qty)}</td>
                                <td style={{ padding: "8px 8px" }}>{fmtUsd(r.price ?? null)}</td>
                                <td style={{ padding: "8px 8px" }}>{fmtUsd(r.value ?? null)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
