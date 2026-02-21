// src/componets/Sections/Landing/Hero/Hero.tsx
"use client";

import Image from "next/image";
import styles from "./Hero.module.css";

type HeroProps = {
  bgSrc?: string;
  bgAlt?: string;
  title?: string;
  subtitle?: string;
  asOf?: string;
};

export default function Hero({
  bgSrc = "/landing-hero.jpg",
  bgAlt = "Markets background",
  title = "Generating Alpha\nThrough\nAnalysis",
  subtitle = "A research-driven tool designed to surface high-quality stock setups by aligning fundamental strength and technical signals in the same direction, with a disciplined focus on risk.",
  asOf,
}: HeroProps) {
  return (
    <section className={styles.hero} aria-label="Hero">
      {/* Background layer (we're not using the image right now, but leaving it supported) */}
      <div className={styles.bg} aria-hidden="true">
        {/* If you want to re-enable image later, switch bgImg back on in CSS */}
        <Image
          src={bgSrc}
          alt={bgAlt}
          fill
          priority
          sizes="100vw"
          className={styles.bgImg}
        />
      </div>

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
        <div className={styles.chartWrap} aria-hidden="true">
          <svg
            className={styles.chartSvg}
            viewBox="0 0 800 500"
            preserveAspectRatio="none"
          >
            {/* Grid */}
            <g className={styles.grid}>
              {Array.from({ length: 8 }).map((_, i) => (
                <line
                  key={`h-${i}`}
                  x1="0"
                  y1={i * 70}
                  x2="800"
                  y2={i * 70}
                />
              ))}
              {Array.from({ length: 12 }).map((_, i) => (
                <line
                  key={`v-${i}`}
                  x1={i * 70}
                  y1="0"
                  x2={i * 70}
                  y2="500"
                />
              ))}
            </g>

            {/* Equity Curve */}
            <path
              className={styles.equityLine}
              d="
                M 0 420
                C 120 410, 180 390, 240 370
                S 380 320, 450 300
                S 560 240, 650 220
                S 740 160, 800 120
              "
            />

            {/* Glow Point */}
            <circle
              className={styles.currentPoint}
              cx="800"
              cy="120"
              r="6"
            />
          </svg>
        </div>
      </div>
    </section>
  );
}