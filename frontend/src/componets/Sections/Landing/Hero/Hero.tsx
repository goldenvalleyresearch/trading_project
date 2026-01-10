// src/componets/Sections/Hero/Hero.tsx
"use client";

import Image from "next/image";
import styles from "./Hero.module.css";

type HeroProps = {
  bgSrc?: string;
  bgAlt?: string;
  title?: string;
  subtitle?: string;
  ctaHref?: string;
  ctaText?: string;
  asOf?: string;
};

export default function Hero({
  bgSrc = "/landing-hero.jpg",
  bgAlt = "Markets background",
  title = "Generating Alpha\nThrough\nAnalysis",
  subtitle = "A research-driven tool designed to surface high-quality stock setups by aligning fundamental strength and technical signals in the same direction, with a disciplined focus on risk.",
  ctaHref = "/newsletter",
  ctaText = "Get Started Today",
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

          <div className={styles.actions}>
            <a className={styles.primary} href={ctaHref}>
              {ctaText}
            </a>
          </div>

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