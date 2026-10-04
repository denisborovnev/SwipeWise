import * as Crypto from 'expo-crypto';
import { useStore } from 'zustand';

import { createCoursesRepository } from '@/storage/courses';
import { createFileBackend } from '@/storage/fileBackend';

import { createCourseStore, type CourseState } from './courseStore';
import { createSessionStore, type SessionState } from './sessionStore';
import { createVocabularyStore, type VocabularyState } from './vocabularyStore';

const newId = () => Crypto.randomUUID();

export const coursesRepository = createCoursesRepository(createFileBackend());

export const courseStore = createCourseStore({ repository: coursesRepository, newId });

/** Words and sessions of the current course. */
export const vocabularyStore = createVocabularyStore({ newId });

export const sessionStore = createSessionStore({ vocabulary: vocabularyStore, newId });

export function useCourses<T>(selector: (state: CourseState) => T): T {
  return useStore(courseStore, selector);
}

export function useVocabulary<T>(selector: (state: VocabularyState) => T): T {
  return useStore(vocabularyStore, selector);
}

export function useSession<T>(selector: (state: SessionState) => T): T {
  return useStore(sessionStore, selector);
}

/** Loads the words and sessions of the current course (saving the pending changes of the previous one). */
async function openActiveCourse() {
  const courseId = courseStore.getState().activeCourseId;
  if (!courseId) {
    await Promise.all([vocabularyStore.getState().unload(), sessionStore.getState().unload()]);
    return;
  }
  const repository = coursesRepository.courseRepository(courseId);
  await vocabularyStore.getState().load(repository);
  await sessionStore.getState().load(repository);
}

export async function loadAll() {
  await courseStore.getState().load();
  if (courseStore.getState().status === 'ready') {
    await openActiveCourse();
  }
}

export async function switchCourse(courseId: string) {
  if (courseStore.getState().activeCourseId === courseId) {
    return;
  }
  // setActive changes the state synchronously; opening right away (without awaiting the save first) means
  // the screens never show the new course name with the old course's words.
  const saved = courseStore.getState().setActive(courseId);
  await openActiveCourse();
  await saved;
}

/** Creates a course and makes it the current one. */
export async function createCourse(input: Parameters<CourseState['addCourse']>[0]) {
  const courseId = await courseStore.getState().addCourse(input);
  await switchCourse(courseId);
  return courseId;
}

export async function deleteCourse(courseId: string) {
  const wasActive = courseStore.getState().activeCourseId === courseId;
  if (wasActive) {
    // Save and close its files before they are deleted.
    await Promise.all([vocabularyStore.getState().unload(), sessionStore.getState().unload()]);
  }
  await courseStore.getState().deleteCourse(courseId);
  if (wasActive) {
    await openActiveCourse();
  }
}

/** Writes all pending changes to disk (e.g. when the app goes to background). */
export async function flushAll() {
  await Promise.all([vocabularyStore.getState().flush(), sessionStore.getState().flush()]);
}
