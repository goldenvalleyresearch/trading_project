// src/app/research/page.tsx
import React, { Suspense } from "react";
import styles from "./page.module.css";
import ResearchClient from "./ResearchClient";

export default function ResearchPage() {
  return (
    <div className={styles.page}>
      <Suspense fallback={<div className={styles.main}>Loading…</div>}>
        <ResearchClient />
      </Suspense>
    </div>
  );
}