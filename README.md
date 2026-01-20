# Inscribe

Inscribe is a desktop app that turns AI output into safe, reviewable changes in your codebase. Paste an AI response, and Inscribe will only apply the parts you explicitly tag. Everything else is ignored. If any tag or directive is invalid, nothing is changed.

## What Inscribe Does

- **Applies only explicitly tagged code blocks** — no guessing, no heuristics.
- **Validates everything first** — if one block is wrong, nothing is applied.
- **Previews every change** — you see exactly what will happen before it happens.
- **Creates backups and supports undo** — changes are reversible.
- **Works with existing repos** — you point it at a repo and go.

## How It Works (In Short)

1. You paste an AI response into Inscribe.
2. Inscribe extracts **only** blocks wrapped with `@inscribe BEGIN` / `@inscribe END`.
3. It validates file paths and directives.
4. You preview the diff.
5. On apply, it writes the changes and creates a backup snapshot.

## Using the App

1. Open Inscribe and select the repo you want to modify.
2. Paste the full AI response into the input area.
3. Review the parsed blocks and preview the changes.
4. Apply the changes when everything looks correct.

## Inscribe Block Format

An Inscribe block is plain text wrapped around a normal fenced code block:

````
@inscribe BEGIN
FILE: relative/path/from/repo/root.ext
MODE: create | replace | append | range
[additional directives depending on mode]

```language
<code block with content>
```

@inscribe END
````

**Important:** Only `@inscribe BEGIN` and `@inscribe END` use the `@inscribe` prefix. Headers (`FILE:`, `MODE:`) and directives (e.g., `START:`, `END:`) must be written **without** the `@inscribe` prefix.

### Supported Modes

- **create** — file MUST NOT exist
- **replace** — file MUST exist, entire content replaced
- **append** — file MUST exist, content appended to end
- **range** — file MUST exist, partial replace between anchors (or replace a single START-selected line when END is omitted)

## LLM Usage

When working with AI assistants that generate code, you can instruct them to format their responses using Inscribe blocks. This allows you to safely review and apply only the tagged portions.

See the [LLM Usage Note in the terminology documentation](docs/terminology.md#llm-usage-note-copypaste) for complete instructions to copy/paste when prompting an LLM.

## Backups & Undo

When applying changes, Inscribe creates a snapshot at `.inscribe/backups/<timestamp>/` **inside your target repo**. Undo restores the most recent snapshot.

## Documentation

See [`docs/terminology.md`](docs/terminology.md) for detailed terminology and directive reference.
