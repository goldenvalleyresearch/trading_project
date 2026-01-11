// app/upload/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

import Header from "../../componets/UI/Header_bar/Header_bar";
import Footer from "../../componets/UI/Footer/Footer";
import UploadCard from "@/componets/Sections/Upload/UploadCard/UploadCard";
import NewsletterCard from "@/componets/Sections/Upload/NewsletterCard/NewsletterCard";

import { BRAND_NAME, LINKS } from "../../lib/site";
import { apiGet, apiPost } from "../../lib/api";

import {
  gateUploadPage,
  uploadPositions,
  uploadPerformance,
  uploadResearchFile,
  prettyApiError,
  type UploadKey,
  type ResearchFileItem,
  type EquityCurveResp,
  type LatestResp,
  type NewsletterSendResp,
} from "./upload";

const ACCEPT =
  ".csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const KEYS = ["positions", "performance",
   //"fundamentals", "factors"
  ] as UploadKey[];

const CONFIG: Record<
  UploadKey,
  {
    title: string;
    purpose: string;
    expects: string[];
    example: string;
    needsAsOf: boolean;
    endpointLabel: string;
  }
> = {
  positions: {
    title: "Positions (Holdings Snapshot)",
    purpose:
      "Upload your CURRENT holdings snapshot (what you own right now). This feeds the Portfolio holdings table.",
    expects: [
      "One row per holding/ticker (ex: VOO, QQQ, AAPL).",
      "Common columns: Symbol/Ticker + Quantity/Shares (+ optional Price/Value).",
      "NOT a file that looks like: Date, Roth Balance, Dollar Change.",
    ],
    example: 'Example file: "Holdings.csv" with columns like: Symbol, Shares, Price, Value',
    needsAsOf: true,
    endpointLabel: "/api/ingest/positions?as_of=YYYY-MM-DD",
  },
  performance: {
    title: "Performance (Balance History)",
    purpose:
      "Upload your balance/equity history over time (ex: Roth Balance by Date). This feeds the Performance charts.",
    expects: [
      "Balance history over time (many dates).",
      "Common columns: Date + Balance/Equity/Total (ex: Roth Balance).",
      "This IS where Roth Balance files go.",
    ],
    example:
      'Example file: "Roth_Balance_History.csv" with columns like: Date, Roth Balance (and maybe Dollar Change)',
    needsAsOf: false,
    endpointLabel: "/api/ingest/performance",
  },
  fundamentals: {
    title: "Fundamentals (Research Data)",
    purpose:
      "Upload your fundamentals export (Seeking Alpha / etc). This feeds the Research table (fundamentals).",
    expects: ["Fundamentals export (CSV or XLSX) used by Research."],
    example: 'Example file: "SA_Fundamentals_YYYY-MM-DD.csv" (export)',
    needsAsOf: true,
    endpointLabel: "/api/research/upload/fundamentals?as_of=YYYY-MM-DD",
  },
  factors: {
    title: "Factors (Research Data)",
    purpose:
      "Upload your factor grades/ratings export (Seeking Alpha / etc). This feeds the Research table (factors).",
    expects: ["Factors/grades export (CSV or XLSX) used by Research."],
    example: 'Example file: "SA_Factors_YYYY-MM-DD.csv" (export)',
    needsAsOf: true,
    endpointLabel: "/api/research/upload/factors?as_of=YYYY-MM-DD",
  },
};

type LastInfo = { date?: string; file?: string };


