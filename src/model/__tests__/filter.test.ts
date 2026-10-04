import { matchesFilter, normalizeFilter, resolveDateFilter, selectWords, shuffle } from '../filter';
import type { SessionFilter, Word } from '../types';

const NOW = new Date(2026, 9, 10, 15, 30); // 10 Oct 2026, 15:30 local time
const local = (day: number, hour = 12) => new Date(2026, 9, day, hour).toISOString();

function word(id: string, patch: Partial<Word> = {}): Word {
  return {
    id,
    listId: 'L1',
    front: id,
    back: id,
    examples: [],
    addedAt: local(1),
    lastRevisedAt: null,
    remembered: null,
    dirty: false,
    updatedAt: local(1),
    ...patch,
  };
}

const all: SessionFilter = { listIds: [] };

describe('resolveDateFilter', () => {
  it('days: 0 means the start of today', () => {
    expect(resolveDateFilter({ days: 0 }, NOW)).toBe(new Date(2026, 9, 10).toISOString());
  });

  it('counts days back from the start of today', () => {
    expect(resolveDateFilter({ days: 7 }, NOW)).toBe(new Date(2026, 9, 3).toISOString());
  });

  it('uses the start of the day of a fixed date', () => {
    expect(resolveDateFilter({ date: local(5, 18) }, NOW)).toBe(new Date(2026, 9, 5).toISOString());
  });
});

describe('matchesFilter', () => {
  it('filters by one or several lists', () => {
    expect(matchesFilter(word('a'), all, NOW)).toBe(true);
    expect(matchesFilter(word('a'), { listIds: ['L1'] }, NOW)).toBe(true);
    expect(matchesFilter(word('a'), { listIds: ['L2'] }, NOW)).toBe(false);
    expect(matchesFilter(word('a'), { listIds: ['L2', 'L1'] }, NOW)).toBe(true);
    expect(matchesFilter(word('a', { listId: 'L3' }), { listIds: ['L1', 'L2'] }, NOW)).toBe(false);
  });

  it('filters by added since, also within a single list', () => {
    const filter: SessionFilter = { listIds: ['L1'], addedSince: { days: 3 } }; // since 7 Oct
    expect(matchesFilter(word('a', { addedAt: local(7, 0) }), filter, NOW)).toBe(true);
    expect(matchesFilter(word('a', { addedAt: local(6, 23) }), filter, NOW)).toBe(false);
  });

  it('filters by not revised since, always including never-revised words', () => {
    const filter: SessionFilter = { ...all, notRevisedSince: { days: 0 } };
    expect(matchesFilter(word('a'), filter, NOW)).toBe(true);
    expect(matchesFilter(word('a', { lastRevisedAt: local(9) }), filter, NOW)).toBe(true);
    expect(matchesFilter(word('a', { lastRevisedAt: local(10, 9) }), filter, NOW)).toBe(false);
  });

  it('filters by the last answer only', () => {
    const filter: SessionFilter = { ...all, onlyNotRemembered: true };
    expect(matchesFilter(word('a', { remembered: 'no' }), filter, NOW)).toBe(true);
    expect(matchesFilter(word('a', { remembered: 'yes' }), filter, NOW)).toBe(false);
    expect(matchesFilter(word('a'), filter, NOW)).toBe(false);
  });

  it('combines all conditions', () => {
    const filter: SessionFilter = {
      listIds: ['L1'],
      addedSince: { days: 7 },
      notRevisedSince: { days: 0 },
      onlyNotRemembered: true,
    };
    const ok = word('a', { addedAt: local(5), lastRevisedAt: local(8), remembered: 'no' });
    expect(matchesFilter(ok, filter, NOW)).toBe(true);
    expect(matchesFilter({ ...ok, listId: 'L2' }, filter, NOW)).toBe(false);
    expect(matchesFilter({ ...ok, addedAt: local(1) }, filter, NOW)).toBe(false);
    expect(matchesFilter({ ...ok, lastRevisedAt: local(10, 8) }, filter, NOW)).toBe(false);
    expect(matchesFilter({ ...ok, remembered: 'yes' }, filter, NOW)).toBe(false);
  });
});

describe('selectWords', () => {
  const words = [word('c', { addedAt: local(3) }), word('a', { addedAt: local(1) }), word('b', { addedAt: local(2) })];

  it('returns words oldest first', () => {
    expect(selectWords(words, all, NOW)).toEqual(['a', 'b', 'c']);
  });
});

describe('normalizeFilter', () => {
  it('converts filters saved by earlier versions', () => {
    expect(normalizeFilter({ listId: 'all', shuffle: true } as never)).toEqual({ listIds: [] });
    expect(normalizeFilter({ listId: 'L1', onlyNotRemembered: true } as never)).toEqual({
      listIds: ['L1'],
      onlyNotRemembered: true,
    });
  });

  it('keeps current filters as they are', () => {
    expect(normalizeFilter({ listIds: ['L1', 'L2'], addedSince: { days: 7 } })).toEqual({
      listIds: ['L1', 'L2'],
      addedSince: { days: 7 },
    });
  });
});

describe('shuffle', () => {
  it('uses the given random source', () => {
    expect(shuffle(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a']);
  });

  it('keeps all items and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input, Math.random);
    expect([...result].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});
