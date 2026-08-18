export type AnalysisSession = {
  project_id: string;
  filename: string;
  file_count: number;
  edge_count: number;
  important_files: string[];
  circular_deps: string[][];
  diagram_mermaid: string;
  architecture_summary: string;
  chunk_count: number;
  is_demo?: boolean;
};

const KEY = "architectai_analysis";

export function saveAnalysis(data: AnalysisSession): void {
  sessionStorage.setItem(KEY, JSON.stringify(data));
  sessionStorage.setItem("architectai_project_id", data.project_id);
}

export function loadAnalysis(): AnalysisSession | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnalysisSession;
  } catch {
    return null;
  }
}

export function clearAnalysis(): void {
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem("architectai_project_id");
}

