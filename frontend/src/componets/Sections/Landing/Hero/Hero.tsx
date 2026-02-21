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

          {/* node network */}
          <g className={styles.orbNet} stroke="rgba(255,215,120,0.28)" strokeWidth="1.4" fill="none">
            <path d="M120 220 L210 150 L320 170 L420 140 L505 220 L450 320 L330 360 L210 330 Z" />
            <path d="M160 360 L240 430 L360 450 L460 400 L430 280 L300 260 L210 300 Z" />
            <path d="M210 150 L300 260 L420 140" />
            <path d="M120 220 L300 260 L505 220" />
            <path d="M210 330 L330 360 L450 320" />
            <path d="M240 430 L330 360 L460 400" />
          </g>

          {/* nodes */}
          <g className={styles.orbNodes} fill="rgba(255,215,120,0.92)">
            <circle cx="120" cy="220" r="5" />
            <circle cx="210" cy="150" r="5" />
            <circle cx="320" cy="170" r="5" />
            <circle cx="420" cy="140" r="5" />
            <circle cx="505" cy="220" r="5" />
            <circle cx="450" cy="320" r="5" />
            <circle cx="330" cy="360" r="5" />
            <circle cx="210" cy="330" r="5" />
            <circle cx="160" cy="360" r="5" />
            <circle cx="240" cy="430" r="5" />
            <circle cx="360" cy="450" r="5" />
            <circle cx="460" cy="400" r="5" />
            <circle cx="300" cy="260" r="4" opacity="0.9" />
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
