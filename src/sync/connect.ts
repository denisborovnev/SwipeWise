import type { Course, VocabularyData } from '@/model/types';

import { APP_PROPERTY, type GoogleApi } from './googleApi';
import { INFO_TAB, INFO_TEXT, spreadsheetTitle, tabRange, tabTitle, tabValues } from './sheetFormat';

export interface ConnectResult {
  spreadsheetId: string;
  /** false = an existing spreadsheet of this course was found (e.g. after reinstalling). */
  created: boolean;
  /** Tab id of every uploaded list. */
  listSheetIds: Record<string, number>;
  /** Words written to the sheet, with the version that was written. */
  uploaded: { id: string; updatedAt: string }[];
}

export const appProperties = (course: Course): Record<string, string> => ({
  [APP_PROPERTY]: '1',
  courseId: course.id,
  ...(course.language ? { language: course.language } : {}),
});

/**
 * Connects a course to Google Sheets: reconnects to the spreadsheet created for it earlier, or creates
 * a new one with a tab per list (header + all words) plus an info tab, tagged with the course id.
 */
export async function connectCourse(api: GoogleApi, course: Course, data: VocabularyData): Promise<ConnectResult> {
  const existing = (await api.listAppSpreadsheets()).find((s) => s.courseId === course.id);
  if (existing) {
    return { spreadsheetId: existing.id, created: false, listSheetIds: {}, uploaded: [] };
  }

  const lists = [...data.lists].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const tabs = lists.map((list) => {
    const words = data.words.filter((w) => w.listId === list.id);
    return { list, words, title: tabTitle(list) };
  });

  const created = await api.createSpreadsheet(spreadsheetTitle(course.name), [
    { title: INFO_TAB, rowCount: INFO_TEXT.length, columnCount: 1 },
    ...tabs.map((t) => ({ title: t.title, rowCount: t.words.length + 1, frozenHeader: true })),
  ]);
  const { spreadsheetId } = created;

  await api.writeValues(spreadsheetId, [
    { range: tabRange(INFO_TAB), values: INFO_TEXT },
    ...tabs.map((t) => ({ range: tabRange(t.title), values: tabValues(t.words) })),
  ]);
  await api.setAppProperties(spreadsheetId, appProperties(course));

  const sheetIdByTitle = new Map(created.tabs.map((t) => [t.title, t.sheetId]));
  const listSheetIds: Record<string, number> = {};
  for (const t of tabs) {
    const sheetId = sheetIdByTitle.get(t.title);
    if (sheetId !== undefined) {
      listSheetIds[t.list.id] = sheetId;
    }
  }
  return {
    spreadsheetId,
    created: true,
    listSheetIds,
    uploaded: tabs.flatMap((t) => t.words.map((w) => ({ id: w.id, updatedAt: w.updatedAt }))),
  };
}
