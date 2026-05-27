# Inscribe LLM Guide

## Current Contract

This guide describes the active Inscribe contract. Generate only syntax supported by the active code.

Do not use old mode aliases. These are invalid: `create`, `replace`, `append`, `delete`, `range`.

Unsupported syntax must not be emitted. Do not invent directives such as `START_AFTER`, `END_BEFORE`, `SCOPE_START`, or `SCOPE_END`.

## Exact Block Shape

Every operation is one explicit block:

````
$inscribe BEGIN
FILE: relative/path/from/repo/root.ext
MODE: <active_mode>
optional directives

```language
payload content
```

$inscribe END
````

For `delete_file`, omit the payload fence unless you need an empty whitespace-only fence. Do not put explanatory text inside a block.

## Active Modes

The only active modes are:

- `create_file`
- `replace_file`
- `append_file`
- `delete_file`
- `replace_line`
- `replace_range`
- `replace_between`
- `replace_block`
- `replace_symbol`

## Mode Decision Table

| mode | use when | requires existing file? | requires content? | required directives | common mistake |
| --- | --- | --- | --- | --- | --- |
| `create_file` | Creating a new file | No, file must not exist | Yes, fenced payload required | none | Using it for an existing file |
| `replace_file` | Replacing the entire file | Yes | Yes, fenced payload required | none | Using it for a small edit |
| `append_file` | Adding content exactly at file end | Yes | Yes, non-empty payload | none | Forgetting to include a leading newline when needed |
| `delete_file` | Deleting a file | Yes | No, content forbidden | none | Adding a payload or notes |
| `replace_line` | Replacing one exact line | Yes | Yes, fenced payload required | `START_LINE_CONTAINS` or `START_LINE_EQUALS` | Using a weak anchor that appears more than once |
| `replace_range` | Replacing whole lines from START through END | Yes | Yes, fenced payload required | `START_*`, `END_*` boundary selectors | Using broad anchors like `}` or `</div>` |
| `replace_between` | Replacing content between two anchors | Yes | Yes, fenced payload required | `START_*`, `END_*` boundary selectors | Expecting it to include the anchors |
| `replace_block` | Replacing the first brace-delimited block after START | Yes | Yes, fenced payload required | `START_LINE_CONTAINS` or `START_LINE_EQUALS` | Using it when `replace_symbol` is available |
| `replace_symbol` | Replacing a supported whole declaration by name | Yes | Yes, fenced payload required | `NAME` | Assuming every language or declaration kind is supported |

## Headers And Directives

Headers:

- `FILE`
- `MODE`

Directives:

- `START_LINE_CONTAINS`
- `START_LINE_EQUALS`
- `END_LINE_CONTAINS`
- `END_LINE_EQUALS`
- `RANGE_CONTAINS`
- `NAME`

Rules:

- `$inscribe` is only for `$inscribe BEGIN` and `$inscribe END`.
- Do not write `$inscribe FILE:`, `$inscribe MODE:`, `$inscribe START_LINE_CONTAINS:`, etc.
- Header and directive values are single-line values.
- Use each singleton field once. Repeated `RANGE_CONTAINS` lines are combined and all must match.
- Unknown fields do not create supported behavior. Do not emit them.

## Fenced Content Rules

