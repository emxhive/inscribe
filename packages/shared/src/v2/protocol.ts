export const V2_BLOCK_OPEN = '<<<INSCRIBE';
export const V2_BLOCK_CLOSE = 'INSCRIBE>>>';

export const V2_SECTION_NAMES = [
  'CONTENT',
  'SEARCH',
  'STARTS_WITH',
] as const;

export const V2_DIRECTIVE_KEYS = [
  'FILE',
  'MODE',
  'SELECTOR',
] as const;

export const V2_OPERATION_MODES = [
  'create_file',
  'replace_file',
  'delete_file',
  'replace_text',
  'replace_node',
] as const;

export type V2SectionName = (typeof V2_SECTION_NAMES)[number];
export type V2DirectiveKey = (typeof V2_DIRECTIVE_KEYS)[number];
export type V2OperationMode = (typeof V2_OPERATION_MODES)[number];

export const V2_SECTION_OPEN_MARKERS = V2_SECTION_NAMES.map(name => `<<<${name}`);
export const V2_SECTION_CLOSE_MARKERS = V2_SECTION_NAMES.map(name => `${name}>>>`);

export const V2_RESERVED_MARKERS = new Set<string>([
  V2_BLOCK_OPEN,
  V2_BLOCK_CLOSE,
  ...V2_SECTION_OPEN_MARKERS,
  ...V2_SECTION_CLOSE_MARKERS,
]);

export function isExactV2MarkerLine(line: string): boolean {
  return V2_RESERVED_MARKERS.has(line.trim());
}

export function validateV2RelativeFilePath(filePath: string): string | null {
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

export interface V2ModeRule {
  requiredDirectives: readonly V2DirectiveKey[];
  forbiddenDirectives: readonly V2DirectiveKey[];
  requiredSections: readonly V2SectionName[];
  forbiddenSections: readonly V2SectionName[];
  nonEmptyWhenPresentSections: readonly V2SectionName[];
}

export const V2_MODE_RULES: Record<V2OperationMode, V2ModeRule> = {
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
    nonEmptyWhenPresentSections: ['CONTENT', 'STARTS_WITH'],
  },
};
