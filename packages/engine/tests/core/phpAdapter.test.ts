import { beforeAll, describe, expect, it } from "vitest";
import * as path from "path";
import {
  createLanguageRegistry,
  createPhpLanguageAdapter,
  STRUCTURAL_KINDS,
} from "../../src/core/languages";
import { createAdapterStructuralResolver } from "../../src/core/structural/resolveStructuralTarget";
import { initTreeSitter } from "../../src/core/structural/treeSitterRuntime";

const CORE_WASM = path.resolve(
  __dirname,
  "../../../../node_modules/web-tree-sitter/tree-sitter.wasm",
);
const PHP_WASM = path.resolve(
  __dirname,
  "../../../../node_modules/tree-sitter-wasms/out/tree-sitter-php.wasm",
);
const ASSETS = {
  coreWasmPath: CORE_WASM,
  languageWasmPaths: { php: PHP_WASM },
};

const resolver = createAdapterStructuralResolver(
  createLanguageRegistry([createPhpLanguageAdapter(ASSETS)]),
);

beforeAll(async () => {
  await initTreeSitter(ASSETS);
});

async function resolveSlice(
  source: string,
  pathSegments: Parameters<typeof resolver>[0]["selector"]["path"],
) {
  const match = await resolver({
    source,
    filePath: "example.php",
    selector: { path: pathSegments },
  });
  return source.slice(match.start, match.end);
}