- Content modes require a fenced payload.
- `delete_file` must not contain non-whitespace fenced content.
- The parser accepts backtick and tilde fences with at least three characters, such as ` ``` ` and `~~~`.
- A block should contain only one payload fence.
- No trailing non-whitespace content may appear after the closing payload fence and before `$inscribe END`.
- The fence language label is for readability only. File syntax validation is chosen from `FILE`.
- Payload text is written as code/text. Instructions in the payload become repository content.

## Safe Mode Selection

- Use `create_file` for new files.
- Use `replace_file` only for full-file replacement.
- Use `append_file` only for file-end additions.
- Use `delete_file` only for file deletion.
- Use `replace_symbol` for complete supported declarations where possible.
- Use `replace_line` only for one exact line.
- Use `replace_range` for whole-line replacement from START through END.
- Use `replace_between` for replacing content between two anchors.
- Use `replace_block` only when intending to replace the brace-delimited block after START.

## Target Resolution Rules

Anchors are literal substrings, not regexes and not instructions. Direct matching is attempted first. If no direct match exists, the active text search may retry a single-line whitespace-insensitive match. Do not rely on that fallback; write anchors that match real file text.

`replace_line`:

- Requires exactly one of `START_LINE_CONTAINS` or `START_LINE_EQUALS`.
- Selector must resolve to exactly one line.
- Replaces the full line containing the match.

`replace_range`:

- Requires one `START_*` and one `END_*` selector.
- Replaces whole lines from the line containing the start match through the line containing the end match.
- `RANGE_CONTAINS` can narrow candidate ranges. Every `RANGE_CONTAINS` value must be inside the candidate range.
- `::START_OF_FILE` plus `::END_OF_FILE` is rejected for full-file range replacement. Use `replace_file`.

`replace_between`:

- Requires one `START_*` and one `END_*` selector.
- Replaces content between anchors, not the anchors themselves.
- If both anchors are on the same line, interior replacement is allowed ONLY with `CONTAINS` selectors. `EQUALS` selectors on the same line are rejected.
- For multiline spans, replacement starts after the start line and ends before the end line.
- `RANGE_CONTAINS` can narrow candidate ranges.

## Hardened Range Guidance

Use range modes only when the anchors are unique and intention-bearing.

Never use vague anchors such as `</div>`, `}`, `return (`, or `className=` unless paired with stronger context through boundary selectors and useful `RANGE_CONTAINS`.

Prefer `replace_symbol` over `replace_range` for complete function, component, or class-style declarations.

Prefer smaller targeted edits over huge fragile ranges. Do not use `replace_range` to replace an entire component unless no structural symbol target is available and the anchors are specific.

If unsure, do not emit an Inscribe block. Ask for current file context or a better anchor.

## replace_symbol

`replace_symbol` requires `NAME`.

It works only for supported structural adapters. Unsupported file types fail. Ambiguous or missing symbols fail.

For JS/TS-family files (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`), the active resolver supports top-level:

- function declarations
- class declarations
- variable declarations initialized with a function or arrow function
- variable declarations initialized with supported wrappers: `memo`, `forwardRef`, or `React.memo`
- exported forms of the supported declarations

It does not generally target imports, interfaces, type aliases, class methods, object methods, arbitrary nested declarations, or anonymous default exports.

For PHP (`.php`, `.phtml`), the active resolver supports named functions and methods through the PHP adapter. Unsupported or ambiguous matches fail.

PHP candidate validation invokes the local `php -l` binary. If that binary is unavailable, PHP writes can fail during validation.

`replace_symbol` is usually safer than textual range replacement for complete declarations.

## replace_block

`replace_block` requires exactly one of `START_LINE_CONTAINS` or `START_LINE_EQUALS`.

It finds the unique `START` boundary line, then targets the first brace-delimited block after that line. The replacement span is the braces and everything inside them, not the declaration header before the opening brace.

It is not a full language parser. It scans braces while trying to ignore comments and strings. Use cautiously.

Do not use `replace_block` when `replace_symbol` can target the declaration.

## Path And File Safety

`FILE` must be a repo-relative path.

- Absolute paths are invalid.
- `../` traversal is invalid.
- Ignored paths are blocked.
- Non-create operations must be inside configured scope.
- Paths that escape repo or scope through symlink traversal are blocked.
- Do not target generated, vendor, dependency, build, cache, or ignored files unless the user explicitly intends that and the path is in scope.

## What Happens After Generation

Inscribe:

