# Publishing SwipeWise on Google Play

A step-by-step guide for publishing the app with **your own signing key** (kept in `~/.swipewise/`, see
[TECHNICAL.md](TECHNICAL.md)) and **Play App Signing**. Google changes the Play Console from time to time –
menu names below may differ slightly, and requirements marked *(check)* are worth confirming in the console.

---

## Overview

1. Create a Google Play developer account.
2. Prepare: privacy policy, store texts, graphics.
3. Build an **Android App Bundle** (`.aab`).
4. Create the app in Play Console and fill in the required forms.
5. Upload to **internal testing** → install from the Play Store on your phone.
6. Register Google's signing key for Google Sign-In.
7. Move the Google OAuth consent screen to *In production*.
8. (Optional) Closed testing → production (public).

---

## 1. Developer account

- Sign up at [play.google.com/console](https://play.google.com/console) with a Google account.
- One-time fee: **$25**. Identity verification (ID document; for a personal account also a phone and an Android device
  check) can take a few days.
- **Personal accounts** created recently must run a **closed test with at least 12 testers for 14 days** before they
  can publish to production *(check – this rule has changed before)*. Internal testing (just you) has no such
  requirement, so you can use the app from the Play Store right away.

## 2. What to prepare

| Item | Notes |
|---|---|
| **Privacy policy URL** | Required (the app signs in with Google). A short page is enough, e.g. hosted with GitHub Pages from this repo. Content: what the app stores (word lists on the phone and in the user's own Google Drive), that it uses Google Sign-In only to access spreadsheets it created (`drive.file`), that no data goes to the developer, no ads, no analytics, and how to delete data (uninstall; delete the spreadsheet in Drive). |
| **App name** | SwipeWise (max 30 characters). |
| **Short description** | Max 80 characters, e.g. *Learn foreign words with flashcards – flip, swipe, remember.* |
| **Full description** | Max 4000 characters – the [README](README.md) features list is a good start. |
| **App icon** | 512 × 512 PNG – export `icon` at 512 from `assets/icon-source.html`. |
| **Feature graphic** | 1024 × 500 PNG/JPG (banner at the top of the listing). |
| **Phone screenshots** | At least 2 (16:9 or 9:16, 320–3840 px), e.g. home, a card, the session filter, the course screen. |
| **Contact email** | Shown publicly on the listing. |

## 3. Build the app bundle

Play requires an `.aab` (the `.apk` is only for installing directly).

1. Raise the version in `app.json` for every upload: `version` (shown to users, e.g. `1.0.1`) and
   `android.versionCode` (a whole number that must grow with every upload: 1, 2, 3…).
2. Build (with `JAVA_HOME` set to JDK 21):
   ```bash
   npx expo prebuild --platform android
   cd android && ./gradlew bundleRelease
   ```
3. The bundle is `android/app/build/outputs/bundle/release/app-release.aab`. It is signed with your key from
   `~/.swipewise/` – for Play this key becomes the **upload key**.

## 4. Create the app in Play Console

1. **Create app**: name *SwipeWise*, default language, *App*, *Free*, accept the declarations.
2. **App signing:** keep **Play App Signing** (the default). Google creates and keeps the key that signs the app on
   users' phones; your key only proves that uploads come from you. If you ever lose your key, Google can reset the
   upload key – a lost key is no longer fatal.
3. Fill in the **App content** section (Policy → App content):
   - **Privacy policy:** the URL from step 2.
   - **App access:** all features are available without special access (Google Sign-In is optional and uses the
     tester's own account) – say so, or provide instructions.
   - **Ads:** no ads.
   - **Content rating:** questionnaire – an education / reference app without user-generated public content; results
     in the lowest rating.
   - **Target audience:** e.g. 13+ or 18+ (choosing under-13 brings extra Families requirements).
   - **Data safety:** answer honestly. Typical answers for SwipeWise: no data is collected by or shared with the
     developer; the user's word lists are stored on the device and, if the user connects Google Sheets, in the user's
     own Google Drive through Google's APIs; data is encrypted in transit (HTTPS); users can delete their data
     (uninstall the app, delete the spreadsheet). The Google account email is used only on the device for sign-in.
     *(check the current wording of the form)*
   - Government / financial / health / news declarations: not applicable.
4. **Store listing** (Grow → Store presence → Main store listing): texts and graphics from step 2. Category:
   *Education*.

## 5. Internal testing – install from the Play Store

1. Test and release → Testing → **Internal testing** → *Create new release*.
2. Upload `app-release.aab`, add release notes (e.g. "First version"), save, review, **Start rollout**.
3. Testers tab: create an email list with your Google account, copy the **opt-in link**, open it on your phone,
   accept, then install SwipeWise from the Play Store. Updates arrive through the Play Store like for any app.
4. Internal tests are available within minutes and need no Google review.

> An app installed from the Play Store is signed with Google's key, so it can't be updated by the `.apk` you install
> by hand (and vice versa). Uninstall the hand-installed one first – sync before uninstalling.

## 6. Google Sign-In for the Play version

Apps from the Play Store are signed with **Google's app signing key**, which has its own SHA-1.

1. Play Console → Test and release → **App integrity** → *App signing*: copy the **SHA-1 of the app signing key**.
2. Google Cloud Console → Google Auth Platform → Clients → **Create client → Android**: package `com.swipewise.app`
   and that SHA-1.
3. Keep the existing clients (debug key for development, your own key for hand-installed APKs).

Without this step, Google Sign-In in the Play version fails ("developer error").

## 7. Google OAuth consent screen → production

While the consent screen is in *Testing*, only listed test users can sign in and sign-ins expire after 7 days.

1. Google Auth Platform → **Audience** → *Publish app* (→ *In production*).
2. SwipeWise only uses `drive.file`, a non-sensitive scope, so **no Google verification** is needed. Google may still
   ask to verify the brand (app name, logo, homepage, privacy policy URL) if a logo is shown on the consent screen –
   leaving the logo empty avoids that.
3. Fill in the **privacy policy** and **homepage** links on the Branding page (the same privacy policy URL works).

## 8. Closed testing and production (optional)

1. **Closed testing:** create a track, add testers (an email list or a Google Group), roll out the same bundle. For a
   new personal account: keep at least 12 testers opted in for 14 days *(check)*.
2. Then Dashboard → **Apply for production access** – answer the questions about the test.
3. **Production:** create a release (or promote the tested one), roll out – optionally to a percentage of users first.
   The first review usually takes from a few hours to a few days.

## Every next release

1. Raise `version` and `android.versionCode` in `app.json`.
2. `npx expo prebuild --platform android && cd android && ./gradlew bundleRelease`
3. Upload the `.aab` to the track (internal testing → closed → production), add release notes, roll out.
4. Run the manual test checklist in [TECHNICAL.md](TECHNICAL.md) first.
