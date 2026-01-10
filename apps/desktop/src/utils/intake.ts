import {
  INSCRIBE_BEGIN,
  INSCRIBE_END,
  INSCRIBE_FILE,
  INSCRIBE_MODE,
  INSCRIBE_PREFIX,
  INSCRIBE_START,
  INSCRIBE_END_ANCHOR,
  VALID_MODES,
  matchesMarker,
  startsWithMarker,
  extractMarkerValue,
} from '@inscribe/shared';

export type IntakeDirectiveKey = 'FILE' | 'MODE' | 'START' | 'END';

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
  type: 'text' | 'begin' | 'end' | 'directive' | 'unknown-directive';
  status?: 'warning' | 'error';
}

const DIRECTIVE_MARKERS: Record<IntakeDirectiveKey, string> = {
  FILE: INSCRIBE_FILE,
  MODE: INSCRIBE_MODE,
  START: INSCRIBE_START,
  END: INSCRIBE_END_ANCHOR,
};

export function parseIntakeStructure(input: string): {
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
  let current: IntakeBlock | null = null;

  const finalizeBlock = (block: IntakeBlock, endLine: number) => {
    block.endLine = endLine;

    if (!block.directives.FILE) {
      block.warnings.push('Missing FILE directive');
    }

    if (!block.directives.MODE) {
      block.warnings.push('Missing MODE directive');
    }

    const modeValue = block.directives.MODE?.value?.toLowerCase();
    if (modeValue && !VALID_MODES.includes(modeValue as (typeof VALID_MODES)[number])) {
      block.warnings.push(`Unknown MODE value: ${block.directives.MODE?.value}`);
    }

    if (modeValue === 'range') {
      if (!block.directives.START) {
        block.warnings.push('Missing START directive for range mode');
      }
      if (!block.directives.END) {
        block.warnings.push('Missing END directive for range mode');
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

    if (startsWithMarker(line, INSCRIBE_PREFIX)) {
      const directiveMatch = (Object.entries(DIRECTIVE_MARKERS) as Array<[IntakeDirectiveKey, string]>)
        .find(([, marker]) => startsWithMarker(line, marker));

      if (!directiveMatch) {
        current.warnings.push('Unknown directive');
        lineMeta[lineIndex].type = 'unknown-directive';
        lineMeta[lineIndex].status = 'warning';
        return;
      }

      const [key, marker] = directiveMatch;
      const value = extractMarkerValue(line, marker);
      current.directives[key] = {
        key,
        value,
        lineIndex,
        raw: line,
      };
      lineMeta[lineIndex].type = 'directive';
      if (!value) {
        current.warnings.push(`${key} directive missing value`);
        lineMeta[lineIndex].status = 'warning';
      }
    }
  });

  if (current) {
    current.errors.push('Missing @inscribe END');
    finalizeBlock(current, lines.length - 1);
  }

  return { blocks, lines: lineMeta };
}

export function updateDirectiveInText(
  input: string,
  block: IntakeBlock,
  key: IntakeDirectiveKey,
  value: string,
): string {
  if (block.startLine < 0) {
    return input;
  }

  const lines = input.split('\n');
  const nextValue = value.trim();
  const marker = `${INSCRIBE_PREFIX} ${key}:`;
  const directive = block.directives[key];

  if (directive) {
    const line = lines[directive.lineIndex] ?? '';
    const leadingWhitespace = line.match(/^\s*/)?.[0] ?? '';
    if (!nextValue) {
      lines.splice(directive.lineIndex, 1);
    } else {
      lines[directive.lineIndex] = `${leadingWhitespace}${marker} ${value}`;
    }
    return lines.join('\n');
  }

  if (!nextValue) {
    return input;
  }

  const beginLine = lines[block.startLine] ?? '';
  const leadingWhitespace = beginLine.match(/^\s*/)?.[0] ?? '';
  const insertIndex = Math.min(block.startLine + 1, lines.length);
  lines.splice(insertIndex, 0, `${leadingWhitespace}${marker} ${value}`);
  return lines.join('\n');
}
