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

// Inscribe repository metadata
export const INSCRIBE_IGNORE_FILE = '.inscribeignore';
export const SCOPE_STORE_FILE = 'scope.json';

// Suggested exclude heuristics
export const HEAVY_DIR_NAMES = [
  'dist',
  'build',
  'out',
  'coverage',
  '.cache',
  'tmp',
  'temp',
  'target',
  'bin',
  'obj',
] as const;
export const HEAVY_FILE_COUNT_THRESHOLD = 200;

export const INSCRIBE_BEGIN = '@inscribe BEGIN';
export const INSCRIBE_END = '@inscribe END';
export const INSCRIBE_FILE = '@inscribe FILE:';
export const INSCRIBE_MODE = '@inscribe MODE:';
export const INSCRIBE_START = '@inscribe START:';
export const INSCRIBE_END_ANCHOR = '@inscribe END:';
export const INSCRIBE_SCOPE_START = '@inscribe SCOPE_START:';
export const INSCRIBE_SCOPE_END = '@inscribe SCOPE_END:';

// Inscribe directive prefixes (used for parsing)
export const INSCRIBE_PREFIX = '@inscribe';

// Directive names (without the @inscribe prefix)
export const DIRECTIVE_FILE = 'FILE:';
export const DIRECTIVE_MODE = 'MODE:';
export const DIRECTIVE_START = 'START:';
export const DIRECTIVE_END = 'END:';
export const DIRECTIVE_SCOPE_START = 'SCOPE_START:';
export const DIRECTIVE_SCOPE_END = 'SCOPE_END:';

// Valid modes
export const VALID_MODES = ['create', 'replace', 'append', 'range'] as const;
export const DEFAULT_MODE = 'replace';
