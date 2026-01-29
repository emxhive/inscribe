# Inscribe Terminology

This document provides detailed definitions and explanations of key terms and concepts used in Inscribe.

## Core Concepts

### Inscribe Block
A specially marked section in pasted content that contains explicit instructions for file operations. Each block is delimited by `@inscribe BEGIN` and `@inscribe END` markers.

**Structure:**

 @inscribe BEGIN<br>
 FILE: <path><br>
 MODE: <mode><br>
[additional directives]

```<language>
<code content>
```

@inscribe END


### Block Headers
Required fields that specify the target file and operation mode. Headers are always required and must be specified **without** the `@inscribe` prefix.

#### Required Headers

- **FILE:** Specifies the relative path from repository root where the file will be created or modified
  - Format: `FILE: relative/path/from/repo/root.ext`
  - Path must be under repository root and not in an ignored directory
  - **Must not use `@inscribe` prefix**

- **MODE:** Specifies the operation type
  - Format: `MODE: <create|replace|append|range|delete>`
  - Must be exactly one of the five supported modes
  - **Must not use `@inscribe` prefix**

### Directives
Optional commands within an Inscribe block that provide additional instructions for processing the code content. Directives must be specified **without** the `@inscribe` prefix.

**Important:** 
- Each directive value must be single-line only. The parser processes directives line-by-line, so multiline directive values are not supported.
- Directives do **not** use the `@inscribe` prefix. Only `BEGIN` and `END` markers use the prefix.
- The `FILE:` and `MODE:` fields are headers, not directives.

- **START / START_BEFORE / START_AFTER:** (exactly one required for range mode) The anchor that selects the starting line for range edits
  - Format: `START: <exact substring>` / `START_BEFORE: <exact substring>` / `START_AFTER: <exact substring>`
  - **Must not use `@inscribe` prefix**
  - Anchors are **literal substring matches** (not regex, not whole-line matches)
  - Can match anywhere within a line (beginning, middle, or end)
  - **Replacements always expand to full line boundaries** (no inline splicing)
  - If no exact match is found, Inscribe retries once with a **whitespace-insensitive** match that strips all whitespace within each line from both the file and the anchor.
  - START anchor must match exactly once in the target file
  - If no END directive is provided, START selects the **single line** to replace (the inserted code can be multi-line)
  - **START** begins replacement at the start of the line containing the anchor (the anchor line is replaced)
  - **START_BEFORE** begins replacement at the start of the line before the anchor (previous line + anchor line + rest)
  - **START_AFTER** begins replacement at the start of the line after the anchor
  
- **END / END_BEFORE / END_AFTER:** (optional for range mode) The ending anchor for line-based replacement
  - Format: `END: <exact substring>` / `END_BEFORE: <exact substring>` / `END_AFTER: <exact substring>`
  - **Must not use `@inscribe` prefix**
  - Anchors are **literal substring matches** (not regex, not whole-line matches)
  - Can match anywhere within a line (beginning, middle, or end)
  - **Replacements always expand to full line boundaries** (no inline splicing)
  - If no exact match is found, Inscribe retries once with a **whitespace-insensitive** match that strips all whitespace within each line from both the file and the anchor.
  - END anchor can appear multiple times; Inscribe uses the **first END after START**
  - **END** ends replacement at the end of the line containing the anchor (the anchor line is replaced)
  - **END_BEFORE** ends replacement at the start of the line containing the anchor (anchor line is excluded)
  - **END_AFTER** ends replacement at the end of the line after the anchor

### Prefix Usage Rules

The `@inscribe` prefix is **only** used for block boundaries:
- ✅ `@inscribe BEGIN` - correct
- ✅ `@inscribe END` - correct
- ❌ `@inscribe FILE: path/to/file.js` - **INVALID** (use `FILE: path/to/file.js`)
- ❌ `@inscribe MODE: create` - **INVALID** (use `MODE: create`)
- ❌ `@inscribe START: anchor` - **INVALID** (use `START: anchor`)

**All headers and directives must be written without the `@inscribe` prefix.** Lines with `@inscribe` prefix that are not `BEGIN` or `END` will be rejected as invalid.

## Modes

### create
Creates a new file with the provided content.

**Requirements:**
- File MUST NOT exist
- Path must be under repository root
- Parent directory will be created if needed

