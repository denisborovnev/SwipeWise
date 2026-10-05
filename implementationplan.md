# Implementation Plan – SwipeWise

The plan is split into milestones. Each milestone ends with a working, testable app.
Milestones 1–4 deliver a complete **offline** app; milestones 5–6 add Google Sheets on top
without changing the rest of the app.

---

## 0. Key technical decisions

| Topic | Decision | Reason |
|---|---|---|
| Framework | **Expo SDK 57 + TypeScript**. Milestones 1–4 run in **Expo Go**; from Milestone 5 a **development build** is used | Familiar React model; the dev build is only needed for native Google Sign-In. |
| Navigation | **expo-router** (file-based) | Simple, React-Router-like. |
| State | **Zustand** with a thin persistence layer | Minimal boilerplate, easy to persist to a file. |
| Local storage | **JSON files via `expo-file-system`**, written crash-safely (tmp → move the old file to .bak → move tmp in; reads fall back to .tmp / .bak) | Matches "cache on file system"; data size is small (thousands of words). Can swap to `expo-sqlite` later behind the same repository interface. |
| Animations | **react-native-reanimated** + **react-native-gesture-handler** | 60fps flip + swipe on UI thread. |
| Google auth | **`@react-native-google-signin/google-signin`** → access token | Native Android sign-in, no browser redirect juggling. |
| Sheets access | **Sheets REST API v4** via `fetch` with the access token | No heavy Google SDK needed in RN. |
| IDs | UUID v4 per word (`expo-crypto` `randomUUID`) | Stable identity independent of row position. |
| Dates | ISO-like text `YYYY-MM-DD HH:mm` written with `valueInputOption=RAW` | Human-readable in the sheet, sortable, no locale/date-serial surprises. |

---

## 1. Data model

```ts
interface Course {          // everything studied for one language
  id: string;
  name: string;              // defaults to the language without the region, e.g. "English"
  language: string | null;   // BCP-47 code of the language being learned, e.g. "en-GB"
                             // (null only for data from before courses existed, until the user picks it)
  createdAt: string;
}

type RememberStatus = 'yes' | 'no' | null;   // null = never revised

interface Word {
  id: string;              // UUID
  listId: string;          // = tab name when synced
  front: string;           // "машина"
  back: string;            // "car"
  examples: string[];      // stored as newline-joined text in the sheet
  addedAt: string;         // ISO
  lastRevisedAt: string | null;
  remembered: RememberStatus;
  // sync bookkeeping (local only)
  dirty: boolean;          // has local changes not yet pushed
  updatedAt: string;       // last local modification
}

interface WordList {
  id: string;              // local id
  name: string;            // tab name
  sheetId?: number;        // Google Sheets tab id once synced
}

interface SessionFilter {
  listIds: string[];            // one or several lists; empty = all words
  addedSince?: string;          // applies to a single list or to all
  notRevisedSince?: string;     // includes never-revised words
  onlyNotRemembered?: boolean;  // remembered === 'no' (last answer only)
}

interface Session {
  id: string;
  filter: SessionFilter;
  wordIds: string[];       // frozen and shuffled at session creation; reshuffled on restart
  currentIndex: number;
  results: Record<string, 'yes' | 'no'>;
  startedAt: string;
  finishedAt?: string;
}

interface SyncQueueItem {           // pending remote operations
  type: 'createList' | 'appendWords' | 'updateReviews' | 'renameList' | 'deleteWord';
  payload: unknown;
  createdAt: string;
}
```

The actual types are in `src/model/types.ts`.

Local files (in `<documents>/myvocabulary/`):
- `courses.json` – the courses and the id of the current one
- `courses/<courseId>/` – one folder per course:
  - `course.json` – copy of the course's settings (name, language, spreadsheet, speech) to rebuild `courses.json` if it's lost
  - `words.json` – all lists + words of the course
  - `sessions.json` – the last 5 sessions, most recently used first (replaces `session.json` of earlier versions, which is migrated)
  - `sync-queue.json` – pending remote operations
  - `settings.json` – the course's spreadsheet id, last sync time, last filter
