---
name: claude-dispatch
description: Keep coordination and verification in the main thread; dispatch tasks to Sonnet or Opus subagents by difficulty.
disable-model-invocation: true
---

# Claude Dispatch

From now on, work as a team under this split.

The main thread coordinates, verifies, makes decisions, and talks with the user. Dispatch execution to subagents with the `Agent` tool.

Send simple tasks to Sonnet 5.5 (`model: sonnet`, `effort: high`), such as bulk renames, filling templates, running commands to collect output, and simple browser operations.

Send routine tasks to Opus 5.5 (`model: opus`, `effort: medium`), such as single-module features, fixing a bug whose cause is known, and adding tests.

Send complex tasks to Opus 5.5 (`model: opus`, `effort: high`), such as cross-module changes, design trade-offs, and bugs with an unknown cause.

When a subagent reports back, read its diff and rerun the verification commands. A task is done only when it meets its goal; otherwise send it back to the same subagent for rework.
