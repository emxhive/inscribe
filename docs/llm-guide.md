# Inscribe V2 LLM Authoring Guide

This guide is a binding contract for generating Inscribe V2 blocks. Every rule inside this guide is active and non-negotiable.

## 1. Non-negotiable mental model

The engine is precise, not smart.

The LLM is responsible for producing the complete final text for every payload. The engine is responsible only for locating the target and applying that payload.

- Inscribe V2 is not a code generator.
- Inscribe V2 does not infer missing code.
- Inscribe V2 does not complete payloads.
- Inscribe V2 does not synthesize imports, formatting, wrappers, or omitted logic.
- Inscribe V2 applies exact text payloads to exact files.
- Every CONTENT payload must be full and precise for the target being written.
- If code is omitted from a replacement payload, it is deleted.
- Placeholders are literal text unless the user explicitly wants placeholders in the final file.

- CONTENT is not a patch.
- CONTENT is not pseudo-code.
- CONTENT is not “the important part.”
- CONTENT is the exact replacement text.

## 2. When to use Inscribe V2

Use Inscribe V2 only when you have current source truth and can produce complete, exact edits.

Allowed cases:
- Create a new file with complete content.
- Replace an entire file with complete content.
- Delete a file intentionally.
- Replace exact text using SEARCH + CONTENT.
- Replace a TypeScript or TSX structural node using SELECTOR + CONTENT.

## 3. When not to use Inscribe V2

Do not emit Inscribe V2 blocks in any of these situations:
- The source file content is unknown.
- The target text or selector cannot be uniquely identified.
- The replacement payload would require guessing omitted code.
- You have only a vague description of the target code or repository state.
- You want the engine to “figure out” where or how to apply a change.
- The user requested analysis, planning, or explanation only.
- You cannot write the full final payload.

If you cannot produce exact payloads, do not emit Inscribe blocks. Ask for source truth or provide a plan instead.

## 4. V2 block grammar

Every Inscribe V2 block must match this grammar exactly. Code or structured payloads inside payload sections should be wrapped in Markdown code fences as the preferred default style for clean chat formatting:

```
<<<INSCRIBE
FILE: relative/path/from/repo/root
MODE: operation_mode

<<<CONTENT
```language
exact payload here
```
CONTENT>>>
INSCRIBE>>>
```

Rules:
- Opening marker must be exactly `<<<INSCRIBE` on its own line.
- Closing marker must be exactly `INSCRIBE>>>` on its own line.
- Section openers must be exact:
  - `<<<CONTENT`
  - `<<<SEARCH`
  - `<<<STARTS_WITH`
- Section closers must be exact:
  - `CONTENT>>>`
  - `SEARCH>>>`
  - `STARTS_WITH>>>`
- Directives are `FILE`, `MODE`, and optionally `SELECTOR`.
- Do not wrap the outer `<<<INSCRIBE ... INSCRIBE>>>` block in Markdown fences.
- Do not indent outer Inscribe markers.
- **Preferred Section Wrappers:** Payload sections containing code or structured data should be wrapped in Markdown code fences (backticks or tildes of length >= 3, with 0-3 leading spaces). The parser automatically strips these wrapper fences, so they are not written to disk or treated as literal payload.

## 5. Operation modes

Inscribe V2 supports only these five operation modes. Unlisted modes are forbidden.

### create_file
Requires:
- `FILE`
- `MODE: create_file`
- `CONTENT`
`CONTENT` must be the complete file content.
Forbidden:
- `SEARCH`
- `SELECTOR`
- `STARTS_WITH`

### replace_file
Requires:
- `FILE`
- `MODE: replace_file`
- `CONTENT`
`CONTENT` must be the complete new file content.
Forbidden:
- `SEARCH`
- `SELECTOR`
- `STARTS_WITH`

### delete_file
Requires:
- `FILE`
- `MODE: delete_file`
Forbidden:
- `CONTENT`
- `SEARCH`
- `SELECTOR`
- `STARTS_WITH`

