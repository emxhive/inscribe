export const INSCRIBE_BLOCK_OPEN = '<<<INSCRIBE';
export const INSCRIBE_BLOCK_CLOSE = 'INSCRIBE>>>';

export const SECTION_NAMES = [
  'CONTENT',
  'SEARCH',
  'STARTS_WITH',
] as const;

export const DIRECTIVE_KEYS = [
  'FILE',
  'MODE',
  'SELECTOR',
] as const;

export const PROTOCOL_OPERATION_MODES = [
  'create_file',
  'replace_file',
  'delete_file',
  'replace_text',
  'replace_node',
] as const;

export type SectionName = (typeof SECTION_NAMES)[number];
export type DirectiveKey = (typeof DIRECTIVE_KEYS)[number];
export type InscribeOperationMode = (typeof PROTOCOL_OPERATION_MODES)[number];

export const SECTION_OPEN_MARKERS = SECTION_NAMES.map(name => `<<<${name}`);
export const SECTION_CLOSE_MARKERS = SECTION_NAMES.map(name => `${name}>>>`);

export const RESERVED_MARKERS = new Set<string>([
  INSCRIBE_BLOCK_OPEN,
  INSCRIBE_BLOCK_CLOSE,
  ...SECTION_OPEN_MARKERS,
  ...SECTION_CLOSE_MARKERS,
]);

export function isExactMarkerLine(line: string): boolean {
  return RESERVED_MARKERS.has(line.trim());
}

export function validateRelativeFilePath(filePath: string): string | null {
  const trimmed = filePath.trim();
  if (!trimmed) {
    return 'empty path';
  }
  // Check for NUL bytes or control characters
  for (let idx = 0; idx < trimmed.length; idx++) {
    const code = trimmed.charCodeAt(idx);
    if (code === 0 || (code >= 1 && code <= 31) || code === 127) {
      return 'path contains control characters';
    }
  }

  // Check UNC paths before the generic leading-slash condition
  if (trimmed.startsWith('//')) {
    return 'UNC path';
  }

  // Reject absolute paths starting with /
  if (trimmed.startsWith('/')) {
    return 'absolute path';
  }
  // Reject drive-letter paths (e.g. C:\ or C:/ or just C:)
  if (/^[a-zA-Z]:/.test(trimmed)) {
    return 'drive-letter path';
  }
  // Reject backslashes
  if (trimmed.includes('\\')) {
    return 'path contains backslashes';
  }

  // Reject Windows-invalid characters anywhere in the path
  const invalidChars = [':', '*', '?', '"', '<', '>', '|'];
  for (const char of invalidChars) {
    if (trimmed.includes(char)) {
      return `path contains invalid character: ${char}`;
    }
  }

  // Split by slashes to check segments
  const segments = trimmed.split('/');
  for (const segment of segments) {
    if (segment === '.') {
      return 'path contains . segment';
    }
    if (segment === '..') {
      return 'path contains .. segment';
    }
    if (segment === '') {
      return 'path contains empty segment or repeated slashes';
    }
    if (segment.endsWith('.') || segment.endsWith(' ')) {
      return 'path segment ends with dot or space';
    }
  }
  // Reject trailing slash
  if (trimmed.endsWith('/')) {
    return 'path contains trailing slash';
  }
  return null;
}

export interface ModeRule {
  requiredDirectives: readonly DirectiveKey[];
  forbiddenDirectives: readonly DirectiveKey[];
  requiredSections: readonly SectionName[];
  forbiddenSections: readonly SectionName[];
  nonEmptyWhenPresentSections: readonly SectionName[];
}

export const MODE_RULES: Record<InscribeOperationMode, ModeRule> = {
  create_file: {
    requiredDirectives: ['FILE', 'MODE'],
    forbiddenDirectives: ['SELECTOR'],
    requiredSections: ['CONTENT'],
    forbiddenSections: ['SEARCH', 'STARTS_WITH'],
    nonEmptyWhenPresentSections: [],
  },
  replace_file: {
    requiredDirectives: ['FILE', 'MODE'],
    forbiddenDirectives: ['SELECTOR'],
    requiredSections: ['CONTENT'],
    forbiddenSections: ['SEARCH', 'STARTS_WITH'],
    nonEmptyWhenPresentSections: [],
  },
  delete_file: {
    requiredDirectives: ['FILE', 'MODE'],
    forbiddenDirectives: ['SELECTOR'],
    requiredSections: [],
    forbiddenSections: ['CONTENT', 'SEARCH', 'STARTS_WITH'],
    nonEmptyWhenPresentSections: [],
  },
  replace_text: {
    requiredDirectives: ['FILE', 'MODE'],
    forbiddenDirectives: ['SELECTOR'],
    requiredSections: ['SEARCH', 'CONTENT'],
    forbiddenSections: ['STARTS_WITH'],
    nonEmptyWhenPresentSections: ['SEARCH'],
  },
  replace_node: {
    requiredDirectives: ['FILE', 'MODE', 'SELECTOR'],
    forbiddenDirectives: [],
    requiredSections: ['CONTENT'],
    forbiddenSections: ['SEARCH'],
    nonEmptyWhenPresentSections: ['STARTS_WITH'],
  },
};
