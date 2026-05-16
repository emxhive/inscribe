# INSCRIBE LLM GUIDE (CURRENT CONTRACT)

This guide is the prompt contract for producing Inscribe-compatible output.
Optimize for boring, literal, reviewable edits.

## Mental Model

Inscribe is not smart.

It is not a code generator, refactoring engine, formatter, typechecker, import fixer, instruction follower, or shell runner. It parses text markers, resolves the requested file/range/symbol, builds the candidate file text, and writes only that candidate text when validation allows it.

The fenced payload must already be the code/text to place in the repository. If you write instructions in the payload, those instructions are written into the file. For `range`, the payload is the inserted text; when replacing before remaining file content, Inscribe may add one trailing newline if the payload is nonempty and does not already end with `\n`.

## Response Shape

When producing real edits:

1. Put optional human explanation outside Inscribe blocks.
2. Put each intended file operation in its own Inscribe block.
3. Put only final code/text inside payload fences.
4. Put shell commands outside Inscribe blocks as separate shell fences.
5. Do not include example/template blocks in the same response as real edits.

When not producing real edits, do not output raw `$inscribe BEGIN` or `$inscribe END` marker lines. If you are explaining the format, escape or describe the markers in prose so they cannot be parsed as intended edits.

## Block Format

````
$inscribe BEGIN
FILE: relative/path/from/repo/root.ext
MODE: create | replace | append | range | delete | replace_symbol
(optional directives)

```language
<final payload text>
```

$inscribe END
````

Do not output angle-bracket placeholders such as `<final payload text>` in real blocks. Replace placeholders with actual paths, directives, and payload.

## Marker and Field Rules

- Use exact marker lines: `$inscribe BEGIN` and `$inscribe END`.
- Marker matching is case-insensitive and whitespace-tolerant, so a marker-looking line inside payload can still terminate or split the block. Avoid marker-only payload lines entirely.
- `$inscribe` is valid only on `BEGIN` and `END` marker lines.
- `FILE:`, `MODE:`, and every directive must be unprefixed.
- Use canonical uppercase field names and lowercase mode values.
- Mode values are exact: `create`, `replace`, `append`, `range`, `delete`, `replace_symbol`.
- Header and directive values are single-line only.
- Only `CONTAINS:` is intentionally repeatable. Do not duplicate `FILE:`, `MODE:`, `START*`, `END*`, or `NAME:`.
- Unknown unprefixed fields are ignored. Prefixed fields create parser warnings, and the desktop intake treats parser warnings/errors as blocking.

## Payload Rules

For every mode except `delete`, the first fenced code block after the headers/directives is the payload.

- The fence language label is ignored by Inscribe. Candidate validation is chosen by `FILE:` extension, not by the fence label.
- Text before the payload fence is parsed as headers/directives or ignored.
- Headers/directives after the payload fence are payload text, not metadata.
- Non-whitespace text after the closing payload fence and before `$inscribe END` is a parse error.
- Multiple payload fences in one block are a parse error unless they are inside a longer outer fence.
- If the payload contains triple backtick fences, use a longer outer fence such as ```` or use `~~~`.
- A target file that must contain a raw marker-only line such as `$inscribe END` cannot be represented safely in an Inscribe payload.

## Fallback Parsing Warning

Always use explicit `$inscribe BEGIN` / `$inscribe END` blocks for intended edits.

If a pasted response contains no explicit Inscribe markers, the engine has a fallback mode that may parse bare `FILE:` + `MODE:` + fenced-code triplets as blocks. Therefore, an explanation-only response should avoid bare `FILE:`/`MODE:` examples followed by code fences unless the markers are escaped or clearly not line-leading fields.

## Paths and Modes

`FILE:` is a path relative to the selected repository root. Use forward slashes. Do not use absolute paths. Do not use `..` to escape the repository. Paths are rejected if they resolve outside the repo or into ignored paths.

Default ignored prefixes include `.git/`, `node_modules/`, `vendor/`, `storage/`, `bootstrap/cache/`, `public/build/`, and `.inscribe/`; `.inscribeignore` can add more.

