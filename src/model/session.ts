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

/** The answer given to a word in this session, if it was answered. */
export function answerOf(session: Session, wordId: string): Answer | undefined {
  return session.history.find((s) => s.wordId === wordId)?.answer;
}

/**
 * Answers the current card and moves to the next one. A word answered before (the user went back to it)
 * gets the new answer instead; its `previous` stays the review state from before the session touched it.
 */
export function answerCurrent(session: Session, answer: Answer, previous: ReviewState, now: string): Session {
  const wordId = currentWordId(session);
  if (wordId === undefined) {
    return session;
  }
  const earlier = session.history.find((s) => s.wordId === wordId);
  const next: Session = {
    ...session,
    currentIndex: session.currentIndex + 1,
    history: [
      ...session.history.filter((s) => s.wordId !== wordId),
      { wordId, answer, previous: earlier?.previous ?? previous },
    ],
  };
  return isFinished(next) ? { ...next, finishedAt: now } : next;
}

/**
 * Moves to the previous (-1) or next (+1) card without answering the current one. Returns the same
 * session when there is no card in that direction (first / last card).
 */
export function browse(session: Session, direction: -1 | 1): Session {
  const index = session.currentIndex + direction;
  if (isFinished(session) || index < 0 || index >= session.wordIds.length) {
    return session;
  }
  return { ...session, currentIndex: index };
}

/** Takes back the last answer and shows that card again. Returns the undone step so the caller can restore the word's review values. */
export function undoLast(session: Session) {
  const step = session.history.at(-1);
  if (!step) {
    return null;
  }
  const index = session.wordIds.indexOf(step.wordId);
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

/** How many recent sessions are kept. */
export const MAX_RECENT_SESSIONS = 10;

/** Sessions with the same key are "the same session" in the recent list (same filter and kind). */
export function sessionKey(session: Session): string {
  const { listIds, addedSince, notRevisedSince, onlyNotRemembered } = session.filter;
  return JSON.stringify([
    [...listIds].sort(),
    addedSince ?? null,
    notRevisedSince ?? null,
    !!onlyNotRemembered,
    session.kind ?? null,
  ]);
}

/**
 * Puts the session first in the recent list (most recently used first). An older entry with the
 * same id or the same filter is replaced, and the list is capped at MAX_RECENT_SESSIONS.
 */
export function upsertRecent(recent: Session[], session: Session): Session[] {
  const key = sessionKey(session);
  const others = recent.filter((s) => s.id !== session.id && sessionKey(s) !== key);
  return [session, ...others].slice(0, MAX_RECENT_SESSIONS);
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
