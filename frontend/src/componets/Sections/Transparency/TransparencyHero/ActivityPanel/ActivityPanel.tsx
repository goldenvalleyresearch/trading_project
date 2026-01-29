"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchLatestActivity, saveActivityThesis, type ActivityRow } from "@/lib/activity";
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
  const [tradeDate, setTradeDate] = useState<string>("—");
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedAt, setSavedAt] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const resp = await fetchLatestActivity({ limit: 500 });
        if (!mounted) return;

        setTradeDate(resp.trade_date || "—");
        setRows(resp.data || []);

        const seed: Record<string, string> = {};
        for (const r of resp.data || []) {
          seed[r.trade_id] = (r.thesis ?? "").toString();
        }
        setDrafts(seed);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || "Failed to load activity");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const { sells, buys } = useMemo(() => {
    const s: ActivityRow[] = [];
    const b: ActivityRow[] = [];
    for (const r of rows) (r.side === "SELL" ? s : b).push(r);

    const byTicker = (x: ActivityRow, y: ActivityRow) => String(x.ticker).localeCompare(String(y.ticker));
    s.sort(byTicker);
    b.sort(byTicker);

    return { sells: s, buys: b };
  }, [rows]);

  async function onSave(trade_id: string) {
    const thesis = (drafts[trade_id] ?? "").trim();

    setSaving((m) => ({ ...m, [trade_id]: true }));
    try {
      await saveActivityThesis({ trade_id, thesis });

      setSavedAt((m) => ({ ...m, [trade_id]: new Date().toLocaleTimeString() }));
      setRows((prev) => prev.map((r) => (r.trade_id === trade_id ? { ...r, thesis } : r)));
    } catch (e: any) {
      alert(e?.message || "Failed to save thesis");
    } finally {
      setSaving((m) => ({ ...m, [trade_id]: false }));
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Account Activity</div>
          <div style={{ opacity: 0.8, marginTop: 4 }}>
            Latest activity date: <span style={{ fontWeight: 800 }}>{tradeDate}</span>
          </div>
        </div>
        <div style={{ opacity: 0.8 }}>{loading ? "Loading…" : `${rows.length} rows`}</div>
      </div>

      <div style={{ marginTop: 12 }}>
        {err ? (
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)" }}>
            <div style={{ fontWeight: 800 }}>Error</div>
            <div style={{ opacity: 0.85, marginTop: 6 }}>{err}</div>
            <div style={{ opacity: 0.7, marginTop: 10, fontSize: 13 }}>
              If this is your first run, it’s probably because the backend routes aren’t live yet:
              <div style={{ marginTop: 6 }}>
                <code>/api/history/activity/latest</code> and <code>/api/history/activity/thesis</code>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div style={{ padding: 12, opacity: 0.85 }}>Loading activity…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.85 }}>No activity found.</div>
        ) : (
          <>
            <Section title="SELLS" rows={sells} />
            <div style={{ height: 18 }} />
            <Section title="BUYS" rows={buys} />
          </>
        )}
      </div>
    </div>
  );

  function Section({ title, rows }: { title: string; rows: ActivityRow[] }) {
    return (
      <div>
        <div style={{ fontSize: 12, letterSpacing: 1, opacity: 0.8, fontWeight: 900, marginBottom: 8 }}>
          {title}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                <th style={{ padding: "10px 8px" }}>Ticker</th>
                <th style={{ padding: "10px 8px" }}>Qty</th>
                <th style={{ padding: "10px 8px" }}>Price</th>
                <th style={{ padding: "10px 8px" }}>Amount</th>
                <th style={{ padding: "10px 8px" }}>Settlement</th>
                <th style={{ padding: "10px 8px", minWidth: 360 }}>Thesis</th>
                <th style={{ padding: "10px 8px" }}></th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const isSaving = !!saving[r.trade_id];
                const lastSaved = savedAt[r.trade_id];

                return (
                  <tr key={r.trade_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 900 }}>{r.ticker}</td>
                    <td style={{ padding: "10px 8px" }}>{fmtNum(r.qty)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmtUsd(r.price ?? null)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmtUsd((r as any).amount ?? null)}</td>
                    <td style={{ padding: "10px 8px" }}>{r.settlement_date ?? "—"}</td>

                    <td style={{ padding: "10px 8px" }}>
                      <textarea
                        value={drafts[r.trade_id] ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [r.trade_id]: e.target.value }))}
                        placeholder="Why this trade? Setup, catalyst, risk, invalidation, etc."
                        rows={3}
                        style={{
                          width: "100%",
                          resize: "vertical",
                          padding: 10,
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.15)",
                          background: "rgba(0,0,0,0.12)",
                          color: "inherit",
                        }}
                      />
                      {lastSaved ? (
                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>Saved at {lastSaved}</div>
                      ) : null}
                    </td>

                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => onSave(r.trade_id)}
                        disabled={isSaving}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.18)",
                          background: isSaving ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.12)",
                          color: "inherit",
                          cursor: isSaving ? "not-allowed" : "pointer",
                          fontWeight: 900,
                        }}
                      >
                        {isSaving ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}
