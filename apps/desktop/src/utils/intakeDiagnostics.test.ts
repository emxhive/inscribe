import { describe, expect, it } from 'vitest';
import { parseLiveIntakeStructure } from './liveIntake';
import { attributePreviewDiagnostics } from './intakeDiagnostics';

describe('attributePreviewDiagnostics', () => {
  it('marks only the source block and line reported by preview', () => {
    const input = `<<<INSCRIBE
FILE: a.ts
MODE: delete_file
INSCRIBE>>>
<<<INSCRIBE
FILE: b.ts
MODE: delete_file
INSCRIBE>>>`;
    const structure = parseLiveIntakeStructure(input);
    const result = attributePreviewDiagnostics(structure, [{
      type: 'resolution',
      code: 'FILE_NOT_FOUND',
      message: 'File does not exist',
      blockIndex: 1,
      line: 5,
      filePath: 'b.ts',
    }]);

    expect(result.blocks[0].status).toBe('valid');
    expect(result.blocks[1].status).toBe('error');
    expect(result.blocks[1].errors).toContain('File does not exist');
    expect(result.diagnosticsByBlockId[result.blocks[1].id]).toHaveLength(1);
  });

  it('keeps system errors global', () => {
    const structure = parseLiveIntakeStructure('<<<INSCRIBE\nFILE: a.ts\nMODE: delete_file\nINSCRIBE>>>');
    const result = attributePreviewDiagnostics(structure, [{
      type: 'system',
      code: 'PREVIEW_FAILED',
      message: 'Preview failed',
    }]);

    expect(result.blocks[0].status).toBe('valid');
    expect(result.globalDiagnostics).toHaveLength(1);
  });
});
