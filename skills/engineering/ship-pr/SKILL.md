---
name: ship-pr
description: Commit outstanding work in batches, then open, merge, and clean up a pull request.
disable-model-invocation: true
---

# Ship PR

Carry the current work from the working tree to merged on the default branch, leaving no branch behind.

## Workflow

1. Read the state before changing anything: `git status --short --branch`, `git log --oneline -5`, and `git diff` plus `git diff --staged` for whatever is uncommitted. Past commits define the repo's message style — match it.
2. Decide what belongs in this PR. Work from the current task ships; unrelated dirty files (local config, scratch output, half-finished experiments) stay uncommitted. Ask when a file is ambiguous instead of sweeping it in — a stray file in a PR is harder to undo than a question.
3. Branch when the current branch is the default one. Name it after the change: `docs/polish-readme`, `fix/token-refresh`.
4. Commit in batches: one commit per coherent intent, staging only that intent's paths. Batching means commits match intents, so a single-intent change is one commit — splitting further just makes the history noisier. When nothing is uncommitted, the branch already carries the work; go to step 5.
5. Push with `git push -u origin <branch>`, then open the PR with `gh pr create --base <default-branch>`. The body says what changed and how it was verified.
6. Merge with `gh pr merge <number> --delete-branch` and a strategy the repo allows — `gh repo view --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed` tells you which. If the merge is blocked by failing checks, a required review, or a conflict, report the blocker with the PR link and stop.
7. Clean up and verify: `git fetch --prune`, then `git status --short --branch` and `git branch -a`. Done means the default branch is checked out and clean, and the feature branch is gone both locally and on the remote.

Report the PR link, the commits that shipped, and anything left uncommitted on purpose.
