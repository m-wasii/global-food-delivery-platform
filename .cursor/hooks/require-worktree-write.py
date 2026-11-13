#!/usr/bin/env python3
"""Deny Cursor file writes in the primary Eatwave checkout."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

WRITE_TOOLS = {"Write", "StrReplace", "Delete", "EditNotebook"}
ALLOWLIST = {
    Path(".cursor/hooks.json"),
    Path(".cursor/hooks/session-start-worktree.py"),
    Path(".cursor/hooks/require-worktree-write.py"),
    Path(".cursor/rules/parallel-agent-worktrees.mdc"),
    Path(".cursor/rules/agent-coordination.mdc"),
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


def git_path(cwd: Path, argument: str) -> Path | None:
    try:
        completed = subprocess.run(
            ["git", "rev-parse", argument],
            cwd=cwd,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return None
    if completed.returncode != 0:
        return None
    value = completed.stdout.strip()
    if not value:
        return None
    path = Path(value)
    return (cwd / path).resolve() if not path.is_absolute() else path.resolve()


def is_linked_worktree(cwd: Path) -> bool:
    git_dir = git_path(cwd, "--git-dir")
    common_dir = git_path(cwd, "--git-common-dir")
    return bool(git_dir and common_dir and git_dir != common_dir)


def main() -> int:
    if os.environ.get("EATWAVE_ALLOW_PRIMARY_WRITES") == "1":
        emit({"permission": "allow"})
        return 0

    data = parse_input()
    tool_name = data.get("tool_name") or ""
    if tool_name not in WRITE_TOOLS:
        emit({"permission": "allow"})
        return 0

    cwd_value = data.get("cwd")
    cwd = Path(cwd_value).resolve() if isinstance(cwd_value, str) and cwd_value else Path.cwd().resolve()
    root = repo_root_from_cwd(str(cwd))
    if root is None:
        emit({"permission": "allow"})
        return 0

    # A genuine linked worktree is the safe write area. This check runs for
    # every write, including agent sessions that did not run sessionStart.
    if is_linked_worktree(cwd):
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
            path = cwd / path

        try:
            relative = path.resolve().relative_to(root.resolve())
        except ValueError:
            # External paths are outside this repository's write policy.
            continue
        except OSError:
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
                "Git worktree and move the writer root there before editing:\n"
                "  .\\scripts\\new-worktree.ps1 feat/<short-scope>\n"
                "Do not bypass this guard with shell redirection or another write path. "
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
        sys.stderr.write(f"Eatwave write-guard hook error: {exc}\\n")
        emit({"permission": "deny", "user_message": "Write guard failed; inspect Cursor hook output."})
        raise SystemExit(0)
