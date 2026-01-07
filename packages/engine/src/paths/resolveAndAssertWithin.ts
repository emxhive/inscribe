import * as path from 'path';
import { normalizeRelativePath } from '../util/path';

export type ResolvedPathInfo = {
  resolvedPath: string;
  relativePath: string;
};

function isWithin(basePath: string, targetPath: string): boolean {
  const relative = path.relative(basePath, targetPath);
  if (relative === '') {
    return true;
  }
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function resolveAndAssertWithin(
  repoRoot: string,
  userPath: string,
  allowedRoots?: string[]
): ResolvedPathInfo {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const normalizedUserPath = normalizeRelativePath(userPath);
  const resolvedTarget = path.resolve(resolvedRepoRoot, normalizedUserPath);

  if (!isWithin(resolvedRepoRoot, resolvedTarget)) {
    throw new Error('File resolves outside repository root');
  }

  if (allowedRoots && allowedRoots.length > 0) {
    const allowedResolved = allowedRoots.map(root =>
      path.resolve(resolvedRepoRoot, normalizeRelativePath(root))
    );
    const isAllowed = allowedResolved.some(root => isWithin(root, resolvedTarget));
    if (!isAllowed) {
      throw new Error(`File must be under scope roots: ${allowedRoots.join(', ')}`);
    }
  }

  const relativePath = normalizeRelativePath(path.relative(resolvedRepoRoot, resolvedTarget));

  return {
    resolvedPath: resolvedTarget,
    relativePath,
  };
}
