import type { NewWordInput, VocabularyData } from './types';
import { addList, addWord, emptyVocabulary } from './vocabulary';

const DEMO_WORDS: NewWordInput[] = [
  { front: 'машина', back: 'car', examples: ["Don't drive your car too fast."] },
  { front: 'яблоко', back: 'apple', examples: ['An apple a day keeps the doctor away.'] },
  { front: 'дом', back: 'house', examples: ['They bought a new house last year.'] },
  { front: 'книга', back: 'book', examples: ['I am reading a good book.', 'Can I borrow your book?'] },
  { front: 'вода', back: 'water', examples: ['Could I have a glass of water, please?'] },
];

/** A small list shown on first launch so the app is not empty. */
export function createDemoVocabulary(newId: () => string, now: string): VocabularyData {
  const listId = newId();
  let data = addList(emptyVocabulary(), listId, 'Demo', now);
  for (const word of DEMO_WORDS) {
    data = addWord(data, newId(), listId, word, now);
  }
  return data;
}
