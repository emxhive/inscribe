# Inscribe Engine Pipeline Map

This document describes the active architecture and flow of the Inscribe engine.

## Core Flow

1. **Parse** (`packages/engine/src/parse/`)
   - Raw text is parsed into `ParsedBlock[]`.
   - Understands block structure (BEGIN/END), FILE, MODE, directives, and fenced content.

2. **Contract Validation** (`packages/engine/src/contract/`)
   - Validates the public operation contract against shared metadata.
   - Checks for valid mode, required/allowed directives, and content policies.

3. **Preflight** (`packages/engine/src/preflight/`)
   - Simulates operations against the repository state.
   - Enforces path, scope, and ignore policy before resolving each operation.
   - Manages virtual file state by canonical path and performs candidate validation.

4. **Operation Execution** (`packages/engine/src/operation/`)
   - The central layer that interprets operation meaning.
   - `resolveOperationExecution` consumes current file state and composes `afterContent`.

5. **Target Resolution** (`packages/engine/src/target/`)
   - Used by operation execution for partial replacement modes.
   - Identifies the specific span of a file targeted by line, range, between, block, or symbol operations.
   - Returns only `{ replaceStart, replaceEnd }`.

6. **Candidate Validation** (`packages/engine/src/preflight/candidateValidation.ts`)
   - Validates supported candidate file contents before disk writes.
   - JS/TS-family files are parsed in memory.
   - PHP files are parsed through the `nikic/php-parser` helper.
   - Dart files are parsed through the Dart analyzer helper.

7. **Apply** (`packages/engine/src/apply/`)
   - Persists resolved preflight executions to the filesystem.
   - Builds restore history entries before writing.
   - Persists restore history inside the engine apply boundary after writes.
   - Rolls back filesystem writes if history persistence fails.

8. **Preview / History**
   - **Preview** (`packages/engine/src/preview/`): Builds comparisons/diffs from resolved results.
   - **History** (`packages/engine/src/history/`): Manages restore payloads and logic.
