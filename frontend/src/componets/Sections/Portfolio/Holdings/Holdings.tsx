import styles from "./Holdings.module.css";

type Holding = any;

type Props = {
  rows: Holding[];
};

function parseMoneyLike(x: any): number {
  if (x == null) return NaN;
  if (typeof x === "number") return x;
  const s = String(x).trim();
  if (!s) return NaN;

  const negParen = s.startsWith("(") && s.endsWith(")");
  const cleaned = s.replace(/[()$,%]/g, "").replace(/,/g, "").trim();
  const v = Number(cleaned);
  if (!Number.isFinite(v)) return NaN;
  return negParen ? -v : v;
}

function pick(p: any, key: string, altKeys?: string[]) {
  const v = p?.[key];
  if (v != null && String(v).trim() !== "") return v;
  for (const k of altKeys ?? []) {
    const vv = p?.[k];
    if (vv != null && String(vv).trim() !== "") return vv;
  }
  return null;
}

function fmtMoney2(x: number) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function fmtPrice(x: number) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function fmtPct(x: number) {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(2)}%`;
}

function gainDirClass(v: number) {
  if (!Number.isFinite(v) || v === 0) return "";
  return v > 0 ? styles.gainPos : styles.gainNeg;
}

function gainLevelClassFromDollar(d: number) {
  if (!Number.isFinite(d) || d === 0) return styles.gainL0;
  const a = Math.abs(d);

  // $ tranches: 0–25, 25–50, 50–75, 75+
  if (a < 25) return styles.gainL1;
  if (a < 50) return styles.gainL2;
  if (a < 75) return styles.gainL3;
  return styles.gainL4;
}

function gainLevelClassFromPct(pctDecimal: number) {
  if (!Number.isFinite(pctDecimal) || pctDecimal === 0) return styles.gainL0;
  const aPct = Math.abs(pctDecimal * 100);

  // % tranches: 0–5, 5–10, 10–15, 15–20, 20+
  if (aPct < 5) return styles.gainL1;
  if (aPct < 10) return styles.gainL2;
  if (aPct < 15) return styles.gainL2; // keep same as 5–10 (still “moderate”)
  if (aPct < 20) return styles.gainL3;
  return styles.gainL4;
}

function gainClassDollar(d: number) {
  return [styles.gainCell, gainDirClass(d), gainLevelClassFromDollar(d)].filter(Boolean).join(" ");
}

function gainClassPct(p: number) {
  return [styles.gainCell, gainDirClass(p), gainLevelClassFromPct(p)].filter(Boolean).join(" ");
}

function toISODate(x: any): string | null {
  if (!x) return null;
  const s = String(x).trim();
  if (!s) return null;
  // accept "YYYY-MM-DD" or ISO
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00Z") : new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function daysBetweenUTC(aISO: string, bISO: string) {
  const a = new Date(aISO + "T00:00:00Z").getTime();
  const b = new Date(bISO + "T00:00:00Z").getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  const diff = Math.floor((b - a) / (24 * 3600 * 1000));
  return diff;
}

function normalizeRows(rows: Holding[]) {
  return (rows ?? []).map((p: any) => {
    const symbol = String(p.symbol ?? p.ticker ?? "").trim() || "—";
    const qtyRaw = pick(p, "qty", ["quantity"]);
    const qty = parseMoneyLike(qtyRaw);

    // Market value from snapshot
    const mvRaw = pick(p, "market_value", ["value", "marketValue"]);
    const marketValue = parseMoneyLike(mvRaw);

    // Total cost basis (Cost Basis Total) from ingest
    const costValueRaw = pick(p, "cost_value", ["costValue", "cost_basis_total", "costBasisTotal"]);
    const costValue = parseMoneyLike(costValueRaw);

    // Avg cost from ingest (Average Cost Basis)
    const avgCostRaw = pick(p, "avg_cost", ["avg", "avgCost", "avg_cost_basis", "avgCostBasis"]);
    const avgCost = parseMoneyLike(avgCostRaw);

    // "Current Price" preference order:
    // 1) live price fields (if backend adds them)
    // 2) snapshot last_price / price
    const livePriceRaw = pick(p, "current_price", ["live_price", "polygon_price", "last_trade_price"]);
    const snapPriceRaw = pick(p, "last_price", ["price"]);
    const currentPrice = Number.isFinite(parseMoneyLike(livePriceRaw))
      ? parseMoneyLike(livePriceRaw)
      : parseMoneyLike(snapPriceRaw);

    // Opened/first owned date (needs backend to populate; otherwise "—")
    const openedAtISO =
      toISODate(p.opened_at) ??
      toISODate(p.first_seen) ??
      toISODate(p.first_owned) ??
      toISODate(p.firstOwnedAt) ??
      null;

    // as_of (snapshot date) might exist on each row; fallback from parent if you later pass it
    const asOfISO = toISODate(p.as_of) ?? null;

    const isCash = String(symbol).includes("*");

    return {
      ...p,
      symbol,
      __qty: qty,
      __mv: marketValue,
      __cost: costValue,
      __avg: avgCost,
      __currentPrice: currentPrice,
      __openedAtISO: openedAtISO,
      __asOfISO: asOfISO,
      __isCash: isCash,
    };
  });
}

export default function Holdings({ rows }: Props) {
  const all = normalizeRows(rows);

  const equities = all.filter((p) => !p.__isCash);
  const cash = all.filter((p) => p.__isCash);

  const hasRows = all.length > 0;

  // Portfolio net value for weight calc (sum of market values; includes cash positions)
  const netValue = all.reduce((acc, p) => acc + (Number.isFinite(p.__mv) ? p.__mv : 0), 0);

  return (
    <>
      {/* Desktop table */}
      <section className={`${styles.card} ${styles.desktopOnly}`}>
        <div className={styles.top}>
          <div>
            <div className={styles.title}>Holdings</div>
            <div className={styles.sub}>Includes cash. Weight = market value ÷ portfolio net value.</div>
          </div>
          <span className={styles.badge}>Positions</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Symbol</th>
                <th className={styles.num}>Qty</th>
                <th className={styles.num}>Cost/Share</th>
                <th className={styles.num}>Current Price</th>
                <th className={styles.num}>Market Value</th>
                <th className={styles.num}>Weight</th>
                <th className={styles.num}>Days Held</th>
                <th className={styles.num}>$ Gain</th>
                <th className={styles.num}>% Gain</th>
              </tr>
            </thead>

            <tbody>
              {!hasRows ? (
                <tr>
                  <td colSpan={9} className={styles.empty}>
                    No positions yet. Upload a positions CSV, then refresh.
                  </td>
                </tr>
              ) : (
                <>
                  {equities.map((p: any, idx: number) => {
                    const qty = p.__qty;
                    const mv = p.__mv;
                    const cost = p.__cost;

                    // cost/share: prefer avg_cost; else cost_value / qty
                    const costPerShare = Number.isFinite(p.__avg)
                      ? p.__avg
                      : Number.isFinite(cost) && Number.isFinite(qty) && qty !== 0
                      ? cost / qty
                      : NaN;

                    const curPx = p.__currentPrice;

                    // gains: use market value - cost basis total when available
                    const dollarGain = Number.isFinite(mv) && Number.isFinite(cost) ? mv - cost : NaN;
                    const pctGain = Number.isFinite(dollarGain) && Number.isFinite(cost) && cost !== 0 ? dollarGain / cost : NaN;

                    const weight = Number.isFinite(mv) && Number.isFinite(netValue) && netValue !== 0 ? mv / netValue : NaN;

                    // days held: requires opened_at + as_of (or today)
                    const opened = p.__openedAtISO;
                    const asOf = p.__asOfISO; // if not available, we can use today
                    const todayISO = new Date().toISOString().slice(0, 10);
                    const daysHeld =
                      opened ? daysBetweenUTC(opened, asOf ?? todayISO) : NaN;

                    return (
                      <tr key={`${p.symbol}-${idx}`}>
                        <td className={styles.sym}>{p.symbol}</td>
                        <td className={styles.num}>{Number.isFinite(qty) ? qty : "—"}</td>
                        <td className={styles.num}>{fmtPrice(costPerShare)}</td>
                        <td className={styles.num}>{fmtPrice(curPx)}</td>
                        <td className={styles.num}>{fmtMoney2(mv)}</td>
                        <td className={styles.num}>{fmtPct(weight)}</td>
                        <td className={styles.num}>{Number.isFinite(daysHeld) ? `${daysHeld}` : "—"}</td>
                        <td className={`${styles.num} ${gainClassDollar(dollarGain)}`}>
                          {fmtMoney2(dollarGain)}
                        </td>
                        <td className={`${styles.num} ${gainClassPct(pctGain)}`}>
                          {fmtPct(pctGain)}
                        </td>

                      </tr>
                    );
                  })}

                  {cash.length > 0 && (
                    <>
                      <tr className={styles.sectionRow}>
                        <td colSpan={9} className={styles.sectionCell}>
                          Cash & sweep
                        </td>
                      </tr>

                      {cash.map((p: any, idx: number) => {
                        const qty = p.__qty;
                        const mv = p.__mv;
                        const weight = Number.isFinite(mv) && Number.isFinite(netValue) && netValue !== 0 ? mv / netValue : NaN;

                        return (
                          <tr key={`${p.symbol}-${idx}`} className={styles.cashRow}>
                            <td className={styles.sym}>{p.symbol}</td>
                            <td className={styles.num}>{Number.isFinite(qty) ? qty : "—"}</td>
                            <td className={styles.num}>—</td>
                            <td className={styles.num}>—</td>
                            <td className={styles.num}>{fmtMoney2(mv)}</td>
                            <td className={styles.num}>{fmtPct(weight)}</td>
                            <td className={styles.num}>—</td>
                            <td className={styles.num}>—</td>
                            <td className={styles.num}>—</td>
                          </tr>
                        );
                      })}
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
              <MobileRow key={`${p.symbol}-${idx}`} p={p} netValue={netValue} />
            ))}

            {cash.length > 0 && <div className={styles.mobileSection}>Cash & sweep</div>}
            {cash.map((p: any, idx: number) => (
              <MobileRow key={`${p.symbol}-${idx}`} p={p} netValue={netValue} isCash />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function MobileRow({ p, netValue, isCash }: { p: any; netValue: number; isCash?: boolean }) {
  const qty = p.__qty;
  const mv = p.__mv;
  const cost = p.__cost;

  const costPerShare = Number.isFinite(p.__avg)
    ? p.__avg
    : Number.isFinite(cost) && Number.isFinite(qty) && qty !== 0
    ? cost / qty
    : NaN;

  const curPx = p.__currentPrice;

  const dollarGain = Number.isFinite(mv) && Number.isFinite(cost) ? mv - cost : NaN;
  const pctGain = Number.isFinite(dollarGain) && Number.isFinite(cost) && cost !== 0 ? dollarGain / cost : NaN;

  const weight = Number.isFinite(mv) && Number.isFinite(netValue) && netValue !== 0 ? mv / netValue : NaN;

  const opened = p.__openedAtISO;
  const asOf = p.__asOfISO;
  const todayISO = new Date().toISOString().slice(0, 10);
  const daysHeld = opened ? daysBetweenUTC(opened, asOf ?? todayISO) : NaN;

  return (
    <div className={`${styles.mobileRow} ${isCash ? styles.mobileCash : ""}`}>
      <div className={styles.mobileTopLine}>
        <div className={styles.mobileSym}>{p.symbol || "—"}</div>
        <div className={styles.mobileValue}>{fmtMoney2(mv)}</div>
      </div>

      <div className={styles.mobileMeta}>
        <div className={styles.mobilePill}>
          <span className={styles.mobileK}>Qty</span>
          <span className={styles.mobileV}>{Number.isFinite(qty) ? String(qty) : "—"}</span>
        </div>

        {!isCash && (
          <>
            <div className={styles.mobilePill}>
              <span className={styles.mobileK}>Cost/Share</span>
              <span className={styles.mobileV}>{fmtPrice(costPerShare)}</span>
            </div>

            <div className={styles.mobilePill}>
              <span className={styles.mobileK}>Price</span>
              <span className={styles.mobileV}>{fmtPrice(curPx)}</span>
            </div>

            <div className={styles.mobilePill}>
              <span className={styles.mobileK}>Wt</span>
              <span className={styles.mobileV}>{fmtPct(weight)}</span>
            </div>

            <div className={styles.mobilePill}>
              <span className={styles.mobileK}>Days</span>
              <span className={styles.mobileV}>{Number.isFinite(daysHeld) ? String(daysHeld) : "—"}</span>
            </div>

            <div className={styles.mobilePill}>
              <span className={styles.mobileK}>$ Gain</span>
              <span className={`${styles.mobileV} ${gainClassDollar(dollarGain)}`}>{fmtMoney2(dollarGain)}</span>
            </div>

            <div className={styles.mobilePill}>
              <span className={styles.mobileK}>% Gain</span>
              <span className={`${styles.mobileV} ${gainClassPct(pctGain)}`}>{fmtPct(pctGain)}</span>
            </div>

          </>
        )}

        {isCash && (
          <div className={styles.mobilePill}>
            <span className={styles.mobileK}>Wt</span>
            <span className={styles.mobileV}>{fmtPct(weight)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
