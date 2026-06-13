import {
  INSCRIBE_BEGIN,
  INSCRIBE_END,
  INSCRIBE_PREFIX,
  OPERATION_MODES,
  matchesMarker,
  startsWithMarker,
  parseDirectiveLine,
  formatLegacyDirectiveError,
  isLegacyDirectiveKey,
  type FieldKey,
  type LegacyDirectiveKey,
  PARSE_FIELD_KEYS,
  HEADER_KEYS,
  normalizeRelativePath,
  type V2SectionName,
} from '@inscribe/shared';

export type IntakeDirectiveKey = FieldKey | LegacyDirectiveKey;

export type IntakeProtocol = 'v1' | 'v2';

export interface IntakeDirective {
  key: IntakeDirectiveKey;
  value: string;
  lineIndex: number;
  raw: string;
}

export interface IntakeBlock {
  protocol: IntakeProtocol;
  id: string;
  index: number;
  startLine: number;
  endLine: number;
  directives: Partial<Record<IntakeDirectiveKey, IntakeDirective>>;
  warnings: string[];
  errors: string[];
  status: 'valid' | 'incomplete' | 'warning' | 'error';
  label: string;
  filePath?: string;
  mode?: string;
  selectorText?: string;
  sections?: Partial<Record<V2SectionName, {
    openLine: number;
    closeLine?: number;
    contentStartLine?: number;
    contentEndLine?: number;
    isEmpty?: boolean;
  }>>;
}

export interface IntakeLineMeta {
  text: string;
  lineIndex: number;
  blockId?: string;
  type:
    | 'text'
    | 'begin'
    | 'end'
    | 'header'
    | 'directive'
    | 'unknown-directive'
    | 'section-open'
    | 'section-close'
    | 'payload';
  status?: 'incomplete' | 'warning' | 'error';
}

const isFenceLine = (line: string) => line.trim().startsWith('` ` `'.replace(/ /g, ''));
const parseFieldKeySet = new Set<string>(PARSE_FIELD_KEYS);

export interface IntakeNormalizationRepair {
  lineIndex: number;
  original: string;
  normalized: string;
  message: string;
}

export interface IntakeNormalizationResult {
  text: string;
  repairs: IntakeNormalizationRepair[];
  changed: boolean;
}

const getBoundaryNormalization = (line: string): { keyword: 'BEGIN' | 'END'; normalized: string; message?: string } | null => {
  // Check if it's perfectly clean first (fast path)
  if (matchesMarker(line, INSCRIBE_BEGIN)) return { keyword: 'BEGIN', normalized: line };
  if (matchesMarker(line, INSCRIBE_END)) return { keyword: 'END', normalized: line };

  const trimmedUpper = line.trim().toUpperCase();

  // If it starts with the marker, we don't care what trailing junk (or \r) comes after it
  if (trimmedUpper.startsWith('$INSCRIBE BEGIN') || trimmedUpper.startsWith('$INSCRIBE END')) {
    const keyword = trimmedUpper.startsWith('$INSCRIBE BEGIN') ? 'BEGIN' : 'END';
    const marker = keyword === 'BEGIN' ? INSCRIBE_BEGIN : INSCRIBE_END;
    const leadingWhitespace = line.match(/^\s*/)?.[0] || '';

    return {
      keyword,
      normalized: `${leadingWhitespace}${marker}`,
      message: `Trailing text removed after ${marker} marker; marker lines must contain only ${marker}.`,
    };
  }

  return null;
};

const getPrefixedFieldNormalization = (line: string): { normalized: string; message: string } | null => {
  const prefixedFieldMatch = line.match(/^(\s*)\$inscribe\s+([A-Za-z_]+):(.*)$/);
  if (!prefixedFieldMatch) {
    return null;
  }

  const key = prefixedFieldMatch[2].toUpperCase();
  if (!parseFieldKeySet.has(key)) {
    return null;
  }

  return {
    normalized: `${prefixedFieldMatch[1]}${key}:${prefixedFieldMatch[3]}`,
    message: `${key} normalized by removing the $inscribe prefix; headers and directives must be unprefixed.`,
  };
};

