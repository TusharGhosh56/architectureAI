import { useState, useRef, type DragEvent, useEffect } from "react";
import {
  UploadCloudIcon,
  FileCodeIcon,
  SparklesIcon,
  AlertCircleIcon,
  CheckIcon,
  ActivityIcon,
} from "./Icons";

type Phase = "idle" | "ready" | "analyzing" | "done";

type Props = {
  phase: Phase;
  error: string | null;
  file: File | null;
  onFileSelect: (file: File | null) => void;
  onStartAnalysis: () => void;
};

const ANALYSIS_STEPS = [
  "Unpacking repository archive & filtering node_modules / venvs",
  "Parsing AST imports & constructing dependency graph",
  "Calculating graph centrality & circular dependency cycles",
  "Generating function-level vector embeddings & architecture summary",
];

export default function FileDropzone({
  phase,
  error,
  file,
  onFileSelect,
  onStartAnalysis,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Animate progress when in analyzing phase
  useEffect(() => {
    if (phase !== "analyzing") {
      setCurrentStepIndex(0);
      setProgressPercent(0);
      return;
    }

    setProgressPercent(15);
    const t1 = setTimeout(() => {
      setCurrentStepIndex(1);
      setProgressPercent(45);
    }, 1200);

    const t2 = setTimeout(() => {
      setCurrentStepIndex(2);
      setProgressPercent(75);
    }, 2800);

    const t3 = setTimeout(() => {
      setCurrentStepIndex(3);
      setProgressPercent(90);
    }, 4500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [phase]);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (phase !== "analyzing") setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (phase === "analyzing") return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <div
      className={`dropzone-container ${isDragging ? "dropzone-active" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        style={{ display: "none" }}
        onChange={(e) => {
          onFileSelect(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      <div className="dropzone-icon">
        {phase === "analyzing" ? (
          <ActivityIcon size={32} className="pulse-dot" />
        ) : (
          <UploadCloudIcon size={32} />
        )}
      </div>

      <h3 className="dropzone-title">
        {phase === "analyzing"
          ? "Analyzing Architecture Pipeline…"
          : file
            ? "Repository Archive Selected"
            : "Drop your repository .zip here"}
      </h3>

      <p className="dropzone-subtitle">
        {phase === "analyzing"
          ? "Running deterministic AST parser, graph centrality metrics, and vector indexing."
          : "Upload a clean .zip of your codebase (omit node_modules and .venv for fastest processing)."}
      </p>

      {/* Selected File Card */}
      {file && phase !== "analyzing" && (
        <div className="file-selected-box">
          <FileCodeIcon size={22} color="var(--cyan)" />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9rem" }}>
              {file.name}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              {formatFileSize(file.size)} · ZIP Archive
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => fileInputRef.current?.click()}
            style={{ marginLeft: "auto" }}
          >
            Change
          </button>
        </div>
      )}

      {/* Progress View during analysis */}
      {phase === "analyzing" && (
        <div style={{ width: "100%", maxWidth: 500, margin: "0 auto" }}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="analyzing-steps">
            {ANALYSIS_STEPS.map((step, idx) => {
              const isDone = idx < currentStepIndex;
              const isActive = idx === currentStepIndex;
              return (
                <div
                  key={step}
                  className={`analyzing-step-item ${isDone ? "done" : isActive ? "active" : ""}`}
                >
                  {isDone ? (
                    <CheckIcon size={14} color="var(--emerald)" />
                  ) : isActive ? (
                    <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                  ) : (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.2)",
                      }}
                    />
                  )}
                  <span>{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {phase !== "analyzing" && (
        <div style={{ display: "flex", gap: "0.85rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloudIcon size={16} />
            <span>{file ? "Choose Another Zip" : "Browse Computer (.zip)"}</span>
          </button>

          {file && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onStartAnalysis}
            >
              <SparklesIcon size={16} />
              <span>{phase === "done" ? "Re-analyze Repository" : "Extract Architecture Graph"}</span>
            </button>
          )}
        </div>
      )}

      {/* Error Callout */}
      {error && (
        <div
          style={{
            marginTop: "1.25rem",
            padding: "0.85rem 1.25rem",
            borderRadius: "var(--radius-md)",
            background: "var(--rose-glow)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.6rem",
            color: "var(--rose)",
            fontSize: "0.88rem",
          }}
        >
          <AlertCircleIcon size={18} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
