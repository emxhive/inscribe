/**
 * Shared constants for Inscribe
 */

// Inscribe directory and metadata - define first as they're used by other constants
export const INSCRIBE_DIR = '.inscribe';
export const INSCRIBE_IGNORE_FILE = '.inscribeignore';
export const HISTORY_STORE_DIR = 'history';

export const IGNORED_PATHS = [
  '.git/',
  '.hg/',
  '.svn/',
  '.*',
  '.*/**',
  '**/.*',
  '**/.*/**',
  '*.log',
  '*.tmp',
  '*.temp',
  '*~',
  'Thumbs.db',
  '.DS_Store',
  'node_modules/',
  'bower_components/',
  'jspm_packages/',
  '.next/',
  '.nuxt/',
  '.svelte-kit/',
  '.astro/',
  '.vite/',
  '.turbo/',
  '.parcel-cache/',
  '.yarn/cache/',
  '.pnpm-store/',
  'vendor/',
  'dist/',
  'build/',
  'out/',
  'coverage/',
  '.nyc_output/',
  '.cache/',
  '.temp/',
  '.tmp/',
  'tmp/',
  'temp/',
  '__pycache__/',
  '.pytest_cache/',
  '.mypy_cache/',
  '.ruff_cache/',
  '.tox/',
  '.nox/',
  '.venv/',
  'venv/',
  'env/',
  '.gradle/',
  'target/',
  'bin/',
  'obj/',
  '.idea/',
  '.vscode/',
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
