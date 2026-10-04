import { emptyVocabulary } from '@/model/vocabulary';
import type { Session, Settings, VocabularyData } from '@/model/types';

import type { StorageBackend } from './backend';

export const FILES = {
  vocabulary: 'words.json',
  /** Recent sessions, most recently used first. */
  sessions: 'sessions.json',
  /** Single session saved by earlier versions; migrated to sessions.json. */
  legacySession: 'session.json',
  settings: 'settings.json',
} as const;

export interface Repository {
  /** Returns null when nothing has been saved yet (first launch). */
  loadVocabulary(): Promise<VocabularyData | null>;
  saveVocabulary(data: VocabularyData): Promise<void>;
  /** Recent sessions, most recently used first (empty if none). */
  loadRecentSessions(): Promise<Session[]>;
  saveRecentSessions(sessions: Session[]): Promise<void>;
  loadSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
}

async function readJson<T>(backend: StorageBackend, name: string): Promise<T | null> {
  const text = await backend.readText(name);
  if (text === null) {
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    // A corrupt file must not crash the app; keep a copy for diagnostics and start fresh.
    console.warn(`Could not parse ${name}, ignoring it`, e);
    await backend.writeTextAtomic(`${name}.corrupt`, text);
    return null;
  }
}

const writeJson = (backend: StorageBackend, name: string, value: unknown) =>
  backend.writeTextAtomic(name, JSON.stringify(value));

export function createRepository(backend: StorageBackend): Repository {
  return {
    async loadVocabulary() {
      const data = await readJson<VocabularyData>(backend, FILES.vocabulary);
      if (!data) {
        return null;
      }
      return { ...emptyVocabulary(), ...data };
    },
    saveVocabulary: (data) => writeJson(backend, FILES.vocabulary, data),

    async loadRecentSessions() {
      const data = await readJson<{ version: 1; sessions: Session[] }>(backend, FILES.sessions);
      if (data) {
        return data.sessions;
      }
      const legacy = await readJson<Session>(backend, FILES.legacySession);
      return legacy ? [legacy] : [];
    },
    async saveRecentSessions(sessions) {
      await writeJson(backend, FILES.sessions, { version: 1, sessions });
      await backend.delete(FILES.legacySession);
    },

    async loadSettings() {
      return (await readJson<Settings>(backend, FILES.settings)) ?? { version: 1 };
    },
    saveSettings: (settings) => writeJson(backend, FILES.settings, settings),
  };
}