describe("PHP language adapter", () => {
  it("registers PHP with the generic structural kinds and grammar", () => {
    const adapter = createPhpLanguageAdapter(ASSETS);

    expect(adapter.extensions).toEqual([".php"]);
    expect(adapter.structural.supportedKinds).toEqual(STRUCTURAL_KINDS);
    expect(adapter.grammarIdForFile("src/example.php")).toBe("php");
  });

  it("resolves named declarations, constructors, abstract methods, and interface methods", async () => {
    const source = `<?php
class Example {
  public function __construct() {}
  abstract public function missing(): void;
}
interface Contract {
  public function execute();
}
function topLevel() {}
`;

    expect(
      await resolveSlice(source, [{ kind: "class", name: "Example" }]),
    ).toContain("class Example");
    expect(
      await resolveSlice(source, [
        { kind: "class", name: "Example" },
        { kind: "method", name: "__construct" },
      ]),
    ).toBe("public function __construct() {}");
    expect(
      await resolveSlice(source, [
        { kind: "class", name: "Example" },
        { kind: "constructor" },
      ]),
    ).toBe("public function __construct() {}");
    expect(
      await resolveSlice(source, [
        { kind: "class", name: "Example" },
        { kind: "method", name: "missing" },
      ]),
    ).toBe("abstract public function missing(): void;");
    expect(
      await resolveSlice(source, [{ kind: "method", name: "execute" }]),
    ).toBe("public function execute();");
    expect(
      await resolveSlice(source, [{ kind: "function", name: "topLevel" }]),
    ).toBe("function topLevel() {}");
  });

  it("discovers a bare constructor through named class-like owners", async () => {
    const source = `<?php
class Example {
  public function __construct() {}
}
`;

    expect(
      await resolveSlice(source, [{ kind: "constructor" }]),
    ).toBe("public function __construct() {}");
  });

  it("leaves multiple bare constructors ambiguous in the shared core", async () => {
    await expect(
      resolveSlice(
        `<?php
class A { public function __construct() {} }
class B { public function __construct() {} }
`,
        [{ kind: "constructor" }],
      ),
    ).rejects.toThrow("TARGET_AMBIGUOUS");
  });

  it("keeps path ownership between classes, methods, and nested executable owners", async () => {
    const source = `<?php
class A {
  public function run() {
    if ($direct) { keep(); }
    $callback = function () { if ($anonymous) { leak(); } };
    $arrow = fn () => $anonymous;
    $service = new class { public function run() { if ($anonymousClass) {} } };
  }
  public function sibling() { if ($sibling) {} }
}
class B { public function run() {} }
`;

    expect(
      await resolveSlice(source, [
        { kind: "class", name: "A" },
        { kind: "method", name: "run" },
        { kind: "if_statement" },
      ]),
    ).toBe("if ($direct) { keep(); }");

    await expect(
      resolveSlice(source, [
        { kind: "class", name: "A" },
        { kind: "method", name: "sibling" },
        { kind: "if_statement" },
      ]),
    ).resolves.toBe("if ($sibling) {}");

    await expect(
      resolveSlice(
        `<?php class A { public function run() { $callback = function () { if ($hidden) {} }; } }`,
        [
          { kind: "class", name: "A" },
          { kind: "method", name: "run" },
          { kind: "if_statement" },
        ],
      ),
    ).rejects.toThrow("TARGET_NOT_FOUND");

    await expect(
      resolveSlice(
        `<?php class A { public function run() { $service = new class { public function hidden() { if ($hidden) {} } }; } }`,
        [
          { kind: "class", name: "A" },
          { kind: "method", name: "run" },
          { kind: "if_statement" },
        ],
      ),
    ).rejects.toThrow("TARGET_NOT_FOUND");
  });

  it("resolves the supported PHP statement kinds, including alternative syntax", async () => {
    const source = `<?php
class Flow {
  public function run() {
    if ($ready):
      for ($i = 0; $i < 1; $i++):
        while ($again):
          work();
        endwhile;
      endfor;
    endif;
    switch ($status):
      case 'ready':
        break;
    endswitch;
  }
}
`;
    for (const kind of [
      "if_statement",
      "for_statement",
      "while_statement",
      "switch_statement",
    ] as const) {
      await expect(
        resolveSlice(source, [
          { kind: "class", name: "Flow" },
          { kind: "method", name: "run" },
          { kind },
        ]),
      ).resolves.toMatch(new RegExp(`^${kind.replace("_statement", "")}`));
    }
  });

  it("does not surface foreach as for_statement", async () => {
    await expect(
      resolveSlice(
        `<?php class Loops { public function run() { foreach ($items as $item) {} } }`,
        [
          { kind: "class", name: "Loops" },
          { kind: "method", name: "run" },
          { kind: "for_statement" },
        ],
      ),
    ).rejects.toThrow("TARGET_NOT_FOUND");
  });

  it("uses the natural method range for attributes and declaration-only methods", async () => {
    const source = `<?php
class Controller {
  #[Route('/users')]
  #[RequiresAuth]
  public function index(): Response {}
}
`;

    expect(
      await resolveSlice(source, [
        { kind: "class", name: "Controller" },
        { kind: "method", name: "index" },
      ]),
    ).toBe(
      "#[Route('/users')]\n  #[RequiresAuth]\n  public function index(): Response {}",
    );
  });

  it("targets declarations in mixed PHP and HTML files", async () => {
    const source = `<!doctype html>
<html><body><h1><?= $title ?></h1><?php
function formatName(string $name): string { return trim($name); }
?></body></html>`;

    expect(
      await resolveSlice(source, [{ kind: "function", name: "formatName" }]),
    ).toBe("function formatName(string $name): string { return trim($name); }");
  });

  it("tolerates unrelated recovery but returns no candidate for a malformed target shape", async () => {
    expect(
      await resolveSlice(
        `<?php function good() {} @@@`,
        [{ kind: "function", name: "good" }],
      ),
    ).toBe("function good() {}");

    await expect(
      resolveSlice(`<?php function (`, [{ kind: "function" }]),
    ).rejects.toThrow("TARGET_NOT_FOUND");
  });

  it("leaves ambiguity to the shared structural core", async () => {
    await expect(
      resolveSlice(
        `<?php class A { public function run() {} } class B { public function run() {} }`,
        [{ kind: "method", name: "run" }],
      ),
    ).rejects.toThrow("TARGET_AMBIGUOUS");
  });
});