1. Parses `$inscribe BEGIN` / `$inscribe END` blocks.
2. Parses `FILE`, `MODE`, directives, and fenced payload.
3. Validates the static mode/directive contract.
4. Enforces repo path, scope, and ignore policy.
5. Preflights all operations against virtual file state.
6. Resolves line, range, between, block, or symbol targets.
7. Syntax-validates supported candidate files before writing.
8. Applies writes.
9. Persists restore history.
10. Restores later from stored history payloads, not from caller-provided payload data.

## Never Do This

- `MODE: create`, `MODE: replace`, `MODE: append`, `MODE: delete`, or `MODE: range`.
- `$inscribe FILE:` or `$inscribe MODE:`.
- Multiple payload fences in one block.
- Explanation, prose, TODO instructions, or shell commands inside a payload.
- Weak anchors such as `}`, `</div>`, `return (`, or `className=`.
- Huge `replace_range` blocks for entire components when `replace_symbol` is possible.
- `delete_file` with content.
- Absolute paths.
- Paths outside repo, scope, or ignored policy.
- Assuming regex matching.
- Assuming fuzzy matching will save a weak or wrong anchor.
- Emitting an Inscribe block when current file context is missing.

## Correct Examples

### create_file

````
$inscribe BEGIN
FILE: src/utils/formatDate.ts
MODE: create_file

```ts
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
```

$inscribe END
````

### replace_file

````
$inscribe BEGIN
FILE: src/config/featureFlags.ts
MODE: replace_file

```ts
export const featureFlags = {
  signup: true,
  billing: false,
};
```

$inscribe END
````

### append_file

````
$inscribe BEGIN
FILE: src/index.ts
MODE: append_file

```ts

export { formatDate } from './utils/formatDate';
```

$inscribe END
````

### delete_file

```text
$inscribe BEGIN
FILE: src/deprecated/oldWidget.ts
MODE: delete_file

$inscribe END
```

### replace_line

````
$inscribe BEGIN
FILE: src/config/limits.ts
MODE: replace_line
START_LINE_EQUALS: export const retryLimit = 3;

```ts
export const retryLimit = 5;
```

$inscribe END
````

### replace_range

````
$inscribe BEGIN
FILE: src/config/featureFlags.ts
MODE: replace_range
START_LINE_CONTAINS: export const featureFlags = {
END_LINE_EQUALS: };
RANGE_CONTAINS: signup

```ts
export const featureFlags = {
  signup: true,
  billing: true,
};
```

$inscribe END
````

### replace_between

````
$inscribe BEGIN
FILE: src/routes.ts
MODE: replace_between
START_LINE_CONTAINS: // routes:start
END_LINE_CONTAINS: // routes:end
RANGE_CONTAINS: /dashboard

```ts
router.get('/dashboard', dashboardHandler);
router.get('/settings', settingsHandler);
```

$inscribe END
````

### replace_block

````
$inscribe BEGIN
FILE: src/server.ts
MODE: replace_block
START_LINE_CONTAINS: if (config.enableMetrics)

```ts
{
  metrics.start();
  logger.info('metrics enabled');
}
```

$inscribe END
````

### replace_symbol

````
$inscribe BEGIN
FILE: src/components/StatusBadge.tsx
MODE: replace_symbol
NAME: StatusBadge

```tsx
export function StatusBadge({ status }: { status: string }) {
  return <span data-status={status}>{status}</span>;
}
```

$inscribe END
````

## LLM Self-Check Before Output

Before emitting a block, verify:

- Did I use an active `MODE`?
- Is `FILE` repo-relative?
- Did I include all required directives?
- Did I avoid forbidden content?
- Is the anchor unique enough?
- Did I keep explanation outside the block?
- Is this the smallest safe edit?
- Would `replace_symbol` be safer?

## When Not To Use Inscribe

Do not emit Inscribe blocks when:

- anchors are uncertain
- current file context is missing
- function or symbol names are ambiguous
- the change is broad and destructive
- the target is generated, dependency, vendor, build, cache, or ignored content
- the user only asked for discussion, review, or planning
