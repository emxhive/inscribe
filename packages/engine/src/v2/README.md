# V2 Structural-Engine Architecture

This document describes the architectural principles and design constraints for the Inscribe V2 structural-engine.

## Principles & Constraints

- **No Legacy Imports**: V2 code must never import from any legacy code directories (`legacy/` or archived folders).
- **Logical Syntax Node Targets**: Structural operations target logical syntax nodes (such as classes, methods, functions, constructors, loops, blocks) rather than coordinate ranges.
- **Strict Text-Matching Fallback**: If logical structural matching fails, exact anchored text matching is used strictly as a fallback.
- **Normalization First**: The raw payload is fully normalized (including line-ending normalization) before any candidate file content is constructed.
- **Precise Diff Descriptions**: Generated diffs must describe actual textual changes (line-by-line / character-by-character) instead of merely reflecting the operational node scope.
- **Shared Execution Semantics**: Both previewing (`buildOperationPreview`, `buildOperationComparison`) and applying changes (`applyChanges`) must share identical canonical execution semantics. Note that this is a V2 integration requirement, not active runtime wiring yet.
- **Optional Authoritative Validation**: The shared candidate-validation boundary invokes an adapter's syntax validator only when that capability is explicitly provided. A language without a trustworthy validator remains usable without pretending that structural parsing proves syntax validity.
- **Worker Isolation**: Worker thread execution and environment boundary safety remain outside the engine logic itself (managed via IPC/engineWorker boundaries in the application).
- **Tree-sitter Role**: Tree-sitter provides logical structural discovery and parser diagnostics for registered V2 languages. It is not an authoritative syntax validator. Compiler and type-checker concerns remain outside V2.
- **Recoverable Structural Parsing**: Parser diagnostics and candidate reliability evidence are retained during discovery. The language-neutral resolver applies selector qualification and cardinality before consulting that evidence, so diagnostics outside the candidates that matter do not globally poison the file; damage touching a selected candidate's boundary, recovery nodes, or ownership chain fails closed with structured diagnostics.
- **Dart Grammar Provenance**: The bundled `assets/tree-sitter-dart.wasm` is a checked-in grammar asset accompanied by the `tree-sitter-dart.LICENSE` notice for UserNobody14 and contributors (copyright years 2020–2022). The repository does not record a grammar package or release version for this binary, so it remains an explicitly structural, compatibility-limited asset rather than being upgraded opportunistically here.
