import * as ses from '../session';

const T = '2026-10-10T10:00:00.000Z';
const NEVER = { lastRevisedAt: null, remembered: null };
const filter = { listId: 'all' as const };
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
