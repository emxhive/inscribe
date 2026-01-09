import * as path from 'path';
import { normalizeRelativePath, ensureTrailingSlash } from '../util/path';

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

/**
 * Resolve a path and assert it's within the repository root and not in ignored prefixes.
 * This is used for CREATE mode, which allows creating files anywhere under repo root
 * that isn't explicitly ignored.
 */
export function resolveAndAssertWithinRepo(
  repoRoot: string,
  userPath: string,
  ignorePrefixes: string[]
): ResolvedPathInfo {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const normalizedUserPath = normalizeRelativePath(userPath);
  const resolvedTarget = path.resolve(resolvedRepoRoot, normalizedUserPath);

  if (!isWithin(resolvedRepoRoot, resolvedTarget)) {
    throw new Error('File resolves outside repository root');
  }

  const relativePath = normalizeRelativePath(path.relative(resolvedRepoRoot, resolvedTarget));
  
  // Check if path is under any ignored prefix
  const filePrefix = ensureTrailingSlash(relativePath);
  const ignoreMatch = ignorePrefixes.find(ignored => filePrefix.startsWith(ignored));
  
  if (ignoreMatch) {
    throw new Error(`File is in ignored path: ${ignoreMatch}`);
  }

  return {
    resolvedPath: resolvedTarget,
    relativePath,
  };
}

/**
 * Resolve a path and assert it's within scope roots.
 * This is used for REPLACE, APPEND, and RANGE modes which must operate
 * on files within the configured scope.
 */
export function resolveAndAssertWithinScope(
  repoRoot: string,
  userPath: string,
  scopeRoots: string[]
): ResolvedPathInfo {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const normalizedUserPath = normalizeRelativePath(userPath);
  const resolvedTarget = path.resolve(resolvedRepoRoot, normalizedUserPath);

  if (!isWithin(resolvedRepoRoot, resolvedTarget)) {
    throw new Error('File resolves outside repository root');
  }

  if (scopeRoots && scopeRoots.length > 0) {
    const allowedResolved = scopeRoots.map(root =>
      path.resolve(resolvedRepoRoot, normalizeRelativePath(root))
    );
    const isAllowed = allowedResolved.some(root => isWithin(root, resolvedTarget));
    if (!isAllowed) {
      throw new Error(`File must be under scope roots: ${scopeRoots.join(', ')}`);
    }
  }

  const relativePath = normalizeRelativePath(path.relative(resolvedRepoRoot, resolvedTarget));

  return {
    resolvedPath: resolvedTarget,
    relativePath,
  };
}

/**
 * Legacy function - delegates to resolveAndAssertWithinScope
 * @deprecated Use resolveAndAssertWithinScope or resolveAndAssertWithinRepo instead
 */
export function resolveAndAssertWithin(
  repoRoot: string,
  userPath: string,
  allowedRoots?: string[]
): ResolvedPathInfo {
  return resolveAndAssertWithinScope(repoRoot, userPath, allowedRoots || []);
}
