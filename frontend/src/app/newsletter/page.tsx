import Link from "next/link";
import Image from "next/image";

type GroupKey = "setup_wrap" | "monthly_pnl_macro" | "todays_score";

const TILES: { key: GroupKey; label: string; cover: string }[] = [
  { key: "setup_wrap", label: "The Setup & The Wrap", cover: "/images/covers/setup-wrap.jpg" },
  { key: "monthly_pnl_macro", label: "Monthly P&L + Macro", cover: "/images/covers/monthly-macro.jpg" },
  { key: "todays_score", label: "Today’s Score", cover: "/images/covers/todays-score.jpg" },
];

export default function NewsletterIndexPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#070a10", color: "white" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 20px" }}>
        {/* 3-tile row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 18,
          }}
        >
          {TILES.map((t) => (
            <Link
              key={t.key}
              href={`/newsletter/series/${t.key}`}
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
              {/* GUARANTEED SIZE: aspect ratio box */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16 / 9",
                  overflow: "hidden",
                }}
              >
                <Image
                  src={t.cover}
                  alt={t.label}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  style={{ objectFit: "cover" }}
                  priority={t.key === "setup_wrap"}
                />
                {/* darken for readability */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to top, rgba(7,10,16,0.75), rgba(7,10,16,0.10), rgba(7,10,16,0.00))",
                  }}
                />
              </div>

              <div style={{ padding: "14px 14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
                  {t.label}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* mobile stacking */}
      <style>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: repeat(3"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
