import type { GoogleApi } from './googleApi';
import type { TabFix } from './mergePull';
import { parseTab, type ParsedTab } from './parseTab';
import { tabRange } from './sheetFormat';

/** Reads and parses all list tabs (tabs starting with "_" are ignored) with one batchGet. */
export async function readSpreadsheet(api: GoogleApi, spreadsheetId: string): Promise<ParsedTab[]> {
  const tabs = (await api.getTabs(spreadsheetId)).filter((t) => !t.title.startsWith('_'));
  const values = await api.readValues(
    spreadsheetId,
    tabs.map((t) => tabRange(t.title)),
  );
  return tabs.map((t, i) =>
    parseTab({ sheetId: t.sheetId, title: t.title, columnCount: t.columnCount, rows: values[i] ?? [] }),
  );
}

/** Column letters: 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/**
 * The requests that apply the fixes found while pulling: structure first (rename tab, insert the
 * header row, add columns to narrow tabs), then the header / Id / Added cells.
 */
export function fixRequests(fixes: TabFix[]): {
  requests: object[];
  values: { range: string; values: string[][] }[];
} {
  const requests: object[] = [];
  const values: { range: string; values: string[][] }[] = [];
  for (const fix of fixes) {
    const title = fix.newTitle ?? fix.title;
    if (fix.newTitle) {
      requests.push({
        updateSheetProperties: { properties: { sheetId: fix.sheetId, title: fix.newTitle }, fields: 'title' },
      });
    }
    if (fix.insertHeader) {
      requests.push({
        insertDimension: {
          range: { sheetId: fix.sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
          inheritFromBefore: false,
        },
      });
    }
    if (fix.columnCount > fix.tabColumnCount) {
      requests.push({
        appendDimension: { sheetId: fix.sheetId, dimension: 'COLUMNS', length: fix.columnCount - fix.tabColumnCount },
      });
    }
    const cell = (column: number, row: number) => `${tabRange(title)}!${columnLetter(column)}${row + 1}`;
    for (const column of fix.headerColumns) {
      values.push({ range: cell(fix.columns[column], 0), values: [[column]] });
    }
    for (const c of fix.cells) {
      values.push({ range: cell(fix.columns[c.column], c.row), values: [[c.value]] });
    }
  }
  return { requests, values };
}

export async function writeFixes(api: GoogleApi, spreadsheetId: string, fixes: TabFix[]): Promise<void> {
  const { requests, values } = fixRequests(fixes);
  await api.batchUpdate(spreadsheetId, requests);
  await api.writeValues(spreadsheetId, values);
}
