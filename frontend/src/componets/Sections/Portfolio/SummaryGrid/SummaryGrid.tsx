import styles from "./SummaryGrid.module.css";
import SnapshotCard from "@/componets/UI/SnapshotCard/SnapshotCard";
import StockChart from "@/componets/UI/StockChart/StockChart";

type Summary = {
  note: string;
  href: string;
  ctaLabel: string;
  kpis: Array<{ label: string; value: string }>;
};

type AllocationItem = { label: string; value: string };

type Holding = {
  symbol: string;
  weight?: string;
  __valueN?: number;
};

type Props = {
  summary: Summary;
  topHoldings: Holding[];
  allocation: AllocationItem[];
  chartSymbol?: string;
  money: (n: number) => string;
};

export default function SummaryGrid({
  summary,
  topHoldings,
  allocation,
  chartSymbol,
  money,
}: Props) {
  return (
    <section className={styles.grid2}>
      <div className={styles.cardStack}>
        <SnapshotCard
          note={summary.note}
          href={summary.href}
          kpis={summary.kpis}
          ctaLabel={summary.ctaLabel}
        />

        {topHoldings.length > 0 && (
          <div className={styles.topHoldings}>
            <div className={styles.cardTitle}>Top holdings</div>
            <div className={styles.chips}>
              {topHoldings.map((p) => (
                <div key={p.symbol} className={styles.chip}>
                  <div className={styles.chipSym}>{p.symbol}</div>
                  <div className={styles.chipVal}>
                    {money(Number(p.__valueN ?? NaN))}
                  </div>
                  <div className={styles.chipMeta}>{p.weight ?? "—"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.cardStack}>
        <div className={styles.allocCard}>
          <div className={styles.cardTitle}>Allocation</div>
          <div className={styles.allocGrid}>
            {allocation.map((x) => (
              <div key={x.label} className={styles.allocItem}>
                <div className={styles.k}>{x.label}</div>
                <div className={styles.v}>{x.value}</div>
              </div>
            ))}
          </div>
        </div>

        {chartSymbol ? (
          <StockChart symbol={chartSymbol} defaultRange="6M" height={240} />
        ) : null}
      </div>
    </section>
  );
}