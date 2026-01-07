import * as path from 'path';
import { normalizeRelativePath } from '../util/path';

type ResolvedPathInfo = {
  resolvedPath: string;
  relativePath: string;
  normalizedPath: string;
};

function isWithin(basePath: string, targetPath: string): boolean {
  const relative = path.relative(basePath, targetPath);
  return !(relative.startsWith('..') || path.isAbsolute(relative));
}

export function resolveAndAssertWithin(
  repoRoot: string,
  userPath: string,
  allowedRoots?: string[]
): ResolvedPathInfo {
  const normalizedPath = normalizeRelativePath(userPath);
  const repoRootResolved = path.resolve(repoRoot);
  const isAbsolute = path.isAbsolute(normalizedPath) || path.win32.isAbsolute(normalizedPath);
  const resolvedPath = isAbsolute
    ? path.resolve(normalizedPath)
    : path.resolve(repoRootResolved, normalizedPath);

  if (!isWithin(repoRootResolved, resolvedPath)) {
    throw new Error('File must be within repository root');
  }

  if (allowedRoots && allowedRoots.length > 0) {
    const isInAllowedRoot = allowedRoots.some((root) => {
      const normalizedRoot = normalizeRelativePath(root);
      const resolvedRoot = path.resolve(repoRootResolved, normalizedRoot);
      return isWithin(resolvedRoot, resolvedPath);
    });

    if (!isInAllowedRoot) {
      throw new Error(`File must be under scope roots: ${allowedRoots.join(', ')}`);
    }
  }

  const relativePath = normalizeRelativePath(path.relative(repoRootResolved, resolvedPath));

  return {
    resolvedPath,
    relativePath,
    normalizedPath,
  };
}
