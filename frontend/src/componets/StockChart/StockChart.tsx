// new-frontend/src/componets/StockChart/StockChart.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import {
  fetchStockSeries,
  toStockChartPoints,
  type StockRange,
  type StockChartPoint,
} from "../../lib/renderStock";

type Props = {
  symbol: string;
  defaultRange?: StockRange;
  height?: number;
  className?: string;
  endpoint?: string; // default "/api/benchmark/price-series"
};

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatDateLabel(s: string) {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(5, 10);
  return s.slice(0, 10);
}

function formatUpdated(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s).slice(0, 19).replace("T", " ");
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StockChart({
  symbol,
  defaultRange = "6M",
  height = 260,
  className,
  // ✅ your backend route
  endpoint = "/api/benchmark/price-series",
}: Props) {
  const [range, setRange] = useState<StockRange>(defaultRange);
  const [series, setSeries] = useState<StockChartPoint[]>([]);
  const [updated, setUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      const sym = (symbol || "").trim().toUpperCase();
      if (!sym) return;

      setLoading(true);
      setErr("");

      try {
        const backend: any = await fetchStockSeries(sym, range, endpoint);
        if (!alive) return;

        // backend shape expected: { symbol, range, as_of, series:[{date, close}] }
        setUpdated(
          typeof backend?.as_of === "string"
            ? backend.as_of
            : backend?.as_of
            ? String(backend.as_of)
            : null
        );

        setSeries(toStockChartPoints(backend));
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load chart");
        setSeries([]);
        setUpdated(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [symbol, range, endpoint]);

  const stats = useMemo(() => {
    if (!series.length) return null;
    const first = series[0].close;
    const last = series[series.length - 1].close;
    const change = last - first;
    const pct = first !== 0 ? (change / first) * 100 : NaN;
    return { first, last, change, pct };
  }, [series]);

  const sym = (symbol || "").trim().toUpperCase();

  return (
    <div className={`${styles.card} ${className ?? ""}`}>
      <div className={styles.topRow}>
        <div className={styles.title}>{sym ? `${sym} price` : "Price chart"}</div>

        <div className={styles.rangeRow} aria-label="Chart range">
          {(["1M", "3M", "6M", "1Y", "5Y"] as StockRange[]).map((r) => (
            <button
              key={r}
              className={`${styles.rangeBtn} ${
                r === range ? styles.rangeBtnActive : ""
              }`}
              onClick={() => setRange(r)}
              type="button"
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.metaRow}>
        <div className={styles.metaItem}>
          <span className={styles.metaK}>Last</span>
          <span className={styles.metaV}>{stats ? formatMoney(stats.last) : "—"}</span>
        </div>

        <div className={styles.metaItem}>
          <span className={styles.metaK}>Change</span>
          <span className={styles.metaV}>
            {stats
              ? `${formatMoney(stats.change)} (${
                  Number.isFinite(stats.pct) ? stats.pct.toFixed(2) : "—"
                }%)`
              : "—"}
          </span>
        </div>

        {/* ✅ shows backend cache timestamp */}
        <div className={styles.metaItem}>
          <span className={styles.metaK}>Updated</span>
          <span className={styles.metaV}>{formatUpdated(updated)}</span>
        </div>

        <div className={styles.metaRight}>
          {loading && <span className={styles.status}>Loading…</span>}
          {err && <span className={styles.statusErr}>⚠ {err}</span>}
        </div>
      </div>

      <div className={styles.chartWrap} style={{ height }}>
        {series.length === 0 ? (
          <div className={styles.empty}>
            {loading ? "Loading chart…" : "No chart data yet."}
            <div className={styles.emptyHint}>
              Make sure <span className={styles.mono}>{endpoint}</span> returns{" "}
              <span className={styles.mono}>{"{ series: [{date, close}] }"}</span>.
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                minTickGap={18}
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.75)" }}
              />
              <YAxis
                width={46}
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.75)" }}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(12,12,14,0.95)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 12,
                  color: "white",
                }}
                labelFormatter={(label) => `Date: ${String(label).slice(0, 10)}`}
                formatter={(value: any) => [formatMoney(Number(value)), "Close"]}
              />
              <Line type="monotone" dataKey="close" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}