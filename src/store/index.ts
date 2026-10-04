import * as Crypto from 'expo-crypto';
import { useStore } from 'zustand';

import { createFileBackend } from '@/storage/fileBackend';
import { createRepository } from '@/storage/repository';

import { createVocabularyStore, type VocabularyState } from './vocabularyStore';

export const repository = createRepository(createFileBackend());

export const vocabularyStore = createVocabularyStore({
  repository,
  newId: () => Crypto.randomUUID(),
});

export function useVocabulary<T>(selector: (state: VocabularyState) => T): T {
  return useStore(vocabularyStore, selector);
}
