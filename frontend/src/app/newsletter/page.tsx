import Link from "next/link";

type GroupKey = "setup_wrap" | "monthly_pnl_macro" | "todays_score";

const TILES: { key: GroupKey; label: string; cover: string }[] = [
  { key: "setup_wrap", label: "The Setup & The Wrap", cover: "/images/covers/setup-wrap.jpg" },
  { key: "monthly_pnl_macro", label: "Monthly P&L + Macro", cover: "/images/covers/monthly-macro.jpg" },
  { key: "todays_score", label: "Today’s Score", cover: "/images/covers/todays-score.jpg" },
];

export default function NewsletterIndexPage() {
  return (
    <main className="min-h-screen bg-[#070a10] text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TILES.map((t) => (
            <Link
              key={t.key}
              href={`/newsletter/series/${t.key}`}
              className="
                group block overflow-hidden rounded-2xl
                border border-white/10 bg-white/5
                hover:bg-white/10 transition
                no-underline text-white
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30
              "
            >
              {/* Hard cap: image area can never exceed this */}
              <div
                className="relative h-52 w-full"
                style={{
                  backgroundImage: `url(${t.cover})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {/* Gradient so text looks clean on any photo */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#070a10]/80 via-[#070a10]/20 to-transparent" />
              </div>

              <div className="p-5 text-center">
                <div className="text-base font-semibold tracking-tight">{t.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

