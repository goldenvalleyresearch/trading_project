"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

import Header from "@/componets/UI/Header_bar/Header_bar";
import Footer from "@/componets/UI/Footer/Footer";
import { BRAND_NAME, LINKS } from "@/lib/site";

import { listNewsletters, type NewsletterListItem } from "./newsletter";

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (!Number.isFinite(dt.getTime())) return String(d);
  return dt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stripHtml(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeEmailHtml(html: string) {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "")
    .replace(/<form[\s\S]*?>[\s\S]*?<\/form>/gi, "")
    .replace(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*>/gi, "")
    .replace(/<link[^>]+rel=["']?(preload|prefetch|dns-prefetch|preconnect)["']?[^>]*>/gi, "");
}

function wrapDoc(html: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<base target="_blank">
<style>
  :root{
    color-scheme: dark;
  }
  html,body{height:100%}
  body{
    margin:0;
    padding:20px;
    background: transparent;
    color: rgba(255,255,255,0.92);
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
    line-height: 1.55;
  }

  /* Make email content behave inside your card */
  img{max-width:100%;height:auto}
  table{max-width:100%}
  pre,code{white-space:pre-wrap;word-break:break-word}
  a{color:#7aa8ff}

  /* Optional: if the email has no styling, give it a nice default */
  h1,h2,h3{margin:0.6em 0 0.35em; line-height:1.15}
  p{margin:0.65em 0}
</style>
</head>
<body>${html}</body>
</html>`;
}

const STEP = 75;
const MAX_LIMIT = 200;

export default function NewsletterArchivePage() {
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(STEP);

  const [items, setItems] = useState<NewsletterListItem[]>([]);
  const [selected, setSelected] = useState<NewsletterListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const canLoadMore = limit < MAX_LIMIT && items.length >= limit;

  async function fetchList(nextLimit: number, nextQ: string, keepSelectedId?: string | null) {
    setLoading(true);
    setErr(null);
    try {
      const res = await listNewsletters({ limit: nextLimit, q: nextQ });
      setItems(res.items);
      setSelected((cur) => {
        const want = keepSelectedId ?? cur?.id ?? null;
        if (want) return res.items.find((x) => x.id === want) ?? res.items[0] ?? null;
        return res.items[0] ?? null;
      });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load newsletters");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList(STEP, "", null);
    setLimit(STEP);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setLimit(STEP);
      fetchList(STEP, q, selected?.id ?? null);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((n) => {
      const subj = (n.subject ?? "").toLowerCase();
      const mode = (n.mode ?? "").toLowerCase();
      const body = (n.html ?? n.text ?? "").toLowerCase();
      return subj.includes(term) || mode.includes(term) || body.includes(term);
    });
  }, [items, q]);

  const htmlCandidate =
  (selected?.html && selected.html.trim()) ||
  (selected?.text && /<\/?[a-z][\s\S]*>/i.test(selected.text) ? selected.text.trim() : "");

  useEffect(() => {
    if (!selected && filtered.length) setSelected(filtered[0]);
    if (selected && !filtered.some((x) => x.id === selected.id)) {
      setSelected(filtered[0] ?? null);
    }
  }, [filtered, selected]);

  const selectedHtml = selected?.html ?? "";
  const selectedText = selected?.text ?? "";

  return (
    <div className={styles.page}>
      <Header brand={BRAND_NAME} links={[...LINKS]} />

      <main className={styles.main}>
        <div className={styles.wrap}>
          <div className={styles.top}>
            <div className={styles.titleWrap}>
              <h1 className={styles.h1}>Newsletter Archive</h1>
              <p className={styles.sub}>Browse past sends pulled from the database. Search, click, and read.</p>
            </div>

            <div className={styles.searchWrap}>
              <input
                className={styles.search}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search subject or body…"
                spellCheck={false}
              />
              <div className={styles.meta}>
                {loading ? "Loading…" : err ? "Offline" : `${filtered.length} shown`}
              </div>
            </div>
          </div>

          {err ? (
            <div className={styles.state}>Failed: {err}</div>
          ) : loading && items.length === 0 ? (
            <div className={styles.state}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div className={styles.state}>No newsletters found.</div>
          ) : (
            <div className={styles.layout}>
              <aside className={styles.sidebar}>
                <div className={styles.sidebarTop}>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={() => fetchList(limit, q, selected?.id ?? null)}
                    disabled={loading}
                  >
                    Refresh
                  </button>

                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={() => {
                      const next = Math.min(MAX_LIMIT, limit + STEP);
                      setLimit(next);
                      fetchList(next, q, selected?.id ?? null);
                    }}
                    disabled={loading || !canLoadMore}
                  >
                    Load more
                  </button>

                  <div className={styles.metaSmall}>
                    {items.length} loaded{limit >= MAX_LIMIT ? " (max)" : ""}
                  </div>
                </div>

                {filtered.map((n) => {
                  const active = selected?.id === n.id;
                  const previewSrc = stripHtml(n.html ?? n.text ?? "");
                  return (
                    <button
                      key={n.id}
                      type="button"
                      className={`${styles.item} ${active ? styles.itemActive : ""}`}
                      onClick={() => setSelected(n)}
                    >
                      <div className={styles.itemTop}>
                        <div className={styles.subject}>{n.subject || "Untitled"}</div>
                        <div className={styles.date}>{fmtDate(n.created_at)}</div>
                      </div>
                      <div className={styles.preview}>
                        {previewSrc.slice(0, 140)}
                        {previewSrc.length > 140 ? "…" : ""}
                      </div>
                      <div className={styles.badges}>
                        <span className={styles.badge}>{(n.mode || "live").toUpperCase()}</span>
                        <span className={styles.badgeMuted}>
                          sent {n.sent ?? 0} · skipped {n.skipped ?? 0}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </aside>

              <section className={styles.reader}>
                <div className={styles.readerTop}>
                  <div>
                    <div className={styles.readerTitle}>{selected?.subject || "Untitled"}</div>
                    <div className={styles.readerSub}>
                      <span>{fmtDate(selected?.created_at)}</span>
                      <span className={styles.dot} />
                      <span>{(selected?.mode || "live").toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.paper}>

            {htmlCandidate ? (
              <div className={styles.htmlWrap}>
                <iframe
                  title="newsletter"
                  className={styles.iframe}
                  sandbox="allow-same-origin allow-popups allow-forms"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  srcDoc={wrapDoc(sanitizeEmailHtml(htmlCandidate))}
                />
              </div>
            ) : (
              <div className={styles.text}>{selectedText || "No HTML/text content."}</div>
            )}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}