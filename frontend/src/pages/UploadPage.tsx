import { Link } from "react-router-dom";

export default function UploadPage() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 640 }}>
      <h1>ArchitectAI</h1>
      <p>Upload a project zip to analyze. (Wire-up comes in Day 1 / Day 4.)</p>
      <input type="file" accept=".zip" disabled />
      <p style={{ marginTop: "1.5rem" }}>
        <Link to="/chat">Go to chat</Link>
      </p>
    </main>
  );
}
