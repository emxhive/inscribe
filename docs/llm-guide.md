# INSCRIBE LLM USAGE GUIDE

ABOUT THIS GUIDE:
This guide is for AI assistants (LLMs) to learn how to format code responses using Inscribe blocks.
Inscribe is a desktop application that applies only explicitly tagged code blocks to a user's codebase.

CORE PRINCIPLE:
Preserve your normal response behavior. Write explanations and comments as usual. Use regular fenced code blocks where helpful. Only apply Inscribe tags to code blocks that should be processed by the Inscribe application.

INSCRIBE BLOCK STRUCTURE:

An Inscribe block has this structure (do NOT use four backticks - this is just showing you the structure):

@inscribe BEGIN
FILE: relative/path/from/repo/root.ext
MODE: create
(optional directives can go here)

(then a normal three-backtick fenced code block)
(with your code inside)
(end the fenced code block with three backticks)

@inscribe END

CRITICAL RULES FOR PREFIX USAGE:
1. ONLY use the @inscribe prefix for BEGIN and END markers
2. DO NOT use @inscribe prefix for FILE:
3. DO NOT use @inscribe prefix for MODE:
4. DO NOT use @inscribe prefix for any directives like START: or END:
5. The @inscribe BEGIN and @inscribe END lines are OUTSIDE the fenced code block
6. Each Inscribe block wraps exactly ONE fenced code block

REQUIRED HEADERS:

Every Inscribe block MUST include these two headers immediately after @inscribe BEGIN:

FILE: specifies the relative path from repository root
- Format: FILE: relative/path/from/repo/root.ext
- Path must be relative to repository root
- Use forward slashes even on Windows
- Do NOT use @inscribe prefix

MODE: specifies the operation type
- Format: MODE: create (or replace, append, range, delete)
- Must be exactly one of the five supported modes
- Do NOT use @inscribe prefix

THE FIVE MODES:

MODE 1: create
- Creates a new file that must not already exist
- Use when adding entirely new files to the codebase
- Example use cases: creating new components, tests, or configuration files

Example:
@inscribe BEGIN
FILE: src/utils/helpers.ts
MODE: create

```typescript
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

@inscribe END

MODE 2: replace
- Replaces the entire content of an existing file
- Use when completely rewriting an existing file
- Use when major refactoring where most of the file changes

Example:
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

MODE 3: append
- Appends content to the end of an existing file
- Use when adding new content that logically goes at the end
- IMPORTANT: Inscribe does not automatically insert a newline before your content
- If you need a newline before your content, include it explicitly by starting your code with a blank line

Example:
@inscribe BEGIN
FILE: src/index.ts
MODE: append

```typescript

