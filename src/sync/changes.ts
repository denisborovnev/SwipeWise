import type { VocabularyData } from '@/model/types';

/**
 * Anything on the phone that the spreadsheet doesn't have yet: changed words (text or review values),
 * renamed or new lists, deleted words / lists.
 */
export function hasChangesToPush(data: VocabularyData): boolean {
  return (
    (data.deleted?.wordIds.length ?? 0) > 0 ||
    (data.deleted?.sheetIds.length ?? 0) > 0 ||
    data.lists.some((l) => l.dirty || l.sheetId === undefined) ||
    data.words.some((w) => w.dirty)
  );
}

/**
 * A sync can be skipped when the spreadsheet hasn't changed since the last sync (same Drive file
 * version) and the phone has nothing to send.
 */
export function canSkipSync(data: VocabularyData, lastVersion: string | undefined, currentVersion: string): boolean {
  return lastVersion !== undefined && lastVersion === currentVersion && !hasChangesToPush(data);
}
