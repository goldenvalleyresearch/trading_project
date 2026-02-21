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
      <div className={styles.bg} aria-hidden="true">
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
      {/* Decorative orb */}
      <div className={styles.orbWrap} aria-hidden="true">
        <svg
          className={styles.orb}
          viewBox="0 0 600 600"
          role="presentation"
          focusable="false"
        >
          <defs>
            <radialGradient id="gv9Glow" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="rgba(255,215,120,0.55)" />
              <stop offset="55%" stopColor="rgba(255,215,120,0.18)" />
              <stop offset="100%" stopColor="rgba(255,215,120,0.00)" />
            </radialGradient>

            <linearGradient id="gv9Stroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,215,120,0.92)" />
              <stop offset="55%" stopColor="rgba(255,215,120,0.38)" />
              <stop offset="100%" stopColor="rgba(255,215,120,0.14)" />
            </linearGradient>
          </defs>

          {/* soft glow */}
          <circle cx="300" cy="300" r="220" fill="url(#gv9Glow)" />

          {/* rings */}
          <g className={styles.orbRings} fill="none" stroke="url(#gv9Stroke)">
            <circle cx="300" cy="300" r="210" strokeWidth="2" opacity="0.55" />
            <ellipse cx="300" cy="300" rx="220" ry="120" strokeWidth="2" opacity="0.40" />
            <ellipse cx="300" cy="300" rx="220" ry="120" strokeWidth="2" opacity="0.22" transform="rotate(60 300 300)" />
            <ellipse cx="300" cy="300" rx="220" ry="120" strokeWidth="2" opacity="0.22" transform="rotate(120 300 300)" />
          </g>

          {/* clean network (more geometric, less messy) */}
          <g className={styles.orbNet} fill="none" stroke="rgba(255,215,120,0.22)" strokeWidth="1.25">
            {/* latitude-like arcs */}
            <path d="M100 300 C180 210, 420 210, 500 300" />
            <path d="M100 300 C180 390, 420 390, 500 300" />

            {/* diagonal arcs */}
            <path d="M150 190 C260 260, 340 260, 450 190" />
            <path d="M150 410 C260 340, 340 340, 450 410" />

            {/* a few clean connections */}
            <path d="M200 170 L300 240 L400 170" />
            <path d="M170 300 L300 300 L430 300" />
            <path d="M200 430 L300 360 L400 430" />
          </g>

          {/* nodes (fewer + intentional) */}
          <g className={styles.orbNodes} fill="rgba(255,215,120,0.92)">
            <circle cx="150" cy="190" r="5" />
            <circle cx="300" cy="160" r="5" />
            <circle cx="450" cy="190" r="5" />

            <circle cx="170" cy="300" r="5" />
            <circle cx="300" cy="300" r="6" />
            <circle cx="430" cy="300" r="5" />

            <circle cx="200" cy="430" r="5" />
            <circle cx="300" cy="450" r="5" />
            <circle cx="400" cy="430" r="5" />
          </g>
        </svg>
      </div>
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
      </div>
    </section>
  );
}
