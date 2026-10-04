import { createMemoryBackend } from '@/storage/backend';
import { createRepository, FILES } from '@/storage/repository';

import { createSessionStore } from '../sessionStore';
import { createVocabularyStore } from '../vocabularyStore';

const NOW = new Date('2026-10-10T10:00:00.000Z');

/** A "random" source that makes shuffle() keep the original order. */
const KEEP_ORDER = () => 0.9999;

async function setup(random = KEEP_ORDER) {
  const backend = createMemoryBackend();
  const repository = createRepository(backend);
  let n = 0;
  const newId = () => `id${++n}`;
  const vocabulary = createVocabularyStore({ newId, now: () => NOW.toISOString() });
  const sessions = createSessionStore({ vocabulary, newId, now: () => NOW, random });
  await vocabulary.getState().load(repository);
  await sessions.getState().load(repository);

  const listId = vocabulary.getState().addList('Travel');
  const otherListId = vocabulary.getState().addList('Kitchen');
  const ids = ['a', 'b', 'c'].map((x) => vocabulary.getState().addWord(listId, { front: x, back: x.toUpperCase() }));
  vocabulary.getState().addWord(otherListId, { front: 'x', back: 'X' });

  const word = (id: string) => vocabulary.getState().data.words.find((w) => w.id === id)!;
  return { backend, repository, vocabulary, sessions, listId, ids, word };
}

