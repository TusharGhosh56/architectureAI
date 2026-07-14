import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    setReply(JSON.stringify(data, null, 2));
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 720 }}>
      <p>
        <Link to="/">← Upload</Link>
      </p>
      <h1>Chat</h1>
      <p>Agent tools come in Day 3. This page just hits the stub /api/chat.</p>
      <form onSubmit={onSubmit}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask about the codebase…"
          style={{ width: "100%", padding: "0.5rem" }}
        />
        <button type="submit" style={{ marginTop: "0.75rem" }}>
          Send
        </button>
      </form>
      {reply && (
        <pre style={{ marginTop: "1rem", background: "#f4f4f4", padding: "1rem" }}>
          {reply}
        </pre>
      )}
    </main>
  );
}
