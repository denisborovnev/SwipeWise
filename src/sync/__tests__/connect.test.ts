import type { Course, VocabularyData } from '@/model/types';
import { markUploaded } from '@/model/vocabulary';

import { connectCourse } from '../connect';
import type { GoogleApi } from '../googleApi';
import { INFO_TAB } from '../sheetFormat';

const course: Course = { id: 'C1', name: 'English', language: 'en-GB', createdAt: '2026-10-01T10:00:00.000Z' };

const data: VocabularyData = {
  version: 1,
  lists: [
    { id: 'L2', name: 'Food', createdAt: new Date(2026, 9, 3).toISOString() },
    { id: 'L1', name: 'Travel', createdAt: new Date(2026, 9, 1).toISOString() },
  ],
  words: [
    {
      id: 'W1',
      listId: 'L1',
      front: 'машина',
      back: 'car',
      examples: [],
      addedAt: new Date(2026, 9, 1, 9).toISOString(),
      lastRevisedAt: null,
      remembered: null,
      dirty: true,
      updatedAt: 'v1',
    },
  ],
};

function fakeApi(existing: { id: string; name: string; courseId?: string }[] = []) {
  const calls: { method: string; args: unknown[] }[] = [];
  const api: GoogleApi = {
    listAppSpreadsheets: async () => existing,
    createSpreadsheet: async (title, tabs) => {
      calls.push({ method: 'createSpreadsheet', args: [title, tabs] });
      return { spreadsheetId: 'S1', tabs: tabs.map((t, i) => ({ title: t.title, sheetId: 100 + i })) };
    },
    writeValues: async (...args) => {
      calls.push({ method: 'writeValues', args });
    },
    setAppProperties: async (...args) => {
      calls.push({ method: 'setAppProperties', args });
    },
    renameFile: async () => {},
    getFileVersion: async () => '1',
    getTabs: async () => [],
    readValues: async () => [],
    batchUpdate: async () => {},
  };
  return { api, calls };
}

describe('connectCourse', () => {
  it('creates a spreadsheet with an info tab and a tab per list, oldest list first', async () => {
    const { api, calls } = fakeApi();
    const result = await connectCourse(api, course, data);

    const [title, tabs] = calls[0].args as [string, { title: string; rowCount: number }[]];
    expect(title).toBe('SwipeWise – English');
    expect(tabs.map((t) => [t.title, t.rowCount])).toEqual([
      [INFO_TAB, 4],
      ['Travel - 2026-10-01', 2],
      ['Food - 2026-10-03', 1],
    ]);

    const [, values] = calls[1].args as [string, { range: string; values: string[][] }[]];
    expect(values.map((v) => v.range)).toEqual([`'${INFO_TAB}'`, "'Travel - 2026-10-01'", "'Food - 2026-10-03'"]);
    expect(values[1].values[1][0]).toBe('машина');

    expect(calls[2]).toEqual({
      method: 'setAppProperties',
      args: ['S1', { swipewise: '1', courseId: 'C1', language: 'en-GB' }],
    });
    expect(result).toEqual({
      spreadsheetId: 'S1',
      created: true,
      listSheetIds: { L1: 101, L2: 102 },
      uploaded: [{ id: 'W1', updatedAt: 'v1' }],
    });
  });

  it('reconnects to the spreadsheet created for the course earlier', async () => {
    const { api, calls } = fakeApi([
      { id: 'OTHER', name: 'SwipeWise – Spanish', courseId: 'C2' },
      { id: 'OLD', name: 'SwipeWise – English', courseId: 'C1' },
    ]);
    expect(await connectCourse(api, course, data)).toMatchObject({ spreadsheetId: 'OLD', created: false });
    expect(calls).toEqual([]);
  });

  it('marks uploaded words as synced unless they changed meanwhile', async () => {
    const { api } = fakeApi();
    const result = await connectCourse(api, course, data);
    const changed = { ...data, words: [{ ...data.words[0], updatedAt: 'v2' }] };
    expect(markUploaded(data, result.listSheetIds, result.uploaded).words[0].dirty).toBe(false);
    expect(markUploaded(changed, result.listSheetIds, result.uploaded).words[0].dirty).toBe(true);
    expect(markUploaded(data, result.listSheetIds, result.uploaded).lists.map((l) => l.sheetId)).toEqual([102, 101]);
  });
});
