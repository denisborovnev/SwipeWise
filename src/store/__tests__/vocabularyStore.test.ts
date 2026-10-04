import { createMemoryBackend } from '@/storage/backend';
import { createRepository, FILES } from '@/storage/repository';

import { createVocabularyStore } from '../vocabularyStore';

function setup(options: { seedDemo?: boolean; files?: Record<string, string> } = {}) {
  const backend = createMemoryBackend(options.files);
  let n = 0;
  const store = createVocabularyStore({
    repository: createRepository(backend),
    newId: () => `id${++n}`,
    now: () => '2026-10-04T10:00:00.000Z',
    seedDemo: options.seedDemo ?? false,
  });
  const saved = () => JSON.parse(backend.files[FILES.vocabulary]);
  return { backend, store, saved };
}

describe('vocabularyStore', () => {
  it('seeds a demo list on first launch and saves it', async () => {
    const { store, saved } = setup({ seedDemo: true });
    await store.getState().load();
    const { status, data } = store.getState();
    expect(status).toBe('ready');
    expect(data.lists).toHaveLength(1);
    expect(data.words.length).toBeGreaterThan(0);
    expect(saved()).toEqual(data);
  });

  it('loads existing data instead of seeding', async () => {
    const existing = { version: 1, lists: [{ id: 'L', name: 'Mine', createdAt: 'x' }], words: [] };
    const { store } = setup({ seedDemo: true, files: { [FILES.vocabulary]: JSON.stringify(existing) } });
    await store.getState().load();
    expect(store.getState().data).toEqual(existing);
  });

  it('persists changes after flush', async () => {
    const { store, saved } = setup();
    await store.getState().load();
    const listId = store.getState().addList('Travel');
    const wordId = store.getState().addWord(listId, { front: 'машина', back: 'car' });
    store.getState().recordAnswer(wordId, 'yes');
    await store.getState().flush();

    expect(saved().lists).toEqual([expect.objectContaining({ id: listId, name: 'Travel' })]);
    expect(saved().words).toEqual([
      expect.objectContaining({ id: wordId, front: 'машина', remembered: 'yes' }),
    ]);
  });

  it('writes to disk only after the debounce delay', async () => {
    jest.useFakeTimers();
    try {
      const { store, backend } = setup();
      await store.getState().load();
      const before = backend.files[FILES.vocabulary];
      store.getState().addList('Travel');
      expect(backend.files[FILES.vocabulary]).toBe(before);
      await jest.advanceTimersByTimeAsync(1000);
      expect(JSON.parse(backend.files[FILES.vocabulary]).lists).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('imports lists and words, skipping ids that already exist', async () => {
    const { store, saved } = setup();
    await store.getState().load();
    const list = { id: 'L', name: 'Sample', createdAt: '2026-05-01T00:00:00.000Z' };
    const word = {
      id: 'W',
      listId: 'L',
      front: 'a',
      back: 'b',
      examples: [],
      addedAt: list.createdAt,
      lastRevisedAt: null,
      remembered: null,
      dirty: true,
      updatedAt: list.createdAt,
    };
    store.getState().importVocabulary([list], [word]);
    store.getState().importVocabulary([list], [word]);
    await store.getState().flush();
    expect(saved().lists).toEqual([list]);
    expect(saved().words).toEqual([word]);
  });

  it('rejects changes before load', () => {
    const { store } = setup();
    expect(() => store.getState().addList('Travel')).toThrow('not loaded');
  });

  it('reports load errors', async () => {
    const { store, backend } = setup();
    backend.readText = () => Promise.reject(new Error('disk on fire'));
    await store.getState().load();
    expect(store.getState()).toMatchObject({ status: 'error', error: 'disk on fire' });
  });
});
