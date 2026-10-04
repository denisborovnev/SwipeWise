import { groupByMonth, searchLists, sortLists, withWordCounts } from '../lists';
import type { Word, WordList } from '../types';

const local = (month: number, day: number) => new Date(2026, month - 1, day, 12).toISOString();
const list = (id: string, name: string, createdAt: string): WordList => ({ id, name, createdAt });

const lists = [
  list('a', 'Travel', local(8, 15)),
  list('b', 'animals', local(10, 3)),
  list('c', 'Food', local(10, 1)),
  list('d', 'Kitchen', local(8, 2)),
];

describe('lists', () => {
  it('sorts newest first, oldest first or by name', () => {
    expect(sortLists(lists, 'newest').map((l) => l.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(sortLists(lists, 'oldest').map((l) => l.id)).toEqual(['d', 'a', 'c', 'b']);
    expect(sortLists(lists, 'name').map((l) => l.name)).toEqual(['animals', 'Food', 'Kitchen', 'Travel']);
  });

  it('sorts lists created at the same time by name', () => {
    const same = [list('x', 'B', local(1, 1)), list('y', 'A', local(1, 1))];
    expect(sortLists(same, 'newest').map((l) => l.name)).toEqual(['A', 'B']);
  });

  it('searches names case-insensitively', () => {
    expect(searchLists(lists, ' AN ').map((l) => l.id)).toEqual(['b']);
    expect(searchLists(lists, '')).toHaveLength(4);
  });

  it('groups sorted lists by month', () => {
    const groups = groupByMonth(sortLists(lists, 'newest'));
    expect(groups.map((g) => g.data.map((l) => l.id))).toEqual([
      ['b', 'c'],
      ['a', 'd'],
    ]);
    expect(new Date(groups[1].month).getMonth()).toBe(7); // August
  });

  it('counts words per list', () => {
    const words = [{ listId: 'a' }, { listId: 'a' }, { listId: 'c' }] as Word[];
    expect(withWordCounts(lists, words).map((l) => l.wordCount)).toEqual([2, 0, 1, 0]);
  });
});
