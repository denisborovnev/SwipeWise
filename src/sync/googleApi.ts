import type { GoogleRequest } from './googleClient';
import { COLUMNS } from './sheetFormat';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';

/** Marks spreadsheets created by SwipeWise (Drive appProperties). */
export const APP_PROPERTY = 'swipewise';

export interface AppSpreadsheet {
  id: string;
  name: string;
  courseId?: string;
  language?: string;
  /** When the spreadsheet was created (ISO). */
  createdTime?: string;
}

export interface NewTab {
  title: string;
  /** Rows to reserve, incl. the header. */
  rowCount: number;
  columnCount?: number;
  /** Freeze the first row (the header). */
  frozenHeader?: boolean;
}

export interface CreatedSpreadsheet {
  spreadsheetId: string;
  tabs: { title: string; sheetId: number }[];
}

/** The Google Sheets / Drive calls the app uses. */
export interface GoogleApi {
  /** Spreadsheets created by the app (with drive.file, Drive only returns files the app created). */
  listAppSpreadsheets(): Promise<AppSpreadsheet[]>;
  createSpreadsheet(title: string, tabs: NewTab[]): Promise<CreatedSpreadsheet>;
  writeValues(spreadsheetId: string, data: { range: string; values: string[][] }[]): Promise<void>;
  setAppProperties(fileId: string, properties: Record<string, string>): Promise<void>;
  renameFile(fileId: string, name: string): Promise<void>;
  /** Drive's version number of a file; it grows with every change (a cheap "has it changed?" check). */
  getFileVersion(fileId: string): Promise<string>;
  /** Tabs of a spreadsheet (id, title, size). */
  getTabs(spreadsheetId: string): Promise<TabInfo[]>;
  /** Formatted values of several ranges, in the same order (rows / cells may be missing at the end). */
  readValues(spreadsheetId: string, ranges: string[]): Promise<string[][][]>;
  /** spreadsheets.batchUpdate (structure changes: rename / insert rows / add columns…). */
  batchUpdate(spreadsheetId: string, requests: object[]): Promise<void>;
}

export interface TabInfo {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

interface SheetProperties {
  sheetId: number;
  title: string;
}

export function createGoogleApi(request: GoogleRequest): GoogleApi {
  return {
    async listAppSpreadsheets() {
      const q = encodeURIComponent(
        `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and ` +
          `appProperties has { key='${APP_PROPERTY}' and value='1' }`,
      );
      const fields = encodeURIComponent('files(id,name,createdTime,appProperties)');
      const res = await request<{
        files: { id: string; name: string; createdTime?: string; appProperties?: Record<string, string> }[];
      }>(
        `${DRIVE}?q=${q}&fields=${fields}&pageSize=100`,
      );
      return res.files.map((f) => ({
        id: f.id,
        name: f.name,
        courseId: f.appProperties?.courseId,
        language: f.appProperties?.language,
        createdTime: f.createdTime,
      }));
    },

    async createSpreadsheet(title, tabs) {
      const res = await request<{ spreadsheetId: string; sheets: { properties: SheetProperties }[] }>(SHEETS, {
        method: 'POST',
        body: {
          properties: { title },
          sheets: tabs.map((t) => ({
            properties: {
              title: t.title,
              gridProperties: {
                rowCount: Math.max(t.rowCount, 1),
                columnCount: t.columnCount ?? COLUMNS.length,
                frozenRowCount: t.frozenHeader ? 1 : 0,
              },
            },
          })),
        },
      });
      return {
        spreadsheetId: res.spreadsheetId,
        tabs: res.sheets.map((s) => ({ title: s.properties.title, sheetId: s.properties.sheetId })),
      };
    },

    async writeValues(spreadsheetId, data) {
      if (data.length === 0) {
        return;
      }
      await request(`${SHEETS}/${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        body: { valueInputOption: 'RAW', data },
      });
    },

    async setAppProperties(fileId, properties) {
      await request(`${DRIVE}/${fileId}?fields=id`, { method: 'PATCH', body: { appProperties: properties } });
    },

    async renameFile(fileId, name) {
      await request(`${DRIVE}/${fileId}?fields=id`, { method: 'PATCH', body: { name } });
    },

    async getFileVersion(fileId) {
      const res = await request<{ version: string }>(`${DRIVE}/${fileId}?fields=version`);
      return String(res.version);
    },

    async getTabs(spreadsheetId) {
      const fields = encodeURIComponent('sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))');
      const res = await request<{
        sheets: { properties: SheetProperties & { gridProperties?: { rowCount?: number; columnCount?: number } } }[];
      }>(`${SHEETS}/${spreadsheetId}?fields=${fields}`);
      return res.sheets.map(({ properties: p }) => ({
        sheetId: p.sheetId ?? 0,
        title: p.title,
        rowCount: p.gridProperties?.rowCount ?? 0,
        columnCount: p.gridProperties?.columnCount ?? 0,
      }));
    },

    async readValues(spreadsheetId, ranges) {
      if (ranges.length === 0) {
        return [];
      }
      const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
      const res = await request<{ valueRanges?: { values?: unknown[][] }[] }>(
        `${SHEETS}/${spreadsheetId}/values:batchGet?${query}&valueRenderOption=FORMATTED_VALUE`,
      );
      return ranges.map((_, i) => (res.valueRanges?.[i]?.values ?? []).map((row) => row.map((c) => String(c ?? ''))));
    },

    async batchUpdate(spreadsheetId, requests) {
      if (requests.length > 0) {
        await request(`${SHEETS}/${spreadsheetId}:batchUpdate`, { method: 'POST', body: { requests } });
      }
    },
  };
}
