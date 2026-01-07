export function normalizeRelativePath(input: string): string {
  const trimmed = input.trim().replace(/\\/g, '/').replace(/^\.\/+/, '');
  return trimmed.replace(/\/+/g, '/');
}

export function ensureTrailingSlash(input: string): string {
  return input.endsWith('/') ? input : `${input}/`;
}

export function normalizePrefix(input: string): string {
  return ensureTrailingSlash(normalizeRelativePath(input));
}
