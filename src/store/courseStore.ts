import { createStore, type StoreApi } from 'zustand/vanilla';

import type { Course, CoursesData } from '@/model/types';
import type { CoursesRepository } from '@/storage/courses';

import type { LoadStatus } from './vocabularyStore';

/** Name of the course that existing words are moved into when updating from a version without courses. */
export const MIGRATED_COURSE_NAME = 'My course';

export type CourseInput = Pick<Course, 'name' | 'language'>;
export type CoursePatch = Partial<Pick<Course, 'name' | 'language' | 'spreadsheetId' | 'lastSyncAt'>>;

export interface CourseState {
  status: LoadStatus;
  error?: string;
  courses: Course[];
  activeCourseId: string | null;

  /** Loads courses.json; on the first start after the update, moves the existing words into a first course. */
  load(): Promise<void>;
  /** Creates a course (doesn't switch to it) and returns its id. */
  addCourse(input: CourseInput): Promise<string>;
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
      set(patch);
      const data: CoursesData = { version: 1, ...patch };
      saving = saving.then(() => repository.save(data));
      return saving;
    };

    return {
      status: 'idle',
      courses: [],
      activeCourseId: null,

      async load() {
        set({ status: 'loading', error: undefined });
        try {
          let data = await repository.load();
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
