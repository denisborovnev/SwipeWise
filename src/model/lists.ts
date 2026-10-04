import type { Word, WordList } from './types';

export type ListSort = 'newest' | 'oldest' | 'name';

export interface ListWithCount extends WordList {
  wordCount: number;
}

export function withWordCounts(lists: WordList[], words: Word[]): ListWithCount[] {
  const counts = new Map<string, number>();
  for (const w of words) {
    counts.set(w.listId, (counts.get(w.listId) ?? 0) + 1);
  }
  return lists.map((list) => ({ ...list, wordCount: counts.get(list.id) ?? 0 }));
}

export function sortLists<T extends WordList>(lists: readonly T[], sort: ListSort): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const compare: Record<ListSort, (a: T, b: T) => number> = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt) || byName(a, b),
    oldest: (a, b) => a.createdAt.localeCompare(b.createdAt) || byName(a, b),
    name: byName,
  };
  return [...lists].sort(compare[sort]);
}

/** Case-insensitive search in list names. */
export function searchLists<T extends WordList>(lists: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  return q ? lists.filter((l) => l.name.toLowerCase().includes(q)) : [...lists];
}

export interface MonthGroup<T> {
  /** Any date in that month (ISO), for formatting the heading. */
  month: string;
  data: T[];
}

/** Groups already sorted lists by the local month they were created in, keeping the order. */
export function groupByMonth<T extends WordList>(lists: readonly T[]): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  let lastKey = '';
  for (const list of lists) {
    const d = new Date(list.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key !== lastKey) {
      groups.push({ month: list.createdAt, data: [] });
      lastKey = key;
    }
    groups[groups.length - 1].data.push(list);
  }
  return groups;
}

/** `base`, or `base (2)`, `base (3)`… if a list with that name exists (case-insensitive). */
export function uniqueListName(base: string, lists: Pick<WordList, 'name'>[]): string {
  const taken = new Set(lists.map((l) => l.name.toLowerCase()));
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n++) {
    name = `${base} (${n})`;
  }
  return name;
}
