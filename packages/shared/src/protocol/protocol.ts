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

export type ModeNonEmptyField =
  | { kind: 'directive'; directive: DirectiveKey }
  | { kind: 'section'; section: SectionName };

export interface ModeRule {
  requiredDirectives: readonly DirectiveKey[];
  forbiddenDirectives: readonly DirectiveKey[];
  requiredSections: readonly SectionName[];
  forbiddenSections: readonly SectionName[];
  nonEmptyWhenPresent: readonly ModeNonEmptyField[];
  sectionRequiresDirectives: readonly {
    section: SectionName;
    requiredDirectives: readonly DirectiveKey[];
  }[];
}

export const MODE_RULES: Record<InscribeOperationMode, ModeRule> = {
  create_file: {
    requiredDirectives: ['FILE', 'MODE'],
    forbiddenDirectives: ['SELECTOR'],
    requiredSections: ['CONTENT'],
    forbiddenSections: ['SEARCH', 'STARTS_WITH'],
    nonEmptyWhenPresent: [
      { kind: 'directive', directive: 'SELECTOR' },
    ],
    sectionRequiresDirectives: [],
  },
  replace_file: {
    requiredDirectives: ['FILE', 'MODE'],
    forbiddenDirectives: ['SELECTOR'],
    requiredSections: ['CONTENT'],
    forbiddenSections: ['SEARCH', 'STARTS_WITH'],
    nonEmptyWhenPresent: [
      { kind: 'directive', directive: 'SELECTOR' },
    ],
    sectionRequiresDirectives: [],
  },
  delete_file: {
    requiredDirectives: ['FILE', 'MODE'],
    forbiddenDirectives: ['SELECTOR'],
    requiredSections: [],
    forbiddenSections: ['CONTENT', 'SEARCH', 'STARTS_WITH'],
    nonEmptyWhenPresent: [
      { kind: 'directive', directive: 'SELECTOR' },
    ],
    sectionRequiresDirectives: [],
  },
  replace_text: {
    requiredDirectives: ['FILE', 'MODE'],
    forbiddenDirectives: [],
    requiredSections: ['SEARCH', 'CONTENT'],
    forbiddenSections: [],
    nonEmptyWhenPresent: [
      { kind: 'section', section: 'SEARCH' },
      { kind: 'directive', directive: 'SELECTOR' },
      { kind: 'section', section: 'STARTS_WITH' },
    ],
    sectionRequiresDirectives: [
      { section: 'STARTS_WITH', requiredDirectives: ['SELECTOR'] },
    ],
  },
  replace_node: {
    requiredDirectives: ['FILE', 'MODE', 'SELECTOR'],
    forbiddenDirectives: [],
    requiredSections: ['CONTENT'],
    forbiddenSections: ['SEARCH'],
    nonEmptyWhenPresent: [
      { kind: 'directive', directive: 'SELECTOR' },
      { kind: 'section', section: 'STARTS_WITH' },
    ],
    sectionRequiresDirectives: [],
  },
};

export interface ModeShapeView {
  hasDirective(directive: DirectiveKey): boolean;
  getDirectiveValue(directive: DirectiveKey): string | undefined;
  hasSection(section: SectionName): boolean;
  isSectionEmpty(section: SectionName): boolean;
}

export type ModeShapeViolation =
  | { kind: 'section_requires_directive'; section: SectionName; directive: DirectiveKey }
  | { kind: 'forbidden_directive'; directive: DirectiveKey }
  | { kind: 'forbidden_section'; section: SectionName }
  | { kind: 'missing_required_directive'; directive: DirectiveKey }
  | { kind: 'missing_required_section'; section: SectionName }
  | { kind: 'empty_directive'; directive: DirectiveKey }
  | { kind: 'empty_section'; section: SectionName };

export function validateModeShape(
  mode: InscribeOperationMode,
  shape: ModeShapeView,
): ModeShapeViolation[] {
  // Keep this order stable: strict parsing reports the first violation, while
  // intake preserves the same ordering when it surfaces all violations.
  const rules = MODE_RULES[mode];
  const violations: ModeShapeViolation[] = [];

  for (const requirement of rules.sectionRequiresDirectives) {
    if (!shape.hasSection(requirement.section)) {
      continue;
    }
    for (const directive of requirement.requiredDirectives) {
      if (!shape.hasDirective(directive)) {
        violations.push({
          kind: 'section_requires_directive',
          section: requirement.section,
          directive,
        });
      }
    }
  }

  for (const directive of rules.forbiddenDirectives) {
    if (shape.hasDirective(directive)) {
      violations.push({ kind: 'forbidden_directive', directive });
    }
  }

  for (const section of rules.forbiddenSections) {
    if (shape.hasSection(section)) {
      violations.push({ kind: 'forbidden_section', section });
    }
  }

  for (const directive of rules.requiredDirectives) {
    if (!shape.hasDirective(directive)) {
      violations.push({ kind: 'missing_required_directive', directive });
    }
  }

  for (const section of rules.requiredSections) {
    if (!shape.hasSection(section)) {
      violations.push({ kind: 'missing_required_section', section });
    }
  }

  for (const field of rules.nonEmptyWhenPresent) {
    if (field.kind === 'directive') {
      if (
        shape.hasDirective(field.directive)
        && !(shape.getDirectiveValue(field.directive) ?? '').trim()
      ) {
        violations.push({ kind: 'empty_directive', directive: field.directive });
      }
      continue;
    }

    if (shape.hasSection(field.section) && shape.isSectionEmpty(field.section)) {
      violations.push({ kind: 'empty_section', section: field.section });
    }
  }

  return violations;
}
