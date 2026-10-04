import { describeFilter } from '../describeFilter';

const lists = [{ id: 'L1', name: 'Travel', createdAt: 'x' }];

describe('describeFilter', () => {
  it('names the list or "All words"', () => {
    expect(describeFilter({ listId: 'all' }, lists)).toBe('All words');
    expect(describeFilter({ listId: 'L1' }, lists)).toBe('Travel');
    expect(describeFilter({ listId: 'gone' }, lists)).toBe('Deleted list');
  });

  it('lists every active condition', () => {
    expect(
      describeFilter(
        { listId: 'L1', addedSince: { days: 7 }, notRevisedSince: { days: 0 }, onlyNotRemembered: true },
        lists,
      ),
    ).toBe("Travel · added since 7 days ago · not revised today · don't remember");
    expect(describeFilter({ listId: 'all', notRevisedSince: { days: 3 } }, lists)).toBe(
      'All words · not revised since 3 days ago',
    );
  });
});