- App-wide Google account data (signed-in account) is kept by the sign-in library, not per course.

Files from before courses existed (`words.json` etc. directly in `myvocabulary/`) are moved into the folder of
a first course on the first start of the new version.

---

## 2. Project structure

```
src/
  app/                       # expo-router screens (only routes live here)
    _layout.tsx              # Stack navigator, loads data, flushes on background
    index.tsx                # Home: course switcher, "Continue session" / "New session" + word lists
    courses.tsx              # Switch course, add / edit courses
    course.tsx               # Create / edit a course: language + name, Google Sheets connection (modal)
    session/new.tsx          # Filter selection
    session/play.tsx         # Card game
    session/recent.tsx       # Last 5 sessions
    all-lists.tsx            # All lists: search, sort, grouped by month
    dev-seed.tsx             # Dev only: deep link that adds sample lists
    session/summary.tsx      # Results of the session
    lists/[id].tsx           # Words of a list, rename/delete list
    word.tsx                 # Add / edit word (modal)
  constants/theme.ts         # colors (light/dark), spacing
  model/                     # types + pure functions (vocabulary ops, filters, demo data)
  storage/                   # StorageBackend (file / in-memory), repository, debounced save
  store/                     # zustand stores (created by factories for testability)
  sync/
    sheetsApi.ts             # low-level REST calls
    mapper.ts                # Word <-> sheet row
    syncEngine.ts            # pull/merge/push, queue processing
  auth/google.ts             # sign-in, token refresh
  components/
    FlashCard.tsx            # flip + swipe card
    FilterForm.tsx
    WordForm.tsx
```

---

## 3. Milestones

### Milestone 1 – Project skeleton & local storage ✅
- [x] `create-expo-app` (default template: TypeScript, expo-router, reanimated, gesture-handler); added zustand, expo-file-system, expo-crypto, jest-expo, ESLint.
- [x] `storage/`: `StorageBackend` interface with a file implementation (temp file + rename) and an in-memory one for tests; `repository` for `words.json` / `session.json` / `settings.json` (a corrupt file is kept as `*.corrupt` and the app starts fresh); debounced save (1s) with `flush()`.
- [x] Zustand `vocabularyStore`: lists + words CRUD and `recordAnswer`, built on pure functions in `model/vocabulary.ts`; saves are flushed when the app goes to background.
- [x] Demo list seeded on first launch (removed with courses: a new course starts empty).
- [x] Home screen showing lists and word counts (placeholder until Milestone 2).
- [x] Unit tests (Jest) for model, repository, debounce and store.

### Milestone 2 – Word list management (offline) ✅
- [x] Home screen lists the word lists (sorted by name, with word counts); create a list from there.
- [x] List screen: words (newest first) with a remembered / not remembered / not revised dot; ⋮ menu to rename or delete the list.
- [x] Add / edit word modal (front, back, examples one per line); delete from the edit screen.
- [x] "Quick add" mode: after adding, the form clears and stays open for the next word.
- [x] Validation: front and back required; warning with "Add anyway" for a duplicate front or back in the same list; list names follow the Sheets tab-name rules (unique, no leading `_`, no `:  / ? * [ ]`, max 100 chars).

### Milestone 3 – Flashcard game ✅
- [x] `FlashCard` component:
  - tap → 3D flip (rotateY) front ↔ back;
  - pan gesture enabled **only when back is visible** (a drag on the front side does nothing);
  - swipe past threshold (or a fast flick) → card flies off, callback `onAnswer('yes' | 'no')`;
  - below threshold → spring back; card tints green/red with a "Knew it" / "Didn't know" label while dragging;
  - "Knew it" / "Didn't know" buttons under the card do the same as swiping.
