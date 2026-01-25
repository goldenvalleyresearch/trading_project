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
  return x.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
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
  if (a < 25) return styles.gainL1;
  if (a < 50) return styles.gainL2;
  if (a < 75) return styles.gainL3;
  return styles.gainL4;
}

function gainLevelClassFromPct(pctDecimal: number) {
  if (!Number.isFinite(pctDecimal) || pctDecimal === 0) return styles.gainL0;
  const aPct = Math.abs(pctDecimal * 100);
  if (aPct < 5) return styles.gainL1;
  if (aPct < 10) return styles.gainL2;
  if (aPct < 15) return styles.gainL3;
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
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00Z") : new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function daysBetweenUTC(aISO: string, bISO: string) {
  const a = new Date(aISO + "T00:00:00Z").getTime();
  const b = new Date(bISO + "T00:00:00Z").getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return Math.floor((b - a) / (24 * 3600 * 1000));
}

function normalizeRows(rows: Holding[]) {
  return (rows ?? []).map((p: any) => {
    const symbol = String(p.symbol ?? p.ticker ?? "").trim() || "—";
    const qtyRaw = pick(p, "qty", ["quantity"]);
    const qty = parseMoneyLike(qtyRaw);

    const mvRaw = pick(p, "market_value", ["value", "marketValue"]);
    const marketValue = parseMoneyLike(mvRaw);

    const costValueRaw = pick(p, "cost_value", ["costValue", "cost_basis_total", "costBasisTotal"]);
    const costValue = parseMoneyLike(costValueRaw);

    const avgCostRaw = pick(p, "avg_cost", ["avg", "avgCost", "avg_cost_basis", "avgCostBasis"]);
    const avgCost = parseMoneyLike(avgCostRaw);

    const livePriceRaw = pick(p, "current_price", ["live_price", "polygon_price", "last_trade_price"]);
    const snapPriceRaw = pick(p, "last_price", ["price"]);
    const currentPrice = Number.isFinite(parseMoneyLike(livePriceRaw))
      ? parseMoneyLike(livePriceRaw)
      : parseMoneyLike(snapPriceRaw);

    const openedAtISO =
      toISODate(p.opened_at) ??
      toISODate(p.first_seen) ??
      toISODate(p.first_owned) ??
      toISODate(p.firstOwnedAt) ??
      null;

    // ✅ Prefer backend days_held
    const daysHeldRaw = pick(p, "days_held", ["daysHeld"]);
    const daysHeld = parseMoneyLike(daysHeldRaw);

    // (rarely present per-row) snapshot date
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
      __daysHeld: daysHeld,
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

  // ✅ This is your “current market balance” (includes cash)
  const netValue = all.reduce((acc, p) => acc + (Number.isFinite(p.__mv) ? p.__mv : 0), 0);

  // ✅ totals for OPEN positions only (equities)
  const totalOpenDollarGain = equities.reduce((acc, p) => {
    const mv = p.__mv;
    const cost = p.__cost;
    const dg = Number.isFinite(mv) && Number.isFinite(cost) ? mv - cost : NaN;
    return acc + (Number.isFinite(dg) ? dg : 0);
  }, 0);

  // ✅ total % = open $ gain ÷ total portfolio net value (includes cash)
  const totalOpenPctGain =
    Number.isFinite(totalOpenDollarGain) && Number.isFinite(netValue) && netValue !== 0
      ? totalOpenDollarGain / netValue
      : NaN;

  return (
    <>
      {/* Desktop table */}
      <section className={`${styles.card} ${styles.desktopOnly}`}>
        <div className={styles.top}>
          <div>
            <div className={styles.title}>Holdings</div>
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

                    const costPerShare = Number.isFinite(p.__avg)
                      ? p.__avg
                      : Number.isFinite(cost) && Number.isFinite(qty) && qty !== 0
                      ? cost / qty
                      : NaN;

                    const curPx = p.__currentPrice;

                    const dollarGain = Number.isFinite(mv) && Number.isFinite(cost) ? mv - cost : NaN;
                    const pctGain =
                      Number.isFinite(dollarGain) && Number.isFinite(cost) && cost !== 0 ? dollarGain / cost : NaN;

                    const weight =
                      Number.isFinite(mv) && Number.isFinite(netValue) && netValue !== 0 ? mv / netValue : NaN;

                    // ✅ Days held: trust backend first
                    const opened = p.__openedAtISO;
                    const asOf = p.__asOfISO;
                    const todayISO = new Date().toISOString().slice(0, 10);

                    const daysHeld =
                      Number.isFinite(p.__daysHeld)
                        ? p.__daysHeld
                        : opened
                          ? daysBetweenUTC(opened, asOf ?? todayISO)
                          : NaN;

                    return (
                      <tr key={`${p.symbol}-${idx}`}>
                        <td className={styles.sym}>{p.symbol}</td>
                        <td className={styles.num}>{Number.isFinite(qty) ? qty : "—"}</td>
                        <td className={styles.num}>{fmtPrice(costPerShare)}</td>
                        <td className={styles.num}>{fmtPrice(curPx)}</td>
                        <td className={styles.num}>{fmtMoney2(mv)}</td>
                        <td className={styles.num}>{fmtPct(weight)}</td>
                        <td className={styles.num}>{Number.isFinite(daysHeld) ? `${daysHeld}` : "—"}</td>
                        <td className={`${styles.num} ${gainClassDollar(dollarGain)}`}>{fmtMoney2(dollarGain)}</td>
                        <td className={`${styles.num} ${gainClassPct(pctGain)}`}>{fmtPct(pctGain)}</td>
                      </tr>
                    );
                  })}

                  {/* ✅ Totals row for open positions */}
                  <tr className={styles.sectionRow}>
                    <td colSpan={7} className={styles.sectionCell}>
                      Totals (open positions)
                    </td>
                    <td className={`${styles.num} ${gainClassDollar(totalOpenDollarGain)}`}>
                      {fmtMoney2(totalOpenDollarGain)}
                    </td>
                    <td className={`${styles.num} ${gainClassPct(totalOpenPctGain)}`}>
                      {fmtPct(totalOpenPctGain)}
                    </td>
                  </tr>

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
                        const weight =
                          Number.isFinite(mv) && Number.isFinite(netValue) && netValue !== 0 ? mv / netValue : NaN;

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

            {/* ✅ Mobile totals */}
            <div className={styles.mobileSection}>Totals (open positions)</div>
            <div className={styles.mobileRow}>
              <div className={styles.mobileTopLine}>
                <div className={styles.mobileSym}>OPEN P&amp;L</div>
                <div className={`${styles.mobileValue} ${gainClassDollar(totalOpenDollarGain)}`}>
                  {fmtMoney2(totalOpenDollarGain)}
                </div>
              </div>
              <div className={styles.mobileMeta}>
                <div className={styles.mobilePill}>
                  <span className={styles.mobileK}>% (vs net)</span>
                  <span className={`${styles.mobileV} ${gainClassPct(totalOpenPctGain)}`}>{fmtPct(totalOpenPctGain)}</span>
                </div>
              </div>
            </div>

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

  const daysHeld =
    Number.isFinite(p.__daysHeld)
      ? p.__daysHeld
      : opened
        ? daysBetweenUTC(opened, asOf ?? todayISO)
        : NaN;

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
