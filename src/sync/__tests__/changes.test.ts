import type { VocabularyData, Word } from '@/model/types';

import { canSkipSync, hasChangesToPush } from '../changes';

const word = (patch: Partial<Word> = {}): Word => ({
  id: 'W1',
  listId: 'L1',
  front: 'a',
  back: 'b',
  examples: [],
  addedAt: 'x',
  lastRevisedAt: null,
  remembered: null,
  dirty: false,
  updatedAt: 'x',
  ...patch,
});

const synced = (patch: Partial<VocabularyData> = {}): VocabularyData => ({
  version: 1,
  lists: [{ id: 'L1', name: 'Travel', createdAt: 'x', sheetId: 11 }],
  words: [word()],
  ...patch,
});

describe('hasChangesToPush', () => {
  it('is false when everything is synced', () => {
    expect(hasChangesToPush(synced())).toBe(false);
    expect(hasChangesToPush(synced({ deleted: { wordIds: [], sheetIds: [] } }))).toBe(false);
  });

  it('sees changed words (also review values), new / renamed lists and deletions', () => {
    expect(hasChangesToPush(synced({ words: [word({ dirty: true })] }))).toBe(true);
    expect(hasChangesToPush(synced({ lists: [{ id: 'L1', name: 'T', createdAt: 'x', sheetId: 11, dirty: true }] }))).toBe(true);
    expect(hasChangesToPush(synced({ lists: [{ id: 'L2', name: 'New', createdAt: 'x' }] }))).toBe(true);
    expect(hasChangesToPush(synced({ deleted: { wordIds: ['W9'], sheetIds: [] } }))).toBe(true);
    expect(hasChangesToPush(synced({ deleted: { wordIds: [], sheetIds: [22] } }))).toBe(true);
  });
});

describe('canSkipSync', () => {
  it('skips only when the spreadsheet version is unchanged and nothing is waiting to be sent', () => {
    expect(canSkipSync(synced(), '42', '42')).toBe(true);
    expect(canSkipSync(synced(), '42', '43')).toBe(false);
    expect(canSkipSync(synced(), undefined, '42')).toBe(false);
    expect(canSkipSync(synced({ words: [word({ dirty: true })] }), '42', '42')).toBe(false);
  });
});
