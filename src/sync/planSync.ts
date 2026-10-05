import type { VocabularyData, Word } from '@/model/types';

import type { TabFix } from './mergePull';
import type { ParsedTab } from './parseTab';
import { columnLetter } from './pull';
import { COLUMNS, type Column, MIN_TAB_ROWS, tabRange, tabRowCount, tabTitle, tabValues, wordRow } from './sheetFormat';

export interface SyncPlan {
  /** spreadsheets.batchUpdate requests (structure + appended rows), applied in order. */
  requests: object[];
  /** Cell values written afterwards (values.batchUpdate). */
  values: { range: string; values: string[][] }[];
  /** What was written, so the local "not pushed yet" marks can be cleared. */
  pushed: PushedChanges;
}

export interface PushedChanges {
  /** Tab id of every list that got a new tab. */
  listSheetIds: Record<string, number>;
  /** Lists whose (local) name was written to the tab title. */
  renamedListIds: string[];
  words: { id: string; updatedAt: string }[];
  deletedWordIds: string[];
  deletedSheetIds: number[];
}

const emptyCell = {};
const textCell = (value: string) => (value ? { userEnteredValue: { stringValue: value } } : emptyCell);

/** A word's values placed in the tab's columns (gaps stay empty). */
function mappedRow(word: Word, columns: Record<Column, number>): object[] {
  const values = wordRow(word);
  const width = Math.max(...Object.values(columns)) + 1;
  const row: object[] = Array.from({ length: width }, () => emptyCell);
  COLUMNS.forEach((column, i) => {
    row[columns[column]] = textCell(values[i]);
  });
  return row;
}

/**
 * Plans one write to the spreadsheet after a pull, from the tabs as read (so row positions are
 * current even if the user sorted or inserted rows) and the merged local data:
 * 1. fixes found by the pull (tab title date, header row, missing columns, Id / Added of rows typed by hand);
 * 2. deleted lists → delete their tabs; renamed lists → rename their tabs;
 * 3. deleted words and words moved to another list → delete their rows (bottom-up);
 * 4. changed words → rewrite their row; new / moved words → append to their list's tab;
 * 5. new lists → new tabs with header and words.
 */
