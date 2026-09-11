import { SUGGESTED_PROMPTS } from "../lib/chatLocal";
import {
  GitBranchIcon,
  LayersIcon,
  AlertCircleIcon,
  SparklesIcon,
  TerminalIcon,
} from "./Icons";

type Props = {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
};

export default function SuggestedPrompts({ onSelectPrompt, disabled = false }: Props) {
  function getIcon(id: string) {
    switch (id) {
      case "graph":
        return <GitBranchIcon size={14} color="var(--cyan)" />;
      case "core":
        return <LayersIcon size={14} color="var(--indigo-bright)" />;
      case "cycles":
        return <AlertCircleIcon size={14} color="var(--amber)" />;
      case "auth":
        return <TerminalIcon size={14} color="var(--emerald)" />;
      default:
        return <SparklesIcon size={14} color="var(--cyan-bright)" />;
    }
  }

  return (
    <div className="prompt-chips-row">
      {SUGGESTED_PROMPTS.map((p) => (
        <button
          key={p.id}
          type="button"
          className="prompt-chip-btn"
          onClick={() => onSelectPrompt(p.question)}
          disabled={disabled}
        >
          {getIcon(p.id)}
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  );
}
