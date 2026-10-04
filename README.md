# SwipeWise

An Android app (React Native) for growing your foreign-language vocabulary with flashcards.
Learning several languages? Each one gets its own **course** with its own word lists. A course's
words live in a Google Spreadsheet that you can edit directly, but the app also works fully offline
with a local cache and no spreadsheet at all.

---

## Core idea

Each word is a two-sided card:

| Front (prompt)          | Back (answer)                                 |
|-------------------------|-----------------------------------------------|
| `машина`                | **car**                                       |
|                         | *Don't drive your car too fast.*              |

1. The app shows the **front** (definition / translation in your native language).
2. You try to recall the word, then **tap the card** to flip it.
3. The **back** shows the word plus optional usage examples.
4. Once the back is visible, you **swipe**:
   - **Swipe right** – "I remembered it"
   - **Swipe left** – "I didn't remember it"
5. The word's *last revised* time and *remembered* flag are updated, and the next card appears.

---

## Features

### Courses
- A **course** is everything you study for one language: its word lists, sessions and spreadsheet.
  Studying English and Spanish? Create two courses, and their words never mix.
- When creating a course you pick the **language you are learning** (e.g. English (UK), Spanish (Spain)).
  The name defaults to the language and can be changed, so you can also have, say, "Spanish" and
  "Spanish for work".
- The language is stored as a standard language code (`en-GB`, `es-ES`, …), ready for pronunciation
  in a later version.
- The current course is shown at the top of the home screen; tap it to **switch courses** or create a new one.
  The app opens the course you used last.
- Courses can be renamed or deleted (deleting a course deletes its words on the phone; its spreadsheet stays
  in your Google Drive).
- Everything below works **inside the current course**.

### Word lists (groups)
- Words are organised into **lists** (groups), e.g. "Travel", "Kitchen", "Verbs".
- Lists can be created, renamed, and filled with words **from inside the app**.
- Lists can also be created and edited **directly in Google Sheets** – the app picks up the changes on the next sync.
- Every list has a **creation date**. The home screen shows the newest lists; **All lists** has search,
  sorting (newest / oldest / A–Z) and month headings, so hundreds of lists stay manageable.

### Study sessions
When starting a new session you choose which words to practise:

| Filter              | Description                                                                 |
|---------------------|-----------------------------------------------------------------------------|
| **Word lists**      | **All words**, or one or several lists practised together.                  |
| **Added since**     | Only words added after a given date (works for a single list or all words). |
| **Last revised**    | Only words not revised since a given date (or never revised).               |
| **Don't remember**  | Only words whose last answer was "didn't remember".                         |

Filters can be combined. The resulting list of words is **frozen** for the session and shown in a
**new random order** every time a session is started or restarted.

### Session continuity
- When you open the app, it offers to **continue the last session** from the card where you stopped –
  with the same set of words that was selected last time, even though their *last revised* values
  have changed since then.
- A **Restart session** button goes over the same set of words again from the first card, in a new order.
- The word set is only recalculated when you explicitly **start a new session** with new filters.
- **Recent sessions:** the last 5 sessions are kept. Pick any of them to continue it where you stopped
  (or, if it was finished, to go over it again). Starting a session with the same filters as a recent
  one replaces it, so the list doesn't fill up with duplicates.

### Tracking progress
Every word stores:
- **Added** – when the word was added
- **Last revised** – when the word was last shown and answered
- **Remembered** – whether you remembered it the last time it was revised (`yes` / `no` / empty for never revised).
  The *Don't remember* filter uses only this last answer.

### Storage and sync
- **Offline first.** All data is kept in a local cache on the device file system. The app is fully
  usable without any spreadsheet connected.
