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

        {/* Orb */}
        <div className={styles.orbWrap} aria-hidden="true">
          <svg className={styles.orbSvg} viewBox="0 0 600 600" role="presentation">
            <defs>
              <radialGradient id="orbFill" cx="62%" cy="46%" r="60%">
                <stop offset="0%" stopColor="rgba(255,215,120,0.45)" />
                <stop offset="55%" stopColor="rgba(255,215,120,0.18)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>

              <radialGradient id="orbShade" cx="38%" cy="36%" r="70%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
                <stop offset="65%" stopColor="rgba(0,0,0,0.10)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.24)" />
              </radialGradient>

              <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="
                    1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 0.55 0"
                  result="glow"
                />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Reusable node */}
              <circle id="node" cx="300" cy="86" r="6.2" />
              <circle id="nodeInner" cx="300" cy="150" r="5.2" />
            </defs>

            {/* Core sphere */}
            <circle cx="300" cy="300" r="245" fill="url(#orbShade)" opacity="0.95" />
            <circle cx="300" cy="300" r="245" fill="url(#orbFill)" opacity="0.9" />

            {/* Latitude rings */}
            <g className={styles.orbLines} filter="url(#softGlow)">
              <circle cx="300" cy="300" r="220" fill="none" />
              <circle cx="300" cy="300" r="190" fill="none" />
              <circle cx="300" cy="300" r="160" fill="none" />
              <circle cx="300" cy="300" r="130" fill="none" />
              <circle cx="300" cy="300" r="100" fill="none" />

              {/* Meridians (ellipses rotated) */}
              <g>
                <ellipse cx="300" cy="300" rx="220" ry="120" fill="none" />
                <ellipse cx="300" cy="300" rx="220" ry="120" fill="none" transform="rotate(30 300 300)" />
                <ellipse cx="300" cy="300" rx="220" ry="120" fill="none" transform="rotate(60 300 300)" />
                <ellipse cx="300" cy="300" rx="220" ry="120" fill="none" transform="rotate(90 300 300)" />
                <ellipse cx="300" cy="300" rx="220" ry="120" fill="none" transform="rotate(120 300 300)" />
                <ellipse cx="300" cy="300" rx="220" ry="120" fill="none" transform="rotate(150 300 300)" />
              </g>

              {/* Tilted great circles for “web” feel */}
              <g opacity="0.9">
                <ellipse cx="300" cy="300" rx="220" ry="150" fill="none" transform="rotate(22 300 300)" />
                <ellipse cx="300" cy="300" rx="220" ry="150" fill="none" transform="rotate(-22 300 300)" />
              </g>
            </g>

            {/* Nodes: outer ring */}
            <g className={styles.orbNodes} filter="url(#softGlow)">
              {Array.from({ length: 24 }).map((_, i) => (
                <use key={`n-${i}`} href="#node" transform={`rotate(${i * 15} 300 300)`} />
              ))}
              {/* Nodes: inner ring */}
              {Array.from({ length: 12 }).map((_, i) => (
                <use key={`ni-${i}`} href="#nodeInner" transform={`rotate(${i * 30} 300 300)`} />
              ))}
            </g>

            {/* Rim */}
            <circle cx="300" cy="300" r="245" className={styles.orbRim} />
          </svg>

          <div className={styles.orbGlass} />
        </div>
      </div>
    </section>
  );
}