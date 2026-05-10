# Inscribe

Inscribe is a desktop app that turns LLM output into safe, reviewable repository changes.
It only applies explicitly tagged blocks and enforces strict validation before any write.

## Core Guarantees

- **Explicit intent only**: only `$inscribe BEGIN` / `$inscribe END` blocks are considered.
- **Fail-closed behavior**: invalid blocks fail safely; no partial apply for that block.
- **Pre-write candidate validation for JS/TS-family files**: `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs` candidates are parsed in memory before write.
- **Structural targeting support** for risky edits:
  - `MODE: replace_symbol` for full owning declaration replacement.
- **Canonical review model**: replacement windows and actual diff hunks are produced by the engine and rendered by UI.

## Basic Workflow

1. Select a repository.
2. Paste full LLM response.
3. Inscribe parses blocks and validates directives/paths.
4. Review replacement windows + precise diff hunks.
5. Apply selected/valid changes.
6. Restore safely via history when needed.

## Inscribe Block Format

````
$inscribe BEGIN
FILE: relative/path/from/repo/root.ext
MODE: create | replace | append | range | delete | replace_symbol
(optional directives)

```language
<content>
```

$inscribe END
````

Rules:
- `$inscribe` prefix is valid only for `BEGIN` and `END` markers.
- `FILE:`, `MODE:`, and directives must be unprefixed.
- For `MODE: delete`, fenced content is optional.

## Supported Modes

- **create**: create a new file (target must not exist)
- **replace**: replace an existing file entirely
- **append**: append to existing file end
- **range**: replace a resolved subrange in an existing file
- **delete**: remove an existing file
- **replace_symbol**: replace a full owning declaration by symbol name (`NAME:` required)

## Directive Quick Reference

### `MODE: range`

Required:
- Exactly one start directive: `START` | `START_BEFORE` | `START_AFTER`

Optional end directives:
- `END` | `END_BEFORE` | `END_AFTER`

Optional scoped search:
- `SCOPE_START` + `SCOPE_END` (must be provided together)

Optional repeated `CONTAINS:` directives for disambiguation (ALL must match)

Notes:
- `CONTAINS:` is a textual disambiguation directive that narrows broad `START` matches.

### `MODE: replace_symbol`

Required:
- `NAME: SymbolName`

Behavior:
- Resolves a full owning declaration for the symbol (function declaration, supported variable/function-like declarations, supported wrappers).
- Fails safely when zero or multiple matches are found.

## Parse Validation & Diagnostics

For JS/TS-family file candidates, Inscribe parses in-memory candidate content before disk write.
On parse failure, write is blocked and a copyable `INSCRIBE_PARSE_ERROR` diagnostic is surfaced with context and file-not-modified note.

## Review Model

Review distinguishes two concepts:

- **Replacement windows**: what the operation intends to replace.
- **Diff hunks**: actual changed line hunks for user-facing review/navigation.

UI highlights diff hunks primarily, with replacement windows as secondary context.

## Documentation

- [`docs/llm-guide.md`](docs/llm-guide.md): LLM authoring guide (recommended prompt contract)
- [`docs/terminology.md`](docs/terminology.md): terminology and behavior references
