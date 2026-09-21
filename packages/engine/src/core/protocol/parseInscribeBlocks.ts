import type { InscribeOperation, StructuralSelector } from '@inscribe/shared';
import {
  INSCRIBE_BLOCK_OPEN,
  INSCRIBE_BLOCK_CLOSE,
  SECTION_NAMES,
  SECTION_OPEN_MARKERS,
  SECTION_CLOSE_MARKERS,
  DIRECTIVE_KEYS,
  PROTOCOL_OPERATION_MODES,
  validateRelativeFilePath,
  parseSectionFenceWrapper,
  isExactMarkerLine,
} from '@inscribe/shared';
import { ProtocolError, type ProtocolErrorCode } from './protocolErrors';
import { parseSelector } from '../structural/selectorParser';

interface LineInfo {
  text: string;
  lineNum: number;
  startIndex: number;
  endIndex: number;
  newline: string;
}


function parseStrictSource(rawInput: string): InscribeOperation[] {
  const lines: LineInfo[] = [];
  let currentStart = 0;
  let lineNum = 1;
  let i = 0;
  while (i < rawInput.length) {
    const char = rawInput[i];
    if (char === '\n') {
      const text = rawInput.slice(currentStart, i);
      lines.push({
        text,
        lineNum,
        startIndex: currentStart,
        endIndex: i,
        newline: '\n'
      });
      i++;
      currentStart = i;
      lineNum++;
    } else if (char === '\r') {
      if (i + 1 < rawInput.length && rawInput[i + 1] === '\n') {
        const text = rawInput.slice(currentStart, i);
        lines.push({
          text,
          lineNum,
          startIndex: currentStart,
          endIndex: i,
          newline: '\r\n'
        });
        i += 2;
        currentStart = i;
        lineNum++;
      } else {
        const text = rawInput.slice(currentStart, i);
        lines.push({
          text,
          lineNum,
          startIndex: currentStart,
          endIndex: i,
          newline: '\r'
        });
        i++;
        currentStart = i;
        lineNum++;
      }
    } else {
      i++;
    }
  }
  if (currentStart <= rawInput.length) {
    const text = rawInput.slice(currentStart);
    lines.push({
      text,
      lineNum,
      startIndex: currentStart,
      endIndex: rawInput.length,
      newline: ''
    });
  }

  const operations: InscribeOperation[] = [];
  let blockIndex = 0;
  let lineIdx = 0;
  let foundAnyBlock = false;

  while (lineIdx < lines.length) {
    const line = lines[lineIdx];
    const trimmed = line.text.trim();

    if (trimmed === INSCRIBE_BLOCK_OPEN) {
      foundAnyBlock = true;
      const startLineNum = line.lineNum;
      lineIdx++;

      const directives = new Map<string, { value: string; lineNum: number }>();
      const sections = new Map<string, { content: string; lineNum: number }>();
      let sectionBegun = false;
      let blockTerminated = false;

      while (lineIdx < lines.length) {
        const currentLine = lines[lineIdx];
        const currentTrimmed = currentLine.text.trim();

        if (currentTrimmed === INSCRIBE_BLOCK_CLOSE) {
          blockTerminated = true;
          lineIdx++;
          break;
        }

        if (currentTrimmed.startsWith('<<<') && currentTrimmed !== INSCRIBE_BLOCK_OPEN) {
          const possibleSection = currentTrimmed.slice(3);
          const validSections = SECTION_NAMES as readonly string[];
          if (!validSections.includes(possibleSection)) {
            throw new ProtocolError('UNKNOWN_SECTION', blockIndex, currentLine.lineNum, possibleSection);
          }

          const sectionName = possibleSection;
          if (sections.has(sectionName)) {
            throw new ProtocolError('DUPLICATE_SECTION', blockIndex, currentLine.lineNum, sectionName);
          }

          sectionBegun = true;
          const openLineIdx = lineIdx;
          lineIdx++;

          const closerMarker = `${sectionName}>>>`;
          let closeLineIdx = -1;
          while (lineIdx < lines.length) {
            const scanLine = lines[lineIdx];
            const scanTrimmed = scanLine.text.trim();

            const reservedOpeners = SECTION_OPEN_MARKERS;
            const reservedClosers = SECTION_CLOSE_MARKERS;

            if (scanTrimmed === closerMarker) {
              closeLineIdx = lineIdx;
              break;
            }

            if (scanTrimmed === INSCRIBE_BLOCK_CLOSE || scanTrimmed === INSCRIBE_BLOCK_OPEN) {
              throw new ProtocolError('UNTERMINATED_SECTION', blockIndex, scanLine.lineNum, sectionName);
            }

            if (reservedOpeners.includes(scanTrimmed)) {
              throw new ProtocolError('MALFORMED_MARKER', blockIndex, scanLine.lineNum, scanTrimmed);
            }

            if (reservedClosers.includes(scanTrimmed)) {
              throw new ProtocolError('MALFORMED_MARKER', blockIndex, scanLine.lineNum, scanTrimmed);
            }

            lineIdx++;
          }

          if (closeLineIdx === -1) {
            throw new ProtocolError('UNTERMINATED_SECTION', blockIndex, currentLine.lineNum, sectionName);
          }

          let sectionContent = '';
          if (closeLineIdx > openLineIdx + 1) {
            const sectionLines = lines.slice(openLineIdx + 1, closeLineIdx);
            const parseResult = parseSectionFenceWrapper(sectionLines);
            if (parseResult.type === 'error') {
              throw new ProtocolError('MALFORMED_WRAPPER_FENCE', blockIndex, parseResult.lineNum, parseResult.message);
            } else if (parseResult.type === 'unwrapped') {
              if (parseResult.bodyStartIdx <= parseResult.bodyEndIdx) {
                const contentStartOffset = sectionLines[parseResult.bodyStartIdx].startIndex;
                const contentEndOffset = sectionLines[parseResult.bodyEndIdx].endIndex;
                sectionContent = rawInput.slice(contentStartOffset, contentEndOffset);
              } else {
                sectionContent = '';
              }
            } else {
              const contentStartOffset = sectionLines[0].startIndex;
              const contentEndOffset = sectionLines[sectionLines.length - 1].endIndex;
              sectionContent = rawInput.slice(contentStartOffset, contentEndOffset);
            }
          }

          sections.set(sectionName, { content: sectionContent, lineNum: currentLine.lineNum });
          lineIdx++;
          continue;
        }

        if (currentTrimmed.includes('>>>') && currentTrimmed !== INSCRIBE_BLOCK_CLOSE) {
          throw new ProtocolError('MALFORMED_MARKER', blockIndex, currentLine.lineNum, currentTrimmed);
        }
        if (currentTrimmed.startsWith('<<<')) {
          throw new ProtocolError('UNKNOWN_SECTION', blockIndex, currentLine.lineNum, currentTrimmed);
        }

        const colonIndex = currentLine.text.indexOf(':');
        if (colonIndex !== -1) {
          const key = currentLine.text.slice(0, colonIndex).trim();
          const value = currentLine.text.slice(colonIndex + 1);

          const validDirectives = DIRECTIVE_KEYS as readonly string[];
          if (!validDirectives.includes(key)) {
            throw new ProtocolError('UNKNOWN_DIRECTIVE', blockIndex, currentLine.lineNum, key);
          }

          if (sectionBegun) {
            throw new ProtocolError('UNEXPECTED_CONTENT', blockIndex, currentLine.lineNum, 'Directives must precede all fenced sections');
          }

          if (directives.has(key)) {
            throw new ProtocolError('DUPLICATE_DIRECTIVE', blockIndex, currentLine.lineNum, key);
          }

          directives.set(key, { value: value.trim(), lineNum: currentLine.lineNum });
          lineIdx++;
          continue;
        }

        if (currentTrimmed === '') {
          lineIdx++;
          continue;
        }

        throw new ProtocolError('UNEXPECTED_CONTENT', blockIndex, currentLine.lineNum, currentLine.text);
      }

      if (!blockTerminated) {
        throw new ProtocolError('UNTERMINATED_INSCRIBE_BLOCK', blockIndex, startLineNum);
      }

      const fileEntry = directives.get('FILE');
      const modeEntry = directives.get('MODE');
      const selectorEntry = directives.get('SELECTOR');

      if (!fileEntry) {
        throw new ProtocolError('MISSING_REQUIRED_FIELD', blockIndex, startLineNum, 'FILE directive is required');
      }
      if (!modeEntry) {
        throw new ProtocolError('MISSING_REQUIRED_FIELD', blockIndex, startLineNum, 'MODE directive is required');
      }

      const filePathErr = validateRelativeFilePath(fileEntry.value);
      if (filePathErr) {
        throw new ProtocolError('INVALID_FILE_PATH', blockIndex, fileEntry.lineNum, filePathErr);
      }

      const mode = modeEntry.value;
      const validModes = PROTOCOL_OPERATION_MODES as readonly string[];
      if (!validModes.includes(mode)) {
        throw new ProtocolError('INVALID_MODE', blockIndex, modeEntry.lineNum, mode);
      }

      if (mode === 'create_file' || mode === 'replace_file') {
        if (selectorEntry) {
          throw new ProtocolError('FORBIDDEN_FIELD', blockIndex, selectorEntry.lineNum, `SELECTOR is forbidden in ${mode}`);
        }
        if (sections.has('SEARCH')) {
          throw new ProtocolError('FORBIDDEN_FIELD', blockIndex, sections.get('SEARCH')!.lineNum, `SEARCH is forbidden in ${mode}`);
        }
        if (sections.has('STARTS_WITH')) {
          throw new ProtocolError('FORBIDDEN_FIELD', blockIndex, sections.get('STARTS_WITH')!.lineNum, `STARTS_WITH is forbidden in ${mode}`);
        }
        if (!sections.has('CONTENT')) {
          throw new ProtocolError('MISSING_REQUIRED_FIELD', blockIndex, startLineNum, `CONTENT is required in ${mode}`);
        }

        operations.push({
          strategy: mode as 'create_file' | 'replace_file',
          filePath: fileEntry.value,
          content: sections.get('CONTENT')!.content
        });
      } else if (mode === 'delete_file') {
        if (selectorEntry) {
          throw new ProtocolError('FORBIDDEN_FIELD', blockIndex, selectorEntry.lineNum, `SELECTOR is forbidden in ${mode}`);
        }
        if (sections.has('CONTENT')) {
          throw new ProtocolError('FORBIDDEN_FIELD', blockIndex, sections.get('CONTENT')!.lineNum, `CONTENT is forbidden in ${mode}`);
        }
        if (sections.has('SEARCH')) {
          throw new ProtocolError('FORBIDDEN_FIELD', blockIndex, sections.get('SEARCH')!.lineNum, `SEARCH is forbidden in ${mode}`);
        }
        if (sections.has('STARTS_WITH')) {
          throw new ProtocolError('FORBIDDEN_FIELD', blockIndex, sections.get('STARTS_WITH')!.lineNum, `STARTS_WITH is forbidden in ${mode}`);
        }

        operations.push({
          strategy: 'delete_file',
          filePath: fileEntry.value
        });
      } else if (mode === 'replace_text') {
        if (selectorEntry) {
          throw new ProtocolError('FORBIDDEN_FIELD', blockIndex, selectorEntry.lineNum, `SELECTOR is forbidden in ${mode}`);
        }
        if (sections.has('STARTS_WITH')) {
          throw new ProtocolError('FORBIDDEN_FIELD', blockIndex, sections.get('STARTS_WITH')!.lineNum, `STARTS_WITH is forbidden in ${mode}`);
        }
        if (!sections.has('SEARCH')) {
          throw new ProtocolError('MISSING_REQUIRED_FIELD', blockIndex, startLineNum, `SEARCH is required in ${mode}`);
        }
        if (!sections.has('CONTENT')) {
          throw new ProtocolError('MISSING_REQUIRED_FIELD', blockIndex, startLineNum, `CONTENT is required in ${mode}`);
        }

        const searchContent = sections.get('SEARCH')!.content;
        if (!searchContent || !searchContent.trim()) {
          throw new ProtocolError('EMPTY_SEARCH', blockIndex, sections.get('SEARCH')!.lineNum);
        }

        operations.push({
          strategy: 'replace_text',
          filePath: fileEntry.value,
          search: searchContent,
          content: sections.get('CONTENT')!.content
        });
      } else if (mode === 'replace_node') {
        if (sections.has('SEARCH')) {
          throw new ProtocolError('FORBIDDEN_FIELD', blockIndex, sections.get('SEARCH')!.lineNum, `SEARCH is forbidden in ${mode}`);
        }
        if (!selectorEntry) {
          throw new ProtocolError('MISSING_REQUIRED_FIELD', blockIndex, startLineNum, `SELECTOR is required in ${mode}`);
        }
        if (!sections.has('CONTENT')) {
          throw new ProtocolError('MISSING_REQUIRED_FIELD', blockIndex, startLineNum, `CONTENT is required in ${mode}`);
        }

        if (!selectorEntry.value || !selectorEntry.value.trim()) {
          throw new ProtocolError('EMPTY_SELECTOR', blockIndex, selectorEntry.lineNum);
        }

        const contentVal = sections.get('CONTENT')!.content;

        let startsWithValue: string | undefined;
        if (sections.has('STARTS_WITH')) {
          const swVal = sections.get('STARTS_WITH')!.content;
          if (!swVal || !swVal.trim()) {
            throw new ProtocolError('EMPTY_STARTS_WITH', blockIndex, sections.get('STARTS_WITH')!.lineNum);
          }
          startsWithValue = swVal;
        }

        let parsedSelector: StructuralSelector;
        try {
          parsedSelector = parseSelector(selectorEntry.value, startsWithValue);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          throw new ProtocolError('INVALID_SELECTOR', blockIndex, selectorEntry.lineNum, message);
        }

        operations.push({
          strategy: 'replace_node',
          filePath: fileEntry.value,
          selector: parsedSelector,
          content: contentVal
        });
      }

      blockIndex++;
    } else {
      lineIdx++;
    }
  }

  if (!foundAnyBlock) {
    throw new ProtocolError('NO_INSCRIBE_BLOCKS', 0, 1);
  }

  return operations;
}

