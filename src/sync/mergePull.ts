import { uniqueListName } from '@/model/lists';
import type { VocabularyData, Word, WordList } from '@/model/types';

import type { ParsedRow, ParsedTab } from './parseTab';
import { type Column, sheetDateTime, tabTitle } from './sheetFormat';

/** What has to be written back to a tab after a pull (header, system cells, date in the title). */
export interface TabFix {
  sheetId: number;
  /** Title as read. */
  title: string;
  /** New title (date suffix added / normalised); undefined = unchanged. */
  newTitle?: string;
  /** Insert a header row above the words (tab had none). */
  insertHeader: boolean;
  /** Header cells to write (columns missing from the header). */
  headerColumns: Column[];
  /** 0-based column of every column. */
  columns: Record<Column, number>;
  /** Columns the tab needs (to grow narrow tabs) and has. */
  columnCount: number;
  tabColumnCount: number;
  /** Cells to write; `row` is 0-based in the tab *after* the header row was inserted. */
  cells: { row: number; column: Column; value: string }[];
}

export interface PullResult {
  data: VocabularyData;
  fixes: TabFix[];
  stats: { addedWords: number; updatedWords: number; removedWords: number; addedLists: number; removedLists: number };
}

const isNewer = (a: string | null, b: string | null) => a !== null && (b === null || a > b);

/**
 * Merges the spreadsheet into the local data (sheet = source of truth for synced, unchanged items):
 * - lists are matched by tab id; new tabs become lists, deleted tabs remove their (synced) lists;
 * - words are matched by Id; rows typed by hand (no Id) get an Id and Added date, which are written
 *   back – until then they are matched by list + Front + Back so they aren't added twice;
 * - text: the sheet wins unless the word was edited locally (contentDirty); review values: the newer
 *   LastRevised wins;
 * - local changes that aren't pushed yet (new / edited / deleted words and lists) are kept.
 */
