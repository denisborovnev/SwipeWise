import * as Crypto from 'expo-crypto';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { createGoogleAuth } from '@/auth/google';
import { isFinished } from '@/model/session';
import type { VocabularyData } from '@/model/types';
import { markUploaded } from '@/model/vocabulary';
import { createCoursesRepository } from '@/storage/courses';
import { createDebouncedTask } from '@/storage/debounce';
import { createFileBackend } from '@/storage/fileBackend';
import { appProperties, connectCourse } from '@/sync/connect';
import { createGoogleApi } from '@/sync/googleApi';
import { createGoogleClient } from '@/sync/googleClient';
import { mergePull } from '@/sync/mergePull';
import { markPushed, planSync } from '@/sync/planSync';
import { readSpreadsheet } from '@/sync/pull';
import { spreadsheetTitle } from '@/sync/sheetFormat';

import { createCourseStore, type CourseState } from './courseStore';
import { createGoogleAccountStore, type GoogleAccountState } from './googleStore';
import { createSessionStore, type SessionState } from './sessionStore';
import { createVocabularyStore, type VocabularyState } from './vocabularyStore';

const newId = () => Crypto.randomUUID();

export const coursesRepository = createCoursesRepository(createFileBackend());

export const courseStore = createCourseStore({ repository: coursesRepository, newId });

/** Words and sessions of the current course. */
export const vocabularyStore = createVocabularyStore({ newId });

export const sessionStore = createSessionStore({ vocabulary: vocabularyStore, newId });

const googleAuth = createGoogleAuth();
const googleApi = createGoogleApi(createGoogleClient(googleAuth));

/** The signed-in Google account (app-wide). */
export const googleAccountStore = createGoogleAccountStore(googleAuth);

export function useGoogleAccount<T>(selector: (state: GoogleAccountState) => T): T {
  return useStore(googleAccountStore, selector);
}

export interface SyncState {
  /** Course being synced / last synced. */
  courseId: string | null;
  status: 'idle' | 'syncing' | 'error';
  error?: string;
}

/** Sync status of the current course (shown as the cloud icon and on the course screen). */
export const syncStore = createStore<SyncState>()(() => ({ courseId: null, status: 'idle' }));

export function useSync<T>(selector: (state: SyncState) => T): T {
  return useStore(syncStore, selector);
}

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
  // Restoring the Google sign-in doesn't block the app; it works offline without it.
  const restoring = googleAccountStore.getState().restore();
  await courseStore.getState().load();
  if (courseStore.getState().status === 'ready') {
    await openActiveCourse();
  }
  // The cached words are shown right away; the spreadsheet is read in the background.
  restoring.then(() => syncActiveCourse());
}

