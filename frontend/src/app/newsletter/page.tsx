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
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t) => (
            <Link
              key={t.key}
              href={`/newsletter/series/${t.key}`}
              className="
                group block overflow-hidden rounded-2xl border border-white/10 bg-white/5
                hover:bg-white/10 transition
                text-white no-underline visited:text-white hover:text-white
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30
              "
            >
              {/* Image has a fixed-height container so it can’t take over the page */}
              <div className="relative h-56 w-full">
                <Image
                  src={t.cover}
                  alt={t.label}
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover opacity-95 transition group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070a10]/75 via-[#070a10]/10 to-transparent" />
              </div>

              <div className="p-5">
                <div className="text-lg font-semibold tracking-tight">{t.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
