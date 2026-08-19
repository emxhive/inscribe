import { INSCRIBE_BEGIN, INSCRIBE_END } from './constants';
import { matchesMarker } from './parseUtils';

export type CliCommandRisk = 'normal' | 'risky' | 'destructive';

export interface CliCommandSuggestion {
  id: string;
  command: string;
  language: string;
  sourceStartLine: number;
  sourceEndLine: number;
  risk: CliCommandRisk;
}

const SHELL_LANGUAGES = new Set([
  'bash',
  'cmd',
  'command',
  'console',
  'fish',
  'powershell',
  'ps1',
  'pwsh',
  'shell',
  'sh',
  'terminal',
  'zsh',
]);

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+(-[^\s]*[rf][^\s]*|-[^\s]*[fr][^\s]*)\b/i,
  /\bRemove-Item\b[\s\S]*(?:^|\s)-Recurse\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\b[\s\S]*(?:^|\s)-[^\s]*f/i,
  /\bdd\s+if=/i,
  /\bmkfs(\.|$|\s)/i,
  /\bformat\s+[a-z]:/i,
];

const RISKY_PATTERNS = [
  /\bsudo\b/i,
  /\bchmod\s+-R\b/i,
  /\bchown\s+-R\b/i,
  /\bSet-ExecutionPolicy\b/i,
  /\bInvoke-Expression\b/i,
  /\biex\b/i,
];

interface FenceOpening {
  char: '`' | '~';
  length: number;
  language: string;
}

function parseFenceOpening(line: string): FenceOpening | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^(`{3,}|~{3,})\s*([^\s`]*)?/);
  if (!match) return null;
  const marker = match[1];
  const rawLanguage = (match[2] ?? '').trim().toLowerCase();
  const language = rawLanguage.replace(/^\{?\.?/, '').replace(/\}?$/, '');
  return {
    char: marker[0] as '`' | '~',
    length: marker.length,
    language,
  };
}

function isFenceClosing(line: string, opening: FenceOpening): boolean {
  const trimmed = line.trim();
  const pattern = opening.char === '`' ? /^(`{3,}).*$/ : /^(~{3,}).*$/;
  const match = trimmed.match(pattern);
  return Boolean(match && match[1].length >= opening.length);
}

function isShellLanguage(language: string): boolean {
  return SHELL_LANGUAGES.has(language.toLowerCase());
}

export function classifyCommandRisk(command: string): CliCommandRisk {
  if (DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(command))) {
    return 'destructive';
  }
  if (RISKY_PATTERNS.some((pattern) => pattern.test(command))) {
    return 'risky';
  }
  return 'normal';
}

function hasLineContinuation(line: string, language: string): boolean {
  const trimmed = line.trimEnd();
  if (!trimmed) return false;
  if (language === 'powershell' || language === 'ps1' || language === 'pwsh') {
    return trimmed.endsWith('`') || trimmed.endsWith('|');
  }
  return trimmed.endsWith('\\') || trimmed.endsWith('|') || trimmed.endsWith('&&') || trimmed.endsWith('||');
}

function shouldIgnoreCommandLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length === 0 || trimmed.startsWith('#') || trimmed.startsWith('//');
}

function buildCommandId(command: string, startLine: number): string {
  let hash = 0;
  for (let index = 0; index < command.length; index++) {
    hash = ((hash << 5) - hash + command.charCodeAt(index)) | 0;
  }
  return `cli-${startLine}-${Math.abs(hash).toString(36)}`;
}

function splitFenceCommands(
  contentLines: string[],
  language: string,
  firstContentLine: number,
): CliCommandSuggestion[] {
  const suggestions: CliCommandSuggestion[] = [];
  let pending: string[] = [];
  let pendingStartLine = firstContentLine;

  const flush = (endLine: number) => {
    const command = pending.join('\n').trim();
    if (command.length > 0) {
      suggestions.push({
        id: buildCommandId(command, pendingStartLine),
        command,
        language,
        sourceStartLine: pendingStartLine,
        sourceEndLine: endLine,
        risk: classifyCommandRisk(command),
      });
    }
    pending = [];
  };

  contentLines.forEach((line, index) => {
    const lineNumber = firstContentLine + index;
    if (pending.length === 0) {
      if (shouldIgnoreCommandLine(line)) return;
      pendingStartLine = lineNumber;
    }

    pending.push(line);

    if (!hasLineContinuation(line, language)) {
      flush(lineNumber);
    }
  });

  if (pending.length > 0) {
    flush(firstContentLine + contentLines.length - 1);
  }

  const seenCommands = new Set<string>();
  return suggestions.filter((suggestion) => {
    if (seenCommands.has(suggestion.command)) {
      return false;
    }
    seenCommands.add(suggestion.command);
    return true;
  });
}

export function extractCliCommandSuggestions(text: string): CliCommandSuggestion[] {
  const lines = text.split('\n');
  const suggestions: CliCommandSuggestion[] = [];
  let inInscribeBlock = false;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    if (matchesMarker(line, INSCRIBE_BEGIN) || line.trim() === '<<<INSCRIBE') {
      inInscribeBlock = true;
      continue;
    }

    if (matchesMarker(line, INSCRIBE_END) || line.trim() === 'INSCRIBE>>>') {
      inInscribeBlock = false;
      continue;
    }

    if (inInscribeBlock) {
      continue;
    }

    const opening = parseFenceOpening(line);
    if (!opening) {
      continue;
    }

    let endIndex = -1;
    for (let cursor = index + 1; cursor < lines.length; cursor++) {
      if (isFenceClosing(lines[cursor], opening)) {
        endIndex = cursor;
        break;
      }
    }

    if (endIndex === -1) {
      break;
    }

    if (isShellLanguage(opening.language)) {
      suggestions.push(
        ...splitFenceCommands(
          lines.slice(index + 1, endIndex),
          opening.language,
          index + 2,
        ),
      );
    }

    index = endIndex;
  }

  return suggestions;
}
