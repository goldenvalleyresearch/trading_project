import Link from "next/link";
import Image from "next/image";

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

const VALID_GROUPS: GroupKey[] = ["setup_wrap", "monthly_pnl_macro", "todays_score"];

function normalizeKind(kind: string) {
  return (kind || "").toLowerCase().trim().replace(/[\s\-_]+/g, "");
}

function groupForKind(kind: string): GroupKey {
  const k = normalizeKind(kind);

  if (
    ["premarket", "am", "morning", "setup", "afterhours", "pm", "wrap", "close", "postclose"].includes(k)
  ) {
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
      <main style={{ minHeight: "100vh", background: "#070a10", color: "white" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 20px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Unknown series</h1>
          <Link href="/newsletter" style={{ display: "inline-flex", marginTop: 18, color: "rgba(255,255,255,.8)" }}>
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
    <main style={{ minHeight: "100vh", background: "#070a10", color: "white" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 20px" }}>
        {/* Header (no "Archive", no Back button) */}
        <div>
          <h1 style={{ fontSize: 56, fontWeight: 700, letterSpacing: "-0.02em" }}>{meta.label}</h1>
          <p style={{ marginTop: 10, fontSize: 14, color: "rgba(255,255,255,.7)" }}>
            Headlines only. Clean browse.
          </p>
        </div>

        {errorText ? (
          <div
            style={{
              marginTop: 24,
              borderRadius: 18,
              border: "1px solid rgba(239,68,68,.35)",
              background: "rgba(239,68,68,.12)",
              padding: 16,
              fontSize: 13,
              color: "rgba(254,226,226,1)",
              whiteSpace: "pre-wrap",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Feed error</div>
            {errorText}
          </div>
        ) : null}

        {/* Tiles */}
        <div
          style={{
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 18,
          }}
        >
          {filtered.map((post) => {
            // future: const cover = post.cover_url || meta.cover;
            const cover = meta.cover;

            return (
              <Link
                key={post.slug}
                href={`/newsletter/${post.slug}`}
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 18,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "16 / 9",
                    overflow: "hidden",
                  }}
                >
                  <Image
                    src={cover}
                    alt={post.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    style={{ objectFit: "cover" }}
                    priority={false}
                  />

                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(to top, rgba(7,10,16,0.85), rgba(7,10,16,0.15), rgba(7,10,16,0.00))",
                    }}
                  />

                  {/* Title only (no date) */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      padding: "14px 14px 16px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em" }}>{post.title}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {!errorText && filtered.length === 0 ? (
          <div
            style={{
              marginTop: 24,
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
              padding: 16,
              fontSize: 14,
              color: "rgba(255,255,255,.70)",
            }}
          >
            No posts in this series yet.
          </div>
        ) : null}
      </div>

      {/* mobile stacking: 3 -> 1 */}
      <style>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: repeat(3"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
