import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import MermaidDiagram from "../components/MermaidDiagram";

type UploadResult = {
  status: string;
  project_id: string;
  file_count: number;
  edge_count: number;
  important_files: string[];
  circular_deps: string[][];
  diagram_mermaid: string;
  architecture_summary: string;
  chunk_count: number;
};

export default function UploadPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("zip") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setError("Choose a .zip file first.");
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      let data: { detail?: unknown } & Partial<UploadResult>;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.ok
            ? "Upload succeeded but response was not JSON."
            : `Upload failed (HTTP ${res.status}). Is the backend running on :8000?`,
        );
      }
      if (!res.ok) {
        const detail = data.detail;
        const message =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((d) => (typeof d === "object" && d && "msg" in d ? String((d as { msg: unknown }).msg) : JSON.stringify(d))).join("; ")
              : `Upload failed (HTTP ${res.status})`;
        throw new Error(message);
      }
      setResult(data as UploadResult);
      sessionStorage.setItem("architectai_project_id", data.project_id!);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw === "Failed to fetch" || raw.includes("NetworkError") || raw.includes("fetch")) {
        setError(
          "Lost connection to the backend during analysis. Prefer a zip without .venv/node_modules — then retry (backend should stay up).",
        );
      } else {
        setError(raw);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 880 }}>
      <h1>ArchitectAI</h1>
      <p>Upload a project zip to extract dependencies, embed code, and summarize architecture.</p>

      <form onSubmit={onSubmit}>
        <input name="zip" type="file" accept=".zip" disabled={busy} />
        <button type="submit" disabled={busy} style={{ marginLeft: "0.75rem" }}>
          {busy ? "Analyzing…" : "Analyze"}
        </button>
      </form>

      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      {result && (
        <section style={{ marginTop: "2rem" }}>
          <p>
            <strong>{result.file_count}</strong> source files ·{" "}
            <strong>{result.edge_count}</strong> import edges ·{" "}
            <strong>{result.chunk_count}</strong> RAG chunks
          </p>
          <p>{result.architecture_summary}</p>
          <h2>Dependency diagram</h2>
          <MermaidDiagram chart={result.diagram_mermaid} />
          <p style={{ marginTop: "1.5rem" }}>
            <Link to="/chat">Go to chat →</Link>
          </p>
        </section>
      )}
    </main>
  );
}
