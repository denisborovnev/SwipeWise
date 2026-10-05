import * as ses from '../session';
import type { Session } from '../types';

const T = '2026-10-10T10:00:00.000Z';
const NEVER = { lastRevisedAt: null, remembered: null };
const filter = { listIds: [] };
/** A "random" source that makes shuffle() keep the original order. */
const KEEP_ORDER = () => 0.9999;

const start = () => ses.createSession('S1', filter, ['a', 'b', 'c'], T, KEEP_ORDER);

describe('session', () => {
  it('walks through the words and finishes after the last one', () => {
    let s = start();
    expect(ses.currentWordId(s)).toBe('a');
    s = ses.answerCurrent(s, 'yes', NEVER, T);
    s = ses.answerCurrent(s, 'no', NEVER, T);
    expect(ses.currentWordId(s)).toBe('c');
    expect(ses.isFinished(s)).toBe(false);
    s = ses.answerCurrent(s, 'no', NEVER, T);
    expect(ses.isFinished(s)).toBe(true);
    expect(s.finishedAt).toBe(T);
    expect(ses.sessionStats(s)).toEqual({ total: 3, answered: 3, remembered: 1, notRemembered: 2 });
    expect(ses.missedWordIds(s)).toEqual(['b', 'c']);
  });

  it('ignores answers after the end', () => {
    let s = ses.createSession('S1', filter, ['a'], T, KEEP_ORDER);
    s = ses.answerCurrent(s, 'yes', NEVER, T);
    expect(ses.answerCurrent(s, 'no', NEVER, T)).toBe(s);
  });

  it('undoes the last answer and returns the previous review state', () => {
    const previous = { lastRevisedAt: '2026-10-01T00:00:00.000Z', remembered: 'no' as const };
    let s = ses.answerCurrent(start(), 'yes', previous, T);
    const result = ses.undoLast(s)!;
    expect(result.step).toEqual({ wordId: 'a', answer: 'yes', previous });
    s = result.session;
    expect(ses.currentWordId(s)).toBe('a');
    expect(s.history).toEqual([]);
  });

  it('undo after finishing reopens the session', () => {
    let s = ses.createSession('S1', filter, ['a'], T, KEEP_ORDER);
    s = ses.answerCurrent(s, 'yes', NEVER, T);
    s = ses.undoLast(s)!.session;
    expect(s.finishedAt).toBeUndefined();
    expect(ses.isFinished(s)).toBe(false);
  });

  it('undo goes back over skipped (deleted) words', () => {
    let s = ses.answerCurrent(start(), 'yes', NEVER, T); // a answered
    s = ses.skipMissing(s, (id) => id !== 'b', T); // b deleted
    expect(ses.currentWordId(s)).toBe('c');
    s = ses.undoLast(s)!.session;
    expect(ses.currentWordId(s)).toBe('a');
  });

  it('browses back and forward without answering, stopping at the first and last card', () => {
    let s = start();
    expect(ses.browse(s, -1)).toBe(s); // first card
    s = ses.browse(s, 1); // skip a
    s = ses.browse(s, 1); // skip b
    expect(ses.currentWordId(s)).toBe('c');
    expect(ses.browse(s, 1)).toBe(s); // last card
    s = ses.browse(s, -1);
    expect(ses.currentWordId(s)).toBe('b');
    expect(s.history).toEqual([]);
    expect(ses.isFinished(s)).toBe(false);
  });

  it('a skipped word stays unanswered; answering the last card finishes the session', () => {
    let s = ses.browse(start(), 1); // skip a
    s = ses.answerCurrent(s, 'yes', NEVER, T); // b
    s = ses.answerCurrent(s, 'no', NEVER, T); // c
    expect(ses.isFinished(s)).toBe(true);
    expect(ses.answerOf(s, 'a')).toBeUndefined();
    expect(ses.sessionStats(s)).toEqual({ total: 3, answered: 2, remembered: 1, notRemembered: 1 });
  });

  it('answering a word again replaces the earlier answer and keeps the state from before the session', () => {
    const before = { lastRevisedAt: '2026-10-01T00:00:00.000Z', remembered: 'yes' as const };
    let s = ses.answerCurrent(start(), 'no', before, T); // a: no
    s = ses.browse(s, -1); // back to a
    const afterFirstAnswer = { lastRevisedAt: T, remembered: 'no' as const };
    s = ses.answerCurrent(s, 'yes', afterFirstAnswer, T); // a: yes
    expect(ses.currentWordId(s)).toBe('b');
    expect(s.history).toEqual([{ wordId: 'a', answer: 'yes', previous: before }]);
    expect(ses.answerOf(s, 'a')).toBe('yes');
    // Undo takes the answer back to the state before the session and shows the card again.
    const undone = ses.undoLast(s)!;
    expect(undone.step.previous).toEqual(before);
    expect(ses.currentWordId(undone.session)).toBe('a');
  });

  it('undo shows the card of the last answer even if the user browsed elsewhere', () => {
    let s = ses.answerCurrent(start(), 'yes', NEVER, T); // a, now on b
    s = ses.browse(s, 1); // on c
    s = ses.undoLast(s)!.session;
    expect(ses.currentWordId(s)).toBe('a');
  });

  it('returns null when there is nothing to undo', () => {
    expect(ses.undoLast(start())).toBeNull();
  });

  it('shuffles the words when created', () => {
    expect(ses.createSession('S1', filter, ['a', 'b', 'c'], T, () => 0).wordIds).toEqual(['b', 'c', 'a']);
  });

  it('restarts with the same words in a new order', () => {
    let s = ses.answerCurrent(start(), 'yes', NEVER, T);
    s = ses.restartSession(s, '2026-10-11T00:00:00.000Z', () => 0);
    expect(s).toMatchObject({ wordIds: ['b', 'c', 'a'], currentIndex: 0, history: [], startedAt: '2026-10-11T00:00:00.000Z' });
  });

  it('skips missing words and finishes when none are left', () => {
    const s = start();
    expect(ses.skipMissing(s, () => true, T)).toBe(s);
    const done = ses.skipMissing(s, () => false, T);
    expect(ses.isFinished(done)).toBe(true);
    expect(done.finishedAt).toBe(T);
  });
});

