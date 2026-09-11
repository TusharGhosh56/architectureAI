import { useState } from "react";

type Props = {
  role: "user" | "assistant";
  content: string;
  time?: string;
};

export default function ChatMessage({ role, content, time = "12:00:00" }: Props) {
  const isUser = role === "user";

  return (
    <div className={`terminal-msg ${isUser ? "user" : "assistant"}`}>
      <div className="terminal-msg-header">
        <span>{isUser ? "[USER // COMMAND]" : "[ARCHITECT // ENGINE]"}</span>
        <span style={{ color: "var(--text-faint)", fontSize: "10px" }}>{time}</span>
      </div>

      <div className="terminal-msg-body">
        <MessageContent text={content} />
      </div>
    </div>
  );
}

function MessageContent({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const firstLineBreak = part.indexOf("\n");
          let lang = "plaintext";
          let code = "";

          if (firstLineBreak !== -1) {
            lang = part.slice(3, firstLineBreak).trim() || "code";
            code = part.slice(firstLineBreak + 1, -3);
          } else {
            code = part.slice(3, -3);
          }

          return <CodeBlock key={index} language={lang} code={code} />;
        }

        return <FormattedText key={index} text={part} />;
      })}
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <div className="code-wrap">
      <div className="code-wrap-bar">
        <span>{language.toUpperCase()}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="btn-icon-tiny"
          style={{ fontSize: "10px", padding: "1px 6px", height: "auto" }}
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: "0.25rem" }} />;

        if (trimmed.startsWith("### ")) {
          return (
            <div key={idx} style={{ fontWeight: 700, color: "var(--text-white)", marginTop: "0.4rem" }}>
              {renderInline(trimmed.slice(4))}
            </div>
          );
        }
        if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
          return (
            <div
              key={idx}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--accent-orange)",
                marginTop: "0.5rem",
              }}
            >
              {renderInline(line.replace(/^#+\s*/, ""))}
            </div>
          );
        }

        if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} style={{ display: "flex", gap: "0.5rem", paddingLeft: "0.25rem" }}>
              <span style={{ color: "var(--accent-orange)" }}>&gt;</span>
              <div>{renderInline(trimmed.slice(2))}</div>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} style={{ display: "flex", gap: "0.5rem", paddingLeft: "0.25rem" }}>
              <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {numMatch[1]}.
              </span>
              <div>{renderInline(numMatch[2])}</div>
            </div>
          );
        }

        return <p key={idx}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(str: string) {
  const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--accent-orange)",
            background: "#000000",
            border: "1px solid var(--border-hairline)",
            padding: "1px 4px",
            borderRadius: "2px",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} style={{ color: "#ffffff", fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
