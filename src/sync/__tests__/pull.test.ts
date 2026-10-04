import type { VocabularyData, Word } from '@/model/types';

import { mergePull } from '../mergePull';
import { parseSheetDate, parseTab } from '../parseTab';
import { columnLetter } from '../pull';
import { COLUMNS, tabValues } from '../sheetFormat';

const NOW = new Date(2026, 9, 10, 12).toISOString();
const day = (d: number, h = 12) => new Date(2026, 9, d, h).toISOString();

const word = (id: string, patch: Partial<Word> = {}): Word => ({
  id,
  listId: 'L1',
  front: `f${id}`,
  back: `b${id}`,
  examples: [],
  addedAt: day(1),
  lastRevisedAt: null,
  remembered: null,
  dirty: false,
  updatedAt: day(1),
  ...patch,
});

const synced = (words: Word[]): VocabularyData => ({
  version: 1,
  lists: [{ id: 'L1', name: 'Travel', createdAt: day(1, 0), sheetId: 11 }],
  words,
});

const tab = (rows: string[][], title = 'Travel - 2026-10-01', sheetId = 11) =>
  parseTab({ sheetId, title, columnCount: 7, rows });

let n = 0;
const newId = () => `new${++n}`;
beforeEach(() => {
  n = 0;
});

describe('parseTab', () => {
  it('maps columns by header name, in any order', () => {
    const t = tab([
      ['Back', 'Id', 'Front', 'Remembered', 'Examples'],
      ['car', 'W1', 'машина', 'YES', 'one\n two '],
    ]);
    expect(t.hasHeader).toBe(true);
    expect(t.missingColumns).toEqual(['Added', 'LastRevised']);
    expect(t.columns).toMatchObject({ Back: 0, Id: 1, Front: 2, Added: 5, LastRevised: 6 });
    expect(t.words[0]).toMatchObject({ id: 'W1', front: 'машина', back: 'car', remembered: 'yes', examples: ['one', 'two'] });
  });

  it('reads a tab without header as Front / Back / Examples and skips empty or incomplete rows', () => {
    const t = tab([['кот', 'cat'], [], ['собака'], ['дом', 'house', 'My house.']], 'Animals');
    expect(t.hasHeader).toBe(false);
    expect(t.missingColumns).toEqual([...COLUMNS]);
    expect(t.words.map((w) => [w.row, w.front, w.back, w.id])).toEqual([
      [0, 'кот', 'cat', null],
      [3, 'дом', 'house', null],
    ]);
    expect(t.incompleteRows).toBe(1);
    expect(t).toMatchObject({ name: 'Animals', createdAt: null });
  });

  it('parses sheet dates', () => {
    expect(parseSheetDate('2026-10-04 20:15')).toBe(new Date(2026, 9, 4, 20, 15).toISOString());
    expect(parseSheetDate('2026-10-04')).toBe(new Date(2026, 9, 4).toISOString());
    expect(parseSheetDate('')).toBeNull();
    expect(parseSheetDate('2026-02-31')).toBeNull();
    expect(parseSheetDate('soon')).toBeNull();
  });
});

