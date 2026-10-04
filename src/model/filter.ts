import type { DateFilter, SessionFilter, Word } from './types';

/** Start of the local day `days` days before `now` (days = 0 → start of today), as ISO. */
export function resolveDateFilter(filter: DateFilter, now: Date): string {
  if ('date' in filter) {
    const d = new Date(filter.date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - filter.days);
  return d.toISOString();
}

export function matchesFilter(word: Word, filter: SessionFilter, now: Date): boolean {
  if (filter.listIds.length > 0 && !filter.listIds.includes(word.listId)) {
    return false;
  }
  if (filter.addedSince && word.addedAt < resolveDateFilter(filter.addedSince, now)) {
    return false;
  }
  if (
    filter.notRevisedSince &&
    word.lastRevisedAt !== null &&
    word.lastRevisedAt >= resolveDateFilter(filter.notRevisedSince, now)
  ) {
    return false;
  }
  if (filter.onlyNotRemembered && word.remembered !== 'no') {
    return false;
  }
  return true;
}

/** A filter as saved by earlier versions (one list, and a shuffle flag). */
type LegacyFilter = Omit<SessionFilter, 'listIds'> & { listIds?: string[]; listId?: string; shuffle?: boolean };

/** Converts a saved filter of any version to the current shape. */
export function normalizeFilter(saved: LegacyFilter): SessionFilter {
  const { listId, shuffle: _shuffle, listIds, ...rest } = saved;
  return { ...rest, listIds: listIds ?? (listId && listId !== 'all' ? [listId] : []) };
}

/** Fisher–Yates shuffle; `random` returns a number in [0, 1). */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Ids of the words matching the filter, oldest first (sessions shuffle them). */
export function selectWords(words: readonly Word[], filter: SessionFilter, now: Date): string[] {
  return words
    .filter((w) => matchesFilter(w, filter, now))
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt))
    .map((w) => w.id);
}
