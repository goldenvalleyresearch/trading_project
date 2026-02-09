// src/app/newsletter/series/[group]/page.tsx

import Link from "next/link";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Post = {
  title: string;
  slug: string;
  kind: string;
  created_at: string;
  cover_url?: string; // future: per-post cover image from API
};

type GroupKey = "setup_wrap" | "monthly_pnl_macro" | "todays_score";

const GROUP_META: Record<GroupKey, { label: string; cover: string }> = {
  setup_wrap: { label: "The Setup & The Wrap", cover: "/images/covers/setup-wrap.jpg" },
  monthly_pnl_macro: { label: "Monthly P&L + Macro", cover: "/images/covers/monthly-macro.jpg" },
  todays_score: { label: "Today’s Score", cover: "/images/covers/todays-score.jpg" },
};

// ---------- helpers ----------
function normalizeToken(input: string) {
  return (input || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "");
}

function normalizeRouteGroup(input: string): GroupKey | null {
  const raw = (input || "").trim();

  // exact match (your route uses setup_wrap)
  if (raw === "setup_wrap") return "setup_wrap";
  if (raw === "monthly_pnl_macro") return "monthly_pnl_macro";
  if (raw === "todays_score") return "todays_score";

  // forgiving match
  const k = normalizeToken(raw);
  if (k === "setupwrap") return "setup_wrap";
  if (k === "monthlypnlmacro" || k === "monthlypnl" || k === "macro") return "monthly_pnl_macro";
  if (k === "todayscore" || k === "score") return "todays_score";

  return null;
}

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

// ---------- page ----------
export default async function NewsletterSeriesPage({
  params,
}: {
  params: { group?: string } | Promise<{ group?: string }>;
}) {
  const p = await Promise.resolve(params as any);
  const group = normalizeRouteGroup(p?.group ?? "");

  if (!group) {
    return (
      <main className="min-h-screen bg-[#070a10] text-white overflow-hidden">
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-16">
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

      if (!res.ok) {
        errorText = `API error (${res.status}). ${raw?.slice(0, 800) || ""}`;
      } else {
        posts = coercePosts(json);
      }
    } catch (e: any) {
      errorText = e?.message || String(e);
    }
  }

  const filtered = posts.filter((x) => groupForKind(x.kind) === group).sort(sortNewestFirst);

  return (
    <main className="min-h-screen bg-[#070a10] text-white overflow-hidden">
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        {/* header */}
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

        {/* EXACT SAME GRID/CARD STYLE AS /newsletter */}
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {filtered.map((post) => {
            const cover = post.cover_url || meta.cover; // future: per-post image

            return (
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
              >
                {/* HARD HEIGHT CAP so the image can never take over the page */}
                <div className="relative h-56 w-full">
                  <Image
                    src={cover}
                    alt={post.title}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover"
                    priority={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070a10]/70 via-[#070a10]/15 to-transparent" />
                </div>

                <div className="p-5 text-center">
                  <div className="text-lg font-semibold tracking-tight">{post.title}</div>
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