describe('sessionStore', () => {
  it('starts a session with the words of several lists', async () => {
    const { sessions, vocabulary, listId, ids } = await setup();
    const kitchen = vocabulary.getState().data.lists.find((l) => l.name === 'Kitchen')!.id;
    expect(sessions.getState().startSession({ listIds: [listId, kitchen] })).toBe(ids.length + 1);
  });

  it('starts a session with the words matching the filter', async () => {
    const { sessions, listId, ids } = await setup();
    const filter = { listIds: [listId] };
    expect(sessions.getState().countMatching(filter)).toBe(3);
    expect(sessions.getState().startSession(filter)).toBe(3);
    expect(sessions.getState().session?.wordIds).toEqual(ids);
  });

  it('shuffles the words of a new session and again on restart', async () => {
    let calls = 0;
    // First shuffle keeps the order, the second one (restart) rotates it.
    const { sessions, listId, ids } = await setup(() => (calls++ < 2 ? 0.9999 : 0));
    sessions.getState().startSession({ listIds: [listId] });
    expect(sessions.getState().session?.wordIds).toEqual(ids);
    sessions.getState().restart();
    expect(sessions.getState().session?.wordIds).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('does not start an empty session but still remembers the filter', async () => {
    const { sessions, repository } = await setup();
    const filter = { listIds: [], onlyNotRemembered: true };
    expect(sessions.getState().startSession(filter)).toBe(0);
    expect(sessions.getState().session).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    expect((await repository.loadSettings()).lastFilter).toEqual(filter);
  });

  it('records answers on the words and advances', async () => {
    const { sessions, listId, ids, word } = await setup();
    sessions.getState().startSession({ listIds: [listId] });
    sessions.getState().answer('no');
    expect(word(ids[0])).toMatchObject({ remembered: 'no', lastRevisedAt: NOW.toISOString() });
    expect(sessions.getState().session?.currentIndex).toBe(1);
  });

  it('undo restores the word and goes back', async () => {
    const { sessions, listId, ids, word } = await setup();
    sessions.getState().startSession({ listIds: [listId] });
    sessions.getState().answer('yes');
    sessions.getState().undo();
    expect(word(ids[0])).toMatchObject({ remembered: null, lastRevisedAt: null });
    expect(sessions.getState().session?.currentIndex).toBe(0);
  });

  it('keeps the frozen word list, and restart repeats the same words', async () => {
    const { sessions, listId, ids } = await setup();
    sessions.getState().startSession({ listIds: [listId], onlyNotRemembered: false });
    ids.forEach(() => sessions.getState().answer('yes'));
    expect(sessions.getState().session?.finishedAt).toBeDefined();
    sessions.getState().restart();
    expect([...sessions.getState().session!.wordIds].sort()).toEqual([...ids].sort());
    expect(sessions.getState().session).toMatchObject({ currentIndex: 0, history: [] });
  });

  it('skips words deleted after the session was created', async () => {
    const { sessions, vocabulary, listId, ids } = await setup();
    sessions.getState().startSession({ listIds: [listId] });
    vocabulary.getState().deleteWord(ids[0]);
    sessions.getState().skipMissing();
    expect(sessions.getState().session?.currentIndex).toBe(1);
  });

  it('persists the session and restores it on load', async () => {
    const { backend, repository, vocabulary, sessions, listId } = await setup();
    sessions.getState().startSession({ listIds: [listId] });
    sessions.getState().answer('yes');
    await sessions.getState().flush();
    expect(backend.files[FILES.sessions]).toBeDefined();

    const reloaded = createSessionStore({ vocabulary, newId: () => 'x' });
    await reloaded.getState().load(repository);
    expect(reloaded.getState().session).toEqual(sessions.getState().session);
    expect(reloaded.getState().recent).toEqual(sessions.getState().recent);
    expect(reloaded.getState().lastFilter).toEqual({ listIds: [listId] });
  });

  it('keeps the sessions of each course separate', async () => {
    const { backend, repository, sessions, listId } = await setup();
    sessions.getState().startSession({ listIds: [listId] });

    // Pending changes go to the first course's files before the other course is loaded.
    const other = createRepository(createMemoryBackend());
    await sessions.getState().load(other);
    expect(JSON.parse(backend.files[FILES.sessions]).sessions).toHaveLength(1);
    expect(sessions.getState()).toMatchObject({ status: 'ready', session: null, recent: [], lastFilter: null });

    await sessions.getState().load(repository);
    expect(sessions.getState().recent).toHaveLength(1);
    expect(sessions.getState().lastFilter).toEqual({ listIds: [listId] });
  });

  describe('recent sessions', () => {
    it('keeps sessions most recently used first and replaces one with the same filter', async () => {
      const { sessions, listId } = await setup();
      sessions.getState().startSession({ listIds: [listId] });
      sessions.getState().startSession({ listIds: [] });
      sessions.getState().startSession({ listIds: [listId] }); // same filter as the first one
      expect(sessions.getState().recent.map((s) => s.filter.listIds)).toEqual([[listId], []]);
      expect(sessions.getState().session).toBe(sessions.getState().recent[0]);
    });

    it('keeps at most 5 sessions', async () => {
      const { sessions } = await setup();
      for (let days = 0; days < 7; days++) {
        sessions.getState().startSession({ listIds: [], addedSince: { days: days + 100 } });
      }
      const recent = sessions.getState().recent;
      expect(recent).toHaveLength(5);
      expect(recent[0].filter.addedSince).toEqual({ days: 106 });
    });

    it('selecting an unfinished session continues it where it stopped', async () => {
      const { sessions, listId } = await setup();
      sessions.getState().startSession({ listIds: [listId] });
      sessions.getState().answer('yes');
      const first = sessions.getState().session!;
      sessions.getState().startSession({ listIds: [] });

      sessions.getState().selectSession(first.id);
      expect(sessions.getState().session).toEqual(first);
      expect(sessions.getState().recent.map((s) => s.id)).toEqual([first.id, expect.any(String)]);
    });

    it('selecting a finished session starts it again', async () => {
      const { sessions, listId, ids } = await setup();
      sessions.getState().startSession({ listIds: [listId] });
      ids.forEach(() => sessions.getState().answer('yes'));
      const finishedId = sessions.getState().session!.id;
      sessions.getState().startSession({ listIds: [] });

      sessions.getState().selectSession(finishedId);
      expect(sessions.getState().session).toMatchObject({ id: finishedId, currentIndex: 0, history: [] });
      expect(sessions.getState().session?.finishedAt).toBeUndefined();
    });

    it('"repeat missed" adds a separate session with the missed words', async () => {
      const { sessions, listId, ids } = await setup();
      sessions.getState().startSession({ listIds: [listId] });
      sessions.getState().answer('no');
      sessions.getState().answer('yes');
      sessions.getState().answer('no');
      sessions.getState().repeatMissed();

      const [missed, original] = sessions.getState().recent;
      expect(missed).toMatchObject({ kind: 'missed', filter: { listIds: [listId] } });
      expect([...missed.wordIds].sort()).toEqual([ids[0], ids[2]].sort());
      expect(original.filter).toEqual({ listIds: [listId] });
    });
  });

  it('uses the merged list in sessions and the remembered filter after merging', async () => {
    const { sessions, vocabulary, listId, repository } = await setup();
    const kitchen = vocabulary.getState().data.lists.find((l) => l.name === 'Kitchen')!.id;
    sessions.getState().startSession({ listIds: [kitchen] });

    vocabulary.getState().mergeLists(listId, [kitchen], 'Travel');
    sessions.getState().replaceLists([kitchen], listId);
    expect(sessions.getState().session?.filter.listIds).toEqual([listId]);
    expect(sessions.getState().lastFilter).toEqual({ listIds: [listId] });
    await sessions.getState().flush();
    await new Promise((r) => setTimeout(r, 0));
    expect((await repository.loadSettings()).lastFilter).toEqual({ listIds: [listId] });
  });
});
