import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPreparedFileMutations, PreparedFileMutation } from './applyPreparedFileMutations';
import { restoreEntry } from '../history/restoreEntry';
import * as writeExecutionsModule from './writeExecutions';
import * as historyStoreModule from '../repo/historyStore';

let mockStatFail = false;
let mockReadFail = false;

vi.mock('fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('fs')>();
  return {
    ...original,
    statSync: (p: any, options: any) => {
      if (mockStatFail && typeof p === 'string' && p.includes('stat-fail')) {
        throw new Error('Mock statSync failure');
      }
      return original.statSync(p, options);
    },
    readFileSync: (p: any, options: any) => {
      if (mockReadFail && typeof p === 'string' && p.includes('read-fail')) {
        throw new Error('Mock readFileSync failure');
      }
      return original.readFileSync(p, options);
    },
  };
});

vi.mock('./writeExecutions', async (importOriginal) => {
  const original = await importOriginal<typeof import('./writeExecutions')>();
  return {
    ...original,
    writeExecutions: vi.fn(original.writeExecutions),
    rollbackExecutions: vi.fn(original.rollbackExecutions),
  };
});

vi.mock('../repo/historyStore', async (importOriginal) => {
  const original = await importOriginal<typeof import('../repo/historyStore')>();
  return {
    ...original,
    appendHistoryEntries: vi.fn(original.appendHistoryEntries),
  };
});

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

