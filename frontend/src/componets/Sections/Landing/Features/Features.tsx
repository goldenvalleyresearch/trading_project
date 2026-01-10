"use client";

import styles from "./Features.module.css";
import FeatureCard from "../../../UI/FeatureCard/FeatureCard";

const ITEMS = [
  {
    title: "Performance",
    body: "Full equity curve and benchmarks — explained weekly in the newsletter.",
    href: "/newsletter",
    linkLabel: "Get the recap",
  },
  {
    title: "Transparency",
    body: "Daily snapshots and receipts, summarized every week.",
    href: "/newsletter",
    linkLabel: "Subscribe",
  },
  {
    title: "Newsletter",
    body: "Weekly recap of what changed + why (no cherry-picking).",
    href: "/newsletter",
    linkLabel: "Subscribe",
  },
];

export default function Features() {
  return (
    <section className={styles.grid}>
      {ITEMS.map((it) => (
        <FeatureCard
          key={it.title}
          title={it.title}
          body={it.body}
          href={it.href}
          linkLabel={it.linkLabel}
        />
      ))}
    </section>
  );
}