### replace_text
Requires:
- `FILE`
- `MODE: replace_text`
- `SEARCH`
- `CONTENT`
`SEARCH` must exactly match existing text in the current virtual file state.
`CONTENT` must be the exact replacement text.
Forbidden:
- `SELECTOR`
- `STARTS_WITH`

### replace_node
Requires:
- `FILE`
- `MODE: replace_node`
- `SELECTOR`
- `CONTENT`
`CONTENT` must be the complete replacement text for the selected structural node.
Optional:
- `STARTS_WITH`
Forbidden:
- `SEARCH`

## 6. Payload rules

- `CONTENT` must be exact final text.
- Never write “rest of file unchanged.”
- Never write “existing code here.”
- Never write “...”
- Never omit imports, braces, function bodies, class members, or JSX children unless deletion is intended.
- Never rely on the engine to preserve omitted parts inside a replaced node or replaced file.

### Preferred: section wrapper fences

To ensure Inscribe blocks are rendered with correct syntax highlighting in chat interfaces, all code or structured payloads inside the sections (`CONTENT`, `SEARCH`, `STARTS_WITH`) should be wrapped in Markdown code fences (backticks or tildes of length >= 3) with 0-3 leading spaces as the default authoring style.

Example:
```
<<<CONTENT
```ts
export const value = 1;
\`\`\`
CONTENT>>>
```

The parser automatically strips only the wrapper fence lines (and their optional language tags) along with any optional surrounding blank lines, leaving `export const value = 1;` as the actual payload written to the file (which means these wrapper fences are not written to disk). Any malformed wrappers (e.g. missing closer or trailing text) will raise a `MALFORMED_WRAPPER_FENCE` validation error.

Payload requirements by mode:
- `create_file`: `CONTENT` = entire new file
- `replace_file`: `CONTENT` = entire new file version
- `replace_text`: `CONTENT` = exact replacement for `SEARCH`
- `replace_node`: `CONTENT` = entire replacement node, including its signature, wrapper, braces, and JSX.

For `replace_node`:
- If replacing a function, `CONTENT` must include the full function declaration/expression.
- If replacing an `if_statement`, `CONTENT` must include the full if statement.
- If replacing a class, `CONTENT` must include the full class.

## 7. File path rules

- `FILE` must be a repository-relative path.
- Use forward slashes.
- Do not use absolute paths.
- Do not use drive-letter paths.
- Do not use backslashes.
- Do not use `./` or `../` segments.
- Do not use repeated slashes.
- Do not use trailing slashes.
- Do not use control characters.

Valid:
- `src/app.ts`
- `apps/desktop/src/preload.ts`
- `packages/engine/src/v2/index.ts`

Invalid:
- `C:/repo/src/app.ts`
- `/src/app.ts`
- `../src/app.ts`
- `./src/app.ts`
- `src\app.ts`
- `src//app.ts`
- `src/app.ts/`

## 8. replace_text rules

- `replace_text` is for exact textual replacement, not fuzzy search.
- `SEARCH` must be copied from the current source truth exactly.
- `SEARCH` should be as small as safely unique, but large enough to avoid ambiguity.
- `CONTENT` replaces the whole `SEARCH` block.

Forbidden:
- Approximate search text.
- Invented search text.
- Using `SEARCH` as a regex.
- Using `SEARCH` as a description of what to find.
- Using `CONTENT` as a diff hunk (e.g. including `+` or `-` prefixes).

Example:
<<<INSCRIBE
FILE: src/example.ts
MODE: replace_text

