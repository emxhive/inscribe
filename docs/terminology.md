# Inscribe Terminology

This document names the active concepts used by Inscribe. For LLM output rules and examples, use [llm-guide.md](llm-guide.md).

## Inscribe Block

An Inscribe block is an explicit file operation delimited by marker lines:

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

Only `$inscribe BEGIN` and `$inscribe END` use the `$inscribe` prefix.

## Headers

Headers are required metadata fields:

- `FILE`: repo-relative target path.
- `MODE`: active operation mode.

Headers must be unprefixed. `$inscribe FILE:` and `$inscribe MODE:` are invalid.

## Directives

Directives are mode-specific metadata fields:

- `START`
- `END`
- `CONTAINS`
- `NAME`

Directives must be unprefixed. Unsupported directive names do not add behavior.

## Active Modes

| mode | meaning |
| --- | --- |
| `create_file` | Create a new file. |
| `replace_file` | Replace an existing file completely. |
| `append_file` | Append content to the end of an existing file. |
| `delete_file` | Delete an existing file. |
| `replace_line` | Replace one line selected by `START`. |
| `replace_range` | Replace whole lines from `START` through `END`. |
| `replace_between` | Replace content between `START` and `END`. |
| `replace_block` | Replace the first brace-delimited block after `START`. |
| `replace_symbol` | Replace a supported whole declaration selected by `NAME`. |

Old aliases such as `create`, `replace`, `append`, `delete`, and `range` are not active modes.

## Content

Content modes require one fenced payload. `delete_file` forbids non-whitespace payload content.

The parser accepts backtick and tilde fences with at least three characters. Non-whitespace text after the closing fence is a parse error.

## Anchors

`START`, `END`, and `CONTAINS` are literal text values. They are not regular expressions.

`replace_line`, `replace_range`, `replace_between`, and `replace_block` fail if required anchors are missing or ambiguous.

## Symbol Target

`replace_symbol` uses structural adapters. Active support is limited to JS/TS-family files and PHP files. Missing, ambiguous, or unsupported symbols fail safely.

## Path Policy

`FILE` must be repo-relative. Absolute paths, traversal outside the repository, ignored paths, out-of-scope paths for non-create operations, and symlink escapes are blocked.

## Apply And Restore

Apply preflights operations, writes files, persists restore history, and rolls back disk writes if history persistence fails.

Restore uses stored history payloads as the source of truth.

