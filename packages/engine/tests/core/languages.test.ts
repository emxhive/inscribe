import { describe, expect, it, vi } from "vitest";
import * as path from "path";
import Parser from "web-tree-sitter";
import {
  createAdapterSyntaxValidator,
  createLanguageRegistry,
  createTypeScriptLanguageAdapter,
  LanguageRegistry,
  LanguageAdapter,
} from "../../src/core/languages";
import {
  createAdapterStructuralResolver,
  selectStructuralCandidate,
} from "../../src/core/structural/resolveStructuralTarget";
import { createTreeSitterLanguageAdapter } from "../../src/core/languages/treeSitterAdapter";

const CORE_WASM = path.resolve(
  __dirname,
  "../../../../node_modules/web-tree-sitter/tree-sitter.wasm",
);
const TS_WASM = path.resolve(
  __dirname,
  "../../../../node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm",
);

function adapter(
  id: string,
  extensions: readonly string[],
  candidates = [{ kind: "function" as const, name: "run", start: 2, end: 20 }],
  supportedKinds = ["function" as const],
): LanguageAdapter {
  return {
    id,
    extensions,
    structural: {
      supportedKinds,
      resolveCandidates: vi.fn(async (query) => {
        expect(query.path).toEqual([{ kind: "function", name: "run" }]);
        return candidates;
      }),
    },
  };
}

