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
  return "Today’s Score";
}

function normalizeKind(kind: string) {
  return (kind || "")
    .toLowerCase()
    .trim()
    .replace(/[\s\-_]+/g, "");
}

function groupForKind(kind: string): GroupKey {
  const k = normalizeKind(kind);

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

  if (k === "monthly" || k === "monthlypnl" || k === "macro") return "monthly_pnl_macro";
  if (k === "score" || k === "todayscore") return "todays_score";

  return "setup_wrap";
}

function formatDate(iso: string) {
  const t = Date.parse(iso || "");
  if (!t) return "";
  return new Date(t).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatAMPM(kind: string) {
  const k = normalizeKind(kind);
  if (k === "premarket" || k === "am") return "AM";
  if (k === "afterhours" || k === "pm" || k === "close" || k === "postclose") return "PM";
  return "";
}

function coverForGroup(group: GroupKey) {
  if (group === "setup_wrap") return "/images/covers/setup-wrap.jpg";
  if (group === "monthly_pnl_macro") return "/images/covers/monthly-macro.jpg";
  return "/images/covers/todays-score.jpg";
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
  if (json && Array.isArray(json.data)) return json.data as Post[];
  if (json && Array.isArray(json.results)) return json.results as Post[];
  return [];
}

export default async function NewsletterSeriesPage({
  params,
}: {
  params: { group?: string } | Promise<{ group?: string }>;
}) {
  const p = await Promise.resolve(params as any);
  const rawGroup = String(p?.group ?? "");

  const group = VALID_GROUPS.includes(rawGroup as GroupKey)
    ? (rawGroup as GroupKey)
    : null;

  if (!group) {
    return (
      <main className="min-h-screen bg-[#070a10] text-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h1 className="text-2xl font-semibold">Unknown series</h1>
          <p className="mt-3 text-sm text-white/70">
            Expected: {VALID_GROUPS.join(", ")}. Got:{" "}
            <span className="font-mono text-white">{rawGroup || "(empty)"}</span>
          </p>
          <Link
            href="/newsletter"
            className="mt-8 inline-flex text-sm underline underline-offset-4 decoration-white/25 hover:decoration-white/60 visited:text-white"
          >
            Back to newsletters
          </Link>
        </div>
      </main>
    );
  }

  if (!API) {
    return (
      <main className="min-h-screen bg-[#070a10] text-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h1 className="text-3xl font-semibold">{groupLabel(group)}</h1>
          <p className="mt-3 text-sm text-white/70">NEXT_PUBLIC_API_BASE_URL is not defined.</p>
          <Link
            href="/newsletter"
            className="mt-8 inline-flex text-sm underline underline-offset-4 decoration-white/25 hover:decoration-white/60 visited:text-white"
          >
            Back
          </Link>
        </div>
      </main>
    );
  }

  let posts: Post[] = [];
  let errorText = "";

  try {
    const res = await fetch(`${API}/api/newsletter/posts`, { cache: "no-store" });
    const raw = await res.text();
    const json = raw ? JSON.parse(raw) : null;

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

  return (
    <main className="min-h-screen bg-[#070a10] text-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        {/* Header */}
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-xs text-white/60">Newsletter archive</div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">{groupLabel(group)}</h1>
            <p className="mt-3 text-sm text-white/70">
              Browse recent letters. Headlines first — date stays secondary.
            </p>
          </div>

          <Link
            href="/newsletter"
            className="text-sm text-white underline underline-offset-4 decoration-white/25 hover:decoration-white/60 visited:text-white"
          >
            Back
          </Link>
        </div>

        {errorText ? (
          <div className="mt-10 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
            <div className="font-semibold">Feed error</div>
            <div className="mt-2 whitespace-pre-wrap">{errorText}</div>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            No posts yet in this series.
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const ampm = formatAMPM(p.kind);
              return (
                <Link
                  key={p.slug}
                  href={`/newsletter/${p.slug}`}
                  className="
                    group block overflow-hidden rounded-2xl border border-white/10 bg-white/5
                    hover:bg-white/10 transition
                    text-white no-underline visited:text-white hover:text-white
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30
                  "
                >
                  <div
                    className="h-40 w-full opacity-95 group-hover:opacity-100 transition"
                    style={{
                      backgroundImage: `linear-gradient(to top, rgba(7,10,16,.65), rgba(7,10,16,.15)), url(${coverForGroup(group)})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />

                  <div className="p-6">
                    <div className="text-xs text-white/60">
                      {ampm ? `${ampm} • ` : ""}
                      {p.created_at ? formatDate(p.created_at) : ""}
                    </div>

                    <div className="mt-2 text-lg font-semibold leading-snug">
                      {p.title}
                    </div>

                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-white/90">
                      Read <span className="text-white/60">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
