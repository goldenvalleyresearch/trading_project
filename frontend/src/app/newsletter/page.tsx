import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

type Post = {
  title: string;
  slug: string;
  kind: string;
  created_at: string;
  // Optional if you add later:
  // excerpt?: string;
  // cover_image_url?: string;
};

type GroupKey = "setup_wrap" | "monthly_pnl_macro" | "todays_score";

const GROUPS: { key: GroupKey; label: string; blurb: string }[] = [
  {
    key: "setup_wrap",
    label: "The Setup & The Wrap",
    blurb: "Premarket setup + post-close wrap. The tape, the drivers, the trades.",
  },
  {
    key: "monthly_pnl_macro",
    label: "Monthly P&L + Macro",
    blurb: "Monthly performance and the macro regime behind it.",
  },
  {
    key: "todays_score",
    label: "Today’s Score",
    blurb: "Fast, clean scoreboard. What mattered, what moved, what didn’t.",
  },
];

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
  if (k === "afterhours" || k === "pm" || k === "postclose" || k === "close") return "PM";
  return "";
}

// “No backend changes” cover images. Put these files in /public/images/covers/
function coverForGroup(group: GroupKey) {
  if (group === "setup_wrap") return "/images/covers/setup-wrap.jpg";
  if (group === "monthly_pnl_macro") return "/images/covers/monthly-macro.jpg";
  return "/images/covers/todays-score.jpg";
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
  if (!API) {
    return (
      <main className="min-h-screen bg-[#070a10] text-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h1 className="text-3xl font-semibold tracking-tight">Newsletters</h1>
          <p className="mt-3 text-sm text-white/70">
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

  const sorted = posts.slice().sort(sortNewestFirst);
  const featured = sorted[0] || null;
  const latest = sorted.slice(0, 12);

  return (
    <main className="min-h-screen bg-[#070a10] text-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              Golden Valley Market Research
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Daily market letters, portfolio notes, and the scoreboard.
            </p>
          </div>

          <Link
            href="/"
            className="text-sm underline underline-offset-4 decoration-white/25 hover:decoration-white/60 visited:text-white"
          >
            Home
          </Link>
        </div>

        {errorText ? (
          <div className="mt-10 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
            <div className="font-semibold">Feed error</div>
            <div className="mt-2 whitespace-pre-wrap">{errorText}</div>
          </div>
        ) : null}

        {/* Series tiles */}
        <section className="mt-12 grid gap-6 md:grid-cols-3">
          {GROUPS.map((g) => (
            <Link
              key={g.key}
              href={`/newsletter/series/${g.key}`}
              className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
            >
              <div className="h-32 w-full bg-white/5">
                {/* Pure CSS “image area” placeholder. Swap to next/image later if you want. */}
                <div
                  className="h-full w-full opacity-90 group-hover:opacity-100 transition"
                  style={{
                    backgroundImage: `url(${coverForGroup(g.key)})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              </div>
              <div className="p-5">
                <div className="text-lg font-semibold">{g.label}</div>
                <div className="mt-1 text-sm text-white/70">{g.blurb}</div>
                <div className="mt-4 text-sm underline underline-offset-4 decoration-white/25 group-hover:decoration-white/60">
                  View series
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
              <span className="text-xs text-white/60">
                Latest publish: {formatDate(featured.created_at)}
              </span>
            </div>

            <Link
              href={`/newsletter/${featured.slug}`}
              className="mt-4 block overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
            >
              <div className="grid md:grid-cols-[1.2fr_1fr]">
                <div
                  className="min-h-[220px] w-full"
                  style={{
                    backgroundImage: `url(${coverForGroup(groupForKind(featured.kind))})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div className="p-6">
                  <div className="text-xs text-white/60">
                    {GROUPS.find((x) => x.key === groupForKind(featured.kind))?.label}
                    {formatAMPM(featured.kind) ? ` • ${formatAMPM(featured.kind)}` : ""}
                    {featured.created_at ? ` • ${formatDate(featured.created_at)}` : ""}
                  </div>

                  <div className="mt-3 text-2xl font-semibold leading-tight">
                    {featured.title}
                  </div>

                  <div className="mt-3 text-sm text-white/70">
                    Open the full letter →
                  </div>
                </div>
              </div>
            </Link>
          </section>
        ) : null}

        {/* Latest grid */}
        <section className="mt-12">
          <div className="flex items-end justify-between gap-6">
            <h2 className="text-2xl font-semibold tracking-tight">Latest</h2>
            <span className="text-xs text-white/60">Showing {latest.length} posts</span>
          </div>

          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((p) => {
              const g = groupForKind(p.kind);
              const label = GROUPS.find((x) => x.key === g)?.label ?? "Newsletter";
              const ampm = formatAMPM(p.kind);

              return (
                <Link
                  key={p.slug}
                  href={`/newsletter/${p.slug}`}
                  className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
                >
                  <div
                    className="h-36 w-full opacity-90 group-hover:opacity-100 transition"
                    style={{
                      backgroundImage: `url(${coverForGroup(g)})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <div className="p-5">
                    <div className="text-xs text-white/60">
                      {label}
                      {ampm ? ` • ${ampm}` : ""}
                      {p.created_at ? ` • ${formatDate(p.created_at)}` : ""}
                    </div>
                    <div className="mt-2 text-lg font-semibold leading-snug">
                      {p.title}
                    </div>
                    <div className="mt-3 text-sm underline underline-offset-4 decoration-white/25 group-hover:decoration-white/60">
                      Read →
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {sorted.length > latest.length ? (
            <div className="mt-10 text-center">
              <Link
                href="/newsletter/series/setup_wrap"
                className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
              >
                Browse full archive
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
