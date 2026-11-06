---
name: configure-skill-invocation
description: Make selected global or project skills available only through explicit invocation.
disable-model-invocation: true
license: MIT
metadata:
  author: simonwong
  version: "1.0.0"
---

# Configure Skill Invocation

Accept one optional scope argument: `global` or `project`.

## Workflow

1. Resolve the scope.
   - Use `global` or `project` when supplied.
   - With no scope, ask only, "Configure project or global skills?" Then wait for the answer.
   - For any other value, ask the user to choose `global` or `project`.
2. Discover every `SKILL.md` in scope with read-only shell commands. Prefer `rg --files --follow`; use an equivalent command when unavailable. Support nested category directories, skip hidden directories such as `.system`, and deduplicate symlinks by real path.
3. Inspect each skill's `SKILL.md` frontmatter and `agents/openai.yaml`. A skill is a candidate when either target value is missing or different:

   ```yaml
   # SKILL.md frontmatter
   disable-model-invocation: true
   ```

   ```yaml
   # agents/openai.yaml
   policy:
     allow_implicit_invocation: false
   ```

   Report skills that cannot be parsed reliably as invalid and leave them unchanged.
4. Present every candidate in one selection. Show each name, path, and missing or conflicting setting. Show invalid skills separately and make them unselectable. Use a structured multi-select when available; otherwise accept numbers, names, `all`, or `none`. Require an explicit selection and wait for the answer. If no candidates exist, report that and finish.
5. Modify only the selected skills, completing all writes in one pass:
   - Add or correct top-level `disable-model-invocation: true` in the `SKILL.md` frontmatter.
   - Create `agents/openai.yaml` when absent. Otherwise add or correct only `policy.allow_implicit_invocation: false`, preserving every other `interface`, `policy`, `dependencies`, comment, and formatting choice.
   - Use the available file-editing tools or safe shell commands. The changed-file set must match the user's selection exactly.
6. Re-read every selected file and confirm both target values. Scan again and confirm selected skills are no longer candidates. Report modified, unchanged, and invalid skills, then finish this skill invocation.

## Scope

- `global`: scan `~/.agents/skills` and `${CODEX_HOME:-$HOME/.codex}/skills`.
- `project`: locate the Git root from the current directory, then scan `.agents/skills` and `.codex/skills` within it. Use the current directory when outside Git.
