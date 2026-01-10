"use client";

import React from "react";
import styles from "./UploadPageHeader.module.css";

type Props = {
  busy: boolean;
  onRefresh: () => void;
  backHref?: string;
};

export default function UploadPageHeader({ busy, onRefresh, backHref = "/portfolio" }: Props) {
  return (
    <div className={styles.top}>
      <div>
        <h1 className={styles.h1}>Admin Upload Center</h1>
        <p className={styles.sub}>
          Upload the right file to the right section.{" "}
          <span className={styles.mono}>Positions</span> = current holdings.{" "}
          <span className={styles.mono}>Performance</span> = balance history over time.
        </p>
      </div>

      <div className={styles.topRight}>
        <button className={styles.refreshBtn} type="button" onClick={onRefresh} disabled={busy}>
          Refresh status
        </button>
        <a className={styles.backBtn} href={backHref}>
          Back to portfolio →
        </a>
      </div>
    </div>
  );
}