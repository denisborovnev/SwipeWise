import { createStore, type StoreApi } from 'zustand/vanilla';

import type { Answer, NewWordInput, ReviewState, VocabularyData, Word, WordList, WordPatch } from '@/model/types';
import * as voc from '@/model/vocabulary';
import { createDebouncedTask } from '@/storage/debounce';
import type { Repository } from '@/storage/repository';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface VocabularyState {
  status: LoadStatus;
  error?: string;
  data: VocabularyData;

  /** Saves pending changes of the course loaded before, then loads the words of a course. */
  load(repository: Repository): Promise<void>;
  /** Saves pending changes and forgets the loaded words (e.g. when the course is deleted). */
  unload(): Promise<void>;
  /** Writes pending changes to disk immediately. */
  flush(): Promise<void>;

  addList(name: string): string;
  renameList(listId: string, name: string): void;
  deleteList(listId: string): void;

  addWord(listId: string, input: NewWordInput): string;
  updateWord(wordId: string, patch: WordPatch): void;
  deleteWord(wordId: string): void;
  /** Adds complete lists and words (e.g. sample data); items whose id already exists are skipped. */
  importVocabulary(lists: WordList[], words: Word[]): void;
  recordAnswer(wordId: string, answer: Answer): void;
  restoreReview(wordId: string, previous: ReviewState): void;
}

export interface VocabularyStoreDeps {
  newId: () => string;
  now?: () => string;
  /** Delay before changes are written to disk. */
  saveDelayMs?: number;
}

export function createVocabularyStore({
  newId,
  now = () => new Date().toISOString(),
  saveDelayMs = 1000,
}: VocabularyStoreDeps): StoreApi<VocabularyState> {
  return createStore<VocabularyState>()((set, get) => {
    /** Files of the loaded course. */
    let repository: Repository | null = null;
    /** Ignores the result of a load that was overtaken by a newer one (quick course switches). */
    let loadCount = 0;
    const saver = createDebouncedTask(async () => {
      await repository?.saveVocabulary(get().data);
    }, saveDelayMs);

    /** Stops changes and writes the pending ones to the files they belong to. */
    const close = async () => {
      set({ status: 'loading', error: undefined });
      await saver.flush();
    };

    /** Applies a pure change to the data and schedules a save. */
    const change = (fn: (data: VocabularyData) => VocabularyData) => {
      if (get().status !== 'ready') {
        throw new Error('Vocabulary is not loaded yet');
      }
      set({ data: fn(get().data) });
      saver.schedule();
    };

    return {
      status: 'idle',
      data: voc.emptyVocabulary(),

      async load(next) {
        const id = ++loadCount;
        await close();
        repository = next;
        try {
          let data = await next.loadVocabulary();
          if (!data) {
            data = voc.emptyVocabulary();
            await next.saveVocabulary(data);
          }
          if (id === loadCount) {
            set({ status: 'ready', data });
          }
        } catch (e) {
          if (id === loadCount) {
            set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
          }
        }
      },

      async unload() {
        ++loadCount;
        await close();
        repository = null;
        set({ status: 'idle', data: voc.emptyVocabulary() });
      },

      flush: () => saver.flush(),

      addList(name) {
        const id = newId();
        change((d) => voc.addList(d, id, name, now()));
        return id;
      },
      renameList: (listId, name) => change((d) => voc.renameList(d, listId, name)),
      deleteList: (listId) => change((d) => voc.deleteList(d, listId)),

      addWord(listId, input) {
        const id = newId();
        change((d) => voc.addWord(d, id, listId, input, now()));
        return id;
      },
      updateWord: (wordId, patch) => change((d) => voc.updateWord(d, wordId, patch, now())),
      deleteWord: (wordId) => change((d) => voc.deleteWord(d, wordId)),
      importVocabulary: (lists, words) =>
        change((d) => {
          const listIds = new Set(d.lists.map((l) => l.id));
          const wordIds = new Set(d.words.map((w) => w.id));
          return {
            ...d,
            lists: [...d.lists, ...lists.filter((l) => !listIds.has(l.id))],
            words: [...d.words, ...words.filter((w) => !wordIds.has(w.id))],
          };
        }),
      recordAnswer: (wordId, answer) => change((d) => voc.recordAnswer(d, wordId, answer, now())),
      restoreReview: (wordId, previous) => change((d) => voc.restoreReview(d, wordId, previous, now())),
    };
  });
}
