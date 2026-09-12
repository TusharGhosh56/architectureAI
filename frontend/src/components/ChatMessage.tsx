import { useState } from "react";

type Props = {
  role: "user" | "assistant";
  content: string;
  time?: string;
};

export default function ChatMessage({ role, content, time = "12:00:00" }: Props) {
  const isUser = role === "user";

  return (
    <div className={`studio-msg ${isUser ? "studio-msg-user" : "studio-msg-assistant"}`}>
      <div className="studio-msg-header">
        <div className="studio-msg-sender">
          {isUser ? (
            <>
              <span className="studio-sender-badge user-badge">YOU</span>
              <span className="studio-sender-title">ARCHITECT QUERY</span>
            </>
          ) : (
            <>
              <span className="studio-sender-badge engine-badge">AI</span>
              <span className="studio-sender-title">GROUNDED ENGINE</span>
            </>
          )}
        </div>
        <span className="studio-msg-time">{time}</span>
      </div>

      <div className="studio-msg-body">
        <MessageContent text={content} />
      </div>
    </div>
  );
}

function MessageContent({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="studio-msg-content">
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
    <div className="studio-code-block">
      <div className="studio-code-header">
        <span className="studio-code-lang">{language.toUpperCase()}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="studio-code-copy-btn"
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>COPIED</span>
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>COPY</span>
            </>
          )}
        </button>
      </div>
      <pre className="studio-code-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="studio-text-flow">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="studio-text-spacer" />;

        if (trimmed.startsWith("### ")) {
          return (
            <div key={idx} className="studio-text-h3">
              {renderInline(trimmed.slice(4))}
            </div>
          );
        }
        if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
          return (
            <div key={idx} className="studio-text-h2">
              {renderInline(line.replace(/^#+\s*/, ""))}
            </div>
          );
        }

        if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="studio-text-bullet">
              <span className="studio-bullet-dot">▸</span>
              <div>{renderInline(trimmed.slice(2))}</div>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="studio-text-numbered">
              <span className="studio-num-badge">{numMatch[1]}.</span>
              <div>{renderInline(numMatch[2])}</div>
            </div>
          );
        }

        return <p key={idx} className="studio-text-p">{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(str: string) {
  const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="studio-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="studio-inline-strong">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