<<<SEARCH
```ts
const value = 1;
\`\`\`
SEARCH>>>

<<<CONTENT
```ts
const value = 2;
\`\`\`
CONTENT>>>
INSCRIBE>>>

## 9. replace_node rules

- `replace_node` uses Tree-sitter to locate a syntax node boundary.
- Tree-sitter only locates the node; it does not generate the replacement, validate business logic, or complete incomplete code.
- Supported languages: `.ts`, `.tsx`. No `.js` or `.jsx` support is claimed.
- `replace_node` is safest when replacing a whole named function, class, method, or a specific `if_statement` qualified by `STARTS_WITH`.

Example:
<<<INSCRIBE
FILE: src/example.ts
MODE: replace_node
SELECTOR: function:buildValue

<<<CONTENT
```ts
export function buildValue() {
  return 2;
}
\`\`\`
CONTENT>>>
INSCRIBE>>>

## 10. SELECTOR rules

Example selectors:
- `function:buildValue`
- `class:UserService`
- `class:UserService > method:save`
- `function:resolvePlan > if_statement`

Rules:
- Named selectors must use the exact symbol name from source.
- Do not invent function, class, or method names.
- `if_statement` selectors usually need `STARTS_WITH` to disambiguate.
- The selector must resolve to exactly one node.
- If selector uniqueness is uncertain, do not emit the block.

Supported selector kinds:
- `class`
- `method`
- `function`
- `if_statement`

## 11. STARTS_WITH rules

- `STARTS_WITH` is a qualifier for `replace_node` to disambiguate repeating structural targets.
- It is not a replacement payload.
- It narrows matching nodes by requiring the target node text to start with the exact `STARTS_WITH` text.

Rules:
- Use `STARTS_WITH` for repeated `if_statement` targets.
- `STARTS_WITH` must be copied from source truth.
- `STARTS_WITH` must not be blank.
- `STARTS_WITH` must not be a summary.
- `STARTS_WITH` must match the start of the node.

Example:
<<<INSCRIBE
FILE: src/example.ts
MODE: replace_node
SELECTOR: function:buildValue > if_statement

<<<STARTS_WITH
```ts
if (!value) {
  throw new Error('Missing value');
}
\`\`\`
STARTS_WITH>>>

<<<CONTENT
```ts
if (!value) {
  throw new Error('Value required');
}
\`\`\`
CONTENT>>>
INSCRIBE>>>

## 12. Multi-block sequencing rules

- Blocks execute in order.
- Later blocks see the virtual file state produced by earlier blocks.
- `SEARCH` and `SELECTOR` resolution happen against the current virtual state, not always the original disk file.
- Examples of allowed sequences:
  - `create_file` -> `replace_text` on the same file.
  - `replace_text` -> `replace_node` on the same file.
  - `replace_node` -> `replace_text` on the same file.
- If a previous block changes a target, later `SEARCH`/`SELECTOR` anchors must be written against the changed virtual content.

## 13. Preview and apply model

- Preview parses blocks, resolves targets, builds exact candidate content, and shows diffs.
- Apply writes the frozen preview result only if the live workspace has not drifted.
- The apply engine does not re-interpret the user’s natural language.
- A successful preview is not permission to change payload meaning later. If source changes after preview, re-preview.

## 14. Error-prevention checklist

Verify each item before emitting any V2 block:
- I have current source truth.
- I know the exact target file path.
- I know the exact operation mode.
- I can write the complete final `CONTENT` payload.
- I am not using placeholders unless literal placeholders are desired.
- For `replace_text`, `SEARCH` is exact and uniquely identifies the intended text.
- For `replace_node`, `SELECTOR` is supported and uniquely identifies the intended node.
- For repeated structural nodes, `STARTS_WITH` is exact and non-blank.
- I did not mix V1 and V2 syntax.
- I did not wrap the Inscribe block in Markdown fences.

## 15. Examples

### create_file
<<<INSCRIBE
FILE: src/math.ts
MODE: create_file

<<<CONTENT
```ts
export function add(a: number, b: number): number {
  return a + b;
}
\`\`\`
CONTENT>>>
INSCRIBE>>>

### replace_file
<<<INSCRIBE
FILE: src/math.ts
MODE: replace_file

<<<CONTENT
```ts
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}
\`\`\`
CONTENT>>>
INSCRIBE>>>

### delete_file
<<<INSCRIBE
FILE: src/stale.ts
MODE: delete_file
INSCRIBE>>>

### replace_text
<<<INSCRIBE
FILE: src/math.ts
MODE: replace_text

<<<SEARCH
```ts
export function add(a: number, b: number): number {
  return a + b;
}
\`\`\`
SEARCH>>>

<<<CONTENT
```ts
export function add(a: number, b: number): number {
  console.log('Adding', a, b);
  return a + b;
}
\`\`\`
CONTENT>>>
INSCRIBE>>>

### replace_node named function
<<<INSCRIBE
FILE: src/math.ts
MODE: replace_node
SELECTOR: function:subtract

<<<CONTENT
```ts
export function subtract(a: number, b: number): number {
  console.log('Subtracting', a, b);
  return a - b;
}
\`\`\`
CONTENT>>>
INSCRIBE>>>

### replace_node class method
<<<INSCRIBE
FILE: src/calculator.ts
MODE: replace_node
SELECTOR: class:Calculator > method:multiply

<<<CONTENT
```ts
  multiply(a: number, b: number): number {
    return a * b;
  }
