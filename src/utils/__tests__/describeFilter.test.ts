import { describeFilter } from '../describeFilter';

const lists = [{ id: 'L1', name: 'Travel', createdAt: 'x' }];

describe('describeFilter', () => {
  it('names the list or "All words"', () => {
    expect(describeFilter({ listId: 'all', shuffle: true }, lists)).toBe('All words');
    expect(describeFilter({ listId: 'L1', shuffle: true }, lists)).toBe('Travel');
    expect(describeFilter({ listId: 'gone', shuffle: true }, lists)).toBe('Deleted list');
  });

  it('lists every active condition', () => {
    expect(
      describeFilter(
        { listId: 'L1', addedSince: { days: 7 }, notRevisedSince: { days: 0 }, onlyNotRemembered: true, shuffle: true },
        lists,
      ),
    ).toBe("Travel · added since 7 days ago · not revised today · don't remember");
    expect(describeFilter({ listId: 'all', notRevisedSince: { days: 3 }, shuffle: false }, lists)).toBe(
      'All words · not revised since 3 days ago',
    );
  });
});
