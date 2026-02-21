"use client";

import React from "react";
import styles from "./Hero.module.css";

type HeroProps = {
  title?: string;
  subtitle?: string;
  asOf?: string;
};

type Candle = {
  o: number;
  h: number;
  l: number;
  c: number;
};

export default function Hero({
  title = "Generating Alpha\nThrough\nAnalysis",
  subtitle = "A research-driven tool designed to surface high-quality stock setups by aligning fundamental strength and technical signals in the same direction, with a disciplined focus on risk.",
  asOf,
}: HeroProps) {
  // Curated sequence: trending up with real runs + real pullbacks
  const candles: Candle[] = [
    // early push (3 greens)
    { o: 100, h: 104, l: 99, c: 103 },
    { o: 103, h: 106, l: 102, c: 105 },
    { o: 105, h: 108, l: 104, c: 107 },

    // sharp pullback (2 reds)
    { o: 107, h: 108, l: 103, c: 104 },
    { o: 104, h: 105, l: 100, c: 101 },

    // bounce + chop
    { o: 101, h: 104, l: 100, c: 103 },
    { o: 103, h: 105, l: 101, c: 102 },
    { o: 102, h: 106, l: 101, c: 105 },

    // grind higher (3 greens)
    { o: 105, h: 108, l: 104, c: 107 },
    { o: 107, h: 110, l: 106, c: 109 },
    { o: 109, h: 112, l: 108, c: 111 },

    // volatility / wick
    { o: 111, h: 114, l: 109, c: 112 },

    // pullback (2 reds, higher low)
    { o: 112, h: 113, l: 109, c: 110 },
    { o: 110, h: 111, l: 107, c: 108 },

    // strong recovery + push to highs (3 greens)
    { o: 108, h: 112, l: 107, c: 111 },
    { o: 111, h: 115, l: 110, c: 114 },
    { o: 114, h: 118, l: 113, c: 117 },

    // brief stall + final push
    { o: 117, h: 119, l: 115, c: 116 },
    { o: 116, h: 121, l: 115, c: 120 },
    { o: 120, h: 124, l: 119, c: 123 },
  ];

  // SVG layout
  const W = 560;
  const H = 360;
  const PAD_X = 42;
  const PAD_Y = 36;

  const minP = Math.min(...candles.map((d) => d.l));
  const maxP = Math.max(...candles.map((d) => d.h));

  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_Y * 2;

  const y = (p: number) => {
    const t = (p - minP) / (maxP - minP || 1);
    return PAD_Y + (1 - t) * plotH;
  };

  const n = candles.length;
  const step = plotW / n;
  const bodyW = Math.max(7, Math.min(12, step * 0.55));
  const x = (i: number) => PAD_X + i * step + step * 0.5;

  // ✅ JS-driven loop (no CSS looping for candle existence)
  const candleDelayMs = 320; // speed of printing each candle
  const holdMs = 1000;       // hold full chart
  const pauseMs = 1200;      // empty pause after clearing

  const [visibleCount, setVisibleCount] = React.useState(0);
  const [cycle, setCycle] = React.useState(0); // forces dot pulse restart cleanly

  React.useEffect(() => {
    let cancelled = false;
    const timeouts: number[] = [];

    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timeouts.push(id);
    };

    const run = () => {
      // start from blank
      setVisibleCount(0);

      // print candles 1-by-1
      for (let i = 1; i <= n; i++) {
        schedule(() => setVisibleCount(i), i * candleDelayMs);
      }

      const printedAt = n * candleDelayMs;

      // hold full chart
      schedule(() => {}, printedAt + holdMs);

      // clear ALL at once
      schedule(() => setVisibleCount(0), printedAt + holdMs);

      // pause empty, then restart
      schedule(() => {
        setCycle((c) => c + 1);
        run();
      }, printedAt + holdMs + pauseMs);
    };

    run();

    return () => {
      cancelled = true;
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [n]);

  const visibleCandles = candles.slice(0, visibleCount);
  const lastIdx = Math.max(0, visibleCount - 1);

  return (
    <section className={styles.hero} aria-label="Hero">
      <div className={styles.bg} aria-hidden="true" />
      <div className={styles.overlay} aria-hidden="true" />

      <div className={styles.inner}>
        <div className={styles.content}>
          <h1 className={styles.title}>
            {title.split("\n").map((line, i) => (
              <span key={i} className={styles.line}>
                {line}
              </span>
            ))}
          </h1>

          <p className={styles.subtitle}>{subtitle}</p>

          {asOf ? (
            <div className={styles.meta}>
              <span className={styles.dot} aria-hidden="true" />
              <span>Last snapshot: {asOf}</span>
            </div>
          ) : null}
        </div>

        <div className={styles.candleWrap} aria-hidden="true">
          <svg
            className={styles.candleSvg}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Animated candlestick chart"
          >
            {/* glass card */}
            <rect x="0" y="0" width={W} height={H} rx="22" className={styles.glass} />

            {/* subtle top-left glass highlight */}
            <path
              d={`M 24 34
                  C 110 10, 210 8, 320 22
                  C 220 46, 140 56, 60 64
                  C 40 62, 28 52, 24 34 Z`}
              className={styles.glassHighlight}
            />

            {/* grid */}
            <g className={styles.grid}>
              {Array.from({ length: 10 }).map((_, i) => {
                const gx = PAD_X + (plotW / 9) * i;
                return <line key={`vx-${i}`} x1={gx} y1={PAD_Y} x2={gx} y2={H - PAD_Y} />;
              })}
              {Array.from({ length: 6 }).map((_, i) => {
                const gy = PAD_Y + (plotH / 5) * i;
                return <line key={`hy-${i}`} x1={PAD_X} y1={gy} x2={W - PAD_X} y2={gy} />;
              })}
            </g>

            {/* candles that actually exist only when “printed” */}
            <g className={styles.candlesGroup}>
              {visibleCandles.map((d, i) => {
                const cx = x(i);
                const yO = y(d.o);
                const yC = y(d.c);
                const yH = y(d.h);
                const yL = y(d.l);

                const top = Math.min(yO, yC);
                const bot = Math.max(yO, yC);
                const bodyH = Math.max(6, bot - top);

                const up = d.c >= d.o;

                return (
                  <g key={i} className={styles.candle}>
                    <line x1={cx} y1={yH} x2={cx} y2={yL} className={styles.wick} />
                    <rect
                      x={cx - bodyW / 2}
                      y={top}
                      width={bodyW}
                      height={bodyH}
                      rx="3"
                      className={up ? styles.bodyUp : styles.bodyDown}
                    />
                  </g>
                );
              })}

              {/* current marker follows last printed candle */}
              {visibleCount > 0 ? (
                <circle
                  key={cycle} // restart pulse each cycle
                  cx={x(lastIdx)}
                  cy={y(candles[lastIdx].c)}
                  r="4.5"
                  className={styles.currentDot}
                />
              ) : null}
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}