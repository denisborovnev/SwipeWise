import type { GoogleApi } from './googleApi';
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
