"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Post = {
  title: string;
  slug: string;
  kind: string;
  content_md: string;
  created_at: string;
};

function normalizeBullets(md: string): string {
  return (md || "")
    .replace(/^\s*•\s+/gm, "- ")
    .replace(/^\s*o\s+/gm, "  - ");
}

function normalizeKind(kind: string) {
  return (kind || "")
    .toLowerCase()
    .trim()
    .replace(/[\s\-_]+/g, "");
}

function formatDate(iso: string) {
  const t = Date.parse(iso || "");
  if (!t) return "";
  return new Date(t).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function seriesLabelFromKind(kind: string) {
  const k = normalizeKind(kind);
  if (
    k === "premarket" ||
    k === "am" ||
    k === "morning" ||
    k === "setup" ||
    k === "afterhours" ||
    k === "pm" ||
    k === "wrap" ||
    k === "close" ||
    k === "postclose"
  )
    return "The Setup & The Wrap";
  if (k === "monthly" || k === "monthlypnl" || k === "macro") return "Monthly P&L + Macro";
  if (k === "score" || k === "todayscore") return "Today’s Score";
  return "Newsletter";
}

function ampm(kind: string) {
  const k = normalizeKind(kind);
  if (k === "premarket" || k === "am") return "AM";
  if (k === "afterhours" || k === "pm" || k === "close" || k === "postclose") return "PM";
  return "";
}

export default function NewsletterPostPage() {
  const params = useParams();
  const pathname = usePathname();

  const slug = useMemo(() => {
    const p = (params as any)?.slug;
    if (typeof p === "string" && p.length) return p;

    const parts = (pathname || "").split("/").filter(Boolean);
    if (parts[0] === "newsletter" && parts[1]) return parts[1];

    return "";
  }, [params, pathname]);

  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError("");
      setPost(null);

      if (!API) {
        setError("NEXT_PUBLIC_API_BASE_URL is not defined in Vercel.");
        return;
      }
      if (!slug) {
        setError("Missing slug in URL.");
        return;
      }

      const url = `${API}/api/newsletter/posts/${encodeURIComponent(slug)}`;

      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`Fetch failed (${res.status}): ${t || "No body"}`);
        }
        const j = (await res.json()) as Post;

        if (!cancelled) setPost(j);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <main className="min-h-screen bg-[#070a10] text-white">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <Link
            href="/newsletter"
            className="text-sm underline underline-offset-4 decoration-white/25 hover:decoration-white/60 visited:text-white"
          >
            Back to newsletters
          </Link>

          <h1 className="mt-6 text-2xl font-semibold">Unable to load newsletter</h1>
          <p className="mt-3 text-sm text-white/70">
            Slug: <span className="font-mono text-white">{slug || "(empty)"}</span>
          </p>
          <pre className="mt-5 whitespace-pre-wrap rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </pre>
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="min-h-screen bg-[#070a10] text-white">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="mt-8 h-10 w-3/4 rounded bg-white/10" />
          <div className="mt-3 h-4 w-1/3 rounded bg-white/10" />
          <div className="mt-10 space-y-3">
            <div className="h-4 w-full rounded bg-white/10" />
            <div className="h-4 w-11/12 rounded bg-white/10" />
            <div className="h-4 w-10/12 rounded bg-white/10" />
          </div>
        </div>
      </main>
    );
  }

  const series = seriesLabelFromKind(post.kind);
  const stamp = [formatDate(post.created_at), ampm(post.kind)].filter(Boolean).join(" • ");

  return (
    <main className="min-h-screen bg-[#070a10] text-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/newsletter"
            className="text-sm underline underline-offset-4 decoration-white/25 hover:decoration-white/60 visited:text-white"
          >
            Back
          </Link>

          <span className="text-xs text-white/60">{series}</span>
        </div>

        <header className="mt-10">
          <div className="text-xs text-white/60">{stamp}</div>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">
            {post.title}
          </h1>
          <div className="mt-6 h-px w-full bg-white/10" />
        </header>

        <article
          className="
            mt-8
            prose prose-invert prose-lg max-w-none
            prose-headings:scroll-mt-24
            prose-a:text-white prose-a:underline prose-a:decoration-white/30 hover:prose-a:decoration-white/70
            prose-strong:text-white
            prose-hr:border-white/10
            prose-blockquote:border-white/20 prose-blockquote:text-white/80
            prose-li:marker:text-white/40
            prose-code:text-white prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10
            prose-table:text-white/90
          "
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: (props) => <h2 className="mt-10" {...props} />,
              h3: (props) => <h3 className="mt-8" {...props} />,
              table: (props) => (
                <div className="overflow-x-auto">
                  <table {...props} />
                </div>
              ),
            }}
          >
            {normalizeBullets(post.content_md ?? "")}
          </ReactMarkdown>
        </article>

        <footer className="mt-14 border-t border-white/10 pt-8 text-sm text-white/60">
          <div className="flex items-center justify-between gap-4">
            <span>Golden Valley Market Research</span>
            <Link
              href="/newsletter"
              className="underline underline-offset-4 decoration-white/25 hover:decoration-white/60 visited:text-white"
            >
              Back to archive
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
