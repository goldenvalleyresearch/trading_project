import styles from "./Holdings.module.css";

type Holding = any;

type Props = {
  rows: Holding[];
};

const DEFAULT_COLS = [
  { key: "symbol", label: "Symbol", type: "text" as const },
  { key: "name", label: "Name", type: "text" as const },
  { key: "qty", label: "Qty", type: "num" as const, altKeys: ["quantity"] },
  { key: "price", label: "Price", type: "num" as const, altKeys: ["last_price"] },
  { key: "value", label: "Value", type: "num" as const, altKeys: ["market_value"] },
  { key: "weight", label: "Weight", type: "num" as const },
];

function parseMoneyLike(x: any): number {
  if (x == null) return NaN;
  if (typeof x === "number") return x;
  const s = String(x).trim();
  if (!s) return NaN;
  const neg = s.startsWith("(") && s.endsWith(")");
  const cleaned = s.replace(/[()$,%]/g, "").replace(/,/g, "").trim();
  const v = Number(cleaned);
  if (!Number.isFinite(v)) return NaN;
  return neg ? -v : v;
}

function fmtPriceUpdated(s: any) {
  if (!s) return "—";

  const raw = String(s).trim();
  if (!raw) return "—";

  let d: Date;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    d = new Date(raw + "T12:00:00");
  } else {
    d = new Date(raw);
  }

  if (!Number.isFinite(d.getTime())) return raw.slice(0, 19).replace("T", " ");

  return d.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtCompactMoney(x: any) {
  const n = parseMoneyLike(x);
  if (!Number.isFinite(n)) return String(x ?? "—") || "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function pick(p: any, key: string, altKeys?: string[]) {
  const v = p?.[key];
  if (v != null && String(v).trim() !== "") return v;
  for (const k of altKeys ?? []) {
    const vv = p?.[k];
    if (vv != null && String(vv).trim() !== "") return vv;
  }
  return "—";
}

function normalizeRows(rows: Holding[]) {
  return (rows ?? []).map((p: any) => {
    const symbol = String(p.symbol ?? p.ticker ?? "").trim() || "—";

    const priceUpdated =
      p.price_as_of ??
      p.priceAsOf ??
      p.last_price_as_of ??
      p.lastPriceAsOf ??
      p.updated_at ??
      p.updatedAt ??
      null;

    const name = String(p.name ?? "").trim();

    return {
      ...p,
      symbol,
      name,
      __priceUpdated: priceUpdated,
      __isCash: String(symbol).includes("*"),
    };
  });
}

export default function Holdings({ rows }: Props) {
  const all = normalizeRows(rows);
  const equities = all.filter((p) => !p.__isCash);
  const cash = all.filter((p) => p.__isCash);

  const hasRows = all.length > 0;

  return (
    <>
      {/* Desktop table */}
      <section className={`${styles.card} ${styles.desktopOnly}`}>
        <div className={styles.top}>
          <div>
            <div className={styles.title}>Holdings</div>
            <div className={styles.sub}>Includes cash.</div>
          </div>
          <span className={styles.badge}>Positions</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {DEFAULT_COLS.map((c) => (
                  <th key={c.key} className={c.type === "num" ? styles.num : undefined}>
                    {c.label}
                  </th>
                ))}
                <th className={styles.num}>Updated</th>
              </tr>
            </thead>

            <tbody>
              {!hasRows ? (
                <tr>
                  <td colSpan={DEFAULT_COLS.length + 1} className={styles.empty}>
                    No positions yet. Upload a positions CSV, then refresh.
                  </td>
                </tr>
              ) : (
                <>
                  {equities.map((p: any, idx: number) => (
                    <tr key={`${p.symbol}-${idx}`}>
                      <td className={styles.sym}>{p.symbol}</td>
                      <td className={styles.name}>{p.name || "—"}</td>
                      <td className={styles.num}>{pick(p, "qty", ["quantity"])}</td>
                      <td className={styles.num}>{pick(p, "price", ["last_price"])}</td>
                      <td className={styles.num}>{pick(p, "value", ["market_value"])}</td>
                      <td className={styles.num}>{pick(p, "weight")}</td>
                      <td className={styles.num}>{fmtPriceUpdated(p.__priceUpdated)}</td>
                    </tr>
                  ))}

                  {cash.length > 0 && (
                    <>
                      <tr className={styles.sectionRow}>
                        <td colSpan={DEFAULT_COLS.length + 1} className={styles.sectionCell}>
                          Cash & sweep
                        </td>
                      </tr>

                      {cash.map((p: any, idx: number) => (
                        <tr key={`${p.symbol}-${idx}`} className={styles.cashRow}>
                          <td className={styles.sym}>{p.symbol}</td>
                          <td className={styles.name}>{p.name || "—"}</td>
                          <td className={styles.num}>{pick(p, "qty", ["quantity"])}</td>
                          <td className={styles.num}>{pick(p, "price", ["last_price"])}</td>
                          <td className={styles.num}>{pick(p, "value", ["market_value"])}</td>
                          <td className={styles.num}>{pick(p, "weight")}</td>
                          <td className={styles.num}>{fmtPriceUpdated(p.__priceUpdated)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mobile list */}
      <section className={`${styles.card} ${styles.mobileOnly}`}>
        <div className={styles.top}>
          <div>
            <div className={styles.title}>Holdings</div>
            <div className={styles.sub}>Includes cash.</div>
          </div>
          <span className={styles.badge}>Positions</span>
        </div>

        {!hasRows ? (
          <div className={styles.mobileEmpty}>No positions yet. Upload a positions CSV, then refresh.</div>
        ) : (
          <div className={styles.mobileList}>
            {equities.length > 0 && <div className={styles.mobileSection}>Stocks</div>}
            {equities.map((p: any, idx: number) => (
              <MobileRow key={`${p.symbol}-${idx}`} p={p} />
            ))}

            {cash.length > 0 && <div className={styles.mobileSection}>Cash & sweep</div>}
            {cash.map((p: any, idx: number) => (
              <MobileRow key={`${p.symbol}-${idx}`} p={p} isCash />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function MobileRow({ p, isCash }: { p: any; isCash?: boolean }) {
  const qty = pick(p, "qty", ["quantity"]);
  const price = pick(p, "price", ["last_price"]);
  const value = pick(p, "value", ["market_value"]);
  const weight = pick(p, "weight");
  const updated = fmtPriceUpdated(p.__priceUpdated);

  return (
    <div className={`${styles.mobileRow} ${isCash ? styles.mobileCash : ""}`}>
      <div className={styles.mobileTopLine}>
        <div className={styles.mobileSym}>{p.symbol || "—"}</div>
        <div className={styles.mobileValue}>{fmtCompactMoney(value)}</div>
      </div>

      <div className={styles.mobileName}>{p.name || "—"}</div>

      <div className={styles.mobileMeta}>
        <div className={styles.mobilePill}>
          <span className={styles.mobileK}>Qty</span>
          <span className={styles.mobileV}>{String(qty)}</span>
        </div>
        <div className={styles.mobilePill}>
          <span className={styles.mobileK}>Price</span>
          <span className={styles.mobileV}>{String(price)}</span>
        </div>
        <div className={styles.mobilePill}>
          <span className={styles.mobileK}>Wt</span>
          <span className={styles.mobileV}>{String(weight)}</span>
        </div>
      </div>

      <div className={styles.mobileUpdated}>Updated: {updated}</div>
    </div>
  );
}