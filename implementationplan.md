# Implementation Plan – MyVocabulary

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
| Local storage | **JSON files via `expo-file-system`**, written atomically (write tmp → rename) | Matches "cache on file system"; data size is small (thousands of words). Can swap to `expo-sqlite` later behind the same repository interface. |
| Animations | **react-native-reanimated** + **react-native-gesture-handler** | 60fps flip + swipe on UI thread. |
| Google auth | **`@react-native-google-signin/google-signin`** → access token | Native Android sign-in, no browser redirect juggling. |
| Sheets access | **Sheets REST API v4** via `fetch` with the access token | No heavy Google SDK needed in RN. |
| IDs | UUID v4 per word (`expo-crypto` `randomUUID`) | Stable identity independent of row position. |
| Dates | ISO-like text `YYYY-MM-DD HH:mm` written with `valueInputOption=RAW` | Human-readable in the sheet, sortable, no locale/date-serial surprises. |

---

## 1. Data model

```ts
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
  listId: string | 'all';
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
- `words.json` – all lists + words
- `session.json` – current/last session
- `sync-queue.json` – pending remote operations
- `settings.json` – spreadsheet id, account email, last sync time, preferences

---

## 2. Project structure

```
src/
  app/                       # expo-router screens (only routes live here)
    _layout.tsx              # Stack navigator, loads data, flushes on background
    index.tsx                # Home: "Continue session" / "New session" + word lists
    session/new.tsx          # Filter selection
    session/play.tsx         # Card game
    session/summary.tsx      # Results of the session
    lists/[id].tsx           # Words of a list, rename/delete list
    word.tsx                 # Add / edit word (modal)
    settings.tsx             # Connect / disconnect spreadsheet, sync status
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
- [x] Demo list seeded on first launch.
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
- [x] New-session screen: word list (All words or one list), Added (any time / today / last 7 / last 30 days / picked date – available for a single list too), Last revised (any time / not today / not in 3 days / a week / a month / not since a picked date; never-revised words always match), "Only words I didn't remember" (last answer = no).
- [x] Words are always shuffled: every new session (incl. "repeat the words I missed") and every restart goes through the words in a new random order; Continue keeps the current order.
- [x] Live count on the Start button ("Start · 12 words" / "No words match").
- [x] The last filter is remembered (`settings.json`) and preselected next time; relative choices ("last 7 days") stay relative.
- [x] Home screen: **Continue** (resume at `currentIndex`), **Restart** (same words, reshuffled, from the first card), **New session**. The word set is only recomputed by **New session**.
- [x] Words deleted since the session was created are skipped.
- [x] Session card describes the filter, e.g. "Demo · added since Oct 2, 2026 · don't remember".

> ✅ After Milestone 4 the app is fully usable offline.