export interface RecoverableInscribeOperation {
  operation: InscribeOperation;
  blockIndex: number;
  startLine: number;
  endLine: number;
}

export interface ProtocolDiagnostic {
  code: ProtocolErrorCode;
  message: string;
  blockIndex?: number;
  line?: number;
  context?: string;
  filePath?: string;
}

export interface RecoverableParseResult {
  operations: RecoverableInscribeOperation[];
  diagnostics: ProtocolDiagnostic[];
}

interface RecoverableSourceLine {
  text: string;
  line: number;
  startIndex: number;
  endIndex: number;
}

function splitRecoverableSourceLines(rawInput: string): RecoverableSourceLine[] {
  const lines: RecoverableSourceLine[] = [];
  let currentStart = 0;
  let line = 1;
  let index = 0;

  while (index < rawInput.length) {
    const char = rawInput[index];
    if (char !== '\n' && char !== '\r') {
      index++;
      continue;
    }

    const newlineLength = char === '\r' && rawInput[index + 1] === '\n' ? 2 : 1;
    lines.push({
      text: rawInput.slice(currentStart, index),
      line,
      startIndex: currentStart,
      endIndex: index + newlineLength,
    });
    index += newlineLength;
    currentStart = index;
    line++;
  }

  lines.push({
    text: rawInput.slice(currentStart),
    line,
    startIndex: currentStart,
    endIndex: rawInput.length,
  });
  return lines;
}

