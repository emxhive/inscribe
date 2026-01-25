# Inscribe – LLM Usage Guide

This guide is written for AI assistants (LLMs) that want to format their code responses using Inscribe blocks. It contains everything you need to know to use Inscribe correctly and effectively.

## What is Inscribe?

Inscribe is a desktop application that allows users to safely apply code changes from AI responses to their codebase. Instead of blindly applying all code suggestions, Inscribe only processes blocks that are explicitly tagged with `@inscribe` markers. This ensures safe, reviewable changes with validation and undo support.

## Core Principle

**Preserve your normal response behavior.** Write explanations, comments, and notes as usual. Use fenced code blocks normally where helpful. Only apply Inscribe tags to code blocks that are meant to be processed by the Inscribe application.

## Block Structure

An Inscribe block wraps a standard Markdown fenced code block with special markers and headers:

````
@inscribe BEGIN
FILE: relative/path/from/repo/root.ext
MODE: create | replace | append | range | delete
[optional directives]

```language
<code content>
```

@inscribe END
````

**Critical Rules:**
- **Only** `@inscribe BEGIN` and `@inscribe END` use the `@inscribe` prefix
- Headers (`FILE:`, `MODE:`) must **NOT** have the `@inscribe` prefix
- Directives (`START:`, `END:`, etc.) must **NOT** have the `@inscribe` prefix
- The Inscribe markers (`@inscribe BEGIN` and `@inscribe END`) must be **outside** the fenced code block
- Each Inscribe block wraps exactly **one** fenced code block

## Required Headers

Every Inscribe block must include these two headers immediately after `@inscribe BEGIN`:

### FILE:
Specifies the relative path from the repository root where the file will be created or modified.

```
FILE: src/components/Button.tsx
```

- Path must be relative to repository root
- Use forward slashes (`/`) even on Windows
- Do **NOT** use the `@inscribe` prefix

### MODE:
Specifies the operation type. Must be one of: `create`, `replace`, `append`, `range`, or `delete`.

```
MODE: create
```

- Do **NOT** use the `@inscribe` prefix
- Choose the appropriate mode based on the operation (see Modes section)

## Modes

### create
Creates a new file that must not already exist.

**Use when:**
- Adding entirely new files to the codebase
- Creating new components, tests, or configuration files

**Example:**
````
@inscribe BEGIN
FILE: src/utils/helpers.ts
MODE: create

```typescript
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

@inscribe END
````

### replace
Replaces the entire content of an existing file.

**Use when:**
- Completely rewriting an existing file
- Major refactoring where most of the file changes

**Example:**
````
@inscribe BEGIN
FILE: src/config.js
MODE: replace

```javascript
export const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000
};
```

@inscribe END
````

### append
Appends content to the end of an existing file.

**Use when:**
- Adding new content that logically goes at the end
- Adding exports, test cases, or log entries

**Note:** Inscribe does not automatically insert a newline. If you need a newline before your content, include it explicitly (start your code with a blank line).

**Example:**
````
@inscribe BEGIN
FILE: src/index.ts
MODE: append

```typescript

