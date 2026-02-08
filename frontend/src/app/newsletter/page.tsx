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
    <main className="min-h-screen bg-[#070a10] text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {TILES.map((t) => (
            <Link
              key={t.key}
              href={`/newsletter/series/${t.key}`}
              className="
                group block overflow-hidden rounded-2xl border border-white/10 bg-white/5
                hover:bg-white/10 transition
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30
              "
            >
              {/* Image area: fixed height card */}
              <div className="relative h-48 w-full md:h-56">
                <Image
                  src={t.cover}
                  alt={t.label}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  priority={t.key === "setup_wrap"}
                />
                {/* soft overlay so text area feels premium */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#070a10]/65 via-[#070a10]/10 to-transparent" />
              </div>

              {/* Label BELOW image */}
              <div className="p-5">
                <div className="text-center text-lg font-semibold tracking-tight">
                  {t.label}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
