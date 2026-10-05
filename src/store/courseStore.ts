import { createStore, type StoreApi } from 'zustand/vanilla';

import { uniqueListName } from '@/model/lists';
import type { Course, CoursesData } from '@/model/types';
import { courseInfo, type CoursesRepository } from '@/storage/courses';

import type { LoadStatus } from './vocabularyStore';

/** Name of the course that existing words are moved into when updating from a version without courses. */
export const MIGRATED_COURSE_NAME = 'My course';

/** Name of a course rebuilt from its folder after courses.json was lost (until its spreadsheet names it). */
export const RECOVERED_COURSE_NAME = 'Recovered course';

export type CourseInput = Pick<Course, 'name' | 'language'>;
export type CoursePatch = Partial<Pick<Course, 'name' | 'language' | 'spreadsheetId' | 'lastSyncAt' | 'tabCount' | 'sheetVersion' | 'speech' | 'recovered'>>;

export interface CourseState {
  status: LoadStatus;
  error?: string;
  courses: Course[];
  activeCourseId: string | null;

  /**
   * Loads courses.json; on the first start after the update, moves the existing words into a first course.
   * If courses.json is lost but course folders exist, the courses are rebuilt from them (never emptied).
   */
  load(): Promise<void>;
  /** Creates a course (doesn't switch to it) and returns its id. */
  addCourse(input: CourseInput): Promise<string>;
  /** Adds complete courses, e.g. restored from Google Drive (doesn't switch; skips ids that exist). */
  addRestoredCourses(courses: Course[]): Promise<void>;
  updateCourse(courseId: string, patch: CoursePatch): Promise<void>;
  /** Removes the course and its files; another course becomes the current one if needed. */
  deleteCourse(courseId: string): Promise<void>;
  setActive(courseId: string): Promise<void>;
}

export interface CourseStoreDeps {
  repository: CoursesRepository;
  newId: () => string;
  now?: () => string;
}

export function createCourseStore({
  repository,
  newId,
  now = () => new Date().toISOString(),
}: CourseStoreDeps): StoreApi<CourseState> {
  return createStore<CourseState>()((set, get) => {
    let saving: Promise<void> = Promise.resolve();

    /** Applies a change and saves courses.json right away (writes are chained, never concurrent). */
    const change = (patch: Pick<CourseState, 'courses' | 'activeCourseId'>) => {
      if (get().status !== 'ready') {
        throw new Error('Courses are not loaded yet');
      }
      const before = get().courses;
      set(patch);
      const data: CoursesData = { version: 1, ...patch };
      const infos = patch.courses.filter((c) => {
        const old = before.find((b) => b.id === c.id);
        return !old || JSON.stringify(courseInfo(old)) !== JSON.stringify(courseInfo(c));
      });
      saving = saving.then(async () => {
        await repository.save(data);
        await saveInfos(infos);
      });
      return saving;
    };

    /** Keeps course.json in the courses' folders up to date (best effort; only a backup of courses.json). */
    const saveInfos = async (courses: Course[]) => {
      for (const course of courses) {
        try {
          await repository.saveCourseInfo(courseInfo(course));
        } catch (e) {
          console.warn('Could not save course.json', e);
        }
      }
    };

    return {
      status: 'idle',
      courses: [],
      activeCourseId: null,

      async load() {
        set({ status: 'loading', error: undefined });
        try {
          let data = await repository.load();
          const folders = data ? [] : await repository.listCourseFolders();
          if (!data && folders.length > 0) {
            console.warn(`courses.json is missing; rebuilding ${folders.length} course(s) from their folders`);
            const courses: Course[] = [];
            for (const id of folders) {
              const info = await repository.loadCourseInfo(id);
              courses.push(
                // Without course.json (courses from before it existed) the name etc. come from Google Drive later.
                info ? { ...info, id } : { id, name: RECOVERED_COURSE_NAME, language: null, createdAt: now(), recovered: true },
              );
            }
            const names = new Set<string>();
            for (const course of courses) {
              course.name = uniqueListName(course.name, [...names].map((name) => ({ name })));
              names.add(course.name);
            }
            data = { version: 1, courses, activeCourseId: courses[0].id };
            await repository.save(data);
          }
          if (!data) {
            const id = newId();
            const migrated = await repository.copyLegacyData(id);
            data = migrated
              ? { version: 1, courses: [{ id, name: MIGRATED_COURSE_NAME, language: null, createdAt: now() }], activeCourseId: id }
              : { version: 1, courses: [], activeCourseId: null };
            await repository.save(data);
            if (migrated) {
              await repository.deleteLegacyData();
            }
          }
          const { courses } = data;
          const activeCourseId = courses.some((c) => c.id === data.activeCourseId)
            ? data.activeCourseId
            : (courses[0]?.id ?? null);
          set({ status: 'ready', courses, activeCourseId });
          // Courses created before course.json existed get one.
          const missing: Course[] = [];
          for (const course of courses) {
            if (!(await repository.loadCourseInfo(course.id))) {
              missing.push(course);
            }
          }
          saving = saving.then(() => saveInfos(missing));
        } catch (e) {
          set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
        }
      },

      async addCourse(input) {
        const id = newId();
        const course: Course = { id, name: input.name.trim(), language: input.language, createdAt: now() };
        await change({ courses: [...get().courses, course], activeCourseId: get().activeCourseId });
        return id;
      },

      async addRestoredCourses(restored) {
        const ids = new Set(get().courses.map((c) => c.id));
        const added = restored.filter((c) => !ids.has(c.id));
        if (added.length > 0) {
          await change({ courses: [...get().courses, ...added], activeCourseId: get().activeCourseId });
        }
      },

      updateCourse: (courseId, patch) =>
        change({
          courses: get().courses.map((c) =>
            c.id === courseId ? { ...c, ...patch, name: (patch.name ?? c.name).trim() } : c,
          ),
          activeCourseId: get().activeCourseId,
        }),

      async deleteCourse(courseId) {
        const courses = get().courses.filter((c) => c.id !== courseId);
        const { activeCourseId } = get();
        await change({ courses, activeCourseId: activeCourseId === courseId ? (courses[0]?.id ?? null) : activeCourseId });
        await repository.deleteCourseData(courseId);
      },

      async setActive(courseId) {
        if (get().courses.some((c) => c.id === courseId)) {
          await change({ courses: get().courses, activeCourseId: courseId });
        }
      },
    };
  });
}
