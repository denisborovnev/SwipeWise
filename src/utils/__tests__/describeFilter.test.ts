import { describeFilter } from '../describeFilter';

const lists = ['Travel', 'Food', 'Verbs', 'Animals'].map((name, i) => ({ id: `L${i + 1}`, name, createdAt: 'x' }));

describe('describeFilter', () => {
  it('names the lists or "All words"', () => {
    expect(describeFilter({ listIds: [] }, lists)).toBe('All words');
    expect(describeFilter({ listIds: ['L1'] }, lists)).toBe('Travel');
    expect(describeFilter({ listIds: ['L1', 'L2'] }, lists)).toBe('Food, Travel');
    expect(describeFilter({ listIds: ['L1', 'L2', 'L3', 'L4'] }, lists)).toBe('Animals, Food +2 more');
    expect(describeFilter({ listIds: ['gone'] }, lists)).toBe('Deleted list');
    expect(describeFilter({ listIds: ['gone', 'L3'] }, lists)).toBe('Verbs');
  });

  it('lists every active condition', () => {
    expect(
      describeFilter(
        { listIds: ['L1'], addedSince: { days: 7 }, notRevisedSince: { days: 0 }, onlyNotRemembered: true },
        lists,
      ),
    ).toBe("Travel · added since 7 days ago · not revised today · don't remember");
    expect(describeFilter({ listIds: [], notRevisedSince: { days: 3 } }, lists)).toBe(
      'All words · not revised since 3 days ago',
    );
  });
});
