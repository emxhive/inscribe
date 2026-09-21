import { beforeAll, describe, expect, it } from "vitest";
import * as path from "path";
import {
  createAdapterStructuralResolver,
  parseSelector,
} from "../../src/core/structural";
import {
  createLanguageRegistry,
  createTypeScriptLanguageAdapter,
} from "../../src/core/languages";
import { initTreeSitter } from "../../src/core/structural/treeSitterRuntime";

const ASSETS = {
  coreWasmPath: path.resolve(
    __dirname,
    "../../../../node_modules/web-tree-sitter/tree-sitter.wasm",
  ),
  languageWasmPaths: {
    typescript: path.resolve(
      __dirname,
      "../../../../node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm",
    ),
    tsx: path.resolve(
      __dirname,
      "../../../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm",
    ),
  },
};

const resolver = createAdapterStructuralResolver(
  createLanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]),
);

beforeAll(async () => {
  await initTreeSitter(ASSETS);
});

describe("JavaScript and JSX structural support", () => {
  it.each([
    [
      "declaration",
      "export function run() { return 1; }\nfunction keep() {}",
      "function:run",
      "export function run() { return 1; }",
    ],
    [
      "arrow function",
      "const run = () => {};\nconst keep = () => {};",
      "function:run",
      "const run = () => {};",
    ],
    [
      "function expression",
      "const run = function () {};\nconst keep = function () {};",
      "function:run",
      "const run = function () {};",
    ],
    [
      "generator function expression",
      "const run = function* () {};\nconst keep = function* () {};",
      "function:run",
      "const run = function* () {};",
    ],
  ])(
    "resolves the JavaScript %s and preserves its logical replacement range",
    async (_label, source, selectorPath, expected) => {
      const match = await resolver({
        source,
        filePath: "functions.js",
        selector: parseSelector(selectorPath),
      });

      expect(source.slice(match.start, match.end)).toBe(expected);
    },
  );

  it("resolves exported variable-declared functions through their declaration range", async () => {
    const source = "export const run = () => {};\nconst keep = 1;";
    const match = await resolver({
      source,
      filePath: "functions.js",
      selector: parseSelector("function:run"),
    });

    expect(source.slice(match.start, match.end)).toBe(
      "export const run = () => {};",
    );
  });

  it("resolves JavaScript class, method, constructor, and function-valued field ranges", async () => {
    const source = `export default class Example {
  constructor(value) {
    this.value = value;
  }

  render() {
    return this.value;
  }

  handler = () => {};
}`;

    const classMatch = await resolver({
      source,
      filePath: "example.js",
      selector: parseSelector("class:Example"),
    });
    expect(source.slice(classMatch.start, classMatch.end)).toBe(source);

    const methodMatch = await resolver({
      source,
      filePath: "example.js",
      selector: parseSelector("class:Example > method:render"),
    });
    expect(source.slice(methodMatch.start, methodMatch.end)).toBe(
      "render() {\n    return this.value;\n  }",
    );

    const constructorMatch = await resolver({
      source,
      filePath: "example.js",
      selector: parseSelector("class:Example > constructor"),
    });
    expect(source.slice(constructorMatch.start, constructorMatch.end)).toBe(
      "constructor(value) {\n    this.value = value;\n  }",
    );

    const fieldMatch = await resolver({
      source,
      filePath: "example.js",
      selector: parseSelector("class:Example > function:handler"),
    });
    expect(source.slice(fieldMatch.start, fieldMatch.end)).toBe(
      "handler = () => {};",
    );
  });

  it("discovers bare and scoped constructors and reports constructor ambiguity across classes", async () => {
    const source = `class First {
  constructor() {}
}

class Second {
  constructor() {}
}`;

    await expect(
      resolver({
        source,
        filePath: "constructors.js",
        selector: parseSelector("constructor"),
      }),
    ).rejects.toThrow("TARGET_AMBIGUOUS");

    const scopedMatch = await resolver({
      source,
      filePath: "constructors.js",
      selector: parseSelector("class:Second > constructor"),
    });
    expect(source.slice(scopedMatch.start, scopedMatch.end)).toBe(
      "constructor() {}",
    );
  });

  it("keeps nested executable structures behind ownership boundaries", async () => {
    const source = `function outer() {
  if (direct) {}

  const callback = () => {
    if (hidden) {}
  };

  const fn = function () {
    if (hidden2) {}
  };

  const C = class {
    method() {
      if (hidden3) {}
    }
  };
}`;

    const match = await resolver({
      source,
      filePath: "ownership.js",
      selector: parseSelector("function:outer > if_statement"),
    });

    expect(source.slice(match.start, match.end)).toBe("if (direct) {}");
  });

  it("resolves JavaScript control-flow statements, including for-in and for-of", async () => {
    const source = `function flow(values) {
  if (ready) {}
  for (let index = 0; index < 1; index++) {}
  for (const key in values) {}
  for (const value of values) {}
  while (ready) {}
  switch (value) {
    case 1:
      break;
  }
}`;

    const cases = [
      ["if_statement", "if (ready) {}", undefined],
      [
        "for_statement",
        "for (let index = 0; index < 1; index++) {}",
        "for (let index = 0;",
      ],
      ["for_statement", "for (const key in values) {}", "for (const key in"],
      [
        "for_statement",
        "for (const value of values) {}",
        "for (const value of",
      ],
      ["while_statement", "while (ready) {}", undefined],
      [
        "switch_statement",
        "switch (value) {\n    case 1:\n      break;\n  }",
        undefined,
      ],
    ] as const;

    for (const [kind, expected, startsWith] of cases) {
      const match = await resolver({
        source,
        filePath: "flow.js",
        selector: parseSelector("function:flow > " + kind, startsWith),
      });
      expect(source.slice(match.start, match.end)).toBe(expected);
    }
  });

  it("resolves JSX through the TSX grammar without making JSX an ownership boundary", async () => {
    const source = `export function App() {
  if (ready) {
    return <div>Hello</div>;
  }

  return null;
}`;

    const functionMatch = await resolver({
      source,
      filePath: "App.jsx",
      selector: parseSelector("function:App"),
    });
    expect(source.slice(functionMatch.start, functionMatch.end)).toBe(source);

    const statementMatch = await resolver({
      source,
      filePath: "App.jsx",
      selector: parseSelector("function:App > if_statement"),
    });
    expect(source.slice(statementMatch.start, statementMatch.end)).toBe(
      "if (ready) {\n    return <div>Hello</div>;\n  }",
    );
  });

  it("resolves a class method containing JSX through the TSX grammar", async () => {
    const source = `class View {
  render() {
    return <div>JSX</div>;
  }
}`;
    const match = await resolver({
      source,
      filePath: "View.jsx",
      selector: parseSelector("class:View > method:render"),
    });

    expect(source.slice(match.start, match.end)).toBe(
      "render() {\n    return <div>JSX</div>;\n  }",
    );
  });

  it("resolves a structurally identified JavaScript target despite unrelated recovery", async () => {
    const source = `function target() {
  return 1;
}

const broken = ;`;
    const match = await resolver({
      source,
      filePath: "recovery.js",
      selector: parseSelector("function:target"),
    });

    expect(source.slice(match.start, match.end)).toBe(
      "function target() {\n  return 1;\n}",
    );
  });

  it("returns TARGET_NOT_FOUND when malformed JavaScript exposes no requested target", async () => {
    await expect(
      resolver({
        source: "const broken = ;",
        filePath: "recovery.js",
        selector: parseSelector("function:missing"),
      }),
    ).rejects.toThrow("TARGET_NOT_FOUND");
  });
});
