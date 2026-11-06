---
name: fable-orchestrate
description: Keep planning, verification, and hard problems in the main thread; dispatch implementation to subagents.
disable-model-invocation: true
argument-hint: "[opus|sonnet|gpt|herdr <kind>]"
license: MIT
metadata:
  author: simonwong
  version: "1.0.0"
---

# Fable Orchestrate

From now on, keep in the main thread:

- Clarifying the request.
- Splitting it into tasks with acceptance criteria.
- Dispatching tasks.
- Verifying reports.
- Hard problems: design decisions, tricky debugging, anything where judgement matters more than legwork.

Delegate implementation work: reading code at scale, writing code, running tests, bulk edits.

## Dispatch

The argument picks the executor. Without one, use `opus`.

| Argument | Executor |
| --- | --- |
| `opus` (default), `sonnet` | `Agent` tool with `model` set to that name |
| `gpt` | `Agent` tool with `subagent_type: codex:codex-rescue`; prefix the prompt with `--wait --fresh` |
| `herdr <kind>` | `herdr` skill: start a `<kind>` agent, `agent prompt --wait`, then `agent read` for its report |

Run independent tasks in parallel. Tell every subagent to do the work itself without spawning subagents.

## Report

Ask each subagent to report:

- What was done.
- Files changed.
- How it was verified, with command output.
- Open questions or blockers.

Verify each report against its acceptance criteria. Follow up on the same executor: `SendMessage` for `opus` and `sonnet`, `--wait --resume` for `gpt`, another `agent prompt` for `herdr`.
