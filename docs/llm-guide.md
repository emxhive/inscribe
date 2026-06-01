# Inscribe LLM Guide

## 0. Execution Dependency Map

This guide is a binding execution contract.

Do not proceed from memory.

Examples are illustrative only. The Active Contract and mode rules override examples.

For every Inscribe response, the following sections are always active:

* Section 1: Emission Gate
* Section 2: Active Contract
* Section 3: Mode Decision Table
* Section 4: Output Format Rules
* Section 5: Per-Block Change List Rules
* Section 6: Block Shape Rules
* Section 18: Hard Prohibitions

Mode-specific active rules:

| Mode              | Required rule sections        |
| ----------------- | ----------------------------- |
| `create_file`     | Section 16                    |
| `replace_file`    | Section 16                    |
| `append_file`     | Section 16                    |
| `delete_file`     | Section 16                    |
| `replace_line`    | Sections 7, 11                |
| `replace_range`   | Sections 8, 9, 10, 11, 12, 13 |
| `replace_between` | Sections 8, 9, 10, 11, 12, 13 |
| `replace_symbol`  | Section 14                    |
| `replace_block`   | Section 15                    |

Failure-specific active rules:

| Failure type       | Required rule section |
| ------------------ | --------------------- |
| Ambiguous target   | Section 17            |
| Parse error        | Section 17            |
| Target not found   | Section 17            |
| Invalid directive  | Section 17            |
| Unsupported symbol | Section 17            |

If all active rules cannot be satisfied, do not emit Inscribe blocks.

---

## 1. Emission Gate

An Inscribe block may be emitted only if every gate passes:

* The user requested implementation.
* The request is not discussion, review, planning, or diagnosis only.
* Every mode, header, and directive used appears in Section 2.
* The needed file context is current and visible.
* The chosen mode follows Section 3.
* The selected anchors are safe.
* `START_*` is unique, or repeated starts are intentionally disambiguated with strong range filters.
* `END_*` is understood as first/Nth matching end after each matching start.
* Any widened replacement is local.
* Any widened replacement preserves unrelated content.
* `replace_file` is used only with full current file content.
* Payloads contain repository content only.
* Each block has a valid change list immediately above it.

If any gate fails, do not emit Inscribe blocks.

---

## 2. Active Contract

### Headers

Valid headers:

* `FILE`
* `MODE`

### Modes

Valid modes:

* `create_file`
* `replace_file`
* `append_file`
* `delete_file`
* `replace_line`
* `replace_range`
* `replace_between`
* `replace_block`
* `replace_symbol`

### Directives

Valid directives:

* `START_LINE_CONTAINS`
* `START_LINE_EQUALS`
* `END_LINE_CONTAINS`
* `END_LINE_EQUALS`
* `END_OCCURRENCE`
* `RANGE_CONTAINS`
* `RANGE_LINE_CONTAINS_ALL`
* `NAME`

Only these items are valid.

Unlisted modes, headers, and directives are forbidden.

Aliases, shorthand names, alternate spellings, and invented directives are forbidden.

---

## 3. Mode Decision Table

Choose the safest mode that expresses the requested change.

| Situation                                                | Mode              |
| -------------------------------------------------------- | ----------------- |
| Create a new file                                        | `create_file`     |
| Delete a file                                            | `delete_file`     |
| Append content only to file end                          | `append_file`     |
| Replace a complete supported declaration                 | `replace_symbol`  |
| Replace exactly one unique line                          | `replace_line`    |
| Replace whole lines including boundaries                 | `replace_range`   |
| Replace only content between preserved boundaries        | `replace_between` |
| Replace first brace-delimited block after a unique start | `replace_block`   |
| Replace entire file when no safe partial target exists   | `replace_file`    |

Binding mode rules:

* Use `replace_symbol` for a complete supported declaration.
* Use `replace_line` for one unique target line.
* Use `replace_range` when payload includes selected boundary lines.
* Use `replace_between` only when payload excludes selected boundary lines.
* Use `replace_file` only as final fallback with full current file content.
* Do not choose a wider mode when a narrower safe mode exists.

---

## 4. Output Format Rules

Using Inscribe does not change the normal assistant response outside blocks.

Outside Inscribe blocks, explanations, warnings, assumptions, and testing notes are allowed.

Inside Inscribe blocks, only valid Inscribe syntax and repository payload content are allowed.

Explanations inside payloads are forbidden unless the explanation is actual intended file content.

