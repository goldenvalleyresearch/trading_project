"use client";

import { useState } from "react";
import styles from "./page.module.css";

import Header from "@/componets/UI/Header_bar/Header_bar";
import FeatureCard from "@/componets/UI/FeatureCard/FeatureCard";
import Footer from "@/componets/UI/Footer/Footer";

import { BRAND_NAME, LINKS } from "../../lib/site";
import { isValidEmail, subscribeNewsletter } from "../../lib/newsletter";

export default function NewsletterPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubscribe() {
    const e = email.trim();
    if (!isValidEmail(e)) {
      setErr("Enter a valid email address.");
      setMsg(null);
      return;
    }

    try {
      setLoading(true);
      setErr(null);
      setMsg(null);

      const res = await subscribeNewsletter(e);
      setMsg(
        res.status === "already_subscribed"
          ? "You’re already on the list."
          : "Subscribed — watch your inbox."
      );

      setEmail("");
    } catch (e: any) {
      setErr(e?.message ?? "Subscription failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <Header brand={BRAND_NAME} links={[...LINKS]} />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.kicker}>Newsletter</div>

            <h1 className={styles.h1}>Get the Golden Valley newsletter.</h1>

            <p className={styles.lede}>
              One concise email when there’s something worth knowing —
              no feeds, no noise, no hype.
            </p>

            <div className={styles.badges} aria-label="Newsletter properties">
              <span className={styles.badge}>Short emails</span>
              <span className={styles.badge}>Only when it matters</span>
              <span className={styles.badge}>Unsubscribe anytime</span>
            </div>

            <div className={styles.heroCtas}>
              <a className={styles.ghostBtn} href="/portfolio">
                Open portfolio →
              </a>
              <a className={styles.secondaryBtn} href="/transparency">
                See methodology →
              </a>
              <a href="/account/create" className={styles.premiumBtnInline}>
                Premium emails →
              </a>
            </div>
          </div>

          <aside className={styles.heroSignup} aria-label="Newsletter signup">
            <div className={styles.heroSignupGlow} aria-hidden="true" />

            <div className={styles.heroSignupTop}>
              <div className={styles.heroSignupTitle}>Get the next note</div>
              <div className={styles.heroSignupSub}>
                We email when there’s something actionable.
              </div>
            </div>

            <label className={styles.label} htmlFor="email">
              Your email
            </label>

            <div className={styles.formRow}>
              <input
                id="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                inputMode="email"
                autoComplete="email"
              />

              <button
                className={styles.primaryBtn}
                onClick={onSubscribe}
                disabled={loading}
              >
                {loading ? "Subscribing…" : "Get updates"}
              </button>
            </div>

            <div className={styles.fineRow}>
              <span className={styles.finePrint}>No spam.</span>
              <span className={styles.fineDivider}>•</span>
              <span className={styles.finePrint}>One-click unsubscribe.</span>
            </div>

            {(msg || err) && (
              <div className={err ? styles.toastErr : styles.toastOk} role="status">
                {err ?? msg}
              </div>
            )}
          </aside>
        </section>

        <section className={styles.navGrid} aria-label="Explore">
          <FeatureCard
            title="Performance"
            body="Equity curve, drawdowns, and benchmark comparisons."
            href="/performance"
            linkLabel="View performance"
          />
          <FeatureCard
            title="Portfolio"
            body="Positions, weights, and cash — audit-friendly."
            href="/portfolio"
            linkLabel="Open portfolio"
          />
          <FeatureCard
            title="Transparency"
            body="Receipts-first timeline of updates and runs."
            href="/transparency"
            linkLabel="Open transparency"
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}