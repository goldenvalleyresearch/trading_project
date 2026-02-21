"use client";

import React from "react";
import styles from "./Hero.module.css";

type HeroProps = {
  title?: string;
  subtitle?: string;
  asOf?: string;
};

type Candle = {
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
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

    // pullback (2 reds, but higher low than prior pullback)
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

  // Timing:
  // - candles print during first ~78% of the loop
  // - chart clears instantly at ~79%
  // - remainder is empty pause
  const candleDelay = 0.32;
  const holdAfter = 1.0;

  const printHold = n * candleDelay + holdAfter;
  const total = printHold / 0.79;

  // ✅ This forces a hard remount each loop so candles truly restart from blank
  const [cycle, setCycle] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setCycle((c) => c + 1);
    }, total * 1000);

    return () => window.clearInterval(id);
  }, [total]);

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

        <div
          className={styles.candleWrap}
          style={
            {
              ["--loop" as any]: `${total}s`,
              ["--delayStep" as any]: `${candleDelay}s`,
            } as React.CSSProperties
          }
          aria-hidden="true"
        >
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

            {/* ✅ KEY FIX: remount this whole group each loop */}
            <g key={cycle} className={styles.candlesGroup}>
              {candles.map((d, i) => {
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
                  <g
                    key={i}
                    className={styles.candle}
                    style={{ ["--i" as any]: i } as React.CSSProperties}
                  >
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

              {/* current marker restarts cleanly too */}
              <circle
                cx={x(n - 1)}
                cy={y(candles[n - 1].c)}
                r="4.5"
                className={styles.currentDot}
              />
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}