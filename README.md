# Inscribe

Desktop GUI application that safely applies AI-generated code into an existing codebase with minimal typing and zero guessing.

## What is Inscribe?

Inscribe is a power tool for advanced developers. You paste an entire AI response into Inscribe. It parses **only explicitly tagged Inscribe blocks** and ignores all other text. If any error exists, **nothing is applied**—all-or-nothing atomicity.

## Core Principles

- **Deterministic behavior only** – no heuristics, no guessing
- **Fail fast, fail hard** – errors are explicit and actionable
- **All-or-nothing apply** – partial success is forbidden
- **Preview before apply** – see exactly what will change
- **Automation without silent corruption** – backups and undo always available

## Inscribe Block Format

An Inscribe Block is explicitly marked:

```
@inscribe BEGIN
@inscribe FILE: relative/path/from/repo/root.ext
@inscribe MODE: create | replace | append | range
[additional directives depending on mode]

```
<code block with content>
```

@inscribe END
```

### Supported Modes

- **create** – file MUST NOT exist
- **replace** – file MUST exist, entire content replaced
- **append** – file MUST exist, content appended to end
- **range** – file MUST exist, partial replace between anchors

## Installation & Setup

```bash
npm install
npm run build
```

## Running the Desktop App

```bash
npm run dev:desktop
```

Opens Electron window for selecting repo root and pasting AI responses.

## Running Engine Tests

```bash
npm run test:engine
```

## Repository Structure

```
inscribe/
├── apps/
│   └── desktop/              # Electron + React UI
├── packages/
│   ├── engine/               # Core parsing, validation, apply logic
│   └── shared/               # Shared types and utilities
├── docs/
│   └── terminology.md        # Detailed terminology reference
├── .inscribe/                # Runtime backups (created on first apply)
└── README.md
```

## Indexed Roots (V1)

Files can only be created/modified under:

- `app/`
- `routes/`
- `resources/`
- `database/`
- `config/`
- `tests/`

Ignored: `.git/`, `node_modules/`, `vendor/`, `storage/`, `bootstrap/cache/`, `public/build/`, `.inscribe/`

## Strict Failure Policy

- If **ANY** block is invalid → apply is disabled
- No partial success
- No silent skips
- All errors reported before any file modification

## Backups & Undo

Before applying changes, Inscribe creates a backup snapshot at `.inscribe/backups/<timestamp>/`. Undo restores from the most recent snapshot only (blind restore, no merge).

## Documentation

See `docs/terminology.md` for detailed terminology and directive reference.