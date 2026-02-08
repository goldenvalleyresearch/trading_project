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
      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* FORCE a single clean row */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TILES.map((tile) => (
            <Link
              key={tile.key}
              href={`/newsletter/series/${tile.key}`}
              className="
                block overflow-hidden rounded-2xl
                border border-white/10 bg-white/5
                hover:bg-white/10 transition
                no-underline visited:text-white
              "
            >
              {/* IMAGE — HARD CAPPED HEIGHT */}
              <div className="relative h-48 w-full">
                <Image
                  src={tile.cover}
                  alt={tile.label}
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 33vw, 100vw"
                />

                {/* subtle overlay so text always reads */}
                <div className="absolute inset-0 bg-black/30" />
              </div>

              {/* LABEL */}
              <div className="p-4 text-center">
                <div className="text-lg font-semibold tracking-tight">
                  {tile.label}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
