import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Post = {
  title: string;
  slug: string;
  kind: string;
  created_at: string;
  // future: cover_url?: string;
};

type GroupKey = "setup_wrap" | "monthly_pnl_macro" | "todays_score";

const GROUP_META: Record<GroupKey, { label: string; cover: string }> = {
  setup_wrap: { label: "The Setup & The Wrap", cover: "/images/covers/setup-wrap.jpg" },
  monthly_pnl_macro: { label: "Monthly P&L + Macro", cover: "/images/covers/monthly-macro.jpg" },
  todays_score: { label: "Today’s Score", cover: "/images/covers/todays-score.jpg" },
};

function normalizeKind(kind: string) {
  return (kind || "").toLowerCase().trim().replace(/[\s\-_]+/g, "");
}

function groupForKind(kind: string): GroupKey {
  const k = normalizeKind(kind);

  if (["premarket", "am", "morning", "setup", "afterhours", "pm", "wrap", "close", "postclose"].includes(k)) {
    return "setup_wrap";
  }
  if (["monthly", "monthlypnl", "macro"].includes(k)) return "monthly_pnl_macro";
  if (["score", "todayscore"].includes(k)) return "todays_score";

  return "setup_wrap";
}

// IMPORTANT: route param is already "setup_wrap" etc.
// Don’t over-normalize it. Just validate.
const VALID_GROUPS: GroupKey[] = ["setup_wrap", "monthly_pnl_macro", "todays_score"];

function sortNewestFirst(a: Post, b: Post) {
  return (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0);
}

function coercePosts(json: any): Post[] {
  if (Array.isArray(json)) return json as Post[];
  if (json?.items && Array.isArray(json.items)) return json.items as Post[];
  if (json?.posts && Array.isArray(json.posts)) return json.posts as Post[];
  if (json?.data && Array.isArray(json.data)) return json.data as Post[];
  if (json?.results && Array.isArray(json.results)) return json.results as Post[];
  return [];
}

export default async function NewsletterSeriesPage({
  params,
}: {
  params: { group?: string } | Promise<{ group?: string }>;
}) {
  const p = await Promise.resolve(params as any);
  const rawGroup = String(p?.group ?? "");
  const group: GroupKey | null = VALID_GROUPS.includes(rawGroup as GroupKey) ? (rawGroup as GroupKey) : null;

  if (!group) {
    return (
      <main className="min-h-screen bg-[#070a10] text-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h1 className="text-2xl font-semibold">Unknown series</h1>
          <Link
            href="/newsletter"
            className="mt-6 inline-flex text-sm text-white/80 hover:text-white transition"
          >
            Back
          </Link>
        </div>
      </main>
    );
  }

  const meta = GROUP_META[group];

  let posts: Post[] = [];
  let errorText = "";

  if (!API) {
    errorText = "NEXT_PUBLIC_API_BASE_URL is not defined.";
  } else {
    try {
      const res = await fetch(`${API}/api/newsletter/posts`, { cache: "no-store" });
      const raw = await res.text();
      const json = raw ? JSON.parse(raw) : null;

      if (!res.ok) errorText = `API error (${res.status}). ${raw?.slice(0, 800) || ""}`;
      else posts = coercePosts(json);
    } catch (e: any) {
      errorText = e?.message || String(e);
    }
  }

  const filtered = posts.filter((x) => groupForKind(x.kind) === group).sort(sortNewestFirst);

  return (
    <main className="min-h-screen bg-[#070a10] text-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        {/* Header */}
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-xs text-white/60">Archive</div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">{meta.label}</h1>
            <p className="mt-3 text-sm text-white/70">Headlines only. Clean browse.</p>
          </div>

          <Link href="/newsletter" className="text-sm text-white/80 hover:text-white transition">
            Back
          </Link>
        </div>

        {errorText ? (
          <div className="mt-10 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
            <div className="font-semibold">Feed error</div>
            <div className="mt-2 whitespace-pre-wrap">{errorText}</div>
          </div>
        ) : null}

        {/* ✅ SAME CARD STYLE AS LANDING (backgroundImage, no <Image fill />) */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => {
            // future: const cover = post.cover_url || meta.cover;
            const cover = meta.cover;

            return (
              <Link
                key={post.slug}
                href={`/newsletter/${post.slug}`}
                className="
                  group block overflow-hidden rounded-2xl border border-white/10 bg-white/5
                  hover:bg-white/10 transition
                  text-white no-underline visited:text-white hover:text-white
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30
                "
              >
                <div
                  className="h-56 w-full opacity-95 group-hover:opacity-100 transition"
                  style={{
                    backgroundImage: `linear-gradient(to top, rgba(7,10,16,.75), rgba(7,10,16,.10)), url(${cover})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div className="p-6">
                  <div className="text-lg font-semibold leading-snug">{post.title}</div>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-white/90">
                    Read <span className="text-white/60">→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {!errorText && filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            No posts in this series yet.
          </div>
        ) : null}
      </div>
    </main>
  );
}
