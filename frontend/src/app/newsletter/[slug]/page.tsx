import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatShortDate } from "../../../lib/date";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

export default async function NewsletterPost({ params }: any) {
  const res = await fetch(`${API}/api/newsletter/posts/${params.slug}`, {
    cache: "no-store",
  });

  const post = await res.json();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-white">
      <h1 className="text-3xl font-bold mb-2">{post.title}</h1>

      <div className="text-sm text-gray-400 mb-8">
        {formatShortDate(post.created_at)}
      </div>

      <article className="prose prose-lg max-w-none prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.content_md}
        </ReactMarkdown>
      </article>
    </main>
  );
}