export function planSync(
  data: VocabularyData,
  tabs: ParsedTab[],
  fixes: TabFix[],
  newSheetId: () => number,
): SyncPlan {
  const requests: object[] = [];
  const values: SyncPlan['values'] = [];
  const pushed: PushedChanges = {
    listSheetIds: {},
    renamedListIds: [],
    words: [],
    deletedWordIds: [...(data.deleted?.wordIds ?? [])],
    deletedSheetIds: [...(data.deleted?.sheetIds ?? [])],
  };

  const deletedTabs = new Set(pushed.deletedSheetIds);
  const deletedWords = new Set(pushed.deletedWordIds);
  const fixBySheet = new Map(fixes.map((f) => [f.sheetId, f]));
  const listBySheet = new Map(data.lists.filter((l) => l.sheetId !== undefined).map((l) => [l.sheetId!, l]));
  const wordById = new Map(data.words.map((w) => [w.id, w]));
  const liveTabs = tabs.filter((t) => !deletedTabs.has(t.sheetId));

  // Where every word is in the sheet now (rows typed by hand get their Id from the pull's fixes).
  const location = new Map<string, { sheetId: number; row: number }>();
  for (const tab of liveTabs) {
    const shift = tab.hasHeader ? 0 : 1;
    for (const w of tab.words) {
      if (w.id && !location.has(w.id)) {
        location.set(w.id, { sheetId: tab.sheetId, row: w.row });
      }
    }
    for (const c of fixBySheet.get(tab.sheetId)?.cells ?? []) {
      if (c.column === 'Id') {
        location.set(c.value, { sheetId: tab.sheetId, row: c.row - shift });
      }
    }
  }

  // 2a. Tabs of deleted lists.
  for (const tab of tabs) {
    if (deletedTabs.has(tab.sheetId)) {
      requests.push({ deleteSheet: { sheetId: tab.sheetId } });
    }
  }

  for (const tab of liveTabs) {
    const fix = fixBySheet.get(tab.sheetId);
    const list = listBySheet.get(tab.sheetId);
    const shift = tab.hasHeader ? 0 : 1;

    // 1 + 2b. Title: the date fix from the pull, or the new name of a list renamed locally.
    let title = fix?.newTitle ?? tab.title;
    if (list?.dirty && tabTitle(list) !== title) {
      title = tabTitle(list);
      pushed.renamedListIds.push(list.id);
    } else if (list?.dirty) {
      pushed.renamedListIds.push(list.id);
    }
    if (title !== tab.title) {
      requests.push({ updateSheetProperties: { properties: { sheetId: tab.sheetId, title }, fields: 'title' } });
    }
    if (fix?.insertHeader) {
      requests.push({
        insertDimension: {
          range: { sheetId: tab.sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
          inheritFromBefore: false,
        },
      });
    }
    const neededColumns = Math.max(...Object.values(tab.columns)) + 1;
    if (neededColumns > tab.columnCount) {
      requests.push({
        appendDimension: { sheetId: tab.sheetId, dimension: 'COLUMNS', length: neededColumns - tab.columnCount },
      });
    }

    // 3. Rows to delete: deleted words, and words that now belong to another list (or are gone locally).
    const deleteRows = tab.words
      .filter((w) => {
        if (!w.id || location.get(w.id)?.sheetId !== tab.sheetId || location.get(w.id)?.row !== w.row) {
          return false; // Rows typed by hand / duplicates of an Id are kept.
        }
        const local = wordById.get(w.id);
        return deletedWords.has(w.id) || (local !== undefined && local.listId !== list?.id);
      })
      .map((w) => w.row)
      .sort((a, b) => b - a);
    // Deleting the last word rows would leave only the frozen header, which Sheets refuses – add an empty
    // row first (appended at the end, so the row numbers of the deletions stay the same).
    const rowsAfter = (tab.rowCount ?? Infinity) + (fix?.insertHeader ? 1 : 0) - deleteRows.length;
    if (deleteRows.length > 0 && rowsAfter < MIN_TAB_ROWS) {
      requests.push({
        appendDimension: { sheetId: tab.sheetId, dimension: 'ROWS', length: MIN_TAB_ROWS - rowsAfter },
      });
    }
    for (const row of deleteRows) {
      requests.push({
        deleteDimension: {
          range: { sheetId: tab.sheetId, dimension: 'ROWS', startIndex: row + shift, endIndex: row + shift + 1 },
        },
      });
    }
    // Row index after the header was inserted and the rows above were deleted.
    const finalRow = (row: number) => row + shift - deleteRows.filter((d) => d < row).length;
    const cell = (column: Column, row: number) =>
      `${tabRange(title)}!${columnLetter(tab.columns[column])}${row + 1}`;

    // 1. Header cells and the Id / Added cells found by the pull.
    for (const column of fix?.headerColumns ?? []) {
      values.push({ range: `${tabRange(title)}!${columnLetter(tab.columns[column])}1`, values: [[column]] });
    }
    for (const c of fix?.cells ?? []) {
      values.push({ range: cell(c.column, finalRow(c.row - shift)), values: [[c.value]] });
    }

    // 4. Changed words of this list: rewrite their row where it is, append the ones not in this tab.
    if (!list) {
      continue;
    }
    const toAppend: Word[] = [];
    for (const word of data.words) {
      if (word.listId !== list.id || !word.dirty) {
        continue;
      }
      const at = location.get(word.id);
      if (at && at.sheetId === tab.sheetId) {
        const row = finalRow(at.row);
        wordRow(word).forEach((value, i) => values.push({ range: cell(COLUMNS[i], row), values: [[value]] }));
      } else {
        toAppend.push(word);
      }
      pushed.words.push({ id: word.id, updatedAt: word.updatedAt });
    }
    if (toAppend.length > 0) {
      requests.push({
        appendCells: {
          sheetId: tab.sheetId,
          rows: [...toAppend]
            .sort((a, b) => a.addedAt.localeCompare(b.addedAt))
            .map((w) => ({ values: mappedRow(w, tab.columns) })),
          fields: 'userEnteredValue',
        },
      });
    }
  }

  // 5. Lists without a tab: create one with the header and all their words.
  for (const list of data.lists) {
    if (list.sheetId !== undefined && liveTabs.some((t) => t.sheetId === list.sheetId)) {
      continue;
    }
    const sheetId = newSheetId();
    const words = data.words.filter((w) => w.listId === list.id);
    const title = tabTitle(list);
    requests.push({
      addSheet: {
        properties: {
          sheetId,
          title,
          gridProperties: { rowCount: tabRowCount(words.length), columnCount: COLUMNS.length, frozenRowCount: 1 },
        },
      },
    });
    values.push({ range: tabRange(title), values: tabValues(words) });
    pushed.listSheetIds[list.id] = sheetId;
    pushed.renamedListIds.push(list.id);
    for (const w of words) {
      pushed.words.push({ id: w.id, updatedAt: w.updatedAt });
    }
  }

  return { requests, values, pushed };
}

/** After a successful write: clears the "not pushed yet" marks of what was written. */
export function markPushed(data: VocabularyData, pushed: PushedChanges): VocabularyData {
  const written = new Map(pushed.words.map((w) => [w.id, w.updatedAt]));
  const renamed = new Set(pushed.renamedListIds);
  const deletedWords = new Set(pushed.deletedWordIds);
  const deletedTabs = new Set(pushed.deletedSheetIds);
  const deleted = data.deleted && {
    wordIds: data.deleted.wordIds.filter((id) => !deletedWords.has(id)),
    sheetIds: data.deleted.sheetIds.filter((id) => !deletedTabs.has(id)),
  };
  return {
    ...data,
    lists: data.lists.map((l) => {
      const sheetId = pushed.listSheetIds[l.id] ?? l.sheetId;
      return renamed.has(l.id) || sheetId !== l.sheetId ? { ...l, sheetId, dirty: false } : l;
    }),
    words: data.words.map((w) =>
      w.dirty && written.get(w.id) === w.updatedAt ? { ...w, dirty: false, contentDirty: false } : w,
    ),
    deleted: deleted && (deleted.wordIds.length || deleted.sheetIds.length) ? deleted : undefined,
  };
}
