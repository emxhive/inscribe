# V2 structural conformance benchmark

This is a standalone conformance corpus for measuring structural targeting against realistic TypeScript, TSX, Dart, and Flutter code. It is intentionally separate from `packages/engine/tests/`, and it is designed from developer targeting intent rather than from the current adapter implementation.

The corpus has two kinds of scenarios:

- `selector`: a developer intent that the current canonical selector vocabulary can express. The benchmark records the expected kind, exact targeting/range assertions, ownership expectations, neighboring-code preservation, and replacement syntax requirements.
- `capability`: a developer intent that must remain visible in the benchmark. Cases without a selector remain descriptive TODOs; cases that gain a semantic selector execute the same range and replacement assertions as selector scenarios. Cases marked `parser-compatibility` execute structural resolution and assert their declared parser outcome, so grammar support changes remain visible without treating Tree-sitter as authoritative syntax validation.

The fixtures are ordinary-looking source files. They deliberately include framework conventions, modifiers, annotations, callbacks, repeated shapes, nested scopes, formatting differences, Unicode, and neighboring declarations so the benchmark does not become an implementation-shaped collection of minimal snippets.

Successful selector scenarios declare independent `rangeAnchor` and `rangeEndAnchor` witnesses. Replacement scenarios run through the V2 `replace_node` operation executor and its virtual-file path. Neighbor checks use manifest-declared sentinels outside the target, so they do not compare slices that were used to construct the replacement. Capability scenarios remain descriptive until a product-level selector vocabulary exists; executable capability scenarios retain their original intent and evidence in the manifest.

## Coverage

- TypeScript: decorated/exported services, constructor parameter properties, overload signatures, async/generator declarations, class-field callbacks, callback ownership, classic/`for...of`/`for...in` loops, repeated conditionals, Unicode, interfaces/types/enums/namespaces, and formatting variation.
- TSX: exported function components, hooks, event callbacks, repeated render branches, JSX build trees, class components, builders, fragments, and JSX-specific capability cases.
- Dart: annotated classes, named/factory/const constructors, async and generator methods, extensions, callbacks, local functions, repeated control flow, collection operations, Unicode, and an isolated Dart 3 switch-expression parser-compatibility corpus.
- Flutter: stateful and ordinary stateless widget/state ownership, build trees, `FutureBuilder`, `StreamBuilder`, `ListView.builder`, callback handlers, async state transitions, collection `if`/`for`, and widget-level capability cases.

## Manual commands

From the repository root, run the dedicated benchmark with:

```powershell
npm run benchmark:structural-conformance -w packages/engine
```

The equivalent direct command is:

```powershell
npm run test -w packages/engine -- --run benchmarks/v2-structural-conformance/structuralConformance.test.ts
```

The scenario source of truth is [manifest.json](./manifest.json). The benchmark is intentionally not part of the ordinary `npm run test:engine` suite.
