# V2 Structural-Engine Architecture

This document describes the architectural principles and design constraints for the Inscribe V2 structural-engine.

## Principles & Constraints

- **No Legacy Imports**: V2 code must never import from any legacy code directories (`legacy/` or archived folders).
- **Logical Syntax Node Targets**: Structural operations target logical syntax nodes (such as classes, methods, functions, constructors, loops, blocks) rather than coordinate ranges.
- **Strict Text-Matching Fallback**: If logical structural matching fails, exact anchored text matching is used strictly as a fallback.
- **Normalization First**: The raw payload is fully normalized (including line-ending normalization) before any candidate file content is constructed.
- **Precise Diff Descriptions**: Generated diffs must describe actual textual changes (line-by-line / character-by-character) instead of merely reflecting the operational node scope.
- **Shared Execution Semantics**: Both previewing (`buildOperationPreview`, `buildOperationComparison`) and applying changes (`applyChanges`) must share identical canonical execution semantics. Note that this is a V2 integration requirement, not active runtime wiring yet.
- **Strict Pre-Write Validation**: Registered Tree-sitter language adapters validate resulting candidate file syntax before an execution can enter the resolved plan.
- **Worker Isolation**: Worker thread execution and environment boundary safety remain outside the engine logic itself (managed via IPC/engineWorker boundaries in the application).
- **Tree-sitter Role**: Tree-sitter provides logical structural discovery and syntax-only validation for registered V2 languages; compiler and type-checker concerns remain outside V2.
