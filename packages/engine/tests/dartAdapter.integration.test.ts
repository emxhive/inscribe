import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { applyChanges } from '../src/apply/applyChanges';

// Absolute path to the Dart helper entry point.
const HELPER_PATH = path.resolve(
  __dirname,
  '../bin/dart_helper/bin/inscribe_dart_helper.dart',
);

function hasDartSdk(): boolean {
  let command = 'dart';
  let args = ['--version'];
  if (process.platform === 'win32') {
    command = process.env.ComSpec ?? 'cmd.exe';
    args = ['/d', '/s', '/c', 'dart --version'];
  }
  try {
    const result = spawnSync(command, args, { encoding: 'utf-8', shell: false });
    if (result.error) return false;
    if (result.status !== 0) return false;
    return true;
  } catch {
    return false;
  }
}

const isDartAvailable = hasDartSdk();

describe.skipIf(!isDartAvailable)('dartAdapter - integration tests', () => {
  let workspaceRoot = '';
  let repoRoot = '';

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-dart-integration-'));
    repoRoot = path.join(workspaceRoot, 'repo');
    fs.mkdirSync(repoRoot, { recursive: true });
    process.env.INSCRIBE_USER_DATA = path.join(workspaceRoot, 'user-data');
  });

  afterEach(() => {
    delete process.env.INSCRIBE_USER_DATA;
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('real dart run: collect_symbols on a simple class', () => {
    const source = 'class Greeter { void greet() {} }';
    const helperRoot = path.resolve(__dirname, '../bin/dart_helper');
    let command = 'dart';
    let args = ['run', 'bin/inscribe_dart_helper.dart'];
    if (process.platform === 'win32') {
      command = process.env.ComSpec ?? 'cmd.exe';
      args = ['/d', '/s', '/c', 'dart run "bin/inscribe_dart_helper.dart"'];
    }
    const result = spawnSync(command, args, {
      cwd: helperRoot,
      encoding: 'utf-8',
      input: JSON.stringify({ action: 'collect_symbols', content: source }),
      shell: false,
      windowsHide: true,
      windowsVerbatimArguments: process.platform === 'win32',
    });

    expect(result.error, `dart run failed: ${result.error}`).toBeUndefined();

    let parsed: any;
    try {
      parsed = JSON.parse((result.stdout ?? '').trim());
    } catch {
      throw new Error(
        `Helper produced non-JSON stdout.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
    }

    expect(parsed.ok).toBe(true);
    const symbols: any[] = parsed.symbols ?? [];

    const greeterClass = symbols.find((s: any) => s.name === 'Greeter' && s.kind === 'class');
    expect(greeterClass, 'Expected class Greeter in symbols').toBeDefined();
    expect(source.slice(greeterClass.start, greeterClass.end)).toBe(source);
  }, 90_000);

  it('successfully performs replace_symbol on a Dart class', () => {
    const filePath = 'lib/service.dart';
    const fullPath = path.join(repoRoot, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(
      fullPath,
      'class UserService {\n  void save() {\n    print("old");\n  }\n}\n'
    );

    const result = applyChanges(
      {
        operations: [
          {
            type: 'replace_symbol',
            file: filePath,
            content: 'class UserService {\n  void save() {\n    print("new");\n  }\n}',
            directives: { NAME: 'UserService' },
            blockIndex: 0,
          },
        ],
      },
      repoRoot
    );

    expect(result.success, `Changes application failed: ${result.errors?.join('\n')}`).toBe(true);
    const updatedContent = fs.readFileSync(fullPath, 'utf-8');
    expect(updatedContent.trim()).toBe(
      'class UserService {\n  void save() {\n    print("new");\n  }\n}'
    );
  }, 90_000);

  it('blocks invalid Dart replacement syntax before write and preserves the original file', () => {
    const filePath = 'lib/service.dart';
    const fullPath = path.join(repoRoot, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const originalContent = 'class UserService {\n  void save() {}\n}\n';
    fs.writeFileSync(fullPath, originalContent);

    const result = applyChanges(
      {
        operations: [
          {
            type: 'replace_symbol',
            file: filePath,
            content: 'class UserService {\n  void save() {\n    invalid syntax here;\n}',
            directives: { NAME: 'UserService' },
            blockIndex: 0,
          },
        ],
      },
      repoRoot
    );

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toContain('INSCRIBE_PARSE_ERROR');
    const updatedContent = fs.readFileSync(fullPath, 'utf-8');
    expect(updatedContent).toBe(originalContent);
  }, 90_000);

  it('fails for ambiguous bare Dart method selector and preserves the original file', () => {
    const filePath = 'lib/service.dart';
    const fullPath = path.join(repoRoot, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const originalContent = [
      'class FirstService {',
      '  void save() {}',
      '}',
      'class SecondService {',
      '  void save() {}',
      '}',
    ].join('\n') + '\n';
    fs.writeFileSync(fullPath, originalContent);

    const result = applyChanges(
      {
        operations: [
          {
            type: 'replace_symbol',
            file: filePath,
            content: '  void save() { print("new"); }',
            directives: { NAME: 'save' },
            blockIndex: 0,
          },
        ],
      },
      repoRoot
    );

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toContain('Structural symbol target is ambiguous');
    const updatedContent = fs.readFileSync(fullPath, 'utf-8');
    expect(updatedContent).toBe(originalContent);
  }, 90_000);
});
