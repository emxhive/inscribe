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


### Directives
Commands within an Inscribe block that specify how to process the code content. Directives can be specified with or without the `@inscribe` prefix (except for BEGIN and END which always require it).

**Important:** Each directive value must be single-line only. The parser processes directives line-by-line, so multiline directive values are not supported.

#### Required Directives

- **FILE:** Specifies the relative path from repository root where the file will be created or modified
  - Format: `FILE: relative/path/from/repo/root.ext` or `@inscribe FILE: relative/path/from/repo/root.ext`
  - Path must be under repository root and not in an ignored directory

- **MODE:** Specifies the operation type
  - Format: `MODE: <create|replace|append|range>` or `@inscribe MODE: <create|replace|append|range>`
  - Must be exactly one of the four supported modes

#### Optional Directives (Mode-Specific)

- **START:** (required for range mode) The beginning anchor for partial replacement
  - Format: `START: <exact substring>` or `@inscribe START: <exact substring>`
  - Anchors are **literal substring matches** (not regex, not whole-line matches)
  - Can match anywhere within a line (beginning, middle, or end)
  - Must match exactly once in the target file (or within scope)
  
- **END:** (required for range mode) The ending anchor for partial replacement
  - Format: `END: <exact substring>` or `@inscribe END: <exact substring>`
  - Anchors are **literal substring matches** (not regex, not whole-line matches)
  - Can match anywhere within a line (beginning, middle, or end)
  - Must match exactly once in the target file (or within scope)
  - Must appear after START anchor in the file

- **SCOPE_START:** (optional for range mode) Narrows the search area for anchors
  - Format: `SCOPE_START: <exact substring>` or `@inscribe SCOPE_START: <exact substring>`
  - Anchors are **literal substring matches** (not regex, not whole-line matches)
  - Must match exactly once in the target file
  - **Must be provided together with SCOPE_END** (providing only one is invalid)
  
- **SCOPE_END:** (optional for range mode) Defines the end of the search area
  - Format: `SCOPE_END: <exact substring>` or `@inscribe SCOPE_END: <exact substring>`
  - Anchors are **literal substring matches** (not regex, not whole-line matches)
  - Must match exactly once in the target file
  - Must appear after SCOPE_START in the file
  - **Must be provided together with SCOPE_START** (providing only one is invalid)

## Modes

### create
Creates a new file with the provided content.

**Requirements:**
- File MUST NOT exist
- Path must be under repository root (but not necessarily within scope)
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
Replaces content between two anchor points in an existing file, keeping the anchors intact.

**Requirements:**
- File MUST exist
- START directive is required
- END directive is required
- Both anchors must match exactly once
- END anchor must appear after START anchor
- Path must be under repository root and not ignored

**Optional:**
- SCOPE_START and SCOPE_END can narrow the search area

## When to Use Each Mode

Choosing the right mode depends on your specific use case:

| Mode | Best For | Example Use Cases |
|------|----------|-------------------|
| **create** | Adding entirely new files | Creating a new component, adding a new test file, scaffolding configuration files |
| **replace** | Completely rewriting existing files | Major refactoring, regenerating auto-generated files, replacing obsolete implementations |
| **append** | Adding content to the end of a file | Adding new test cases, appending log entries, adding exports to an index file |
| **range** | Surgical edits within a file | Updating a specific function, modifying a configuration section, changing one method in a class |

**General Guidelines:**

- Use **create** when the file doesn't exist yet
- Use **replace** when you need to change most or all of the file's content
- Use **append** when adding new content that logically goes at the end (remember to include leading newlines if needed)
- Use **range** for precise, localized changes where you want to preserve surrounding context

## Repository Structure

### Repository Root
The base directory of your repository where Inscribe operates. All file paths in blocks are relative to this root.

### Scope Roots
Configurable directories that help Inscribe focus indexing and suggestions. With the repo-wide modification policy, all modes can operate anywhere under the repository root (subject to ignore rules), so scope roots no longer restrict where changes may be applied.

**Example scope configuration:**
- `app/` - Application source code
- `routes/` - Route definitions
- `config/` - Configuration files
- `tests/` - Test files

### Ignored Paths
Directories that Inscribe will never touch.

**Ignored paths:**
- `.git/` - Git repository
- `node_modules/` - Dependencies
- `vendor/` - Dependencies
- `storage/` - Runtime storage
- `bootstrap/cache/` - Cache
- `public/build/` - Build output
- `.inscribe/` - Inscribe metadata

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

## LLM Usage Note (Copy/Paste)

The following note is intended for LLMs and users who want to prompt them. Copy it as-is when instructing an assistant:

```txt
INSCRIBE – LLM USAGE NOTE

When a user asks you to use Inscribe:

- Preserve your normal response behavior.
  - Write explanations, comments, and notes as usual.
  - Use fenced code blocks normally where helpful.

- Only apply Inscribe tags to code blocks that are meant to be processed by Inscribe.
  - Do not change or restrict other parts of the response.

For each code block intended for Inscribe:
- Add `@inscribe BEGIN` on a plain text line immediately before the fenced code block.
- Add Inscribe directives (e.g. FILE:, MODE:) immediately after the BEGIN line.
- Keep the code itself inside a normal Markdown fenced code block.
- Add `@inscribe END` on a plain text line immediately after the fenced code block.

Notes:
- Inscribe tags must not be fenced.
- Do not wrap multiple code blocks or the entire response in a single Inscribe block.
- All non-Inscribe content should remain unchanged.
```
