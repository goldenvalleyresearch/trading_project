import Link from "next/link";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Post = { title: string; slug: string; kind: string; created_at: string };
type GroupKey = "setup_wrap" | "monthly_pnl_macro" | "todays_score";

const VALID_GROUPS: GroupKey[] = ["setup_wrap", "monthly_pnl_macro", "todays_score"];

const GROUP_META: Record<GroupKey, { label: string; cover: string; blurb: string }> = {
  setup_wrap: {
    label: "The Setup & The Wrap",
    cover: "/images/covers/setup-wrap.jpg",
    blurb: "Premarket setup + post-close wrap.",
  },
  monthly_pnl_macro: {
    label: "Monthly P&L + Macro",
    cover: "/images/covers/monthly-macro.jpg",
    blurb: "Monthly performance and the macro regime behind it.",
  },
  todays_score: {
    label: "Today’s Score",
    cover: "/images/covers/todays-score.jpg",
    blurb: "Fast, clean scoreboard. What mattered, what moved, what didn’t.",
  },
};

function normalizeKind(kind: string) {
  return (kind || "").toLowerCase().trim().replace(/[\s\-_]+/g, "");
}

function groupForKind(kind: string): GroupKey {
  const k = normalizeKind(kind);
  if (["premarket", "am", "morning", "setup", "afterhours", "pm", "wrap", "close", "postclose"].includes(k))
    return "setup_wrap";
  if (["monthly", "monthlypnl", "macro"].includes(k)) return "monthly_pnl_macro";
  if (["score", "todayscore"].includes(k)) return "todays_score";
  return "setup_wrap";
}

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

function formatDateShort(iso: string) {
  const t = Date.parse(iso || "");
  if (!t) return "";
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function NewsletterSeriesPage({
  params,
}: {
  params: { group?: string } | Promise<{ group?: string }>;
}) {
  const p = await Promise.resolve(params as any);
  const rawGroup = String(p?.group ?? "");
  const group = VALID_GROUPS.includes(rawGroup as GroupKey) ? (rawGroup as GroupKey) : null;

  if (!group) {
    return (
      <main className="min-h-screen bg-[#070a10] text-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h1 className="text-2xl font-semibold">Unknown series</h1>
          <Link href="/newsletter" className="mt-6 inline-flex text-sm text-white/80 hover:text-white transition">
            Back
          </Link>
        </div>
      </main>
    );
  }

  let posts: Post[] = [];
  let errorText = "";

  if (!API) {
    errorText = "NEXT_PUBLIC_API_BASE_URL is not defined.";
  } else {
    try {
      const res = await fetch(`${API}/api/newsletter/posts`, { cache: "no-store" });
      const raw = await res.text();
      const json = raw ? JSON.parse(raw) : null;

      if (!res.ok) errorText = `API error (${res.status}). ${raw?.slice(0, 600) || ""}`;
      else posts = coercePosts(json);
    } catch (e: any) {
      errorText = e?.message || String(e);
    }
  }

  const filtered = posts.filter((x) => groupForKind(x.kind) === group).sort(sortNewestFirst);
  const meta = GROUP_META[group];

  return (
    <main className="min-h-screen bg-[#070a10] text-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        {/* Header */}
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-xs text-white/60">Archive</div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">{meta.label}</h1>
            <p className="mt-3 text-sm text-white/70">{meta.blurb}</p>
          </div>

          <Link href="/newsletter" className="text-sm text-white/80 hover:text-white transition">
            Back
          </Link>
        </div>

        {/* Error */}
        {errorText ? (
          <div className="mt-10 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
            <div className="font-semibold">Feed error</div>
            <div className="mt-2 whitespace-pre-wrap">{errorText}</div>
          </div>
        ) : null}

        {/* Empty state */}
        {!errorText && filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            No posts yet in <span className="text-white">{meta.label}</span>.
          </div>
        ) : null}

        {/* Cards */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {filtered.map((post) => (
            <Link
              key={post.slug}
              href={`/newsletter/${post.slug}`}
              className="
                group block overflow-hidden rounded-2xl
                border border-white/10 bg-white/5
                hover:bg-white/10 transition
                text-white no-underline visited:text-white hover:text-white
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30
              "
              style={{
                boxShadow: "0 18px 50px rgba(0,0,0,.35)",
              }}
            >
              {/* Image box — HARD bounded by aspect ratio */}
              <div
                className="relative w-full"
                style={{
                  aspectRatio: "16 / 9",
                }}
              >
                <Image
                  src={meta.cover} // <-- same image for every card FOR NOW
                  alt={meta.label}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  style={{ objectFit: "cover" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070a10]/75 via-[#070a10]/20 to-transparent" />
              </div>

              {/* Text */}
              <div className="p-5">
                <div className="text-base font-semibold leading-snug">{post.title}</div>
                <div className="mt-3 flex items-center justify-between text-xs text-white/60">
                  <span>{formatDateShort(post.created_at)}</span>
                  <span className="text-white/80">
                    Read <span className="text-white/60">→</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
