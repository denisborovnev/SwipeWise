/** Answer given for a word the last time it was revised; null = never revised. */
export type RememberStatus = 'yes' | 'no' | null;

export type Answer = 'yes' | 'no';

export interface Word {
  id: string;
  listId: string;
  /** Prompt side, e.g. "машина". */
  front: string;
  /** Answer side, e.g. "car". */
  back: string;
  examples: string[];
  /** ISO timestamp. */
  addedAt: string;
  /** ISO timestamp; null = never revised. */
  lastRevisedAt: string | null;
  remembered: RememberStatus;
  /** Has local changes that are not pushed to the spreadsheet yet. */
  dirty: boolean;
  /** ISO timestamp of the last local modification. */
  updatedAt: string;
}

export interface WordList {
  id: string;
  /** Also the spreadsheet tab name once synced. */
  name: string;
  /** Google Sheets tab id once synced. */
  sheetId?: number;
  createdAt: string;
}

export interface NewWordInput {
  front: string;
  back: string;
  examples?: string[];
}

export type WordPatch = Partial<Pick<Word, 'front' | 'back' | 'examples' | 'listId'>>;

/** Contents of words.json. */
export interface VocabularyData {
  version: 1;
  lists: WordList[];
  words: Word[];
}

export interface SessionFilter {
  listId: string | 'all';
  /** ISO date; applies to a single list or to all lists. */
  addedSince?: string;
  /** ISO date; also matches never-revised words. */
  notRevisedSince?: string;
  /** Only words whose last answer was "no". */
  onlyNotRemembered?: boolean;
  shuffle: boolean;
}

export interface Session {
  id: string;
  filter: SessionFilter;
  /** Frozen when the session is created. */
  wordIds: string[];
  currentIndex: number;
  results: Record<string, Answer>;
  startedAt: string;
  finishedAt?: string;
}

export interface Settings {
  version: 1;
  spreadsheetId?: string;
  lastSyncAt?: string;
  lastFilter?: SessionFilter;
}
