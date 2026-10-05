import type { Course } from '@/model/types';

import { courseNameFromTitle, recoveredCoursePatches, restorableCourses } from '../restore';

const NOW = '2026-10-05T10:00:00.000Z';
const local: Course = { id: 'C1', name: 'English', language: 'en-GB', createdAt: NOW, spreadsheetId: 'S1' };

describe('restore', () => {
  it('takes the course name from the spreadsheet title', () => {
    expect(courseNameFromTitle('SwipeWise – Spanish')).toBe('Spanish');
    expect(courseNameFromTitle('My words')).toBe('My words'); // renamed in Drive
    expect(courseNameFromTitle('SwipeWise – ')).toBe('Course');
  });

  it('offers spreadsheets no local course uses, keeping the course id, language and date', () => {
    const result = restorableCourses(
      [
        { id: 'S1', name: 'SwipeWise – English', courseId: 'C1', language: 'en-GB' }, // connected here
        { id: 'S2', name: 'SwipeWise – Spanish', courseId: 'C2', language: 'es-ES', createdTime: '2026-01-02T00:00:00Z' },
        { id: 'S3', name: 'SwipeWise – Old', courseId: 'C3', language: 'xx-YY' }, // unknown language
        { id: 'S4', name: 'SwipeWise – Untagged' }, // no course id
      ],
      [local],
      NOW,
    );
    expect(result.map((r) => r.course)).toEqual([
      { id: 'C3', name: 'Old', language: null, createdAt: NOW, spreadsheetId: 'S3' },
      { id: 'C2', name: 'Spanish', language: 'es-ES', createdAt: '2026-01-02T00:00:00Z', spreadsheetId: 'S2' },
    ]);
  });

  it('skips the spreadsheet of a disconnected course and makes names unique', () => {
    const disconnected: Course = { ...local, spreadsheetId: undefined };
    const result = restorableCourses(
      [
        { id: 'S1', name: 'SwipeWise – English', courseId: 'C1' },
        { id: 'S5', name: 'SwipeWise – English', courseId: 'C5' },
        { id: 'S6', name: 'SwipeWise – English', courseId: 'C5' }, // same course twice
      ],
      [disconnected],
      NOW,
    );
    expect(result.map((r) => [r.spreadsheet.id, r.course.name])).toEqual([['S5', 'English (2)']]);
  });

  it('names recovered courses after their spreadsheets', () => {
    const recovered = (id: string, name: string): Course => ({ id, name, language: null, createdAt: NOW, recovered: true });
    const patches = recoveredCoursePatches(
      [local, recovered('C2', 'Recovered course'), recovered('C3', 'Recovered course (2)')],
      [
        { id: 'S2', name: 'SwipeWise – English', courseId: 'C2', language: 'en-US' },
        { id: 'S9', name: 'SwipeWise – Other', courseId: 'C9' },
      ],
    );
    expect(patches).toEqual([
      { courseId: 'C2', patch: { recovered: undefined, name: 'English (2)', language: 'en-US', spreadsheetId: 'S2' } },
      { courseId: 'C3', patch: { recovered: undefined } }, // never connected: keeps its placeholder name
    ]);
  });
});
