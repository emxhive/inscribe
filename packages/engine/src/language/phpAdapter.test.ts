import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { describe, it, expect } from 'vitest';
import { phpAdapter } from './phpAdapter';

function hasPhpHelper(): boolean {
  const helperRoot = path.resolve(process.cwd(), 'bin', 'php_helper');
  try {
    execFileSync('php -v', { stdio: 'ignore', shell: true });
    return fs.existsSync(path.join(helperRoot, 'vendor', 'autoload.php'));
  } catch {
    return false;
  }
}

const describePhp = hasPhpHelper() ? describe : describe.skip;

describePhp('phpAdapter', () => {
  it('supports PHP file extensions only', () => {
    expect(phpAdapter.supportsFile('index.php')).toBe(true);
    expect(phpAdapter.supportsFile('template.phtml')).toBe(true);
    expect(phpAdapter.supportsFile('index.ts')).toBe(false);
  });

  it('resolves namespaced functions without matching comments or strings', () => {
    const content = [
      '<?php',
      'namespace App\\Feature;',
      '// function sync() {}',
      '$fake = "function sync() {}";',
      'function sync(): void {',
      '    echo $fake;',
      '}',
    ].join('\n');

    const range = phpAdapter.resolveSymbolDeclarationRange(content, 'App\\Feature\\sync');
    expect(content.slice(range.start, range.end)).toBe([
      'function sync(): void {',
      '    echo $fake;',
      '}',
    ].join('\n'));
  });

  it('resolves classes, interfaces, traits, and enums', () => {
    const content = [
      '<?php',
      'namespace Domain;',
      'class Invoice {}',
      'interface Billable {}',
      'trait HasTotals {}',
      'enum Status { case Paid; }',
    ].join('\n');

    expect(slice(content, phpAdapter.resolveSymbolDeclarationRange(content, 'Domain\\Invoice'))).toBe('class Invoice {}');
    expect(slice(content, phpAdapter.resolveSymbolDeclarationRange(content, 'Billable'))).toBe('interface Billable {}');
    expect(slice(content, phpAdapter.resolveSymbolDeclarationRange(content, 'HasTotals'))).toBe('trait HasTotals {}');
    expect(slice(content, phpAdapter.resolveSymbolDeclarationRange(content, 'Status'))).toBe('enum Status { case Paid; }');
  });

  it('resolves attributed methods with modifiers and nested blocks', () => {
    const content = [
      '<?php',
      'class Worker {',
      '    /** Runs the worker. */',
      '    #[Route("/run")]',
      '    public static function run(): void {',
      '        if (true) {',
      '            echo "run";',
      '        }',
      '    }',
      '}',
    ].join('\n');

    const range = phpAdapter.resolveSymbolDeclarationRange(content, 'Worker::run');
    expect(content.slice(range.start, range.end)).toBe([
      '/** Runs the worker. */',
      '    #[Route("/run")]',
      '    public static function run(): void {',
      '        if (true) {',
      '            echo "run";',
      '        }',
      '    }',
    ].join('\n'));
  });

  it('reports ambiguity for repeated methods and allows qualified selection', () => {
    const content = [
      '<?php',
      'namespace App;',
      'class A { public function save(): void {} }',
      'class B { public function save(): void {} }',
    ].join('\n');

    expect(() => phpAdapter.resolveSymbolDeclarationRange(content, 'save'))
      .toThrow(/Structural symbol target is ambiguous/);

    expect(slice(content, phpAdapter.resolveSymbolDeclarationRange(content, 'App\\B::save')))
      .toBe('public function save(): void {}');
  });

  it('fails safely on class and legacy constructor name collisions', () => {
    const content = [
      '<?php',
      'class Legacy {',
      '    public function Legacy(): void {}',
      '}',
    ].join('\n');

    expect(() => phpAdapter.resolveSymbolDeclarationRange(content, 'Legacy'))
      .toThrow(/Structural symbol target is ambiguous/);
    expect(slice(content, phpAdapter.resolveSymbolDeclarationRange(content, 'Legacy::Legacy')))
      .toBe('public function Legacy(): void {}');
  });

  it('does not treat nested function declarations as supported top-level symbols', () => {
    const content = [
      '<?php',
      'function outer(): void {',
      '    function inner(): void {}',
      '}',
    ].join('\n');

    expect(() => phpAdapter.resolveSymbolDeclarationRange(content, 'inner'))
      .toThrow(/Structural symbol target not found/);
  });

  it('converts parser byte offsets to JavaScript string offsets', () => {
    const content = [
      '<?php',
      '$label = "Olá";',
      'function target(): void {}',
    ].join('\n');

    expect(slice(content, phpAdapter.resolveSymbolDeclarationRange(content, 'target')))
      .toBe('function target(): void {}');
  });

  it('fails safely for missing symbols and malformed source', () => {
    expect(() => phpAdapter.resolveSymbolDeclarationRange('<?php function ok() {}', 'missing'))
      .toThrow(/Structural symbol target not found/);

    expect(() => phpAdapter.resolveSymbolDeclarationRange('<?php function broken( {', 'broken'))
      .toThrow(/Structural PHP source could not be parsed/);
  });

  it('validates candidates before write', () => {
    expect(() => phpAdapter.validateCandidate('test.php', '<?php function ok(): void {}')).not.toThrow();
    expect(() => phpAdapter.validateCandidate('test.php', '<?php function broken( {'))
      .toThrow(/INSCRIBE_PARSE_ERROR/);
  });
});

function slice(content: string, range: { start: number; end: number }): string {
  return content.slice(range.start, range.end);
}
