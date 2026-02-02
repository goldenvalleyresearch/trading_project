import Link from "next/link";
import { parseApiDate } from "../../lib/date";
const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

export default async function NewsletterIndex() {
  const res = await fetch(`${API}/api/newsletter/posts`, { cache: "no-store" });
  const { items } = await res.json();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold mb-8">Market Letters</h1>

      <ul className="space-y-6">
        {items.map((p: any) => (
          <li key={p.slug}>
            <Link
              href={`/newsletter/${p.slug}`}
              className="text-xl font-medium hover:underline"
            >
              {p.title}
            </Link>
            <div className="text-sm text-gray-500">
              {parseApiDate(p.created_at)?.toLocaleDateString() ?? ""}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
