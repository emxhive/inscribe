const APP_TITLE = 'Inscribe';

export function getRepoDisplayName(repoRoot: string | null | undefined): string {
  if (!repoRoot) return '';

  const normalized = repoRoot.replace(/\\/g, '/').replace(/\/+$/g, '');
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

export function getWindowTitle(repoRoot: string | null | undefined): string {
  const repoName = getRepoDisplayName(repoRoot);
  return repoName ? `${repoName} - ${APP_TITLE}` : APP_TITLE;
}
