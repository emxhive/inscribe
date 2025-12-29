"use strict";
/**
 * Shared constants for Inscribe
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.INSCRIBE_SCOPE_END = exports.INSCRIBE_SCOPE_START = exports.INSCRIBE_END_ANCHOR = exports.INSCRIBE_START = exports.INSCRIBE_MODE = exports.INSCRIBE_FILE = exports.INSCRIBE_END = exports.INSCRIBE_BEGIN = exports.BACKUP_DIR = exports.IGNORED_PATHS = exports.INDEXED_ROOTS = void 0;
exports.INDEXED_ROOTS = [
    'app/',
    'routes/',
    'resources/',
    'database/',
    'config/',
    'tests/',
];
exports.IGNORED_PATHS = [
    '.git/',
    'node_modules/',
    'vendor/',
    'storage/',
    'bootstrap/cache/',
    'public/build/',
    '.inscribe/',
];
exports.BACKUP_DIR = '.inscribe/backups';
exports.INSCRIBE_BEGIN = '@inscribe BEGIN';
exports.INSCRIBE_END = '@inscribe END';
exports.INSCRIBE_FILE = '@inscribe FILE:';
exports.INSCRIBE_MODE = '@inscribe MODE:';
exports.INSCRIBE_START = '@inscribe START:';
exports.INSCRIBE_END_ANCHOR = '@inscribe END:';
exports.INSCRIBE_SCOPE_START = '@inscribe SCOPE_START:';
exports.INSCRIBE_SCOPE_END = '@inscribe SCOPE_END:';
