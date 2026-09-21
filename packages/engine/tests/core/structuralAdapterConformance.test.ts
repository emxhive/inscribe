import { beforeAll, describe, expect, it } from "vitest";
import * as path from "path";
import {
  createDartLanguageAdapter,
  createLanguageRegistry,
  createPhpLanguageAdapter,
  createTypeScriptLanguageAdapter,
} from "../../src/core/languages";
import type { StructuralResolver } from "../../src/core/structural/resolveStructuralTarget";
import { createAdapterStructuralResolver } from "../../src/core/structural/resolveStructuralTarget";
import { parseSelector } from "../../src/core/structural/selectorParser";
import { initTreeSitter } from "../../src/core/structural/treeSitterRuntime";

const CORE_WASM = path.resolve(
  __dirname,
  "../../../../node_modules/web-tree-sitter/tree-sitter.wasm",
);
const TYPESCRIPT_WASM = path.resolve(
  __dirname,
  "../../../../node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm",
);
const TSX_WASM = path.resolve(
  __dirname,
  "../../../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm",
);
const DART_WASM = path.resolve(
  __dirname,
  "../../assets/tree-sitter-dart.wasm",
);
const PHP_WASM = path.resolve(
  __dirname,
  "../../../../node_modules/tree-sitter-wasms/out/tree-sitter-php.wasm",
);

const ASSETS = {
  coreWasmPath: CORE_WASM,
  languageWasmPaths: {
    typescript: TYPESCRIPT_WASM,
    tsx: TSX_WASM,
    dart: DART_WASM,
    php: PHP_WASM,
  },
};

const statementKinds = [
  "if_statement",
  "for_statement",
  "while_statement",
  "switch_statement",
] as const;

interface AdapterConformanceCase {
  id: string;
  filePath: string;
  ownerSelector: string;
  resolver: StructuralResolver;
  sourceFor: (kind: (typeof statementKinds)[number]) => string;
}

const typescriptResolver = createAdapterStructuralResolver(
  createLanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]),
);
const dartResolver = createAdapterStructuralResolver(
  createLanguageRegistry([createDartLanguageAdapter(ASSETS)]),
);
const phpResolver = createAdapterStructuralResolver(
  createLanguageRegistry([createPhpLanguageAdapter(ASSETS)]),
);

const conformanceCases: readonly AdapterConformanceCase[] = [
  {
    id: "TypeScript",
    filePath: "owner.ts",
    ownerSelector: "function:owner",
    resolver: typescriptResolver,
    sourceFor: (kind) => `function owner() {\n  ${nestedStatement(kind, "typescript")}\n}`,
  },
  {
    id: "TSX",
    filePath: "owner.tsx",
    ownerSelector: "function:owner",
    resolver: typescriptResolver,
    sourceFor: (kind) => `function owner() {\n  ${nestedStatement(kind, "typescript")}\n}`,
  },
  {
    id: "JavaScript",
    filePath: "owner.js",
    ownerSelector: "function:owner",
    resolver: typescriptResolver,
    sourceFor: (kind) => `function owner() {\n  ${nestedStatement(kind, "typescript")}\n}`,
  },
  {
    id: "JSX",
    filePath: "owner.jsx",
    ownerSelector: "function:owner",
    resolver: typescriptResolver,
    sourceFor: (kind) => `function owner() {\n  ${nestedStatement(kind, "typescript")}\n}`,
  },
  {
    id: "Dart",
    filePath: "owner.dart",
    ownerSelector: "function:owner",
    resolver: dartResolver,
    sourceFor: (kind) => `void owner() {\n  ${nestedStatement(kind, "dart")}\n}\n`,
  },
  {
    id: "PHP",
    filePath: "owner.php",
    ownerSelector: "class:Owner > method:run",
    resolver: phpResolver,
    sourceFor: (kind) => `<?php\nclass Owner {\n  public function run() {\n    ${nestedStatement(kind, "php")}\n  }\n}\n`,
  },
];

beforeAll(async () => {
  await initTreeSitter(ASSETS);
});

describe("Structural adapter conformance", () => {
  for (const conformanceCase of conformanceCases) {
    describe(conformanceCase.id, () => {
      for (const kind of statementKinds) {
        it(`keeps nested ${kind} candidates discoverable inside one selected owner`, async () => {
          const source = conformanceCase.sourceFor(kind);
          const selector = parseSelector(
            `${conformanceCase.ownerSelector} > ${kind}`,
          );

          await expect(
            conformanceCase.resolver({
              source,
              filePath: conformanceCase.filePath,
              selector,
            }),
          ).rejects.toThrow("TARGET_AMBIGUOUS");
        });
      }
    });
  }
});

function nestedStatement(
  kind: (typeof statementKinds)[number],
  language: "typescript" | "dart" | "php",
): string {
  if (kind === "if_statement") {
    return language === "php"
      ? "if ($outer) { if ($inner) {} }"
      : "if (outer) { if (inner) {} }";
  }

  if (kind === "for_statement") {
    if (language === "php") {
      return "for ($i = 0; $i < 1; $i++) { for ($j = 0; $j < 1; $j++) {} }";
    }
    if (language === "dart") {
      return "for (var i = 0; i < 1; i++) { for (var j = 0; j < 1; j++) {} }";
    }
    return "for (let i = 0; i < 1; i++) { for (let j = 0; j < 1; j++) {} }";
  }

  if (kind === "while_statement") {
    return language === "php"
      ? "while ($outer) { while ($inner) {} }"
      : "while (outer) { while (inner) {} }";
  }

  if (language === "php") {
    return "switch ($outer) { case 1: switch ($inner) { case 2: break; } break; }";
  }
  return "switch (outer) { case 1: switch (inner) { case 2: break; } break; }";
}
