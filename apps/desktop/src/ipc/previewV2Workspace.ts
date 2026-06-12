import * as fs from 'fs';
import * as path from 'path';

export type WorkspacePreviewErrorCode =
  | 'INVALID_WORKSPACE_ROOT'
  | 'INVALID_WORKSPACE_PATH'
  | 'WORKSPACE_ESCAPE'
  | 'DIRECTORY_PASSED_AS_FILE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'INVALID_PARENT_PATH'
  | 'FILE_READ_FAILED'
  | 'BINARY_FILE_NOT_SUPPORTED'
  | 'INVALID_UTF8_FILE';

export class WorkspacePreviewError extends Error {
  constructor(
    public code: WorkspacePreviewErrorCode,
    message: string,
    public filePath?: string
  ) {
    super(`[Workspace Error: ${code}] ${message}`);
    this.name = 'WorkspacePreviewError';
    Object.setPrototypeOf(this, WorkspacePreviewError.prototype);
  }
}

export interface VirtualFile {
  content: string;
  exists: boolean;
}

export function isPathContained(realRoot: string, absPath: string): boolean {
  let relative = path.relative(realRoot, absPath);
  if (process.platform === 'win32') {
    const rootLower = realRoot.toLowerCase();
    const absLower = absPath.toLowerCase();
    relative = path.relative(rootLower, absLower);
  }
  const isEscaped =
    relative === '..' ||
    relative.startsWith('..' + path.sep) ||
    relative.startsWith('../') ||
    path.isAbsolute(relative);
  return !isEscaped;
}

export function validateWorkspaceRelativePath(relPath: string): void {
  if (!relPath) {
    throw new WorkspacePreviewError('INVALID_WORKSPACE_PATH', 'Path is empty');
  }

  // Reject NUL bytes or control characters
  for (let idx = 0; idx < relPath.length; idx++) {
    const code = relPath.charCodeAt(idx);
    if (code === 0 || (code >= 1 && code <= 31) || code === 127) {
      throw new WorkspacePreviewError('INVALID_WORKSPACE_PATH', 'Path contains invalid characters', relPath);
    }
  }

  // Reject absolute paths starting with slashes or UNC paths
  if (relPath.startsWith('//') || relPath.startsWith('/') || relPath.startsWith('\\')) {
    throw new WorkspacePreviewError('INVALID_WORKSPACE_PATH', 'Path must be relative', relPath);
  }

  // Reject drive-letter paths (e.g. C:\ or C:/ or just C:)
  if (/^[a-zA-Z]:/.test(relPath)) {
    throw new WorkspacePreviewError('INVALID_WORKSPACE_PATH', 'Drive-letter path not allowed', relPath);
  }

  // Reject backslashes
  if (relPath.includes('\\')) {
    throw new WorkspacePreviewError('INVALID_WORKSPACE_PATH', 'Path contains backslashes', relPath);
  }

  // Split by slashes to check segments
  const segments = relPath.split('/');
  for (const segment of segments) {
    if (segment === '.') {
      throw new WorkspacePreviewError('INVALID_WORKSPACE_PATH', 'Dot segment not allowed', relPath);
    }
    if (segment === '..') {
      throw new WorkspacePreviewError('INVALID_WORKSPACE_PATH', 'Double-dot segment not allowed', relPath);
    }
    if (segment === '') {
      throw new WorkspacePreviewError('INVALID_WORKSPACE_PATH', 'Empty segment or repeated slashes not allowed', relPath);
    }

    // Reject invalid Windows characters anywhere in the segment
    const invalidChars = [':', '*', '?', '"', '<', '>', '|'];
    for (const char of invalidChars) {
      if (segment.includes(char)) {
        throw new WorkspacePreviewError('INVALID_WORKSPACE_PATH', `Path contains invalid character: ${char}`, relPath);
      }
    }

    // Reject segments ending with dot or space
    if (segment.endsWith('.') || segment.endsWith(' ')) {
      throw new WorkspacePreviewError('INVALID_WORKSPACE_PATH', 'Segments ending with dot or space not allowed', relPath);
    }

    // Reject Windows reserved device names case-insensitively, including extensions
    const baseName = segment.split('.')[0].toUpperCase();
    const reserved = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];
    if (reserved.includes(baseName)) {
      throw new WorkspacePreviewError('INVALID_WORKSPACE_PATH', 'Windows reserved device name not allowed', relPath);
    }
  }

  // Reject trailing slash
  if (relPath.endsWith('/')) {
    throw new WorkspacePreviewError('INVALID_WORKSPACE_PATH', 'Trailing slash not allowed', relPath);
  }
}