describe("language adapter contracts", () => {
  it("registers one TypeScript-family adapter for all ECMAScript grammar variants", () => {
    const typescriptAdapter = createTypeScriptLanguageAdapter({
      coreWasmPath: CORE_WASM,
      languageWasmPaths: {
        typescript: TS_WASM,
        tsx: path.resolve(
          __dirname,
          "../../../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm",
        ),
      },
    });
    const registry = new LanguageRegistry([typescriptAdapter]);

    expect(registry.resolve("component.ts")).toBe(typescriptAdapter);
    expect(registry.resolve("component.tsx")).toBe(typescriptAdapter);
    expect(registry.resolve("component.js")).toBe(typescriptAdapter);
    expect(registry.resolve("component.jsx")).toBe(typescriptAdapter);
    expect(typescriptAdapter.grammarIdForFile("component.ts")).toBe(
      "typescript",
    );
    expect(typescriptAdapter.grammarIdForFile("component.tsx")).toBe("tsx");
    expect(typescriptAdapter.grammarIdForFile("component.js")).toBe(
      "typescript",
    );
    expect(typescriptAdapter.grammarIdForFile("component.jsx")).toBe("tsx");
  });

  it("resolves extensions case-insensitively and independently of registration order", () => {
    const first = adapter("first", [".one"]);
    const second = adapter("second", [".TWO"]);
    const registry = createLanguageRegistry([second, first]);

    expect(registry.resolve("src/file.ONE")).toBe(first);
    expect(registry.resolve("src/file.two")).toBe(second);
    expect(registry.resolve("src/file.unknown")).toBeUndefined();
  });

  it("rejects duplicate ids, duplicate extensions, and duplicate extensions within an adapter", () => {
    const first = adapter("same", [".one"]);
    expect(
      () => new LanguageRegistry([first, adapter("same", [".two"])]),
    ).toThrow("Duplicate language adapter id");
    expect(
      () => new LanguageRegistry([first, adapter("other", [".ONE"])]),
    ).toThrow("already registered");
    expect(
      () => new LanguageRegistry([adapter("invalid", [".one", ".ONE"])]),
    ).toThrow("Duplicate extension");
    expect(
      () => new LanguageRegistry([adapter("no-kinds", [".none"], [], [])]),
    ).toThrow("structural.supportedKinds are required");
    expect(
      () =>
        new LanguageRegistry([
          adapter(
            "duplicate-kinds",
            [".duplicate"],
            [],
            ["function", "function"],
          ),
        ]),
    ).toThrow("structural.supportedKinds are invalid");
    expect(
      () =>
        new LanguageRegistry([
          {
            id: "no-capabilities",
            extensions: [".empty"],
          },
        ]),
    ).toThrow("at least one capability is required");
  });

  it("accepts syntax-only adapters without structural members", async () => {
    const validateSyntax = vi.fn(async () => undefined);
    const syntaxOnly = {
      id: "syntax-only",
      extensions: [".syntax"],
      validateSyntax,
    };
    const registry = new LanguageRegistry([syntaxOnly]);

    expect(registry.resolve("fixture.syntax")).toBe(syntaxOnly);
    await createAdapterSyntaxValidator(registry)({
      source: "valid syntax",
      filePath: "fixture.syntax",
      extension: ".syntax",
    });
    expect(validateSyntax).toHaveBeenCalledWith({
      source: "valid syntax",
      filePath: "fixture.syntax",
      extension: ".syntax",
    });
    await expect(
      createAdapterStructuralResolver(registry)({
        source: "anything",
        filePath: "fixture.syntax",
        selector: { path: [{ kind: "function", name: "run" }] },
      }),
    ).rejects.toThrow("UNSUPPORTED_EXTENSION");
    expect(validateSyntax).toHaveBeenCalledTimes(1);
  });

  it("keeps STARTS_WITH, not-found, ambiguity, and winner selection in the core", () => {
    const source = "  function run() {}\n  function run() { return 1; }";
    const firstStart = source.indexOf("function");
    const secondStart = source.indexOf("function", firstStart + 1);
    const candidates = [
      {
        kind: "function" as const,
        name: "run",
        start: firstStart,
        end: firstStart + "function run() {}".length,
      },
      {
        kind: "function" as const,
        name: "run",
        start: secondStart,
        end: source.length,
      },
    ];

    expect(() =>
      selectStructuralCandidate(
        source,
        {
          path: [{ kind: "function", name: "run" }],
        },
        candidates,
      ),
    ).toThrow("TARGET_AMBIGUOUS");

    const selected = selectStructuralCandidate(
      source,
      {
        path: [{ kind: "function", name: "run" }],
        startsWith: "function run() { return",
      },
      candidates,
    );
    expect(source.slice(selected.start, selected.end)).toBe(
      "function run() { return 1; }",
    );

    expect(() =>
      selectStructuralCandidate(
        source,
        {
          path: [{ kind: "function", name: "run" }],
          startsWith: "function missing",
        },
        candidates,
      ),
    ).toThrow("TARGET_QUALIFIER_NOT_MATCHED");

    expect(() =>
      selectStructuralCandidate(
        source,
        {
          path: [{ kind: "function", name: "missing" }],
        },
        [],
      ),
    ).toThrow("TARGET_NOT_FOUND");
  });

  it("retains qualification-uncertain candidates during STARTS_WITH cardinality reasoning", () => {
    const source = "function run() {}\nfunction run() { return 1; }";
    const firstStart = source.indexOf("function");
    const secondStart = source.indexOf("function", firstStart + 1);
    const candidates = [
      {
        kind: "function" as const,
        name: "run",
        start: firstStart,
        end: firstStart + "function run() {}".length,
        reliability: {
          qualification: "uncertain" as const,
          replacement: "trustworthy" as const,
        },
      },
      {
        kind: "function" as const,
        name: "run",
        start: secondStart,
        end: source.length,
      },
    ];

    expect(() =>
      selectStructuralCandidate(
        source,
        {
          path: [{ kind: "function", name: "run" }],
          startsWith: "function run() { return",
        },
        candidates,
      ),
    ).toThrow("STRUCTURAL_TARGET_UNRELIABLE");
  });

  it("rejects a uniquely selected candidate whose own replacement is uncertain", () => {
    const source = "function run() { return 1; }";
    expect(() =>
      selectStructuralCandidate(
        source,
        {
          path: [{ kind: "function", name: "run" }],
          startsWith: "function run() { return",
        },
        [
          {
            kind: "function",
            name: "run",
            start: 0,
            end: source.length,
            reliability: {
              qualification: "trustworthy",
              replacement: "uncertain",
            },
          },
        ],
      ),
    ).toThrow("STRUCTURAL_TARGET_UNRELIABLE");
  });

  it("keeps replacement uncertainty separate from qualification and name filtering", () => {
    const source = "function other() {}\nfunction run() {}";
    const firstStart = source.indexOf("function");
    const secondStart = source.indexOf("function", firstStart + 1);
    const candidates = [
      {
        kind: "function" as const,
        name: "other",
        start: firstStart,
        end: firstStart + "function other() {}".length,
        reliability: {
          qualification: "trustworthy" as const,
          replacement: "uncertain" as const,
        },
      },
      {
        kind: "function" as const,
        name: "run",
        start: secondStart,
        end: source.length,
      },
    ];

    const selected = selectStructuralCandidate(
      source,
      {
        path: [{ kind: "function", name: "run" }],
      },
      candidates,
    );

    expect(source.slice(selected.start, selected.end)).toBe(
      "function run() {}",
    );
  });

  it("exposes only logical UTF-16 ranges through the adapter-backed resolver", async () => {
    const source = "// 🚀\nfunction run() {}";
    const candidate = {
      kind: "function" as const,
      name: "run",
      start: source.indexOf("function"),
      end: source.length,
    };
    const resolveCandidates = vi.fn(async () => [candidate]);
    const registry = new LanguageRegistry([
      {
        id: "test-language",
        extensions: [".test"],
        structural: {
          supportedKinds: ["function"],
          resolveCandidates,
        },
      },
    ]);
    const resolver = createAdapterStructuralResolver(registry);

    const match = await resolver({
      source,
      filePath: "fixture.TEST",
      selector: { path: [{ kind: "function", name: "run" }] },
    });

    expect(match).toEqual(candidate);
    expect(resolveCandidates).toHaveBeenCalledWith({
      source,
      filePath: "fixture.TEST",
      extension: ".test",
      path: [{ kind: "function", name: "run" }],
    });
  });

  it("rejects a kind the resolved adapter does not support before discovery", async () => {
    const resolveCandidates = vi.fn(async () => []);
    const registry = new LanguageRegistry([
      {
        id: "function-only",
        extensions: [".kind"],
        structural: {
          supportedKinds: ["function"],
          resolveCandidates,
        },
      },
    ]);
    const resolver = createAdapterStructuralResolver(registry);

    await expect(
      resolver({
        source: "class Example {}",
        filePath: "Example.kind",
        selector: { path: [{ kind: "class", name: "Example" }] },
      }),
    ).rejects.toThrow("UNSUPPORTED_STRUCTURAL_KIND");
    expect(resolveCandidates).not.toHaveBeenCalled();
  });

  it("rejects empty candidate ranges at the core boundary", () => {
    expect(() =>
      selectStructuralCandidate(
        "function run() {}",
        {
          path: [{ kind: "function", name: "run" }],
        },
        [{ kind: "function", name: "run", start: 5, end: 5 }],
      ),
    ).toThrow("INVALID_STRUCTURAL_CANDIDATE");
  });

  it("rejects a candidate whose kind does not match the selector leaf kind", () => {
    expect(() =>
      selectStructuralCandidate(
        "class Example {}",
        {
          path: [{ kind: "function", name: "Example" }],
        },
        [{ kind: "class", name: "Example", start: 0, end: 16 }],
      ),
    ).toThrow("STRUCTURAL_CANDIDATE_KIND_MISMATCH");
  });

  it("converts Tree-sitter nodes to UTF-16 candidates before crossing the adapter boundary", async () => {
    const source = "// 🚀\nfunction run() {}";
    const grammarIdForFile = vi.fn((filePath: string) =>
      filePath.endsWith(".tsx") ? "tsx" : "typescript",
    );
    const adapter = createTreeSitterLanguageAdapter(
      {
        id: "tree-sitter-test",
        extensions: [".ts", ".tsx"],
        supportedKinds: ["function"],
        grammarIdForFile,
        collectCandidates(rootNode: Parser.SyntaxNode) {
          const visit = (
            node: Parser.SyntaxNode,
          ): Parser.SyntaxNode | undefined => {
            if (node.type === "function_declaration") {
              return node;
            }
            for (let index = 0; index < node.namedChildCount; index++) {
              const child = node.namedChild(index);
              if (child) {
                const match = visit(child);
                if (match) return match;
              }
            }
            return undefined;
          };

          const node = visit(rootNode);
          return node
            ? [
                {
                  kind: "function" as const,
                  name: "run",
                  replacement: { type: "node" as const, node },
                },
              ]
            : [];
        },
      },
      {
        coreWasmPath: CORE_WASM,
        languageWasmPaths: {
          typescript: TS_WASM,
          tsx: path.resolve(
            __dirname,
            "../../../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm",
          ),
        },
      },
    );

    const candidates = await adapter.structural.resolveCandidates({
      source,
      filePath: "fixture.tsx",
      extension: ".tsx",
      path: [{ kind: "function", name: "run" }],
    });

    expect(candidates).toEqual([
      {
        kind: "function",
        name: "run",
        start: source.indexOf("function"),
        end: source.length,
      },
    ]);
    expect("replacement" in candidates[0]).toBe(false);
    expect(grammarIdForFile).toHaveBeenCalledWith("fixture.tsx");

    await adapter.structural.resolveCandidates({
      source,
      filePath: "fixture.ts",
      extension: ".ts",
      path: [{ kind: "function", name: "run" }],
    });
    expect(grammarIdForFile).toHaveBeenCalledWith("fixture.ts");
  });

  it("converts explicit logical Tree-sitter ranges to UTF-16 candidates", async () => {
    const source = "// 🚀\nfunction run() {}";
    const start = source.indexOf("function");
    const encoder = new TextEncoder();
    const byteStart = encoder.encode(source.slice(0, start)).length;
    const byteEnd = encoder.encode(source).length;
    const adapter = createTreeSitterLanguageAdapter(
      {
        id: "tree-sitter-range-test",
        extensions: [".ts"],
        supportedKinds: ["function"],
        grammarIdForFile: () => "typescript",
        collectCandidates: () => [
          {
            kind: "function",
            name: "run",
            replacement: {
              type: "range",
              range: { startIndex: byteStart, endIndex: byteEnd },
            },
          },
        ],
      },
      {
        coreWasmPath: CORE_WASM,
        languageWasmPaths: { typescript: TS_WASM },
      },
    );

    await expect(
      adapter.structural.resolveCandidates({
        source,
        filePath: "fixture.ts",
        extension: ".ts",
        path: [{ kind: "function", name: "run" }],
      }),
    ).resolves.toEqual([
      {
        kind: "function",
        name: "run",
        start,
        end: source.length,
      },
    ]);
  });

  it("keeps qualification trustworthy when the adapter reliability node escapes the replacement range", async () => {
    const source = "// leading text\nfunction run() {}";
    const adapter = createTreeSitterLanguageAdapter(
      {
        id: "tree-sitter-reliability-test",
        extensions: [".ts"],
        supportedKinds: ["function"],
        grammarIdForFile: () => "typescript",
        collectCandidates(rootNode: Parser.SyntaxNode) {
          let functionNode: Parser.SyntaxNode | undefined;
          const visit = (node: Parser.SyntaxNode): void => {
            if (node.type === "function_declaration") {
              functionNode = node;
              return;
            }
            for (let index = 0; index < node.namedChildCount; index++) {
              const child = node.namedChild(index);
              if (child) visit(child);
            }
          };
          visit(rootNode);

          return functionNode
            ? [
                {
                  kind: "function" as const,
                  name: "run",
                  replacement: { type: "node" as const, node: functionNode },
                  reliabilityNode: rootNode,
                },
              ]
            : [];
        },
      },
      {
        coreWasmPath: CORE_WASM,
        languageWasmPaths: { typescript: TS_WASM },
      },
    );

    const candidates = await adapter.structural.resolveCandidates({
      source,
      filePath: "fixture.ts",
      extension: ".ts",
      path: [{ kind: "function", name: "run" }],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].reliability).toMatchObject({
      qualification: "trustworthy",
      replacement: "uncertain",
    });
  });
});
