// app/newsletter/archive/page.tsx
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

function wrapDoc(html: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<base target="_blank">
<style>
  body{margin:0;padding:18px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
  img{max-width:100%;height:auto}
  a{color:#2563eb}
</style>
</head>
<body>${html}</body>
</html>`;
}

export default function NewsletterArchivePage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<NewsletterListItem[]>([]);
  const [selected, setSelected] = useState<NewsletterListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await listNewsletters({ limit: 75, q: "" });
        if (!alive) return;
        setItems(res.items);
        setSelected(res.items[0] ?? null);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load newsletters");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
              <p className={styles.sub}>
                Browse past sends pulled from the database. Search, click, and read.
              </p>
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

                  <div className={styles.readerActions}>
                    <button
                      type="button"
                      className={styles.smallBtn}
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const res = await listNewsletters({ limit: 75, q: "" });
                          setItems(res.items);
                          setSelected((cur) => {
                            if (!cur) return res.items[0] ?? null;
                            return res.items.find((x) => x.id === cur.id) ?? res.items[0] ?? null;
                          });
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                <div className={styles.paper}>
                  {selectedHtml ? (
                    <div className={styles.htmlWrap}>
                      <iframe
                        title="newsletter"
                        className={styles.iframe}
                        sandbox="allow-same-origin"
                        srcDoc={wrapDoc(selectedHtml)}
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