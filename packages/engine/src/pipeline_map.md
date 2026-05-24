# Inscribe Engine Pipeline Map

This document describes the active architecture and flow of the Inscribe engine.

## Core Flow

1. **Parse** (`packages/engine/src/parse/`)
   - Raw text is parsed into `ParsedBlock[]`.
   - Understands block structure (BEGIN/END), FILE, MODE, directives, and fenced content.

2. **Contract Validation** (`packages/engine/src/contract/`)
   - Validates the public operation contract against shared metadata.
   - Checks for valid mode, required/allowed directives, and content policies.

3. **Target Resolution** (`packages/engine/src/target/`)
   - Identifies the specific span of a file targeted by an operation.
   - Returns only `{ replaceStart, replaceEnd }`.

4. **Operation Execution** (`packages/engine/src/operation/`)
   - The central layer that interprets operation meaning.
   - `resolveOperationExecution` consumes targets and composes `afterContent`.

5. **Preflight** (`packages/engine/src/preflight/`)
   - Simulates operations against the repository state.
   - Manages virtual file state and performs candidate validation.

6. **Apply** (`packages/engine/src/apply/`)
   - Persists resolved preflight executions to the filesystem.
   - Handles rollbacks and history entry generation.

7. **Preview / History**
   - **Preview** (`packages/engine/src/preview/`): Builds comparisons/diffs from resolved results.
   - **History** (`packages/engine/src/history/`): Manages restore payloads and logic.
