"use client";

import { useState } from "react";
import styles from "./page.module.css";

import Header from "../../componets/Header_bar/Header_bar";
import FeatureCard from "../../componets/FeatureCard/FeatureCard";
import Footer from "../../componets/Footer/Footer";

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
      setErr("Enter a valid email.");
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
          ? "You’re already subscribed."
          : "Subscribed. Check your inbox."
      );

      setEmail("");
    } catch (e: any) {
      setErr(e?.message ?? "Subscribe failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <Header
        brand={BRAND_NAME}
        links={LINKS}
        ctaLabel="View Live"
        ctaHref="/portfolio"
      />

      <main className={styles.main}>
        {/* HERO */}
        <section className={styles.hero}>
          <div>
            <h1 className={styles.h1}>Newsletter</h1>
            <p className={styles.lede}>
              Clean market notes and trade context.  
              Delivered by email. No noise.
            </p>

            <div className={styles.meta}>
              <span>Delivery: email</span>
              <span>Low frequency</span>
              <span>No spam</span>
            </div>
          </div>

          <a className={styles.ghostBtn} href="/portfolio">
            Open portfolio →
          </a>
        </section>

        {/* SIGNUP CARD */}
        <section className={styles.card}>
          <div className={styles.cardTop}>
            <div>
              <div className={styles.cardTitle}>Get updates by email</div>
              <div className={styles.cardSub}>
                Only new posts and major updates.
              </div>
            </div>

            <a
              href="/account/create"
              className={styles.premiumBtn}
            >
              Premium emails →
            </a>
          </div>

          <div className={styles.form}>
            <input
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
              {loading ? "Signing up…" : "Sign up"}
            </button>

            <div className={styles.finePrint}>
              Unsubscribe anytime.
            </div>

            {(msg || err) && (
              <div className={err ? styles.toastErr : styles.toastOk}>
                {err ?? msg}
              </div>
            )}
          </div>
        </section>

        {/* NAV */}
        <section className={styles.navGrid}>
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