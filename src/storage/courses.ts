import type { Course, CoursesData } from '@/model/types';

import { scopeBackend, type StorageBackend } from './backend';
import { createRepository, FILES, readJson, writeJson, type Repository } from './repository';

export const COURSES_FILE = 'courses.json';

/** The settings of a course, also kept in its own folder so the course can be rebuilt from it. */
export const COURSE_INFO_FILE = 'course.json';

export type CourseInfo = Pick<Course, 'id' | 'name' | 'language' | 'createdAt' | 'spreadsheetId' | 'speech'>;

/** The part of a course kept in course.json (not the sync state, which changes on every sync). */
export const courseInfo = ({ id, name, language, createdAt, spreadsheetId, speech }: Course): CourseInfo => ({
  id,
  name,
  language,
  createdAt,
  spreadsheetId,
  speech,
});

const COURSES_FOLDER = 'courses';

export const courseFolder = (courseId: string) => `${COURSES_FOLDER}/${courseId}`;

/** Files that were kept directly in the data folder before courses existed. */
const LEGACY_FILES = [FILES.vocabulary, FILES.sessions, FILES.legacySession, FILES.settings];

export interface CoursesRepository {
  /** Returns null when courses.json doesn't exist yet (first launch or first launch after the update). */
  load(): Promise<CoursesData | null>;
  save(data: CoursesData): Promise<void>;
  /** Copies the data saved before courses existed into the course's folder; false if there was none. */
  copyLegacyData(courseId: string): Promise<boolean>;
  /** Deletes the legacy files once courses.json pointing at their copies is saved. */
  deleteLegacyData(): Promise<void>;
  deleteCourseData(courseId: string): Promise<void>;
  /** Ids of the courses that have a folder (to rebuild the list if courses.json is lost). */
  listCourseFolders(): Promise<string[]>;
  loadCourseInfo(courseId: string): Promise<CourseInfo | null>;
  saveCourseInfo(info: CourseInfo): Promise<void>;
  /** Repository for the files of one course. */
  courseRepository(courseId: string): Repository;
}

export function createCoursesRepository(backend: StorageBackend): CoursesRepository {
  return {
    load: () => readJson<CoursesData>(backend, COURSES_FILE),
    save: (data) => writeJson(backend, COURSES_FILE, data),

    async copyLegacyData(courseId) {
      let found = false;
      for (const name of LEGACY_FILES) {
        const text = await backend.readText(name);
        if (text !== null) {
          await backend.writeTextAtomic(`${courseFolder(courseId)}/${name}`, text);
          found = true;
        }
      }
      return found;
    },
    async deleteLegacyData() {
      for (const name of LEGACY_FILES) {
        await backend.delete(name);
      }
    },

    deleteCourseData: (courseId) => backend.deleteFolder(courseFolder(courseId)),
    listCourseFolders: () => backend.listFolders(COURSES_FOLDER),
    loadCourseInfo: (courseId) => readJson<CourseInfo>(backend, `${courseFolder(courseId)}/${COURSE_INFO_FILE}`),
    saveCourseInfo: (info) => writeJson(backend, `${courseFolder(info.id)}/${COURSE_INFO_FILE}`, info),
    courseRepository: (courseId) => createRepository(scopeBackend(backend, courseFolder(courseId))),
  };
}