Each operation must be one block.

Each block must be preceded by one short change list.

---

## 5. Per-Block Change List Rules

Every Inscribe block must be preceded by a short bullet list.

Hard limits:

* Maximum 3 bullets.
* Maximum 18 words per bullet.
* No paragraphs.
* No labels such as `Target`, `Scope`, `Preserved`, or `Reason`.
* No vague summary bullets.
* No commentary.

Each bullet must describe one concrete addition, removal, replacement, or behavior change.

When removing code, name what is removed.

When replacing behavior, state old behavior and new behavior.

Valid example:

* Adds `END_OCCURRENCE` parsing.
* Rejects invalid occurrence values during validation.
* Replaces all-start/end pairing with first/Nth end per start.

The change list must describe the block immediately below it.

---

## 6. Block Shape Rules

A valid Inscribe block has this line order:

1. `$inscribe BEGIN`
2. `FILE: repo-relative/path.ext`
3. `MODE: valid_mode`
4. optional directive lines
5. optional blank line
6. one fenced payload, only when the mode requires payload
7. `$inscribe END`

Only `BEGIN` and `END` use the `$inscribe` prefix.

Headers and directives are plain unprefixed lines.

Headers and directives must use this exact key-value shape:

`KEY: VALUE`

Rules:

* exactly one colon after the key
* exactly one space after the colon
* value begins immediately after that space
* no missing space after the colon
* no extra spaces before the colon
* no prefixed keys

Payload modes must contain exactly one fenced payload.

`delete_file` must not contain a payload fence.

Fence language is only for readability.

File validation is determined by `FILE`, not by fence language.

---

## 7. `replace_line`

Use `replace_line` when replacing exactly one line.

Rules:

* Requires one `START_*` selector.
* `START_*` must resolve to exactly one line.
* Replaces the whole matched line.
* `END_*` is forbidden.
* `RANGE_CONTAINS` is forbidden.
* `RANGE_LINE_CONTAINS_ALL` is forbidden.
* `END_OCCURRENCE` is forbidden.

Use `replace_line` when the exact target line is unique.

If the exact target line is repeated, `replace_line` is forbidden.

---

## 8. Range and Between Operations

This section applies to `replace_range` and `replace_between`.

Range candidate model:

1. Find all matching `START_*` lines.
2. For each matching start, find matching `END_*` lines after that start.
3. Select the first/Nth end after each start using `END_OCCURRENCE`.
4. Each start creates at most one candidate.
5. Apply all `RANGE_CONTAINS` and `RANGE_LINE_CONTAINS_ALL` filters.
6. Succeed only if exactly one candidate remains.

Binding rules:

* `START_*` should be unique when possible.
* Repeated starts are allowed only as intentional candidate regions.
* `END_*` does not need global uniqueness.
* `END_*` is literal, not structural.
* `END_*` does not understand braces, callbacks, JSX, tests, or nesting.
* `END_*` means first/Nth matching end line after each matching start.

### `replace_range`

Use `replace_range` when replacing whole lines including selected boundary lines.

Payload must include the full replacement range.

Payload must include the selected start and end boundary lines.

### `replace_between`

Use `replace_between` when preserving selected boundary lines.

`replace_between` preserves both anchor lines.

Payload must contain only the interior replacement.

Payload must not include the selected start boundary line.

Payload must not include the selected end boundary line.

If payload includes either boundary line, use `replace_range`.

---

## 9. `END_OCCURRENCE`

`END_OCCURRENCE` selects which matching end to use after each matching start.

Rules:

* Optional.
* One-based.
* Defaults to `1`.
* Must be a positive integer.
* `END_OCCURRENCE: 1` means first matching end after each start.
* `END_OCCURRENCE: 2` means second matching end after each start.

Invalid values:

* `0`
* negative numbers
* decimals
* words
* empty values

Use `END_OCCURRENCE` only when the first matching end is not the intended boundary.

The occurrence count must be verified from current context.

`RANGE_CONTAINS` must not be used as a substitute for `END_OCCURRENCE`.

---

## 10. Range Filters

### `RANGE_CONTAINS`

`RANGE_CONTAINS` filters candidate ranges after start/end selection.

Multiple `RANGE_CONTAINS` values are AND conditions.

A candidate must contain every listed value as an exact substring anywhere in the candidate.

Use `RANGE_CONTAINS` to select among repeated candidate regions.

Valid `RANGE_CONTAINS` values must be:

