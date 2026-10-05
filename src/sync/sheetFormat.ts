import type { RememberStatus, Word, WordList } from '@/model/types';
import { formatDate } from '@/utils/format';

/**
 * How lists and words are stored in a spreadsheet: one tab per list named "<name> - YYYY-MM-DD",
 * a header row and one row per word. Pure functions, shared by upload and (later) pull.
 */

export const COLUMNS = ['Front', 'Back', 'Examples', 'Added', 'LastRevised', 'Remembered', 'Id'] as const;
export type Column = (typeof COLUMNS)[number];

/** Tab with a short explanation; tabs starting with "_" are not word lists. */
export const INFO_TAB = '_SwipeWise';

/**
 * Rows of a new list tab: the header + one per word, but at least 2 – the header row is frozen, and Sheets
 * doesn't allow freezing every row of a tab (an empty list would be just the header).
 */
export const tabRowCount = (wordCount: number) => Math.max(wordCount + 1, 2);

/** Rows a list tab must keep: the frozen header + at least one more (see tabRowCount). */
export const MIN_TAB_ROWS = 2;
export const INFO_TEXT = [
  ['This spreadsheet is managed by the SwipeWise app.'],
  ['Every other tab is a word list, named "<list name> - YYYY-MM-DD" (the date the list was created).'],
  ['To add words by hand, fill in Front, Back and optionally Examples (one per line); the app fills in the rest.'],
  ['Tabs whose names start with "_" (like this one) are ignored by the app.'],
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date, e.g. "2026-10-04". */
export function sheetDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local date and time as written to the sheet, e.g. "2026-10-04 20:15". */
export function sheetDateTime(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  return `${sheetDay(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * "Travel - 2026-10-04". A list named after its own date (the default name of a new list) gets
 * just the date: "2026-10-04".
 */
export function tabTitle(list: Pick<WordList, 'name' | 'createdAt'>): string {
  const day = sheetDay(list.createdAt);
  return list.name === formatDate(list.createdAt) ? day : `${list.name} - ${day}`;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const WITH_DAY = /^(.*\S)\s+-\s+(\d{4}-\d{2}-\d{2})$/;

/** Local midnight of a "YYYY-MM-DD" day as ISO, or null if it isn't a valid date. */
export function parseSheetDay(day: string): string | null {
  const m = DAY.exec(day.trim());
  if (!m) {
    return null;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d.toISOString() : null;
}

/**
 * Splits a tab title into the list name and creation date (null when the title has no valid date,
 * e.g. a tab created by hand). A title that is only a date is a list named after that date.
 */
export function parseTabTitle(title: string): { name: string; createdAt: string | null } {
  const trimmed = title.trim();
  const onlyDay = parseSheetDay(trimmed);
  if (onlyDay) {
    return { name: formatDate(onlyDay), createdAt: onlyDay };
  }
  const m = WITH_DAY.exec(trimmed);
  const createdAt = m ? parseSheetDay(m[2]) : null;
  return createdAt && m ? { name: m[1], createdAt } : { name: trimmed, createdAt: null };
}

const remembered = (r: RememberStatus) => r ?? '';

/** One row per word, in COLUMNS order. */
export function wordRow(word: Word): string[] {
  return [
    word.front,
    word.back,
    word.examples.join('\n'),
    sheetDateTime(word.addedAt),
    sheetDateTime(word.lastRevisedAt),
    remembered(word.remembered),
    word.id,
  ];
}

/** Header + rows of a list's tab, oldest words first (the order they were added). */
export function tabValues(words: Word[]): string[][] {
  const sorted = [...words].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  return [[...COLUMNS], ...sorted.map(wordRow)];
}

/** A1 range of a whole tab; quotes are doubled as Sheets requires. */
export function tabRange(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

export const spreadsheetUrl = (spreadsheetId: string) => `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

/** Spreadsheet file name of a course. */
export const spreadsheetTitle = (courseName: string) => `SwipeWise – ${courseName}`;
