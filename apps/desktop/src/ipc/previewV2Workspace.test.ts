import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

vi.mock('fs', async (importOriginal) => {
  const original = await importOriginal<typeof fs>();
  return {
    ...original,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    realpathSync: vi.fn(),
    statSync: vi.fn(),
  };
});

import { isPathContained, loadInitialFiles } from './previewV2Workspace';

describe('V2 Workspace Containment and Loader Tests', () => {
  const root = process.platform === 'win32' ? 'C:\\repo' : '/repo';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(fs.realpathSync).mockImplementation((p) => p as string);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockImplementation((p) => {
      const isRoot = typeof p === 'string' && (p === root || p === path.resolve(root));
      return { isDirectory: () => isRoot, isFile: () => !isRoot } as any;
    });
  });

  it('existing workspace-relative file loaded', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('hello', 'utf8'));
    const res = loadInitialFiles(root, ['src/index.ts']);
    expect(res.get('src/index.ts')).toEqual({ exists: true, content: 'hello' });
  });

  it('missing file represented as exists false', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && (p === root || p === path.resolve(root) || p === path.dirname(path.resolve(root, 'src/missing.ts')))) {
        return true;
      }
      return false;
    });
    vi.mocked(fs.statSync).mockImplementation((p) => {
      const isDir = typeof p === 'string' && (
        p === root ||
        p === path.resolve(root) ||
        p === path.dirname(path.resolve(root, 'src/missing.ts'))
      );
      return { isDirectory: () => isDir, isFile: () => !isDir } as any;
    });

    const res = loadInitialFiles(root, ['src/missing.ts']);
    expect(res.get('src/missing.ts')).toEqual({ exists: false, content: '' });
  });

  it('absolute path rejected independently', () => {
    expect(() => loadInitialFiles(root, ['/absolute/path.ts'])).toThrow('INVALID_WORKSPACE_PATH');
  });

  it('drive-letter path rejected independently', () => {
    expect(() => loadInitialFiles(root, ['C:/drive.ts'])).toThrow('INVALID_WORKSPACE_PATH');
  });

  it('dot segment rejected independently', () => {
    expect(() => loadInitialFiles(root, ['src/./file.ts'])).toThrow('INVALID_WORKSPACE_PATH');
  });

  it('double-dot segment rejected independently', () => {
    expect(() => loadInitialFiles(root, ['src/../escaped.ts'])).toThrow('INVALID_WORKSPACE_PATH');
  });

  it('repeated slash rejected independently', () => {
    expect(() => loadInitialFiles(root, ['src//file.ts'])).toThrow('INVALID_WORKSPACE_PATH');
  });

  it('backslash rejected independently', () => {
    expect(() => loadInitialFiles(root, ['src\\file.ts'])).toThrow('INVALID_WORKSPACE_PATH');
  });

  it('safe ..cache path accepted', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('cached', 'utf-8'));
    const res = loadInitialFiles(root, ['..cache/file.ts']);
    expect(res.get('..cache/file.ts')).toEqual({ exists: true, content: 'cached' });
  });

  it('directory path rejected', () => {
    vi.mocked(fs.statSync).mockImplementation(() => {
      return { isDirectory: () => true, isFile: () => false } as any;
    });
    expect(() => loadInitialFiles(root, ['src/index.ts'])).toThrow('DIRECTORY_PASSED_AS_FILE');
  });

  it('nearest existing parent file rejected', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && (p === root || p === path.resolve(root))) {
        return true;
      }
      if (typeof p === 'string' && p.endsWith('src')) {
        return true;
      }
      return false;
    });
    vi.mocked(fs.statSync).mockImplementation((p) => {
      if (typeof p === 'string' && p.endsWith('src')) {
        return { isDirectory: () => false, isFile: () => true } as any;
      }
      return { isDirectory: () => true, isFile: () => false } as any;
    });
    expect(() => loadInitialFiles(root, ['src/missing.ts'])).toThrow('INVALID_PARENT_PATH');
  });

  it('NUL-byte file rejected', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('hello\x00world'));
    expect(() => loadInitialFiles(root, ['src/index.ts'])).toThrow('BINARY_FILE_NOT_SUPPORTED');
  });

  it('invalid UTF-8 rejected', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from([0xff, 0xfe, 0xfd]));
    expect(() => loadInitialFiles(root, ['src/index.ts'])).toThrow('INVALID_UTF8_FILE');
  });

  it('read failure mapped to FILE_READ_FAILED', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('EACCES');
    });
    expect(() => loadInitialFiles(root, ['src/index.ts'])).toThrow('FILE_READ_FAILED');
  });

  it('rejects invalid Windows characters anywhere in a segment', () => {
    const chars = [':', '*', '?', '"', '<', '>', '|'];
    for (const char of chars) {
      expect(() => loadInitialFiles(root, [`src/file${char}.ts`])).toThrow('INVALID_WORKSPACE_PATH');
    }
  });

  it('rejects segments ending with dot or space', () => {
    expect(() => loadInitialFiles(root, ['src/folder./a.ts'])).toThrow('INVALID_WORKSPACE_PATH');
    expect(() => loadInitialFiles(root, ['src/folder /a.ts'])).toThrow('INVALID_WORKSPACE_PATH');
  });

  it('rejects Windows reserved device names case-insensitively', () => {
    const reservedNames = ['CON', 'nul.txt', 'src/COM1.ts', 'src/lpt9.log'];
    for (const name of reservedNames) {
      expect(() => loadInitialFiles(root, [name])).toThrow('INVALID_WORKSPACE_PATH');
    }
  });

  it('rejects unsupported file types (non-directory and non-file)', () => {
    vi.mocked(fs.statSync).mockImplementation((p) => {
      const isRoot = typeof p === 'string' && (p === root || p === path.resolve(root));
      // Simulate socket or pipe: neither directory nor file
      return { isDirectory: () => isRoot, isFile: () => false } as any;
    });
    expect(() => loadInitialFiles(root, ['src/index.ts'])).toThrow('UNSUPPORTED_FILE_TYPE');
  });
});
