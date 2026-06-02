import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getAppliedAiInputRecord,
  hashAppliedAiInput,
  recordAppliedAiInput,
} from '../src/repo/appliedInputStore';

let workspaceRoot = '';
let repoRoot = '';
let otherRepoRoot = '';

beforeEach(() => {
  workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-applied-input-'));
  repoRoot = path.join(workspaceRoot, 'repo');
  otherRepoRoot = path.join(workspaceRoot, 'other-repo');
  fs.mkdirSync(repoRoot, { recursive: true });
  fs.mkdirSync(otherRepoRoot, { recursive: true });
  process.env.INSCRIBE_USER_DATA = path.join(workspaceRoot, 'user-data');
});

afterEach(() => {
  delete process.env.INSCRIBE_USER_DATA;
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

describe('appliedInputStore', () => {
  it('matches previously applied raw AI input after conservative normalization', () => {
    const first = recordAppliedAiInput(repoRoot, 'hello\r\nworld\n', {
      appliedAt: '2026-06-02T06:00:00.000Z',
      appliedBlockCount: 2,
      applyId: 'apply-1',
    });

    expect(first).toMatchObject({
      inputHash: hashAppliedAiInput('hello\nworld'),
      firstAppliedAt: '2026-06-02T06:00:00.000Z',
      lastAppliedAt: '2026-06-02T06:00:00.000Z',
      timesApplied: 1,
      appliedBlockCount: 2,
      lastApplyId: 'apply-1',
    });

    expect(getAppliedAiInputRecord(repoRoot, ' hello\nworld ')).toEqual(first);
  });

  it('keeps applied input records scoped to a repository', () => {
    recordAppliedAiInput(repoRoot, 'same input', {
      appliedAt: '2026-06-02T06:00:00.000Z',
      appliedBlockCount: 1,
    });

    expect(getAppliedAiInputRecord(otherRepoRoot, 'same input')).toBeNull();
  });

  it('updates repeat apply metadata without changing firstAppliedAt', () => {
    recordAppliedAiInput(repoRoot, 'repeat input', {
      appliedAt: '2026-06-02T06:00:00.000Z',
      appliedBlockCount: 1,
      applyId: 'apply-1',
    });

    const second = recordAppliedAiInput(repoRoot, 'repeat input', {
      appliedAt: '2026-06-02T07:00:00.000Z',
      appliedBlockCount: 3,
      applyId: 'apply-2',
    });

    expect(second).toMatchObject({
      firstAppliedAt: '2026-06-02T06:00:00.000Z',
      lastAppliedAt: '2026-06-02T07:00:00.000Z',
      timesApplied: 2,
      appliedBlockCount: 3,
      lastApplyId: 'apply-2',
    });
  });
});
