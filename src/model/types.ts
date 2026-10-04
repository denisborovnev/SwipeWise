/** Everything studied for one language: its own word lists, sessions and spreadsheet. */
export interface Course {
  id: string;
  /** Defaults to the language name, e.g. "English (UK)". */
  name: string;
  /** BCP-47 code of the language being learned, e.g. "en-GB"; null until the user picks it
   *  (only for data created before courses existed). */
  language: string | null;
  createdAt: string;
  /** Google spreadsheet of the course once connected. */
  spreadsheetId?: string;
  /** When the course was last synced with its spreadsheet. */
  lastSyncAt?: string;
}

/** Contents of courses.json. */
export interface CoursesData {
  version: 1;
  courses: Course[];
  /** The course the app shows; null only when there are no courses. */
  activeCourseId: string | null;
}

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
  /** The text or list (not only the review values) changed locally and isn't pushed yet; then the
   *  local text wins over the sheet when pulling. */
  contentDirty?: boolean;
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
  /** Renamed locally and not pushed yet (the local name wins over the tab title when pulling). */
  dirty?: boolean;
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
  /** Deleted locally but maybe still in the spreadsheet: skipped when pulling, removed by the next push. */
  deleted?: { wordIds: string[]; sheetIds: number[] };
}

/**
 * A date bound for filters. Relative bounds ("last 7 days") are stored as such, so a remembered
 * filter still means "last 7 days" next week. `days: 0` = since the start of today.
 */
export type DateFilter = { days: number } | { date: string };

export interface SessionFilter {
  /** Lists to practise; empty = all words. */
  listIds: string[];
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

/** Settings of one course (settings.json in the course folder). */
export interface Settings {
  version: 1;
  spreadsheetId?: string;
  lastSyncAt?: string;
  lastFilter?: SessionFilter;
}