function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeDate(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
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

function matchResearchKind(item: ResearchFileItem, want: "fundamentals" | "factors"): boolean {
  const k = String(item.kind ?? item.type ?? "").toLowerCase();
  const n = String(item.name ?? item.filename ?? item.stored_as ?? item.key ?? "").toLowerCase();
  if (want === "fundamentals") return k.includes("fund") || n.includes("fund");
  return k.includes("factor") || n.includes("factor");
}

export default function UploadPage() {
  const keys = useMemo(() => KEYS, []);
  const [allowed, setAllowed] = useState(false);

  const [busy, setBusy] = useState<UploadKey | "newsletter" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [last, setLast] = useState<Record<UploadKey, LastInfo>>({
    positions: {},
    performance: {},
    fundamentals: {},
    factors: {},
  });

  const [selected, setSelected] = useState<Record<UploadKey, { file?: File; name?: string }>>({
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

  const fileInputs: Record<UploadKey, React.RefObject<HTMLInputElement | null>> = {
    positions: useRef<HTMLInputElement | null>(null),
    performance: useRef<HTMLInputElement | null>(null),
    fundamentals: useRef<HTMLInputElement | null>(null),
    factors: useRef<HTMLInputElement | null>(null),
  };

  useEffect(() => {
    (async () => {
      const ok = await gateUploadPage({ loginPath: "/login", forbiddenPath: "/portfolio" });
      setAllowed(ok);
    })();
  }, []);

  function clearPick(kind: UploadKey) {
    setSelected((p) => ({ ...p, [kind]: {} }));
    const input = fileInputs[kind].current;
    if (input) input.value = "";
  }

  function onPickClick(kind: UploadKey) {
    if (busy) return;
    fileInputs[kind].current?.click();
  }

  function onFileChange(kind: UploadKey, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelected((p) => ({ ...p, [kind]: { file: f, name: f.name } }));
    setErr(null);
    setOk(null);
  }

  async function refreshStatus() {
    const next: Record<UploadKey, LastInfo> = {
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
      const series = eq?.series;
      const lastPoint = Array.isArray(series) && series.length ? series[series.length - 1] : null;
      const d = safeDate(lastPoint?.date);
      if (d) next.performance = { date: d, file: "equity curve" };
    } catch {}

    try {
      const files = await apiGet<ResearchFileItem[]>("/api/research/files");
      if (Array.isArray(files)) {
        const newest = (want: "fundamentals" | "factors"): LastInfo => {
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
          if (!best) return {};
          return { date: pickTs(best) ?? undefined, file: pickName(best) ?? undefined };
        };

        next.fundamentals = newest("fundamentals");
        next.factors = newest("factors");
      }
    } catch {}

    setLast(next);
  }

  useEffect(() => {
    if (!allowed) return;
    refreshStatus();
  }, [allowed]);

  async function runUpload(kind: UploadKey) {
    const file = selected[kind]?.file;
    if (!file) {
      setErr(`Pick a file first for ${CONFIG[kind].title}.`);
      setOk(null);
      return;
    }

    setBusy(kind);
    setErr(null);
    setOk(null);

    try {
      if (kind === "positions") {
        await uploadPositions({ asOf: asOf.positions, file });
      } else if (kind === "performance") {
        await uploadPerformance({ file });
      } else if (kind === "fundamentals") {
        await uploadResearchFile({ kind: "fundamentals", asOf: asOf.fundamentals, file });
      } else {
        await uploadResearchFile({ kind: "factors", asOf: asOf.factors, file });
      }

      setOk(
        `${CONFIG[kind].title} uploaded: ${file.name}${
          CONFIG[kind].needsAsOf ? ` (as_of ${asOf[kind]})` : ""
        }`
      );

      clearPick(kind);
      await refreshStatus();
    } catch (e) {
      setErr(prettyApiError(e));
    } finally {
      setBusy(null);
    }
  }

  async function sendNewsletter(mode: "test" | "list") {
    setBusy("newsletter");
    setErr(null);
    setOk(null);

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
        throw new Error((resp as any).message || (resp as any).error || "Newsletter send failed.");
      }

      setNlLastSent(new Date().toISOString());

      const sent = (resp as any)?.sent;
      const skipped = (resp as any)?.skipped;

      setOk(
        mode === "test"
          ? "Test email sent."
          : `Newsletter sent.${typeof sent === "number" ? ` Sent: ${sent}.` : ""}${
              typeof skipped === "number" ? ` Skipped: ${skipped}.` : ""
            }`
      );
    } catch (e: any) {
      setErr(e instanceof Error ? e.message : prettyApiError(e));
    } finally {
      setBusy(null);
    }
  }


  useEffect(() => {
  if (!err && !ok) return;
  window.scrollTo({ top: 0, behavior: "smooth" });
}, [err, ok]);

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
                <span className={styles.mono}>Positions</span> = current holdings.{" "}
                <span className={styles.mono}>Performance</span> = balance history.
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

          <div className={styles.newsletterFull}>
            <NewsletterCard
              busy={busy}
              subject={nlSubject}
              body={nlBody}
              testEmail={nlTestEmail}
              lastSent={nlLastSent}
              onChangeSubject={(v) => {
                setNlSubject(v);
                setErr(null);
                setOk(null);
              }}
              onChangeBody={(v) => {
                setNlBody(v);
                setErr(null);
                setOk(null);
              }}
              onChangeTestEmail={(v) => {
                setNlTestEmail(v);
                setErr(null);
                setOk(null);
              }}
              onSendTest={() => sendNewsletter("test")}
              onSendList={() => sendNewsletter("list")}
            />
          </div>

          <div className={styles.grid}>
            {keys.map((k) => (
              <UploadCard
                key={k}
                k={k}
                title={CONFIG[k].title}
                purpose={CONFIG[k].purpose}
                expects={CONFIG[k].expects}
                example={CONFIG[k].example}
                endpoint={CONFIG[k].endpointLabel}
                accept={ACCEPT}
                busy={busy}
                isBusy={busy === k}
                needsAsOf={CONFIG[k].needsAsOf}
                asOfValue={asOf[k]}
                onAsOfChange={(next) => {
                  setAsOf((p) => ({ ...p, [k]: next }));
                  setErr(null);
                  setOk(null);
                }}
                lastInfo={last[k]}
                selectedInfo={selected[k]}
                prettyFileName={prettyFileName}
                onPickClick={() => onPickClick(k)}
                onUpload={() => runUpload(k)}
                onClearPick={() => clearPick(k)}
                inputRef={fileInputs[k]}
                onFileChange={(e) => onFileChange(k, e)}
              />
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}