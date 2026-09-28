# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists: it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`**: one file per skill, named after the skill (`write-article.md`), plus `writing-skills.md` for decisions shared by the writing skills. Read the files for the skills you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── writing-skills.md      ← decisions shared by skills/writing/
│   ├── write-article.md
│   └── writing-ai-check.md
└── skills/
```

Each ADR file reads as the current state: the decisions in force and the reason for each. When a decision changes, rewrite it in place in that skill's file. Record the why, and leave the steps and rules themselves to the skill, which stays their single source of truth. Put a decision that spans several skills in the shared file and link to it from the skill files.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts `docs/adr/writing-ai-check.md` (default direct delivery), but worth reopening because…_
