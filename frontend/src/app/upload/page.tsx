"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

import Header from "../../componets/Header_bar/Header_bar";
import Footer from "../../componets/Footer/Footer";
import { BRAND_NAME, LINKS } from "../../lib/site";
import { apiGet, apiPost, apiPostForm } from "../../lib/api";
import {
  gateUploadPage,
  type UploadKey,
  type UploadResp,
  type ResearchFileItem,
  type EquityCurveResp,
  type LatestResp,
  type NewsletterSendResp,
} from "../../lib/upload";

const ENDPOINTS: Record<UploadKey, string> = {
  positions: "/api/ingest/positions",
  performance: "/api/ingest/performance",
  fundamentals: "/api/research/upload/fundamentals",
  factors: "/api/research/upload/factors",
};

const TITLES: Record<UploadKey, string> = {
  positions: "Positions (Holdings Snapshot)",
  performance: "Performance (Balance History)",
  fundamentals: "Fundamentals (Research Data)",
  factors: "Factors (Research Data)",
};

const PURPOSE: Record<UploadKey, string> = {
  positions:
    "Upload your CURRENT holdings snapshot (what you own right now). This feeds the Portfolio holdings table.",
  performance:
    "Upload your balance/equity history over time (ex: Roth Balance by Date). This feeds the Performance charts.",
  fundamentals:
    "Upload your fundamentals export (Seeking Alpha / etc). This feeds the Research table (fundamentals).",
  factors:
    "Upload your factor grades/ratings export (Seeking Alpha / etc). This feeds the Research table (factors).",
};

const EXPECTS: Record<UploadKey, string[]> = {
  positions: [
    "One row per holding/ticker (ex: VOO, QQQ, AAPL).",
    "Common columns: Symbol/Ticker + Quantity/Shares (+ optional Price/Value).",
    "NOT a file that looks like: Date, Roth Balance, Dollar Change.",
  ],
  performance: [
    "Balance history over time (many dates).",
    "Common columns: Date + Balance/Equity/Total (ex: Roth Balance).",
    "This IS where Roth Balance files go.",
  ],
  fundamentals: ["Fundamentals export (CSV or XLSX) used by Research."],
  factors: ["Factors/grades export (CSV or XLSX) used by Research."],
};

const ACCEPT =
  ".csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const EXAMPLES: Record<UploadKey, string> = {
  positions: 'Example file: "Holdings.csv" with columns like: Symbol, Shares, Price, Value',
  performance:
    'Example file: "Roth_Balance_History.csv" with columns like: Date, Roth Balance (and maybe Dollar Change)',
  fundamentals: 'Example file: "SA_Fundamentals_YYYY-MM-DD.csv" (export)',
  factors: 'Example file: "SA_Factors_YYYY-MM-DD.csv" (export)',
};

function pickMsg(x: unknown): string {
  if (!x || typeof x !== "object") return "Request failed.";
  const o = x as Record<string, any>;

  if (Array.isArray(o.detail)) {
    const first = o.detail[0];
    const loc = Array.isArray(first?.loc) ? first.loc.join(".") : "request";
    const msg = first?.msg || "Validation error";
    return `${msg} (${loc})`;
  }

  if (o.detail && typeof o.detail === "object" && typeof o.detail.error === "string") {
    return o.detail.error;
  }

  return (
    (typeof o.detail === "string" && o.detail) ||
    (typeof o.error === "string" && o.error) ||
    (typeof o.message === "string" && o.message) ||
    "Request failed."
  );
}

