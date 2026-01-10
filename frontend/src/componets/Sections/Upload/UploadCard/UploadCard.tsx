// src/componets/Sections/Upload/UploadCard/UploadCard.tsx
"use client";

import React from "react";
import styles from "./UploadCard.module.css";
import type { UploadKey } from "@/app/upload/upload";

type LastInfo = { date?: string; file?: string };
type SelectedInfo = { name?: string; file?: File };

export default function UploadCard(props: {
  k: UploadKey;

  title: string;
  purpose: string;
  example: string;
  expects: string[];
  endpoint: string;

  accept: string;

  busy: UploadKey | "newsletter" | null;
  isBusy: boolean;

  needsAsOf: boolean;
  asOfValue: string;
  onAsOfChange: (next: string) => void;

  lastInfo?: LastInfo;
  selectedInfo?: SelectedInfo;

  prettyFileName: (name: string) => string;

  onPickClick: () => void;
  onUpload: () => void;
  onClearPick: () => void;

  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const pickedName = props.selectedInfo?.name;
  const lastDate = props.lastInfo?.date;
  const lastFile = props.lastInfo?.file;

  return (
    <section className={styles.card} aria-label={props.title}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>{props.title}</div>

        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.pickBtn}
            onClick={props.onPickClick}
            disabled={!!props.busy}
          >
            Choose file
          </button>

          <button
            type="button"
            className={styles.uploadBtn}
            onClick={props.onUpload}
            disabled={!!props.busy || !props.selectedInfo?.file}
          >
            {props.isBusy ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>

      <div className={styles.cardPurpose}>{props.purpose}</div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>What to upload</div>
        <div className={styles.sectionValue}>
          <span className={styles.mono}>{props.example}</span>
        </div>
      </div>

      {props.needsAsOf && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>As-of date (required)</div>
          <div className={styles.sectionValueRow}>
            <input
              type="date"
              value={props.asOfValue}
              onChange={(e) => props.onAsOfChange(e.target.value)}
              disabled={!!props.busy}
              className={styles.dateInput}
              aria-label={`${props.title} as_of date`}
            />
            <span className={styles.dim}>
              sent as <span className={styles.mono}>?as_of=YYYY-MM-DD</span>
            </span>
          </div>
        </div>
      )}

      <div className={styles.pickerRow}>
        <div className={styles.pickerLeft}>
          <div className={styles.pickerLabel}>Selected file</div>
          <div className={styles.pickerValue}>
            {pickedName ? (
              <>
                <span className={styles.mono}>{props.prettyFileName(pickedName)}</span>
                <span className={styles.sep}>•</span>
                <span className={styles.dim}>Ready to upload</span>
              </>
            ) : (
              <span className={styles.dim}>No file selected</span>
            )}
          </div>
        </div>

        <button
          type="button"
          className={styles.clearBtn}
          onClick={props.onClearPick}
          disabled={!!props.busy || !props.selectedInfo?.file}
          aria-label={`Clear selected file for ${props.title}`}
        >
          Clear
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Last upload</div>
        <div className={styles.sectionValue}>
          {lastDate ? (
            <>
              <span className={styles.strong}>{lastDate}</span>
              {lastFile ? (
                <>
                  <span className={styles.sep}>•</span>
                  <span className={styles.mono}>{props.prettyFileName(lastFile)}</span>
                </>
              ) : null}
            </>
          ) : (
            <span className={styles.dim}>No data found yet</span>
          )}
        </div>
      </div>

      <div className={styles.metaRow}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Endpoint</span>
          <span className={styles.mono}>
            {props.endpoint}
            {props.needsAsOf ? "?as_of=…" : ""}
          </span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Expected format</span>
          <span className={styles.mono}>{props.expects.join(" • ")}</span>
        </div>
      </div>

      <input
        ref={props.inputRef}
        className={styles.hiddenInput}
        type="file"
        accept={props.accept}
        onChange={props.onFileChange}
      />
    </section>
  );
}