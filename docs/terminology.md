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

#### Required Directives

- **FILE:** Specifies the relative path from repository root where the file will be created or modified
  - Format: `FILE: relative/path/from/repo/root.ext` or `@inscribe FILE: relative/path/from/repo/root.ext`
  - For CREATE mode: Path must be under repository root and not in an ignored directory
  - For other modes (REPLACE, APPEND, RANGE): Path must be within configured scope roots
  - Path must not be in an ignored directory

- **MODE:** Specifies the operation type
  - Format: `MODE: <create|replace|append|range>` or `@inscribe MODE: <create|replace|append|range>`
  - Must be exactly one of the four supported modes

#### Optional Directives (Mode-Specific)

- **START:** (required for range mode) The beginning anchor for partial replacement
  - Format: `START: <exact substring>` or `@inscribe START: <exact substring>`
  - Must match exactly once in the target file (or within scope)
  
- **END:** (required for range mode) The ending anchor for partial replacement
  - Format: `END: <exact substring>` or `@inscribe END: <exact substring>`
  - Must match exactly once in the target file (or within scope)
  - Must appear after START anchor in the file

- **SCOPE_START:** (optional for range mode) Narrows the search area for anchors
  - Format: `SCOPE_START: <exact substring>` or `@inscribe SCOPE_START: <exact substring>`
  - Must match exactly once in the target file
  
- **SCOPE_END:** (optional for range mode) Defines the end of the search area
  - Format: `SCOPE_END: <exact substring>` or `@inscribe SCOPE_END: <exact substring>`
  - Must match exactly once in the target file
  - Must appear after SCOPE_START in the file

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
- Path must be within configured scope roots

**Failure conditions:**
- File does not exist
- Path is not under scope roots
- Path is in an ignored directory

### append
Appends content to the end of an existing file.

**Requirements:**
- File MUST exist
- Path must be within configured scope roots

**Failure conditions:**
- File does not exist
- Path is not under scope roots
- Path is in an ignored directory

### range
Replaces content between two anchor points in an existing file, keeping the anchors intact.

**Requirements:**
- File MUST exist
- Path must be within configured scope roots
- START directive is required
- END directive is required
- Both anchors must match exactly once
- END anchor must appear after START anchor

**Optional:**
- SCOPE_START and SCOPE_END can narrow the search area

## Repository Structure

### Repository Root
The base directory of your repository where Inscribe operates. All file paths in blocks are relative to this root.

### Scope Roots
Configurable directories where Inscribe is allowed to modify existing files. These are used by REPLACE, APPEND, and RANGE modes to restrict which files can be changed.

**Example scope configuration:**
- `app/` - Application source code
- `routes/` - Route definitions
- `config/` - Configuration files
- `tests/` - Test files

**Note:** CREATE mode is more permissive - it can create new files anywhere under the repository root (as long as the path is not ignored), without being restricted to scope roots. This allows you to create new top-level directories and files without reconfiguring scope first.

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
