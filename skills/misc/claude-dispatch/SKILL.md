---
name: claude-dispatch
description: Keep code edits and judgment in the main thread; dispatch lookups, research, and parallel pieces to Haiku, Sonnet, or Opus subagents by task.
disable-model-invocation: true
license: MIT
metadata:
  author: simonwong
  version: "2.1.0"
---

# Claude Dispatch

From now on, the main thread keeps code edits and judgment calls. Dispatch with the `Agent` tool only a task that is self-contained: the brief stands without this conversation, and the report is far smaller than the work behind it.

| Task | `model` | `effort` |
| --- | --- | --- |
| Lookup: find files, read code at scale, read logs, run tests and commands and collect output, summarize | `haiku` | omit |
| Research: investigate a question across the code or the web and report findings | `sonnet` | `medium` |
| Simple browser operations | `sonnet` | `medium` |
| Complex browser operations, computer use | `opus` | `medium` |

Run independent tasks in parallel.

## Parallel edits

A change that splits into independent pieces is the one edit to dispatch: each piece edits its own files and runs without another piece's result. Give each piece a check: a command whose output shows the piece is done.

| Piece | `model` | `effort` |
| --- | --- | --- |
| Scoped: the brief settles every design choice | `sonnet` | `medium` |
| Open: the brief leaves design choices to the subagent | `opus` | `medium` |

Accept a piece by rerunning its check. If the check fails:

1. Send the piece back to the same subagent with `SendMessage`.
2. Redispatch it to the same model at `effort: high`.
3. Take it into the main thread.

## Stuck

When the main thread's own attempt at a task fails twice, stop and ask the user to raise the session's effort or switch it to a stronger model.