Mode selection:

1. New file -> `MODE: create`
2. Existing file, complete rewrite -> `MODE: replace`
3. Existing file, append exactly at EOF -> `MODE: append`
4. Existing file, delete file -> `MODE: delete`
5. Existing JS/TS/PHP file, replace a supported whole declaration -> `MODE: replace_symbol` + `NAME:`
6. Existing file, surgical line-based replacement -> `MODE: range`

`create` requires the target file to not exist. `replace`, `append`, `range`, `delete`, and `replace_symbol` require the target file to exist.

## Mode Details

### `MODE: create`

Use for a non-existing file. Parent directories are created when the target path is valid.

The payload becomes the full new file content.

### `MODE: replace`

Use only when the payload should become the entire existing file.

The payload replaces the full file. Do not use `replace` for a small edit unless intentionally regenerating the whole file.

### `MODE: append`

Use only when the payload belongs exactly at the end of the existing file.

Inscribe does not insert a leading newline or trailing newline for append. If appended content must start on a new line, put the leading newline in the payload.

### `MODE: delete`

Use only to remove an existing file.

No payload fence is required. If a payload fence is present, it is ignored. Do not put notes or instructions there.

### `MODE: replace_symbol`

Use when replacing a whole supported declaration.

Required directive:

```text
NAME: SymbolName
```

Supported JS/TS-family targets:

- Top-level function declarations.
- Top-level class declarations.
- Top-level variable declarations initialized with a function, arrow function, `memo(...)`, `forwardRef(...)`, or `React.memo(...)`.
- Exported declarations, including named default function declarations.

Supported PHP targets:

- Functions and methods matched by name.

Important:

- `NAME:` is a literal symbol name, not a pattern.
- The payload must be the complete replacement declaration.
- If the existing declaration is exported, include the intended `export` / `export default` form in the payload.
- `replace_symbol` does not target imports, types/interfaces, class methods, object properties, anonymous default exports, arbitrary nested JS/TS declarations, or unsupported file types.
- If zero or multiple supported declarations match, the operation fails safely.

### `MODE: range`

Use for textual, line-based replacement inside an existing file.

Required: exactly one start directive:

```text
START: literal substring
START_BEFORE: literal substring
START_AFTER: literal substring
```

Optional: exactly one end directive:

```text
END: literal substring
END_BEFORE: literal substring
END_AFTER: literal substring
```

Optional disambiguation:

```text
CONTAINS: literal substring that must be inside the candidate range
CONTAINS: another required substring
```

Range matching rules:

- Anchors are literal substrings, not regexes and not instructions.
- Anchor matching is case-sensitive.
- Anchors can match anywhere inside a line; they do not need to match the whole line.
- A direct match is tried first. If none exists, matching retries within each individual line with whitespace removed.
- Whitespace-insensitive retry does not match across line boundaries.
- The start anchor must resolve to exactly one candidate after optional `CONTAINS` filtering.
- If an end directive is present, the selected end is the first matching end anchor after the selected start.
- `CONTAINS` requires `END`, `END_BEFORE`, or `END_AFTER` because it filters bounded candidate ranges.
- `CONTAINS` checks the text from each candidate start match through that candidate's first following end match. All repeated `CONTAINS:` values must be present.
- `SCOPE_START` and `SCOPE_END` are obsolete. Do not use them.

Range replacement is line-based:

| Directive | Replacement boundary |
| --- | --- |
| `START` | starts at the beginning of the anchor line |
| `START_BEFORE` | starts at the beginning of the previous line |
| `START_AFTER` | starts at the beginning of the line after the anchor line |
| `END` | ends after the end-anchor line |
| `END_BEFORE` | ends before the end-anchor line |
| `END_AFTER` | ends after the line following the end-anchor line |

Without an end directive, `range` replaces exactly one selected line: the `START` anchor line, the line before the `START_BEFORE` anchor line, or the line after the `START_AFTER` anchor line.