export async function switchCourse(courseId: string) {
  if (courseStore.getState().activeCourseId === courseId) {
    return;
  }
  // setActive changes the state synchronously; opening right away (without awaiting the save first) means
  // the screens never show the new course name with the old course's words.
  const saved = courseStore.getState().setActive(courseId);
  retry.reset();
  if (syncStore.getState().status !== 'syncing') {
    // A running sync of the previous course finishes first and then syncs this one.
    syncStore.setState({ courseId: null, status: 'idle', error: undefined });
  }
  await openActiveCourse();
  await saved;
  syncActiveCourse();
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

/**
 * Merges lists into the oldest of them (so the merged list keeps its date) and returns its id.
 * Sessions that used the merged lists use the merged list afterwards.
 */
export function mergeLists(listIds: string[], name: string): string {
  const lists = vocabularyStore.getState().data.lists.filter((l) => listIds.includes(l.id));
  if (lists.length < 2) {
    throw new Error('Select at least two lists to merge');
  }
  const target = [...lists].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  const sources = lists.filter((l) => l.id !== target.id).map((l) => l.id);
  vocabularyStore.getState().mergeLists(target.id, sources, name);
  sessionStore.getState().replaceLists(sources, target.id);
  return target.id;
}

/**
 * Connects a course to Google Sheets (signing in first if needed): reconnects to the spreadsheet created
 * for it earlier or creates one with all its lists. Returns null if the user cancelled the sign-in.
 */
export async function connectGoogleSheets(courseId: string): Promise<{ created: boolean } | null> {
  if (!googleAccountStore.getState().email && !(await googleAccountStore.getState().signIn())) {
    return null;
  }
  const course = courseStore.getState().courses.find((c) => c.id === courseId);
  if (!course) {
    throw new Error('The course no longer exists');
  }
  await flushAll();
  const active = courseStore.getState().activeCourseId === courseId;
  const repository = coursesRepository.courseRepository(courseId);
  const data = active ? vocabularyStore.getState().data : await repository.loadVocabulary();

  const result = await connectCourse(googleApi, course, data ?? { version: 1, lists: [], words: [] });

  if (result.created) {
    if (active) {
      vocabularyStore.getState().markUploaded(result.listSheetIds, result.uploaded);
    } else if (data) {
      await repository.saveVocabulary(markUploaded(data, result.listSheetIds, result.uploaded));
    }
  }
  await courseStore.getState().updateCourse(courseId, {
    spreadsheetId: result.spreadsheetId,
    lastSyncAt: result.created ? new Date().toISOString() : undefined,
  });
  if (!result.created) {
    // Reconnected to an earlier spreadsheet: bring its words in.
    await syncActiveCourse();
  }
  return { created: result.created };
}

/**
 * Reads the current course's spreadsheet and merges it into the words on the phone (new rows, edits,
 * new / renamed / deleted tabs), then writes back the fixes for rows and tabs added by hand (Id, Added,
 * header, date in the tab name). Does nothing if the course isn't connected or nobody is signed in.
 * Errors are kept in `syncStore` (e.g. offline) – the words on the phone stay as they are.
 */
export async function syncActiveCourse(): Promise<void> {
  const courseId = courseStore.getState().activeCourseId;
  const course = courseStore.getState().courses.find((c) => c.id === courseId);
  const sync = syncStore.getState();
  if (!course?.spreadsheetId || !googleAccountStore.getState().email) {
    return;
  }
  if (sync.status === 'syncing') {
    syncAgain = true; // Changes made during a sync go out with the next one.
    return;
  }
  syncStore.setState({ courseId: course.id, status: 'syncing', error: undefined });
  try {
    const { tabs, otherTabCount } = await readSpreadsheet(googleApi, course.spreadsheetId);
    // Merge into the data as it is now (the user may have changed something while we were reading).
    if (courseStore.getState().activeCourseId !== course.id || vocabularyStore.getState().status !== 'ready') {
      syncStore.setState({ status: 'idle' });
      return;
    }
    const result = mergePull(vocabularyStore.getState().data, tabs, new Date().toISOString(), newId);
    applySync(result.data);
    sessionStore.getState().skipMissing();

    const usedSheetIds = new Set(tabs.map((t) => t.sheetId));
    const plan = planSync(result.data, tabs, result.fixes, () => newSheetId(usedSheetIds));
    await googleApi.batchUpdate(course.spreadsheetId, plan.requests);
    await googleApi.writeValues(course.spreadsheetId, plan.values);
    // Clear the "not pushed yet" marks of what was written (changes made meanwhile stay marked).
    if (courseStore.getState().activeCourseId === course.id) {
      applySync(markPushed(vocabularyStore.getState().data, plan.pushed));
    }
    await courseStore.getState().updateCourse(course.id, {
      lastSyncAt: new Date().toISOString(),
      tabCount: otherTabCount + result.data.lists.length,
    });
    syncStore.setState({ status: 'idle' });
    retry.reset();
  } catch (e) {
    console.warn('Sync failed', e);
    syncStore.setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    retry.schedule();
  }
  if (syncAgain) {
    syncAgain = false;
    await syncActiveCourse();
  }
}

let syncAgain = false;

/** After a failed sync (e.g. offline) try again after 30 s, 1, 2, 4… up to 15 minutes. */
const retry = (() => {
  const delays = [30, 60, 120, 240, 480, 900].map((s) => s * 1000);
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule() {
      if (timer) {
        clearTimeout(timer);
      }
      const delay = delays[Math.min(attempt++, delays.length - 1)];
      timer = setTimeout(() => {
        timer = null;
        syncActiveCourse();
      }, delay);
    },
    reset() {
      attempt = 0;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
})();
/** True while the sync itself changes the words, so that doesn't schedule another sync. */
let applyingSync = false;

function applySync(data: VocabularyData) {
  applyingSync = true;
  try {
    vocabularyStore.getState().applyPull(data);
  } finally {
    applyingSync = false;
  }
}

/** Word / list edits that aren't in the spreadsheet yet (review results alone wait for the session end). */
const hasEditsToPush = (data: VocabularyData) =>
  (data.deleted?.wordIds.length ?? 0) > 0 ||
  (data.deleted?.sheetIds.length ?? 0) > 0 ||
  data.lists.some((l) => l.dirty || l.sheetId === undefined) ||
  data.words.some((w) => w.contentDirty);

// Edits go out ~2 s after the last change, so a burst of quick-adds is one request.
const editSync = createDebouncedTask(() => syncActiveCourse(), 2000);
vocabularyStore.subscribe((state, prev) => {
  if (!applyingSync && state.status === 'ready' && state.data !== prev.data && hasEditsToPush(state.data)) {
    editSync.schedule();
  }
});

// Review results go out when a session is finished.
sessionStore.subscribe((state, prev) => {
  const finished = state.session && isFinished(state.session);
  const wasFinished = prev.session?.id === state.session?.id && prev.session && isFinished(prev.session);
  if (finished && !wasFinished) {
    syncActiveCourse();
  }
});

/** Pull again when the app comes back after this long (the sheet may have been edited meanwhile). */
const RESYNC_AFTER_MS = 5 * 60 * 1000;

/** App went to background / came back: save and push everything; pull again after a while. */
export function onAppStateChange(state: string) {
  if (state === 'background') {
    flushAll().then(() => syncActiveCourse());
  } else if (state === 'active') {
    const course = courseStore.getState().courses.find((c) => c.id === courseStore.getState().activeCourseId);
    const last = course?.lastSyncAt ? Date.parse(course.lastSyncAt) : 0;
    if (Date.now() - last > RESYNC_AFTER_MS) {
      syncActiveCourse();
    }
  }
}

/** A random tab id that isn't used yet (Sheets accepts ids chosen by the client). */
function newSheetId(used: Set<number>): number {
  let id: number;
  do {
    id = 1 + Math.floor(Math.random() * 2_000_000_000);
  } while (used.has(id));
  used.add(id);
  return id;
}

/** Stops syncing a course; its words stay on the phone and the spreadsheet stays in Drive. */
export async function disconnectGoogleSheets(courseId: string) {
  await courseStore.getState().updateCourse(courseId, { spreadsheetId: undefined });
}

/** Keeps a connected course's spreadsheet name and tags in line with the course (best effort). */
export async function updateCourseSpreadsheet(courseId: string) {
  const course = courseStore.getState().courses.find((c) => c.id === courseId);
  if (!course?.spreadsheetId || !googleAccountStore.getState().email) {
    return;
  }
  try {
    await googleApi.renameFile(course.spreadsheetId, spreadsheetTitle(course.name));
    await googleApi.setAppProperties(course.spreadsheetId, appProperties(course));
  } catch (e) {
    console.warn('Could not update the spreadsheet of the course', e);
  }
}

/** Writes all pending changes to disk (e.g. when the app goes to background). */
export async function flushAll() {
  await Promise.all([vocabularyStore.getState().flush(), sessionStore.getState().flush()]);
}
