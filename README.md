# Inscribe

Inscribe is a desktop app that turns explicitly tagged LLM output into reviewable repository changes.

It only applies `$inscribe BEGIN` / `$inscribe END` blocks, validates the active contract, preflights changes, writes files, and persists restore history.

## Active Block Format

````
$inscribe BEGIN
FILE: relative/path/from/repo/root.ext
MODE: create_file

```ts
export const example = true;
```

$inscribe END
````

`$inscribe` is valid only on `BEGIN` and `END` marker lines. `FILE`, `MODE`, `START_LINE_CONTAINS`, `START_LINE_EQUALS`, `END_LINE_CONTAINS`, `END_LINE_EQUALS`, `RANGE_CONTAINS`, and `NAME` must not be prefixed.

## Active Modes

The supported mode names are exact:

- `create_file`
- `replace_file`
- `append_file`
- `delete_file`
- `replace_line`
- `replace_range`
- `replace_between`
- `replace_block`
- `replace_symbol`

Old aliases such as `create`, `replace`, `append`, `delete`, and `range` are invalid.

## Directive Summary

- `replace_line` requires one `START_*` selector.
- `replace_range` requires one `START_*` and one `END_*` selector; `RANGE_CONTAINS` is optional.
- `replace_between` requires one `START_*` and one `END_*` selector; `RANGE_CONTAINS` is optional.
- `replace_block` requires one `START_*` selector.
- `replace_symbol` requires `NAME`.

For the full LLM authoring contract, use [docs/llm-guide.md](docs/llm-guide.md).

## Workflow

1. Select a repository.
2. Paste an LLM response containing explicit Inscribe blocks.
3. Review parsed operations and diffs.
4. Apply selected, valid, or all pending changes.
5. Restore applied changes from persisted history when needed.

## Safety Notes

- `FILE` must be repo-relative.
- Absolute paths and `../` traversal are rejected.
- Ignored paths are blocked.
- Non-create operations must be inside configured scope.
- Supported JS/TS and PHP candidates are syntax-validated before write.
- If disk writes succeed but history persistence fails, writes are rolled back.