function findRecoverableFilePath(lines: RecoverableSourceLine[], startIndex: number, endIndex: number): string | undefined {
  for (let index = startIndex + 1; index <= endIndex; index++) {
    const match = lines[index]?.text.match(/^\s*FILE\s*:\s*(.*?)\s*$/);
    if (match?.[1]) {
      return match[1];
    }
  }
  return undefined;
}

function formatRecoverableProtocolMessage(code: ProtocolErrorCode, context?: string): string {
  return context?.trim() ? `${code}: ${context}` : code;
}

/**
 * Parses every top-level Inscribe block independently so one malformed block does not
 * prevent later blocks from being previewed. The strict parseInscribeBlocks API
 * remains unchanged for callers that require all-or-nothing parsing.
 */
export function parseInscribeBlocksRecovering(rawInput: string): RecoverableParseResult {
  const lines = splitRecoverableSourceLines(rawInput);
  const operations: RecoverableInscribeOperation[] = [];
  const diagnostics: ProtocolDiagnostic[] = [];
  let blockIndex = 0;
  let foundBlock = false;
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const trimmed = lines[lineIndex].text.trim();
    if (trimmed !== INSCRIBE_BLOCK_OPEN) {
      if (isExactMarkerLine(lines[lineIndex].text)) {
        diagnostics.push({
          code: 'MALFORMED_MARKER',
          message: `MALFORMED_MARKER: marker appears outside an INSCRIBE block`,
          line: lines[lineIndex].line,
          context: trimmed,
        });
      }
      lineIndex++;
      continue;
    }

    foundBlock = true;
    const startLineIndex = lineIndex;
    let endLineIndex = lineIndex;
    let nextBlockLineIndex: number | undefined;
    let hasClose = false;
    while (endLineIndex + 1 < lines.length) {
      endLineIndex++;
      const candidate = lines[endLineIndex].text.trim();
      if (candidate === INSCRIBE_BLOCK_OPEN) {
        nextBlockLineIndex = endLineIndex;
        endLineIndex--;
        break;
      }
      if (candidate === INSCRIBE_BLOCK_CLOSE) {
        hasClose = true;
        break;
      }
    }

    if (!hasClose && nextBlockLineIndex === undefined) {
      endLineIndex = lines.length - 1;
    }

    const source = rawInput.slice(lines[startLineIndex].startIndex, lines[endLineIndex].endIndex);
    const filePath = findRecoverableFilePath(lines, startLineIndex, endLineIndex);

    try {
      const parsed = parseStrictSource(source);
      if (parsed[0]) {
        operations.push({
          operation: parsed[0],
          blockIndex,
          startLine: lines[startLineIndex].line,
          endLine: lines[endLineIndex].line,
        });
      }
    } catch (error: unknown) {
      if (error instanceof ProtocolError) {
        const globalLine = lines[startLineIndex].line + Math.max(0, error.line - 1);
        diagnostics.push({
          code: error.code,
          message: formatRecoverableProtocolMessage(error.code, error.context),
          blockIndex,
          line: globalLine,
          context: error.context,
          filePath,
        });
      } else {
        throw error;
      }
    }

    blockIndex++;
    lineIndex = nextBlockLineIndex ?? endLineIndex + 1;
  }

  if (!foundBlock) {
    diagnostics.push({
      code: 'NO_INSCRIBE_BLOCKS',
      message: 'NO_INSCRIBE_BLOCKS: no Inscribe blocks were found',
    });
  }

  return { operations, diagnostics };
}

/**
 * Compatibility entry point for callers that require all-or-nothing parsing.
 * Recoverable parsing remains canonical, while this wrapper throws its first
 * structured diagnostic using the existing ProtocolError contract.
 */
export function parseInscribeBlocks(rawInput: string): InscribeOperation[] {
  const result = parseInscribeBlocksRecovering(rawInput);
  const firstDiagnostic = result.diagnostics[0];
  if (firstDiagnostic) {
    throw new ProtocolError(
      firstDiagnostic.code,
      firstDiagnostic.blockIndex ?? 0,
      firstDiagnostic.line ?? 1,
      firstDiagnostic.context,
    );
  }
  return result.operations.map(({ operation }) => operation);
}
