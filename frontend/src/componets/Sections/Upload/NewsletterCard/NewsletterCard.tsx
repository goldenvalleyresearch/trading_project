"use client";

import React, { useId } from "react";
import styles from "./NewsletterCard.module.css";

type BusyKey = "newsletter" | string | null;

export default function NewsletterCard(props: {
  busy: BusyKey;

  subject: string;
  body: string;
  testEmail: string;
  lastSent: string | null;

  onChangeSubject: (v: string) => void;
  onChangeBody: (v: string) => void;
  onChangeTestEmail: (v: string) => void;

  onSendTest: () => void;
  onSendList: () => void;
}) {
  const disabled = !!props.busy;
  const sending = props.busy === "newsletter";

  const subjectId = useId();
  const bodyId = useId();
  const testId = useId();
  const helpId = useId();
  const statusId = useId();

  const canSendTest = !!props.subject.trim() && !!props.body.trim() && !!props.testEmail.trim();
  const canSendList = !!props.subject.trim() && !!props.body.trim();

  return (
    <section className={styles.card} aria-labelledby="newsletter-title">
      <div className={styles.cardHeader}>
        <div className={styles.titleWrap}>
          <div className={styles.cardTitle} id="newsletter-title">
            Newsletter
          </div>
          <div className={styles.badges}>
            <span className={styles.badge} aria-label="Admin only">
              Admin
            </span>
            <span className={styles.badge} aria-label="Email blast">
              Email
            </span>
          </div>
        </div>

        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.pickBtn}
            onClick={props.onSendTest}
            disabled={disabled || !canSendTest}
            aria-disabled={disabled || !canSendTest}
            aria-describedby={helpId}
            title={!canSendTest ? "Fill subject + message + test email first" : "Sends only to the test email address"}
          >
            Send test
          </button>
          <button
            type="button"
            className={styles.uploadBtn}
            onClick={props.onSendList}
            disabled={disabled || !canSendList}
            aria-disabled={disabled || !canSendList}
            aria-describedby={helpId}
            title={!canSendList ? "Fill subject + message first" : "Sends to the whole subscriber list"}
          >
            {sending ? "Sending…" : "Send to list"}
          </button>
        </div>
      </div>

      <div className={styles.cardPurpose}>
        Send an email blast to your subscriber list (admin-only). Uses a backend email provider.
      </div>

      <div className={styles.form} role="group" aria-label="Newsletter form">
        <div className={styles.field}>
          <label className={styles.label} htmlFor={subjectId}>
            Subject
          </label>
          <input
            id={subjectId}
            value={props.subject}
            onChange={(e) => props.onChangeSubject(e.target.value)}
            disabled={disabled}
            placeholder="Weekly update: New positions + performance recap"
            className={styles.textInput}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor={bodyId}>
              Message
            </label>
            <span className={styles.hint}>Supports plain text</span>
          </div>
          <textarea
            id={bodyId}
            value={props.body}
            onChange={(e) => props.onChangeBody(e.target.value)}
            disabled={disabled}
            placeholder="Write your newsletter here…"
            rows={9}
            className={styles.textArea}
          />
          <div className={styles.metaRow}>
            <span className={styles.dim}>{props.body.trim().length} chars</span>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={testId}>
            Test email
            <span className={styles.optional}>Optional</span>
          </label>
          <div className={styles.inlineRow}>
            <input
              id={testId}
              value={props.testEmail}
              onChange={(e) => props.onChangeTestEmail(e.target.value)}
              disabled={disabled}
              placeholder="you@example.com"
              className={styles.textInput}
              inputMode="email"
              autoComplete="email"
            />
          </div>
          <div className={styles.help} id={helpId}>
            “Send test” sends only to this email. “Send to list” emails all subscribers.
          </div>
        </div>

        <div className={styles.footerRow}>
          <div className={styles.lastSent}>
            <div className={styles.label}>Last sent</div>
            <div className={styles.sectionValue} aria-live="polite" aria-atomic="true" id={statusId}>
              {props.lastSent ? (
                <span className={styles.mono}>{props.lastSent}</span>
              ) : (
                <span className={styles.dim}>—</span>
              )}
            </div>
          </div>

          <div className={styles.endpoint}>
            <span className={styles.dim}>Backend</span>{" "}
            <span className={styles.mono}>POST /api/admin/newsletter/send</span>
          </div>
        </div>
      </div>
    </section>
  );
}