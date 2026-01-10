"use client";

import styles from "./ResearchHero.module.css";

type Props = {
  asOf: string;
  loading: boolean;
  errorMsg: string | null;
};

export default function ResearchHero({ asOf, loading, errorMsg }: Props) {
  return (
    <section className={styles.top}>
      <div>
        <h1 className={styles.h1}>Research</h1>

        <div className={styles.sub}>
          View-only research feed.
          <span className={styles.asof}> As-of: {loading ? "Loading…" : asOf ?? "—"}</span>
        </div>

        {errorMsg ? (
          <div className={styles.errorBox}>
            <div className={styles.errorTitle}>Backend fetch failed</div>
            <div className={styles.errorMsg}>{errorMsg}</div>
            <div className={styles.errorHint}>
              Check <code>NEXT_PUBLIC_API_BASE</code> and confirm your FastAPI server is running.
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.topRight}>
        <a className={styles.ghostBtn} href="/portfolio">
          Back to portfolio →
        </a>
      </div>
    </section>
  );
}