function safeDate(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function needsAsOf(kind: UploadKey): boolean {
  return kind === "positions" || kind === "fundamentals" || kind === "factors";
}

function prettyFileName(name: string) {
  if (name.length <= 44) return name;
  return name.slice(0, 26) + "…" + name.slice(-14);
}

function pickTs(x: ResearchFileItem): string | null {
  return (
    safeDate(x.as_of) ||
    safeDate(x.uploaded_at) ||
    safeDate(x.updated_at) ||
    safeDate(x.created_at) ||
    null
  );
}

function pickName(x: ResearchFileItem): string | null {
  const n = x.name || x.filename || x.stored_as || x.key;
  return typeof n === "string" && n.trim().length ? n : null;
}

function matchResearchKind(item: ResearchFileItem, want: UploadKey): boolean {
  const k = String(item.kind ?? item.type ?? "").toLowerCase();
  const n = String(item.name ?? item.filename ?? item.stored_as ?? item.key ?? "").toLowerCase();
  if (want === "fundamentals") return k.includes("fund") || n.includes("fund");
  if (want === "factors") return k.includes("factor") || n.includes("factor");
  return false;
}

export default function UploadPage() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await gateUploadPage({
        loginPath: "/login",
        forbiddenPath: "/portfolio",
      });
      setAllowed(ok);
    })();
  }, []);

  const fileInputs: Record<UploadKey, React.RefObject<HTMLInputElement | null>> = {
    positions: useRef<HTMLInputElement | null>(null),
    performance: useRef<HTMLInputElement | null>(null),
    fundamentals: useRef<HTMLInputElement | null>(null),
    factors: useRef<HTMLInputElement | null>(null),
  };

  const keys = useMemo(
    () => ["positions", "performance", "fundamentals", "factors"] as UploadKey[],
    []
  );

  const [busy, setBusy] = useState<UploadKey | "newsletter" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [last, setLast] = useState<Record<UploadKey, { date?: string; file?: string }>>({
    positions: {},
    performance: {},
    fundamentals: {},
    factors: {},
  });

  const [selected, setSelected] = useState<Record<UploadKey, { name?: string; file?: File }>>({
    positions: {},
    performance: {},
    fundamentals: {},
    factors: {},
  });

  const [asOf, setAsOf] = useState<Record<UploadKey, string>>({
    positions: todayIso(),
    performance: todayIso(),
    fundamentals: todayIso(),
    factors: todayIso(),
  });

  const [nlSubject, setNlSubject] = useState("");
  const [nlBody, setNlBody] = useState("");
  const [nlTestEmail, setNlTestEmail] = useState("");
  const [nlLastSent, setNlLastSent] = useState<string | null>(null);

  function ensureIso(d: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("as_of must be YYYY-MM-DD");
  }

  function buildUploadUrl(kind: UploadKey): string {
    const base = ENDPOINTS[kind];
    if (!needsAsOf(kind)) return base;
    const d = asOf[kind];
    ensureIso(d);
    return `${base}?as_of=${encodeURIComponent(d)}`;
  }

  async function refreshStatus() {
    const next: Record<UploadKey, { date?: string; file?: string }> = {
      positions: {},
      performance: {},
      fundamentals: {},
      factors: {},
    };

    try {
      const latest = await apiGet<LatestResp>("/api/latest");
      const d = safeDate(latest?.snapshot_as_of);
      if (d) next.positions = { date: d, file: "snapshot" };
    } catch {}

    try {
      const eq = await apiGet<EquityCurveResp>("/api/portfolio/equity-curve?window=1");
      const lastPoint =
        Array.isArray(eq?.series) && eq.series.length ? eq.series[eq.series.length - 1] : null;
      const d = safeDate(lastPoint?.date);
      if (d) next.performance = { date: d, file: "equity curve" };
    } catch {}

    try {
      const files = await apiGet<ResearchFileItem[]>("/api/research/files");
      if (Array.isArray(files)) {
        const pickNewest = (want: UploadKey) => {
          const matches = files.filter((x) => matchResearchKind(x, want));
          let best: ResearchFileItem | null = null;
          let bestTs = "";

          for (const m of matches) {
            const ts = pickTs(m) ?? "";
            if (!best || ts > bestTs) {
              best = m;
              bestTs = ts;
            }
          }

          if (best) {
            const dt = pickTs(best) ?? undefined;
            const nm = pickName(best) ?? undefined;
            next[want] = { date: dt, file: nm };
          }
        };

        pickNewest("fundamentals");
        pickNewest("factors");
      }
    } catch {}

    setLast(next);
  }

  useEffect(() => {
    if (!allowed) return;
    refreshStatus();
  }, [allowed]);

  async function upload(kind: UploadKey) {
    const file = selected[kind]?.file;
    if (!file) {
      setErr(`Pick a file first for ${TITLES[kind]}.`);
      setOk(null);
      return;
    }

    setErr(null);
    setOk(null);
    setBusy(kind);

    try {
      const url = buildUploadUrl(kind);
      const form = new FormData();
      form.append("file", file);

      const data = await apiPostForm<UploadResp>(url, form);

      if (data && typeof data === "object" && (data as any).ok === false) {
        throw new Error(pickMsg(data));
      }

      setOk(
        `${TITLES[kind]} uploaded: ${file.name}${
          needsAsOf(kind) ? ` (as_of ${asOf[kind]})` : ""
        }`
      );
      setSelected((prev) => ({ ...prev, [kind]: {} }));
      await refreshStatus();
    } catch (e: any) {
      const msg =
        (e?.data && typeof e.data === "object" ? pickMsg(e.data) : null) ||
        (e instanceof Error ? e.message : "Upload failed.");
      setErr(msg);
    } finally {
      setBusy(null);
      const input = fileInputs[kind].current;
      if (input) input.value = "";
    }
  }

  async function sendNewsletter(mode: "test" | "list") {
    setErr(null);
    setOk(null);
    setBusy("newsletter");

    try {
      const subject = nlSubject.trim();
      const body = nlBody.trim();

      if (!subject) throw new Error("Newsletter subject is required.");
      if (!body) throw new Error("Newsletter message is required.");

      const payload: any = { subject, body, mode };
      if (mode === "test") {
        const to = nlTestEmail.trim();
        if (!to) throw new Error("Enter a test email first.");
        payload.test_email = to;
      }

      const resp = await apiPost<NewsletterSendResp>("/api/admin/newsletter/send", payload);

      if (resp && typeof resp === "object" && (resp as any).ok === false) {
        throw new Error(pickMsg(resp));
      }

      const sent = (resp as any)?.sent;
      const skipped = (resp as any)?.skipped;

      setNlLastSent(new Date().toISOString());
      setOk(
        mode === "test"
          ? "Test email sent."
          : `Newsletter sent.${typeof sent === "number" ? ` Sent: ${sent}.` : ""}${
              typeof skipped === "number" ? ` Skipped: ${skipped}.` : ""
            }`
      );
    } catch (e: any) {
      const msg =
        (e?.data && typeof e.data === "object" ? pickMsg(e.data) : null) ||
        (e instanceof Error ? e.message : "Newsletter send failed.");
      setErr(msg);
    } finally {
      setBusy(null);
    }
  }

  function onPickClick(kind: UploadKey) {
    if (busy) return;
    fileInputs[kind].current?.click();
  }

  function onChange(kind: UploadKey, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelected((prev) => ({ ...prev, [kind]: { file: f, name: f.name } }));
    setErr(null);
    setOk(null);
  }

  function clearPick(kind: UploadKey) {
    if (busy) return;
    setSelected((prev) => ({ ...prev, [kind]: {} }));
    const input = fileInputs[kind].current;
    if (input) input.value = "";
  }

  if (!allowed) return null;

  return (
    <div className={styles.page}>
      <Header brand={BRAND_NAME} links={[...LINKS]} />

      <main className={styles.main}>
        <div className={styles.wrap}>
          <div className={styles.top}>
            <div>
              <h1 className={styles.h1}>Admin Upload Center</h1>
              <p className={styles.sub}>
                Upload the right file to the right section.{" "}
                <span className={styles.mono}>Positions</span> = current holdings.{" "}
                <span className={styles.mono}>Performance</span> = balance history over time.
              </p>
            </div>

            <div className={styles.topRight}>
              <button
                className={styles.refreshBtn}
                type="button"
                onClick={refreshStatus}
                disabled={!!busy}
              >
                Refresh status
              </button>
              <a className={styles.backBtn} href="/portfolio">
                Back to portfolio →
              </a>
            </div>
          </div>

          {(err || ok) && (
            <div className={err ? styles.alertErr : styles.alertOk}>
              <div className={styles.alertTitle}>{err ? "Action failed" : "Success"}</div>
              <div className={styles.alertMsg}>{err ?? ok}</div>
            </div>
          )}

          <div className={styles.grid}>
            {keys.map((k) => {
              const isBusy = busy === k;
              const lastDate = last[k]?.date;
              const lastFile = last[k]?.file;
              const pickedName = selected[k]?.name;

              return (
                <section key={k} className={styles.card} aria-label={TITLES[k]}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>{TITLES[k]}</div>

                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.pickBtn}
                        onClick={() => onPickClick(k)}
                        disabled={!!busy}
                      >
                        Choose file
                      </button>

                      <button
                        type="button"
                        className={styles.uploadBtn}
                        onClick={() => upload(k)}
                        disabled={!!busy || !selected[k]?.file}
                      >
                        {isBusy ? "Uploading…" : "Upload"}
                      </button>
                    </div>
                  </div>

                  <div className={styles.cardPurpose}>{PURPOSE[k]}</div>

                  <div className={styles.section}>
                    <div className={styles.sectionLabel}>What to upload</div>
                    <div className={styles.sectionValue}>
                      <span className={styles.mono}>{EXAMPLES[k]}</span>
                    </div>
                  </div>

                  {needsAsOf(k) && (
                    <div className={styles.section}>
                      <div className={styles.sectionLabel}>As-of date (required)</div>
                      <div
                        className={styles.sectionValue}
                        style={{ display: "flex", gap: 12, alignItems: "center" }}
                      >
                        <input
                          type="date"
                          value={asOf[k]}
                          onChange={(e) => {
                            setAsOf((prev) => ({ ...prev, [k]: e.target.value }));
                            setErr(null);
                            setOk(null);
                          }}
                          disabled={!!busy}
                          className={styles.mono}
                          aria-label={`${TITLES[k]} as_of date`}
                        />
                        <span className={styles.dim}>
                          sent as <span className={styles.mono}>?as_of=YYYY-MM-DD</span>
                        </span>
                      </div>
                    </div>
                  )}

                  <div className={styles.pickerRow}>
                    <div className={styles.pickerLeft}>
                      <div className={styles.pickerLabel}>Selected file</div>
                      <div className={styles.pickerValue}>
                        {pickedName ? (
                          <>
                            <span className={styles.mono}>{prettyFileName(pickedName)}</span>
                            <span className={styles.sep}>•</span>
                            <span className={styles.dim}>Ready to upload</span>
                          </>
                        ) : (
                          <span className={styles.dim}>No file selected</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.clearBtn}
                      onClick={() => clearPick(k)}
                      disabled={!!busy || !selected[k]?.file}
                      aria-label={`Clear selected file for ${TITLES[k]}`}
                    >
                      Clear
                    </button>
                  </div>

                  <div className={styles.section}>
                    <div className={styles.sectionLabel}>Last upload</div>
                    <div className={styles.sectionValue}>
                      {lastDate ? (
                        <>
                          <span className={styles.strong}>{lastDate}</span>
                          {lastFile ? (
                            <>
                              <span className={styles.sep}>•</span>
                              <span className={styles.mono}>
                                {prettyFileName(lastFile)}
                              </span>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <span className={styles.dim}>No data found yet</span>
                      )}
                    </div>
                  </div>

                  <div className={styles.metaRow}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Endpoint</span>
                      <span className={styles.mono}>
                        {ENDPOINTS[k]}
                        {needsAsOf(k) ? "?as_of=…" : ""}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Expected format</span>
                      <span className={styles.mono}>{EXPECTS[k].join(" • ")}</span>
                    </div>
                  </div>

                  <input
                    ref={fileInputs[k]}
                    className={styles.hiddenInput}
                    type="file"
                    accept={ACCEPT}
                    onChange={(e) => onChange(k, e)}
                  />
                </section>
              );
            })}

            <section className={styles.card} aria-label="Newsletter">
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>Newsletter</div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.pickBtn}
                    onClick={() => sendNewsletter("test")}
                    disabled={!!busy}
                    title="Sends only to the test email address"
                  >
                    Send test
                  </button>
                  <button
                    type="button"
                    className={styles.uploadBtn}
                    onClick={() => sendNewsletter("list")}
                    disabled={!!busy}
                    title="Sends to the whole subscriber list"
                  >
                    {busy === "newsletter" ? "Sending…" : "Send to list"}
                  </button>
                </div>
              </div>

              <div className={styles.cardPurpose}>
                Send an email blast to your subscriber list (admin-only). Uses a backend email provider.
              </div>

              <div className={styles.section}>
                <div className={styles.sectionLabel}>Subject</div>
                <div className={styles.sectionValue} style={{ width: "100%" }}>
                  <input
                    value={nlSubject}
                    onChange={(e) => {
                      setNlSubject(e.target.value);
                      setErr(null);
                      setOk(null);
                    }}
                    disabled={!!busy}
                    placeholder="Weekly update: New positions + performance recap"
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      padding: "10px 12px",
                      border: "1px solid rgba(255,255,255,0.16)",
                      background: "rgba(255,255,255,0.03)",
                      color: "rgba(255,255,255,0.92)",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionLabel}>Message</div>
                <div className={styles.sectionValue} style={{ width: "100%" }}>
                  <textarea
                    value={nlBody}
                    onChange={(e) => {
                      setNlBody(e.target.value);
                      setErr(null);
                      setOk(null);
                    }}
                    disabled={!!busy}
                    placeholder="Write your newsletter here..."
                    rows={8}
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      padding: "10px 12px",
                      border: "1px solid rgba(255,255,255,0.16)",
                      background: "rgba(255,255,255,0.03)",
                      color: "rgba(255,255,255,0.92)",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionLabel}>Test email (optional)</div>
                <div
                  className={styles.sectionValue}
                  style={{ width: "100%", display: "flex", gap: 10 }}
                >
                  <input
                    value={nlTestEmail}
                    onChange={(e) => {
                      setNlTestEmail(e.target.value);
                      setErr(null);
                      setOk(null);
                    }}
                    disabled={!!busy}
                    placeholder="you@example.com"
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      padding: "10px 12px",
                      border: "1px solid rgba(255,255,255,0.16)",
                      background: "rgba(255,255,255,0.03)",
                      color: "rgba(255,255,255,0.92)",
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ marginTop: 8 }} className={styles.dim}>
                  “Send test” sends only to this email. “Send to list” emails all subscribers.
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionLabel}>Last sent</div>
                <div className={styles.sectionValue}>
                  {nlLastSent ? (
                    <span className={styles.mono}>{nlLastSent}</span>
                  ) : (
                    <span className={styles.dim}>—</span>
                  )}
                </div>
              </div>

              <div className={styles.note}>
                Backend: <span className={styles.mono}>POST /api/admin/newsletter/send</span>
              </div>
            </section>
          </div>

          <div className={styles.note}>
            Admin-only. Uses cookies for auth. If you see a <span className={styles.mono}>401</span>, log in as admin.
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}