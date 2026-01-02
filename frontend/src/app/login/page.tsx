// new-frontend/src/app/login/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

import Header from "../../componets/Header_bar/Header_bar";
import Footer from "../../componets/Footer/Footer";
import { BRAND_NAME, LINKS } from "../../lib/site";

import { login, checkSession } from "../../lib/login";

export default function LoginPage() {
  const [emailOrUser, setEmailOrUser] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const s = await checkSession();
        if (!alive) return;

        if (s.ok) {
          window.location.href = s.redirect;
          return;
        }
      } finally {
        if (alive) setChecking(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const canSubmit = useMemo(() => {
    return emailOrUser.trim().length > 0 && password.length >= 1 && !busy && !checking;
  }, [emailOrUser, password, busy, checking]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setErr(null);

    const result = await login({
      emailOrUser,
      password,
      remember,
    });

    if (!result.ok) {
      setErr(result.error);
      setBusy(false);
      return;
    }

    window.location.href = result.redirect;
  }

  return (
    <div className={styles.page}>
      <Header brand={BRAND_NAME} links={LINKS} ctaLabel="View Live" ctaHref="/portfolio" />

      <main className={styles.main}>
        <section className={styles.hero}>
          {/* LEFT (desktop) */}
          <div className={styles.left}>
            <div className={styles.pills}>
              <span className={styles.pill}>Private</span>
              <span className={styles.pill}>Secure</span>
              <span className={styles.pill}>Audit-friendly</span>
            </div>

            <h1 className={styles.h1}>Sign in</h1>
            <p className={styles.sub}>
              Access uploads, admin tools, and write actions. Public pages stay view-only.
            </p>

            <div className={styles.hintRow}>
              <span className={styles.dot} />
              <span className={styles.hintText}>
                Use your admin account if you need upload permissions.
              </span>
            </div>

            <div className={styles.quickLinks}>
              <a className={styles.ghostBtn} href="/register">
                Create account →
              </a>
              <a className={styles.ghostBtn} href="/portfolio">
                Portfolio →
              </a>
              <a className={styles.ghostBtn} href="/research">
                Research →
              </a>
            </div>
          </div>

          {/* RIGHT */}
          <div className={styles.right}>
            <div className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.cardTitle}>Login</div>
                  <div className={styles.cardSub}>
                    {checking ? "Checking session…" : "Enter your credentials to continue."}
                  </div>
                </div>
                <a className={styles.ghostBtn} href="/research">
                  Back →
                </a>
              </div>

              {err && (
                <div className={styles.errorBox}>
                  <div className={styles.errorTitle}>Couldn’t sign in</div>
                  <div className={styles.errorMsg}>{err}</div>
                </div>
              )}

              <form className={styles.form} onSubmit={onSubmit}>
                <label className={styles.label}>
                  <div className={styles.labelK}>Email / Username</div>
                  <input
                    className={styles.input}
                    value={emailOrUser}
                    onChange={(e) => setEmailOrUser(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="username"
                    spellCheck={false}
                    disabled={checking || busy}
                  />
                </label>

                <label className={styles.label}>
                  <div className={styles.labelK}>Password</div>
                  <input
                    className={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    type="password"
                    autoComplete="current-password"
                    disabled={checking || busy}
                  />
                </label>

                <div className={styles.row}>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      disabled={checking || busy}
                    />
                    <span>Remember me</span>
                  </label>

                  <a className={styles.link} href="/forgot">
                    Forgot password?
                  </a>
                </div>

                <button className={styles.primaryBtn} type="submit" disabled={!canSubmit}>
                  {checking ? "Checking…" : busy ? "Signing in…" : "Sign in →"}
                </button>

                <div className={styles.mini}>
                  Admin pages require auth. Public pages remain read-only.
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}