export function mergePull(
  local: VocabularyData,
  tabs: ParsedTab[],
  now: string,
  newId: () => string,
): PullResult {
  const stats = { addedWords: 0, updatedWords: 0, removedWords: 0, addedLists: 0, removedLists: 0 };
  const deletedWords = new Set(local.deleted?.wordIds ?? []);
  const deletedTabs = new Set(local.deleted?.sheetIds ?? []);
  const listBySheet = new Map(local.lists.filter((l) => l.sheetId !== undefined).map((l) => [l.sheetId!, l]));
  const wordById = new Map(local.words.map((w) => [w.id, w]));

  const lists: WordList[] = [];
  const words: Word[] = [];
  const seenWords = new Set<string>();
  const fixes: TabFix[] = [];

  // Keep local-only lists first so names from the sheet are made unique against them.
  const localOnly = local.lists.filter((l) => l.sheetId === undefined);
  const tabSheetIds = new Set(tabs.map((t) => t.sheetId));

  for (const tab of tabs) {
    if (deletedTabs.has(tab.sheetId)) {
      continue;
    }
    const existing = listBySheet.get(tab.sheetId);
    const taken = [...localOnly, ...lists];
    let list: WordList;
    if (existing) {
      const name = existing.dirty ? existing.name : uniqueListName(tab.name, taken);
      list = { ...existing, name, createdAt: tab.createdAt ?? existing.createdAt };
    } else {
      list = { id: newId(), name: uniqueListName(tab.name, taken), createdAt: tab.createdAt ?? now, sheetId: tab.sheetId };
      stats.addedLists++;
    }
    lists.push(list);

    const shift = tab.hasHeader ? 0 : 1;
    const cells: TabFix['cells'] = [];

    const mergeRow = (row: ParsedRow, listId: string): Word | null => {
      let id = row.id;
      if (id && (deletedWords.has(id) || seenWords.has(id))) {
        if (deletedWords.has(id)) {
          return null; // Deleted locally; the push removes the row.
        }
        id = null; // The same Id twice (row copied by hand): treat the copy as a new word.
      }
      // Rows typed by hand: reuse the word created for the same row by an earlier pull whose Id
      // couldn't be written.
      const match =
        (id ? wordById.get(id) : undefined) ??
        (!row.id
          ? local.words.find(
              (w) => !seenWords.has(w.id) && w.listId === listId && w.front === row.front && w.back === row.back,
            )
          : undefined);

      if (!id || !match) {
        const wordId = id ?? match?.id ?? newId();
        if (!row.id || id !== row.id) {
          cells.push({ row: row.row + shift, column: 'Id', value: wordId });
        }
        const addedAt = row.addedAt ?? match?.addedAt ?? now;
        if (!row.addedAt) {
          cells.push({ row: row.row + shift, column: 'Added', value: sheetDateTime(addedAt) });
        }
        seenWords.add(wordId);
        if (match) {
          return match;
        }
        stats.addedWords++;
        return {
          id: wordId,
          listId,
          front: row.front,
          back: row.back,
          examples: row.examples,
          addedAt,
          lastRevisedAt: row.lastRevisedAt,
          remembered: row.remembered,
          dirty: false,
          updatedAt: now,
        };
      }

      seenWords.add(match.id);
      const merged: Word = { ...match };
      if (!match.contentDirty) {
        merged.front = row.front;
        merged.back = row.back;
        merged.examples = row.examples;
        merged.listId = listId;
      }
      if (isNewer(row.lastRevisedAt, match.lastRevisedAt)) {
        merged.lastRevisedAt = row.lastRevisedAt;
        merged.remembered = row.remembered;
      }
      const changed =
        merged.front !== match.front ||
        merged.back !== match.back ||
        merged.listId !== match.listId ||
        merged.examples.join('\n') !== match.examples.join('\n') ||
        merged.lastRevisedAt !== match.lastRevisedAt;
      if (changed) {
        stats.updatedWords++;
        merged.updatedAt = now;
      }
      return changed ? merged : match;
    };

    for (const row of tab.words) {
      const word = mergeRow(row, list.id);
      if (word) {
        words.push(word);
      }
    }

    // A renamed local list (not pushed yet) keeps its tab title until the push.
    const expectedTitle = list.dirty ? tab.title : tabTitle(list);
    const newTitle = expectedTitle !== tab.title ? expectedTitle : undefined;
    if (newTitle || !tab.hasHeader || tab.missingColumns.length > 0 || cells.length > 0) {
      fixes.push({
        sheetId: tab.sheetId,
        title: tab.title,
        newTitle,
        insertHeader: !tab.hasHeader,
        headerColumns: tab.missingColumns,
        columns: tab.columns,
        columnCount: Math.max(...Object.values(tab.columns)) + 1,
        tabColumnCount: tab.columnCount,
        cells,
      });
    }
  }

  // Lists whose tab is gone were deleted in the sheet – unless they have local changes to push.
  for (const list of local.lists) {
    if (list.sheetId === undefined) {
      lists.push(list);
    } else if (!tabSheetIds.has(list.sheetId) && !deletedTabs.has(list.sheetId)) {
      const hasChanges = local.words.some((w) => w.listId === list.id && w.contentDirty);
      if (hasChanges) {
        lists.push({ ...list, sheetId: undefined }); // The push creates a new tab for it.
      } else {
        stats.removedLists++;
      }
    }
  }

  // Words not in the sheet: deleted there if they were synced; kept if they are new / edited locally.
  const listIds = new Set(lists.map((l) => l.id));
  for (const word of local.words) {
    if (seenWords.has(word.id) || !listIds.has(word.listId)) {
      if (!seenWords.has(word.id)) {
        stats.removedWords++;
      }
      continue;
    }
    const list = lists.find((l) => l.id === word.listId);
    const listSynced = list?.sheetId !== undefined && tabSheetIds.has(list.sheetId);
    if (!listSynced || word.contentDirty) {
      words.push(word);
    } else {
      stats.removedWords++;
    }
  }

  return { data: { ...local, lists, words }, fixes, stats };
}