Do not assume `END: }`, `END: </Tag>`, or similar anchors understand syntax structure. They are plain text anchors, and the first matching end after the selected start wins.

Prefer `replace_symbol` over `range` when replacing a whole supported declaration. Prefer specific anchors over broad anchors. If a broad anchor is unavoidable, use a bounded range plus `CONTAINS`.

## Validation and Failure Behavior

Expect strict fail-safe behavior.

- Parse warnings/errors stop the desktop intake flow.
- Missing files, existing files in `create`, ignored paths, and paths outside the repo fail validation.
- Missing or ambiguous range starts fail validation.
- Missing range ends fail validation.
- Invalid range directive combinations fail before apply.
- `replace_symbol` with zero or multiple matching declarations fails.
- Validation resolves and syntax-checks the full in-memory apply plan before disk writes are allowed.
- Apply re-runs that full preflight and writes transactionally; if a write fails, previously written files are rolled back.
- JS/TS-family candidates (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`) are parsed before write.
- PHP candidates (`.php`, `.phtml`) are linted before write through the PHP adapter.
- Other languages are not syntax-validated by Inscribe.
- Candidate validation checks the whole candidate file, not only the payload.
- Inscribe does not run tests, typecheck, format, install packages, update imports, or execute shell commands.

Design for safe retries: make blocks deterministic and let diagnostics guide the next attempt.

## Easy Misunderstandings to Avoid

- Do not put "replace this function with..." inside the payload. Put the finished replacement code there.
- Do not put comments like `// add validation here` unless that comment should remain in the repository.
- Do not output placeholder paths, ellipses, TODO stubs, or omitted code in payloads unless they are truly intended file content.
- Do not place shell commands inside an Inscribe payload.
- Do not wrap two files or two payload fences in one block.
- Do not output illustrative `$inscribe BEGIN` examples in a response meant to apply real edits.
- Do not assume `START_AFTER` means after the matched substring. It means the next line after the anchor line.
- Do not assume `END_BEFORE` means before the matched substring. It means before the end-anchor line.
- Do not assume `CONTAINS` searches the whole file. It searches each bounded candidate range.
- Do not assume the fence language label controls validation.
- Do not assume unknown directives help. Unknown unprefixed fields are ignored.
- Do not assume `replace_symbol` preserves modifiers automatically. The replacement declaration must include exactly the modifiers/exports you want.
- Do not assume append starts on a new line. Include the leading newline yourself.
- Do not assume a successful parse means the file will validate or apply.

## Shape Examples

These are format examples only. In a real response, output only blocks for the actual intended files and never include this examples section.

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
FILE: src/components/ParticipantSurfacePanel.tsx
MODE: replace_symbol
NAME: ParticipantSurfacePanel

```tsx
export const ParticipantSurfacePanel = () => {
  return <section aria-label="Participants">Ready</section>;
};
```

$inscribe END

### Bounded textual range with disambiguation

$inscribe BEGIN
FILE: src/features.ts
MODE: range
START_AFTER: // feature flags: start
END_BEFORE: // feature flags: end
CONTAINS: enableSignupFlow

```ts
export const enableSignupFlow = true;
export const enableBillingFlow = false;
```

$inscribe END

### Append with intentional leading newline

$inscribe BEGIN
FILE: src/config.ts
MODE: append

```ts

export const enableNewFlow = true;
```

$inscribe END

### Delete

$inscribe BEGIN
FILE: src/deprecated/old-component.tsx
MODE: delete

$inscribe END

## Final Checklist Before Output

- The response contains real edits only, not examples/templates.
- Every intended edit has exactly one block.
- Every block has exactly one `FILE:` and one lowercase `MODE:`.
- Every non-delete block has exactly one payload fence.
- Payloads contain final code/text, not instructions or placeholders.
- No raw marker-only lines appear inside payloads.
- Range blocks have exactly one start directive.
- Range blocks using `CONTAINS` also have exactly one end directive.
- `replace_symbol` blocks include `NAME:` and a complete replacement declaration.
- Append payloads include any needed leading newline.
- Any suggested commands are outside Inscribe blocks.
