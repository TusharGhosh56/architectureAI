type Props = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatMessage({ role, content }: Props) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <strong>{role === "user" ? "You" : "ArchitectAI"}</strong>
      <p style={{ margin: "0.25rem 0 0" }}>{content}</p>
    </div>
  );
}
