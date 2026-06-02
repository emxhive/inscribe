import { describe, expect, it } from 'vitest';
import { resolveSymbolDeclarationRange } from '../src/language/jsTsStructuralResolvers';

describe('JS/TS symbol resolution', () => {
  it('resolves scoped class methods with PHP-compatible and JS-style selectors', () => {
    const source = [
      'export class DrawController {',
      '  add() {',
      '    return "add";',
      '  }',
      '',
      '  publish() {',
      '    return "publish";',
      '  }',
      '}',
    ].join('\n');

    const doubleColon = resolveSymbolDeclarationRange(source, 'DrawController::add');
    const dot = resolveSymbolDeclarationRange(source, 'DrawController.publish');

    expect(source.slice(doubleColon.start, doubleColon.end)).toBe([
      'add() {',
      '    return "add";',
      '  }',
    ].join('\n'));
    expect(source.slice(dot.start, dot.end)).toBe([
      'publish() {',
      '    return "publish";',
      '  }',
    ].join('\n'));
  });

  it('rejects ambiguous bare method names and recommends scoped selectors', () => {
    const source = [
      'class FirstAction {',
      '  handle() { return "first"; }',
      '}',
      'class SecondAction {',
      '  handle() { return "second"; }',
      '}',
    ].join('\n');

    expect(() => resolveSymbolDeclarationRange(source, 'handle')).toThrow(
      'Use a scoped selector such as ClassName::method or ClassName.method for methods when possible.',
    );
  });

  it('resolves TypeScript class-like declarations by bare name', () => {
    const source = [
      'export interface DrawPayload {',
      '  roundId: number;',
      '}',
      '',
      'export enum DrawState {',
      '  Draft = "draft",',
      '}',
    ].join('\n');

    const interfaceRange = resolveSymbolDeclarationRange(source, 'DrawPayload');
    const enumRange = resolveSymbolDeclarationRange(source, 'DrawState');

    expect(source.slice(interfaceRange.start, interfaceRange.end)).toBe([
      'export interface DrawPayload {',
      '  roundId: number;',
      '}',
    ].join('\n'));
    expect(source.slice(enumRange.start, enumRange.end)).toBe([
      'export enum DrawState {',
      '  Draft = "draft",',
      '}',
    ].join('\n'));
  });
});
