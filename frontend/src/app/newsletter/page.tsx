import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Post = {
  title: string;
  slug: string;
  kind: string;
  created_at: string;
};

type GroupKey = "setup_wrap" | "monthly_pnl_macro" | "todays_score";

const GROUPS: { key: GroupKey; label: string; blurb: string; cover: string }[] = [
  {
    key: "setup_wrap",
    label: "The Setup & The Wrap",
    blurb: "Premarket setup + post-close wrap. The tape, the drivers, the trades.",
    cover: "/images/covers/setup-wrap.jpg",
  },
  {
    key: "monthly_pnl_macro",
    label: "Monthly P&L + Macro",
    blurb: "Monthly performance and the macro regime behind it.",
    cover: "/images/covers/monthly-macro.jpg",
  },
  {
    key: "todays_score",
    label: "Today’s Score",
    blurb: "Fast, clean scoreboard. What mattered, what moved, what didn’t.",
    cover: "/images/covers/todays-score.jpg",
  },
];

function normalizeKind(kind: string) {
  return (kind || "").toLowerCase().trim().replace(/[\s\-_]+/g, "");
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
    k === "wrap" ||
    k === "close" ||
    k === "postclose"
  ) {
    return "setup_wrap";
  }
  if (k === "monthly" || k === "monthlypnl" || k === "macro") return "monthly_pnl_macro";
  if (k === "score" || k === "todayscore") return "todays_score";
  return "setup_wrap";
}

function coercePosts(json: any): Post[] {
  if (Array.isArray(json)) return json as Post[];
  if (json && Array.isArray(json.items)) return json.items as Post[];
  if (json && Array.isArray(json.posts)) return json.posts as Post[];
  if (json && Array.isArray(json.data)) return json.data as Post[];
  if (json && Array.isArray(json.results)) return json.results as Post[];
  return [];
}

function sortNewestFirst(a: Post, b: Post) {
  const ta = Date.parse(a.created_at || "") || 0;
  const tb = Date.parse(b.created_at || "") || 0;
  return tb - ta;
}

export default async function NewsletterIndexPage() {
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
        errorText = `API error (${res.status}). ${raw?.slice(0, 600) || ""}`;
        posts = [];
      } else {
        posts = coercePosts(json);
      }
    } catch (e: any) {
      errorText = e?.message || String(e);
      posts = [];
    }
  }

  const sorted = posts.slice().sort(sortNewestFirst);
  const featured = sorted[0] || null;
  const latest = sorted.slice(0, 9);

  const hero = "/images/landing-hero.jpg"; // you already have this

  return (
    <main className="min-h-screen bg-[#070a10] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: `url(${hero})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#070a10]/30 via-[#070a10]/70 to-[#070a10]" />

        <div className="relative mx-auto max-w-6xl px-6 py-14">
          <div className="flex items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">Golden Valley Market Research</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70">
                Daily market letters, portfolio notes, and the scoreboard — packaged clean.
              </p>
            </div>

            <Link
              href="/"
              className="text-sm text-white/80 hover:text-white transition
                         no-underline visited:text-white/80"
            >
              Home
            </Link>
          </div>

          {errorText ? (
            <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
              <div className="font-semibold">Feed error</div>
              <div className="mt-2 whitespace-pre-wrap">{errorText}</div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Series tiles */}
        <section className="grid gap-6 md:grid-cols-3">
          {GROUPS.map((g) => (
            <Link
              key={g.key}
              href={`/newsletter/series/${g.key}`}
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
                  backgroundImage: `linear-gradient(to top, rgba(7,10,16,.75), rgba(7,10,16,.15)), url(${g.cover})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="p-6">
                <div className="text-xl font-semibold tracking-tight">{g.label}</div>
                <div className="mt-2 text-sm text-white/70 leading-relaxed">{g.blurb}</div>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white/90">
                  View series <span className="text-white/60">→</span>
                </div>
              </div>
            </Link>
          ))}
        </section>

        {/* Featured */}
        {featured ? (
          <section className="mt-12">
            <div className="flex items-end justify-between gap-6">
              <h2 className="text-2xl font-semibold tracking-tight">Featured</h2>
              <span className="text-xs text-white/50">Editor’s pick</span>
            </div>

            <Link
              href={`/newsletter/${featured.slug}`}
              className="
                mt-4 block overflow-hidden rounded-2xl border border-white/10 bg-white/5
                hover:bg-white/10 transition
                text-white no-underline visited:text-white hover:text-white
              "
            >
              <div className="grid md:grid-cols-[1.2fr_1fr]">
                <div
                  className="min-h-[260px] w-full"
                  style={{
                    backgroundImage: `linear-gradient(to right, rgba(7,10,16,.70), rgba(7,10,16,.10)), url(${GROUPS.find(x => x.key === groupForKind(featured.kind))?.cover || GROUPS[0].cover})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div className="p-8">
                  <div className="text-xs text-white/60">
                    {GROUPS.find((x) => x.key === groupForKind(featured.kind))?.label || "Newsletter"}
                  </div>
                  <div className="mt-3 text-3xl font-semibold leading-tight">{featured.title}</div>
                  <div className="mt-4 text-sm text-white/70">Open letter →</div>
                </div>
              </div>
            </Link>
          </section>
        ) : null}

        {/* Latest */}
        <section className="mt-12">
          <div className="flex items-end justify-between gap-6">
            <h2 className="text-2xl font-semibold tracking-tight">Latest</h2>
            <span className="text-xs text-white/50">{latest.length ? `${latest.length} posts` : ""}</span>
          </div>

          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((p) => {
              const g = groupForKind(p.kind);
              const label = GROUPS.find((x) => x.key === g)?.label ?? "Newsletter";
              const cover = GROUPS.find((x) => x.key === g)?.cover ?? GROUPS[0].cover;

              return (
                <Link
                  key={p.slug}
                  href={`/newsletter/${p.slug}`}
                  className="
                    group block overflow-hidden rounded-2xl border border-white/10 bg-white/5
                    hover:bg-white/10 transition
                    text-white no-underline visited:text-white hover:text-white
                  "
                >
                  <div
                    className="h-40 w-full opacity-95 group-hover:opacity-100 transition"
                    style={{
                      backgroundImage: `linear-gradient(to top, rgba(7,10,16,.70), rgba(7,10,16,.10)), url(${cover})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <div className="p-6">
                    <div className="text-xs text-white/60">{label}</div>
                    <div className="mt-2 text-lg font-semibold leading-snug">{p.title}</div>
                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-white/90">
                      Read <span className="text-white/60">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