describe('applyPreparedFileMutations', () => {
  let tempDir = '';
  let repoRoot = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-v2-apply-test-'));
    repoRoot = path.join(tempDir, 'repo');
    fs.mkdirSync(repoRoot, { recursive: true });

    mockStatFail = false;
    mockReadFail = false;

    vi.mocked(writeExecutionsModule.writeExecutions).mockRestore?.();
    vi.mocked(writeExecutionsModule.rollbackExecutions).mockRestore?.();
    vi.mocked(historyStoreModule.appendHistoryEntries).mockRestore?.();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function resolveRepoPath(relPath: string): string {
    return path.join(repoRoot, relPath);
  }

  it('create mutation writes file', () => {
    const filePath = 'new_file.txt';
    const content = 'hello v2';
    const contentHash = hashContent(content);
    const emptyHash = hashContent('');

    const mutation: PreparedFileMutation = {
      filePath,
      type: 'create',
      beforeExists: false,
      afterExists: true,
      beforeContent: '',
      afterContent: content,
      beforeFileHash: emptyHash,
      afterFileHash: contentHash,
    };

    const res = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.appliedFileCount).toBe(1);
      expect(res.historyEntries.length).toBe(1);
      expect(res.historyEntries[0].mode).toBe('create_file');
    }

    const writtenPath = resolveRepoPath(filePath);
    expect(fs.existsSync(writtenPath)).toBe(true);
    expect(fs.readFileSync(writtenPath, 'utf-8')).toBe(content);
  });

  it('replace mutation replaces file', () => {
    const filePath = 'existing.txt';
    fs.writeFileSync(resolveRepoPath(filePath), 'before content');

    const mutation: PreparedFileMutation = {
      filePath,
      type: 'replace',
      beforeExists: true,
      afterExists: true,
      beforeContent: 'before content',
      afterContent: 'after content',
      beforeFileHash: hashContent('before content'),
      afterFileHash: hashContent('after content'),
    };

    const res = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.appliedFileCount).toBe(1);
      expect(res.historyEntries[0].mode).toBe('replace_file');
    }

    expect(fs.readFileSync(resolveRepoPath(filePath), 'utf-8')).toBe('after content');
  });

  it('delete mutation deletes file', () => {
    const filePath = 'todelete.txt';
    fs.writeFileSync(resolveRepoPath(filePath), 'some content');

    const mutation: PreparedFileMutation = {
      filePath,
      type: 'delete',
      beforeExists: true,
      afterExists: false,
      beforeContent: 'some content',
      afterContent: '',
      beforeFileHash: hashContent('some content'),
      afterFileHash: hashContent(''),
    };

    const res = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.appliedFileCount).toBe(1);
      expect(res.historyEntries[0].mode).toBe('delete_file');
    }

    expect(fs.existsSync(resolveRepoPath(filePath))).toBe(false);
  });

  it('multiple files apply successfully', () => {
    fs.writeFileSync(resolveRepoPath('f1.txt'), 'content1');
    const mutations: PreparedFileMutation[] = [
      {
        filePath: 'f1.txt',
        type: 'replace',
        beforeExists: true,
        afterExists: true,
        beforeContent: 'content1',
        afterContent: 'newcontent1',
        beforeFileHash: hashContent('content1'),
        afterFileHash: hashContent('newcontent1'),
      },
      {
        filePath: 'f2.txt',
        type: 'create',
        beforeExists: false,
        afterExists: true,
        beforeContent: '',
        afterContent: 'content2',
        beforeFileHash: hashContent(''),
        afterFileHash: hashContent('content2'),
      }
    ];

    const res = applyPreparedFileMutations(repoRoot, mutations);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.appliedFileCount).toBe(2);
      expect(res.historyEntries.length).toBe(2);
    }
    expect(fs.readFileSync(resolveRepoPath('f1.txt'), 'utf-8')).toBe('newcontent1');
    expect(fs.readFileSync(resolveRepoPath('f2.txt'), 'utf-8')).toBe('content2');
  });

  it('empty mutation list succeeds without history writes', () => {
    const appendSpy = vi.spyOn(historyStoreModule, 'appendHistoryEntries');
    const res = applyPreparedFileMutations(repoRoot, []);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.appliedFileCount).toBe(0);
      expect(res.historyEntries.length).toBe(0);
    }
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it('history entry count equals collapsed final mutation count', () => {
    const mutations: PreparedFileMutation[] = [
      {
        filePath: 'f1.txt',
        type: 'create',
        beforeExists: false,
        afterExists: true,
        beforeContent: '',
        afterContent: 'c1',
        beforeFileHash: hashContent(''),
        afterFileHash: hashContent('c1'),
      },
      {
        filePath: 'f2.txt',
        type: 'create',
        beforeExists: false,
        afterExists: true,
        beforeContent: '',
        afterContent: 'c2',
        beforeFileHash: hashContent(''),
        afterFileHash: hashContent('c2'),
      }
    ];
    const res = applyPreparedFileMutations(repoRoot, mutations);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.historyEntries.length).toBe(2);
      expect(res.historyEntries[0].mode).toBe('create_file');
      expect(res.historyEntries[1].mode).toBe('create_file');
    }
  });

  it('restore compatibility for create', () => {
    const filePath = 'new_file.txt';
    const mutation: PreparedFileMutation = {
      filePath,
      type: 'create',
      beforeExists: false,
      afterExists: true,
      beforeContent: '',
      afterContent: 'content',
      beforeFileHash: hashContent(''),
      afterFileHash: hashContent('content'),
    };

    const applyRes = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(applyRes.ok).toBe(true);
    expect(fs.existsSync(resolveRepoPath(filePath))).toBe(true);

    if (applyRes.ok) {
      const restoreRes = restoreEntry({ entryId: applyRes.historyEntries[0].id }, repoRoot);
      expect(restoreRes.success).toBe(true);
      expect(fs.existsSync(resolveRepoPath(filePath))).toBe(false);
    }
  });

  it('restore compatibility for replace', () => {
    const filePath = 'replace_file.txt';
    fs.writeFileSync(resolveRepoPath(filePath), 'original');

    const mutation: PreparedFileMutation = {
      filePath,
      type: 'replace',
      beforeExists: true,
      afterExists: true,
      beforeContent: 'original',
      afterContent: 'replaced',
      beforeFileHash: hashContent('original'),
      afterFileHash: hashContent('replaced'),
    };

    const applyRes = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(applyRes.ok).toBe(true);
    expect(fs.readFileSync(resolveRepoPath(filePath), 'utf-8')).toBe('replaced');

    if (applyRes.ok) {
      const restoreRes = restoreEntry({ entryId: applyRes.historyEntries[0].id }, repoRoot);
      expect(restoreRes.success).toBe(true);
      expect(fs.readFileSync(resolveRepoPath(filePath), 'utf-8')).toBe('original');
    }
  });

  it('restore compatibility for delete', () => {
    const filePath = 'delete_file.txt';
    fs.writeFileSync(resolveRepoPath(filePath), 'extant');

    const mutation: PreparedFileMutation = {
      filePath,
      type: 'delete',
      beforeExists: true,
      afterExists: false,
      beforeContent: 'extant',
      afterContent: '',
      beforeFileHash: hashContent('extant'),
      afterFileHash: hashContent(''),
    };

    const applyRes = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(applyRes.ok).toBe(true);
    expect(fs.existsSync(resolveRepoPath(filePath))).toBe(false);

    if (applyRes.ok) {
      const restoreRes = restoreEntry({ entryId: applyRes.historyEntries[0].id }, repoRoot);
      expect(restoreRes.success).toBe(true);
      expect(fs.existsSync(resolveRepoPath(filePath))).toBe(true);
      expect(fs.readFileSync(resolveRepoPath(filePath), 'utf-8')).toBe('extant');
    }
  });

  it('invalid mutation object rejected', () => {
    let res = applyPreparedFileMutations(repoRoot, [null as any]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('INVALID_PREPARED_MUTATION');
    }

    res = applyPreparedFileMutations(repoRoot, [{ filePath: 'a.txt' } as any]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('INVALID_PREPARED_MUTATION');
    }
  });

  it('hash-content mismatch rejected', () => {
    const mutation: PreparedFileMutation = {
      filePath: 'a.txt',
      type: 'create',
      beforeExists: false,
      afterExists: true,
      beforeContent: '',
      afterContent: 'real content',
      beforeFileHash: hashContent(''),
      afterFileHash: 'wronghash',
    };

    const res = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('INVALID_PREPARED_MUTATION');
    }
  });

  it('absent state with non-empty content rejected', () => {
    const mutation: PreparedFileMutation = {
      filePath: 'a.txt',
      type: 'create',
      beforeExists: false,
      afterExists: true,
      beforeContent: 'not empty but exists is false',
      afterContent: 'c',
      beforeFileHash: hashContent('not empty but exists is false'),
      afterFileHash: hashContent('c'),
    };

    const res = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('INVALID_PREPARED_MUTATION');
    }
  });

  it('invalid existence transition rejected', () => {
    const mutation: PreparedFileMutation = {
      filePath: 'a.txt',
      type: 'create',
      beforeExists: true,
      afterExists: true,
      beforeContent: 'a',
      afterContent: 'b',
      beforeFileHash: hashContent('a'),
      afterFileHash: hashContent('b'),
    };

    const res = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('INVALID_PREPARED_MUTATION');
    }
  });

  it('canonical path alias collision rejected', () => {
    const mutations: PreparedFileMutation[] = [
      {
        filePath: 'foo/bar.txt',
        type: 'create',
        beforeExists: false,
        afterExists: true,
        beforeContent: '',
        afterContent: 'one',
        beforeFileHash: hashContent(''),
        afterFileHash: hashContent('one'),
      },
      {
        filePath: 'foo/../foo/bar.txt',
        type: 'create',
        beforeExists: false,
        afterExists: true,
        beforeContent: '',
        afterContent: 'two',
        beforeFileHash: hashContent(''),
        afterFileHash: hashContent('two'),
      }
    ];

    const res = applyPreparedFileMutations(repoRoot, mutations);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('CANONICAL_PATH_COLLISION');
    }
  });

  it('workspace content drift rejected before writes', () => {
    const filePath = 'f.txt';
    fs.writeFileSync(resolveRepoPath(filePath), 'current live content');

    const mutation: PreparedFileMutation = {
      filePath,
      type: 'replace',
      beforeExists: true,
      afterExists: true,
      beforeContent: 'different frozen content',
      afterContent: 'new content',
      beforeFileHash: hashContent('different frozen content'),
      afterFileHash: hashContent('new content'),
    };

    const res = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('WORKSPACE_DRIFT');
    }
    expect(fs.readFileSync(resolveRepoPath(filePath), 'utf-8')).toBe('current live content');
  });

  it('workspace existence drift rejected before writes', () => {
    const filePath = 'f.txt';

    fs.writeFileSync(resolveRepoPath(filePath), 'hello');

    const mutation: PreparedFileMutation = {
      filePath,
      type: 'create',
      beforeExists: false,
      afterExists: true,
      beforeContent: '',
      afterContent: 'new content',
      beforeFileHash: hashContent(''),
      afterFileHash: hashContent('new content'),
    };

    const res = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('WORKSPACE_DRIFT');
    }
    expect(fs.readFileSync(resolveRepoPath(filePath), 'utf-8')).toBe('hello');
  });

  it('drift in a later file prevents earlier file writes', () => {
    const f1 = 'f1.txt';
    const f2 = 'f2.txt';

    fs.writeFileSync(resolveRepoPath(f1), 'initial f1');
    fs.writeFileSync(resolveRepoPath(f2), 'initial f2');

    const mutations: PreparedFileMutation[] = [
      {
        filePath: f1,
        type: 'replace',
        beforeExists: true,
        afterExists: true,
        beforeContent: 'initial f1',
        afterContent: 'changed f1',
        beforeFileHash: hashContent('initial f1'),
        afterFileHash: hashContent('changed f1'),
      },
      {
        filePath: f2,
        type: 'replace',
        beforeExists: true,
        afterExists: true,
        beforeContent: 'different from live f2',
        afterContent: 'changed f2',
        beforeFileHash: hashContent('different from live f2'),
        afterFileHash: hashContent('changed f2'),
      }
    ];

    const res = applyPreparedFileMutations(repoRoot, mutations);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('WORKSPACE_DRIFT');
    }
    expect(fs.readFileSync(resolveRepoPath(f1), 'utf-8')).toBe('initial f1');
  });

  it('binary live file rejected before writes', () => {
    const filePath = 'binary.bin';
    fs.writeFileSync(resolveRepoPath(filePath), Buffer.from([1, 2, 0, 4, 5]));

    const mutation: PreparedFileMutation = {
      filePath,
      type: 'replace',
      beforeExists: true,
      afterExists: true,
      beforeContent: 'some text',
      afterContent: 'new text',
      beforeFileHash: hashContent('some text'),
      afterFileHash: hashContent('new text'),
    };

    const res = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('BINARY_FILE_NOT_SUPPORTED');
    }
  });

  it('invalid UTF-8 live file rejected before writes', () => {
    const filePath = 'invalid_utf8.txt';
    fs.writeFileSync(resolveRepoPath(filePath), Buffer.from([0xC0, 0xAF]));

    const mutation: PreparedFileMutation = {
      filePath,
      type: 'replace',
      beforeExists: true,
      afterExists: true,
      beforeContent: 'some text',
      afterContent: 'new text',
      beforeFileHash: hashContent('some text'),
      afterFileHash: hashContent('new text'),
    };

    const res = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('INVALID_UTF8_FILE');
    }
  });

  it('ordinary write failure rolls back earlier writes', () => {
    const f1 = 'f1.txt';
    const f2 = 'fail.txt';
    fs.writeFileSync(resolveRepoPath(f1), 'initial f1');

    vi.mocked(writeExecutionsModule.writeExecutions).mockImplementation((execs, root) => {
      writeExecutionsModule.writeExecution(execs[0], root);
      const written = [execs[0]];
      const rollbackErrors = writeExecutionsModule.rollbackExecutions(written, root);
      if (rollbackErrors.length > 0) {
        throw new Error(`Disk write failed\nRollback errors:\n${rollbackErrors.join('\n')}`);
      }
      throw new Error('Disk write failed');
    });

    const mutations: PreparedFileMutation[] = [
      {
        filePath: f1,
        type: 'replace',
        beforeExists: true,
        afterExists: true,
        beforeContent: 'initial f1',
        afterContent: 'changed f1',
        beforeFileHash: hashContent('initial f1'),
        afterFileHash: hashContent('changed f1'),
      },
      {
        filePath: f2,
        type: 'create',
        beforeExists: false,
        afterExists: true,
        beforeContent: '',
        afterContent: 'should fail',
        beforeFileHash: hashContent(''),
        afterFileHash: hashContent('should fail'),
      }
    ];

    const res = applyPreparedFileMutations(repoRoot, mutations);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('APPLY_WRITE_FAILED');
    }
    expect(fs.readFileSync(resolveRepoPath(f1), 'utf-8')).toBe('initial f1');
  });

  it('history persistence failure rolls back disk writes', () => {
    const f1 = 'f1.txt';
    fs.writeFileSync(resolveRepoPath(f1), 'initial f1');

    vi.mocked(historyStoreModule.appendHistoryEntries).mockImplementation(() => {
      throw new Error('History persistence failed');
    });

    const mutation: PreparedFileMutation = {
      filePath: f1,
      type: 'replace',
      beforeExists: true,
      afterExists: true,
      beforeContent: 'initial f1',
      afterContent: 'changed f1',
      beforeFileHash: hashContent('initial f1'),
      afterFileHash: hashContent('changed f1'),
    };

    const res = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('HISTORY_PERSISTENCE_FAILED');
    }
    expect(fs.readFileSync(resolveRepoPath(f1), 'utf-8')).toBe('initial f1');
  });

  it('history persistence rollback failure is reported', () => {
    const f1 = 'f1.txt';
    fs.writeFileSync(resolveRepoPath(f1), 'initial f1');

    vi.mocked(historyStoreModule.appendHistoryEntries).mockImplementation(() => {
      throw new Error('History persistence failed');
    });

    vi.mocked(writeExecutionsModule.rollbackExecutions).mockReturnValue(['Rollback write failed']);

    const mutation: PreparedFileMutation = {
      filePath: f1,
      type: 'replace',
      beforeExists: true,
      afterExists: true,
      beforeContent: 'initial f1',
      afterContent: 'changed f1',
      beforeFileHash: hashContent('initial f1'),
      afterFileHash: hashContent('changed f1'),
    };

    const res = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.length).toBe(2);
      expect(res.errors[0].code).toBe('HISTORY_PERSISTENCE_FAILED');
      expect(res.errors[1].code).toBe('ROLLBACK_FAILED');
    }
  });

  it('statSync failure maps to FILE_READ_FAILED', () => {
    const filePath = 'stat-fail.txt';
    fs.writeFileSync(resolveRepoPath(filePath), 'content');

    mockStatFail = true;

    const mutation: PreparedFileMutation = {
      filePath,
      type: 'replace',
      beforeExists: true,
      afterExists: true,
      beforeContent: 'content',
      afterContent: 'newcontent',
      beforeFileHash: hashContent('content'),
      afterFileHash: hashContent('newcontent'),
    };

    const res = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('FILE_READ_FAILED');
      expect(res.errors[0].message).toBe('Workspace file could not be read.');
    }
  });

  it('readFileSync failure maps to FILE_READ_FAILED', () => {
    const filePath = 'read-fail.txt';
    fs.writeFileSync(resolveRepoPath(filePath), 'content');

    mockReadFail = true;

    const mutation: PreparedFileMutation = {
      filePath,
      type: 'replace',
      beforeExists: true,
      afterExists: true,
      beforeContent: 'content',
      afterContent: 'newcontent',
      beforeFileHash: hashContent('content'),
      afterFileHash: hashContent('newcontent'),
    };

    const res = applyPreparedFileMutations(repoRoot, [mutation]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('FILE_READ_FAILED');
      expect(res.errors[0].message).toBe('Workspace file could not be read.');
    }
  });

  describe('defensive validation tests', () => {
    it('rejects undefined mutations', () => {
      const res = applyPreparedFileMutations(repoRoot, undefined as any);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors[0].code).toBe('INVALID_PREPARED_MUTATION');
      }
    });

    it('rejects null mutations', () => {
      const res = applyPreparedFileMutations(repoRoot, null as any);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors[0].code).toBe('INVALID_PREPARED_MUTATION');
      }
    });

    it('rejects non-array mutations', () => {
      const res = applyPreparedFileMutations(repoRoot, {} as any);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors[0].code).toBe('INVALID_PREPARED_MUTATION');
      }
    });

    it('rejects blank repoRoot', () => {
      const res = applyPreparedFileMutations('', []);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors[0].code).toBe('INVALID_PREPARED_MUTATION');
      }
    });

    it('rejects whitespace repoRoot', () => {
      const res = applyPreparedFileMutations('   ', []);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors[0].code).toBe('INVALID_PREPARED_MUTATION');
      }
    });

    it('rejects blank filePath', () => {
      const mutation: PreparedFileMutation = {
        filePath: '',
        type: 'create',
        beforeExists: false,
        afterExists: true,
        beforeContent: '',
        afterContent: 'c',
        beforeFileHash: hashContent(''),
        afterFileHash: hashContent('c'),
      };
      const res = applyPreparedFileMutations(repoRoot, [mutation]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors[0].code).toBe('INVALID_PREPARED_MUTATION');
      }
    });

    it('rejects whitespace filePath', () => {
      const mutation: PreparedFileMutation = {
        filePath: '   ',
        type: 'create',
        beforeExists: false,
        afterExists: true,
        beforeContent: '',
        afterContent: 'c',
        beforeFileHash: hashContent(''),
        afterFileHash: hashContent('c'),
      };
      const res = applyPreparedFileMutations(repoRoot, [mutation]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors[0].code).toBe('INVALID_PREPARED_MUTATION');
      }
    });
  });

  describe('directory ancestor checking tests', () => {
    it('rejects missing target beneath existing regular file', () => {
      fs.writeFileSync(resolveRepoPath('file.txt'), 'content');
      const mutation: PreparedFileMutation = {
        filePath: 'file.txt/nested.txt',
        type: 'create',
        beforeExists: false,
        afterExists: true,
        beforeContent: '',
        afterContent: 'nested',
        beforeFileHash: hashContent(''),
        afterFileHash: hashContent('nested'),
      };
      const res = applyPreparedFileMutations(repoRoot, [mutation]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors[0].code).toBe('INVALID_WORKSPACE_PATH');
        expect(res.errors[0].message).toBe('Workspace path is invalid.');
        expect(res.errors[0].filePath).toBe('file.txt/nested.txt');
      }
    });

    it('create mutation whose parent directory drifted into a regular file is rejected before writes', () => {
      fs.writeFileSync(resolveRepoPath('drifted-dir'), 'regular file');

      const mutation: PreparedFileMutation = {
        filePath: 'drifted-dir/new-file.txt',
        type: 'create',
        beforeExists: false,
        afterExists: true,
        beforeContent: '',
        afterContent: 'content',
        beforeFileHash: hashContent(''),
        afterFileHash: hashContent('content'),
      };

      const res = applyPreparedFileMutations(repoRoot, [mutation]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors[0].code).toBe('INVALID_WORKSPACE_PATH');
      }
    });

    it('later mutation with invalid parent ancestor prevents earlier mutation from being written', () => {
      fs.writeFileSync(resolveRepoPath('drifted-dir'), 'regular file');

      const mutations: PreparedFileMutation[] = [
        {
          filePath: 'valid.txt',
          type: 'create',
          beforeExists: false,
          afterExists: true,
          beforeContent: '',
          afterContent: 'valid content',
          beforeFileHash: hashContent(''),
          afterFileHash: hashContent('valid content'),
        },
        {
          filePath: 'drifted-dir/invalid.txt',
          type: 'create',
          beforeExists: false,
          afterExists: true,
          beforeContent: '',
          afterContent: 'invalid content',
          beforeFileHash: hashContent(''),
          afterFileHash: hashContent('invalid content'),
        }
      ];

      const res = applyPreparedFileMutations(repoRoot, mutations);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors[0].code).toBe('INVALID_WORKSPACE_PATH');
      }

      expect(fs.existsSync(resolveRepoPath('valid.txt'))).toBe(false);
    });
  });
});