export function normalizeInscribeInput(input: string): IntakeNormalizationResult {
  const lines = input.split('\n');
  const normalizedLines = [...lines];
  const repairs: IntakeNormalizationRepair[] = [];
  let inBlock = false;
  let directivesLocked = false;

  lines.forEach((line, lineIndex) => {
    const boundary = getBoundaryNormalization(line);
    if (boundary) {
      normalizedLines[lineIndex] = boundary.normalized;
      if (boundary.message && boundary.normalized !== line) {
        repairs.push({
          lineIndex,
          original: line,
          normalized: boundary.normalized,
          message: boundary.message,
        });
      }
      inBlock = boundary.keyword === 'BEGIN';
      directivesLocked = false;
      return;
    }

    if (!inBlock) {
      return;
    }

    if (isFenceLine(line)) {
      directivesLocked = true;
      return;
    }

    if (directivesLocked) {
      return;
    }

    const prefixedField = getPrefixedFieldNormalization(line);
    if (!prefixedField) {
      return;
    }

    normalizedLines[lineIndex] = prefixedField.normalized;
    repairs.push({
      lineIndex,
      original: line,
      normalized: prefixedField.normalized,
      message: prefixedField.message,
    });
  });

  return {
    text: normalizedLines.join('\n'),
    repairs,
    changed: repairs.length > 0,
  };
}

export function parseIntakeStructure(
  input: string,
  options?: { indexedFileSet?: Set<string> },
): {
  blocks: IntakeBlock[];
  lines: IntakeLineMeta[];
} {
  const normalization = normalizeInscribeInput(input);
  const lines = normalization.text.split('\n');
  const originalLines = input.split('\n');
  const repairByLine = new Map(normalization.repairs.map((repair) => [repair.lineIndex, repair]));
  const lineMeta: IntakeLineMeta[] = originalLines.map((text, lineIndex) => ({
    text,
    lineIndex,
    type: 'text',
  }));

  const blocks: IntakeBlock[] = [];
  let current: (IntakeBlock & { directivesLocked?: boolean }) | null = null;

  const finalizeBlock = (block: IntakeBlock, endLine: number) => {
    block.endLine = endLine;

    if (!block.directives.FILE) {
      block.warnings.push('Missing FILE header');
    }

    if (!block.directives.MODE) {
      block.warnings.push('Missing MODE header');
    }

    const modeValue = block.directives.MODE?.value?.trim();
    if (modeValue && !OPERATION_MODES.includes(modeValue as (typeof OPERATION_MODES)[number])) {
      block.warnings.push(`Unknown MODE header value: ${block.directives.MODE?.value}`);
    }

    const activeMode = modeValue as (typeof OPERATION_MODES)[number];
    const isPartialReplacement = ['replace_line', 'replace_range', 'replace_between', 'replace_block'].includes(activeMode);

    if (isPartialReplacement) {
      const hasStart = block.directives.START_LINE_CONTAINS || block.directives.START_LINE_EQUALS;
      if (!hasStart) {
        block.warnings.push(`Missing START boundary selector for ${activeMode} mode`);
      }

      const isRangeOrBetween = ['replace_range', 'replace_between'].includes(activeMode);
      if (isRangeOrBetween) {
        const hasEnd = block.directives.END_LINE_CONTAINS || block.directives.END_LINE_EQUALS;
        if (!hasEnd) {
          block.warnings.push(`Missing END boundary selector for ${activeMode} mode`);
        }
      }
    }

    const fileValue = block.directives.FILE?.value?.trim();
    const normalizedFile = fileValue ? normalizeRelativePath(fileValue) : '';
    if (options?.indexedFileSet && normalizedFile) {
      const isIndexed = options.indexedFileSet.has(normalizedFile);
      if (modeValue === 'create_file' && isIndexed) {
        block.warnings.push(`MODE=create_file targets an existing indexed file: ${normalizedFile}`);
      }
      if (modeValue !== 'create_file' && !isIndexed && OPERATION_MODES.includes(modeValue as (typeof OPERATION_MODES)[number])) {
        block.warnings.push(`MODE=${modeValue} targets a file that is not indexed: ${normalizedFile}`);
      }
    }

    if (block.errors.length > 0) {
      block.status = 'error';
    } else if (block.warnings.length > 0) {
      block.status = 'warning';
    } else {
      block.status = 'valid';
    }

    block.label = block.directives.FILE?.value || `Block ${block.index + 1}`;
    blocks.push(block);
  };

  lines.forEach((line, lineIndex) => {
    const repair = repairByLine.get(lineIndex);

    if (matchesMarker(line, INSCRIBE_BEGIN)) {
      if (current) {
        current.errors.push('Missing $inscribe END');
        finalizeBlock(current, lineIndex - 1);
      }

      current = {
        protocol: 'v1',
        id: `block-${blocks.length + 1}-${lineIndex}`,
        index: blocks.length,
        startLine: lineIndex,
        endLine: lineIndex,
        directives: {},
        warnings: [],
        errors: [],
        status: 'valid',
        label: '',
        directivesLocked: false,
      };

      if (repair) {
        current.warnings.push(repair.message);
        lineMeta[lineIndex].status = 'warning';
      }
      lineMeta[lineIndex].type = 'begin';
      lineMeta[lineIndex].blockId = current.id;
      return;
    }

    if (matchesMarker(line, INSCRIBE_END)) {
      if (current) {
        if (repair) {
          current.warnings.push(repair.message);
          lineMeta[lineIndex].status = 'warning';
        }
        lineMeta[lineIndex].type = 'end';
        lineMeta[lineIndex].blockId = current.id;
        finalizeBlock(current, lineIndex);
        current = null;
      } else {
        const orphanBlock: IntakeBlock = {
          protocol: 'v1',
          id: `orphan-end-${lineIndex}`,
          index: blocks.length,
          startLine: lineIndex,
          endLine: lineIndex,
          directives: {},
          warnings: [],
          errors: ['END marker without matching BEGIN'],
          status: 'error',
          label: 'Orphan END',
        };
        blocks.push(orphanBlock);
        lineMeta[lineIndex].type = 'end';
        lineMeta[lineIndex].status = 'error';
      }
      return;
    }

    if (!current) {
      if (startsWithMarker(line, INSCRIBE_PREFIX)) {
        lineMeta[lineIndex].type = 'unknown-directive';
        lineMeta[lineIndex].status = 'warning';
      }
      return;
    }

    lineMeta[lineIndex].blockId = current.id;

    if (line.trim().startsWith('` ` `'.replace(/ /g, ''))) {
      current.directivesLocked = true;
      return;
    }

    if (current.directivesLocked) {
      return;
    }

    const parsed = parseDirectiveLine(line);
    if (!parsed.matched) {
      if (parsed.usedPrefix) {
        current.warnings.push(
          'Invalid header or directive format (headers and directives should not use $inscribe prefix)'
        );
        lineMeta[lineIndex].type = 'unknown-directive';
        lineMeta[lineIndex].status = 'warning';
      }
      return;
    }

    const key = parsed.key as IntakeDirectiveKey;
    const value = parsed.value ?? '';
    if (repair) {
      current.warnings.push(repair.message);
      lineMeta[lineIndex].status = 'warning';
    }

    if (isLegacyDirectiveKey(key)) {
      current.errors.push(formatLegacyDirectiveError(key));
      lineMeta[lineIndex].type = 'unknown-directive';
      lineMeta[lineIndex].status = 'error';
      return;
    }

    const existing = current.directives[key];
    if ((key === 'RANGE_CONTAINS' || key === 'RANGE_LINE_CONTAINS_ALL') && existing) {
      existing.value = `${existing.value}\n${value}`;
    } else {
      current.directives[key] = {
        key,
        value,
        lineIndex,
        raw: line,
      };
    }

    const isHeader = HEADER_KEYS.includes(key as (typeof HEADER_KEYS)[number]);
    lineMeta[lineIndex].type = isHeader ? 'header' : 'directive';
    if (!value) {
      current.warnings.push(`${key} ${isHeader ? 'header' : 'directive'} missing value`);
      lineMeta[lineIndex].status = 'warning';
    }
  });

  const openBlock = current as IntakeBlock | null;
  if (openBlock) {
    openBlock.errors.push('Missing $inscribe END');
    finalizeBlock(openBlock, lines.length - 1);
  }

  return { blocks, lines: lineMeta };
}

