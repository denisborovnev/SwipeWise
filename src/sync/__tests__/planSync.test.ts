import type { VocabularyData, Word } from '@/model/types';

import { mergePull } from '../mergePull';
import { parseTab } from '../parseTab';
import { markPushed, planSync } from '../planSync';
import { tabValues } from '../sheetFormat';

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

const tab = (rows: string[][], title = 'Travel - 2026-10-01', sheetId = 11) =>
  parseTab({ sheetId, title, columnCount: 7, rows });

const lists = (...extra: VocabularyData['lists']) => [
  { id: 'L1', name: 'Travel', createdAt: day(1, 0), sheetId: 11 },
  ...extra,
];

let sheetIds = 500;
const newSheetId = () => ++sheetIds;

/** Pull + plan, like a sync does. */
function sync(local: VocabularyData, tabs: ReturnType<typeof tab>[]) {
  let n = 0;
  const pulled = mergePull(local, tabs, NOW, () => `new${++n}`);
  return { pulled, plan: planSync(pulled.data, tabs, pulled.fixes, newSheetId) };
}

describe('planSync', () => {
  beforeEach(() => {
    sheetIds = 500;
  });

  it('writes nothing when everything is in sync', () => {
    const words = [word('W1'), word('W2')];
    const { plan } = sync({ version: 1, lists: lists(), words }, [tab(tabValues(words))]);
    expect(plan.requests).toEqual([]);
    expect(plan.values).toEqual([]);
  });

  it('rewrites changed words where they are, even after the sheet was sorted', () => {
    const sheetOrder = [word('W2'), word('W1')]; // Sorted differently than added.
    const local = {
      version: 1 as const,
      lists: lists(),
      words: [word('W1', { back: 'new', dirty: true, contentDirty: true, updatedAt: day(9) }), word('W2')],
    };
    const { plan } = sync(local, [tab(tabValues([]).concat(sheetOrder.map((w) => tabValues([w])[1])))]);
    expect(plan.requests).toEqual([]);
    // W1 is in row 3 of the sheet (header, W2, W1).
    expect(plan.values).toContainEqual({ range: "'Travel - 2026-10-01'!B3", values: [['new']] });
    expect(plan.values).toContainEqual({ range: "'Travel - 2026-10-01'!G3", values: [['W1']] });
    expect(plan.pushed.words).toEqual([{ id: 'W1', updatedAt: day(9) }]);
  });

  it('appends new words and deletes deleted ones bottom-up', () => {
    const sheet = [word('W1'), word('W2'), word('W3')];
    const local: VocabularyData = {
      version: 1,
      lists: lists(),
      words: [word('W2'), word('W4', { dirty: true, contentDirty: true, addedAt: day(5) })],
      deleted: { wordIds: ['W1', 'W3'], sheetIds: [] },
    };
    const { plan } = sync(local, [tab(tabValues(sheet))]);
    expect(plan.requests).toEqual([
      { deleteDimension: { range: { sheetId: 11, dimension: 'ROWS', startIndex: 3, endIndex: 4 } } },
      { deleteDimension: { range: { sheetId: 11, dimension: 'ROWS', startIndex: 1, endIndex: 2 } } },
      {
        appendCells: {
          sheetId: 11,
          rows: [{ values: expect.arrayContaining([{ userEnteredValue: { stringValue: 'fW4' } }]) }],
          fields: 'userEnteredValue',
        },
      },
    ]);
    expect(plan.pushed).toMatchObject({ deletedWordIds: ['W1', 'W3'], words: [{ id: 'W4' }] });
  });

  it('keeps a row below the frozen header when the last words of a tab are deleted', () => {
    const sheet = [word('W1'), word('W2')];
    const local: VocabularyData = { version: 1, lists: lists(), words: [], deleted: { wordIds: ['W1', 'W2'], sheetIds: [] } };
    const parsed = { ...tab(tabValues(sheet)), rowCount: 3 }; // header + 2 words, nothing more
    const { plan } = sync(local, [parsed]);
    expect(plan.requests).toEqual([
      { appendDimension: { sheetId: 11, dimension: 'ROWS', length: 1 } },
      { deleteDimension: { range: { sheetId: 11, dimension: 'ROWS', startIndex: 2, endIndex: 3 } } },
      { deleteDimension: { range: { sheetId: 11, dimension: 'ROWS', startIndex: 1, endIndex: 2 } } },
    ]);
    // With spare rows nothing is added.
    expect(sync(local, [{ ...parsed, rowCount: 1000 }]).plan.requests[0]).toHaveProperty('deleteDimension');
  });

  it('creates the tab of an empty list with a row below the frozen header', () => {
    const local: VocabularyData = { version: 1, lists: [{ id: 'L9', name: 'Empty', createdAt: day(5, 0) }], words: [] };
    const { plan } = sync(local, []);
    expect(plan.requests).toEqual([
      {
        addSheet: {
          properties: {
            sheetId: 501,
            title: 'Empty - 2026-10-05',
            gridProperties: { rowCount: 2, columnCount: 7, frozenRowCount: 1 },
          },
        },
      },
    ]);
  });

  it('creates tabs for new lists, deletes tabs of deleted lists and renames renamed ones', () => {
    const local: VocabularyData = {
      version: 1,
      lists: [
        { id: 'L1', name: 'Trips', createdAt: day(1, 0), sheetId: 11, dirty: true },
        { id: 'L3', name: 'Animals', createdAt: day(5, 0) },
      ],
      words: [word('W1'), word('W5', { listId: 'L3', dirty: true, contentDirty: true })],
      deleted: { wordIds: [], sheetIds: [22] },
    };
    const { plan } = sync(local, [tab(tabValues([word('W1')])), tab(tabValues([]), 'Food - 2026-10-02', 22)]);
    expect(plan.requests).toEqual([
      { deleteSheet: { sheetId: 22 } },
      { updateSheetProperties: { properties: { sheetId: 11, title: 'Trips - 2026-10-01' }, fields: 'title' } },
      {
        addSheet: {
          properties: {
            sheetId: 501,
            title: 'Animals - 2026-10-05',
            gridProperties: { rowCount: 2, columnCount: 7, frozenRowCount: 1 },
          },
        },
      },
    ]);
    expect(plan.values).toEqual([{ range: "'Animals - 2026-10-05'", values: tabValues([local.words[1]]) }]);
    expect(plan.pushed).toMatchObject({ listSheetIds: { L3: 501 }, renamedListIds: ['L1', 'L3'], deletedSheetIds: [22] });
  });

  it('moves the words of merged lists to the merged list tab', () => {
    // Food (tab 22) was merged into Travel locally: W2 moved, tab 22 is to be deleted.
    const local: VocabularyData = {
      version: 1,
      lists: lists(),
      words: [word('W1'), word('W2', { listId: 'L1', dirty: true, contentDirty: true })],
      deleted: { wordIds: [], sheetIds: [22] },
    };
    const tabs = [tab(tabValues([word('W1')])), tab(tabValues([word('W2', { listId: 'L2' })]), 'Food - 2026-10-02', 22)];
    const { pulled, plan } = sync(local, tabs);
    expect(pulled.data.words.map((w) => [w.id, w.listId])).toEqual([
      ['W1', 'L1'],
      ['W2', 'L1'],
    ]);
    expect(plan.requests[0]).toEqual({ deleteSheet: { sheetId: 22 } });
    expect(plan.requests[1]).toMatchObject({ appendCells: { sheetId: 11 } });
  });

  it('writes the pull fixes at the rows they end up in', () => {
    // No header: the header row is inserted, so the hand-typed row 1 moves to row 2.
    const t = tab([['кот', 'cat']], 'Animals', 33);
    const { plan } = sync({ version: 1, lists: [], words: [] }, [t]);
    expect(plan.requests).toEqual([
      { updateSheetProperties: { properties: { sheetId: 33, title: 'Animals - 2026-10-10' }, fields: 'title' } },
      {
        insertDimension: { range: { sheetId: 33, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, inheritFromBefore: false },
      },
    ]);
    expect(plan.values).toContainEqual({ range: "'Animals - 2026-10-10'!A1", values: [['Front']] });
    // new1 is the new list's id, new2 the word's.
    expect(plan.values).toContainEqual({ range: "'Animals - 2026-10-10'!G2", values: [['new2']] });
  });
});

describe('markPushed', () => {
  it('clears the marks of what was written, but not of changes made meanwhile', () => {
    const data: VocabularyData = {
      version: 1,
      lists: [
        { id: 'L1', name: 'Trips', createdAt: day(1), sheetId: 11, dirty: true },
        { id: 'L3', name: 'Animals', createdAt: day(5) },
      ],
      words: [
        word('W1', { dirty: true, contentDirty: true, updatedAt: 'v1' }),
        word('W2', { dirty: true, updatedAt: 'v3' }),
      ],
      deleted: { wordIds: ['W9'], sheetIds: [22] },
    };
    const result = markPushed(data, {
      listSheetIds: { L3: 501 },
      renamedListIds: ['L1', 'L3'],
      words: [
        { id: 'W1', updatedAt: 'v1' },
        { id: 'W2', updatedAt: 'v2' },
      ],
      deletedWordIds: ['W9'],
      deletedSheetIds: [22],
    });
    expect(result.lists).toEqual([
      { id: 'L1', name: 'Trips', createdAt: day(1), sheetId: 11, dirty: false },
      { id: 'L3', name: 'Animals', createdAt: day(5), sheetId: 501, dirty: false },
    ]);
    expect(result.words.map((w) => [w.id, w.dirty])).toEqual([
      ['W1', false],
      ['W2', true],
    ]);
    expect(result.deleted).toBeUndefined();
  });
});
