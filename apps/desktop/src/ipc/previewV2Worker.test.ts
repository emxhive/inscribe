import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runPreviewV2Worker as realRunPreviewV2Worker } from './previewV2Worker';
import { getTreeSitterAssetPaths } from './treeSitterAssets';
import { ApplyV2SessionStore, canonicalizeRepoRoot } from './applyV2SessionStore';


describe('runPreviewV2Worker Integration Tests', () => {
  let tempDir: string;
  let repoRoot: string;
  let testSessionStore: ApplyV2SessionStore;
  const assets = getTreeSitterAssetPaths();

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-worker-test-'));
    repoRoot = path.join(tempDir, 'repo');
    fs.mkdirSync(repoRoot);
    testSessionStore = new ApplyV2SessionStore();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  async function runPreviewV2Worker(payload: any, store: ApplyV2SessionStore = testSessionStore) {
    return realRunPreviewV2Worker(payload, store);
  }


  it('preview create_file', async () => {
    const payload = {
      rawInput: `<<<INSCRIBE
FILE: newfile.txt
MODE: create_file
<<<CONTENT
Created content
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.executions.length).toBe(1);
      expect(response.executions[0].strategy).toBe('create_file');
      expect(response.executions[0].afterContent).toBe('Created content');
      expect(response.executions[0].beforeExists).toBe(false);
      expect(response.executions[0].afterExists).toBe(true);
    }
    // Assertion proving target file does not exist on disk after preview
    expect(fs.existsSync(path.join(repoRoot, 'newfile.txt'))).toBe(false);
  });

  it('preview replace_file', async () => {
    fs.writeFileSync(path.join(repoRoot, 'existing.txt'), 'old text');

    const payload = {
      rawInput: `<<<INSCRIBE
FILE: existing.txt
MODE: replace_file
<<<CONTENT
new text
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.executions.length).toBe(1);
      expect(response.executions[0].strategy).toBe('replace_file');
      expect(response.executions[0].beforeContent).toBe('old text');
      expect(response.executions[0].afterContent).toBe('new text');
    }
    // Assertion proving original file content remains unchanged on disk
    expect(fs.readFileSync(path.join(repoRoot, 'existing.txt'), 'utf8')).toBe('old text');
  });

  it('preview delete_file', async () => {
    fs.writeFileSync(path.join(repoRoot, 'delete-me.txt'), 'content');

    const payload = {
      rawInput: `<<<INSCRIBE
FILE: delete-me.txt
MODE: delete_file
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.executions.length).toBe(1);
      expect(response.executions[0].strategy).toBe('delete_file');
      expect(response.executions[0].afterExists).toBe(false);
    }
    // Assertion proving original file still exists with original content
    expect(fs.readFileSync(path.join(repoRoot, 'delete-me.txt'), 'utf8')).toBe('content');
  });

  it('preview replace_text', async () => {
    fs.writeFileSync(path.join(repoRoot, 'text.txt'), 'line 1\nline 2\nline 3');

    const payload = {
      rawInput: `<<<INSCRIBE
FILE: text.txt
MODE: replace_text
<<<SEARCH
line 2
SEARCH>>>
<<<CONTENT
modified line 2
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.executions.length).toBe(1);
      expect(response.executions[0].afterContent).toBe('line 1\nmodified line 2\nline 3');
    }
    // Assertion proving original file content remains unchanged on disk
    expect(fs.readFileSync(path.join(repoRoot, 'text.txt'), 'utf8')).toBe('line 1\nline 2\nline 3');
  });

  it('preview replace_node in .ts', async () => {
    const originalCode = `class MyClass {\n  save() {\n    const a = 1;\n  }\n}`;
    fs.writeFileSync(path.join(repoRoot, 'code.ts'), originalCode);

    const payload = {
      rawInput: `<<<INSCRIBE
FILE: code.ts
MODE: replace_node
SELECTOR: class:MyClass > method:save
<<<CONTENT
  save() {
    const a = 2;
  }
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.executions.length).toBe(1);
      expect(response.executions[0].afterContent).toContain('const a = 2;');
    }
    // Assertion proving original file content remains unchanged on disk
    expect(fs.readFileSync(path.join(repoRoot, 'code.ts'), 'utf8')).toBe(originalCode);
  });

  it('preview replace_node in .tsx', async () => {
    const originalCode = `function App() {\n  return <div>Hello</div>;\n}`;
    fs.writeFileSync(path.join(repoRoot, 'component.tsx'), originalCode);

    const payload = {
      rawInput: `<<<INSCRIBE
FILE: component.tsx
MODE: replace_node
SELECTOR: function:App
<<<CONTENT
function App() {
  return <span>Hello</span>;
}
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.executions.length).toBe(1);
      expect(response.executions[0].afterContent).toContain('<span>Hello</span>');
    }
    // Assertion proving original file content remains unchanged on disk
    expect(fs.readFileSync(path.join(repoRoot, 'component.tsx'), 'utf8')).toBe(originalCode);
  });

  it('sequential combinations: create_file -> replace_text', async () => {
    const payload = {
      rawInput: `<<<INSCRIBE
FILE: sequence.txt
MODE: create_file
<<<CONTENT
original content
CONTENT>>>
INSCRIBE>>>
<<<INSCRIBE
FILE: sequence.txt
MODE: replace_text
<<<SEARCH
original
SEARCH>>>
<<<CONTENT
updated
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.executions.length).toBe(2);
      expect(response.executions[1].afterContent).toBe('updated content');
    }
  });

  it('sequential combinations: replace_text -> replace_node', async () => {
    fs.writeFileSync(
      path.join(repoRoot, 'seq.ts'),
      `function calc() { return 1; }`
    );

    const payload = {
      rawInput: `<<<INSCRIBE
FILE: seq.ts
MODE: replace_text
<<<SEARCH
return 1;
SEARCH>>>
<<<CONTENT
return 2;
CONTENT>>>
INSCRIBE>>>
<<<INSCRIBE
FILE: seq.ts
MODE: replace_node
SELECTOR: function:calc
<<<CONTENT
function calc() {
  return 3;
}
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.executions.length).toBe(2);
      expect(response.executions[1].afterContent).toContain('return 3;');
    }
  });

  it('sequential combinations: replace_node -> replace_node', async () => {
    fs.writeFileSync(
      path.join(repoRoot, 'seq.ts'),
      `class Test {\n  foo() {}\n  bar() {}\n}`
    );

    const payload = {
      rawInput: `<<<INSCRIBE
FILE: seq.ts
MODE: replace_node
SELECTOR: class:Test > method:foo
<<<CONTENT
  foo() {
    return 'foo';
  }
CONTENT>>>
INSCRIBE>>>
<<<INSCRIBE
FILE: seq.ts
MODE: replace_node
SELECTOR: class:Test > method:bar
<<<CONTENT
  bar() {
    return 'bar';
  }
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.executions.length).toBe(2);
      expect(response.executions[1].afterContent).toContain("return 'foo';");
      expect(response.executions[1].afterContent).toContain("return 'bar';");
    }
  });

  it('returns a partial session for valid-invalid-valid V2 input', async () => {
    const payload = {
      rawInput: `<<<INSCRIBE
FILE: first.txt
MODE: create_file
<<<CONTENT
first
CONTENT>>>
INSCRIBE>>>
<<<INSCRIBE
FILE: broken.txt
MODE: unsupported
INSCRIBE>>>
<<<INSCRIBE
FILE: last.txt
MODE: create_file
<<<CONTENT
last
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.partial).toBe(true);
      expect(response.executions.map((execution) => execution.blockIndex)).toEqual([0, 2]);
      expect(response.errors).toMatchObject([
        { type: 'protocol', code: 'INVALID_MODE', blockIndex: 1 },
      ]);
      expect(response.previewToken).toBeDefined();
      const session = testSessionStore.consumeSession(response.previewToken, repoRoot);
      expect(session.executions.map((execution) => execution.blockIndex)).toEqual([0, 2]);
    }
  });

  it('excludes downstream same-file operations while preserving source attribution and independent work', async () => {
    fs.writeFileSync(path.join(repoRoot, 'a.txt'), 'original');

    const payload = {
      rawInput: `<<<INSCRIBE
FILE: malformed.txt
MODE: unsupported
INSCRIBE>>>
<<<INSCRIBE
FILE: a.txt
MODE: replace_text
<<<SEARCH
missing
SEARCH>>>
<<<CONTENT
failed
CONTENT>>>
INSCRIBE>>>
<<<INSCRIBE
FILE: a.txt
MODE: replace_file
<<<CONTENT
excluded
CONTENT>>>
INSCRIBE>>>
<<<INSCRIBE
FILE: a.txt
MODE: delete_file
INSCRIBE>>>
<<<INSCRIBE
FILE: b.txt
MODE: create_file
<<<CONTENT
independent
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.executions.map((execution) => execution.blockIndex)).toEqual([4]);
      expect(response.executions[0].operationIndex).toBe(3);
      expect(response.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'TARGET_NOT_FOUND',
          operationIndex: 0,
          blockIndex: 1,
          lineKind: 'block',
        }),
        expect.objectContaining({
          code: 'DEPENDENCY_BLOCKED',
          operationIndex: 1,
          blockIndex: 2,
          blockedByOperationIndex: 0,
          blockedByBlockIndex: 1,
          lineKind: 'uncertain',
        }),
        expect.objectContaining({
          code: 'DEPENDENCY_BLOCKED',
          operationIndex: 2,
          blockIndex: 3,
          blockedByOperationIndex: 0,
          blockedByBlockIndex: 1,
        }),
      ]));

      expect(response.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'protocol', code: 'INVALID_MODE', blockIndex: 0 }),
      ]));

      const session = testSessionStore.consumeSession(response.previewToken, repoRoot);
      expect(session.executions.map((execution) => execution.blockIndex)).toEqual([4]);
    }
  });

  it('protocol-invalid same-file blocks taint later operations without suppressing independent work', async () => {
    fs.writeFileSync(path.join(repoRoot, 'a.txt'), 'original');

    const blockOpen = '<<<' + 'INSCRIBE';
    const blockClose = 'INSCRIBE' + '>>>';
    const contentOpen = '<<<' + 'CONTENT';
    const contentClose = 'CONTENT' + '>>>';
    const searchOpen = '<<<' + 'SEARCH';
    const searchClose = 'SEARCH' + '>>>';

    const payload = {
      rawInput: `${blockOpen}
FILE: a.txt
MODE: replace_file
${contentOpen}
first
${contentClose}
${blockClose}
${blockOpen}
FILE: a.txt
MODE: unsupported
${blockClose}
${blockOpen}
FILE: a.txt
MODE: replace_file
${contentOpen}
best-effort
${contentClose}
${blockClose}
${blockOpen}
FILE: a.txt
MODE: replace_text
${searchOpen}
best-effort
${searchClose}
${contentOpen}
later
${contentClose}
${blockClose}
${blockOpen}
FILE: b.txt
MODE: create_file
${contentOpen}
independent
${contentClose}
${blockClose}`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.executions.map((execution) => execution.blockIndex)).toEqual([0, 4]);
      expect(response.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'protocol',
          code: 'INVALID_MODE',
          blockIndex: 1,
        }),
        expect.objectContaining({
          type: 'resolution',
          code: 'DEPENDENCY_BLOCKED',
          blockIndex: 2,
          blockedByBlockIndex: 1,
          lineKind: 'uncertain',
        }),
        expect.objectContaining({
          type: 'resolution',
          code: 'DEPENDENCY_BLOCKED',
          blockIndex: 3,
          blockedByBlockIndex: 1,
          lineKind: 'uncertain',
        }),
      ]));

      const session = testSessionStore.consumeSession(response.previewToken, repoRoot);
      expect(session.executions.map((execution) => execution.blockIndex)).toEqual([0, 4]);
    }
  });

  it('keeps previewing other files when one workspace target cannot be loaded', async () => {
    fs.mkdirSync(path.join(repoRoot, 'not-a-file'));
    const payload = {
      rawInput: `<<<INSCRIBE
FILE: not-a-file
MODE: delete_file
INSCRIBE>>>
<<<INSCRIBE
FILE: valid.txt
MODE: create_file
<<<CONTENT
valid
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.partial).toBe(true);
      expect(response.executions).toMatchObject([{ blockIndex: 1, filePath: 'valid.txt' }]);
      expect(response.errors).toMatchObject([{
        type: 'workspace',
        code: 'DIRECTORY_PASSED_AS_FILE',
        blockIndex: 0,
        filePath: 'not-a-file',
      }]);
    }
  });

  it('protocol error serialized', async () => {
    const payload = {
      rawInput: `<<<INSCRIBE
INVALID_MODE: abc
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.errors[0].type).toBe('protocol');
    }
  });

  it('target ambiguity serialized', async () => {
    fs.writeFileSync(
      path.join(repoRoot, 'code.ts'),
      `function a() {}\nfunction a() {}`
    );

    const payload = {
      rawInput: `<<<INSCRIBE
FILE: code.ts
MODE: replace_node
SELECTOR: function:a
<<<CONTENT
function a() { return 1; }
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.errors[0].type).toBe('resolution');
      expect(response.errors[0].code).toBe('TARGET_AMBIGUOUS');
    }
  });

  it('target not found serialized', async () => {
    fs.writeFileSync(path.join(repoRoot, 'code.ts'), `function a() {}`);

    const payload = {
      rawInput: `<<<INSCRIBE
FILE: code.ts
MODE: replace_node
SELECTOR: function:b
<<<CONTENT
function b() {}
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.errors[0].type).toBe('resolution');
      expect(response.errors[0].code).toBe('TARGET_NOT_FOUND');
    }
  });

  it('malformed TypeScript serialized', async () => {
    fs.writeFileSync(path.join(repoRoot, 'code.ts'), `class A {`);

    const payload = {
      rawInput: `<<<INSCRIBE
FILE: code.ts
MODE: replace_node
SELECTOR: class:A
<<<CONTENT
class A {}
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.errors[0].type).toBe('resolution');
      expect(response.errors[0].code).toBe('PARSER_DIAGNOSTICS_PRESENT');
    }
  });

  it('missing WASM serialized', async () => {
    fs.writeFileSync(path.join(repoRoot, 'code.ts'), `class A {}`);

    const payload = {
      rawInput: `<<<INSCRIBE
FILE: code.ts
MODE: replace_node
SELECTOR: class:A
<<<CONTENT
class A {}
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: {
        coreWasmPath: assets.coreWasmPath,
        typescriptWasmPath: '/missing/ts.wasm',
        tsxWasmPath: '/missing/tsx.wasm',
      },
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.errors[0].type).toBe('resolution');
      expect(response.errors[0].code).toBe('MISSING_WASM_ASSET');
    }
  });

  it('resolution error retains its source blockIndex', async () => {
    const payload = {
      rawInput: `<<<INSCRIBE
FILE: missing.ts
MODE: replace_file
<<<CONTENT
content
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };

    const response = await runPreviewV2Worker(payload);
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.errors[0].blockIndex).toBe(0);
      expect(response.errors[0].operationIndex).toBe(0);
    }
  });

  it('failed orchestrator preview followed by valid orchestrator preview', async () => {
    // 1. Failed run
    const payloadFail = {
      rawInput: `<<<INSCRIBE
FILE: missing.ts
MODE: replace_file
<<<CONTENT
content
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };
    const responseFail = await runPreviewV2Worker(payloadFail);
    expect(responseFail.ok).toBe(false);

    // 2. Valid run
    const payloadOk = {
      rawInput: `<<<INSCRIBE
FILE: file.txt
MODE: create_file
<<<CONTENT
content
CONTENT>>>
INSCRIBE>>>`,
      trustedRepoRoot: repoRoot,
      assetPaths: assets,
    };
    const responseOk = await runPreviewV2Worker(payloadOk);
    expect(responseOk.ok).toBe(true);
  });

  describe('Worker Payload Runtime Verification', () => {
    it('returns INVALID_WORKER_PAYLOAD if payload is null or undefined', async () => {
      const responseNull = await runPreviewV2Worker(null as any);
      expect(responseNull.ok).toBe(false);
      if (!responseNull.ok) {
        expect(responseNull.errors[0].code).toBe('INVALID_WORKER_PAYLOAD');
      }

      const responseUndefined = await runPreviewV2Worker(undefined as any);
      expect(responseUndefined.ok).toBe(false);
      if (!responseUndefined.ok) {
        expect(responseUndefined.errors[0].code).toBe('INVALID_WORKER_PAYLOAD');
      }
    });

    it('returns INVALID_WORKER_PAYLOAD if rawInput is missing or not a string', async () => {
      const payloadMissingInput = {
        trustedRepoRoot: repoRoot,
        assetPaths: assets,
      } as any;

      const response = await runPreviewV2Worker(payloadMissingInput);
      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.errors[0].code).toBe('INVALID_WORKER_PAYLOAD');
      }
    });

    it('returns INVALID_WORKER_PAYLOAD if assetPaths is malformed or properties are missing', async () => {
      const payloadMalformedAssets = {
        rawInput: '<<<INSCRIBE\nFILE: file.txt\nMODE: create_file\n<<<CONTENT\ncontent\nCONTENT>>>\nINSCRIBE>>>',
        trustedRepoRoot: repoRoot,
        assetPaths: {
          coreWasmPath: 123, // not a string
          typescriptWasmPath: '',
          tsxWasmPath: '',
        },
      } as any;

      const response = await runPreviewV2Worker(payloadMalformedAssets);
      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.errors[0].code).toBe('INVALID_WORKER_PAYLOAD');
      }
    });
  });

  describe('Preview Session Issuance', () => {
    it('preview_v2 success returns previewToken and expiresAt', async () => {
      const store = new ApplyV2SessionStore();
      const payload = {
        rawInput: `<<<INSCRIBE
FILE: newfile.txt
MODE: create_file
<<<CONTENT
Created content
CONTENT>>>
INSCRIBE>>>`,
        trustedRepoRoot: repoRoot,
        assetPaths: assets,
      };

      const response = await runPreviewV2Worker(payload, store);
      expect(response.ok).toBe(true);
      if (response.ok) {
        expect(response.previewToken).toBeDefined();
        expect(response.previewToken).toHaveLength(64);
        expect(response.expiresAt).toBeDefined();

        // Verify it was saved in the store
        const session = store.consumeSession(response.previewToken, repoRoot);
        expect(session.canonicalRepoRoot).toBe(canonicalizeRepoRoot(repoRoot));
        expect(session.executions).toHaveLength(1);
      }
    });



    it('preview_v2 failure creates no session', async () => {
      const store = new ApplyV2SessionStore();
      const payload = {
        rawInput: `<<<INSCRIBE
INVALID_MODE: abc
INSCRIBE>>>`,
        trustedRepoRoot: repoRoot,
        assetPaths: assets,
      };

      const response = await runPreviewV2Worker(payload, store);
      expect(response.ok).toBe(false);
      expect(store.getStoreSize()).toBe(0);
    });

    it('preview remains disk-write-free', async () => {
      const store = new ApplyV2SessionStore();
      const targetFile = path.join(repoRoot, 'newfile.txt');
      const payload = {
        rawInput: `<<<INSCRIBE
FILE: newfile.txt
MODE: create_file
<<<CONTENT
Created content
CONTENT>>>
INSCRIBE>>>`,
        trustedRepoRoot: repoRoot,
        assetPaths: assets,
      };

      const response = await runPreviewV2Worker(payload, store);
      expect(response.ok).toBe(true);
      expect(fs.existsSync(targetFile)).toBe(false);
    });
  });
});
