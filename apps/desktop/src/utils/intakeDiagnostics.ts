import type { PreviewErrorDTO } from '@/ipc/previewTypes';
import type { IntakeBlock, IntakeLineMeta } from './intake';
import type { LiveIntakeStructure } from './liveIntake';

export interface AttributedIntakeStructure extends LiveIntakeStructure {
  diagnosticsByBlockId: Record<string, PreviewErrorDTO[]>;
  globalDiagnostics: PreviewErrorDTO[];
}

export function findDiagnosticBlock(
  blocks: IntakeBlock[],
  diagnostic: PreviewErrorDTO,
): IntakeBlock | undefined {
  if (typeof diagnostic.line === 'number') {
    const lineIndex = diagnostic.line - 1;
    const lineBlock = blocks.find(
      (block) => lineIndex >= block.startLine && lineIndex <= block.endLine,
    );
    if (lineBlock) {
      return lineBlock;
    }
  }

  if (typeof diagnostic.blockIndex === 'number') {
    return blocks.find((block) => block.index === diagnostic.blockIndex);
  }

  return undefined;
}

function diagnosticIdentity(diagnostic: PreviewErrorDTO): string {
  return [
    diagnostic.blockIndex ?? '',
    diagnostic.line ?? '',
    diagnostic.code,
    diagnostic.message,
  ].join(':');
}

export function attributePreviewDiagnostics(
  structure: LiveIntakeStructure,
  diagnostics: PreviewErrorDTO[],
): AttributedIntakeStructure {
  if (diagnostics.length === 0) {
    return {
      ...structure,
      diagnosticsByBlockId: {},
      globalDiagnostics: [],
    };
  }

  const blocks = structure.blocks.map((block) => ({
    ...block,
    errors: [...block.errors],
    warnings: [...block.warnings],
  }));
  const lines: IntakeLineMeta[] = structure.lines.map((line) => ({ ...line }));
  const diagnosticsByBlockId: Record<string, PreviewErrorDTO[]> = {};
  const globalDiagnostics: PreviewErrorDTO[] = [];
  const seenByBlock = new Map<string, Set<string>>();

  for (const diagnostic of diagnostics) {
    const block = findDiagnosticBlock(blocks, diagnostic);
    if (!block) {
      globalDiagnostics.push(diagnostic);
      continue;
    }

    const identity = diagnosticIdentity(diagnostic);
    const seen = seenByBlock.get(block.id) ?? new Set<string>();
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    seenByBlock.set(block.id, seen);
    diagnosticsByBlockId[block.id] = [...(diagnosticsByBlockId[block.id] ?? []), diagnostic];

    if (!block.errors.includes(diagnostic.message)) {
      block.errors.push(diagnostic.message);
    }
    block.status = 'error';

    const diagnosticLineIndex = typeof diagnostic.line === 'number'
      ? diagnostic.line - 1
      : block.startLine;
    const line = lines[diagnosticLineIndex];
    if (line) {
      line.blockId = block.id;
      line.status = 'error';
    }
  }

  return {
    ...structure,
    blocks,
    lines,
    diagnosticsByBlockId,
    globalDiagnostics,
  };
}