\`\`\`
CONTENT>>>
INSCRIBE>>>

### replace_node repeated if_statement with STARTS_WITH
<<<INSCRIBE
FILE: src/auth.ts
MODE: replace_node
SELECTOR: function:login > if_statement

<<<STARTS_WITH
```ts
if (!username) {
  throw new Error('Username empty');
}
\`\`\`
STARTS_WITH>>>

<<<CONTENT
```ts
if (!username) {
  throw new Error('Username must not be empty');
}
\`\`\`
CONTENT>>>
INSCRIBE>>>

### TSX function component replacement
<<<INSCRIBE
FILE: src/components/Button.tsx
MODE: replace_node
SELECTOR: function:Button

<<<CONTENT
```tsx
export function Button({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={onClick}>
      {label}
    </button>
  );
}
\`\`\`
CONTENT>>>
INSCRIBE>>>

### multi-block sequence
<<<INSCRIBE
FILE: src/temp.ts
MODE: create_file

<<<CONTENT
```ts
export const version = '1.0.0';
\`\`\`
CONTENT>>>
INSCRIBE>>>

<<<INSCRIBE
FILE: src/temp.ts
MODE: replace_text

<<<SEARCH
```ts
export const version = '1.0.0';
\`\`\`
SEARCH>>>

<<<CONTENT
```ts
export const version = '2.0.0';
\`\`\`
CONTENT>>>
INSCRIBE>>>

## 16. Forbidden patterns

### Forbidden: Omitting code / placeholder comments in payload
```
<<<CONTENT
// keep existing imports
...
CONTENT>>>
```
*Why:* The engine does not parse placeholders. The literal characters `// keep existing imports` and `...` will replace the code, corrupting the file or deleting imports.

### Forbidden: Placeholder code in node replacements
```
<<<CONTENT
function buildValue() {
  // existing logic
}
CONTENT>>>
```
*Why:* The engine will replace the entire target function with this exact body, deleting the actual existing logic.

### Forbidden: Invented selectors
```
SELECTOR: function:theFunctionThatHandlesIt
```
*Why:* Selectors are exact. There must be a function named `theFunctionThatHandlesIt` in the source code; the engine cannot look up files by conceptual descriptions.

### Forbidden: Prose in SEARCH
```
<<<SEARCH
the old code around here
SEARCH>>>
```
*Why:* SEARCH must be copy-pasted byte-for-byte from current code, or the engine will fail to locate the block.

### Forbidden: Action instructions instead of code
```
<<<CONTENT
Apply the fix from above
CONTENT>>>
```
*Why:* The engine will literally write the string "Apply the fix from above" into the codebase.

### Forbidden: Wrapping Inscribe blocks in markdown code blocks
````
```
<<<INSCRIBE
FILE: src/app.ts
MODE: delete_file
INSCRIBE>>>
```
````
*Why:* Markdown fences must never wrap the outer `<<<INSCRIBE` block. Fences cause the parser to fail.

## 17. Final response checklist

Before returning Inscribe V2 output:
1. Emit only valid V2 blocks and short necessary explanation.
2. Do not include V1 syntax.
3. Do not wrap the outer Inscribe block in Markdown fences. Prefer inner section fence wrappers for code payloads.
4. Ensure every CONTENT payload is complete and exact.
5. Ensure every SEARCH / STARTS_WITH payload is copied from source truth.
6. Ensure paths are repository-relative.
7. Ensure no omitted code is accidentally deleted.
