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

/**
 * A date bound for filters. Relative bounds ("last 7 days") are stored as such, so a remembered
 * filter still means "last 7 days" next week. `days: 0` = since the start of today.
 */
export type DateFilter = { days: number } | { date: string };

export interface SessionFilter {
  listId: string | 'all';
  /** Words added on or after this day; applies to a single list or to all lists. */
  addedSince?: DateFilter;
  /** Words not revised since this day (never-revised words always match). */
  notRevisedSince?: DateFilter;
  /** Only words whose last answer was "no". */
  onlyNotRemembered?: boolean;
}

/** The review values of a word before it was answered, so the answer can be undone. */
export interface ReviewState {
  lastRevisedAt: string | null;
  remembered: RememberStatus;
}

export interface SessionStep {
  wordId: string;
  answer: Answer;
  previous: ReviewState;
}

export interface Session {
  id: string;
  filter: SessionFilter;
  /** 'missed' = "repeat the words I missed" round of an earlier session with this filter. */
  kind?: 'missed';
  /** Frozen (and shuffled) when the session is created; only "New session" picks a new set of words.
   *  Restarting keeps the same words but shuffles them again. */
  wordIds: string[];
  /** Index into wordIds of the card being shown; === wordIds.length when finished. */
  currentIndex: number;
  /** Answers in order, used for results and undo. */
  history: SessionStep[];
  startedAt: string;
  finishedAt?: string;
}

export interface Settings {
  version: 1;
  spreadsheetId?: string;
  lastSyncAt?: string;
  lastFilter?: SessionFilter;
}