- [x] Play screen: progress (`2 / 5` + bar), undo last answer, restart (with confirmation).
- [x] On answer: word gets `lastRevisedAt = now`, `remembered`, `dirty`; session advances and is saved (debounced 300 ms + on background). Undo restores the word's previous values.
- [x] Summary screen: knew / didn't know, list of missed words, "Repeat the N words I missed", "Restart session", "Done".
- [x] Home screen session card: **Continue** (from the card where you stopped) / **Restart**; after finishing: **Restart session**.
- [x] List screen: **Practice** button (whole list).
- [x] Words deleted after the session was created are skipped.
- [x] Session logic in pure functions (`model/session.ts`) + `sessionStore`; filtering (`model/filter.ts`) already implemented here, the filter UI comes in Milestone 4.

### Milestone 4 – Session filters & continuity ✅
- [x] New-session screen: word lists (All words, or one or several lists together), Added (any time / today / last 7 / last 30 days / picked date – available for a single list too), Last revised (any time / not today / not in 3 days / a week / a month / not since a picked date; never-revised words always match), "Only words I didn't remember" (last answer = no).
- [x] Words are always shuffled: every new session (incl. "repeat the words I missed") and every restart goes through the words in a new random order; Continue keeps the current order.
- [x] Live count on the Start button ("Start · 12 words" / "No words match").
- [x] The last filter is remembered (`settings.json`) and preselected next time; relative choices ("last 7 days") stay relative.
- [x] Home screen: **Continue** (resume at `currentIndex`), **Restart** (same words, reshuffled, from the first card), **New session**. The word set is only recomputed by **New session**.
- [x] Words deleted since the session was created are skipped.
- [x] Session card describes the filter, e.g. "Demo · added since Oct 2, 2026 · don't remember".
- [x] **Recent sessions**: the last 5 sessions are kept (most recently used first). "Recent" on the home screen lists them; picking one continues it, or restarts it (reshuffled) if it was finished. A new session with the same filter replaces the older one; "repeat the words I missed" rounds are separate entries marked "missed words".

> ✅ After Milestone 4 the app is fully usable offline.

### Many word lists ✅
- [x] Lists have a creation date (`createdAt`), shown on every list row.
- [x] Home screen shows the 5 newest lists + "All lists (N)".
- [x] All lists screen: search, sort (newest / oldest / A–Z), month headings for date sorts.
- [x] New session: "All words", the 4 newest lists and selected older lists as chips; "Choose lists…" opens a searchable multiple-choice picker.
- [x] Dev helper: opening `swipewise://dev-seed` (Expo Go: `exp://127.0.0.1:8081/--/dev-seed`) adds 10 sample lists to the current course (dev builds only).

### Merging lists ✅
- [x] All lists screen: **Select** (or long-press a list) → checkboxes → **Merge N lists**. Nothing is ever merged automatically.
- [x] Merge dialog: name of the merged list (defaults to the oldest list's name), a summary ("4 lists · 37 words") and a note when the same word is in more than one of them; **Merge** asks for confirmation (it can't be undone).
- [x] The words move into the oldest of the lists (so the merged list keeps its date and place) and keep their Added / LastRevised / Remembered values; the other lists are deleted.
- [x] Recent sessions and the remembered filter that used the merged lists now use the merged list, so Continue keeps working.
- [x] In the sheet (Milestone 6): the words are moved to the merged list's tab and the other tabs are deleted with the next push.

### Courses ✅
- [x] `Course` = name + language being learned (BCP-47 code, picked from a built-in list of languages incl. regional variants such as English (US/UK), for pronunciation later). Only the learned language is stored; the native language is not asked for.
- [x] Every course has its own word lists, words, recent sessions, last filter and (from Milestone 5) spreadsheet: each course's files live in `courses/<id>/`, the stores load the files of the current course.
- [x] `courses.json` holds the courses and the current course; the app opens the course used last.
- [x] First start: "What language are you learning?" → create the first course.
- [x] Upgrade: existing data is moved into a first course "My course"; the home screen asks once to pick its language (the name follows the language until the user changes it).
- [x] Home screen title shows the current course with a ▾; it opens the Courses screen: switch course (✓ marks the current one), edit, "New course".
- [x] Course screen: language picker with search, name (unique, defaults to the language), delete (with confirmation; not for the only course).

