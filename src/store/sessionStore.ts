import { createStore, type StoreApi } from 'zustand/vanilla';

import { selectWords } from '@/model/filter';
import * as ses from '@/model/session';
import type { Answer, Session, SessionFilter } from '@/model/types';
import { createDebouncedTask } from '@/storage/debounce';
import type { Repository } from '@/storage/repository';

import type { LoadStatus, VocabularyState } from './vocabularyStore';

export interface SessionState {
  status: LoadStatus;
  /** The current or last session; null if none was ever started. */
  session: Session | null;
  /** Filter of the last "New session", offered as the default next time. */
  lastFilter: SessionFilter | null;

  load(): Promise<void>;
  flush(): Promise<void>;

  /** Number of words a new session with this filter would contain. */
  countMatching(filter: SessionFilter): number;
  /** Starts a session with the matching words in random order; returns the number of words (0 = not started). */
  startSession(filter: SessionFilter): number;
  /** Starts a session with given words, e.g. "repeat the ones I missed". */
  startWithWords(filter: SessionFilter, wordIds: string[]): void;
  answer(answer: Answer): void;
  undo(): void;
  /** Same words, shuffled again, from the first card. */
  restart(): void;
  /** Skips cards whose words were deleted after the session was created. */
  skipMissing(): void;
}

export interface SessionStoreDeps {
  repository: Repository;
  vocabulary: StoreApi<VocabularyState>;
  newId: () => string;
  now?: () => Date;
  random?: () => number;
  saveDelayMs?: number;
}

export function createSessionStore({
  repository,
  vocabulary,
  newId,
  now = () => new Date(),
  random = Math.random,
  saveDelayMs = 300,
}: SessionStoreDeps): StoreApi<SessionState> {
  return createStore<SessionState>()((set, get) => {
    const saver = createDebouncedTask(() => repository.saveSession(get().session), saveDelayMs);
    const nowIso = () => now().toISOString();

    const setSession = (session: Session) => {
      set({ session });
      saver.schedule();
    };

    const wordExists = (wordId: string) => vocabulary.getState().data.words.some((w) => w.id === wordId);

    const rememberFilter = async (filter: SessionFilter) => {
      set({ lastFilter: filter });
      const settings = await repository.loadSettings();
      await repository.saveSettings({ ...settings, lastFilter: filter });
    };

    return {
      status: 'idle',
      session: null,
      lastFilter: null,

      async load() {
        set({ status: 'loading' });
        try {
          const [session, settings] = await Promise.all([repository.loadSession(), repository.loadSettings()]);
          set({ status: 'ready', session, lastFilter: settings.lastFilter ?? null });
        } catch (e) {
          console.error('Could not load the session', e);
          set({ status: 'ready', session: null });
        }
      },

      flush: () => saver.flush(),

      countMatching: (filter) => selectWords(vocabulary.getState().data.words, filter, now()).length,

      startSession(filter) {
        const wordIds = selectWords(vocabulary.getState().data.words, filter, now());
        if (wordIds.length > 0) {
          setSession(ses.createSession(newId(), filter, wordIds, nowIso(), random));
        }
        rememberFilter(filter).catch((e) => console.error('Could not save the filter', e));
        return wordIds.length;
      },

      startWithWords(filter, wordIds) {
        setSession(ses.createSession(newId(), filter, wordIds, nowIso(), random));
      },

      answer(answer) {
        const { session } = get();
        const wordId = session && ses.currentWordId(session);
        if (!session || !wordId) {
          return;
        }
        const word = vocabulary.getState().data.words.find((w) => w.id === wordId);
        if (!word) {
          get().skipMissing();
          return;
        }
        const previous = { lastRevisedAt: word.lastRevisedAt, remembered: word.remembered };
        vocabulary.getState().recordAnswer(wordId, answer);
        setSession(ses.answerCurrent(session, answer, previous, nowIso()));
      },

      undo() {
        const { session } = get();
        const result = session && ses.undoLast(session);
        if (!result) {
          return;
        }
        if (wordExists(result.step.wordId)) {
          vocabulary.getState().restoreReview(result.step.wordId, result.step.previous);
        }
        setSession(result.session);
      },

      restart() {
        const { session } = get();
        if (session) {
          setSession(ses.restartSession(session, nowIso(), random));
        }
      },

      skipMissing() {
        const { session } = get();
        if (!session) {
          return;
        }
        const next = ses.skipMissing(session, wordExists, nowIso());
        if (next !== session) {
          setSession(next);
        }
      },
    };
  });
}
