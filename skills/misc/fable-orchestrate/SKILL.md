---
name: fable-orchestrate
description: Keep planning, verification, and hard problems in the main thread; dispatch implementation to Opus or Sonnet subagents.
disable-model-invocation: true
argument-hint: "[opus|sonnet]"
license: MIT
metadata:
  author: simonwong
  version: "2.0.0"
---

# Fable Orchestrate

From now on, keep in the main thread clarifying the request and hard problems: design decisions, tricky debugging, anything where judgement matters more than legwork.

Delegate implementation work: writing code, running tests, bulk edits.

## Split

Split along independence: each task edits its own files and runs without another task's result. Give each task a check: a command whose output shows the task is done.

A request that is one dependency chain has nothing to split: implement it in the main thread and dispatch only its lookups.

## Dispatch

Dispatch each task with the `Agent` tool at `effort: medium`. The argument sets `model`: `opus` (default) or `sonnet`.

Send lookups to `model: haiku`: finding files, reading code at scale, reading logs, summarizing.

Run independent tasks in parallel. Tell every subagent to do the work itself without spawning subagents.

## Verify

Accept a task by rerunning its check. If the check fails:

1. Send the task back to the same subagent with `SendMessage`.
2. Redispatch it to the same model at `effort: high`.
3. Take it into the main thread.
