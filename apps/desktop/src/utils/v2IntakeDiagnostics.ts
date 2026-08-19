import type { PreviewV2ErrorDTO } from '@/ipc/previewV2Types';
import type { IntakeBlock, IntakeLineMeta } from './intake';
import type { LiveIntakeStructure } from './liveIntake';

export interface AttributedV2IntakeStructure extends LiveIntakeStructure {
  diagnosticsByBlockId: Record<string, PreviewV2ErrorDTO[]>;
  globalDiagnostics: PreviewV2ErrorDTO[];
}

export function findV2DiagnosticBlock(
  blocks: IntakeBlock[],
  diagnostic: PreviewV2ErrorDTO,
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

function diagnosticIdentity(diagnostic: PreviewV2ErrorDTO): string {
  return [
    diagnostic.blockIndex ?? '',
    diagnostic.line ?? '',
    diagnostic.code,
    diagnostic.message,
  ].join(':');
}

export function attributeV2PreviewDiagnostics(
  structure: LiveIntakeStructure,
  diagnostics: PreviewV2ErrorDTO[],
): AttributedV2IntakeStructure {
  if (structure.protocol !== 'v2' || diagnostics.length === 0) {
    return {
      ...structure,
      diagnosticsByBlockId: {},
      globalDiagnostics: structure.protocol === 'v2' ? diagnostics : [],
    };
  }

  const blocks = structure.blocks.map((block) => ({
    ...block,
    errors: [...block.errors],
    warnings: [...block.warnings],
  }));
  const lines: IntakeLineMeta[] = structure.lines.map((line) => ({ ...line }));
  const diagnosticsByBlockId: Record<string, PreviewV2ErrorDTO[]> = {};
  const globalDiagnostics: PreviewV2ErrorDTO[] = [];
  const seenByBlock = new Map<string, Set<string>>();

  for (const diagnostic of diagnostics) {
    const block = findV2DiagnosticBlock(blocks, diagnostic);
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
