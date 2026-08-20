import { describe, expect, it } from 'vitest';
import { extractCliCommandSuggestions } from '@inscribe/shared';
import { buildTerminalLineReplacement } from '@/utils/terminalLineReplacement';

describe('CLI command suggestion extraction', () => {
  it('extracts shell commands after attributed outer fences', () => {
    const suggestions = extractCliCommandSuggestions([
      '````text id="outer"',
      '$inscribe BEGIN',
      'FILE: app/example.php',
      'MODE: append_file',
      '```php',
      '<?php echo "ok";',
      '```',
      '$inscribe END',
      '````id="outer-close"',
      '',
      'Run:',
      '```bash id="commands"',
      'npm run types',
      'composer test:lint',
      'php artisan test --filter=IssuePendingTournamentInvitesTest',
      '```',
    ].join('\n'));

    expect(suggestions.map((suggestion) => suggestion.command)).toEqual([
      'npm run types',
      'composer test:lint',
      'php artisan test --filter=IssuePendingTournamentInvitesTest',
    ]);
  });

  it('drops incomplete continued shell commands', () => {
    const suggestions = extractCliCommandSuggestions([
      '```bash',
      'git add -- \\',
      '```',
    ].join('\n'));

    expect(suggestions).toEqual([]);
  });

  it('ignores consecutive V2 Inscribe blocks when extracting later shell commands', () => {
    const response = [
      'The benchmark path is already correct; only the five `tests/v2` files need the extra `..`. The current six-file worktree confirms that distinction.',
      '',
      '<<<INSCRIBE',
      'FILE: packages/engine/tests/v2/replaceNode.test.ts',
      'MODE: replace_text',
      '',
      '<<<SEARCH',
      '```ts',
      "const CORE_WASM = path.resolve(__dirname, '../../../node_modules/web-tree-sitter/tree-sitter.wasm');",
      '```',
      'SEARCH>>>',
      '',
      '<<<CONTENT',
      '```ts',
      "const CORE_WASM = path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter.wasm');",
      '```',
      'CONTENT>>>',
      'INSCRIBE>>>',
      '',
      '<<<INSCRIBE',
      'FILE: packages/engine/tests/v2/structuralSelector.test.ts',
      'MODE: replace_text',
      '',
      '<<<SEARCH',
      '```ts',
      "const CORE_WASM = path.resolve(__dirname, '../../../node_modules/web-tree-sitter/tree-sitter.wasm');",
      '```',
      'SEARCH>>>',
      '',
      '<<<CONTENT',
      '```ts',
      "const CORE_WASM = path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter.wasm');",
      '```',
      'CONTENT>>>',
      'INSCRIBE>>>',
      '',
      '<<<INSCRIBE',
      'FILE: packages/engine/tests/v2/treeSitterOffsets.test.ts',
      'MODE: replace_text',
      '',
      '<<<SEARCH',
      '```ts',
      "const CORE_WASM = path.resolve(__dirname, '../../../node_modules/web-tree-sitter/tree-sitter.wasm');",
      '```',
      'SEARCH>>>',
      '',
      '<<<CONTENT',
      '```ts',
      "const CORE_WASM = path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter.wasm');",
      '```',
      'CONTENT>>>',
      'INSCRIBE>>>',
      '',
      '<<<INSCRIBE',
      'FILE: packages/engine/tests/v2/treeSitterRuntime.test.ts',
      'MODE: replace_text',
      '',
      '<<<SEARCH',
      '```ts',
      "const CORE_WASM = path.resolve(__dirname, '../../../node_modules/web-tree-sitter/tree-sitter.wasm');",
      '```',
      'SEARCH>>>',
      '',
      '<<<CONTENT',
      '```ts',
      "const CORE_WASM = path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter.wasm');",
      '```',
      'CONTENT>>>',
      'INSCRIBE>>>',
      '',
      '<<<INSCRIBE',
      'FILE: packages/engine/tests/v2/treeSitterRuntime.test.ts',
      'MODE: replace_text',
      '',
      '<<<SEARCH',
      '```ts',
      "      coreWasmPath: path.resolve(__dirname, '../../../node_modules/web-tree-sitter/tree-sitter-other.wasm'),",
      '```',
      'SEARCH>>>',
      '',
      '<<<CONTENT',
      '```ts',
      "      coreWasmPath: path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter-other.wasm'),",
      '```',
      'CONTENT>>>',
      'INSCRIBE>>>',
      '',
      '<<<INSCRIBE',
      'FILE: packages/engine/tests/v2/virtualStructuralExecution.test.ts',
      'MODE: replace_text',
      '',
      '<<<SEARCH',
      '```ts',
      "const CORE_WASM = path.resolve(__dirname, '../../../node_modules/web-tree-sitter/tree-sitter.wasm');",
      '```',
      'SEARCH>>>',
      '',
      '<<<CONTENT',
      '```ts',
      "const CORE_WASM = path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter.wasm');",
      '```',
      'CONTENT>>>',
      'INSCRIBE>>>',
      '',
      'Then from the repo root:',
      '',
      '```bash',
      'npm run test -w packages/engine -- tests/v2/replaceNode.test.ts tests/v2/structuralSelector.test.ts tests/v2/treeSitterOffsets.test.ts tests/v2/treeSitterRuntime.test.ts tests/v2/virtualStructuralExecution.test.ts',
      '',
      'git diff --check',
      'git status --short',
      '```',
      '',
      'If those pass, commit the full six-file Tree-sitter bucket:',
      '',
      '```bash',
      'git add -- \\',
      '  packages/engine/scripts/benchmark-structural.ts \\',
      '  packages/engine/tests/v2/replaceNode.test.ts \\',
      '  packages/engine/tests/v2/structuralSelector.test.ts \\',
      '  packages/engine/tests/v2/treeSitterOffsets.test.ts \\',
      '  packages/engine/tests/v2/treeSitterRuntime.test.ts \\',
      '  packages/engine/tests/v2/virtualStructuralExecution.test.ts',
      '',
      'git commit -m "test(engine): resolve hoisted tree-sitter assets"',
      '',
      'git status --short',
      '```',
    ].join('\n');

    const suggestions = extractCliCommandSuggestions(response);

    expect(suggestions.map((suggestion) => suggestion.command)).toEqual([
      'npm run test -w packages/engine -- tests/v2/replaceNode.test.ts tests/v2/structuralSelector.test.ts tests/v2/treeSitterOffsets.test.ts tests/v2/treeSitterRuntime.test.ts tests/v2/virtualStructuralExecution.test.ts',
      'git diff --check',
      'git status --short',
      'git add -- packages/engine/scripts/benchmark-structural.ts packages/engine/tests/v2/replaceNode.test.ts packages/engine/tests/v2/structuralSelector.test.ts packages/engine/tests/v2/treeSitterOffsets.test.ts packages/engine/tests/v2/treeSitterRuntime.test.ts packages/engine/tests/v2/virtualStructuralExecution.test.ts',
      'git commit -m "test(engine): resolve hoisted tree-sitter assets"',
      'git status --short',
    ]);
  });
});

describe('Terminal suggestion line replacement', () => {
  it('flattens POSIX continuation lines without emitting Enter or newline', () => {
    const replacement = buildTerminalLineReplacement('posix', [
      'git add -- \\',
      '  file-a \\',
      '  file-b',
    ].join('\n'));

    expect(replacement).toBe('\x01\x0bgit add -- file-a file-b');
    expect(replacement).not.toMatch(/[\r\n]/);
  });

  it('flattens PowerShell continuation lines without emitting Enter or newline', () => {
    const replacement = buildTerminalLineReplacement('powershell', [
      'Write-Host `',
      '  "hello"',
    ].join('\n'));

    expect(replacement).toBe('\x1bWrite-Host "hello"');
    expect(replacement).not.toMatch(/[\r\n]/);
  });
});
