import Link from "next/link";
import Image from "next/image";

type GroupKey = "setup_wrap" | "monthly_pnl_macro" | "todays_score";

const TILES: { key: GroupKey; label: string; cover: string }[] = [
  {
    key: "setup_wrap",
    label: "The Setup & The Wrap",
    cover: "/images/covers/setup-wrap.jpg",
  },
  {
    key: "monthly_pnl_macro",
    label: "Monthly P&L + Macro",
    cover: "/images/covers/monthly-macro.jpg",
  },
  {
    key: "todays_score",
    label: "Today’s Score",
    cover: "/images/covers/todays-score.jpg",
  },
];

export default function NewsletterIndexPage() {
  return (
    <main className="min-h-screen bg-[#070a10] text-white">
      <div className="mx-auto max-w-6xl px-6 py-24">
        {/* 3-tile grid */}
        <div
          data-grid="newsletter"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 20,
          }}
        >
          {TILES.map((t) => (
            <Link
              key={t.key}
              href={`/newsletter/series/${t.key}`}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
            >
              {/* Image container — hard height cap */}
              <div className="relative h-56 w-full">
                <Image
                  src={t.cover}
                  alt={t.label}
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  priority={t.key === "setup_wrap"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070a10]/70 via-transparent to-transparent" />
              </div>

              {/* Label */}
              <div className="py-4 text-center">
                <div className="text-lg font-semibold tracking-tight">
                  {t.label}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Mobile fallback */}
        <style>{`
          @media (max-width: 900px) {
            div[data-grid="newsletter"] {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </main>
  );
}
