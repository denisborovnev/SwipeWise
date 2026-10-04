import * as voc from '../vocabulary';

const T0 = '2026-10-04T10:00:00.000Z';
const T1 = '2026-10-05T08:00:00.000Z';

const withList = () => voc.addList(voc.emptyVocabulary(), 'L1', '  Travel ', T0);

describe('vocabulary', () => {
  it('adds a list with a trimmed name', () => {
    expect(withList().lists).toEqual([{ id: 'L1', name: 'Travel', createdAt: T0 }]);
  });

  it('adds a word with defaults for system fields', () => {
    const data = voc.addWord(withList(), 'W1', 'L1', { front: ' машина ', back: 'car', examples: [' Drive slowly. ', ''] }, T0);
    expect(data.words[0]).toEqual({
      id: 'W1',
      listId: 'L1',
      front: 'машина',
      back: 'car',
      examples: ['Drive slowly.'],
      addedAt: T0,
      lastRevisedAt: null,
      remembered: null,
      dirty: true,
      updatedAt: T0,
    });
  });

  it('refuses to add a word to a missing list', () => {
    expect(() => voc.addWord(withList(), 'W1', 'nope', { front: 'a', back: 'b' }, T0)).toThrow();
  });

  it('records an answer', () => {
    let data = voc.addWord(withList(), 'W1', 'L1', { front: 'a', back: 'b' }, T0);
    data = { ...data, words: data.words.map((w) => ({ ...w, dirty: false })) };
    const w = voc.recordAnswer(data, 'W1', 'no', T1).words[0];
    expect(w).toMatchObject({ lastRevisedAt: T1, remembered: 'no', dirty: true, updatedAt: T1 });
    expect(w.addedAt).toBe(T0);
  });

  it('updates only the patched fields', () => {
    const data = voc.addWord(withList(), 'W1', 'L1', { front: 'a', back: 'b', examples: ['x'] }, T0);
    const w = voc.updateWord(data, 'W1', { back: ' bee ' }, T1).words[0];
    expect(w).toMatchObject({ front: 'a', back: 'bee', examples: ['x'], updatedAt: T1 });
  });

  it('deletes a list with its words', () => {
    let data = voc.addList(withList(), 'L2', 'Kitchen', T0);
    data = voc.addWord(data, 'W1', 'L1', { front: 'a', back: 'b' }, T0);
    data = voc.addWord(data, 'W2', 'L2', { front: 'c', back: 'd' }, T0);
    data = voc.deleteList(data, 'L1');
    expect(data.lists.map((l) => l.id)).toEqual(['L2']);
    expect(data.words.map((w) => w.id)).toEqual(['W2']);
  });

  it('does not mutate its input', () => {
    const data = withList();
    const snapshot = JSON.stringify(data);
    voc.addWord(data, 'W1', 'L1', { front: 'a', back: 'b' }, T0);
    voc.renameList(data, 'L1', 'Other');
    expect(JSON.stringify(data)).toBe(snapshot);
  });

  it('finds duplicates by front or back within the same list', () => {
    let data = voc.addList(withList(), 'L2', 'Other', T0);
    data = voc.addWord(data, 'W1', 'L1', { front: 'Машина', back: 'car' }, T0);
    expect(voc.findDuplicate(data, 'L1', { front: 'машина', back: 'auto' })?.id).toBe('W1');
    expect(voc.findDuplicate(data, 'L1', { front: 'авто', back: ' CAR ' })?.id).toBe('W1');
    expect(voc.findDuplicate(data, 'L2', { front: 'машина', back: 'car' })).toBeUndefined();
    expect(voc.findDuplicate(data, 'L1', { front: 'машина', back: 'car' }, 'W1')).toBeUndefined();
  });
});
