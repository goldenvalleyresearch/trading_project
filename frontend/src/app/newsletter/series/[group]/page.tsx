import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Post = {
  title: string;
  slug: string;
  kind: string;
  created_at: string;
};

type GroupKey = "setup_wrap" | "monthly_pnl_macro" | "todays_score";

const GROUP_META: Record<GroupKey, { label: string; cover: string }> = {
  setup_wrap: {
    label: "The Setup & The Wrap",
    cover: "/images/covers/setup-wrap.jpg",
  },
  monthly_pnl_macro: {
    label: "Monthly P&L + Macro",
    cover: "/images/covers/monthly-macro.jpg",
  },
  todays_score: {
    label: "Today’s Score",
    cover: "/images/covers/todays-score.jpg",
  },
};

function normalizeToken(input: string) {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[\s\-_]+/g, "");
}

function normalizeRouteGroup(input: string): GroupKey | null {
  const k = normalizeToken(input);
  if (k === "setupwrap") return "setup_wrap";
  if (k === "monthlypnlmacro" || k === "monthlypnl" || k === "macro")
    return "monthly_pnl_macro";
  if (k === "todaysscore" || k === "score") return "todays_score";
  return null;
}

function normalizeKind(kind: string) {
  return (kind || "").toLowerCase().trim().replace(/[\s\-_]+/g, "");
}

function groupForKind(kind: string): GroupKey {
  const k = normalizeKind(kind);
  if (
    ["premarket", "am", "morning", "setup", "afterhours", "pm", "wrap", "close", "postclose"].includes(
      k
    )
  )
    return "setup_wrap";
  if (["monthly", "monthlypnl", "macro"].includes(k))
    return "monthly_pnl_macro";
  if (["score", "todayscore"].includes(k)) return "todays_score";
  return "setup_wrap";
}

function sortNewestFirst(a: Post, b: Post) {
  return (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0);
}

function coercePosts(json: any): Post[] {
  if (Array.isArray(json)) return json;
  if (json?.items && Array.isArray(json.items)) return json.items;
  if (json?.posts && Array.isArray(json.posts)) return json.posts;
  if (json?.data && Array.isArray(json.data)) return json.data;
  if (json?.results && Array.isArray(json.results)) return json.results;
  return [];
}

export default async function NewsletterSeriesPage({
  params,
}: {
  params: { group?: string } | Promise<{ group?: string }>;
}) {
  const p = await Promise.resolve(params as any);
  const group = normalizeRouteGroup(p?.group ?? "");

  if (!group) {
    return (
      <main className="min-h-screen bg-[#070a10] text-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h1 className="text-2xl font-semibold">Unknown series</h1>
          <Link href="/newsletter" className="mt-6 inline-block text-sm text-white/80">
            Back
          </Link>
        </div>
      </main>
    );
  }

  let posts: Post[] = [];

  const res = await fetch(`${API}/api/newsletter/posts`, { cache: "no-store" });
  const json = await res.json();
  posts = coercePosts(json)
    .filter((p) => groupForKind(p.kind) === group)
    .sort(sortNewestFirst);

  const meta = GROUP_META[group];

  return (
    <main className="min-h-screen bg-[#070a10] text-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        {/* Header */}
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-xs text-white/60">Archive</div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              {meta.label}
            </h1>
            <p className="mt-3 text-sm text-white/70">
              Headlines only. Clean browse.
            </p>
          </div>

          <Link href="/newsletter" className="text-sm text-white/80 hover:text-white">
            Back
          </Link>
        </div>

        {/* 🔥 LOCKED GRID — EXACTLY 3 PER ROW */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/newsletter/${p.slug}`}
              className="
                group
                block
                w-full
                overflow-hidden
                rounded-2xl
                border border-white/10
                bg-white/5
                hover:bg-white/10
                transition
              "
            >
              <div className="relative h-44 w-full overflow-hidden">
                <img
                  src={meta.cover}
                  alt={meta.label}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070a10]/80 via-[#070a10]/20 to-transparent" />
              </div>

              <div className="p-6">
                <h3 className="text-lg font-semibold leading-snug">
                  {p.title}
                </h3>
                <div className="mt-4 inline-flex items-center gap-2 text-sm text-white/80">
                  Read <span className="text-white/50">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
