import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyChanges, validateBlocks } from '../src';
import type { ApplyPlan, HistoryEntry, ParsedBlock } from '@inscribe/shared';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const buildRestoreBlock = (entry: HistoryEntry): ParsedBlock => ({
  file: entry.restoreOperation.file,
  mode: entry.restoreOperation.type,
  directives: entry.restoreOperation.directives ?? {},
  content: entry.restoreOperation.content,
  blockIndex: entry.blockIndex ?? 0,
});

const restoreFromHistory = (entries: HistoryEntry[], repoRoot: string, label = 'restore') => {
  for (const entry of entries) {
    const restoreBlock = buildRestoreBlock(entry);
    const validationErrors = validateBlocks([restoreBlock], repoRoot);
    expect(validationErrors, `${label}: ${validationErrors.map((error) => error.message).join('; ')}`).toHaveLength(0);
    const result = applyChanges({ operations: [entry.restoreOperation] }, repoRoot);
    expect(result.success, (result.errors ?? []).join('; ')).toBe(true);
  }
};

const runUndoRedoCycle = (
  plan: ApplyPlan,
  repoRoot: string,
  assertApplied: () => void,
  assertRestored: () => void,
  label = 'cycle'
) => {
  const applyResult = applyChanges(plan, repoRoot);
  expect(applyResult.success).toBe(true);
  expect(applyResult.historyEntries?.length).toBeGreaterThan(0);
  assertApplied();
  restoreFromHistory(applyResult.historyEntries ?? [], repoRoot, label);
  assertRestored();

  const redoResult = applyChanges(plan, repoRoot);
  expect(redoResult.success).toBe(true);
  expect(redoResult.historyEntries?.length).toBeGreaterThan(0);
  assertApplied();
  restoreFromHistory(redoResult.historyEntries ?? [], repoRoot, label);
  assertRestored();
};

