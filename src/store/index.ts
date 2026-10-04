import * as Crypto from 'expo-crypto';
import { useStore } from 'zustand';

import { createFileBackend } from '@/storage/fileBackend';
import { createRepository } from '@/storage/repository';

import { createSessionStore, type SessionState } from './sessionStore';
import { createVocabularyStore, type VocabularyState } from './vocabularyStore';

const newId = () => Crypto.randomUUID();

export const repository = createRepository(createFileBackend());

export const vocabularyStore = createVocabularyStore({ repository, newId });

export const sessionStore = createSessionStore({ repository, vocabulary: vocabularyStore, newId });

export function useVocabulary<T>(selector: (state: VocabularyState) => T): T {
  return useStore(vocabularyStore, selector);
}

export function useSession<T>(selector: (state: SessionState) => T): T {
  return useStore(sessionStore, selector);
}

export async function loadAll() {
  await vocabularyStore.getState().load();
  await sessionStore.getState().load();
}

/** Writes all pending changes to disk (e.g. when the app goes to background). */
export async function flushAll() {
  await Promise.all([vocabularyStore.getState().flush(), sessionStore.getState().flush()]);
}
