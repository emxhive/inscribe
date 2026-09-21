import { describe, expect, it } from 'vitest';
import { extractCliCommandSuggestions } from '@inscribe/shared';

describe('CLI command suggestion extraction', () => {
  it('extracts shell commands from fenced blocks outside Inscribe blocks', () => {
    const suggestions = extractCliCommandSuggestions([
      'Before',
      '```bash',
      'npm install',
      'npm run dev',
      '```',
      '$inscribe BEGIN',
      'FILE: package.json',
      'MODE: replace',
      '```json',
      '{"scripts":{"dev":"vite"}}',
      '```',
      '$inscribe END',
    ].join('\n'));

    expect(suggestions.map((suggestion) => suggestion.command)).toEqual([
      'npm install',
      'npm run dev',
    ]);
  });

  it('keeps continued shell commands together', () => {
    const suggestions = extractCliCommandSuggestions([
      '```sh',
      'docker run \\',
      '  -p 3000:3000 \\',
      '  app:latest',
      '```',
    ].join('\n'));

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].command).toBe('docker run \\\n  -p 3000:3000 \\\n  app:latest');
  });

  it('classifies destructive commands', () => {
    const suggestions = extractCliCommandSuggestions([
      '```powershell',
      'Remove-Item -Recurse -Force dist',
      '```',
    ].join('\n'));

    expect(suggestions[0].risk).toBe('destructive');
  });
});
