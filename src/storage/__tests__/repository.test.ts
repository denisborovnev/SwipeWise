import { createMemoryBackend } from '../backend';
import { createDebouncedTask } from '../debounce';
import type { Session } from '@/model/types';

import { createRepository, FILES } from '../repository';

const session = (id: string): Session => ({
  id,
  filter: { listId: 'all' },
  wordIds: [],
  currentIndex: 0,
  history: [],
  startedAt: 'x',
});

describe('repository', () => {
  it('returns null / defaults on first launch', async () => {
    const repo = createRepository(createMemoryBackend());
    expect(await repo.loadVocabulary()).toBeNull();
    expect(await repo.loadRecentSessions()).toEqual([]);
    expect(await repo.loadSettings()).toEqual({ version: 1 });
  });

  it('round-trips the vocabulary', async () => {
    const backend = createMemoryBackend();
    const repo = createRepository(backend);
    const data = { version: 1 as const, lists: [{ id: 'L1', name: 'Travel', createdAt: 'x' }], words: [] };
    await repo.saveVocabulary(data);
    expect(await createRepository(backend).loadVocabulary()).toEqual(data);
  });

  it('keeps a copy of a corrupt file and starts fresh', async () => {
    const backend = createMemoryBackend({ [FILES.vocabulary]: '{not json' });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await createRepository(backend).loadVocabulary()).toBeNull();
    expect(backend.files[`${FILES.vocabulary}.corrupt`]).toBe('{not json');
    warn.mockRestore();
  });

  it('round-trips the recent sessions', async () => {
    const repo = createRepository(createMemoryBackend());
    await repo.saveRecentSessions([session('S1'), session('S2')]);
    expect((await repo.loadRecentSessions()).map((s) => s.id)).toEqual(['S1', 'S2']);
  });

  it('migrates the single session saved by earlier versions', async () => {
    const backend = createMemoryBackend({ [FILES.legacySession]: JSON.stringify(session('OLD')) });
    const repo = createRepository(backend);
    expect((await repo.loadRecentSessions()).map((s) => s.id)).toEqual(['OLD']);
    await repo.saveRecentSessions([session('NEW'), session('OLD')]);
    expect(backend.files[FILES.legacySession]).toBeUndefined();
    expect((await repo.loadRecentSessions()).map((s) => s.id)).toEqual(['NEW', 'OLD']);
  });
});

describe('createDebouncedTask', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('merges calls within the delay into one run', async () => {
    const task = jest.fn(() => Promise.resolve());
    const d = createDebouncedTask(task, 1000);
    d.schedule();
    jest.advanceTimersByTime(500);
    d.schedule();
    jest.advanceTimersByTime(999);
    expect(task).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await d.flush();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('flush runs a pending task immediately', async () => {
    const task = jest.fn(() => Promise.resolve());
    const d = createDebouncedTask(task, 1000);
    d.schedule();
    await d.flush();
    expect(task).toHaveBeenCalledTimes(1);
    await d.flush();
    expect(task).toHaveBeenCalledTimes(1);
  });
});
