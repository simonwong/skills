# In-Progress Skills

Unfinished skills. They are not published and the installer does not discover them. Move a skill back to `skills/<category>/` when it is ready.

The current set forms a Simplified Chinese writing workflow:

`collect (style-extract, material-ingest) -> retrieve (material-retrieve) -> create (compose) -> polish (rewrite, title-gen)`

## Shared Data Contract

The connected writing workflow skills read and write `./writing-workspace/` at runtime.

```text
writing-workspace/
├── styles/
│   ├── my_style.json
│   ├── index.jsonl
│   └── entries/sty_*.json
├── materials/
│   ├── index.jsonl
│   └── entries/mat_*.json
└── drafts/
```

- Store one JSON object per line in index files.
- Use `sty_YYYYMMDD_NNN` and `mat_YYYYMMDD_NNN` entry IDs.
- Escape quotes, backslashes, and newlines in JSON text fields.

## Dependencies

- `style-extract` writes `styles/my_style.json`, `styles/index.jsonl`, and `styles/entries/`.
- `material-ingest` writes `materials/index.jsonl` and `materials/entries/`.
- `material-retrieve` reads `materials/index.jsonl` and `materials/entries/`.
- `compose` reads `styles/my_style.json` and `materials/index.jsonl`, then retrieves relevant material.
- `rewrite` reads `styles/my_style.json`.
- `title-gen` may read `styles/my_style.json` for title preferences.

When changing a shared schema, update every producer and consumer in the same change.

## Writing Rules

- Write skill instructions and user-facing output in Simplified Chinese.
- Keep `name`, `description`, `license`, `metadata.author`, and `metadata.version` in each `SKILL.md` frontmatter.
- Quote version strings, for example `"1.2.0"`.
- Include concrete Chinese trigger phrases in `description`.
- Bump `metadata.version` whenever a writing skill's `SKILL.md` changes.
