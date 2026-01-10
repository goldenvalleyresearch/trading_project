"use client";

import React from "react";
import styles from "./UploadGrid.module.css";

import UploadCard from "@/componets/Sections/Upload/UploadCard/UploadCard";
import NewsletterCard from "@/componets/Sections/Upload/NewsletterCard/NewsletterCard";

import type { UploadKey } from "@/app/upload/upload";

type LastInfo = { date?: string; file?: string };
type SelectedInfo = { name?: string; file?: File };

type UploadCardConfig = {
  title: string;
  purpose: string;
  expects: string[];
  example: string;
  endpoint: string;
  accept: string;
  needsAsOf: boolean;
};

type NewsletterState = {
  subject: string;
  body: string;
  testEmail: string;
  lastSent: string | null;
};

type Props = {
  keys: UploadKey[];
  configByKey: Record<UploadKey, UploadCardConfig>;

  busy: UploadKey | "newsletter" | null;
  last: Record<UploadKey, LastInfo>;
  selected: Record<UploadKey, SelectedInfo>;
  asOf: Record<UploadKey, string>;

  prettyFileName: (name: string) => string;

  onPickClick: (k: UploadKey) => void;
  onUpload: (k: UploadKey) => void;
  onClearPick: (k: UploadKey) => void;
  onAsOfChange: (k: UploadKey, v: string) => void;
  inputRefByKey: Record<UploadKey, React.RefObject<HTMLInputElement | null>>;
  onFileChange: (k: UploadKey, e: React.ChangeEvent<HTMLInputElement>) => void;

  newsletter: NewsletterState;
  onChangeSubject: (v: string) => void;
  onChangeBody: (v: string) => void;
  onChangeTestEmail: (v: string) => void;
  onSendTest: () => void;
  onSendList: () => void;
};

export default function UploadGrid({
  keys,
  configByKey,
  busy,
  last,
  selected,
  asOf,
  prettyFileName,
  onPickClick,
  onUpload,
  onClearPick,
  onAsOfChange,
  inputRefByKey,
  onFileChange,
  newsletter,
  onChangeSubject,
  onChangeBody,
  onChangeTestEmail,
  onSendTest,
  onSendList,
}: Props) {
  return (
    <div className={styles.grid}>
      {keys.map((k) => {
        const cfg = configByKey[k];
        return (
          <UploadCard
            key={k}
            k={k}
            title={cfg.title}
            purpose={cfg.purpose}
            example={cfg.example}
            expects={cfg.expects}
            endpoint={cfg.endpoint}
            accept={cfg.accept}
            busy={busy}
            isBusy={busy === k}
            needsAsOf={cfg.needsAsOf}
            asOfValue={asOf[k]}
            onAsOfChange={(next) => onAsOfChange(k, next)}
            lastInfo={last[k]}
            selectedInfo={selected[k]}
            prettyFileName={prettyFileName}
            onPickClick={() => onPickClick(k)}
            onUpload={() => onUpload(k)}
            onClearPick={() => onClearPick(k)}
            inputRef={inputRefByKey[k]}
            onFileChange={(e) => onFileChange(k, e)}
          />
        );
      })}

      <NewsletterCard
        busy={busy}
        subject={newsletter.subject}
        body={newsletter.body}
        testEmail={newsletter.testEmail}
        lastSent={newsletter.lastSent}
        onChangeSubject={onChangeSubject}
        onChangeBody={onChangeBody}
        onChangeTestEmail={onChangeTestEmail}
        onSendTest={onSendTest}
        onSendList={onSendList}
      />
    </div>
  );
}