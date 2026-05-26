import { resolveAndAssertWithinRepo, resolveAndAssertWithinScope } from './resolveAndAssertWithin';
import { type IgnoreMatcher } from '../repo/ignoreRules';
import { getOperationModeMetadata, OperationMode } from '@inscribe/shared';

export interface PathPolicyResult {
  resolvedPath: string;
  relativePath: string;
  canonicalPath: string;
}

/**
 * Enforces the centralized path and scope policy.
 *
 * Policy:
 * - create_file: may create anywhere inside repo root unless ignored.
 * - all other operations: must operate inside configured scope and outside ignored paths.
 */
export function enforcePathPolicy(
  repoRoot: string,
  userPath: string,
  mode: OperationMode,
  scopeRoots: string[],
  ignoreMatcher: IgnoreMatcher
): PathPolicyResult {
  const metadata = getOperationModeMetadata(mode);

  if (mode === 'create_file' || metadata.fileExistence === 'must_not_exist') {
    return resolveAndAssertWithinRepo(repoRoot, userPath, ignoreMatcher);
  }

  return resolveAndAssertWithinScope(repoRoot, userPath, scopeRoots, ignoreMatcher);
}

/**
 * Enforces restore path policy from the original payload mode.
 *
 * Restore execution may write the inverse file state, but path/scope/ignore
 * policy must follow the operation that originally produced the history entry.
 */
export function enforceRestorePathPolicy(
  repoRoot: string,
  userPath: string,
  originalMode: OperationMode,
  scopeRoots: string[],
  ignoreMatcher: IgnoreMatcher
): PathPolicyResult {
  return enforcePathPolicy(repoRoot, userPath, originalMode, scopeRoots, ignoreMatcher);
}