### Milestone 5 – Google Sheets connection
- [ ] Switch from Expo Go to an Android **development build** (`npx expo run:android` or `eas build --profile development`); needs JDK 17 (Android Studio's bundled JBR) – the system Java 8 is too old.
- [ ] Google Cloud project: enable **Sheets API** and **Drive API**, create Android OAuth client (package name + SHA-1 of debug & release keystores), configure OAuth consent screen (Testing mode, add yourself as a test user).
- [ ] Scope: **`https://www.googleapis.com/auth/drive.file`** only – the app can access just the files it created itself. It is a *non-sensitive* scope (no Google verification needed, simple consent screen). The Sheets API works with this scope for app-created spreadsheets.
- [ ] `auth/google.ts`: sign in, get access token, silent refresh on 401, sign out.
- [ ] Settings screen: **Connect Google Sheets**:
  1. Sign in.
  2. Look for spreadsheets previously created by the app: Drive `files.list` with `q = mimeType='application/vnd.google-apps.spreadsheet' and trashed=false` (with `drive.file` it returns only app-created files). Also store the spreadsheet id in the file's `appProperties` (`myvocabulary=1`) to recognise it reliably.
  3. Found → reconnect to it (if several, let the user pick). Not found → **create** a new spreadsheet "MyVocabulary" (`spreadsheets.create`).
  4. Show an "Open in Google Sheets" link (`https://docs.google.com/spreadsheets/d/<id>`).
  - Disconnect is also available (keeps local data, stops syncing).
- [ ] `sheetsApi.ts`: `createSpreadsheet`, `getSpreadsheet` (tabs), `batchGetValues`, `appendValues`, `batchUpdateValues`, `batchUpdate` (`addSheet`, `updateSheetProperties` for rename, `insertDimension` for header row); `driveApi.ts`: `listAppSpreadsheets`.
- [ ] `mapper.ts`:
  - header-based column mapping (columns are found by name, case-insensitive, so the user may reorder them);
  - examples newline join/split, date formatting.
- [ ] **Tab parsing** (on every pull, in memory only – nothing is written during the pull):
  - **Header detection:** if row 1 contains `Front` and `Back` (case-insensitive) → it is the header; columns are mapped by name. Otherwise there is no header: all rows are words with the default layout A = Front, B = Back, C = Examples, and the tab is marked `needsHeader`.
  - Missing system columns (`Added`, `LastRevised`, `Remembered`, `Id`) → tab is marked `needsColumns`; they will be appended to the right.
  - Rows with Front/Back but no `Id` → hand-added words: generate `Id`, set `Added = now`, leave `LastRevised`/`Remembered` empty; mark the row `needsSystemCells`. Until the `Id` is written, the row is matched by tab + row content (Front+Back).
  - Completely empty rows are skipped; rows with only Front or only Back are flagged as incomplete (shown in the app, not used in sessions).
- [ ] **Deferred normalisation** – the pending fixes above are added to the sync queue as a normal (non-urgent) item and written with the **next push** (whichever comes first: a new word, a batch of review results, app going to background). Order within that push: insert header row → append missing system columns → write system cells / review updates.
- [ ] **Initial upload on connect**: the spreadsheet is new (created by the app), so every local list simply becomes a new tab with header + all words. The default empty `Sheet1` tab is renamed/reused for the first list. When reconnecting to a previously created spreadsheet, the normal merge from Milestone 6 applies.

### Milestone 6 – Sync engine
**Pull (on app start, on pull-to-refresh, after reconnect):**
1. Read all tabs (except `_*`) with one `values:batchGet`.
2. Parse tabs (header detection / system columns / hand-added rows – see Milestone 5); queue the normalisation for the next push.
3. Merge per word (matched by `Id`):
   - Content fields (`front`, `back`, `examples`, list) – **sheet wins** unless the local word is `dirty` with content changes.
   - Review fields – take the one with the **newer `lastRevisedAt`**.
   - Word in sheet but not local → add locally.
   - Word local but not in sheet → if it was already synced before, it was deleted in the sheet → delete locally; if never synced → keep and push.
   - New tabs → new lists; removed tabs → remove lists (after confirmation if they contain unsynced changes).

**Push:**
- **New words / new lists / renames → immediately** (enqueue + process queue right away).
- **Review updates → batched**: flush every N answers (e.g. 10) or 60s, on app background (`AppState`), and at session end.
- Before updating cells, re-read the `Id` column of affected tabs to map id → current row number (the user may have sorted or inserted rows), then send one `values:batchUpdate`.
- Queue is persisted; on failure (offline / 5xx) retry with backoff; on network regained (`@react-native-community/netinfo`) process the queue.
- Clear `dirty` only after a successful push.

**UI:** sync status indicator (synced / syncing / offline / error) and "last synced at".

### Milestone 7 – Polish & release
- [ ] Empty states, error messages, loading skeletons.
- [ ] Dark mode.
- [ ] App icon, splash screen.
- [ ] Release build via EAS (`.aab` / `.apk`), add release SHA-1 to the OAuth client.
- [ ] Manual test checklist: offline usage, connect later, edit in sheet → sync, add rows by hand with only Front/Back → system columns filled in, new tab without header → words read correctly and header added on the next push, reinstall app → reconnects to the same spreadsheet, sort rows in sheet → swipe updates go to the right rows, kill app mid-session → continue from the same card, restart session.

---

## 4. Risks & notes
- **OAuth scope.** `drive.file` limits the app to files it created. The user cannot point the app at a spreadsheet they made themselves – by design. If that is ever needed, it would require the Google Picker (web-only, would need a WebView) or the broader `spreadsheets` scope.
- **OAuth "Testing" mode.** Refresh tokens of apps in Testing mode expire after 7 days → the user may need to sign in again weekly. Moving the consent screen to "In production" fixes this; with only non-sensitive scopes (`drive.file`) no Google verification is required.
- **Header detection.** A tab whose first data row is literally "Front" / "Back" would be mistaken for a header – acceptable edge case.
- **Row matching before the `Id` is written.** Hand-added rows are matched by Front+Back until the next push writes their `Id`; if the user edits such a row in between, it is treated as a new word. Acceptable, since the next push usually happens within a minute.
- **Concurrent edits.** If the user edits the sheet while the app is pushing, row mapping by `Id` (re-read before write) keeps updates on the correct rows.
- **API quotas.** Sheets API allows ~60 requests/min/user – batching keeps the app far below that.
- **Token expiry.** Access tokens last ~1h; refresh silently via the Google Sign-In library.

---

## 5. Ideas for later
- Spaced repetition (Leitner boxes / SM-2) using a `correctStreak` column and a "due today" filter.
- Text-to-speech for the word and examples (`expo-speech`).
- Statistics screen (words learned per day, hardest words).
- Bulk import (paste "front – back" lines).
- Home-screen widget / daily reminder notification.