export function updateDirectiveInText(
  input: string,
  block: IntakeBlock,
  key: IntakeDirectiveKey,
  value: string,
  options?: { allowEmptyInsert?: boolean; keepEmpty?: boolean },
): string {
  if (block.startLine < 0) {
    return input;
  }

  const lines = input.split('\n');
  const nextValue = value.trim();
  const directive = block.directives[key];
  const marker = directive && directive.raw.trim().startsWith(INSCRIBE_PREFIX)
    ? `${INSCRIBE_PREFIX} ${key}:`
    : `${key}:`;

  if (directive) {
    const line = lines[directive.lineIndex] ?? '';
    const leadingWhitespace = line.match(/^\s*/)?.[0] ?? '';
    if (!nextValue) {
      if (options?.keepEmpty) {
        lines[directive.lineIndex] = `${leadingWhitespace}${marker}`;
        return lines.join('\n');
      }
      lines.splice(directive.lineIndex, 1);
    } else {
      lines[directive.lineIndex] = `${leadingWhitespace}${marker} ${value}`;
    }
    return lines.join('\n');
  }

  if (!nextValue && !options?.allowEmptyInsert) {
    return input;
  }

  const beginLine = lines[block.startLine] ?? '';
  const leadingWhitespace = beginLine.match(/^\s*/)?.[0] ?? '';
  const insertIndex = Math.min(block.startLine + 1, lines.length);
  const suffix = nextValue ? ` ${value}` : '';
  lines.splice(insertIndex, 0, `${leadingWhitespace}${marker}${suffix}`);
  return lines.join('\n');
}
