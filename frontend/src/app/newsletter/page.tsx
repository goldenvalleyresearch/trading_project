import Link from "next/link";

type GroupKey = "setup_wrap" | "monthly_pnl_macro" | "todays_score";

function groupLabel(key: GroupKey) {
  if (key === "setup_wrap") return "The Setup & The Wrap";
  if (key === "monthly_pnl_macro") return "Monthly P&L + Macro";
  return "Todays Score";
}

function groupHref(key: GroupKey) {
  return `/newsletter/series/${key}`;
}

export default function NewsletterIndexPage() {
  const groups: GroupKey[] = ["setup_wrap", "monthly_pnl_macro", "todays_score"];

  return (
    <main className="min-h-screen bg-[#070a10] text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-center text-4xl font-semibold tracking-tight">
          Golden Valley Market Research Daily Newsletters
        </h1>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {groups.map((g) => (
            <Link
              key={g}
              href={groupHref(g)}
              className="
                block rounded-2xl border border-white/10 bg-white/5 p-6
                hover:bg-white/10 transition
                text-white no-underline visited:text-white
              "
            >
              <div className="text-xl font-semibold">{groupLabel(g)}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
