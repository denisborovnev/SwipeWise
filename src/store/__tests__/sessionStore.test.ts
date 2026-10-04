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
  const vocabulary = createVocabularyStore({ repository, newId, now: () => NOW.toISOString(), seedDemo: false });
  const sessions = createSessionStore({ repository, vocabulary, newId, now: () => NOW, random });
  await vocabulary.getState().load();
  await sessions.getState().load();

  const listId = vocabulary.getState().addList('Travel');
  const otherListId = vocabulary.getState().addList('Kitchen');
  const ids = ['a', 'b', 'c'].map((x) => vocabulary.getState().addWord(listId, { front: x, back: x.toUpperCase() }));
  vocabulary.getState().addWord(otherListId, { front: 'x', back: 'X' });

  const word = (id: string) => vocabulary.getState().data.words.find((w) => w.id === id)!;
  return { backend, repository, vocabulary, sessions, listId, ids, word };
}

describe('sessionStore', () => {
  it('starts a session with the words matching the filter', async () => {
    const { sessions, listId, ids } = await setup();
    const filter = { listId };
    expect(sessions.getState().countMatching(filter)).toBe(3);
    expect(sessions.getState().startSession(filter)).toBe(3);
    expect(sessions.getState().session?.wordIds).toEqual(ids);
  });

  it('shuffles the words of a new session and again on restart', async () => {
    let calls = 0;
    // First shuffle keeps the order, the second one (restart) rotates it.
    const { sessions, listId, ids } = await setup(() => (calls++ < 2 ? 0.9999 : 0));
    sessions.getState().startSession({ listId });
    expect(sessions.getState().session?.wordIds).toEqual(ids);
    sessions.getState().restart();
    expect(sessions.getState().session?.wordIds).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('does not start an empty session but still remembers the filter', async () => {
    const { sessions, repository } = await setup();
    const filter = { listId: 'all' as const, onlyNotRemembered: true };
    expect(sessions.getState().startSession(filter)).toBe(0);
    expect(sessions.getState().session).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    expect((await repository.loadSettings()).lastFilter).toEqual(filter);
  });

  it('records answers on the words and advances', async () => {
    const { sessions, listId, ids, word } = await setup();
    sessions.getState().startSession({ listId });
    sessions.getState().answer('no');
    expect(word(ids[0])).toMatchObject({ remembered: 'no', lastRevisedAt: NOW.toISOString() });
    expect(sessions.getState().session?.currentIndex).toBe(1);
  });

  it('undo restores the word and goes back', async () => {
    const { sessions, listId, ids, word } = await setup();
    sessions.getState().startSession({ listId });
    sessions.getState().answer('yes');
    sessions.getState().undo();
    expect(word(ids[0])).toMatchObject({ remembered: null, lastRevisedAt: null });
    expect(sessions.getState().session?.currentIndex).toBe(0);
  });

  it('keeps the frozen word list, and restart repeats the same words', async () => {
    const { sessions, listId, ids } = await setup();
    sessions.getState().startSession({ listId, onlyNotRemembered: false });
    ids.forEach(() => sessions.getState().answer('yes'));
    expect(sessions.getState().session?.finishedAt).toBeDefined();
    sessions.getState().restart();
    expect([...sessions.getState().session!.wordIds].sort()).toEqual([...ids].sort());
    expect(sessions.getState().session).toMatchObject({ currentIndex: 0, history: [] });
  });

  it('skips words deleted after the session was created', async () => {
    const { sessions, vocabulary, listId, ids } = await setup();
    sessions.getState().startSession({ listId });
    vocabulary.getState().deleteWord(ids[0]);
    sessions.getState().skipMissing();
    expect(sessions.getState().session?.currentIndex).toBe(1);
  });

  it('persists the session and restores it on load', async () => {
    const { backend, repository, vocabulary, sessions, listId } = await setup();
    sessions.getState().startSession({ listId });
    sessions.getState().answer('yes');
    await sessions.getState().flush();
    expect(backend.files[FILES.session]).toBeDefined();

    const reloaded = createSessionStore({ repository, vocabulary, newId: () => 'x' });
    await reloaded.getState().load();
    expect(reloaded.getState().session).toEqual(sessions.getState().session);
    expect(reloaded.getState().lastFilter).toEqual({ listId });
  });
});
