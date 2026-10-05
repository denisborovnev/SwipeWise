import { createMemoryBackend } from '@/storage/backend';
import { COURSES_FILE, courseFolder, createCoursesRepository } from '@/storage/courses';
import { FILES } from '@/storage/repository';

import { createCourseStore, MIGRATED_COURSE_NAME } from '../courseStore';

const NOW = '2026-10-04T10:00:00.000Z';

function setup(files?: Record<string, string>) {
  const backend = createMemoryBackend(files);
  const repository = createCoursesRepository(backend);
  let n = 0;
  const store = createCourseStore({ repository, newId: () => `c${++n}`, now: () => NOW });
  const saved = () => JSON.parse(backend.files[COURSES_FILE]);
  return { backend, repository, store, saved };
}

describe('courseStore', () => {
  it('starts with no courses on a fresh install', async () => {
    const { store, saved } = setup();
    await store.getState().load();
    expect(store.getState()).toMatchObject({ status: 'ready', courses: [], activeCourseId: null });
    expect(saved()).toEqual({ version: 1, courses: [], activeCourseId: null });
  });

  it('moves data saved before courses existed into a first course without a language', async () => {
    const words = JSON.stringify({ version: 1, lists: [], words: [] });
    const settings = JSON.stringify({ version: 1 });
    const { store, backend, repository } = setup({ [FILES.vocabulary]: words, [FILES.settings]: settings });
    await store.getState().load();

    expect(store.getState().courses).toEqual([{ id: 'c1', name: MIGRATED_COURSE_NAME, language: null, createdAt: NOW }]);
    expect(store.getState().activeCourseId).toBe('c1');
    expect(backend.files[`${courseFolder('c1')}/${FILES.vocabulary}`]).toBe(words);
    expect(backend.files[`${courseFolder('c1')}/${FILES.settings}`]).toBe(settings);
    expect(backend.files[FILES.vocabulary]).toBeUndefined();
    expect(await repository.courseRepository('c1').loadVocabulary()).toEqual(JSON.parse(words));
  });

  it('adds, renames and switches courses and remembers them', async () => {
    const { store, repository } = setup();
    await store.getState().load();
    const en = await store.getState().addCourse({ name: ' English ', language: 'en-GB' });
    const es = await store.getState().addCourse({ name: 'Spanish', language: 'es-ES' });
    expect(store.getState().activeCourseId).toBeNull(); // adding doesn't switch

    await store.getState().setActive(es);
    await store.getState().updateCourse(en, { name: 'English (UK)' });

    const reloaded = createCourseStore({ repository, newId: () => 'x' });
    await reloaded.getState().load();
    expect(reloaded.getState().courses.map((c) => [c.name, c.language])).toEqual([
      ['English (UK)', 'en-GB'],
      ['Spanish', 'es-ES'],
    ]);
    expect(reloaded.getState().activeCourseId).toBe(es);
  });

  it('deletes a course with its files and picks another current course', async () => {
    const { store, backend } = setup();
    await store.getState().load();
    const en = await store.getState().addCourse({ name: 'English', language: 'en-GB' });
    const es = await store.getState().addCourse({ name: 'Spanish', language: 'es-ES' });
    await store.getState().setActive(en);
    backend.files[`${courseFolder(en)}/${FILES.vocabulary}`] = '{}';

    await store.getState().deleteCourse(en);
    expect(store.getState().courses.map((c) => c.id)).toEqual([es]);
    expect(store.getState().activeCourseId).toBe(es);
    expect(Object.keys(backend.files).some((f) => f.startsWith(courseFolder(en)))).toBe(false);
  });

  it('falls back to the first course when the current one is missing', async () => {
    const course = { id: 'A', name: 'English', language: 'en-GB', createdAt: NOW };
    const { store } = setup({
      [COURSES_FILE]: JSON.stringify({ version: 1, courses: [course], activeCourseId: 'gone' }),
    });
    await store.getState().load();
    expect(store.getState().activeCourseId).toBe('A');
  });

  it('adds restored courses without switching and skips ids that exist', async () => {
    const { store, saved } = setup();
    await store.getState().load();
    const en = await store.getState().addCourse({ name: 'English', language: 'en-GB' });
    const restored = { id: 'R1', name: 'Spanish', language: 'es-ES', createdAt: NOW, spreadsheetId: 'S1' };
    await store.getState().addRestoredCourses([restored, { ...restored, id: en, name: 'Duplicate' }]);
    expect(store.getState().courses.map((c) => c.name)).toEqual(['English', 'Spanish']);
    expect(store.getState().activeCourseId).toBeNull();
    expect(saved().courses[1]).toEqual(restored);
  });
});