export { NewFeature } from './features/new-feature';
```

@inscribe END

MODE 4: range
- Replaces content between two anchor points in an existing file
- This is the most precise mode for surgical edits
- Use when updating a specific function or method
- Use when modifying a configuration section
- Use when making localized changes while preserving surrounding code
- Requires at least one START directive
- END directive is optional

Example with both START and END:
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

Example with START only (replaces one line):
@inscribe BEGIN
FILE: src/config.ts
MODE: range
START: const API_VERSION =

```typescript
const API_VERSION = 'v2';
```

@inscribe END

MODE 5: delete
- Deletes an existing file from the repository
- Use when removing deprecated or obsolete files
- The fenced code block is optional for delete mode and can be omitted entirely

Example:
@inscribe BEGIN
FILE: src/deprecated/old-feature.ts
MODE: delete

@inscribe END

RANGE MODE DIRECTIVES:

When using MODE: range, you need at least one START directive. END is optional.

START DIRECTIVES (exactly ONE of these is required):
- START: begins replacement at the start of the line containing the anchor (anchor line is replaced)
- START_BEFORE: begins replacement at the start of the line before the anchor
- START_AFTER: begins replacement at the start of the line after the anchor

Format: START: exact substring to match

END DIRECTIVES (optional - if omitted, only one line is replaced):
- END: ends replacement at the end of the line containing the anchor (anchor line is replaced)
- END_BEFORE: ends replacement at the start of the line containing the anchor (anchor line is excluded)
- END_AFTER: ends replacement at the end of the line after the anchor

Format: END: exact substring to match

ANCHOR MATCHING RULES:
- Anchors are literal substring matches (not regex, not whole-line matches)
- Anchors can match anywhere within a line (beginning, middle, or end)
- If no exact match is found, Inscribe retries with whitespace-insensitive matching
- START must match exactly once in the file
- END can match multiple times - Inscribe uses the first occurrence after START
- Replacements always expand to full line boundaries (no inline splicing)

SPECIAL END HANDLING:
If END: } is specified (a single closing brace), Inscribe uses brace-aware matching to automatically find the structural closing brace for the block containing the START anchor.

CHOOSING THE RIGHT MODE:

When file does not exist yet: use create
When rewriting most or all of a file: use replace
When adding content to the end: use append
When updating one function or method or section: use range
When removing a file: use delete

General guidance:
- Use range mode with precise anchors for surgical changes
- Use replace when most of the file needs to change
- If you cannot find unique anchors for range, widen the replacement area or use replace

BEST PRACTICES:

1. USE PRECISE ANCHORS
Choose unique substrings that clearly identify the location.
Good example: START: export function calculateTotal(
Bad example: START: function (too generic, might match multiple times)

2. INCLUDE ENOUGH CONTEXT IN ANCHORS
Make sure your anchors are unique within the file.
Good example: START: class UserService {
Bad example: START: { (matches many lines)

3. WIDEN RANGE IF ANCHORS ARE NOT UNIQUE
If you cannot find unique anchors, expand the replacement area.
Example: START: // User Service Section and END: // End User Service Section

4. ONE BLOCK PER CODE CHANGE
Do not wrap multiple code blocks in a single Inscribe block.
Each Inscribe block should wrap exactly one fenced code block.

5. DO NOT INSCRIBE EVERYTHING
Only tag code that should be applied to files.
Examples, explanations, and illustrative code blocks should remain as normal Markdown fenced blocks.

6. PRESERVE YOUR NATURAL STYLE
Write explanations, descriptions, and comments as you normally would.
Inscribe blocks are just for the code that needs to be applied.

COMMON MISTAKES TO AVOID:

MISTAKE 1: Using @inscribe prefix on headers or directives
WRONG: @inscribe FILE: src/file.ts
WRONG: @inscribe MODE: create
WRONG: @inscribe START: function foo
CORRECT: FILE: src/file.ts
CORRECT: MODE: create
CORRECT: START: function foo

MISTAKE 2: Putting Inscribe markers inside fenced code blocks
The @inscribe BEGIN and @inscribe END markers must be OUTSIDE the fenced code block.
The fenced code block (three backticks) should only wrap the actual code content.

MISTAKE 3: Wrapping multiple code blocks in one Inscribe block
Each Inscribe block should contain exactly one fenced code block.

COMPLETE EXAMPLES:

EXAMPLE 1: Creating a new component
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

EXAMPLE 2: Updating a specific function
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

EXAMPLE 3: Appending to a file
@inscribe BEGIN
FILE: src/routes/index.ts
MODE: append

```typescript

export { profileRouter } from './profile';
export { settingsRouter } from './settings';
```

@inscribe END

EXAMPLE 4: Replacing a single line
@inscribe BEGIN
FILE: src/config.ts
MODE: range
START: export const MAX_RETRIES

```typescript
export const MAX_RETRIES = 5;
```

@inscribe END

EXAMPLE 5: Deleting a file
@inscribe BEGIN
FILE: src/deprecated/legacy-api.ts
MODE: delete

@inscribe END

SUMMARY:

To use Inscribe correctly:
1. Preserve your normal response style - only tag code meant for Inscribe
2. Use the correct mode for each operation (create, replace, append, range, delete)
3. Never use @inscribe prefix on headers or directives (only on BEGIN and END)
4. Choose precise, unique anchors for range mode
5. One code block per Inscribe block - do not wrap multiple blocks together
6. Keep Inscribe markers outside the fenced code block

With these guidelines, any LLM can generate Inscribe-formatted responses that users can safely review and apply to their codebase.
