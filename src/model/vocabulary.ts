import type { Answer, NewWordInput, ReviewState, VocabularyData, Word, WordList, WordPatch } from './types';

/**
 * Pure operations on the vocabulary. They never mutate their input and take the id / time
 * from the caller, so they are deterministic and easy to test.
 */

export const emptyVocabulary = (): VocabularyData => ({ version: 1, lists: [], words: [] });

export function normalizeExamples(examples: string[] | undefined): string[] {
  return (examples ?? []).map((e) => e.trim()).filter((e) => e.length > 0);
}

export function addList(data: VocabularyData, id: string, name: string, now: string): VocabularyData {
  const list: WordList = { id, name: name.trim(), createdAt: now };
  return { ...data, lists: [...data.lists, list] };
}

export function renameList(data: VocabularyData, listId: string, name: string): VocabularyData {
  return {
    ...data,
    lists: data.lists.map((l) => (l.id === listId ? { ...l, name: name.trim() } : l)),
  };
}

/** Removes the list together with all its words. */
export function deleteList(data: VocabularyData, listId: string): VocabularyData {
  return {
    ...data,
    lists: data.lists.filter((l) => l.id !== listId),
    words: data.words.filter((w) => w.listId !== listId),
  };
}

export function addWord(
  data: VocabularyData,
  id: string,
  listId: string,
  input: NewWordInput,
  now: string,
): VocabularyData {
  if (!data.lists.some((l) => l.id === listId)) {
    throw new Error(`List ${listId} does not exist`);
  }
  const word: Word = {
    id,
    listId,
    front: input.front.trim(),
    back: input.back.trim(),
    examples: normalizeExamples(input.examples),
    addedAt: now,
    lastRevisedAt: null,
    remembered: null,
    dirty: true,
    updatedAt: now,
  };
  return { ...data, words: [...data.words, word] };
}

function updateWordById(data: VocabularyData, wordId: string, update: (w: Word) => Word): VocabularyData {
  return { ...data, words: data.words.map((w) => (w.id === wordId ? update(w) : w)) };
}

export function updateWord(data: VocabularyData, wordId: string, patch: WordPatch, now: string): VocabularyData {
  return updateWordById(data, wordId, (w) => ({
    ...w,
    ...patch,
    front: patch.front !== undefined ? patch.front.trim() : w.front,
    back: patch.back !== undefined ? patch.back.trim() : w.back,
    examples: patch.examples !== undefined ? normalizeExamples(patch.examples) : w.examples,
    dirty: true,
    updatedAt: now,
  }));
}

export function deleteWord(data: VocabularyData, wordId: string): VocabularyData {
  return { ...data, words: data.words.filter((w) => w.id !== wordId) };
}

export function recordAnswer(data: VocabularyData, wordId: string, answer: Answer, now: string): VocabularyData {
  return updateWordById(data, wordId, (w) => ({
    ...w,
    lastRevisedAt: now,
    remembered: answer,
    dirty: true,
    updatedAt: now,
  }));
}

/** Puts back the review values a word had before an answer (undo). */
export function restoreReview(data: VocabularyData, wordId: string, previous: ReviewState, now: string): VocabularyData {
  return updateWordById(data, wordId, (w) => ({ ...w, ...previous, dirty: true, updatedAt: now }));
}

/** Finds a word in the same list with the same front or back (case-insensitive). */
export function findDuplicate(
  data: VocabularyData,
  listId: string,
  input: Pick<NewWordInput, 'front' | 'back'>,
  ignoreWordId?: string,
): Word | undefined {
  const front = input.front.trim().toLowerCase();
  const back = input.back.trim().toLowerCase();
  return data.words.find(
    (w) =>
      w.listId === listId &&
      w.id !== ignoreWordId &&
      (w.front.toLowerCase() === front || w.back.toLowerCase() === back),
  );
}

/**
 * Moves the words of `sourceListIds` into `targetListId`, deletes the source lists and names the
 * target `name`. Words keep their review values; they are marked dirty because their list changed.
 */
export function mergeLists(
  data: VocabularyData,
  targetListId: string,
  sourceListIds: string[],
  name: string,
  now: string,
): VocabularyData {
  const sources = new Set(sourceListIds.filter((id) => id !== targetListId));
  return {
    ...data,
    lists: data.lists
      .filter((l) => !sources.has(l.id))
      .map((l) => (l.id === targetListId ? { ...l, name: name.trim() } : l)),
    words: data.words.map((w) => (sources.has(w.listId) ? { ...w, listId: targetListId, dirty: true, updatedAt: now } : w)),
  };
}

/** Number of words that have the same front and back as an earlier word (case-insensitive). */
export function countDuplicates(words: Pick<Word, 'front' | 'back'>[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const w of words) {
    const key = `${w.front.toLowerCase()}\n${w.back.toLowerCase()}`;
    if (seen.has(key)) {
      duplicates++;
    }
    seen.add(key);
  }
  return duplicates;
}
