import {
  OPERATION_MODES,
  isValidMode,
  type Mode,
  parseDirectiveLine,
  FieldKey,
} from '@inscribe/shared';
import { isFenceOpeningLine } from './parseFencedBlock';

export interface DirectiveParseResult {
  file: string;
  mode: Mode;
  directives: Record<string, string>;
  contentStartIndex: number;
  error?: string;
  warnings?: string[];
}

const FIELD_KEY_MAP: Partial<Record<FieldKey, string | null>> = {
  FILE: null,
  MODE: null,
  START_LINE_CONTAINS: 'START_LINE_CONTAINS',
  START_LINE_EQUALS: 'START_LINE_EQUALS',
  END_LINE_CONTAINS: 'END_LINE_CONTAINS',
  END_LINE_EQUALS: 'END_LINE_EQUALS',
  RANGE_CONTAINS: 'RANGE_CONTAINS',
  NAME: 'NAME',
  START: 'START',
  END: 'END',
  CONTAINS: 'CONTAINS',
};

export function parseDirectives(lines: string[]): DirectiveParseResult {
  const directives: Record<string, string> = {};
  const warnings: string[] = [];
  let file = '';
  let mode: Mode | null = null;
  let modeError: string | null = null;
  let contentStartIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (isFenceOpeningLine(trimmed)) { contentStartIndex = i; break; }
    const parsed = parseDirectiveLine(trimmed);
    if (!parsed.matched) {
      if (parsed.usedPrefix && parsed.raw.trim()) warnings.push(`Invalid directive format: ${parsed.raw.trim()} (headers and directives should not use $inscribe prefix)`);
      continue;
    }
    const fieldKey = FIELD_KEY_MAP[parsed.key!];
    const value = parsed.value ?? '';
    if (parsed.key === 'FILE') file = value;
    else if (parsed.key === 'MODE') {
      if (!value) modeError = 'Missing MODE header';
      else if (isValidMode(value)) mode = value;
      else modeError = `Invalid MODE header: ${value}`;
    } else if (fieldKey) {
      if (fieldKey === 'START') {
        return { file, mode: mode ?? OPERATION_MODES[0], directives, contentStartIndex: -1, error: 'START is no longer supported. Use START_LINE_CONTAINS or START_LINE_EQUALS.' };
      }
      if (fieldKey === 'END') {
        return { file, mode: mode ?? OPERATION_MODES[0], directives, contentStartIndex: -1, error: 'END is no longer supported. Use END_LINE_CONTAINS or END_LINE_EQUALS.' };
      }
      if (fieldKey === 'CONTAINS') {
        return { file, mode: mode ?? OPERATION_MODES[0], directives, contentStartIndex: -1, error: 'CONTAINS is no longer supported. Use RANGE_CONTAINS.' };
      }

      if (fieldKey === 'RANGE_CONTAINS' && directives[fieldKey]) directives[fieldKey] = `${directives[fieldKey]}\n${value}`;
      else directives[fieldKey] = value;
    }
  }

  if (!file) return { file: '', mode: OPERATION_MODES[0], directives: {}, contentStartIndex: -1, error: 'Missing FILE header' };
  if (modeError) return { file, mode: OPERATION_MODES[0], directives, contentStartIndex, error: modeError };
  if (!mode) return { file, mode: OPERATION_MODES[0], directives, contentStartIndex, error: 'Missing MODE header' };
  return { file, mode, directives, contentStartIndex, warnings: warnings.length > 0 ? warnings : undefined };
}
