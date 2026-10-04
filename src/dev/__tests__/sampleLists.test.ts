import { validateListName, validateWord } from '@/model/validation';

import { createSampleLists } from '../sampleLists';

let n = 0;
const newId = () => `id${++n}`;
const NOW = new Date(2026, 9, 4, 12);

describe('createSampleLists', () => {
  const { lists, words } = createSampleLists(newId, NOW, []);

  it('creates 10 valid lists with valid words', () => {
    expect(lists).toHaveLength(10);
    lists.forEach((l, i) => expect(validateListName(l.name, lists.slice(0, i))).toBeNull());
    words.forEach((w) => expect(validateWord(w)).toBeNull());
    lists.forEach((l) => expect(words.some((w) => w.listId === l.id)).toBe(true));
  });

  it('spreads creation dates over the past months', () => {
    const dates = lists.map((l) => l.createdAt);
    expect(new Set(dates).size).toBe(10);
    expect(dates.every((d) => d < NOW.toISOString())).toBe(true);
  });

  it('skips lists whose names already exist', () => {
    const again = createSampleLists(newId, NOW, ['travel', 'Food']);
    expect(again.lists).toHaveLength(8);
    expect(again.lists.map((l) => l.name)).not.toContain('Travel');
  });
});