export function loadInitialFiles(
  trustedRepoRoot: string,
  filePaths: string[]
): Map<string, VirtualFile> {
  const initialFiles = new Map<string, VirtualFile>();

  let realRoot: string;
  try {
    const absRoot = path.resolve(trustedRepoRoot);
    realRoot = fs.realpathSync(absRoot);
    const stat = fs.statSync(realRoot);
    if (!stat.isDirectory()) {
      throw new WorkspacePreviewError('INVALID_WORKSPACE_ROOT', 'Failed to access workspace root');
    }
  } catch (e: unknown) {
    if (e instanceof WorkspacePreviewError) {
      throw e;
    }
    throw new WorkspacePreviewError('INVALID_WORKSPACE_ROOT', 'Failed to access workspace root');
  }

  const uniquePaths = Array.from(new Set(filePaths));

  for (const relPath of uniquePaths) {
    // Lexical safety checks before path.resolve()
    validateWorkspaceRelativePath(relPath);

    const candidateAbsolute = path.resolve(realRoot, relPath);

    // Lexical containment check
    if (!isPathContained(realRoot, candidateAbsolute)) {
      throw new WorkspacePreviewError('WORKSPACE_ESCAPE', 'Workspace escape detected', relPath);
    }

    if (fs.existsSync(candidateAbsolute)) {
      let realCandidate: string;
      try {
        realCandidate = fs.realpathSync(candidateAbsolute);
      } catch (e: unknown) {
        throw new WorkspacePreviewError('FILE_READ_FAILED', 'Failed to resolve file path', relPath);
      }

      if (!isPathContained(realRoot, realCandidate)) {
        throw new WorkspacePreviewError('WORKSPACE_ESCAPE', 'Symlink escape detected', relPath);
      }

      let stat: fs.Stats;
      try {
        stat = fs.statSync(realCandidate);
      } catch (e: unknown) {
        throw new WorkspacePreviewError('FILE_READ_FAILED', 'Failed to inspect file', relPath);
      }

      if (stat.isDirectory()) {
        throw new WorkspacePreviewError('DIRECTORY_PASSED_AS_FILE', 'Directory passed as file', relPath);
      }

      if (!stat.isFile()) {
        throw new WorkspacePreviewError('UNSUPPORTED_FILE_TYPE', 'Unsupported file type', relPath);
      }

      let buf: Buffer;
      try {
        buf = fs.readFileSync(realCandidate);
      } catch (e: unknown) {
        throw new WorkspacePreviewError('FILE_READ_FAILED', 'Failed to read file', relPath);
      }

      if (buf.includes(0)) {
        throw new WorkspacePreviewError('BINARY_FILE_NOT_SUPPORTED', 'NUL bytes detected in file', relPath);
      }

      let content: string;
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        content = decoder.decode(buf);
      } catch (e: unknown) {
        throw new WorkspacePreviewError('INVALID_UTF8_FILE', 'Invalid UTF-8 decoding', relPath);
      }

      initialFiles.set(relPath, { exists: true, content });
    } else {
      let current = candidateAbsolute;

      while (true) {
        const parent = path.dirname(current);
        if (parent === current) {
          break;
        }
        if (fs.existsSync(parent)) {
          let realParent: string;
          try {
            realParent = fs.realpathSync(parent);
          } catch (e: unknown) {
            throw new WorkspacePreviewError('FILE_READ_FAILED', 'Failed to resolve parent path', relPath);
          }

          if (!isPathContained(realRoot, realParent)) {
            throw new WorkspacePreviewError('WORKSPACE_ESCAPE', 'Workspace escape in parent path', relPath);
          }

          let parentStat: fs.Stats;
          try {
            parentStat = fs.statSync(realParent);
          } catch (e: unknown) {
            throw new WorkspacePreviewError('FILE_READ_FAILED', 'Failed to inspect parent path', relPath);
          }

          if (!parentStat.isDirectory()) {
            throw new WorkspacePreviewError('INVALID_PARENT_PATH', 'Nearest existing parent path is not a directory', relPath);
          }
          break;
        }
        current = parent;
      }

      initialFiles.set(relPath, { exists: false, content: '' });
    }
  }

  return initialFiles;
}
