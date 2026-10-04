import { createStore, type StoreApi } from 'zustand/vanilla';

import { selectWords } from '@/model/filter';
import * as ses from '@/model/session';
import type { Answer, Session, SessionFilter } from '@/model/types';
import { createDebouncedTask } from '@/storage/debounce';
import type { Repository } from '@/storage/repository';

import type { LoadStatus, VocabularyState } from './vocabularyStore';

export interface SessionState {
  status: LoadStatus;
  /** The current session (= recent[0]); null if none was ever started. */
  session: Session | null;
  /** Up to MAX_RECENT_SESSIONS sessions, most recently used first. */
  recent: Session[];
  /** Filter of the last "New session", offered as the default next time. */
  lastFilter: SessionFilter | null;

  load(): Promise<void>;
  flush(): Promise<void>;

  /** Number of words a new session with this filter would contain. */
  countMatching(filter: SessionFilter): number;
  /** Starts a session with the matching words in random order; returns the number of words (0 = not started). */
  startSession(filter: SessionFilter): number;
  /** Starts a new session with the words missed in the current one. */
  repeatMissed(): void;
  /** Makes a recent session the current one: unfinished ones continue, finished ones start again. */
  selectSession(sessionId: string): void;
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
    const saver = createDebouncedTask(() => repository.saveRecentSessions(get().recent), saveDelayMs);
    const nowIso = () => now().toISOString();

    /** Stores the session as the current one (first in the recent list). */
    const setSession = (session: Session) => {
      const recent = ses.upsertRecent(get().recent, session);
      set({ recent, session: recent[0] });
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
      recent: [],
      lastFilter: null,

      async load() {
        set({ status: 'loading' });
        try {
          const [recent, settings] = await Promise.all([repository.loadRecentSessions(), repository.loadSettings()]);
          set({ status: 'ready', recent, session: recent[0] ?? null, lastFilter: settings.lastFilter ?? null });
        } catch (e) {
          console.error('Could not load the sessions', e);
          set({ status: 'ready', recent: [], session: null });
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

      repeatMissed() {
        const { session } = get();
        const wordIds = session ? ses.missedWordIds(session) : [];
        if (session && wordIds.length > 0) {
          setSession({ ...ses.createSession(newId(), session.filter, wordIds, nowIso(), random), kind: 'missed' });
        }
      },

      selectSession(sessionId) {
        const session = get().recent.find((s) => s.id === sessionId);
        if (session) {
          setSession(ses.isFinished(session) ? ses.restartSession(session, nowIso(), random) : session);
        }
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