describe('Smart Restore apply/undo/redo cycles', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-restore-test-'));
    fs.mkdirSync(path.join(tempDir, 'app'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('cycles create operations safely', () => {
    const plan: ApplyPlan = {
      operations: [
        {
          type: 'create',
          file: 'app/new.txt',
          content: 'hello',
        },
      ],
    };

    const filePath = path.join(tempDir, 'app', 'new.txt');

    runUndoRedoCycle(
      plan,
      tempDir,
      () => {
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf-8')).toBe('hello');
      },
      () => {
        expect(fs.existsSync(filePath)).toBe(false);
      }
    );
  });

  it('cycles replace operations safely', () => {
    const filePath = path.join(tempDir, 'app', 'replace.txt');
    fs.writeFileSync(filePath, 'old');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'replace',
          file: 'app/replace.txt',
          content: 'new',
        },
      ],
    };

    runUndoRedoCycle(
      plan,
      tempDir,
      () => expect(fs.readFileSync(filePath, 'utf-8')).toBe('new'),
      () => expect(fs.readFileSync(filePath, 'utf-8')).toBe('old')
    );
  });

  it('cycles append operations safely', () => {
    const filePath = path.join(tempDir, 'app', 'append.txt');
    fs.writeFileSync(filePath, 'base');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'append',
          file: 'app/append.txt',
          content: '\nmore',
        },
      ],
    };

    runUndoRedoCycle(
      plan,
      tempDir,
      () => expect(fs.readFileSync(filePath, 'utf-8')).toBe('base\nmore'),
      () => expect(fs.readFileSync(filePath, 'utf-8')).toBe('base')
    );
  });

  it('cycles delete operations safely', () => {
    const filePath = path.join(tempDir, 'app', 'delete.txt');
    fs.writeFileSync(filePath, 'to-delete');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'delete',
          file: 'app/delete.txt',
          content: '',
        },
      ],
    };

    runUndoRedoCycle(
      plan,
      tempDir,
      () => expect(fs.existsSync(filePath)).toBe(false),
      () => {
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf-8')).toBe('to-delete');
      }
    );
  });

  it('cycles range operations across anchor variants', () => {
    const scenarios = [
      {
        name: 'START_AFTER + END_BEFORE',
        file: 'app/range-basic.txt',
        original: 'alpha\n// start\nold\n// end\nomega\n',
        content: 'new\n',
        directives: { START_AFTER: '// start', END_BEFORE: '// end' },
        applied: 'alpha\n// start\nnew\n// end\nomega\n',
      },
      {
        name: 'START + END',
        file: 'app/range-inclusive.txt',
        original: 'before\n// start\nold\n// end\nafter\n',
        content: 'new\n',
        directives: { START: '// start', END: '// end' },
        applied: 'before\nnew\nafter\n',
      },
      {
        name: 'START_BEFORE + END_AFTER',
        file: 'app/range-before-after.txt',
        original: 'alpha\nSTART_MARK\nold\nEND_MARK\nomega\n',
        content: 'new\n',
        directives: { START_BEFORE: 'START_MARK', END_AFTER: 'END_MARK' },
        applied: 'new\n',
      },
      {
        name: 'START only (single-line replace)',
        file: 'app/range-start-only.txt',
        original: 'line one\nline two\nline three\n',
        content: 'inserted\n',
        directives: { START: 'line two' },
        applied: 'line one\ninserted\nline three\n',
      },
      {
        name: 'Brace END anchor',
        file: 'app/range-brace.txt',
        original: 'function demo() {\n  // start\n  const value = {\n    old: true\n  };\n  keep();\n}\n',
        content: '  const value = {\n    updated: true\n  };\n',
        directives: { START_AFTER: '// start', END: '}' },
        applied: 'function demo() {\n  // start\n  const value = {\n    updated: true\n  };\n  keep();\n}\n',
      },
      {
        name: 'Scoped anchors',
        file: 'app/range-scope.txt',
        original: 'scope start\nsection\n// start\nold\n// end\nsection end\nscope end\n',
        content: 'new\n',
        directives: {
          START_AFTER: '// start',
          END_BEFORE: '// end',
          SCOPE_START: 'scope start',
          SCOPE_END: 'scope end',
        },
        applied: 'scope start\nsection\n// start\nnew\n// end\nsection end\nscope end\n',
      },
    ];

    for (const scenario of scenarios) {
      const filePath = path.join(tempDir, scenario.file);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, scenario.original);

      const plan: ApplyPlan = {
        operations: [
          {
            type: 'range',
            file: scenario.file,
            content: scenario.content,
            directives: scenario.directives,
          },
        ],
      };

      runUndoRedoCycle(
        plan,
        tempDir,
        () => expect(fs.readFileSync(filePath, 'utf-8')).toBe(scenario.applied),
        () => expect(fs.readFileSync(filePath, 'utf-8')).toBe(scenario.original),
        scenario.name
      );
    }
  });

  it('cycles mixed-mode grouped operations safely', () => {
    fs.writeFileSync(path.join(tempDir, 'app', 'replace.txt'), 'old');
    fs.writeFileSync(path.join(tempDir, 'app', 'append.txt'), 'base');
    fs.writeFileSync(path.join(tempDir, 'app', 'delete.txt'), 'remove');
    fs.writeFileSync(
      path.join(tempDir, 'app', 'range.txt'),
      'alpha\n// start\nold\n// end\nomega\n'
    );

    const plan: ApplyPlan = {
      operations: [
        { type: 'create', file: 'app/create.txt', content: 'created' },
        { type: 'replace', file: 'app/replace.txt', content: 'new' },
        { type: 'append', file: 'app/append.txt', content: '\nextra' },
        {
          type: 'range',
          file: 'app/range.txt',
          content: 'new\n',
          directives: { START_AFTER: '// start', END_BEFORE: '// end' },
        },
        { type: 'delete', file: 'app/delete.txt', content: '' },
      ],
    };

    const assertApplied = () => {
      expect(fs.readFileSync(path.join(tempDir, 'app', 'create.txt'), 'utf-8')).toBe('created');
      expect(fs.readFileSync(path.join(tempDir, 'app', 'replace.txt'), 'utf-8')).toBe('new');
      expect(fs.readFileSync(path.join(tempDir, 'app', 'append.txt'), 'utf-8')).toBe('base\nextra');
      expect(fs.readFileSync(path.join(tempDir, 'app', 'range.txt'), 'utf-8')).toBe(
        'alpha\n// start\nnew\n// end\nomega\n'
      );
      expect(fs.existsSync(path.join(tempDir, 'app', 'delete.txt'))).toBe(false);
    };

    const assertRestored = () => {
      expect(fs.existsSync(path.join(tempDir, 'app', 'create.txt'))).toBe(false);
      expect(fs.readFileSync(path.join(tempDir, 'app', 'replace.txt'), 'utf-8')).toBe('old');
      expect(fs.readFileSync(path.join(tempDir, 'app', 'append.txt'), 'utf-8')).toBe('base');
      expect(fs.readFileSync(path.join(tempDir, 'app', 'range.txt'), 'utf-8')).toBe(
        'alpha\n// start\nold\n// end\nomega\n'
      );
      expect(fs.existsSync(path.join(tempDir, 'app', 'delete.txt'))).toBe(true);
    };

    runUndoRedoCycle(plan, tempDir, assertApplied, assertRestored);
  });


  it('restores range changes with duplicate anchors using content identity', () => {
    const filePath = path.join(tempDir, 'app', 'dup-anchor.txt');
    fs.writeFileSync(
      filePath,
      [
        'function one() {',
        '  // start',
        '  const value = 1;',
        '  // end',
        '}',
        '',
        'function two() {',
        '  // start',
        '  const value = 2;',
        '  // end',
        '}',
        '',
      ].join('\n')
    );

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/dup-anchor.txt',
          content: '  const value = 42;\n',
          directives: {
            START_AFTER: 'function two() {',
            END_BEFORE: '  // end',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);
    expect(result.success, (result.errors ?? []).join('; ')).toBe(true);

    const applied = fs.readFileSync(filePath, 'utf-8');
    expect(applied).toContain('const value = 42;');

    const entry = result.historyEntries?.[0];
    expect(entry).toBeTruthy();
    if (!entry) return;

    fs.writeFileSync(filePath, applied.replace('function two() {', 'function twoRenamed() {'));

    const restoreBlock = buildRestoreBlock(entry);
    const validationErrors = validateBlocks([restoreBlock], tempDir);
    expect(validationErrors).toHaveLength(0);

    const restoreResult = applyChanges({ operations: [entry.restoreOperation] }, tempDir);
    expect(restoreResult.success).toBe(true);

    const restored = fs.readFileSync(filePath, 'utf-8');
    expect(restored).toContain('const value = 2;');
    expect(restored).not.toContain('const value = 42;');
  });

  it('refuses restore when content changed after apply', () => {
    const filePath = path.join(tempDir, 'app', 'replace.txt');
    fs.writeFileSync(filePath, 'old');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'replace',
          file: 'app/replace.txt',
          content: 'new',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);
    expect(result.success, (result.errors ?? []).join('; ')).toBe(true);
    fs.writeFileSync(filePath, 'user edit');

    const entry = result.historyEntries?.[0];
    expect(entry).toBeTruthy();
    if (!entry) return;

    const restoreBlock = buildRestoreBlock(entry);
    const validationErrors = validateBlocks([restoreBlock], tempDir);
    expect(validationErrors.length).toBeGreaterThan(0);
    expect(validationErrors[0].message).toContain('Unsafe to restore');
  });
});
