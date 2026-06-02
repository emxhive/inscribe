import { describe, expect, it } from 'vitest';
import { extractCliCommandSuggestions } from '@inscribe/shared';

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
});
