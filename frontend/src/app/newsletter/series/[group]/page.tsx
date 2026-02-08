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

/**
 * Normalize kind values aggressively:
 * - lowercase
 * - trim
 * - remove spaces/underscores/dashes
 * Examples:
 * "After Hours" -> "afterhours"
 * "after_hours" -> "afterhours"
 * "after-hours" -> "afterhours"
 */
function normalizeKind(kind: string) {
  return (kind || "")
    .toLowerCase()
    .trim()
    .replace(/[\s\-_]+/g, "");
}

/**
 * Map API "kind" to our GroupKey robustly.
 * Put ALL your current uploads (AM/PM) into setup_wrap.
 */
function groupForKind(kind: string): GroupKey {
  const k = normalizeKind(kind);

  // Current / likely values for AM + PM
  if (
    k === "premarket" ||
    k === "am" ||
    k === "morning" ||
    k === "setup" ||
    k === "afterhours" ||
    k === "pm" ||
    k === "after" ||
    k === "wrap" ||
    k === "close" ||
    k === "aftermarket" ||
    k === "postmarket" ||
    k === "postclose"
  ) {
    return "setup_wrap";
  }

  // Future buckets (you’ll add later)
  if (k === "monthly" || k === "monthlypnl" || k === "macro") return "monthly_pnl_macro";
  if (k === "score" || k === "todayscore") return "todays_score";

  // Default bucket (keep it simple)
  return "setup_wrap";
}

function sortNewestFirst(a: Post, b: Post) {
  const ta = Date.parse(a.created_at || "") || 0;
  const tb = Date.parse(b.created_at || "") || 0;
  return tb - ta;
}

/**
 * Coerce API response into Post[]
 * Handles:
 * - []
 * - { items: [] }
 * - { posts: [] }
 * - { data: [] }
 * - { results: [] }
 */
function coercePosts(json: any): Post[] {
  if (Array.isArray(json)) return json as Post[];
  if (json && Array.isArray(json.items)) return json.items as Post[];
  if (json && Array.isArray(json.posts)) return json.posts as Post[];
  if (json && Array.isArray(json.data)) return json.data as Post[];
  if (json && Array.isArray(json.results)) return json.results as Post[];
  return [];
}

export default async function NewsletterSeriesPage({
  params,
}: {
  params: { group: string };
}) {
  const rawGroup = (params?.group ?? "").toString();
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
      errorText = `API error (${res.status}). ${raw?.slice(0, 600) || ""}`;
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

  // Debug info ONLY if empty (so you can see what kind values are coming back)
  const kindsDebug =
    filtered.length === 0 && posts.length > 0
      ? Array.from(
          new Set(posts.map((p) => `${p.kind ?? ""} → ${normalizeKind(p.kind ?? "")} → ${groupForKind(p.kind ?? "")}`))
        ).slice(0, 30)
      : [];

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
          <div className="mt-10">
            <p className="text-sm text-white/70">No posts yet in this series.</p>

            {posts.length > 0 ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Debug (why it’s empty)</div>
                <div className="mt-2 text-xs text-white/70">
                  Total posts returned by API: <span className="text-white">{posts.length}</span>
                </div>
                <div className="mt-3 text-xs text-white/70">
                  Kinds seen (raw → normalized → bucket):
                  <ul className="mt-2 list-disc pl-5 space-y-1">
                    {kindsDebug.map((line) => (
                      <li key={line} className="text-white/80">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
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
                  {(() => {
                    const k = normalizeKind(p.kind || "");
                    if (k === "premarket" || k === "am") return "AM";
                    if (k === "afterhours" || k === "pm") return "PM";
                    return p.kind;
                  })()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
