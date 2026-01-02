// new-frontend/src/app/register/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import styles from "./page.module.css";

import Header from "../../componets/Header_bar/Header_bar";
import Footer from "../../componets/Footer/Footer";
import { BRAND_NAME, LINKS } from "../../lib/site";

import { registerUser } from "../../lib/register";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const e = email.trim();
    const u = username.trim();

    if (!e || !u || !password) return false;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;

    if (u.length < 3) return false;

    if (password.length < 5) return false;

    if (password !== confirm) return false;
    if (busy) return false;

    return true;
  }, [email, username, password, confirm, busy]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setErr(null);

    try {
      const res = await registerUser({
        email,
        username,
        password,
        remember,
      });

      if (res.ok) {
        window.location.href = res.redirect;
        return;
      }

      setErr(res.error || "Register failed.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Register failed.");
    } finally {
      setBusy(false);
    }
  }

  const usernameHint =
    username.length === 0
      ? "At least 3 characters."
      : username.trim().length < 3
      ? "Username too short (min 3)."
      : "Looks good.";

  const passwordHint =
    password.length === 0
      ? "At least 5 characters."
      : password.length < 5
      ? "Password too short (min 5)."
      : confirm.length > 0 && password !== confirm
      ? "Passwords do not match."
      : "Looks good.";

  return (
    <div className={styles.page}>
      <Header brand={BRAND_NAME} links={[...LINKS]} />

      <main className={styles.main}>
        <section className={styles.hero}>
          {/* LEFT */}
          <div className={styles.left}>
            <div className={styles.pills}>
              <span className={styles.pill}>Create account</span>
              <span className={styles.pill}>Secure</span>
              <span className={styles.pill}>Fast</span>
            </div>

            <h1 className={styles.h1}>Register</h1>
            <p className={styles.sub}>Make an account to use uploads and admin tools.</p>

            <div className={styles.quickLinks}>
              <a className={styles.ghostBtn} href="/login">
                Already have an account? Sign in →
              </a>
              <a className={styles.ghostBtn} href="/research">
                Back to research →
              </a>
            </div>
          </div>

          {/* RIGHT */}
          <div className={styles.right}>
            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.cardTitle}>Create account</div>
                  <div className={styles.cardSub}>Enter your details to continue.</div>
                </div>
                <a className={styles.ghostBtn} href="/login">
                  Sign in →
                </a>
              </div>

              {err && (
                <div className={styles.errorBox}>
                  <div className={styles.errorTitle}>Couldn’t register</div>
                  <div className={styles.errorMsg}>{err}</div>
                </div>
              )}

              <form className={styles.form} onSubmit={onSubmit}>
                <label className={styles.label}>
                  <div className={styles.labelK}>Email</div>
                  <input
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    spellCheck={false}
                  />
                </label>

                <label className={styles.label}>
                  <div className={styles.labelK}>Username</div>
                  <input
                    className={styles.input}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="At least 3 characters"
                    autoComplete="username"
                    spellCheck={false}
                  />
                  <div className={styles.mini}>{usernameHint}</div>
                </label>

                <label className={styles.label}>
                  <div className={styles.labelK}>Password</div>
                  <input
                    className={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 5 characters"
                    type="password"
                    autoComplete="new-password"
                  />
                </label>

                <label className={styles.label}>
                  <div className={styles.labelK}>Confirm password</div>
                  <input
                    className={styles.input}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="•••••"
                    type="password"
                    autoComplete="new-password"
                  />
                  <div className={styles.mini}>{passwordHint}</div>
                </label>

                <div className={styles.row}>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <span>Keep me signed in</span>
                  </label>

                  <a className={styles.link} href="/login">
                    Back to login
                  </a>
                </div>

                <button className={styles.primaryBtn} type="submit" disabled={!canSubmit}>
                  {busy ? "Creating…" : "Create account →"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}