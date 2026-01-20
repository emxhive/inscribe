import {
  INSCRIBE_BEGIN,
  INSCRIBE_END,
  INSCRIBE_PREFIX,
  VALID_MODES,
  matchesMarker,
  startsWithMarker,
  parseDirectiveLine,
  FieldKey,
  HEADER_KEYS,
  normalizeRelativePath,
} from '@inscribe/shared';

export type IntakeDirectiveKey = FieldKey;

export interface IntakeDirective {
  key: IntakeDirectiveKey;
  value: string;
  lineIndex: number;
  raw: string;
}

export interface IntakeBlock {
  id: string;
  index: number;
  startLine: number;
  endLine: number;
  directives: Partial<Record<IntakeDirectiveKey, IntakeDirective>>;
  warnings: string[];
  errors: string[];
  status: 'valid' | 'warning' | 'error';
  label: string;
}

export interface IntakeLineMeta {
  text: string;
  lineIndex: number;
  blockId?: string;
  type: 'text' | 'begin' | 'end' | 'header' | 'directive' | 'unknown-directive';
  status?: 'warning' | 'error';
}

const isFenceLine = (line: string) => line.trim().startsWith('```');

export function parseIntakeStructure(
  input: string,
  options?: { indexedFileSet?: Set<string> },
): {
  blocks: IntakeBlock[];
  lines: IntakeLineMeta[];
} {
  const lines = input.split('\n');
  const lineMeta: IntakeLineMeta[] = lines.map((text, lineIndex) => ({
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

    const modeValue = block.directives.MODE?.value?.toLowerCase();
    if (modeValue && !VALID_MODES.includes(modeValue as (typeof VALID_MODES)[number])) {
      block.warnings.push(`Unknown MODE header value: ${block.directives.MODE?.value}`);
    }

    if (modeValue === 'range') {
      const hasStart = Boolean(
        block.directives.START || block.directives.START_BEFORE || block.directives.START_AFTER
      );
      if (!hasStart) {
        block.warnings.push('Missing START directive for range mode');
      }
    }

    const fileValue = block.directives.FILE?.value?.trim();
    const normalizedFile = fileValue ? normalizeRelativePath(fileValue) : '';
    if (options?.indexedFileSet && normalizedFile) {
      const isIndexed = options.indexedFileSet.has(normalizedFile);
      if (modeValue === 'create' && isIndexed) {
        block.warnings.push(`MODE=create targets an existing indexed file: ${normalizedFile}`);
      }
      if ((modeValue === 'replace' || modeValue === 'append' || modeValue === 'range') && !isIndexed) {
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
    if (matchesMarker(line, INSCRIBE_BEGIN)) {
      if (current) {
        current.errors.push('Missing @inscribe END');
        finalizeBlock(current, lineIndex - 1);
      }

      current = {
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

      lineMeta[lineIndex].type = 'begin';
      lineMeta[lineIndex].blockId = current.id;
      return;
    }

    if (matchesMarker(line, INSCRIBE_END)) {
      if (current) {
        lineMeta[lineIndex].type = 'end';
        lineMeta[lineIndex].blockId = current.id;
        finalizeBlock(current, lineIndex);
        current = null;
      } else {
        const orphanBlock: IntakeBlock = {
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

    if (isFenceLine(line)) {
      current.directivesLocked = true;
      return;
    }

    if (current.directivesLocked) {
      return;
    }

    const parsed = parseDirectiveLine(line);
    if (!parsed.matched) {
      if (parsed.usedPrefix) {
      current.warnings.push('Invalid header or directive format (headers and directives should not use @inscribe prefix)');
        lineMeta[lineIndex].type = 'unknown-directive';
        lineMeta[lineIndex].status = 'warning';
      }
      return;
    }

    const key = parsed.key as IntakeDirectiveKey;
    const value = parsed.value ?? '';

    current.directives[key] = {
      key,
      value,
      lineIndex,
      raw: line,
    };

    const isHeader = HEADER_KEYS.includes(key as (typeof HEADER_KEYS)[number]);
    lineMeta[lineIndex].type = isHeader ? 'header' : 'directive';
    if (!value) {
      current.warnings.push(`${key} ${isHeader ? 'header' : 'directive'} missing value`);
      lineMeta[lineIndex].status = 'warning';
    }
  });

  const openBlock = current as IntakeBlock | null;
  if (openBlock) {
    openBlock.errors.push('Missing @inscribe END');
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
