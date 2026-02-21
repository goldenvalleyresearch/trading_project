"use client";

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
  // “Random-ish” but curated: volatile, generally trending up.
  // Values are in an arbitrary price scale (we map to SVG coords).
  const candles: Candle[] = [
    { o: 100, h: 103, l: 98, c: 101 },
    { o: 101, h: 104, l: 100, c: 103 },
    { o: 103, h: 105, l: 101, c: 102 },
    { o: 102, h: 106, l: 101, c: 105 },
    { o: 105, h: 107, l: 103, c: 104 },
    { o: 104, h: 108, l: 103, c: 107 },
    { o: 107, h: 110, l: 106, c: 108 },
    { o: 108, h: 111, l: 107, c: 109 },
    { o: 109, h: 112, l: 108, c: 111 },
    { o: 111, h: 114, l: 110, c: 112 },
    { o: 112, h: 115, l: 111, c: 113 },
    { o: 113, h: 116, l: 112, c: 115 },
    { o: 115, h: 118, l: 114, c: 117 },
    { o: 117, h: 119, l: 115, c: 116 },
    { o: 116, h: 120, l: 115, c: 119 },
    { o: 119, h: 122, l: 118, c: 121 },
    { o: 121, h: 123, l: 119, c: 120 },
    { o: 120, h: 124, l: 119, c: 123 },
    { o: 123, h: 126, l: 122, c: 125 },
    { o: 125, h: 128, l: 124, c: 127 },
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
    // Higher price => smaller y
    const t = (p - minP) / (maxP - minP || 1);
    return PAD_Y + (1 - t) * plotH;
  };

  const n = candles.length;
  const step = plotW / n;
  const bodyW = Math.max(7, Math.min(12, step * 0.55));
  const x = (i: number) => PAD_X + i * step + step * 0.5;

  // Animation timing
  const candleDelay = 0.22; // seconds between candles printing
  const holdAfter = 0.9;    // pause at end before loop restarts
  const total = n * candleDelay + holdAfter;

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
              // Pass duration to CSS so everything loops cleanly
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
            {/* subtle “glass” card */}
            <rect
              x="0"
              y="0"
              width={W}
              height={H}
              rx="22"
              className={styles.glass}
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

            {/* candles */}
            <g className={styles.candles}>
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
                    style={
                      {
                        ["--i" as any]: i,
                        ["--x" as any]: cx,
                        ["--yBase" as any]: H - PAD_Y, // animate from bottom-ish
                      } as React.CSSProperties
                    }
                  >
                    {/* wick */}
                    <line
                      x1={cx}
                      y1={yH}
                      x2={cx}
                      y2={yL}
                      className={styles.wick}
                    />

                    {/* body */}
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
            </g>

            {/* a “current” marker that also loops */}
            <circle
              cx={x(n - 1)}
              cy={y(candles[n - 1].c)}
              r="4.5"
              className={styles.currentDot}
            />
          </svg>
        </div>
      </div>
    </section>
  );
}