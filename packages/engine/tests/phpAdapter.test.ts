import { describe, expect, it, vi, beforeEach } from 'vitest';

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  spawnSync: spawnSyncMock,
}));

import { phpAdapter } from '../src/language/phpAdapter';

describe('phpAdapter symbol resolution', () => {
  it('resolves class-like PHP declarations by symbol name', () => {
    const source = [
      '<?php',
      'namespace App\\Example;',
      '',
      '/** Service doc */',
      '#[Service]',
      'final readonly class SaveRoundDraw',
      '{',
      '    public function handle(): void {}',
      '}',
      '',
      'interface DrawContract {}',
      'trait DrawHelpers {}',
      'enum DrawState: string { case Draft = \'draft\'; }',
      '',
    ].join('\n');

    expect(source.slice(...rangeTuple(phpAdapter.resolveSymbolDeclarationRange(source, 'SaveRoundDraw')))).toBe([
      '/** Service doc */',
      '#[Service]',
      'final readonly class SaveRoundDraw',
      '{',
      '    public function handle(): void {}',
      '}',
    ].join('\n'));
    expect(source.slice(...rangeTuple(phpAdapter.resolveSymbolDeclarationRange(source, 'DrawContract')))).toBe('interface DrawContract {}');
    expect(source.slice(...rangeTuple(phpAdapter.resolveSymbolDeclarationRange(source, 'DrawHelpers')))).toBe('trait DrawHelpers {}');
    expect(source.slice(...rangeTuple(phpAdapter.resolveSymbolDeclarationRange(source, 'DrawState')))).toBe('enum DrawState: string { case Draft = \'draft\'; }');
  });

  it('resolves scoped PHP methods and rejects ambiguous bare methods', () => {
    const source = [
      '<?php',
      'final class FirstAction',
      '{',
      '    public function handle(): void {}',
      '}',
      '',
      'final class SecondAction',
      '{',
      '    public function handle(): void {}',
      '}',
    ].join('\n');

    const scoped = phpAdapter.resolveSymbolDeclarationRange(source, 'SecondAction::handle');
    expect(source.slice(scoped.start, scoped.end)).toBe('public function handle(): void {}');
    expect(() => phpAdapter.resolveSymbolDeclarationRange(source, 'handle')).toThrow('Structural symbol target is ambiguous.');
    expect(() => phpAdapter.resolveSymbolDeclarationRange(source, 'MissingAction::handle')).toThrow(
      'No matching PHP class, interface, trait, enum, function, or method declaration was found.',
    );
  });

  it('ignores anonymous classes when matching class symbols', () => {
    const source = [
      '<?php',
      '$instance = new class {',
      '    public function handle(): void {}',
      '};',
      'final class RealAction {}',
    ].join('\n');

    expect(source.slice(...rangeTuple(phpAdapter.resolveSymbolDeclarationRange(source, 'RealAction')))).toBe('final class RealAction {}');
  });
});

describe('phpAdapter candidate validation', () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
  });

  it('lints PHP candidates through shell-resolved stdin', () => {
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: 'No syntax errors detected in Standard input code',
      stderr: '',
    });

    phpAdapter.validateCandidate?.('app/example.php', '<?php echo "ok";');

    expect(spawnSyncMock).toHaveBeenCalledWith('php -l', {
      encoding: 'utf-8',
      input: '<?php echo "ok";',
      shell: true,
      windowsHide: true,
    });
  });

  it('reports PHP parse errors without writing the candidate', () => {
    spawnSyncMock.mockReturnValue({
      status: 255,
      stdout: 'Errors parsing Standard input code',
      stderr: 'PHP Parse error: syntax error',
    });

    expect(() => phpAdapter.validateCandidate?.('app/example.php', '<?php function {')).toThrow(
      [
        'INSCRIBE_PARSE_ERROR',
        'File: app/example.php',
        'Operation: php_candidate_validation',
        'Status: blocked_before_write',
        'Message: PHP Parse error: syntax error',
        '',
        'Note:',
        'The patch was applied only to an in-memory candidate.',
        'The real file was not modified.',
      ].join('\n'),
    );
  });
});

function rangeTuple(range: { start: number; end: number }): [number, number] {
  return [range.start, range.end];
}
