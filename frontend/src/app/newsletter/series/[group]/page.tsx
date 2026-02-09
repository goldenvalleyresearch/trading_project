export default async function NewsletterSeriesPage({
  params,
}: {
  params: { group?: string } | Promise<{ group?: string }>;
}) {
  const p = await Promise.resolve(params as any);

  return (
    <main style={{ minHeight: "100vh", background: "#070a10", color: "white", padding: 32 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: "0.14em" }}>DIAGNOSTIC</div>
        <h1 style={{ fontSize: 36, marginTop: 10 }}>SERIES ROUTE OK ✅</h1>
        <p style={{ marginTop: 12, opacity: 0.85 }}>
          If you can see this, you are rendering:
          <br />
          <code>src/app/newsletter/series/[group]/page.tsx</code>
        </p>
        <p style={{ marginTop: 12, opacity: 0.85 }}>
          group param = <code>{String(p?.group ?? "(missing)")}</code>
        </p>
      </div>
    </main>
  );
}
