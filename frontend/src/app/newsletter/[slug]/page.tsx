"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatShortDate } from "../../../lib/date";

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
    // convert "• " bullets to markdown list
    .replace(/^\s*•\s+/gm, "- ")
    // convert "o " nested bullets to markdown nested list
    .replace(/^\s*o\s+/gm, "  - ");
}



export default function NewsletterPostPage() {
  const params = useParams();
  const pathname = usePathname();

  // Primary: useParams() (should work in all normal cases)
  // Backup: parse from pathname (/newsletter/<slug>)
  const slug = useMemo(() => {
    const p = (params as any)?.slug;
    if (typeof p === "string" && p.length) return p;

    const parts = (pathname || "").split("/").filter(Boolean);
    // ["newsletter", "<slug>"]
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
      <main className="mx-auto max-w-3xl px-6 py-12 text-white">
        <h1 className="text-2xl font-bold">Unable to load newsletter</h1>
        <p className="mt-4 text-gray-300">
          Slug: <span className="font-mono">{slug || "(empty)"}</span>
        </p>
        <p className="mt-4 text-red-300 whitespace-pre-wrap">{error}</p>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="mx-auto max-w-4xl px-10 py-12 bg-white text-black font-times">
        <h1 className="text-2xl font-bold">Loading…</h1>
        <p className="mt-4 text-gray-400">
          Fetching newsletter: <span className="font-mono">{slug || "…"}</span>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-10 py-12 bg-white text-black font-times">
      <h1 className="text-3xl font-bold mb-2">{post.title}</h1>

      

      <article className="prose prose-lg max-w-none prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {normalizeBullets(post.content_md ?? "")}
        </ReactMarkdown>

      </article>
    </main>
  );
}