describe('upsertRecent', () => {
  const make = (id: string, listId: string, kind?: 'missed') => ({ ...ses.createSession(id, { listIds: [listId] }, [], T, KEEP_ORDER), kind });

  it('puts the session first and replaces the entry with the same id', () => {
    const a = make('A', 'L1');
    const b = make('B', 'L2');
    const recent = ses.upsertRecent(ses.upsertRecent([], a), b);
    expect(ses.upsertRecent(recent, { ...a, currentIndex: 1 }).map((s) => [s.id, s.currentIndex])).toEqual([
      ['A', 1],
      ['B', 0],
    ]);
  });

  it('replaces an older session with the same filter and kind', () => {
    const recent = [make('A', 'L1'), make('B', 'L1', 'missed')];
    expect(ses.upsertRecent(recent, make('C', 'L1')).map((s) => s.id)).toEqual(['C', 'B']);
    expect(ses.upsertRecent(recent, make('D', 'L1', 'missed')).map((s) => s.id)).toEqual(['D', 'A']);
  });

  it('treats the same lists in another order as the same filter', () => {
    const a = { ...ses.createSession('A', { listIds: ['L1', 'L2'] }, [], T, KEEP_ORDER) };
    const b = { ...ses.createSession('B', { listIds: ['L2', 'L1'] }, [], T, KEEP_ORDER) };
    expect(ses.upsertRecent([a], b).map((s) => s.id)).toEqual(['B']);
  });

  it('keeps at most MAX_RECENT_SESSIONS', () => {
    let recent: Session[] = [];
    for (let i = 0; i < 12; i++) {
      recent = ses.upsertRecent(recent, make(`S${i}`, `L${i}`));
    }
    expect(recent).toHaveLength(ses.MAX_RECENT_SESSIONS);
    expect(recent.map((s) => s.id)).toEqual(['S11', 'S10', 'S9', 'S8', 'S7', 'S6', 'S5', 'S4', 'S3', 'S2']);
  });
});
