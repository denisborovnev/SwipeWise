import { createMemoryBackend } from '@/storage/backend';
import { COURSE_INFO_FILE, COURSES_FILE, courseFolder, createCoursesRepository } from '@/storage/courses';
import { FILES } from '@/storage/repository';

import { createCourseStore, MIGRATED_COURSE_NAME, RECOVERED_COURSE_NAME } from '../courseStore';

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

  it('rebuilds the courses from their folders when courses.json is lost, instead of starting empty', async () => {
    const words = JSON.stringify({ version: 1, lists: [], words: [] });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { store, saved } = setup({
      [`${courseFolder('A')}/${FILES.vocabulary}`]: words,
      [`${courseFolder('B')}/${FILES.sessions}`]: '{}',
    });
    await store.getState().load();
    warn.mockRestore();
    expect(store.getState().courses).toEqual([
      { id: 'A', name: RECOVERED_COURSE_NAME, language: null, createdAt: NOW, recovered: true },
      { id: 'B', name: `${RECOVERED_COURSE_NAME} (2)`, language: null, createdAt: NOW, recovered: true },
    ]);
    expect(store.getState().activeCourseId).toBe('A');
    expect(saved().courses).toHaveLength(2);
  });

  it('keeps course.json in each course folder and rebuilds the courses from it', async () => {
    const { store, backend, repository } = setup();
    await store.getState().load();
    const en = await store.getState().addCourse({ name: 'English', language: 'en-GB' });
    await store.getState().updateCourse(en, { spreadsheetId: 'S1', lastSyncAt: NOW });
    const info = () => JSON.parse(backend.files[`${courseFolder(en)}/${COURSE_INFO_FILE}`]);
    expect(info()).toEqual({ id: en, name: 'English', language: 'en-GB', createdAt: NOW, spreadsheetId: 'S1' });

    delete backend.files[COURSES_FILE];
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const reloaded = createCourseStore({ repository, newId: () => 'x', now: () => NOW });
    await reloaded.getState().load();
    warn.mockRestore();
    expect(reloaded.getState().courses).toEqual([info()]); // complete again – not marked as recovered
  });

  it('writes the missing course.json of existing courses on load', async () => {
    const courses = { version: 1, courses: [{ id: 'A', name: 'Polish', language: 'pl-PL', createdAt: NOW }], activeCourseId: 'A' };
    const { store, backend } = setup({ [COURSES_FILE]: JSON.stringify(courses) });
    await store.getState().load();
    await store.getState().setActive('A'); // waits for the pending writes
    expect(JSON.parse(backend.files[`${courseFolder('A')}/${COURSE_INFO_FILE}`])).toEqual(courses.courses[0]);
  });
});
