import { spawnSync } from 'child_process';
import * as phpParser from 'php-parser';
import { StructuralLanguageAdapter, StructuralSymbolRange } from './types';

const PHP_EXTENSIONS = new Set(['.php', '.phtml']);
const PHP_CLASS_LIKE_KINDS = new Set(['class', 'interface', 'trait', 'enum']);
const PHP_SYMBOL_KINDS = new Set([...PHP_CLASS_LIKE_KINDS, 'method', 'function']);

interface PhpPosition {
  offset: number;
}

interface PhpLocation {
  start: PhpPosition;
  end: PhpPosition;
}

interface PhpNode {
  kind: string;
  loc?: PhpLocation | null;
  name?: string | { name?: string };
  children?: PhpNode[];
  body?: PhpNode[] | PhpNode | null;
  leadingComments?: PhpNode[] | null;
  attrGroups?: PhpNode[] | null;
  isAnonymous?: boolean;
  [key: string]: unknown;
}

interface PhpSymbolMatch {
  name: string;
  ownerName: string | null;
  kind: string;
  start: number;
  end: number;
  description: string;
}

const phpEngine = new phpParser.Engine({
  parser: {
    extractDoc: true,
    php7: true,
  },
  ast: {
    withPositions: true,
  },
});

function supportsPhpFile(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.');
  return dot !== -1 && PHP_EXTENSIONS.has(filePath.slice(dot));
}

function getNodeName(node: PhpNode): string | null {
  if (typeof node.name === 'string') {
    return node.name;
  }
  if (node.name && typeof node.name === 'object' && typeof node.name.name === 'string') {
    return node.name.name;
  }
  return null;
}

function getNodeStart(node: PhpNode): number | null {
  if (!node.loc) {
    return null;
  }

  const offsets = [node.loc.start.offset];
  node.leadingComments?.forEach((comment) => {
    if (comment.loc) offsets.push(comment.loc.start.offset);
  });
  node.attrGroups?.forEach((attrGroup) => {
    const attrStart = getNodeStart(attrGroup);
    if (attrStart !== null) offsets.push(attrStart);
  });

  return Math.min(...offsets);
}

function walkPhpSymbols(
  node: PhpNode,
  ownerName: string | null,
  matches: PhpSymbolMatch[],
  visited = new Set<PhpNode>(),
): void {
  if (visited.has(node)) {
    return;
  }
  visited.add(node);

  const name = getNodeName(node);
  if (PHP_SYMBOL_KINDS.has(node.kind) && name && node.loc && !node.isAnonymous) {
    const start = getNodeStart(node);
    if (start !== null) {
      matches.push({
        name,
        ownerName,
        kind: node.kind,
        start,
        end: node.loc.end.offset,
        description: ownerName ? `Php ${ownerName}::${name} ${node.kind}` : `Php ${node.kind} ${name}`,
      });
    }
  }

  const nextOwnerName = PHP_CLASS_LIKE_KINDS.has(node.kind) && name && !node.isAnonymous ? name : ownerName;
  const childKeys = ['children', 'body'];
  for (const key of childKeys) {
    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach((child) => {
        if (child && typeof child === 'object' && 'kind' in child) {
          walkPhpSymbols(child as PhpNode, nextOwnerName, matches, visited);
        }
      });
    } else if (value && typeof value === 'object' && 'kind' in value) {
      walkPhpSymbols(value as PhpNode, nextOwnerName, matches, visited);
    }
  }
}

function parsePhpSymbols(content: string): PhpSymbolMatch[] {
  const ast = phpEngine.parseCode(content, 'candidate.php') as unknown as PhpNode;
  const matches: PhpSymbolMatch[] = [];
  walkPhpSymbols(ast, null, matches);
  return matches;
}

function collectPhpSymbolRanges(content: string, name: string): StructuralSymbolRange[] {
  const [ownerSelector, symbolSelector] = name.includes('::') ? name.split('::', 2) : [null, name];
  const matches = parsePhpSymbols(content).filter((match) => {
    if (ownerSelector) {
      return match.ownerName === ownerSelector && match.name === symbolSelector;
    }
    return match.name === symbolSelector;
  });

  return matches.map((match) => ({
    start: match.start,
    end: match.end,
    description: match.description,
  }));
}

function formatPhpSymbolNotFoundMessage(name: string): string {
  return [
    'Structural symbol target not found.',
    '',
    'MODE: replace_symbol',
    `NAME: ${name}`,
    '',
    'No matching PHP class, interface, trait, enum, function, or method declaration was found.',
    'For methods, use ClassName::method when the bare method name is not unique.',
    'File was not modified.',
  ].join('\n');
}

function formatPhpSymbolAmbiguousMessage(name: string, matches: StructuralSymbolRange[]): string {
  const list = matches.map((match) => `- ${match.description}`).join('\n');
  return [
    'Structural symbol target is ambiguous.',
    '',
    'MODE: replace_symbol',
    `NAME: ${name}`,
    '',
    `Matched ${matches.length} PHP declarations:`,
    list,
    '',
    'Use a scoped selector such as ClassName::method for methods when possible.',
    'File was not modified.',
  ].join('\n');
}

function validatePhpCandidateOrThrow(filePath: string, candidate: string): void {
  try {
    const result = spawnSync('php -l', {
      encoding: 'utf-8',
      input: candidate,
      shell: true,
      windowsHide: true,
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || `php -l exited with status ${result.status}`).trim());
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PHP parse error';
    throw new Error([
      'INSCRIBE_PARSE_ERROR',
      `File: ${filePath}`,
      'Operation: php_candidate_validation',
      'Status: blocked_before_write',
      `Message: ${message}`,
      '',
      'Note:',
      'The patch was applied only to an in-memory candidate.',
      'The real file was not modified.',
    ].join('\n'));
  }
}

export const phpAdapter: StructuralLanguageAdapter = {
  id: 'php-basic',
  supportsFile(filePath: string): boolean {
    return supportsPhpFile(filePath);
  },
  resolveSymbolDeclarationRange(content: string, name: string): StructuralSymbolRange {
    const matches = collectPhpSymbolRanges(content, name);
    if (matches.length === 0) {
      throw new Error(formatPhpSymbolNotFoundMessage(name));
    }
    if (matches.length > 1) {
      throw new Error(formatPhpSymbolAmbiguousMessage(name, matches));
    }
    return matches[0];
  },
  validateCandidate(filePath: string, candidate: string): void {
    validatePhpCandidateOrThrow(filePath, candidate);
  },
};