* real text inside the intended candidate
* specific
* intention-bearing
* unlikely to appear in sibling candidates

Generic filter text is forbidden.

`RANGE_CONTAINS` does not choose another end occurrence.

If selected end occurrence is wrong, set `END_OCCURRENCE`.

### `RANGE_LINE_CONTAINS_ALL`

`RANGE_LINE_CONTAINS_ALL` is valid only for `replace_range` and `replace_between`.

Its value is a comma-separated list of tokens or fragments.

Each fragment is trimmed.

Empty lists and empty fragments are invalid.

A candidate must contain at least one line that contains every listed fragment.

Fragments on different lines do not satisfy one directive.

Multiple `RANGE_LINE_CONTAINS_ALL` directives are AND conditions.

---

## 11. Anchor Discipline

`START_*` anchors must be unique unless repeated starts are intentional candidate regions.

A non-unique `START_*` is allowed only when all conditions are true:

* repeated starts intentionally represent candidate regions
* each candidate has a predictable selected end
* range filters reduce candidates to exactly one
* current context includes the possible candidate regions

Generic `START_*` anchors are forbidden unless intentionally disambiguated.

Generic `END_*` anchors are forbidden unless the first/Nth occurrence is verified.

In nested code, test files, JSX, callback-heavy TypeScript, and repeated fixtures, generic anchors are unsafe by default.

`END_*` does not mean “the closing boundary of the thing intended.”

It means literal first/Nth matching end after each matching start.

---

## 12. Local Widening Strategy

Narrowness is not safety.

A narrow edit with weak anchors is unsafe.

A wider local edit with strong anchors is safer.

When the exact target is not safely selectable:

1. Use `replace_line` if the exact target line is unique.
2. If the target line is not unique, widen to the nearest local candidate region.
3. Use meaningful range filters to select the intended candidate.
4. Preserve unrelated lines inside the widened region.
5. Use file boundaries only for real edge-of-file regions.
6. Use `replace_file` only when no safe partial operation exists.

Widen only as far as needed.

The target is the nearest safe local boundary, not the largest convenient boundary.

### File boundaries

File boundaries are allowed only when the target naturally touches the start or end of the file.

Allowed patterns:

* file start to real local boundary
* real local boundary to file end
* edge-of-file region with no nearer real boundary

If both boundaries are file boundaries, use `replace_file`.

Using file boundaries to avoid finding local anchors is forbidden.

---

## 13. Range Examples

Examples do not override rules.

Line numbers in examples are illustrative only.

Real Inscribe payloads must never include example line numbers unless those numbers are actual file content.

### Example A: Use `replace_line` when target line is unique

Current region:

`01  A`

`02  B`

`03  C`

Requested change:

Change `C` to `Z`.

Correct mode:

`replace_line`

Reason:

`C` appears once.

Do not widen when the exact target line is safely selectable.

### Example B: Widen only when `replace_line` is unsafe

Current region:

`01  P`

`02    A`

`03    B`

`04    C`

`05    B`

`06    A`

`07  Q`

`08  P`

`09    A`

`10    B`

`11    C`

`12    M`

`13    A`

`14  Q`

Requested change:

Change the `C` inside the region containing `M` to `Z`.

`replace_line` is forbidden here:

`START_LINE_EQUALS: C`

Reason:

`C` appears twice:

* line `04`
* line `11`

Correct strategy:

Use local candidate boundaries:

`START_LINE_EQUALS: P`

`END_LINE_EQUALS: Q`

Because `END_OCCURRENCE` is omitted, each `P` pairs with the first `Q` after it.

Candidate ranges:

* Candidate 1: lines `01–07`
* Candidate 2: lines `08–14`

Use:

`RANGE_CONTAINS: M`

Only Candidate 2 remains.

Replacement for Candidate 2:

`P`

`  A`

`  B`

`  Z`

`  M`

`  A`

`Q`

This is correct because the edit widened to the nearest local selectable region.

### Example C: Generic end anchor trap

Current test:

`01  it('works', () => {`

`02    expect(run()).toEqual({`

`03      ok: true,`

`04    });`

`05  });`

Requested change:

Replace the whole test body.

This end selector selects line `04` by default:

`END_LINE_CONTAINS: });`

It does not select line `05`.

If line `05` is intended, use one valid strategy:

* set `END_OCCURRENCE: 2` after verifying the count
* use a stronger boundary such as the next test declaration
* replace a larger local `describe` block
* use `replace_file` only with full current file content

