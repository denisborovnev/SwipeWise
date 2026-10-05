import type { RememberStatus } from '@/model/types';

import { COLUMNS, type Column, parseTabTitle } from './sheetFormat';

/** A tab as read from the spreadsheet. */
export interface SheetTab {
  sheetId: number;
  title: string;
  columnCount: number;
  /** Rows of the tab's grid (incl. empty ones); unknown = undefined. */
  rowCount?: number;
  /** Cell values (formatted), trailing empty cells / rows may be missing. */
  rows: string[][];
}

export interface ParsedRow {
  /** 0-based row index in the tab as read (before any fixes). */
  row: number;
  id: string | null;
  front: string;
  back: string;
  examples: string[];
  addedAt: string | null;
  lastRevisedAt: string | null;
  remembered: RememberStatus;
}

export interface ParsedTab {
  sheetId: number;
  title: string;
  /** List name and creation date from the title (date null = no date in the title). */
  name: string;
  createdAt: string | null;
  /** Row 1 is a header (contains Front and Back). */
  hasHeader: boolean;
  /** 0-based column of every column, incl. the ones still to be added. */
  columns: Record<Column, number>;
  /** Columns the header doesn't have yet (all of them when there is no header). */
  missingColumns: Column[];
  columnCount: number;
  /** Rows of the tab's grid (incl. empty ones), if known. */
  rowCount?: number;
  words: ParsedRow[];
  /** Rows with only Front or only Back – not used until completed. */
  incompleteRows: number;
}

const cell = (row: string[], col: number) => (row[col] ?? '').trim();

/** Layout of a tab without header: A = Front, B = Back, C = Examples, then the system columns. */
const DEFAULT_COLUMNS = Object.fromEntries(COLUMNS.map((c, i) => [c, i])) as Record<Column, number>;

const pad = (n: string) => n.padStart(2, '0');
const SHEET_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/** "2026-10-04 20:15" / "2026-10-04" (local time) or anything Date can parse; null if empty / invalid. */
export function parseSheetDate(value: string): string | null {
  const v = value.trim();
  if (!v) {
    return null;
  }
  const m = SHEET_DATE.exec(v);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
    return Number.isNaN(d.getTime()) || pad(m[2]) !== pad(String(d.getMonth() + 1)) ? null : d.toISOString();
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function parseRemembered(value: string): RememberStatus {
  const v = value.trim().toLowerCase();
  return v === 'yes' ? 'yes' : v === 'no' ? 'no' : null;
}

/**
 * Reads a list tab: detects the header (row 1 with Front and Back), maps columns by name, and reads
 * the words. Rows typed by hand may have only Front / Back / Examples; their system values are null.
 */
export function parseTab(tab: SheetTab): ParsedTab {
  const { name, createdAt } = parseTabTitle(tab.title);
  const first = tab.rows[0] ?? [];
  const headerNames = first.map((c) => c.trim().toLowerCase());
  const hasHeader = headerNames.includes('front') && headerNames.includes('back');

  let columns: Record<Column, number>;
  let missingColumns: Column[];
  if (hasHeader) {
    columns = {} as Record<Column, number>;
    missingColumns = [];
    let next = headerNames.reduce((last, c, i) => (c ? i : last), -1) + 1;
    for (const column of COLUMNS) {
      const index = headerNames.indexOf(column.toLowerCase());
      if (index >= 0) {
        columns[column] = index;
      } else {
        columns[column] = next++;
        missingColumns.push(column);
      }
    }
  } else {
    columns = { ...DEFAULT_COLUMNS };
    missingColumns = [...COLUMNS];
  }

  const words: ParsedRow[] = [];
  let incompleteRows = 0;
  tab.rows.forEach((values, row) => {
    if (hasHeader && row === 0) {
      return;
    }
    const front = cell(values, columns.Front);
    const back = cell(values, columns.Back);
    if (!front || !back) {
      if (front || back) {
        incompleteRows++;
      }
      return;
    }
    words.push({
      row,
      id: cell(values, columns.Id) || null,
      front,
      back,
      examples: (values[columns.Examples] ?? '')
        .split('\n')
        .map((e) => e.trim())
        .filter(Boolean),
      addedAt: parseSheetDate(cell(values, columns.Added)),
      lastRevisedAt: parseSheetDate(cell(values, columns.LastRevised)),
      remembered: parseRemembered(cell(values, columns.Remembered)),
    });
  });

  return {
    sheetId: tab.sheetId,
    title: tab.title,
    name,
    createdAt,
    hasHeader,
    columns,
    missingColumns,
    columnCount: tab.columnCount,
    rowCount: tab.rowCount,
    words,
    incompleteRows,
  };
}
