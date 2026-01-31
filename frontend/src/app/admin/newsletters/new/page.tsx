"use client";

import { useState } from "react";
import MDEditor from "@uiw/react-md-editor";

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

export default function NewNewsletterAdminPage() {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("premarket");
  const [content, setContent] = useState<string>("");  
  const [token, setToken] = useState("");

  async function submit() {
    await fetch(`${API}/api/admin/newsletter/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        kind,
        content_md: content,
        published: true,
      }),
    });

    alert("Published");
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">New Newsletter</h1>

      <input
        placeholder="Admin token"
        className="border p-2 w-full mb-4"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />

      <input
        placeholder="Title"
        className="border p-2 w-full mb-4"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <select
        className="border p-2 mb-4"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
      >
        <option value="premarket">Premarket</option>
        <option value="afterhours">After Hours</option>
      </select>

      <MDEditor
        value={content}
        onChange={(val) => setContent(val ?? "")}
      />
      <button
        onClick={submit}
        className="mt-6 bg-black text-white px-6 py-3 rounded"
      >
        Publish
      </button>
    </main>
  );
}