describe('mergePull', () => {
  it('adds rows typed by hand and asks to write their Id and Added date', () => {
    const local = synced([word('W1')]);
    const rows = [...tabValues([word('W1')]), ['кот', 'cat']];
    const { data, fixes, stats } = mergePull(local, [tab(rows)], NOW, newId);

    expect(data.words.map((w) => w.id)).toEqual(['W1', 'new1']);
    expect(data.words[1]).toMatchObject({ front: 'кот', back: 'cat', addedAt: NOW, dirty: false, listId: 'L1' });
    expect(stats.addedWords).toBe(1);
    expect(fixes).toHaveLength(1);
    expect(fixes[0].cells).toEqual([
      { row: 2, column: 'Id', value: 'new1' },
      { row: 2, column: 'Added', value: '2026-10-10 12:00' },
    ]);
  });

  it('does not add a hand-typed row twice when its Id could not be written', () => {
    const rows = [...tabValues([]), ['кот', 'cat']];
    const first = mergePull(synced([]), [tab(rows)], NOW, newId);
    const second = mergePull(first.data, [tab(rows)], NOW, newId);
    expect(second.data.words.map((w) => w.id)).toEqual(['new1']);
    expect(second.fixes[0].cells[0]).toEqual({ row: 1, column: 'Id', value: 'new1' });
  });

  it('takes text from the sheet unless edited locally, and the newer review values', () => {
    const local = synced([
      word('W1', { lastRevisedAt: day(5), remembered: 'yes' }),
      word('W2', { back: 'local edit', contentDirty: true, dirty: true, lastRevisedAt: day(5), remembered: 'yes' }),
    ]);
    const sheetWords = [
      word('W1', { back: 'sheet edit', lastRevisedAt: day(3), remembered: 'no' }),
      word('W2', { back: 'sheet edit', lastRevisedAt: day(7), remembered: 'no' }),
    ];
    const { data, stats } = mergePull(local, [tab(tabValues(sheetWords))], NOW, newId);
    expect(data.words[0]).toMatchObject({ back: 'sheet edit', remembered: 'yes', lastRevisedAt: day(5) });
    expect(data.words[1]).toMatchObject({ back: 'local edit', remembered: 'no', lastRevisedAt: day(7, 12) });
    expect(stats.updatedWords).toBe(2);
  });

  it('removes words deleted in the sheet but keeps new local words', () => {
    const local = synced([word('W1'), word('W2'), word('W3', { dirty: true, contentDirty: true })]);
    const { data, stats } = mergePull(local, [tab(tabValues([word('W1')]))], NOW, newId);
    expect(data.words.map((w) => w.id)).toEqual(['W1', 'W3']);
    expect(stats.removedWords).toBe(1);
  });

  it('does not bring back words and tabs deleted locally', () => {
    const local: VocabularyData = { ...synced([]), deleted: { wordIds: ['W1'], sheetIds: [22] } };
    const tabs = [tab(tabValues([word('W1')])), tab(tabValues([word('W9')]), 'Old - 2026-09-01', 22)];
    const { data } = mergePull(local, tabs, NOW, newId);
    expect(data.lists.map((l) => l.id)).toEqual(['L1']);
    expect(data.words).toEqual([]);
  });

  it('turns new tabs into lists and adds the date to tabs named by hand', () => {
    const tabs = [tab(tabValues([word('W1')])), tab([['кот', 'cat']], 'Animals', 33)];
    const { data, fixes } = mergePull(synced([word('W1')]), tabs, NOW, newId);
    expect(data.lists.map((l) => [l.name, l.sheetId, l.createdAt])).toEqual([
      ['Travel', 11, day(1, 0)],
      ['Animals', 33, NOW],
    ]);
    expect(fixes[0]).toMatchObject({ sheetId: 33, newTitle: 'Animals - 2026-10-10', insertHeader: true });
    // Without a header the row moves down by one when the header row is inserted.
    expect(fixes[0].cells[0]).toEqual({ row: 1, column: 'Id', value: 'new2' });
  });

  it('follows tabs renamed and lists deleted in the sheet, but keeps local renames', () => {
    const local: VocabularyData = {
      version: 1,
      lists: [
        { id: 'L1', name: 'Travel', createdAt: day(1, 0), sheetId: 11 },
        { id: 'L2', name: 'Food', createdAt: day(2, 0), sheetId: 22 },
        { id: 'L3', name: 'Mine', createdAt: day(3, 0), sheetId: 33, dirty: true },
      ],
      words: [word('W2', { listId: 'L2' })],
    };
    const tabs = [tab(tabValues([]), 'Trips - 2026-10-01'), tab(tabValues([]), 'Theirs - 2026-10-03', 33)];
    const { data, stats, fixes } = mergePull(local, tabs, NOW, newId);
    expect(data.lists.map((l) => l.name)).toEqual(['Trips', 'Mine']);
    expect(data.words).toEqual([]);
    expect(stats).toMatchObject({ removedLists: 1, removedWords: 1 });
    expect(fixes).toEqual([]);
  });
});

describe('columnLetter', () => {
  it('names columns', () => {
    expect([0, 6, 25, 26, 27].map(columnLetter)).toEqual(['A', 'G', 'Z', 'AA', 'AB']);
  });
});