**Failure conditions:**
- File already exists
- Path is in an ignored directory (e.g., `.git/`, `node_modules/`, etc.)
- Path escapes the repository root

### replace
Replaces the entire content of an existing file.

**Requirements:**
- File MUST exist
- Path must be under repository root and not ignored

**Failure conditions:**
- File does not exist
- Path is in an ignored directory
- Path escapes the repository root

### append
Appends content to the end of an existing file.

**Requirements:**
- File MUST exist
- Path must be under repository root and not ignored

**Failure conditions:**
- File does not exist
- Path is in an ignored directory
- Path escapes the repository root

**Important:** Inscribe does **not** automatically insert a newline when appending. If you need a newline before your appended content, include it explicitly (e.g., start your fenced code content with a blank line).

**Example with leading newline:**

````
@inscribe BEGIN
FILE: src/config.js
MODE: append

```javascript

// New configuration section
export const newFeature = true;
```

@inscribe END
````

### range
Replaces content between two anchor points in an existing file. Anchors match substrings, but replacements always operate on full lines. Anchor inclusion depends on whether you use START/END (inclusive) or START_AFTER/END_BEFORE (exclusive). If END is omitted, Inscribe replaces **exactly one line** (selected by the START directive semantics) and inserts the block content, which may span multiple lines.

**Brace-aware END:** If `END` is set to a single closing brace (`}`), Inscribe automatically resolves the structural matching brace for the block that contains the START anchor, then applies the usual START/END inclusion rules. This lets you target brace-delimited blocks without adding explicit end markers.

**Brace-aware limitations:**
- The scan is language-agnostic and only skips obvious strings (`'`, `"`, `` ` ``) and comments (`//`, `/* */`), so complex grammars or nested templating may confuse it.
- Brace-aware matching only applies to `END: }` (not `END_BEFORE` or `END_AFTER`).

**Requirements:**
- File MUST exist
- If END is omitted, Inscribe replaces **exactly one line** (selected by the START directive semantics) and inserts the block content, which may span multiple lines
- Exactly one START directive is required (START / START_BEFORE / START_AFTER) and it must match exactly once
- END is optional; if provided, exactly one END directive is required (END / END_BEFORE / END_AFTER); it can match multiple times
- If END is provided, the selected END must be the first occurrence after START
- Path must be under repository root and not ignored

### delete
Deletes an existing file from the repository.

**Requirements:**
- File MUST exist
- Path must be under repository root and not ignored
- No fenced code block is required (content is ignored if provided)

**Behavior:**
- Removes the specified file from disk
- Cleans up empty parent directories (up to repository root)
- Creates a backup before deletion (supports undo)

**Failure conditions:**
- File does not exist
- Path is in an ignored directory
- Path escapes the repository root

**Example:**

````
@inscribe BEGIN
FILE: src/deprecated/old-component.js
MODE: delete

@inscribe END
````

## When to Use Each Mode

Choosing the right mode depends on your specific use case:

| Mode | Best For | Example Use Cases |
|------|----------|-------------------|
| **create** | Adding entirely new files | Creating a new component, adding a new test file, scaffolding configuration files |
| **replace** | Completely rewriting existing files | Major refactoring, regenerating auto-generated files, replacing obsolete implementations |
| **append** | Adding content to the end of a file | Adding new test cases, appending log entries, adding exports to an index file |
| **range** | Surgical edits within a file | Updating a specific function, modifying a configuration section, changing one method in a class |
| **delete** | Removing obsolete files | Deleting deprecated code, removing temporary files, cleaning up unused components |

**General Guidelines:**

- Use **create** when the file doesn't exist yet
- Use **replace** when you need to change most or all of the file's content
- Use **append** when adding new content that logically goes at the end (remember to include leading newlines if needed)
- Use **range** for precise, localized changes where you want to preserve surrounding context
- Use **delete** when removing files that are no longer needed (supports undo via backup)

## Validation

### Strict Validation Policy
Inscribe validates ALL blocks before applying ANY changes. If even one block fails validation, the entire operation is rejected.

### Fail-Fast Behavior
When validation fails, all errors are reported and no files are modified.

## Backup and Undo

### Backup
Before every apply, Inscribe creates a backup at `.inscribe/backups/<timestamp>/`

### Undo
Restores files from the most recent backup (blind restore, no merge).
