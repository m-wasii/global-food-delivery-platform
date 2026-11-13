#!/usr/bin/env python3
"""Enable the primary-checkout write guard for local Cursor sessions."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()


def git_output(*args: str) -> str | None:
    try:
        completed = subprocess.run(
            ["git", *args],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return None
    if completed.returncode != 0:
        return None
    return completed.stdout.strip()


def in_linked_worktree() -> bool:
    git_dir = git_output("rev-parse", "--git-dir")
    common_dir = git_output("rev-parse", "--git-common-dir")
    if not git_dir or not common_dir:
        return False
    try:
        return Path(git_dir).resolve() != Path(common_dir).resolve()
    except OSError:
        return False


def main() -> int:
    raw = sys.stdin.read()
    data = json.loads(raw) if raw.strip() else {}

    if in_linked_worktree():
        emit({
            "env": {"EATWAVE_ENFORCE_WORKTREE": "0"},
            "additional_context": (
                "You are inside an isolated Eatwave Git worktree. "
                "Make changes only within this worktree and your assigned scope."
            ),
        })
        return 0

    emit({
        "env": {"EATWAVE_ENFORCE_WORKTREE": "1"},
        "additional_context": (
            "EATWAVE PRIMARY CHECKOUT WRITE GUARD IS ON. "
            "Do not edit implementation files here. Create an isolated worktree "
            "with .\\scripts\\new-worktree.ps1 feat/<short-scope>, then move "
            "the writer agent root into that worktree. One write agent per "
            "worktree; maximum 3 concurrent write agents."
        ),
    })
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        sys.stderr.write(f"Eatwave session-start hook error: {exc}\n")
        emit({})
        raise SystemExit(0)
