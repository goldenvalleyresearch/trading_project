// src/app/newsletter/[slug]/page.tsx

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { headers } from "next/headers";
import { formatShortDate } from "../../../lib/date";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type PageProps = {
  params?: { slug?: string };
};

async function getSlugFallbackFromPath(): Promise<string | null> {
  try {
    const h = await headers();

    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? "https";

    const originalUrl =
      h.get("x-original-url") ||
      h.get("x-rewrite-url") ||
      h.get("x-next-url") ||
      "";

    if (originalUrl) {
      const u = new URL(originalUrl, `${proto}://${host}`);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "newsletter" && parts[1]) return parts[1];
    }

    const ref = h.get("referer");
    if (ref) {
      const u = new URL(ref);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "newsletter" && parts[1]) return parts[1];
    }
  } catch {
    // ignore
  }

  return null;
}

export default async function NewsletterPost({ params }: PageProps) {
  const slug = params?.slug ?? (await getSlugFallbackFromPath());

  if (!slug) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-white">
        <h1 className="text-2xl font-bold">Unable to load newsletter</h1>
        <p className="mt-4 text-red-300">
          Missing slug param. Route matched, but slug could not be resolved.
        </p>
      </main>
    );
  }

  if (!API) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-white">
        <h1 className="text-2xl font-bold">Unable to load newsletter</h1>
        <p className="mt-4 text-red-300">
          NEXT_PUBLIC_API_BASE_URL is not defined in Vercel.
        </p>
      </main>
    );
  }

  const url = `${API}/api/newsletter/posts/${encodeURIComponent(slug)}`;

  let post: any = null;
  let errorText = "";

  try {
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      errorText = `Fetch failed (${res.status}): ${t || "No body"}`;
    } else {
      post = await res.json();
    }
  } catch (e: any) {
    errorText = e?.message || String(e);
  }

  if (!post) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-white">
        <h1 className="text-2xl font-bold">Unable to load newsletter</h1>
        <p className="mt-4 text-gray-300">
          Slug: <span className="font-mono">{slug}</span>
        </p>
        <p className="mt-2 text-gray-300">
          URL: <span className="font-mono break-all">{url}</span>
        </p>
        <p className="mt-4 text-red-300 whitespace-pre-wrap">{errorText}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-white">
      <h1 className="text-3xl font-bold mb-2">{post.title}</h1>

      <div className="text-sm text-gray-400 mb-8">
        {formatShortDate(post.created_at)}
      </div>

      <article className="prose prose-lg max-w-none prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.content_md ?? ""}
        </ReactMarkdown>
      </article>
    </main>
  );
}
