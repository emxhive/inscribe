/**
 * Shared constants for Inscribe
 */

// Inscribe directory and metadata - define first as they're used by other constants
export const INSCRIBE_DIR = '.inscribe';
export const INSCRIBE_IGNORE_FILE = '.inscribeignore';
export const HISTORY_STORE_DIR = 'history';

export const IGNORED_PATHS = [
  '.git/',
  'node_modules/',
  'vendor/',
  'storage/',
  'bootstrap/cache/',
  'public/build/',
  `${INSCRIBE_DIR}/`,
] as const;

export const RESTORE_DIRECTIVE_EXPECT_CONTENT = 'EXPECT_CONTENT';
export const RESTORE_DIRECTIVE_EXPECT_APPEND_AT_END = 'EXPECT_APPEND_AT_END';
export const RESTORE_DIRECTIVE_REMOVE_APPEND = 'RESTORE_REMOVE';
export const RESTORE_DIRECTIVE_V2_PAYLOAD = 'RESTORE_V2_PAYLOAD';
export const RESTORE_DIRECTIVE_V2_SCHEMA = 'RESTORE_V2_SCHEMA';

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
export const INSCRIBE_PREFIX = '$inscribe';

// Block boundary keywords (used with prefix)
export const KEYWORD_BEGIN = 'BEGIN';
export const KEYWORD_END = 'END';

// Header keywords (required fields, without prefix or colon)
export const KEYWORD_FILE = 'FILE';
export const KEYWORD_MODE = 'MODE';

// Directive keywords (optional fields, without prefix or colon)
export const KEYWORD_START_LINE_CONTAINS = 'START_LINE_CONTAINS';
export const KEYWORD_START_LINE_EQUALS = 'START_LINE_EQUALS';
export const KEYWORD_END_LINE_CONTAINS = 'END_LINE_CONTAINS';
export const KEYWORD_END_LINE_EQUALS = 'END_LINE_EQUALS';
export const KEYWORD_RANGE_CONTAINS = 'RANGE_CONTAINS';
export const KEYWORD_NAME = 'NAME';

// Legacy Directive keywords (for migration reporting)
export const KEYWORD_START = 'START';
export const KEYWORD_CONTAINS = 'CONTAINS';

// Header markers (with colon suffix, no prefix)
export const HEADER_FILE = `${KEYWORD_FILE}:`;
export const HEADER_MODE = `${KEYWORD_MODE}:`;

// Directive markers (with colon suffix, no prefix)
export const DIRECTIVE_START_LINE_CONTAINS = `${KEYWORD_START_LINE_CONTAINS}:`;
export const DIRECTIVE_START_LINE_EQUALS = `${KEYWORD_START_LINE_EQUALS}:`;
export const DIRECTIVE_END_LINE_CONTAINS = `${KEYWORD_END_LINE_CONTAINS}:`;
export const DIRECTIVE_END_LINE_EQUALS = `${KEYWORD_END_LINE_EQUALS}:`;
export const DIRECTIVE_RANGE_CONTAINS = `${KEYWORD_RANGE_CONTAINS}:`;
export const DIRECTIVE_NAME = `${KEYWORD_NAME}:`;

// Legacy Directive markers
export const DIRECTIVE_START = `${KEYWORD_START}:`;
export const DIRECTIVE_END = 'END:';
export const DIRECTIVE_CONTAINS = `${KEYWORD_CONTAINS}:`;

// Canonical header keys
export const HEADER_KEYS = [
  KEYWORD_FILE,
  KEYWORD_MODE,
] as const;

// Canonical directive keys (excludes headers)
export const DIRECTIVE_KEYS = [
  KEYWORD_START_LINE_CONTAINS,
  KEYWORD_START_LINE_EQUALS,
  KEYWORD_END_LINE_CONTAINS,
  KEYWORD_END_LINE_EQUALS,
  KEYWORD_RANGE_CONTAINS,
  KEYWORD_NAME,
] as const;

// Legacy directive keys are parse-only and exist solely for migration errors.
export const LEGACY_DIRECTIVE_KEYS = [
  KEYWORD_START,
  KEYWORD_END,
  KEYWORD_CONTAINS,
] as const;

// All block field keys (headers + directives combined)
export const ALL_FIELD_KEYS = [
  ...HEADER_KEYS,
  ...DIRECTIVE_KEYS,
] as const;

// All parse-recognized field keys, including legacy directives for diagnostics.
export const PARSE_FIELD_KEYS = [
  ...ALL_FIELD_KEYS,
  ...LEGACY_DIRECTIVE_KEYS,
] as const;

// Block boundary markers (with prefix)
export const INSCRIBE_BEGIN = `${INSCRIBE_PREFIX} ${KEYWORD_BEGIN}`;
export const INSCRIBE_END = `${INSCRIBE_PREFIX} ${KEYWORD_END}`;
