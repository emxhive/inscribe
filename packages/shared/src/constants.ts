/**
 * Shared constants for Inscribe
 */

export const INDEXED_ROOTS = [
  'app/',
  'routes/',
  'resources/',
  'database/',
  'config/',
  'tests/',
] as const;

export const IGNORED_PATHS = [
  '.git/',
  'node_modules/',
  'vendor/',
  'storage/',
  'bootstrap/cache/',
  'public/build/',
  '.inscribe/',
] as const;

export const BACKUP_DIR = '.inscribe/backups';

export const INSCRIBE_BEGIN = '@inscribe BEGIN';
export const INSCRIBE_END = '@inscribe END';
export const INSCRIBE_FILE = '@inscribe FILE:';
export const INSCRIBE_MODE = '@inscribe MODE:';
export const INSCRIBE_START = '@inscribe START:';
export const INSCRIBE_END_ANCHOR = '@inscribe END:';
export const INSCRIBE_SCOPE_START = '@inscribe SCOPE_START:';
export const INSCRIBE_SCOPE_END = '@inscribe SCOPE_END:';
