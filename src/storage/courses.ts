import type { CoursesData } from '@/model/types';

import { scopeBackend, type StorageBackend } from './backend';
import { createRepository, FILES, readJson, writeJson, type Repository } from './repository';

export const COURSES_FILE = 'courses.json';

export const courseFolder = (courseId: string) => `courses/${courseId}`;

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
    courseRepository: (courseId) => createRepository(scopeBackend(backend, courseFolder(courseId))),
  };
}
