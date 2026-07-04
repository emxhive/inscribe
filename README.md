# Inscribe

A desktop app that turns explicitly tagged LLM output into reviewable repository changes.

Inscribe parses `<<<INSCRIBE` blocks from LLM responses, validates the operation contract, shows diffs, and applies changes with restore history.

## Block Format

```
<<<INSCRIBE
FILE: relative/path/from/repo/root.ext
MODE: operation_mode

<<<CONTENT
```ts
exact payload here
```
CONTENT>>>
INSCRIBE>>>
```

- `<<<INSCRIBE` and `INSCRIBE>>>` must appear on their own lines, unindented, and must never be wrapped in Markdown fences.
- Section openers: `<<<CONTENT`, `<<<SEARCH`, `<<<STARTS_WITH`
- Section closers: `CONTENT>>>`, `SEARCH>>>`, `STARTS_WITH>>>`
- Code payloads inside sections should be wrapped in Markdown code fences — the parser strips the fence wrappers before writing to disk.

## Operation Modes

| Mode | Requires | Description |
|---|---|---|
| `create_file` | `CONTENT` | Create a new file with complete content |
| `replace_file` | `CONTENT` | Replace an entire file with complete content |
| `delete_file` | — | Delete a file |
| `replace_text` | `SEARCH` + `CONTENT` | Replace an exact text match |
| `replace_node` | `SELECTOR` + `CONTENT` | Replace a structural node via Tree-sitter (`.ts`, `.tsx`) |

`replace_node` optionally accepts `STARTS_WITH` to disambiguate repeated structural targets (e.g. multiple `if_statement` nodes inside a function).

## Selectors (`replace_node`)

Selectors use exact symbol names from source:

```
SELECTOR: function:buildValue
SELECTOR: class:UserService
SELECTOR: class:UserService > method:save
SELECTOR: function:resolvePlan > if_statement
```

Supported kinds: `class`, `method`, `function`, `if_statement`.

## Payload Rules

- `CONTENT` is the exact final text — not a patch, not pseudo-code, not a summary.
- Omitting code from a replacement payload deletes that code.
- `SEARCH` must be copied byte-for-byte from the current source.
- Placeholders are literal unless the user explicitly wants them in the output file.

## Workflow

1. Select a repository.
2. Paste an LLM response containing Inscribe blocks.
3. Review parsed operations and diffs.
4. Apply selected, valid, or all pending changes.
5. Restore from persisted history when needed.

## Safety

- `FILE` must be repository-relative. Absolute paths and `../` traversal are rejected.
- Ignored paths are blocked. Non-create operations must be within configured scope.
- Blocks execute in order; later blocks resolve against the virtual state produced by earlier blocks.
- If disk writes succeed but history persistence fails, writes are rolled back.

## LLM Authoring Guide

For the full authoring contract, see [docs/llm-guide.md](docs/llm-guide.md).
