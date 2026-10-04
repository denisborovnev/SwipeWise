import { createMemoryBackend } from '@/storage/backend';
import { createRepository, FILES } from '@/storage/repository';

import { createVocabularyStore } from '../vocabularyStore';

function setup(files?: Record<string, string>) {
  const backend = createMemoryBackend(files);
  const repository = createRepository(backend);
  let n = 0;
  const store = createVocabularyStore({ newId: () => `id${++n}`, now: () => '2026-10-04T10:00:00.000Z' });
  const saved = () => JSON.parse(backend.files[FILES.vocabulary]);
  return { backend, repository, store, saved };
}

describe('vocabularyStore', () => {
  it('starts a new course with no words and saves it', async () => {
    const { store, repository, saved } = setup();
    await store.getState().load(repository);
    const { status, data } = store.getState();
    expect(status).toBe('ready');
    expect(data).toEqual({ version: 1, lists: [], words: [] });
    expect(saved()).toEqual(data);
  });

  it('loads existing data', async () => {
    const existing = { version: 1, lists: [{ id: 'L', name: 'Mine', createdAt: 'x' }], words: [] };
    const { store, repository } = setup({ [FILES.vocabulary]: JSON.stringify(existing) });
    await store.getState().load(repository);
    expect(store.getState().data).toEqual(existing);
  });

  it('saves pending changes to the previous course before loading another one', async () => {
    const { store, repository, saved } = setup();
    await store.getState().load(repository);
    store.getState().addList('Travel');

    const other = createMemoryBackend();
    await store.getState().load(createRepository(other));
    expect(saved().lists).toHaveLength(1);
    expect(store.getState().data.lists).toEqual([]);
    expect(JSON.parse(other.files[FILES.vocabulary]).lists).toEqual([]);
  });

  it('unloads: saves pending changes and rejects new ones', async () => {
    const { store, repository, saved } = setup();
    await store.getState().load(repository);
    store.getState().addList('Travel');
    await store.getState().unload();
    expect(saved().lists).toHaveLength(1);
    expect(store.getState().status).toBe('idle');
    expect(() => store.getState().addList('Food')).toThrow('not loaded');
  });

  it('persists changes after flush', async () => {
    const { store, repository, saved } = setup();
    await store.getState().load(repository);
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
      const { store, backend, repository } = setup();
      await store.getState().load(repository);
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
    const { store, repository, saved } = setup();
    await store.getState().load(repository);
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
    const { store, backend, repository } = setup();
    backend.readText = () => Promise.reject(new Error('disk on fire'));
    await store.getState().load(repository);
    expect(store.getState()).toMatchObject({ status: 'error', error: 'disk on fire' });
  });
});
