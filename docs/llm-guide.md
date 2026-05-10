# INSCRIBE LLM GUIDE (CURRENT CONTRACT)

This guide teaches LLMs how to produce Inscribe-compatible blocks safely and predictably.

## Core authoring principle

Use Inscribe blocks only for code that should be applied.
Keep all explanation/examples outside Inscribe blocks.

## Block format

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

### Prefix rule (strict)

- `$inscribe` prefix is valid only on `BEGIN` and `END` lines.
- Do **not** prefix `FILE:`, `MODE:`, or directives.

## Mode selection decision tree

1. **Need a new file** -> `MODE: create`
2. **Need to rewrite almost entire file** -> `MODE: replace`
3. **Need to add content at file end** -> `MODE: append`
4. **Need to remove file** -> `MODE: delete`
5. **Need to replace a full function/component/helper declaration** -> `MODE: replace_symbol` + `NAME:`
6. **Need to replace a specific subsection** -> `MODE: range`

## Best-practice structural editing

### A) Replace a full declaration safely

Prefer this when changing an entire component/function/helper.

```text
MODE: replace_symbol
NAME: ParticipantSurfacePanel
```

Why: avoids brittle start/end anchors for large declarations.

### B) Disambiguate broad textual range anchors

When `START` is broad/non-unique, add one or more `CONTAINS:` filters:

```text
MODE: range
START: <div
CONTAINS: ParticipantCard
CONTAINS: onRoundChange
```

`CONTAINS` uses simple string matching; all `CONTAINS` values must match.

## Range directive rules

### Start directives (exactly one required)
- `START`
- `START_BEFORE`
- `START_AFTER`

### End directives (optional for textual mode)
- `END`
- `END_BEFORE`
- `END_AFTER`

### Scoped search (optional)
- `SCOPE_START` and `SCOPE_END` must be provided together.

## Strict failure behavior to expect

- Missing or ambiguous anchors -> operation fails.
- `replace_symbol` no match/multiple matches -> operation fails.
- JS/TS-family candidate parse failure -> write blocked with parse diagnostic.

Design for safe retries: emit specific anchors/filters that are likely unique.

## Practical authoring guidelines

1. Prefer `replace_symbol` for full declaration rewrites.
2. Use `CONTAINS` to disambiguate broad `START` anchors.
3. Add `CONTAINS` when `START` is generic (e.g., `<div`).
4. Avoid fragile textual end anchors in complex TSX (`</div>`, `}`, etc.) when structural mode fits.
5. Keep one Inscribe block per apply target.

## Examples

### Create

$inscribe BEGIN
FILE: src/utils/date.ts
MODE: create

```ts
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

$inscribe END

### Replace symbol

$inscribe BEGIN
FILE: resources/js/pages/tournaments/show.tsx
MODE: replace_symbol
NAME: ParticipantSurfacePanel

```tsx
export const ParticipantSurfacePanel = () => {
  return <section>...</section>;
};
```

$inscribe END

### Range with disambiguation

$inscribe BEGIN
FILE: resources/js/pages/tournaments/show.tsx
MODE: range
START: <Deferred data="participants"
CONTAINS: ParticipantGrid

```tsx
<Deferred data="participants">
  <ParticipantGrid />
</Deferred>
```

$inscribe END

## Anti-patterns

- Prefixing headers/directives with `$inscribe`.
- Using one block to wrap multiple fenced code blocks.
- Forcing full component rewrites through fragile textual range anchors.
- Assuming fuzzy/regex matching for directives.

## Summary

For best results:
- Pick the safest mode for intent (`replace_symbol` or structural range when applicable).
- Keep anchors intent-bearing and unambiguous.
- Expect strict fail-safe behavior and iterate using diagnostic feedback.
