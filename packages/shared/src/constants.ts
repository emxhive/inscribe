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

// Inscribe directory and metadata - define first as they're used by other constants
export const INSCRIBE_DIR = '.inscribe';
export const INSCRIBE_IGNORE_FILE = '.inscribeignore';
export const SCOPE_STORE_FILE = 'scope.json';
export const BACKUP_DIR = `${INSCRIBE_DIR}/backups`;

export const IGNORED_PATHS = [
  '.git/',
  'node_modules/',
  'vendor/',
  'storage/',
  'bootstrap/cache/',
  'public/build/',
  `${INSCRIBE_DIR}/`,
] as const;

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

// Base prefix - single source of truth for the inscribe marker
export const INSCRIBE_PREFIX = '@inscribe';

// Block boundary keywords (used with prefix)
export const KEYWORD_BEGIN = 'BEGIN';
export const KEYWORD_END = 'END';

// Header keywords (required fields, without prefix or colon)
export const KEYWORD_FILE = 'FILE';
export const KEYWORD_MODE = 'MODE';

// Directive keywords (optional fields, without prefix or colon)
export const KEYWORD_START = 'START';
export const KEYWORD_START_BEFORE = 'START_BEFORE';
export const KEYWORD_START_AFTER = 'START_AFTER';
export const KEYWORD_SCOPE_START = 'SCOPE_START';
export const KEYWORD_SCOPE_END = 'SCOPE_END';
export const KEYWORD_END_BEFORE = 'END_BEFORE';
export const KEYWORD_END_AFTER = 'END_AFTER';

// Header markers (with colon suffix, no prefix)
export const HEADER_FILE = `${KEYWORD_FILE}:`;
export const HEADER_MODE = `${KEYWORD_MODE}:`;

// Directive markers (with colon suffix, no prefix)
export const DIRECTIVE_START = `${KEYWORD_START}:`;
export const DIRECTIVE_END = `${KEYWORD_END}:`;
export const DIRECTIVE_START_BEFORE = `${KEYWORD_START_BEFORE}:`;
export const DIRECTIVE_START_AFTER = `${KEYWORD_START_AFTER}:`;
export const DIRECTIVE_END_BEFORE = `${KEYWORD_END_BEFORE}:`;
export const DIRECTIVE_END_AFTER = `${KEYWORD_END_AFTER}:`;
export const DIRECTIVE_SCOPE_START = `${KEYWORD_SCOPE_START}:`;
export const DIRECTIVE_SCOPE_END = `${KEYWORD_SCOPE_END}:`;

// Canonical header keys
export const HEADER_KEYS = [
  KEYWORD_FILE,
  KEYWORD_MODE,
] as const;

// Canonical directive keys (excludes headers)
export const DIRECTIVE_KEYS = [
  KEYWORD_START,
  KEYWORD_START_BEFORE,
  KEYWORD_START_AFTER,
  KEYWORD_END,
  KEYWORD_END_BEFORE,
  KEYWORD_END_AFTER,
  KEYWORD_SCOPE_START,
  KEYWORD_SCOPE_END,
] as const;

// All block field keys (headers + directives combined)
export const ALL_FIELD_KEYS = [
  ...HEADER_KEYS,
  ...DIRECTIVE_KEYS,
] as const;

// Block boundary markers (with prefix)
export const INSCRIBE_BEGIN = `${INSCRIBE_PREFIX} ${KEYWORD_BEGIN}`;
export const INSCRIBE_END = `${INSCRIBE_PREFIX} ${KEYWORD_END}`;

// Valid modes
export const VALID_MODES = ['create', 'replace', 'append', 'range', 'delete'] as const;
export const DEFAULT_MODE = 'replace';
