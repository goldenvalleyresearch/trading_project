"use client";

import React, { useMemo, useState } from "react";
import styles from "./AdminPasswordCard.module.css";
import { apiPost } from "@/lib/api";

type Mode = "my" | "admin";

type Props = {
  busy?: boolean;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
};

function shortErr(e: any) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Request failed.";
}

export default function AdminPasswordCard({ busy, onSuccess, onError }: Props) {
  const [mode, setMode] = useState<Mode>("my");

  const [myCurrent, setMyCurrent] = useState("");
  const [myNext, setMyNext] = useState("");
  const [myNext2, setMyNext2] = useState("");

  const [userId, setUserId] = useState("");
  const [adminNext, setAdminNext] = useState("");
  const [adminNext2, setAdminNext2] = useState("");

  const [localBusy, setLocalBusy] = useState(false);
  const disabled = !!busy || localBusy;

  const canMy = useMemo(() => {
    if (!myCurrent.trim()) return false;
    if (myNext.trim().length < 5) return false;
    if (myNext !== myNext2) return false;
    return true;
  }, [myCurrent, myNext, myNext2]);

  const canAdmin = useMemo(() => {
    if (!userId.trim()) return false;
    if (adminNext.trim().length < 5) return false;
    if (adminNext !== adminNext2) return false;
    return true;
  }, [userId, adminNext, adminNext2]);

  async function runMyChange() {
    setLocalBusy(true);
    try {
      await apiPost("/api/auth/change-password", {
        current_password: myCurrent,
        new_password: myNext,
      });

      setMyCurrent("");
      setMyNext("");
      setMyNext2("");

      onSuccess?.("Password changed. Please log in again if you were signed out.");
    } catch (e: any) {
      onError?.(shortErr(e));
    } finally {
      setLocalBusy(false);
    }
  }

  async function runAdminReset() {
    setLocalBusy(true);
    try {
      await apiPost("/api/auth/admin/set-password", {
        userId,
        new_password: adminNext,
      });

      setUserId("");
      setAdminNext("");
      setAdminNext2("");

      onSuccess?.("User password reset successfully.");
    } catch (e: any) {
      onError?.(shortErr(e));
    } finally {
      setLocalBusy(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>Admin</div>
          <h2 className={styles.title}>Password Center</h2>
          <p className={styles.sub}>
            Change your own password, or reset a user’s password (admin only).
          </p>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${mode === "my" ? styles.tabActive : ""}`}
            onClick={() => setMode("my")}
            disabled={disabled}
          >
            My password
          </button>
          <button
            type="button"
            className={`${styles.tab} ${mode === "admin" ? styles.tabActive : ""}`}
            onClick={() => setMode("admin")}
            disabled={disabled}
          >
            Reset user
          </button>
        </div>
      </div>

      {mode === "my" ? (
        <div className={styles.body}>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Current password</span>
              <input
                className={styles.input}
                type="password"
                value={myCurrent}
                onChange={(e) => setMyCurrent(e.target.value)}
                placeholder="Current password"
                disabled={disabled}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>New password</span>
              <input
                className={styles.input}
                type="password"
                value={myNext}
                onChange={(e) => setMyNext(e.target.value)}
                placeholder="At least 5 characters"
                disabled={disabled}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Confirm new password</span>
              <input
                className={styles.input}
                type="password"
                value={myNext2}
                onChange={(e) => setMyNext2(e.target.value)}
                placeholder="Re-type new password"
                disabled={disabled}
              />
            </label>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={runMyChange}
              disabled={disabled || !canMy}
            >
              Change my password
            </button>
            <div className={styles.hint}>
              If your backend clears auth cookies, you’ll be logged out after changing.
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.body}>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>User ID (Mongo ObjectId)</span>
              <input
                className={styles.input}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. 65f1c1b8c9c5a0b1c2d3e4f5"
                disabled={disabled}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>New password</span>
              <input
                className={styles.input}
                type="password"
                value={adminNext}
                onChange={(e) => setAdminNext(e.target.value)}
                placeholder="At least 5 characters"
                disabled={disabled}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Confirm new password</span>
              <input
                className={styles.input}
                type="password"
                value={adminNext2}
                onChange={(e) => setAdminNext2(e.target.value)}
                placeholder="Re-type new password"
                disabled={disabled}
              />
            </label>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={runAdminReset}
              disabled={disabled || !canAdmin}
            >
              Reset user password
            </button>
            <div className={styles.hint}>
              This requires an <span className={styles.mono}>admin</span> access token.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}