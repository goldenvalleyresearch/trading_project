import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Post = {
  title: string;
  slug: string;
  kind: string;
  created_at: string;
};

type GroupKey = "setup_wrap" | "monthly_pnl_macro" | "todays_score";

const VALID_GROUPS: GroupKey[] = ["setup_wrap", "monthly_pnl_macro", "todays_score"];

function groupLabel(key: GroupKey) {
  if (key === "setup_wrap") return "The Setup & The Wrap";
  if (key === "monthly_pnl_macro") return "Monthly P&L + Macro";
  return "Todays Score";
}

function groupForKind(kind: string): GroupKey {
  const k = (kind || "").toLowerCase();
  if (k === "premarket" || k === "afterhours") return "setup_wrap";
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
  if (Array.isArray(json)) return json as Post[];
  if (json && Array.isArray(json.items)) return json.items as Post[];
  if (json && Array.isArray(json.posts)) return json.posts as Post[];
  return [];
}

export default async function NewsletterSeriesPage({
  params,
}: {
  params: { group: string };
}) {
  // IMPORTANT: don’t cast first — validate first
  const rawGroup = (params?.group || "").toString();
  const group = VALID_GROUPS.includes(rawGroup as GroupKey) ? (rawGroup as GroupKey) : null;

  if (!group) {
    return (
      <main className="min-h-screen bg-[#070a10] text-white">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h1 className="text-2xl font-semibold">Unknown series</h1>
          <p className="mt-6">
            <Link
              href="/newsletter"
              className="text-white underline underline-offset-4 decoration-white/30 hover:decoration-white/60 visited:text-white"
            >
              Back to newsletters
            </Link>
          </p>
        </div>
      </main>
    );
  }

  if (!API) {
    return (
      <main className="min-h-screen bg-[#070a10] text-white">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h1 className="text-3xl font-semibold tracking-tight">{groupLabel(group)}</h1>
          <p className="mt-4 text-sm text-white/70">NEXT_PUBLIC_API_BASE_URL is not defined.</p>
          <p className="mt-6">
            <Link
              href="/newsletter"
              className="text-white underline underline-offset-4 decoration-white/30 hover:decoration-white/60 visited:text-white"
            >
              Back
            </Link>
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

  const filtered = posts
    .filter((p) => groupForKind(p.kind) === group)
    .sort(sortNewestFirst);

  return (
    <main className="min-h-screen bg-[#070a10] text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">{groupLabel(group)}</h1>
          <Link
            href="/newsletter"
            className="text-sm text-white underline underline-offset-4 decoration-white/30 hover:decoration-white/60 visited:text-white"
          >
            Back
          </Link>
        </div>

        {errorText ? (
          <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            <div className="font-semibold">Feed error</div>
            <div className="mt-1 whitespace-pre-wrap">{errorText}</div>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <p className="mt-10 text-sm text-white/70">No posts yet in this series.</p>
        ) : (
          <ul className="mt-10 space-y-3">
            {filtered.map((p) => (
              <li key={p.slug} className="flex items-center justify-between gap-4">
                <Link
                  href={`/newsletter/${p.slug}`}
                  className="
                    text-sm font-medium text-white
                    underline underline-offset-4 decoration-white/25
                    hover:decoration-white/60
                    visited:text-white
                  "
                >
                  {p.title}
                </Link>

                <span className="hidden sm:inline text-xs text-white/60">
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
      </div>
    </main>
  );
}
