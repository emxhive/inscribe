import type { V2Operation, StructuralSelector } from '@inscribe/shared';
import {
  V2_BLOCK_OPEN,
  V2_BLOCK_CLOSE,
  V2_SECTION_NAMES,
  V2_SECTION_OPEN_MARKERS,
  V2_SECTION_CLOSE_MARKERS,
  V2_DIRECTIVE_KEYS,
  V2_OPERATION_MODES,
  validateV2RelativeFilePath
} from '@inscribe/shared';
import { V2ProtocolError } from './protocolErrors';
import { parseSelector } from '../structural/selectorParser';

interface LineInfo {
  text: string;
  lineNum: number;
  startIndex: number;
  endIndex: number;
  newline: string;
}


export function parseInscribeBlocks(rawInput: string): V2Operation[] {
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

  const operations: V2Operation[] = [];
  let blockIndex = 0;
  let lineIdx = 0;
  let foundAnyBlock = false;

  while (lineIdx < lines.length) {
    const line = lines[lineIdx];
    const trimmed = line.text.trim();

    if (trimmed === V2_BLOCK_OPEN) {
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

        if (currentTrimmed === V2_BLOCK_CLOSE) {
          blockTerminated = true;
          lineIdx++;
          break;
        }

        if (currentTrimmed.startsWith('<<<') && currentTrimmed !== V2_BLOCK_OPEN) {
          const possibleSection = currentTrimmed.slice(3);
          const validSections = V2_SECTION_NAMES as readonly string[];
          if (!validSections.includes(possibleSection)) {
            throw new V2ProtocolError('UNKNOWN_SECTION', blockIndex, currentLine.lineNum, possibleSection);
          }

          const sectionName = possibleSection;
          if (sections.has(sectionName)) {
            throw new V2ProtocolError('DUPLICATE_SECTION', blockIndex, currentLine.lineNum, sectionName);
          }

          sectionBegun = true;
          const openLineIdx = lineIdx;
          lineIdx++;

          const closerMarker = `${sectionName}>>>`;
          let closeLineIdx = -1;
          while (lineIdx < lines.length) {
            const scanLine = lines[lineIdx];
            const scanTrimmed = scanLine.text.trim();

            const reservedOpeners = V2_SECTION_OPEN_MARKERS;
            const reservedClosers = V2_SECTION_CLOSE_MARKERS;

            if (scanTrimmed === closerMarker) {
              closeLineIdx = lineIdx;
              break;
            }

            if (scanTrimmed === V2_BLOCK_CLOSE || scanTrimmed === V2_BLOCK_OPEN) {
              throw new V2ProtocolError('UNTERMINATED_SECTION', blockIndex, scanLine.lineNum, sectionName);
            }

            if (reservedOpeners.includes(scanTrimmed)) {
              throw new V2ProtocolError('MALFORMED_MARKER', blockIndex, scanLine.lineNum, scanTrimmed);
            }

            if (reservedClosers.includes(scanTrimmed)) {
              throw new V2ProtocolError('MALFORMED_MARKER', blockIndex, scanLine.lineNum, scanTrimmed);
            }

            lineIdx++;
          }

          if (closeLineIdx === -1) {
            throw new V2ProtocolError('UNTERMINATED_SECTION', blockIndex, currentLine.lineNum, sectionName);
          }

          let sectionContent = '';
          if (closeLineIdx > openLineIdx + 1) {
            const contentStartOffset = lines[openLineIdx + 1].startIndex;
            const contentEndOffset = lines[closeLineIdx - 1].endIndex;
            sectionContent = rawInput.slice(contentStartOffset, contentEndOffset);
          }

          sections.set(sectionName, { content: sectionContent, lineNum: currentLine.lineNum });
          lineIdx++;
          continue;
        }

        if (currentTrimmed.includes('>>>') && currentTrimmed !== V2_BLOCK_CLOSE) {
          throw new V2ProtocolError('MALFORMED_MARKER', blockIndex, currentLine.lineNum, currentTrimmed);
        }
        if (currentTrimmed.startsWith('<<<')) {
          throw new V2ProtocolError('UNKNOWN_SECTION', blockIndex, currentLine.lineNum, currentTrimmed);
        }

        const colonIndex = currentLine.text.indexOf(':');
        if (colonIndex !== -1) {
          const key = currentLine.text.slice(0, colonIndex).trim();
          const value = currentLine.text.slice(colonIndex + 1);

          const validDirectives = V2_DIRECTIVE_KEYS as readonly string[];
          if (!validDirectives.includes(key)) {
            throw new V2ProtocolError('UNKNOWN_DIRECTIVE', blockIndex, currentLine.lineNum, key);
          }

          if (sectionBegun) {
            throw new V2ProtocolError('UNEXPECTED_CONTENT', blockIndex, currentLine.lineNum, 'Directives must precede all fenced sections');
          }

          if (directives.has(key)) {
            throw new V2ProtocolError('DUPLICATE_DIRECTIVE', blockIndex, currentLine.lineNum, key);
          }

          directives.set(key, { value: value.trim(), lineNum: currentLine.lineNum });
          lineIdx++;
          continue;
        }

        if (currentTrimmed === '') {
          lineIdx++;
          continue;
        }

        throw new V2ProtocolError('UNEXPECTED_CONTENT', blockIndex, currentLine.lineNum, currentLine.text);
      }

      if (!blockTerminated) {
        throw new V2ProtocolError('UNTERMINATED_INSCRIBE_BLOCK', blockIndex, startLineNum);
      }

      const fileEntry = directives.get('FILE');
      const modeEntry = directives.get('MODE');
      const selectorEntry = directives.get('SELECTOR');

      if (!fileEntry) {
        throw new V2ProtocolError('MISSING_REQUIRED_FIELD', blockIndex, startLineNum, 'FILE directive is required');
      }
      if (!modeEntry) {
        throw new V2ProtocolError('MISSING_REQUIRED_FIELD', blockIndex, startLineNum, 'MODE directive is required');
      }

      const filePathErr = validateV2RelativeFilePath(fileEntry.value);
      if (filePathErr) {
        throw new V2ProtocolError('INVALID_FILE_PATH', blockIndex, fileEntry.lineNum, filePathErr);
      }

      const mode = modeEntry.value;
      const validModes = V2_OPERATION_MODES as readonly string[];
      if (!validModes.includes(mode)) {
        throw new V2ProtocolError('INVALID_MODE', blockIndex, modeEntry.lineNum, mode);
      }

      if (mode === 'create_file' || mode === 'replace_file') {
        if (selectorEntry) {
          throw new V2ProtocolError('FORBIDDEN_FIELD', blockIndex, selectorEntry.lineNum, `SELECTOR is forbidden in ${mode}`);
        }
        if (sections.has('SEARCH')) {
          throw new V2ProtocolError('FORBIDDEN_FIELD', blockIndex, sections.get('SEARCH')!.lineNum, `SEARCH is forbidden in ${mode}`);
        }
        if (sections.has('STARTS_WITH')) {
          throw new V2ProtocolError('FORBIDDEN_FIELD', blockIndex, sections.get('STARTS_WITH')!.lineNum, `STARTS_WITH is forbidden in ${mode}`);
        }
        if (!sections.has('CONTENT')) {
          throw new V2ProtocolError('MISSING_REQUIRED_FIELD', blockIndex, startLineNum, `CONTENT is required in ${mode}`);
        }

        operations.push({
          strategy: mode as 'create_file' | 'replace_file',
          filePath: fileEntry.value,
          content: sections.get('CONTENT')!.content
        });
      } else if (mode === 'delete_file') {
        if (selectorEntry) {
          throw new V2ProtocolError('FORBIDDEN_FIELD', blockIndex, selectorEntry.lineNum, `SELECTOR is forbidden in ${mode}`);
        }
        if (sections.has('CONTENT')) {
          throw new V2ProtocolError('FORBIDDEN_FIELD', blockIndex, sections.get('CONTENT')!.lineNum, `CONTENT is forbidden in ${mode}`);
        }
        if (sections.has('SEARCH')) {
          throw new V2ProtocolError('FORBIDDEN_FIELD', blockIndex, sections.get('SEARCH')!.lineNum, `SEARCH is forbidden in ${mode}`);
        }
        if (sections.has('STARTS_WITH')) {
          throw new V2ProtocolError('FORBIDDEN_FIELD', blockIndex, sections.get('STARTS_WITH')!.lineNum, `STARTS_WITH is forbidden in ${mode}`);
        }

        operations.push({
          strategy: 'delete_file',
          filePath: fileEntry.value
        });
      } else if (mode === 'replace_text') {
        if (selectorEntry) {
          throw new V2ProtocolError('FORBIDDEN_FIELD', blockIndex, selectorEntry.lineNum, `SELECTOR is forbidden in ${mode}`);
        }
        if (sections.has('STARTS_WITH')) {
          throw new V2ProtocolError('FORBIDDEN_FIELD', blockIndex, sections.get('STARTS_WITH')!.lineNum, `STARTS_WITH is forbidden in ${mode}`);
        }
        if (!sections.has('SEARCH')) {
          throw new V2ProtocolError('MISSING_REQUIRED_FIELD', blockIndex, startLineNum, `SEARCH is required in ${mode}`);
        }
        if (!sections.has('CONTENT')) {
          throw new V2ProtocolError('MISSING_REQUIRED_FIELD', blockIndex, startLineNum, `CONTENT is required in ${mode}`);
        }

        const searchContent = sections.get('SEARCH')!.content;
        if (!searchContent || !searchContent.trim()) {
          throw new V2ProtocolError('EMPTY_SEARCH', blockIndex, sections.get('SEARCH')!.lineNum);
        }

        operations.push({
          strategy: 'replace_text',
          filePath: fileEntry.value,
          search: searchContent,
          content: sections.get('CONTENT')!.content
        });
      } else if (mode === 'replace_node') {
        if (sections.has('SEARCH')) {
          throw new V2ProtocolError('FORBIDDEN_FIELD', blockIndex, sections.get('SEARCH')!.lineNum, `SEARCH is forbidden in ${mode}`);
        }
        if (!selectorEntry) {
          throw new V2ProtocolError('MISSING_REQUIRED_FIELD', blockIndex, startLineNum, `SELECTOR is required in ${mode}`);
        }
        if (!sections.has('CONTENT')) {
          throw new V2ProtocolError('MISSING_REQUIRED_FIELD', blockIndex, startLineNum, `CONTENT is required in ${mode}`);
        }

        if (!selectorEntry.value || !selectorEntry.value.trim()) {
          throw new V2ProtocolError('EMPTY_SELECTOR', blockIndex, selectorEntry.lineNum);
        }

        const contentVal = sections.get('CONTENT')!.content;
        if (!contentVal || !contentVal.trim()) {
          throw new V2ProtocolError('EMPTY_CONTENT', blockIndex, sections.get('CONTENT')!.lineNum);
        }

        let startsWithValue: string | undefined;
        if (sections.has('STARTS_WITH')) {
          const swVal = sections.get('STARTS_WITH')!.content;
          if (!swVal || !swVal.trim()) {
            throw new V2ProtocolError('EMPTY_STARTS_WITH', blockIndex, sections.get('STARTS_WITH')!.lineNum);
          }
          startsWithValue = swVal;
        }

        let parsedSelector: StructuralSelector;
        try {
          parsedSelector = parseSelector(selectorEntry.value, startsWithValue);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          throw new V2ProtocolError('INVALID_SELECTOR', blockIndex, selectorEntry.lineNum, message);
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
    throw new V2ProtocolError('NO_INSCRIBE_BLOCKS', 0, 1);
  }

  return operations;
}
