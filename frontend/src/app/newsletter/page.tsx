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
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-center text-4xl font-semibold tracking-tight">
          Golden Valley Market Research Daily Newsletters
        </h1>

        <div className="mt-14 grid gap-6 sm:grid-cols-1 md:grid-cols-3">
          {groups.map((g) => (
            <Link
              key={g}
              href={groupHref(g)}
              className="
                block rounded-2xl border border-gray-200 bg-white p-6 shadow-sm
                hover:shadow-md transition
                text-black no-underline
              "
            >
              <div className="text-xl font-semibold text-black">
                {groupLabel(g)}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                Click to view posts
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

