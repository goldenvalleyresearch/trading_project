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
        <div className="grid gap-5 md:grid-cols-3">
          {TILES.map((t) => (
            <Link
              key={t.key}
              href={`/newsletter/series/${t.key}`}
              className="
                group block overflow-hidden rounded-2xl border border-white/10 bg-white/5
                hover:bg-white/10 transition
                text-white no-underline
              "
            >
              {/* hard cap: image can never exceed 190px tall */}
              <div className="relative h-[190px] w-full overflow-hidden">
                <img
                  src={t.cover}
                  alt={t.label}
                  className="h-full w-full object-cover block"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070a10]/70 via-[#070a10]/10 to-transparent" />
              </div>

              <div className="p-4 text-center">
                <div className="text-lg font-semibold tracking-tight">{t.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
