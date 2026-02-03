import type { HistoryEntry } from '@inscribe/shared';
import type { HistoryItem } from '@/types';
import { getLanguageFromFilename } from './language';

export function decorateHistoryEntries(entries: HistoryEntry[]): HistoryItem[] {
  return entries.map((entry) => {
    const file = entry.restoreOperation?.file ?? entry.file;
    const mode = entry.restoreOperation?.type ?? entry.mode;
    const content = entry.restoreOperation?.content ?? '';
    return {
      ...entry,
      restoreMeta: {
        file,
        lineCount: content ? content.split('\n').length : 0,
        language: getLanguageFromFilename(file),
        mode,
      },
    };
  });
}