export { NewFeature } from './features/new-feature';
```

@inscribe END
````

### range
Replaces content between two anchor points in an existing file. This is the most precise mode for surgical edits.

**Use when:**
- Updating a specific function or method
- Modifying a configuration section
- Making localized changes while preserving surrounding code

**Required:** At least one START directive (START, START_BEFORE, or START_AFTER)
**Optional:** One END directive (END, END_BEFORE, or END_AFTER)

**Example (with both START and END):**
````
@inscribe BEGIN
FILE: src/api/users.ts
MODE: range
START: export function getUser(
END: }

```typescript
export function getUser(id: string): Promise<User> {
  return fetch(`/api/users/${id}`).then(res => res.json());
}
```

@inscribe END
````

**Example (START only - replaces one line):**
````
@inscribe BEGIN
FILE: src/config.ts
MODE: range
START: const API_VERSION =

```typescript
const API_VERSION = 'v2';
```

@inscribe END
````

### delete
Deletes an existing file from the repository.

**Use when:**
- Removing deprecated or obsolete files

**Note:** The fenced code block is optional for delete mode. You can omit it entirely.

**Example:**
````
@inscribe BEGIN
FILE: src/deprecated/old-feature.ts
MODE: delete

@inscribe END
````

## Range Mode Directives

When using `MODE: range`, you need at least one START directive. END is optional.

### START Directives

Exactly **one** of these must be provided:

- **START:** Begins replacement at the start of the line containing the anchor (anchor line is replaced)
- **START_BEFORE:** Begins replacement at the start of the line before the anchor
- **START_AFTER:** Begins replacement at the start of the line after the anchor

**Format:**
```
START: <exact substring>
```

### END Directives

**Optional.** If omitted, only the single line selected by START is replaced. If provided, exactly **one** of these must be used:

- **END:** Ends replacement at the end of the line containing the anchor (anchor line is replaced)
- **END_BEFORE:** Ends replacement at the start of the line containing the anchor (anchor line is excluded)
- **END_AFTER:** Ends replacement at the end of the line after the anchor

**Format:**
```
END: <exact substring>
```

### Anchor Matching Rules

- Anchors are **literal substring matches** (not regex, not whole-line matches)
- Anchors can match anywhere within a line (beginning, middle, or end)
- If no exact match is found, Inscribe retries with a **whitespace-insensitive** match
- START must match exactly once in the file
- END can match multiple times; Inscribe uses the **first occurrence after START**
- **Replacements always expand to full line boundaries** (no inline splicing)

### Special END Handling

If `END: }` is specified (a single closing brace), Inscribe uses **brace-aware matching** to automatically find the structural closing brace for the block containing the START anchor.

## Choosing the Right Mode

| Situation | Recommended Mode |
|-----------|-----------------|
| File doesn't exist yet | `create` |
| Rewriting most/all of a file | `replace` |
| Adding content to the end | `append` |
| Updating one function/method/section | `range` |
| Removing a file | `delete` |

**General guidance:**
- Use `range` mode with precise anchors for surgical changes
- Use `replace` when most of the file needs to change
- If you can't find unique anchors for `range`, widen the replacement area or use `replace`

## Best Practices for LLMs

### 1. Use Precise Anchors
Choose unique substrings that clearly identify the location:

✅ **Good:** `START: export function calculateTotal(`
❌ **Bad:** `START: function` (too generic, might match multiple times)

### 2. Include Enough Context in Anchors
Make sure your anchors are unique within the file:

✅ **Good:** `START: class UserService {`
❌ **Bad:** `START: {` (matches many lines)

### 3. Widen Range if Anchors Aren't Unique
If you can't find unique anchors, expand the replacement area:

```
START: // User Service Section
END: // End User Service Section
```

### 4. One Block Per Code Change
Don't wrap multiple code blocks in a single Inscribe block:

❌ **Wrong:**
````
@inscribe BEGIN
FILE: src/file1.ts
MODE: create

```typescript
// code 1
```

```typescript
// code 2
```

@inscribe END
````

✅ **Correct:**
````
@inscribe BEGIN
FILE: src/file1.ts
MODE: create

```typescript
// code 1
```

@inscribe END

@inscribe BEGIN
FILE: src/file2.ts
MODE: create

```typescript
// code 2
```

@inscribe END
````

### 5. Don't Inscribe Everything
Only tag code that should be applied to files. Examples, explanations, and illustrative code blocks should remain as normal Markdown fenced blocks.

### 6. Preserve Your Natural Style
Write explanations, descriptions, and comments as you normally would. Inscribe blocks are just for the code that needs to be applied.

## Common Mistakes to Avoid

### ❌ Using @inscribe prefix on headers/directives
```
@inscribe FILE: src/file.ts     // WRONG
@inscribe MODE: create           // WRONG
@inscribe START: function foo    // WRONG
```

### ✅ Correct format
```
FILE: src/file.ts
MODE: create
START: function foo
```

### ❌ Fencing the Inscribe markers
````
```
@inscribe BEGIN
FILE: src/file.ts
MODE: create
```                              // WRONG - markers should be outside fences
````

### ✅ Correct format
````
@inscribe BEGIN                  // Outside the fence
FILE: src/file.ts
MODE: create

```typescript                    // Only the code is fenced
// code here
```

@inscribe END                    // Outside the fence
````

## Complete Examples

### Example 1: Creating a New Component
````
@inscribe BEGIN
FILE: src/components/Card.tsx
MODE: create

```tsx
import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="card-content">{children}</div>
    </div>
  );
}
```

@inscribe END
````

### Example 2: Updating a Specific Function
````
@inscribe BEGIN
FILE: src/utils/validation.ts
MODE: range
START: export function validateEmail(
END: }

```typescript
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}
```

@inscribe END
````

### Example 3: Appending to a File
````
@inscribe BEGIN
FILE: src/routes/index.ts
MODE: append

```typescript

export { profileRouter } from './profile';
export { settingsRouter } from './settings';
```

@inscribe END
````

### Example 4: Replacing Single Line
````
@inscribe BEGIN
FILE: src/config.ts
MODE: range
START: export const MAX_RETRIES

```typescript
export const MAX_RETRIES = 5;
```

@inscribe END
````

### Example 5: Deleting a File
````
@inscribe BEGIN
FILE: src/deprecated/legacy-api.ts
MODE: delete

@inscribe END
````

## Summary

To use Inscribe effectively:

1. **Preserve your normal response style** - only tag code meant for Inscribe
2. **Use the correct mode** for each operation (create/replace/append/range/delete)
3. **Never use `@inscribe` prefix** on headers or directives (only on BEGIN/END)
4. **Choose precise, unique anchors** for range mode
5. **One code block per Inscribe block** - don't wrap multiple blocks together
6. **Keep Inscribe markers outside** the fenced code block

With these guidelines, any code-smart LLM can generate Inscribe-formatted responses that users can safely review and apply to their codebase.
