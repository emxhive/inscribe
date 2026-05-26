import * as fs from 'fs';
import * as path from 'path';
import { normalizeRelativePath, ensureTrailingSlash } from '../util/path';
import { type IgnoreMatcher, matchIgnoredPath } from '../repo/ignoreRules';

export type ResolvedPathInfo = {
  resolvedPath: string;
  relativePath: string;
  canonicalPath: string;
};

function isWithin(basePath: string, targetPath: string): boolean {
  const normalizedBase = normalizeComparablePath(basePath);
  const normalizedTarget = normalizeComparablePath(targetPath);
  const relative = path.relative(normalizedBase, normalizedTarget);
  if (relative === '') {
    return true;
  }
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function normalizeComparablePath(input: string): string {
  const resolved = path.resolve(input);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function realpath(input: string): string {
  return fs.realpathSync.native?.(input) ?? fs.realpathSync(input);
}

function isAbsoluteUserPath(input: string): boolean {
  const trimmed = input.trim();
  return (
    path.isAbsolute(trimmed) ||
    path.win32.isAbsolute(trimmed) ||
    path.posix.isAbsolute(trimmed) ||
    /^[a-zA-Z]:[\\/]/.test(trimmed)
  );
}

function assertRelativeUserPath(userPath: string): void {
  if (isAbsoluteUserPath(userPath)) {
    throw new Error('Absolute file paths are not allowed');
  }
}

function resolveExistingPathOrAncestor(resolvedTarget: string): {
  existingPath: string;
  realExistingPath: string;
  canonicalPath: string;
} {
  let current = resolvedTarget;
  const missingSegments: string[] = [];

  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Unable to resolve existing parent directory');
    }
    missingSegments.unshift(path.basename(current));
    current = parent;
  }

  const realExistingPath = realpath(current);
  const canonicalTarget = missingSegments.length > 0
    ? path.resolve(realExistingPath, ...missingSegments)
    : realExistingPath;

  return {
    existingPath: current,
    realExistingPath,
    canonicalPath: normalizeComparablePath(canonicalTarget),
  };
}

function assertRealPathWithin(
  resolvedTarget: string,
  realRepoRoot: string,
  allowedRealRoots: string[],
): string {
  const { realExistingPath, canonicalPath } = resolveExistingPathOrAncestor(resolvedTarget);

  if (!isWithin(realRepoRoot, realExistingPath)) {
    throw new Error('File resolves outside repository root through symlink traversal');
  }

  if (allowedRealRoots.length > 0 && !allowedRealRoots.some(root => isWithin(root, realExistingPath))) {
    throw new Error('File resolves outside scope roots through symlink traversal');
  }

  return canonicalPath;
}

/**
 * Resolve a path and assert it's within the repository root and not in ignored prefixes/globs.
 * This is used for create_file mode, which allows creating files anywhere under repo root
 * that isn't explicitly ignored.
 */
export function resolveAndAssertWithinRepo(
  repoRoot: string,
  userPath: string,
  ignoreMatcher: IgnoreMatcher
): ResolvedPathInfo {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const realRepoRoot = realpath(resolvedRepoRoot);
  assertRelativeUserPath(userPath);
  const normalizedUserPath = normalizeRelativePath(userPath);
  const resolvedTarget = path.resolve(resolvedRepoRoot, normalizedUserPath);

  if (!isWithin(resolvedRepoRoot, resolvedTarget)) {
    throw new Error('File resolves outside repository root');
  }

  const canonicalPath = assertRealPathWithin(resolvedTarget, realRepoRoot, []);
  const relativePath = normalizeRelativePath(path.relative(resolvedRepoRoot, resolvedTarget));
  
  // Check if path is under any ignored prefix or glob
  const filePrefix = ensureTrailingSlash(relativePath);
  const ignoreMatch =
    matchIgnoredPath(relativePath, ignoreMatcher) ??
    matchIgnoredPath(filePrefix, ignoreMatcher, { isDirectory: true });
  
  if (ignoreMatch) {
    throw new Error(`File is in ignored path: ${ignoreMatch}`);
  }

  return {
    resolvedPath: resolvedTarget,
    relativePath,
    canonicalPath,
  };
}

/**
 * Resolve a path and assert it's within scope roots and not in ignored prefixes/globs.
 * This is used for modes that must operate on files within the configured scope.
 */
export function resolveAndAssertWithinScope(
  repoRoot: string,
  userPath: string,
  scopeRoots: string[],
  ignoreMatcher: IgnoreMatcher
): ResolvedPathInfo {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const realRepoRoot = realpath(resolvedRepoRoot);
  assertRelativeUserPath(userPath);
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

  const allowedRealRoots = (scopeRoots && scopeRoots.length > 0)
    ? scopeRoots
      .map(root => path.resolve(resolvedRepoRoot, normalizeRelativePath(root)))
      .filter(root => fs.existsSync(root))
      .map(root => realpath(root))
    : [];
  const canonicalPath = assertRealPathWithin(resolvedTarget, realRepoRoot, allowedRealRoots);
  const relativePath = normalizeRelativePath(path.relative(resolvedRepoRoot, resolvedTarget));
  
  // Check if path is under any ignored prefix or glob
  const filePrefix = ensureTrailingSlash(relativePath);
  const ignoreMatch =
    matchIgnoredPath(relativePath, ignoreMatcher) ??
    matchIgnoredPath(filePrefix, ignoreMatcher, { isDirectory: true });
  
  if (ignoreMatch) {
    throw new Error(`File is in ignored path: ${ignoreMatch}`);
  }

  return {
    resolvedPath: resolvedTarget,
    relativePath,
    canonicalPath,
  };
}
