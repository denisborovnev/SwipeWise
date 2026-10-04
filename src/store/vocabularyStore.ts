import { createStore, type StoreApi } from 'zustand/vanilla';

import { createDemoVocabulary } from '@/model/demo';
import type { Answer, NewWordInput, VocabularyData, WordPatch } from '@/model/types';
import * as voc from '@/model/vocabulary';
import { createDebouncedTask } from '@/storage/debounce';
import type { Repository } from '@/storage/repository';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface VocabularyState {
  status: LoadStatus;
  error?: string;
  data: VocabularyData;

  load(): Promise<void>;
  /** Writes pending changes to disk immediately. */
  flush(): Promise<void>;

  addList(name: string): string;
  renameList(listId: string, name: string): void;
  deleteList(listId: string): void;

  addWord(listId: string, input: NewWordInput): string;
  updateWord(wordId: string, patch: WordPatch): void;
  deleteWord(wordId: string): void;
  recordAnswer(wordId: string, answer: Answer): void;
}

export interface VocabularyStoreDeps {
  repository: Repository;
  newId: () => string;
  now?: () => string;
  /** Delay before changes are written to disk. */
  saveDelayMs?: number;
  /** Fill an empty vocabulary with a demo list on first launch. */
  seedDemo?: boolean;
}

export function createVocabularyStore({
  repository,
  newId,
  now = () => new Date().toISOString(),
  saveDelayMs = 1000,
  seedDemo = true,
}: VocabularyStoreDeps): StoreApi<VocabularyState> {
  return createStore<VocabularyState>()((set, get) => {
    const saver = createDebouncedTask(() => repository.saveVocabulary(get().data), saveDelayMs);

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

      async load() {
        set({ status: 'loading', error: undefined });
        try {
          let data = await repository.loadVocabulary();
          if (!data) {
            data = seedDemo ? createDemoVocabulary(newId, now()) : voc.emptyVocabulary();
            await repository.saveVocabulary(data);
          }
          set({ status: 'ready', data });
        } catch (e) {
          set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
        }
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
      recordAnswer: (wordId, answer) => change((d) => voc.recordAnswer(d, wordId, answer, now())),
    };
  });
}
