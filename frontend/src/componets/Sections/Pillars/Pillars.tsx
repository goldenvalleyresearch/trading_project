"use client";

import React from "react";
import styles from "./Pillars.module.css";

type Pillar = {
  title: string;
  body: string;
};

const PILLARS: Pillar[] = [
  {
    title: "Transparent Performance",
    body:
      "Track positions, outcomes, and benchmarks with an emphasis on consistency",
  },
  {
    title: "Documented Process",
    body:
      "Each idea is anchored in a written thesis combining fundamentals, technical structure, and defined risk parameters.",
  },
  {
    title: "Continuous Refinement",
    body:
      "Post-trade reviews and ongoing research help evolve the framework as market conditions and evidence change.",
  },
];

export default function Pillars() {
  return (
    <section className={styles.section} aria-label="Platform pillars">
      <div className={styles.inner}>
        <div className={styles.header}>
          <h2 className={styles.h2}>What this platform is built on</h2>
          <p className={styles.lede}>
            A public, process-first archive focused on discipline, learning, and transparency.
          </p>
        </div>

        <div className={styles.grid}>
          {PILLARS.map((p) => (
            <article key={p.title} className={styles.card}>
              <div className={styles.accent} aria-hidden="true" />
              <h3 className={styles.h3}>{p.title}</h3>
              <p className={styles.p}>{p.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}