---

## 14. `replace_symbol`

Use `replace_symbol` for complete supported declarations.

Supported targets include:

* top-level functions
* top-level classes
* top-level arrow-function helpers
* top-level React components assigned to variables
* supported exported declarations
* supported PHP functions, classes, interfaces, traits, enums, and methods
* supported Dart functions, classes, mixins, enums, named extensions, typedefs, methods, constructors, and single-variable declarations

Unsupported targets require another mode.

Unsupported targets include:

* imports
* unsupported interfaces or type aliases for the target language
* object methods
* PHP class properties and constants
* multi-variable PHP or Dart declarations
* nested declarations
* JSX subtrees
* arbitrary blocks inside functions

Language-specific rules:

* PHP namespace-qualified names and `ClassName::method` forms are allowed when short names are ambiguous.
* Dart constructors must be named as `ClassName.new` or `ClassName.named`.
* Helper-backed PHP and Dart support requires local helper dependencies documented in the repository README.

Use `replace_symbol` over textual ranges when replacing a complete supported declaration.

---

## 15. `replace_block`

Use `replace_block` when replacing the first brace-delimited block after a selected start line.

Rules:

* Requires exactly one `START_*`.
* Replacement includes braces and everything inside them.
* Replacement does not include the declaration header before the opening brace.
* Payload must begin with `{`.
* Payload must end with `}`.

`replace_block` is forbidden when `START_*` is non-unique.

Use `replace_symbol` instead when replacing a full supported declaration.

---

## 16. File-Level Modes

### `create_file`

Rules:

* File must not already exist.
* Payload is required.
* Existing files must not be overwritten with `create_file`.

### `replace_file`

Rules:

* File must exist.
* Payload is required.
* Full current file content must be available.
* Payload must preserve the current full file except intended changes.
* Reconstruction from memory is forbidden.

Use only when no safe partial operation exists.

### `append_file`

Rules:

* File must exist.
* Payload is required.
* Content is added only at the end of the file.
* Middle insertion with `append_file` is forbidden.

### `delete_file`

Rules:

* File must exist.
* Payload fence is forbidden.
* Payload content is forbidden.

Valid shape:

$inscribe BEGIN
FILE: path/to/file.ext
MODE: delete_file
$inscribe END

---

## 17. Failure and Retry Protocol

Fix the actual failure cause.

Do not blindly tweak anchors.

### Ambiguous range

Check:

* repeated `START_*`
* missing `RANGE_CONTAINS`
* weak `RANGE_CONTAINS`
* missing or weak `RANGE_LINE_CONTAINS_ALL`
* generic `END_*`
* missing `END_OCCURRENCE`
* unsafe scope

### Parse error

The candidate file became syntactically invalid.

Check:

* `replace_between` preserved anchors unexpectedly
* payload included preserved boundary lines
* generic `END_*` selected an inner close
* replacement unbalanced braces, JSX, parentheses, or callbacks

### Target not found

Assume stale context or wrong anchor text.

Use current context before retrying.

### Invalid directive

Use only Section 2.

### Invalid `END_OCCURRENCE`

Use a positive integer.

### Unsupported symbol

Use another valid mode.

---

## 18. Hard Prohibitions

The following are forbidden:

* unlisted modes
* unlisted headers
* unlisted directives
* prefixed headers
* prefixed directives
* blocks during discussion-only requests
* blocks without a valid change list
* prose inside payload
* multiple payload fences in one block
* non-unique `START_*` without intentional disambiguation
* generic `END_*` without verified first/Nth occurrence
* `replace_line` with a repeated target line
* `replace_between` payloads containing preserved boundary lines
* destructive edits from stale context
* destructive edits from partial context
* `replace_file` from memory
* editing generated/vendor/build files unless explicitly requested

---

## 19. Guide Maintenance Rule

This guide intentionally contains real Inscribe block examples.

Full-guide replacement should be done manually by copy-paste, not through Inscribe.

Using Inscribe to replace this guide can cause embedded example blocks to interfere with parsing.

---

## 20. Final Rule

Use the safest operation, not the smallest-looking operation.

First use direct safe targeting.

If direct targeting is unsafe, widen to the nearest safe local region.

If local targeting is unsafe, use `replace_file` only with full current file content.

Every block must have a short list of actual changes immediately above it.

Explanations belong outside blocks.

Payloads contain repository content only.
