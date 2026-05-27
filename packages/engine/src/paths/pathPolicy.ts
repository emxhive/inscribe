import { resolveAndAssertWithinRepo } from './resolveAndAssertWithin';
import { OperationMode } from '@inscribe/shared';

export interface PathPolicyResult {
  resolvedPath: string;
  relativePath: string;
  canonicalPath: string;
}

/**
 * Enforces the centralized path policy.
 *
 * Policy:
 * - all file operations must resolve inside the repository root.
 * - index ignore rules affect indexing/context only; they do not block writes.
 */
export function enforcePathPolicy(
  repoRoot: string,
  userPath: string,
  mode: OperationMode
): PathPolicyResult {
  void mode;
  return resolveAndAssertWithinRepo(repoRoot, userPath);
}

/**
 * Enforces restore path policy from the original payload mode.
 *
 * Restore execution may write the inverse file state, but it still must stay
 * within the repository root.
 */
export function enforceRestorePathPolicy(
  repoRoot: string,
  userPath: string,
  originalMode: OperationMode
): PathPolicyResult {
  return enforcePathPolicy(repoRoot, userPath, originalMode);
}
