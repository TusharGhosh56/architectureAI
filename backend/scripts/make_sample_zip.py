"""Sample multi-file project used for pipeline smoke tests."""

from pathlib import Path

SAMPLE = {
    "README.md": "# Demo shop\n",
    "app/main.py": '''\
"""Application entrypoint."""
from app.auth.service import login
from app.db.database import get_connection

def main():
    """Start the app."""
    conn = get_connection()
    return login("admin", "secret", conn)

if __name__ == "__main__":
    main()
''',
    "app/auth/service.py": '''\
"""Auth service."""
from app.db.database import get_connection

def login(username: str, password: str, conn=None):
    """Authenticate a user against the database."""
    conn = conn or get_connection()
    return {"user": username, "ok": True}

def logout(session_id: str):
    """Invalidate a session."""
    return True
''',
    "app/db/database.py": '''\
"""Database helpers."""

def get_connection():
    """Return a fake DB connection."""
    return {"engine": "sqlite"}

def query(sql: str):
    """Run a SQL query."""
    return []
''',
    "app/api/routes.py": '''\
from app.auth.service import login, logout

def handle_login(body: dict):
    """HTTP login handler."""
    return login(body["username"], body["password"])

def handle_logout(body: dict):
    return logout(body["session_id"])
''',
    "frontend/src/api.ts": '''\
import { client } from "./client";

export function login(user: string, pass: string) {
  return client.post("/login", { user, pass });
}
''',
    "frontend/src/client.ts": '''\
export const client = {
  post(url: string, body: unknown) {
    return fetch(url, { method: "POST", body: JSON.stringify(body) });
  },
};
''',
}


def write_sample(root: Path) -> None:
    for rel, content in SAMPLE.items():
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
