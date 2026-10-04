import { shuffle } from './filter';
import type { Answer, ReviewState, Session, SessionFilter } from './types';

/**
 * Pure operations on a study session. The session only tracks progress; the words' review
 * values (lastRevisedAt / remembered) are updated in the vocabulary by the caller.
 */

/** The words are shuffled, so every session goes through them in a new order. */
export function createSession(
  id: string,
  filter: SessionFilter,
  wordIds: string[],
  now: string,
  random: () => number,
): Session {
  return { id, filter, wordIds: shuffle(wordIds, random), currentIndex: 0, history: [], startedAt: now };
}

export const isFinished = (session: Session) => session.currentIndex >= session.wordIds.length;

export function currentWordId(session: Session): string | undefined {
  return session.wordIds[session.currentIndex];
}

export function answerCurrent(session: Session, answer: Answer, previous: ReviewState, now: string): Session {
  const wordId = currentWordId(session);
  if (wordId === undefined) {
    return session;
  }
  const next: Session = {
    ...session,
    currentIndex: session.currentIndex + 1,
    history: [...session.history, { wordId, answer, previous }],
  };
  return isFinished(next) ? { ...next, finishedAt: now } : next;
}

/** Steps back one card. Returns the undone step so the caller can restore the word's review values. */
export function undoLast(session: Session) {
  const step = session.history.at(-1);
  if (!step) {
    return null;
  }
  const index = session.wordIds.lastIndexOf(step.wordId, session.currentIndex - 1);
  const next: Session = {
    ...session,
    currentIndex: index >= 0 ? index : Math.max(0, session.currentIndex - 1),
    history: session.history.slice(0, -1),
    finishedAt: undefined,
  };
  return { session: next, step };
}

/** Same words in a new order, from the first card again. */
export function restartSession(session: Session, now: string, random: () => number): Session {
  return {
    ...session,
    wordIds: shuffle(session.wordIds, random),
    currentIndex: 0,
    history: [],
    startedAt: now,
    finishedAt: undefined,
  };
}

/** Moves past words that no longer exist (e.g. deleted after the session was created). */
export function skipMissing(session: Session, exists: (wordId: string) => boolean, now: string): Session {
  let index = session.currentIndex;
  while (index < session.wordIds.length && !exists(session.wordIds[index])) {
    index++;
  }
  if (index === session.currentIndex) {
    return session;
  }
  const next = { ...session, currentIndex: index };
  return isFinished(next) ? { ...next, finishedAt: next.finishedAt ?? now } : next;
}

export interface SessionStats {
  total: number;
  answered: number;
  remembered: number;
  notRemembered: number;
}

export function sessionStats(session: Session): SessionStats {
  const remembered = session.history.filter((s) => s.answer === 'yes').length;
  return {
    total: session.wordIds.length,
    answered: session.history.length,
    remembered,
    notRemembered: session.history.length - remembered,
  };
}

export function missedWordIds(session: Session): string[] {
  return session.history.filter((s) => s.answer === 'no').map((s) => s.wordId);
}
