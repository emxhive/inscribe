import { describe, expect, it } from 'vitest';
import { parseLiveIntakeStructure } from './liveIntake';

describe('parseLiveIntakeStructure', () => {
  it('routes clean V1 input to V1 scanner and preserves V1 structure', () => {
    const input = `$inscribe BEGIN
FILE: src/a.ts
MODE: create_file
hello from v1
$inscribe END`;
    const result = parseLiveIntakeStructure(input);
    expect(result.protocol).toBe('v1');
    expect(result.blocks.length).toBe(1);
    expect(result.blocks[0].protocol).toBe('v1');
    expect(result.blocks[0].label).toBe('src/a.ts');
  });

  it('routes V2 input to V2 scanner', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file
INSCRIBE>>>`;
    const result = parseLiveIntakeStructure(input);
    expect(result.protocol).toBe('v2');
    expect(result.blocks.length).toBe(1);
    expect(result.blocks[0].protocol).toBe('v2');
    expect(result.blocks[0].filePath).toBe('src/a.ts');
  });

  it('warns on mixed V1 and V2 markers', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: delete_file
INSCRIBE>>>
$inscribe BEGIN`;
    const result = parseLiveIntakeStructure(input);
    expect(result.protocol).toBe('v2');
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('Mixed V1/V2');
  });

  it('does not warn on literal $inscribe inside payload', () => {
    const input = `<<<INSCRIBE
FILE: src/a.ts
MODE: create_file
<<<CONTENT
const prefix = "$inscribe";
CONTENT>>>
INSCRIBE>>>`;
    const result = parseLiveIntakeStructure(input);
    expect(result.protocol).toBe('v2');
    expect(result.warnings.length).toBe(0);
  });

  it('isolated V2 section marker still routes V2', () => {
    const input = `some text
<<<CONTENT
other text`;
    const result = parseLiveIntakeStructure(input);
    expect(result.protocol).toBe('v2');
  });
});
