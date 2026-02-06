import Link from "next/link";
import { parseApiDate } from "../../lib/date";
const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

export default async function NewsletterIndex() {
  const res = await fetch(`${API}/api/newsletter/posts`, { cache: "no-store" });
  const { items } = await res.json();

  return (
    <main className="mx-auto max-w-5xl px-16 py-14 bg-white text-black">

      <h1 className="text-4xl font-semibold tracking-tight mb-10 font-serif">
        Golden Valley Market Research Daily Newsletters
      </h1>

      <ul className="space-y-6">
        {items.map((p: any) => (
          <li key={p.slug}>
            <Link
              href={`/newsletter/${p.slug}`}
              className="text-xl font-medium hover:underline"
            >
              {p.title}
            </Link>
            
          </li>
        ))}
      </ul>
    </main>
  );
}