### Milestone 5 – Google Sheets connection
- [x] Set `slug` in `app.json` to `swipewise` (kept as `myvocabulary` while on Expo Go, because Expo Go keeps each project's files under its slug and changing it would hide the existing test data).
- [x] Switch from Expo Go to an Android **development build**: `expo-dev-client` + `npx expo run:android`, built with **JDK 21** (`JAVA_HOME`; e.g. the Temurin 21 in `~/.jdks`). The system Java 8 is too old, and Android Studio's bundled JBR is Java 25, whose "restricted method" warning makes the CMake configure step of react-native-screens / worklets fail. `android/` is generated (git-ignored), never edited by hand.
- [x] `@react-native-google-signin/google-signin` installed. Its Expo config plugin is **not** used: without Firebase it only configures iOS (and requires an iOS client id); Android needs no native config.
- [x] Google Cloud project: **Sheets API** and **Drive API** enabled; OAuth consent screen (External, Testing mode, the user as test user, scope `drive.file`); OAuth clients:
  - **Web** client – its id is passed to the sign-in library (`webClientId`); kept in `.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (git-ignored, not in the source).
  - **Android** client – package `com.swipewise.app` + SHA-1 of the debug keystore (the standard React Native debug key, stable across `prebuild`). Not referenced in the app; Google matches it by package + signature. A release keystore needs its SHA-1 added later (Milestone 7).
- [x] Emulator: the AVD has Google Play; the user signs in to the test Google account in Android settings.
- [x] Scope: **`https://www.googleapis.com/auth/drive.file`** only – the app can access just the files it created itself. It is a *non-sensitive* scope (no Google verification needed, simple consent screen). The Sheets API works with this scope for app-created spreadsheets.
- [x] `auth/google.ts`: sign in, get access token, silent refresh on 401, sign out.
- [x] **One spreadsheet per course.** The Google account is app-wide (sign in once); each course is connected to its own spreadsheet; its id (and the last sync time) is stored on the course in `courses.json`.
- [x] Every app-created spreadsheet is tagged with Drive `appProperties`: `swipewise=1`, `courseId=<id>`, `language=<code>`, so the app can tell which spreadsheet belongs to which course.
- [x] **UI**: course screen section with Connect / Sync now / Last synced / Open / Disconnect / tab limit note; home cloud icon (synced / syncing / problem) and pull-to-refresh; account line + Sign out on the Courses screen; sync status icon on connected courses.
  - **Courses screen:** each course row shows its sync status icon (☁️✓ synced, ☁️↻ syncing, ☁️✕ error / offline – tap for details, no icon = not connected). Footer: "Signed in as … · Sign out" (app-wide Google account).
  - **Course screen** (✏️) gets a **Google Sheets** section: not connected → **Connect Google Sheets**; connected → **Open in Google Sheets**, **Sync now**, "Last synced 2 min ago", **Disconnect** (keeps the words on the phone, stops syncing).
  - **Home screen:** small cloud status icon in the header for the current course (tap → course screen).
  - **Restore:** if Drive has app-created spreadsheets that no local course uses, the Courses screen offers **Restore N courses from Google Drive**.
- [x] **Connect Google Sheets** (course screen):
  1. Sign in (if not signed in yet).
  2. Look for spreadsheets previously created by the app: Drive `files.list` with `q = mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and appProperties has { key='swipewise' and value='1' }` (with `drive.file` it returns only app-created files).
  3. A spreadsheet with this course's `courseId` → reconnect to it. Otherwise **create** a new spreadsheet "SwipeWise – <course name>" (`spreadsheets.create`, then set the `appProperties`).
  4. Show an "Open in Google Sheets" link (`https://docs.google.com/spreadsheets/d/<id>`).
  - Disconnect is also available (keeps local data, stops syncing).
  - Renaming a course renames its spreadsheet (Drive `files.update`); deleting a course leaves the spreadsheet in Drive.
- [x] `sync/googleClient.ts` (fetch with the access token, retry once on 401) and `sync/googleApi.ts`: `listAppSpreadsheets`, `createSpreadsheet`, `writeValues`, `setAppProperties`, `renameFile`, `getTabs`, `readValues`, `batchUpdate`.
- [x] `sync/sheetFormat.ts` / `sync/parseTab.ts`:
  - header-based column mapping (columns are found by name, case-insensitive, so the user may reorder them);
  - examples newline join/split, date formatting.
- [x] **Tab parsing** (on every pull, in memory; the resulting fixes are written right after the pull – see *Normalisation*):
  - **Header detection:** if row 1 contains `Front` and `Back` (case-insensitive) → it is the header; columns are mapped by name. Otherwise there is no header: all rows are words with the default layout A = Front, B = Back, C = Examples, and the tab is marked `needsHeader`.
  - Missing system columns (`Added`, `LastRevised`, `Remembered`, `Id`) → tab is marked `needsColumns`; they will be appended to the right.
  - Rows with Front/Back but no `Id` → hand-added words: generate `Id`, set `Added = now`, leave `LastRevised`/`Remembered` empty; mark the row `needsSystemCells`. Until the `Id` is written, the row is matched by tab + row content (Front+Back).
  - Completely empty rows are skipped; rows with only Front or only Back are flagged as incomplete (shown in the app, not used in sessions).
- [x] **List creation date in the tab name**: tabs are named `<list name> - YYYY-MM-DD` (e.g. `Travel - 2026-10-04`); the app shows "Travel" and uses the date as the list's `createdAt`.
  - Tab without a date suffix (created by hand) → the list gets today's date when the app first sees it, and the tab is renamed right after the pull.
  - Date removed by hand → treated like a tab without a date (dated today); date changed by hand → the app takes the new date.
  - List names are limited to 87 characters so that name + " - YYYY-MM-DD" fits the 100-character tab name limit (already enforced).
  - Display names stay unique even if the dates differ.
- [x] **Normalisation right after the pull** – the fixes found while parsing (header rows, missing system columns, `Id` / `Added` of hand-added rows, date suffix of tab names) are written in **one batch immediately after the pull**, so hand-added rows get their `Id` quickly and can't be mismatched. Order: insert header row → append missing system columns → write system cells → rename tabs. If it fails (offline), the fixes are recomputed on the next pull.
- [x] **Tab size:** tabs are created with just the rows and the 7 columns they need (`addSheet` with `gridProperties`), and rows are appended as words are added. A default tab (1000 × 26 = 26,000 cells) would waste the spreadsheet's 10-million-cell budget.
- [x] **Tab limit note:** when a course's spreadsheet gets close to the tab limit (~180 tabs), the course screen shows a note: "The spreadsheet is getting full (180 of ~200 tabs). Merge older lists to make room." No automatic action.
- [x] **Initial upload on connect**: the spreadsheet is new (created by the app), so every local list simply becomes a new tab with header + all words. The spreadsheet is created with its tabs (no empty `Sheet1`), plus an `_SwipeWise` info tab explaining the format. When reconnecting to a previously created spreadsheet, the normal merge from Milestone 6 applies.

### Milestone 6 – Sync engine
Implemented as **one sync = read the whole spreadsheet once, merge, write once** (`syncActiveCourse` in `store/index.ts`):
1. `readSpreadsheet` – tabs + all values with one `values:batchGet`.
2. `mergePull` – merges the sheet into the local data (rules below) and lists the fixes for rows / tabs added by hand.
3. `planSync` – one `spreadsheets.batchUpdate` (delete tabs of deleted lists, rename tabs, insert header rows, add columns, delete rows of deleted / moved words bottom-up, `appendCells` for new words, `addSheet` with a client-chosen tab id for new lists) followed by one `values:batchUpdate` (header cells, Id / Added of hand-typed rows, rows of changed words at their *current* position).
4. `markPushed` – clears `dirty` / `contentDirty` / list `dirty` / `deleted` of what was written (changes made during the sync stay marked).

Local bookkeeping: `contentDirty` on words (text / list changed), `dirty` on renamed lists, lists without `sheetId` are new, `deleted` holds deleted word ids and tab ids.

Skipping unchanged spreadsheets: after every sync the Drive file `version` is stored on the course (`sheetVersion`); the next sync first reads only that version (one tiny request) and stops if it is unchanged and nothing on the phone waits to be sent (`sync/changes.ts`). **Sync now** and pull-to-refresh always do a full sync.

Triggers: app start, course switch, connect, **Sync now**, word / list edits (debounced 2 s), session finished, app to background, app back after > 5 min. Pull-to-refresh on the home screen. A sync requested while one runs is run once more afterwards. A failed sync (offline, Google error) is retried after 30 s, 1, 2, 4, 8 and then every 15 minutes, and on every trigger above; nothing is lost meanwhile because the changes stay marked locally. (A network listener – `expo-network` / NetInfo – could retry as soon as the connection is back; not added, as it needs a native rebuild and the backoff covers it.)

Only the **current course** is synced (another course is synced when the user switches to it).

**Pull (sheet → app):** ✅
- **On app start** (after pushing anything still pending), **when switching to a course**, **when the app returns from background after more than ~5 minutes**, on **pull-to-refresh** on the home screen, on **Sync now**, and after connecting.

1. Read all tabs (except `_*`) with one `values:batchGet`.
2. Parse tabs (header detection / system columns / hand-added rows – see Milestone 5); write the normalisation fixes right after the pull.
3. Merge per word (matched by `Id`):
   - Content fields (`front`, `back`, `examples`, list) – **sheet wins** unless the local word is `dirty` with content changes.
   - Review fields – take the one with the **newer `lastRevisedAt`**.
   - Word in sheet but not local → add locally.
   - Word local but not in sheet → if it was already synced before, it was deleted in the sheet → delete locally; if never synced → keep and push.
   - New tabs → new lists; removed tabs → remove lists (after confirmation if they contain unsynced changes).

**Push (app → sheet):** ✅
- **Word and list edits** (new / edited / deleted words, new / renamed / deleted lists) → right away, debounced ~2 s so a burst of quick-adds goes out as one request.
- **Review results** (`LastRevised`, `Remembered`) → **when a session finishes**, **when the app goes to background** (sessions are often left unfinished), and **on the next app start** for anything still pending. Not per swipe.
- Before updating cells, re-read the `Id` column of affected tabs to map id → current row number (the user may have sorted or inserted rows), then send one `values:batchUpdate`.
- Queue is persisted; on failure (offline / Google error) the changes stay marked as not synced and are retried on the next app start, return from background, **Sync now**, or network regained (`@react-native-community/netinfo`); the status icon shows ☁️✕ meanwhile. Nothing is lost.
- Clear `dirty` only after a successful push.

**UI:** sync status icons (Courses screen rows, home header) and "Last synced …" on the course screen – see Milestone 5.

### Milestone 7 – Polish & release
- [x] Empty states, error messages (incl. an error boundary with "Try again"), loading spinners.
- [ ] Dark mode.
- [x] App icon (two cards, the front one swiped with a check mark), adaptive icon + monochrome layer, splash screen; source in `assets/icon-source.html`.
- [x] Release APK built locally, signed with an own key kept in `~/.swipewise/` (config plugin `plugins/withReleaseSigning.js`); its SHA-1 is added as a second Android OAuth client. (EAS / Play Store `.aab` later if needed.)
- [x] Manual test checklist (in TECHNICAL.md): offline usage, connect later, edit in sheet → sync, add rows by hand with only Front/Back → system columns filled in, new tab without header → words read correctly and header added on the next push, reinstall app → reconnects to the same spreadsheet, sort rows in sheet → swipe updates go to the right rows, kill app mid-session → continue from the same card, restart session.

### Pronunciation ✅
- [x] `expo-speech` (the phone's text-to-speech; offline once the voice is installed) in the course's language (`Course.language`, so `en-GB` and `en-US` sound different).
- [x] 🔊 on the back of a card (its own tap gesture; the card's flip tap waits for it to fail) and on every word in a list.
- [x] Course screen → Pronunciation: "Read the word when a card is flipped", speed (slow / normal), "Test the voice"; settings stored per course (`Course.speech`).
- [x] Text in parentheses is not read ("to go (on foot)" → "to go").
- [x] No voice for the language → the course screen explains it and opens Android's text-to-speech settings.
- Later: human recordings and IPA for English words (Free Dictionary API), with the phone's voice as fallback.

### Milestone 8 – Restore courses after a reinstall ✅
- [x] **Restore from Google Drive**: app-created spreadsheets (Drive `files.list` with the `swipewise` app property) that no course on the phone uses – neither by `spreadsheetId` nor by `courseId` (a disconnected course gets its spreadsheet back with Connect) – are offered as courses to restore. Name from the spreadsheet title ("SwipeWise – English" → "English", made unique), language and `courseId` from `appProperties`, date from Drive's `createdTime` (`src/sync/restore.ts`).
- [x] Courses screen: "In your Google Drive" section with **Restore** per course and **Restore all**; signed out: a "Restore courses from Google Drive" link. Welcome screen of a fresh install: **Restore from Google Drive** (signs in, then opens the courses screen).
- [x] Restoring adds the courses connected to their spreadsheets and opens the first one, which pulls its words; the others are pulled when the user switches to them. The course keeps its old id, so files left on the phone for it (see the bug below) are used again.
- Sessions and the "last used filter" aren't in the spreadsheet, so they start fresh.

### Milestone 9 – Session comfort ✅
- [x] **10 recent sessions** instead of 5 (`MAX_RECENT_SESSIONS`).
- [x] **Preview a recent session** (`session/preview.tsx`): tapping a session in *Recent sessions* shows its words in the session's order (✓ / ✗ for answered ones, NEXT for the current card) with **Continue** / **Start again** and **Back**; the ▶ button on the row still continues right away. Continuing from the preview goes `dismissTo('/')` + push, so Back from the session returns home.
- [x] **Browse cards by swiping the front side**: left = next card, right = previous card (like turning pages; swapped in 1.3.1 – it was the other way round in 1.3.0); nothing is recorded for the card being left (`browse()` in `model/session.ts` only moves `currentIndex`). The card slides (no tilt, no green / red) with "‹ Previous" / "Next ›" hints, and bounces back on the first / last card. The play screen's hint text explains it.
  - Skipped words stay unanswered and don't come back; the results show them as **Skipped** (and "Perfect!" only when every card was answered with "knew it").
  - A card answered earlier shows "✓ Knew it" / "✗ Didn't know" on its front; answering it again **replaces** the answer (`answerCurrent` drops the earlier step and keeps its `previous` review state, so Undo still restores the state from before the session).
  - Undo goes to the card of the last answer (wherever the user browsed to). The progress bar shows answered cards; the title the card's position.
- [x] **Feedback on the 🔊 button**: `speak()` tracks a phase per button key in `speechStore` (`starting` from the tap until expo-speech's `onStart`, then `speaking` until `onDone` / `onStopped` / `onError`; gives up after 15 s if the engine never reports). `SpeakIcon` shows a spinner over a faded icon while starting and a filled icon while speaking – on the card and in word lists.
- [x] **Edit the card during a session**: ✏️ in the card's top-right corner (own tap gesture, like 🔊) opens `word.tsx` for the word; the card shows the new text and stays flipped / in place.

### Bugs
- [x] **All courses lost after opening / closing the app many times** (reported and fixed 2026-10-05, 1.2.0): the app suddenly showed the welcome screen. Cause: saving wrote a temp file and then `move(target, { overwrite: true })`, which in expo-file-system **deletes the target first** – if Android killed the app in between (the background sync saves `courses.json`), the file was gone. `courseStore.load()` then took it for a first launch and saved an empty course list over it (also for a corrupt file). The words in `courses/<id>/` survived. Fixed by:
  - `safeBackend.ts`: write `name.tmp` → move `name` to `name.bak` → move `name.tmp` to `name`; reads fall back to `.tmp`, then `.bak`; a corrupt file falls back to its `.bak`; `delete` removes all three;
  - `course.json` in every course folder (name, language, created, spreadsheet, speech), written when those change and on start if missing;
  - a missing `courses.json` with course folders is never replaced by an empty list: the courses are rebuilt from their `course.json` (or, without one, marked `recovered` and named from the spreadsheet tagged with their id once signed in);
  - tests simulate a kill after every step of a save; on the emulator the app was killed 25 times at random moments without losing anything.
- [x] **"FileSystemFile.move has been rejected – Destination already exists"** (found and fixed 2026-10-05, after 1.2.0). `File.move()` is asynchronous in this expo-file-system version and wasn't awaited, so `safeBackend.writeTextAtomic` started "move `name.tmp` → `name`" before "move `name` → `name.bak`" had finished; roughly every other save ended with only `name.tmp` + `name.bak` (no data lost – reads fall back to `.tmp`). Fixed: `FileOps` calls may return a Promise and `safeBackend` awaits every step; the test `FileOps.move` is asynchronous, so a missing `await` fails `safeBackend.test.ts` (checked). Files left in that state by 1.2.0 are read from `.tmp` and repaired by their next save.
- [x] **Sync fails while a course has an empty list** (found and fixed 2026-10-05): *"Invalid requests[0].addSheet: …"* – a new tab got `rowCount = words + 1` with a frozen header row; for an empty list that's 1 row, and Sheets doesn't allow freezing every row of a tab, so the whole batchUpdate failed and **nothing synced**. Fixed: `tabRowCount()` gives new tabs (in `planSync` and `connectCourse`) at least 2 rows. Likely the same limit applies when the last words of a tab are deleted (only the frozen header would be left – not seen yet, handled preventively): `planSync` then appends empty rows first, using the tab's `rowCount` (now passed from `getTabs` through `readSpreadsheet` / `parseTab`).
- Note (not a bug in the app): on the emulator, restoring the Google sign-in on start sometimes fails with `ApiException: INTERNAL_ERROR` right after the emulator boots (probably Play services not ready yet – not investigated); the app then shows the course as not signed in until the next start or sign-in.

---

## 4. Risks & notes
- **OAuth scope.** `drive.file` limits the app to files it created. The user cannot point the app at a spreadsheet they made themselves – by design. If that is ever needed, it would require the Google Picker (web-only, would need a WebView) or the broader `spreadsheets` scope.
- **OAuth "Testing" mode.** Refresh tokens of apps in Testing mode expire after 7 days → the user may need to sign in again weekly. Moving the consent screen to "In production" fixes this; with only non-sensitive scopes (`drive.file`) no Google verification is required.
- **Header detection.** A tab whose first data row is literally "Front" / "Back" would be mistaken for a header – acceptable edge case.
- **Row matching before the `Id` is written.** Hand-added rows are matched by Front+Back until the next push writes their `Id`; if the user edits such a row in between, it is treated as a new word. Acceptable, since the next push usually happens within a minute.
- **Concurrent edits.** If the user edits the sheet while the app is pushing, row mapping by `Id` (re-read before write) keeps updates on the correct rows.
- **Spreadsheet size.** ~200 tabs per spreadsheet (widely reported) and 10 million cells (documented). Tabs are sized to their content; near the limit the user is asked to merge older lists (see *Merging lists*).
- **API quotas.** Sheets API allows ~60 requests/min/user – batching keeps the app far below that.
- **Token expiry.** Access tokens last ~1h; refresh silently via the Google Sign-In library.

---

## 5. Ideas for later
- Spaced repetition (Leitner boxes / SM-2) using a `correctStreak` column and a "due today" filter.
- **Irregular verbs (English courses)** – when the back of a card is an English irregular verb ("go", "to go",
  "went"…), show its three forms under the word: **go – went – gone**. A built-in list of the ~200 common irregular
  verbs (base, past simple, past participle, incl. variants like *learnt / learned*), matched case-insensitively
  after stripping "to "; any of the three forms matches. Only for courses whose language is English (`en-*`).
  Later: a "verbs" filter for sessions ("only irregular verbs"), and a mode that asks for the forms.
- Statistics screen (words learned per day, hardest words).
- Bulk import (paste "front – back" lines).
- Home-screen widget / daily reminder notification.
