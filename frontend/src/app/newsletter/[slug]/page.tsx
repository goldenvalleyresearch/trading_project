import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatShortDate } from "../../../lib/date";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type PageProps = {
  params: { slug: string };
};

export default async function NewsletterPost({ params }: PageProps) {
  const slug = params?.slug;

  if (!slug) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-white">
        <h1 className="text-2xl font-bold">Unable to load newsletter</h1>
        <p className="mt-4 text-red-300">
          Missing slug param. Check route folder: src/app/newsletter/[slug]/page.tsx
        </p>
      </main>
    );
  }

  if (!API) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-white">
        <h1 className="text-2xl font-bold">Unable to load newsletter</h1>
        <p className="mt-4 text-red-300">
          Missing NEXT_PUBLIC_API_BASE_URL in Vercel env vars.
        </p>
      </main>
    );
  }

  const url = `${API}/api/newsletter/posts/${encodeURIComponent(slug)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-white">
        <h1 className="text-2xl font-bold">Unable to load newsletter</h1>
        <p className="mt-4 text-gray-300">
          Slug: <span className="font-mono">{slug}</span>
        </p>
        <p className="mt-2 text-gray-300">
          URL: <span className="font-mono break-all">{url}</span>
        </p>
        <p className="mt-4 text-red-300 whitespace-pre-wrap">
          Fetch failed ({res.status}): {t}
        </p>
      </main>
    );
  }

  const post = await res.json();

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
