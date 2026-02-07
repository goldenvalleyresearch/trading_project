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

function groupForKind(kind: string): GroupKey {
  const k = (kind || "").toLowerCase();

  if (k === "premarket" || k === "afterhours") return "setup_wrap";

  // future buckets
  if (k === "monthly" || k === "monthly_pnl" || k === "macro") return "monthly_pnl_macro";
  if (k === "score" || k === "todays_score") return "todays_score";

  return "setup_wrap";
}

function sortNewestFirst(a: Post, b: Post) {
  const ta = Date.parse(a.created_at || "") || 0;
  const tb = Date.parse(b.created_at || "") || 0;
  return tb - ta;
}

function coercePosts(json: any): Post[] {
  // Accept either:
  // 1) [ ...posts ]
  // 2) { items: [ ...posts ] }
  // 3) { posts: [ ...posts ] }
  if (Array.isArray(json)) return json as Post[];
  if (json && Array.isArray(json.items)) return json.items as Post[];
  if (json && Array.isArray(json.posts)) return json.posts as Post[];
  return [];
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

  let posts: Post[] = [];
  let errorText = "";

  try {
    const res = await fetch(`${API}/api/newsletter/posts`, { cache: "no-store" });

    const raw = await res.text();
    let json: any = null;

    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      errorText = `API error (${res.status}). ${raw?.slice(0, 300) || ""}`;
      posts = [];
    } else {
      posts = coercePosts(json);
    }
  } catch (e: any) {
    errorText = e?.message || String(e);
    posts = [];
  }

  const grouped: Record<GroupKey, Post[]> = {
    setup_wrap: [],
    monthly_pnl_macro: [],
    todays_score: [],
  };

  // This will NEVER crash now, because posts is ALWAYS an array
  posts.forEach((p) => {
    grouped[groupForKind(p.kind)].push(p);
  });

  (Object.keys(grouped) as GroupKey[]).forEach((k) => {
    grouped[k] = grouped[k].sort(sortNewestFirst);
  });

  const groupsInOrder: GroupKey[] = ["setup_wrap", "monthly_pnl_macro", "todays_score"];

  return (
    <main className="bg-white text-black">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-center">
          Golden Valley Market Research Daily Newsletters
        </h1>

        <p className="mt-3 text-center text-sm text-gray-600">
          Clean archive of your posts — grouped by series.
        </p>

        {errorText ? (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-semibold">Newsletter feed error</div>
            <div className="mt-1 whitespace-pre-wrap">{errorText}</div>
          </div>
        ) : null}

        <div className="mt-12 space-y-10">
          {groupsInOrder.map((groupKey) => {
            const items = grouped[groupKey] || [];

            return (
              <section
                key={groupKey}
                className="rounded-2xl border border-gray-200 p-6 shadow-sm bg-white"
              >
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
