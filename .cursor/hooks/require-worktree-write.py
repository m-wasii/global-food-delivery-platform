#!/usr/bin/env python3
"""Deny Cursor file writes in the primary Eatwave checkout."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

WRITE_TOOLS = {"Write", "StrReplace", "Delete", "EditNotebook"}
ALLOWLIST = {
    Path(".cursor/hooks.json"),
    Path(".cursor/hooks/session-start-worktree.py"),
    Path(".cursor/hooks/require-worktree-write.py"),
    Path(".cursor/rules/parallel-agent-worktrees.mdc"),
    Path(".cursor/rules/git-branching.mdc"),
    Path(".cursor/rules/tdd.mdc"),
    Path(".gitignore"),
}


def emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()


def parse_input() -> dict:
    raw = sys.stdin.read()
    return json.loads(raw) if raw.strip() else {}


def tool_input_obj(data: dict) -> dict:
    value = data.get("tool_input", {})
    if isinstance(value, str):
        try:
            return json.loads(value) if value.strip() else {}
        except json.JSONDecodeError:
            return {}
    return value if isinstance(value, dict) else {}


def repo_root_from_cwd(cwd: str | None) -> Path | None:
    start = Path(cwd) if cwd else Path.cwd()
    try:
        start = start.resolve()
    except OSError:
        return None
    for candidate in (start, *start.parents):
        if (candidate / ".git").exists() or (candidate / ".git").is_file():
            return candidate
    return None


def is_under(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except (OSError, ValueError):
        return False


def main() -> int:
    if os.environ.get("EATWAVE_ALLOW_PRIMARY_WRITES") == "1":
        emit({"permission": "allow"})
        return 0
    if os.environ.get("EATWAVE_ENFORCE_WORKTREE") != "1":
        emit({"permission": "allow"})
        return 0

    data = parse_input()
    tool_name = data.get("tool_name") or ""
    if tool_name not in WRITE_TOOLS:
        emit({"permission": "allow"})
        return 0

    cwd = data.get("cwd")
    root = repo_root_from_cwd(cwd)
    if root is None:
        emit({"permission": "allow"})
        return 0

    tool_input = tool_input_obj(data)
    raw_paths = [
        tool_input.get(key)
        for key in ("path", "file_path", "target_notebook", "notebook_path")
    ]
    paths = [Path(p) for p in raw_paths if isinstance(p, str) and p.strip()]
    if not paths:
        emit({"permission": "allow"})
        return 0

    for path in paths:
        if not path.is_absolute():
            path = (Path(cwd) / path) if cwd else (root / path)
        if not is_under(path, root):
            continue

        try:
            relative = path.resolve().relative_to(root.resolve())
        except (OSError, ValueError):
            emit({"permission": "deny", "user_message": "Could not safely resolve write path."})
            return 0

        if relative.parts and relative.parts[0] == ".worktrees":
            continue
        if relative in ALLOWLIST:
            continue

        emit({
            "permission": "deny",
            "agent_message": (
                "Blocked a write in the primary Eatwave checkout. Create an isolated "
                "worktree and move the writer root there before editing:\n"
                "  .\\scripts\\new-worktree.ps1 feat/<short-scope>\n"
                "Escape hatch (only for deliberate repository bootstrap): "
                "EATWAVE_ALLOW_PRIMARY_WRITES=1"
            ),
            "user_message": "Blocked primary-checkout write; use an isolated .worktrees/ worktree.",
        })
        return 0

    emit({"permission": "allow"})
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        sys.stderr.write(f"Eatwave write-guard hook error: {exc}\n")
        # The hook is configured failClosed by Cursor.
        emit({"permission": "deny", "user_message": "Write guard failed; inspect Cursor hook output."})
        raise SystemExit(0)
