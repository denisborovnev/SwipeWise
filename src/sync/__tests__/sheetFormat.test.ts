import type { Word } from '@/model/types';
import { formatDate } from '@/utils/format';

import { COLUMNS, parseTabTitle, sheetDateTime, tabRange, tabTitle, tabValues } from '../sheetFormat';

const local = (month: number, day: number, hour = 12, minute = 0) =>
  new Date(2026, month - 1, day, hour, minute).toISOString();

const word = (id: string, patch: Partial<Word> = {}): Word => ({
  id,
  listId: 'L',
  front: `front ${id}`,
  back: `back ${id}`,
  examples: [],
  addedAt: local(10, 1),
  lastRevisedAt: null,
  remembered: null,
  dirty: true,
  updatedAt: local(10, 1),
  ...patch,
});

describe('sheetFormat', () => {
  it('names tabs "<name> - YYYY-MM-DD", or just the date for a list named after its date', () => {
    expect(tabTitle({ name: 'Travel', createdAt: local(10, 4, 9) })).toBe('Travel - 2026-10-04');
    const created = local(10, 5);
    expect(tabTitle({ name: formatDate(created), createdAt: created })).toBe('2026-10-05');
  });

  it('parses tab titles back into name and date', () => {
    expect(parseTabTitle('Travel - 2026-10-04')).toEqual({ name: 'Travel', createdAt: local(10, 4, 0) });
    expect(parseTabTitle('Verbs - part 2 - 2026-09-15')).toEqual({ name: 'Verbs - part 2', createdAt: local(9, 15, 0) });
    expect(parseTabTitle('2026-10-05')).toEqual({ name: formatDate(local(10, 5, 0)), createdAt: local(10, 5, 0) });
    expect(parseTabTitle(' My words ')).toEqual({ name: 'My words', createdAt: null });
    expect(parseTabTitle('Bad date - 2026-02-31')).toEqual({ name: 'Bad date - 2026-02-31', createdAt: null });
  });

  it('round-trips tab titles', () => {
    const list = { name: 'Kitchen', createdAt: local(3, 7, 0) };
    expect(parseTabTitle(tabTitle(list))).toEqual(list);
  });

  it('writes a header and one row per word, oldest first', () => {
    const values = tabValues([
      word('B', { addedAt: local(10, 2, 8, 5), examples: ['one', 'two'], lastRevisedAt: local(10, 3, 20, 15), remembered: 'no' }),
      word('A'),
    ]);
    expect(values[0]).toEqual([...COLUMNS]);
    expect(values[1]).toEqual(['front A', 'back A', '', '2026-10-01 12:00', '', '', 'A']);
    expect(values[2]).toEqual(['front B', 'back B', 'one\ntwo', '2026-10-02 08:05', '2026-10-03 20:15', 'no', 'B']);
  });

  it('formats dates and quotes ranges', () => {
    expect(sheetDateTime(null)).toBe('');
    expect(tabRange("Tom's words - 2026-10-04")).toBe("'Tom''s words - 2026-10-04'");
  });
});
