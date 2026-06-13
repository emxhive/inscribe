import {
  V2_BLOCK_OPEN,
  V2_BLOCK_CLOSE,
  V2_SECTION_NAMES,
  V2_DIRECTIVE_KEYS,
  V2_OPERATION_MODES,
  isExactV2MarkerLine,
  validateV2RelativeFilePath,
  V2_MODE_RULES,
  type V2SectionName,
  type V2DirectiveKey,
  type V2OperationMode,
  normalizeRelativePath
} from '@inscribe/shared';
import type { IntakeBlock, IntakeLineMeta } from './intake';

export function scanV2IntakeStructure(
  rawInput: string,
  options?: { indexedFileSet?: Set<string> }
): {
  blocks: IntakeBlock[];
  lines: IntakeLineMeta[];
} {
  // Split raw input preserving line structure but without rewriting
  const rawLines: string[] = [];
  let currentStart = 0;
  let idx = 0;
  while (idx < rawInput.length) {
    const char = rawInput[idx];
    if (char === '\n') {
      rawLines.push(rawInput.slice(currentStart, idx));
      idx++;
      currentStart = idx;
    } else if (char === '\r') {
      if (idx + 1 < rawInput.length && rawInput[idx + 1] === '\n') {
        rawLines.push(rawInput.slice(currentStart, idx));
        idx += 2;
        currentStart = idx;
      } else {
        rawLines.push(rawInput.slice(currentStart, idx));
        idx++;
        currentStart = idx;
      }
    } else {
      idx++;
    }
  }
  if (currentStart <= rawInput.length) {
    rawLines.push(rawInput.slice(currentStart));
  }

  const blocks: IntakeBlock[] = [];
  const linesMeta: IntakeLineMeta[] = rawLines.map((text, lineIndex) => ({
    text,
    lineIndex,
    type: 'text',
  }));

  const isSectionEmpty = (contentLines: number[]): boolean => {
    if (contentLines.length === 0) return true;
    const text = contentLines.map(lineIdx => rawLines[lineIdx]).join('\n');
    return text.trim().length === 0;
  };

  interface ActiveSection {
    name: V2SectionName;
    openLine: number;
    contentLines: number[];
  }

  interface ActiveBlock {
    id: string;
    index: number;
    startLine: number;
    directives: Record<string, { value: string; lineIndex: number }>;
    sections: Partial<Record<V2SectionName, {
      openLine: number;
      closeLine?: number;
      contentStartLine?: number;
      contentEndLine?: number;
      isEmpty?: boolean;
    }>>;
    warnings: string[];
    errors: string[];
    sectionBegun: boolean;
    activeSection: ActiveSection | null;
    duplicateDirectives: Set<string>;
    duplicateSections: Set<string>;
    unknownDirectives: Set<string>;
    unknownSections: Set<string>;
    directivesAfterSection: Set<number>;
  }

  let currentBlock: ActiveBlock | null = null;

  const finalizeBlock = (active: ActiveBlock, endLineIndex: number, unterminated = false) => {
    const errors = [...active.errors];
    const warnings = [...active.warnings];

    if (unterminated) {
      errors.push('missing block close');
    }

    if (active.activeSection) {
      errors.push('missing section close');
      active.sections[active.activeSection.name] = {
        openLine: active.activeSection.openLine,
        isEmpty: isSectionEmpty(active.activeSection.contentLines),
      };
      if (active.activeSection.contentLines.length > 0) {
        active.sections[active.activeSection.name]!.contentStartLine = active.activeSection.contentLines[0];
        active.sections[active.activeSection.name]!.contentEndLine = active.activeSection.contentLines[active.activeSection.contentLines.length - 1];
      }
    }

    // Directives and sections warnings/errors compiled
    for (const key of active.duplicateDirectives) {
      errors.push(`duplicate directive: ${key}`);
    }
    for (const sec of active.duplicateSections) {
      errors.push(`duplicate section: ${sec}`);
    }
    for (const key of active.unknownDirectives) {
      errors.push(`unknown directive: ${key}`);
    }
    for (const sec of active.unknownSections) {
      errors.push(`unknown section: ${sec}`);
    }
    for (const lineIdx of active.directivesAfterSection) {
      errors.push('directive after section');
    }

    const fileDirective = active.directives['FILE'];
    const modeDirective = active.directives['MODE'];
    const selectorDirective = active.directives['SELECTOR'];

    if (!fileDirective) {
      errors.push('missing FILE');
    } else {
      if (!fileDirective.value) {
        errors.push('blank FILE');
      } else {
        const pathErr = validateV2RelativeFilePath(fileDirective.value);
        if (pathErr) {
          errors.push('invalid FILE path');
        }
      }
    }

    if (!modeDirective) {
      errors.push('missing MODE');
    } else {
      if (!modeDirective.value) {
        errors.push('blank MODE');
      } else {
        const mode = modeDirective.value;
        const validModes = V2_OPERATION_MODES as readonly string[];
        if (!validModes.includes(mode)) {
          errors.push('invalid MODE');
        } else {
          const activeMode = mode as V2OperationMode;
          const rules = V2_MODE_RULES[activeMode];

          // Check required directives
          for (const reqDir of rules.requiredDirectives) {
            if (reqDir === 'SELECTOR' && !selectorDirective) {
              errors.push('missing SELECTOR for replace_node');
            }
          }

          // Check forbidden directives
          for (const forbDir of rules.forbiddenDirectives) {
            if (active.directives[forbDir]) {
              errors.push('forbidden directive');
            }
          }

          // Check required sections
          for (const reqSec of rules.requiredSections) {
            if (!active.sections[reqSec]) {
              errors.push('missing required section');
            }
          }

          // Check forbidden sections
          for (const forbSec of rules.forbiddenSections) {
            if (active.sections[forbSec]) {
              errors.push('forbidden section');
            }
          }

          // Check non-empty sections
          if (selectorDirective && !selectorDirective.value.trim()) {
            errors.push('blank SELECTOR');
          }
          for (const secKey of rules.nonEmptyWhenPresentSections) {
            if (active.sections[secKey]) {
              const sec = active.sections[secKey]!;
              if (sec.isEmpty) {
                if (activeMode === 'replace_node' && secKey === 'CONTENT') {
                  continue;
                }
                errors.push(`blank ${secKey}`);
              }
            }
          }
          if (activeMode === 'replace_node') {
            const contentSec = active.sections['CONTENT'];
            if (contentSec && contentSec.isEmpty) {
              errors.push('blank replace_node CONTENT');
            }
          }
        }
      }
    }

    // Indexed file warnings (lightweight warnings, not errors)
    const fileVal = fileDirective?.value?.trim() || '';
    const modeVal = modeDirective?.value?.trim() || '';
    if (options?.indexedFileSet && fileVal && modeVal && (V2_OPERATION_MODES as readonly string[]).includes(modeVal)) {
      const normalizedFile = normalizeRelativePath(fileVal);
      const isIndexed = options.indexedFileSet.has(normalizedFile);
      if (modeVal === 'create_file' && isIndexed) {
        warnings.push(`create_file targets indexed file: ${normalizedFile}`);
      } else if (modeVal !== 'create_file' && !isIndexed) {
        warnings.push(`non-create operation targets non-indexed file: ${normalizedFile}`);
      }
    }

    // Determine status
    let status: IntakeBlock['status'] = 'valid';
    const hasHardErrors = errors.some(err => err !== 'missing block close' && err !== 'missing section close');
    if (hasHardErrors) {
      status = 'error';
    } else if (errors.includes('missing block close') || errors.includes('missing section close')) {
      status = 'incomplete';
    } else if (warnings.length > 0) {
      status = 'warning';
    }

    const label = fileDirective?.value || `Block ${active.index + 1}`;

    blocks.push({
      protocol: 'v2',
      id: active.id,
      index: active.index,
      startLine: active.startLine,
      endLine: endLineIndex,
      directives: {}, // Keep empty for V2 to not force V2 into V1 directive maps
      warnings,
      errors,
      status,
      label,
      filePath: fileDirective?.value,
      mode: modeDirective?.value,
      selectorText: selectorDirective?.value,
      sections: active.sections,
    });
  };

  rawLines.forEach((lineText, lineIndex) => {
    const trimmed = lineText.trim();

    // 1. Check for block markers
    if (trimmed === V2_BLOCK_OPEN) {
      if (currentBlock) {
        // Nested block opener! We record error on line and block
        currentBlock.errors.push('nested block opener');
        linesMeta[lineIndex].status = 'error';
        linesMeta[lineIndex].type = 'begin';
        
        // Recover: finalize the current block as unterminated and start a new one
        finalizeBlock(currentBlock, lineIndex - 1, true);
      }

      currentBlock = {
        id: `block-v2-${blocks.length + 1}-${lineIndex}`,
        index: blocks.length,
        startLine: lineIndex,
        directives: {},
        sections: {},
        warnings: [],
        errors: [],
        sectionBegun: false,
        activeSection: null,
        duplicateDirectives: new Set(),
        duplicateSections: new Set(),
        unknownDirectives: new Set(),
        unknownSections: new Set(),
        directivesAfterSection: new Set(),
      };

      linesMeta[lineIndex].type = 'begin';
      linesMeta[lineIndex].blockId = currentBlock.id;
      return;
    }

    if (trimmed === V2_BLOCK_CLOSE) {
      if (currentBlock) {
        linesMeta[lineIndex].type = 'end';
        linesMeta[lineIndex].blockId = currentBlock.id;
        finalizeBlock(currentBlock, lineIndex, false);
        currentBlock = null;
      } else {
        // Orphan block close
        const orphanBlock: IntakeBlock = {
          protocol: 'v2',
          id: `orphan-v2-end-${lineIndex}`,
          index: blocks.length,
          startLine: lineIndex,
          endLine: lineIndex,
          directives: {},
          warnings: [],
          errors: ['orphan block close'],
          status: 'error',
          label: 'Orphan INSCRIBE>>>',
        };
        blocks.push(orphanBlock);
        linesMeta[lineIndex].type = 'end';
        linesMeta[lineIndex].status = 'error';
        linesMeta[lineIndex].blockId = orphanBlock.id;
      }
      return;
    }

    // If we are outside a block, check for orphan section markers or orphan closers
    if (!currentBlock) {
      if (isExactV2MarkerLine(lineText)) {
        const isOpener = trimmed.startsWith('<<<');
        const isCloser = trimmed.endsWith('>>>');
        if (isOpener || isCloser) {
          const secName = isOpener ? trimmed.slice(3) : trimmed.slice(0, -3);
          const typeStr = isOpener ? 'open' : 'close';
          const errorMsg = `orphan section ${typeStr}: ${secName}`;

          const orphanBlock: IntakeBlock = {
            protocol: 'v2',
            id: `orphan-section-${typeStr}-${lineIndex}`,
            index: blocks.length,
            startLine: lineIndex,
            endLine: lineIndex,
            directives: {},
            warnings: [],
            errors: [errorMsg],
            status: 'error',
            label: `Orphan section ${isOpener ? 'opener' : 'closer'}`,
          };
          blocks.push(orphanBlock);
          linesMeta[lineIndex].type = isOpener ? 'section-open' : 'section-close';
          linesMeta[lineIndex].status = 'error';
          linesMeta[lineIndex].blockId = orphanBlock.id;
        }
      }
      return;
    }

    // Inside block
    linesMeta[lineIndex].blockId = currentBlock.id;

    // If we are inside an active section, preserve arbitrary marker-like payload text.
    // Recognize only exact reserved markers.
    if (currentBlock.activeSection) {
      if (isExactV2MarkerLine(lineText)) {
        const expectedCloser = `${currentBlock.activeSection.name}>>>`;
        if (trimmed === expectedCloser) {
          // close section
          const active = currentBlock.activeSection;
          currentBlock.sections[active.name] = {
            openLine: active.openLine,
            closeLine: lineIndex,
            isEmpty: isSectionEmpty(active.contentLines),
            contentStartLine: active.contentLines.length > 0 ? active.contentLines[0] : undefined,
            contentEndLine: active.contentLines.length > 0 ? active.contentLines[active.contentLines.length - 1] : undefined,
          };
          linesMeta[lineIndex].type = 'section-close';
          currentBlock.activeSection = null;
          return;
        } else if (trimmed === V2_BLOCK_OPEN) {
          // recover nested block
          currentBlock.errors.push('nested block opener');
          linesMeta[lineIndex].status = 'error';
          linesMeta[lineIndex].type = 'begin';
          finalizeBlock(currentBlock, lineIndex - 1, true);
          // start new block
          currentBlock = {
            id: `block-v2-${blocks.length + 1}-${lineIndex}`,
            index: blocks.length,
            startLine: lineIndex,
            directives: {},
            sections: {},
            warnings: [],
            errors: [],
            sectionBegun: false,
            activeSection: null,
            duplicateDirectives: new Set(),
            duplicateSections: new Set(),
            unknownDirectives: new Set(),
            unknownSections: new Set(),
            directivesAfterSection: new Set(),
          };
          linesMeta[lineIndex].blockId = currentBlock.id;
          return;
        } else if (trimmed === V2_BLOCK_CLOSE) {
          // close block with missing section close
          linesMeta[lineIndex].type = 'end';
          linesMeta[lineIndex].blockId = currentBlock.id;
          finalizeBlock(currentBlock, lineIndex, false);
          currentBlock = null;
          return;
        } else if (trimmed.startsWith('<<<')) {
          // other exact reserved section opener -> nested section opener error
          currentBlock.errors.push('nested section opener');
          linesMeta[lineIndex].status = 'error';
          linesMeta[lineIndex].type = 'section-open';
          // Recover: close current active section as unterminated, start new section
          const prevSec = currentBlock.activeSection;
          currentBlock.sections[prevSec.name] = {
            openLine: prevSec.openLine,
            isEmpty: isSectionEmpty(prevSec.contentLines),
            contentStartLine: prevSec.contentLines.length > 0 ? prevSec.contentLines[0] : undefined,
            contentEndLine: prevSec.contentLines.length > 0 ? prevSec.contentLines[prevSec.contentLines.length - 1] : undefined,
          };
          const secName = trimmed.slice(3) as V2SectionName;
          if (currentBlock.sections[secName]) {
            currentBlock.duplicateSections.add(secName);
          }
          currentBlock.activeSection = {
            name: secName,
            openLine: lineIndex,
            contentLines: [],
          };
          return;
        } else if (trimmed.endsWith('>>>')) {
          // other exact reserved section closer -> mismatched section closer error
          currentBlock.errors.push('mismatched section closer');
          linesMeta[lineIndex].type = 'section-close';
          linesMeta[lineIndex].status = 'error';
          // Recover: close current section as unterminated
          const prevSec = currentBlock.activeSection;
          currentBlock.sections[prevSec.name] = {
            openLine: prevSec.openLine,
            isEmpty: isSectionEmpty(prevSec.contentLines),
            contentStartLine: prevSec.contentLines.length > 0 ? prevSec.contentLines[0] : undefined,
            contentEndLine: prevSec.contentLines.length > 0 ? prevSec.contentLines[prevSec.contentLines.length - 1] : undefined,
          };
          currentBlock.activeSection = null;
          return;
        }
      }
      // anything else -> payload
      currentBlock.activeSection.contentLines.push(lineIndex);
      linesMeta[lineIndex].type = 'payload';
      return;
    }

    // Inside block, outside active section
    // 2. Check for section openers and closers
    const isSectionOpener = trimmed.startsWith('<<<') && trimmed !== V2_BLOCK_OPEN;
    const isSectionCloser = trimmed.endsWith('>>>') && trimmed !== V2_BLOCK_CLOSE;

    if (isSectionOpener) {
      const secName = trimmed.slice(3) as V2SectionName;
      const isValidSec = V2_SECTION_NAMES.includes(secName);

      if (!isValidSec) {
        currentBlock.unknownSections.add(trimmed);
        linesMeta[lineIndex].type = 'section-open';
        linesMeta[lineIndex].status = 'error';
        return;
      }

      currentBlock.sectionBegun = true;

      if (currentBlock.sections[secName]) {
        currentBlock.duplicateSections.add(secName);
        linesMeta[lineIndex].status = 'error';
      }

      currentBlock.activeSection = {
        name: secName,
        openLine: lineIndex,
        contentLines: [],
      };

      linesMeta[lineIndex].type = 'section-open';
      return;
    }

    if (isSectionCloser) {
      const secName = trimmed.slice(0, -3) as V2SectionName;
      const isValidSec = V2_SECTION_NAMES.includes(secName);

      if (!isValidSec) {
        // unknown or malformed section closer -> add block error
        currentBlock.errors.push(`unknown section closer: ${trimmed}`);
        linesMeta[lineIndex].type = 'section-close';
        linesMeta[lineIndex].status = 'error';
        return;
      }

      // If valid closer but no section was active
      currentBlock.errors.push('orphan section close');
      linesMeta[lineIndex].type = 'section-close';
      linesMeta[lineIndex].status = 'error';
      return;
    }

    // 4. Otherwise, it must be directives or blank lines/comments outside sections
    const colonIdx = lineText.indexOf(':');
    if (colonIdx !== -1) {
      const key = lineText.slice(0, colonIdx).trim();
      const val = lineText.slice(colonIdx + 1).trim();

      const isValidDir = V2_DIRECTIVE_KEYS.includes(key as V2DirectiveKey);
      if (!isValidDir) {
        currentBlock.unknownDirectives.add(key);
        linesMeta[lineIndex].type = 'unknown-directive';
        linesMeta[lineIndex].status = 'error';
        return;
      }

      if (currentBlock.sectionBegun) {
        currentBlock.directivesAfterSection.add(lineIndex);
        linesMeta[lineIndex].type = 'directive';
        linesMeta[lineIndex].status = 'error';
        return;
      }

      if (currentBlock.directives[key]) {
        currentBlock.duplicateDirectives.add(key);
        linesMeta[lineIndex].type = 'directive';
        linesMeta[lineIndex].status = 'error';
        return;
      }

      currentBlock.directives[key] = {
        value: val,
        lineIndex,
      };

      linesMeta[lineIndex].type = 'directive';
      if (!val) {
        linesMeta[lineIndex].status = 'error';
      }
      return;
    }

    // Ignore blank/whitespace lines, otherwise unexpected content
    if (trimmed !== '') {
      currentBlock.errors.push(`unexpected content: ${lineText}`);
      linesMeta[lineIndex].status = 'error';
    }
  });

  if (currentBlock) {
    finalizeBlock(currentBlock, rawLines.length - 1, true);
  }

  // Adjust status of lines that have block errors
  blocks.forEach(block => {
    if (block.errors.length > 0) {
      // Ensure all lines in the block are highlighted as having warnings/errors/incomplete
      for (let l = block.startLine; l <= block.endLine; l++) {
        if (!linesMeta[l].status) {
          linesMeta[l].status = block.status === 'incomplete' ? 'incomplete' : 'error';
        }
      }
    }
  });

  return { blocks, lines: linesMeta };
}
