import { BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import path from 'path';
import { windowManager } from '../windowManager';

function normalizeRepoRoot(repoRoot: string): string {
  const resolved = path.resolve(repoRoot);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function requireTrustedRepoRoot(
  event: IpcMainInvokeEvent,
  suppliedRepoRoot?: string | null,
): string {
  const win = BrowserWindow.fromWebContents(event.sender);
  const trustedRepoRoot = win ? windowManager.getWindowRepo(win) : undefined;

  if (!trustedRepoRoot) {
    throw new Error('No repository is bound to this window');
  }

  if (
    suppliedRepoRoot &&
    normalizeRepoRoot(suppliedRepoRoot) !== normalizeRepoRoot(trustedRepoRoot)
  ) {
    throw new Error('Repository root does not match the window binding');
  }

  return trustedRepoRoot;
}
