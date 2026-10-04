import { createMemoryBackend } from '../backend';
import { createDebouncedTask } from '../debounce';
import { createRepository, FILES } from '../repository';

describe('repository', () => {
  it('returns null / defaults on first launch', async () => {
    const repo = createRepository(createMemoryBackend());
    expect(await repo.loadVocabulary()).toBeNull();
    expect(await repo.loadSession()).toBeNull();
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

  it('deletes the session file when the session is cleared', async () => {
    const backend = createMemoryBackend();
    const repo = createRepository(backend);
    await repo.saveSession({
      id: 'S1',
      filter: { listId: 'all', shuffle: false },
      wordIds: [],
      currentIndex: 0,
      history: [],
      startedAt: 'x',
    });
    expect(backend.files[FILES.session]).toBeDefined();
    await repo.saveSession(null);
    expect(backend.files[FILES.session]).toBeUndefined();
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
