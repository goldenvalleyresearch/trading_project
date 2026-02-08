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
    <main className="min-h-screen bg-[#070a10] text-white overflow-hidden">
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TILES.map((t) => (
            <Link
              key={t.key}
              href={`/newsletter/series/${t.key}`}
              className="
                group block overflow-hidden rounded-2xl
                border border-white/10 bg-white/5
                hover:bg-white/10 transition
                text-white no-underline visited:text-white hover:text-white
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30
              "
            >
              {/* HARD HEIGHT CAP so the image can never take over the page */}
              <div className="relative h-56 w-full">
                <Image
                  src={t.cover}
                  alt={t.label}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover"
                  priority={t.key === "setup_wrap"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070a10]/70 via-[#070a10]/15 to-transparent" />
              </div>

              <div className="p-5 text-center">
                <div className="text-lg font-semibold tracking-tight">{t.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
