import { findLanguage } from '@/model/languages';
import { uniqueListName } from '@/model/lists';
import type { Course } from '@/model/types';
import { MAX_COURSE_NAME } from '@/model/validation';

import type { AppSpreadsheet } from './googleApi';
import { spreadsheetTitle } from './sheetFormat';

const TITLE_PREFIX = spreadsheetTitle('');

/** A spreadsheet in Drive that can be restored as a course, with the course it becomes. */
export interface RestorableCourse {
  spreadsheet: AppSpreadsheet;
  course: Course;
}

/** Course name from a spreadsheet title ("SwipeWise – English" → "English"; renamed files keep their name). */
export function courseNameFromTitle(title: string): string {
  const name = (title.startsWith(TITLE_PREFIX) ? title.slice(TITLE_PREFIX.length) : title).trim();
  return (name || 'Course').slice(0, MAX_COURSE_NAME).trim();
}

/**
 * App-created spreadsheets that no course on this phone uses (neither by spreadsheet nor by course id –
 * a disconnected course gets its spreadsheet back with Connect), as the courses they would become.
 * The course keeps the id it had, so its spreadsheet stays tagged with it; names are made unique.
 */
export function restorableCourses(spreadsheets: AppSpreadsheet[], courses: Course[], now: string): RestorableCourse[] {
  const usedSheets = new Set(courses.map((c) => c.spreadsheetId).filter(Boolean));
  const usedIds = new Set(courses.map((c) => c.id));
  const taken: { name: string }[] = [...courses];
  const result: RestorableCourse[] = [];
  const sorted = [...spreadsheets].sort((a, b) => a.name.localeCompare(b.name));
  for (const spreadsheet of sorted) {
    const id = spreadsheet.courseId;
    if (!id || usedSheets.has(spreadsheet.id) || usedIds.has(id)) {
      continue;
    }
    usedIds.add(id); // Two spreadsheets tagged with the same course: offer the first one only.
    const name = uniqueListName(courseNameFromTitle(spreadsheet.name), taken);
    taken.push({ name });
    const course: Course = {
      id,
      name,
      language: findLanguage(spreadsheet.language ?? null) ? spreadsheet.language! : null,
      createdAt: spreadsheet.createdTime ?? now,
      spreadsheetId: spreadsheet.id,
    };
    result.push({ spreadsheet, course });
  }
  return result;
}
