import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Post = {
  title: string;
  slug: string;
  kind: string;
  created_at: string;
};

type GroupKey = "setup_wrap" | "monthly_pnl_macro" | "todays_score";

function groupLabel(key: GroupKey) {
  if (key === "setup_wrap") return "The Setup & The Wrap";
  if (key === "monthly_pnl_macro") return "Monthly P&L + Macro";
  return "Todays Score";
}

// For now, everything you currently upload (premarket/afterhours) goes into Setup & Wrap.
// Later, when you add new kinds, you can map them here.
function groupForKind(kind: string): GroupKey {
  const k = (kind || "").toLowerCase();

  // current kinds
  if (k === "premarket" || k === "afterhours") return "setup_wrap";

  // future kinds (you'll add later)
  if (k === "monthly" || k === "monthly_pnl" || k === "macro") return "monthly_pnl_macro";
  if (k === "score" || k === "todays_score") return "todays_score";

  // default bucket
  return "setup_wrap";
}

function sortNewestFirst(a: Post, b: Post) {
  // If created_at is missing or funky, fallback to 0
  const ta = Date.parse(a.created_at || "") || 0;
  const tb = Date.parse(b.created_at || "") || 0;
  return tb - ta;
}

export default async function NewsletterIndexPage() {
  if (!API) {
    return (
      <main className="bg-white text-black">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h1 className="text-3xl font-semibold tracking-tight text-center">
            Golden Valley Market Research Daily Newsletters
          </h1>
          <p className="mt-6 text-center text-sm text-gray-600">
            NEXT_PUBLIC_API_BASE_URL is not defined.
          </p>
        </div>
      </main>
    );
  }

  const res = await fetch(`${API}/api/newsletter/posts`, { cache: "no-store" });
  const posts = (await res.json()) as Post[];

  const grouped: Record<GroupKey, Post[]> = {
    setup_wrap: [],
    monthly_pnl_macro: [],
    todays_score: [],
  };

  (posts || []).forEach((p) => {
    grouped[groupForKind(p.kind)].push(p);
  });

  // sort within each group
  (Object.keys(grouped) as GroupKey[]).forEach((k) => {
    grouped[k] = grouped[k].sort(sortNewestFirst);
  });

  const groupsInOrder: GroupKey[] = ["setup_wrap", "monthly_pnl_macro", "todays_score"];

  return (
    <main className="bg-white text-black">
      <div className="mx-auto max-w-5xl px-6 py-14">
        {/* Title: clean font, black text, centered */}
        <h1 className="text-4xl font-semibold tracking-tight text-center">
          Golden Valley Market Research Daily Newsletters
        </h1>

        <p className="mt-3 text-center text-sm text-gray-600">
          Clean archive of your posts — grouped by series.
        </p>

        <div className="mt-12 space-y-10">
          {groupsInOrder.map((groupKey) => {
            const items = grouped[groupKey] || [];

            return (
              <section key={groupKey} className="rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-xl font-semibold">{groupLabel(groupKey)}</h2>
                  <span className="text-xs text-gray-500">{items.length} posts</span>
                </div>

                {items.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">
                    Nothing here yet — you’ll add this series next.
                  </p>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {items.map((p) => (
                      <li key={p.slug} className="flex items-center justify-between gap-4">
                        <Link
                          href={`/newsletter/${p.slug}`}
                          className="
                            text-sm font-medium text-gray-900
                            hover:text-gray-700
                            underline underline-offset-4 decoration-gray-300
                            hover:decoration-gray-500
                            visited:text-gray-900
                          "
                        >
                          {p.title}
                        </Link>

                        {/* Optional: show kind on the right, subtle */}
                        <span className="hidden sm:inline text-xs text-gray-500">
                          {(p.kind || "").toLowerCase() === "premarket"
                            ? "AM"
                            : (p.kind || "").toLowerCase() === "afterhours"
                            ? "PM"
                            : p.kind}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
