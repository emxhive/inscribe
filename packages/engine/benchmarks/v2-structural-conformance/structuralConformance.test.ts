import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import {
  createDartLanguageAdapter,
  createTypeScriptLanguageAdapter,
  createAdapterSyntaxValidator,
  createV2LanguageRegistry,
} from '../../src/v2/languages';
import { resolveOperation } from '../../src/v2/execution/resolveOperation';
import { createAdapterStructuralResolver } from '../../src/v2/structural/resolveStructuralTarget';
import { parseSelector } from '../../src/v2/structural/selectorParser';

const BENCHMARK_ROOT = __dirname;
const manifest = JSON.parse(
  fs.readFileSync(path.join(BENCHMARK_ROOT, 'manifest.json'), 'utf8'),
) as BenchmarkManifest;

const CORE_WASM = path.resolve(BENCHMARK_ROOT, '../../../../node_modules/web-tree-sitter/tree-sitter.wasm');
const TS_WASM = path.resolve(BENCHMARK_ROOT, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm');
const TSX_WASM = path.resolve(BENCHMARK_ROOT, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm');
const DART_WASM = path.resolve(BENCHMARK_ROOT, '../../assets/tree-sitter-dart.wasm');
const ASSETS = {
  coreWasmPath: CORE_WASM,
  languageWasmPaths: {
    typescript: TS_WASM,
    tsx: TSX_WASM,
    dart: DART_WASM,
  },
};

const registry = createV2LanguageRegistry([
  createTypeScriptLanguageAdapter(ASSETS),
  createDartLanguageAdapter(ASSETS),
]);
const resolver = createAdapterStructuralResolver(registry);
const syntaxValidator = createAdapterSyntaxValidator(registry);

for (const suite of manifest.suites) {
  const fixtures = new Map(
    suite.fixtures.map((fixture) => [
      fixture.id,
      {
        ...fixture,
        source: fs.readFileSync(path.join(BENCHMARK_ROOT, fixture.file), 'utf8'),
      },
    ]),
  );

  describe(`V2 structural conformance: ${suite.id}`, () => {
    for (const scenario of suite.scenarios) {
      if (scenario.mode === 'capability') {
        const category = scenario.category ? ` [${scenario.category}]` : '';
        if (scenario.category === 'parser-compatibility') {
          it(`${scenario.id}${category}: ${scenario.intent}`, async () => {
            const fixture = fixtures.get(scenario.fixture);
            if (!fixture) throw new Error(`Unknown fixture: ${scenario.fixture}`);
            if (!scenario.expectedOutcome) {
              throw new Error(`${scenario.id} must declare expectedOutcome`);
            }

            await expect(
              syntaxValidator({
                source: fixture.source,
                filePath: fixture.file,
                extension: path.extname(fixture.file).toLowerCase(),
              }),
            ).rejects.toThrow(scenario.expectedOutcome);
          });
        } else {
          it.todo(`${scenario.id}${category}: ${scenario.intent}`);
        }
        continue;
      }

      it(`${scenario.id}: ${scenario.intent}`, async () => {
        const fixture = fixtures.get(scenario.fixture);
        if (!fixture) throw new Error(`Unknown fixture: ${scenario.fixture}`);

        const selector = parseSelector(scenario.selector!, scenario.startsWith);
        const resolution = resolver({
          source: fixture.source,
          filePath: fixture.file,
          selector,
        });

        if (scenario.expectedError) {
          await expect(resolution).rejects.toThrow(scenario.expectedError);
          return;
        }

        const match = await resolution;
        const assertions = scenario.assertions!;
        const target = fixture.source.slice(match.start, match.end);

        expect(match.kind).toBe(assertions.kind);
        if (assertions.name) expect(match.name).toBe(assertions.name);
        if (!assertions.rangeAnchor || !assertions.rangeEndAnchor) {
          throw new Error(`${scenario.id} must declare both rangeAnchor and rangeEndAnchor`);
        }
        expect(match.start).toBe(fixture.source.indexOf(assertions.rangeAnchor));
        expect(match.end).toBe(fixture.source.indexOf(assertions.rangeEndAnchor));
        for (const expectedText of assertions.contains ?? []) {
          expect(target).toContain(expectedText);
        }
        for (const excludedText of assertions.excludes ?? []) {
          expect(target).not.toContain(excludedText);
        }

        if (assertions.replacement) {
          const execution = await resolveOperation(
            {
              strategy: 'replace_node',
              filePath: fixture.file,
              content: assertions.replacement.content,
              selector,
            },
            new Map([[fixture.file, { content: fixture.source, exists: true }]]),
            { structuralResolver: resolver, syntaxValidator },
          );

          expect(execution.targetScope.beforeRange).toEqual({ start: match.start, end: match.end });
          expect(execution.afterContent).toBe(
            fixture.source.slice(0, match.start) + execution.normalizedPayload.content + fixture.source.slice(match.end),
          );

          if (assertions.neighbors) {
            assertNeighborSentinels(fixture.source, execution.afterContent, match, assertions.neighbors);
          }

          expect(assertions.replacement.validSyntax).toBe(true);
        }
      });
    }
  });
}

interface BenchmarkManifest {
  suites: BenchmarkSuite[];
}

interface BenchmarkSuite {
  id: string;
  language: string;
  fixtures: BenchmarkFixture[];
  scenarios: BenchmarkScenario[];
}

interface BenchmarkFixture {
  id: string;
  file: string;
}

interface BenchmarkScenario {
  id: string;
  mode: 'selector' | 'capability';
  fixture: string;
  intent: string;
  selector?: string;
  startsWith?: string;
  expectedError?: string;
  category?: 'parser-compatibility' | 'structural-capability';
  expectedOutcome?: string;
  assertions?: BenchmarkAssertions;
}

interface BenchmarkAssertions {
  kind: string;
  name?: string;
  rangeAnchor?: string;
  rangeEndAnchor?: string;
  contains?: string[];
  excludes?: string[];
  neighbors?: {
    before: string[];
    after: string[];
  };
  replacement?: {
    content: string;
    validSyntax: boolean;
  };
}

function assertNeighborSentinels(
  before: string,
  after: string,
  match: { start: number; end: number },
  neighbors: { before: string[]; after: string[] },
): void {
  for (const sentinel of neighbors.before) {
    const position = before.indexOf(sentinel);
    expect(position, `before-neighbor sentinel is present: ${sentinel}`).toBeGreaterThanOrEqual(0);
    expect(position, `before-neighbor sentinel is outside the target: ${sentinel}`).toBeLessThan(match.start);
    expect(countOccurrences(after, sentinel), `before-neighbor sentinel count: ${sentinel}`).toBe(
      countOccurrences(before, sentinel),
    );
  }
  for (const sentinel of neighbors.after) {
    const position = before.indexOf(sentinel);
    expect(position, `after-neighbor sentinel is present: ${sentinel}`).toBeGreaterThanOrEqual(0);
    expect(position, `after-neighbor sentinel is outside the target: ${sentinel}`).toBeGreaterThanOrEqual(match.end);
    expect(countOccurrences(after, sentinel), `after-neighbor sentinel count: ${sentinel}`).toBe(
      countOccurrences(before, sentinel),
    );
  }
}

function countOccurrences(source: string, needle: string): number {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = source.indexOf(needle, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + needle.length;
  }
}
