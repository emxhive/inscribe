/**
 * Shared constants for Inscribe
 */
export declare const INDEXED_ROOTS: readonly ["app/", "routes/", "resources/", "database/", "config/", "tests/"];
export declare const IGNORED_PATHS: readonly [".git/", "node_modules/", "vendor/", "storage/", "bootstrap/cache/", "public/build/", ".inscribe/"];
export declare const BACKUP_DIR = ".inscribe/backups";
export declare const INSCRIBE_BEGIN = "@inscribe BEGIN";
export declare const INSCRIBE_END = "@inscribe END";
export declare const INSCRIBE_FILE = "@inscribe FILE:";
export declare const INSCRIBE_MODE = "@inscribe MODE:";
export declare const INSCRIBE_START = "@inscribe START:";
export declare const INSCRIBE_END_ANCHOR = "@inscribe END:";
export declare const INSCRIBE_SCOPE_START = "@inscribe SCOPE_START:";
export declare const INSCRIBE_SCOPE_END = "@inscribe SCOPE_END:";