- **Google Sheets (optional).** Each course has its own spreadsheet, which is the "source of truth" when connected:
  - You sign in with your Google account once; each course is then connected separately
    (Courses → ✏️ → **Connect Google Sheets**).
  - The **app creates the spreadsheet** (e.g. "SwipeWise – English") in your Google Drive when you connect
    a course. After that you can open and edit it in Google Sheets like any other spreadsheet.
  - The app can access **only the files it created** – not the rest of your Google Drive or your other
    spreadsheets.
  - Each **tab** in the spreadsheet = one **word list**.
  - The spreadsheet can be **connected at any time later** – all local lists are then uploaded to it,
    one tab per list.
  - After reinstalling the app (or on a new phone), signing in with the same Google account finds the
    spreadsheets created earlier and restores your courses from them.
- **Sync rules**
  - Only the current course is synced; another course syncs when you switch to it.
  - **From the sheet:** on app start, when switching course, when returning to the app after a few minutes,
    on pull-to-refresh and on **Sync now**. The cache is shown instantly and refreshed in the background.
    Fix-ups for rows and tabs you added by hand (ids, dates, header row) are written right after reading.
  - **To the sheet:** word and list changes **right away**; review results (swipes) when a session finishes,
    when the app goes to background, and on the next start.
  - If the device is offline, changes stay on the phone marked as not synced and are pushed later.
  - The sync status is shown as a cloud icon on the home screen and in the course list.

---

## Spreadsheet format

One spreadsheet per course, one tab per word list (e.g. tab `Travel - 2026-10-04`). The first row is normally a header:

| Front    | Back | Examples                          | Added               | LastRevised         | Remembered | Id         |
|----------|------|-----------------------------------|---------------------|---------------------|------------|------------|
| машина   | car  | Don't drive your car too fast.    | 2026-10-04 20:15    | 2026-10-05 08:01    | yes        | a1b2c3...  |
| яблоко   | apple| An apple a day keeps the doctor away. | 2026-10-04 20:16 |                     |            | d4e5f6...  |

### Adding words by hand
When typing words directly into the sheet you only need **Front**, **Back** and (optionally) **Examples**.
The system columns – **Added**, **LastRevised**, **Remembered**, **Id** – are filled in by the app
automatically. Even the header row and missing system columns are added by the app, so a brand-new
tab can contain nothing but words.

**Header detection:** if the first row of a tab has `Front` / `Back` in it, it is treated as the header.
Otherwise every row is treated as a word (column A = Front, B = Back, C = Examples), and the app inserts
the header row the next time it pushes data to the spreadsheet. The same applies to system values of
hand-added rows – they are calculated as soon as the app sees the row and written to the sheet with the
next push.

- **Front**, **Back** – required.
- **Examples** – multiple examples are separated by a new line inside the cell (Ctrl+Enter in Sheets).
- **Added** – set to the time the app first saw the row.
- **Id** – technical column managed by the app (lets the app match rows even if you sort or move them).
- Columns are recognised by their header name, so you can reorder them freely.
- Tabs whose names start with `_` (e.g. `_notes`) are ignored by the app.
- Tab names end with the list's creation date: `Travel - 2026-10-04`. A tab you add by hand without a
  date is dated the day the app first sees it, and the app adds the date to its name.

---

## Tech stack

- **React Native** + **Expo** (TypeScript), Android target
- **react-native-gesture-handler** + **react-native-reanimated** – card flip and swipe animations
- **expo-file-system** – local cache
- **Zustand** – app state
- **Google Sign-In** + **Google Sheets API v4** – spreadsheet storage

See [implementationplan.md](implementationplan.md) for the implementation plan.

**Status:** the offline app is complete (milestones 1–4: word lists, flashcards, session filters and
continuity, plus courses). Google Sheets sync (milestones 5–6) is next.

---

## Development

```bash
npm install
npm start            # start Metro; scan the QR code with Expo Go on your phone, or press "a" for an emulator
npm test             # unit tests (Jest)
npm run typecheck    # TypeScript
npm run lint         # ESLint
```

Local data is stored in the app's documents folder under `myvocabulary/`: `courses.json` (the courses and
the current one) and a folder per course, `courses/<id>/`, with `words.json`, `sessions.json` and `settings.json`.
