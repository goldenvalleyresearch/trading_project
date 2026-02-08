import Link from "next/link";

export default function NewsletterIndexPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#070a10", color: "white", padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>DIAGNOSTIC</div>
        <h1 style={{ fontSize: 28, marginTop: 10 }}>NEWSLETTER ROUTE OK ✅</h1>
        <p style={{ opacity: 0.8, marginTop: 8 }}>
          If you can see this text, /newsletter is rendering <code>src/app/newsletter/page.tsx</code>.
        </p>

        <div style={{ marginTop: 18 }}>
          <Link href="/" style={{ color: "white", textDecoration: "underline" }}>
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
