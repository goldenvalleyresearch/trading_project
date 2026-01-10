"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./Header_bar.module.css";
import { apiGet, apiPost } from "@/lib/api";

export type HeaderLink = {
  label: string;
  href: string;
};

type AuthState = "unknown" | "authed" | "guest";

function hasAccessToken(): boolean {
  if (typeof window === "undefined") return false;
  const v =
    window.localStorage.getItem("access_token") ||
    window.localStorage.getItem("access") ||
    window.localStorage.getItem("token");
  return !!(v && v.trim().length);
}

function clearAccessToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("access_token");
  window.localStorage.removeItem("access");
  window.localStorage.removeItem("token");
}

export default function Header({
  brand = "Golden Valley Market Research",
  links,
  logoSrc = "/gv_test.png",
  logoAlt = "GV9",
  loginHref = "/login",
  postLogoutHref = "/login",
  meEndpoint = "/api/auth/me",
  logoutEndpoint = "/api/auth/logout",
}: {
  brand?: string;
  links: HeaderLink[];
  logoSrc?: string;
  logoAlt?: string;
  loginHref?: string;
  postLogoutHref?: string;
  meEndpoint?: string;
  logoutEndpoint?: string;
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState>("unknown");

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 980) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      const tokenPresent = hasAccessToken();
      if (alive) setAuth(tokenPresent ? "authed" : "guest");
      if (!tokenPresent) return;

      try {
        const data = await apiGet<any>(meEndpoint);
        const authed =
          !!data && typeof data === "object" && (data.ok === true || !!data.user);
        if (alive) setAuth(authed ? "authed" : "guest");
      } catch {
        clearAccessToken();
        if (alive) setAuth("guest");
      }
    })();

    return () => {
      alive = false;
    };
  }, [meEndpoint]);

  async function onLogout() {
    try {
      await apiPost<any>(logoutEndpoint, {});
    } finally {
      clearAccessToken();
      setAuth("guest");
      setOpen(false);
      router.push(postLogoutHref);
      router.refresh();
    }
  }

  const ctaLabel = auth === "authed" ? "Logout" : "Login";
  const ctaHref = auth === "authed" ? "#" : loginHref;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a className={styles.brand} href="/" aria-label={`${brand} home`}>
          <span className={styles.logoWrap} aria-hidden="true">
            <Image
              src={logoSrc}
              alt={logoAlt}
              fill
              priority
              className={styles.logo}
            />
          </span>
          <span className={styles.wordmark}>{brand}</span>
        </a>

        <nav className={styles.nav} aria-label="Primary">
          <div className={styles.links}>
            {links.map((l) => (
              <a key={l.href} className={styles.navLink} href={l.href}>
                {l.label}
              </a>
            ))}
          </div>

          <div className={styles.actions}>
            {auth === "authed" ? (
              <button type="button" className={styles.cta} onClick={onLogout}>
                {ctaLabel}
              </button>
            ) : (
              <a className={styles.cta} href={ctaHref}>
                {ctaLabel}
              </a>
            )}

            <button
              type="button"
              className={styles.menuBtn}
              aria-label="Menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span className={styles.menuBars} />
            </button>
          </div>
        </nav>
      </div>

      <div className={`${styles.mobileWrap} ${open ? styles.mobileOpen : ""}`}>
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
        <div className={styles.mobileMenu}>
          {links.map((l) => (
            <a
              key={l.href}
              className={styles.mobileLink}
              href={l.href}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}

          {auth === "authed" ? (
            <button
              type="button"
              className={styles.mobileCta}
              onClick={onLogout}
            >
              Logout
            </button>
          ) : (
            <a
              className={styles.mobileCta}
              href={loginHref}
              onClick={() => setOpen(false)}
            >
              Login
            </a>
          )}
        </div>
      </div>
    </header>
  );
}