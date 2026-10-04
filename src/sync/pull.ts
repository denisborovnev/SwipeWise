import type { GoogleApi } from './googleApi';
import { parseTab, type ParsedTab } from './parseTab';
import { tabRange } from './sheetFormat';

/**
 * Reads and parses all list tabs with one batchGet. Tabs starting with "_" are not lists; they are
 * only counted (for the tab limit).
 */
export async function readSpreadsheet(
  api: GoogleApi,
  spreadsheetId: string,
): Promise<{ tabs: ParsedTab[]; otherTabCount: number }> {
  const all = await api.getTabs(spreadsheetId);
  const tabs = all.filter((t) => !t.title.startsWith('_'));
  const values = await api.readValues(
    spreadsheetId,
    tabs.map((t) => tabRange(t.title)),
  );
  return {
    tabs: tabs.map((t, i) =>
      parseTab({ sheetId: t.sheetId, title: t.title, columnCount: t.columnCount, rows: values[i] ?? [] }),
    ),
    otherTabCount: all.length - tabs.length,
  };
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
