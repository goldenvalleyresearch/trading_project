"use client";

import React from "react";
import styles from "./StatusAlert.module.css";

type Props = {
  err?: string | null;
  ok?: string | null;
};

export default function StatusAlert({ err, ok }: Props) {
  if (!err && !ok) return null;

  return (
    <div className={err ? styles.alertErr : styles.alertOk}>
      <div className={styles.alertTitle}>{err ? "Action failed" : "Success"}</div>
      <div className={styles.alertMsg}>{err ?? ok}</div>
    </div>
  );
}