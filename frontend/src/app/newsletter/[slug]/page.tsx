// src/app/newsletter/[slug]/page.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatShortDate } from "../../../lib/date";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

export default async function NewsletterPost({ params }: any) {
  if (!API) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-white">
        <h1 className="text-2xl font-bold">Newsletter</h1>
        <p className="mt-4 text-gray-300">
          Missing NEXT_PUBLIC_API_BASE_URL in Vercel environment variables.
        </p>
      </main>
    );
  }

  const url = `${API}/api/newsletter/posts/${encodeURIComponent(params.slug)}`;

  let post: any = null;
  let errorText = "";

  try {
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      errorText = `Fetch failed (${res.status})`;
      const t = await res.text().catch(() => "");
      if (t) errorText += `: ${t.slice(0, 300)}`;
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
          Slug: <span className="font-mono">{params.slug}</span>
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
