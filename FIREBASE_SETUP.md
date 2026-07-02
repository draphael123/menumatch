# Firebase setup (one-time, ~10 minutes)

MenuMatch works without any of this (local-only mode — the sign-in button
stays hidden). Completing these steps turns on "Sign in with Google" and
cross-device sync of the diet card + saved places.

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com → **Add project**.
2. Name it `menumatch` (any name works). Google Analytics: **disable** (not needed).
3. When the project opens, click the **`</>` (Web)** icon to add a web app.
   Nickname: `menumatch-web`. Don't check Firebase Hosting.
4. It shows a `firebaseConfig` code block. **Copy the object** and paste its
   values into [`firebase-config.js`](firebase-config.js) in this repo,
   replacing the `PASTE_...` placeholders. These values are safe to commit.

## 2. Enable Google sign-in

1. In the left sidebar: **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Google** → Enable.
3. Set the support email (your own) → **Save**.
4. Still in Authentication: **Settings** tab → **Authorized domains** →
   **Add domain** → `menumatch-beta.vercel.app`.
   (`localhost` is already allowed for local testing. Vercel *preview* URLs
   have random subdomains, so sign-in won't work on PR previews — that's
   expected; everything else on a preview still works.)

## 3. Create the Firestore database

1. Left sidebar: **Build → Firestore Database → Create database**.
2. Location: `nam5 (United States)` (or nearest). Start in **production mode**.
3. Open the **Rules** tab and replace the contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Each user can read/write only their own document.
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

4. Click **Publish**.

## 4. Deploy

Commit the updated `firebase-config.js` and push. Once Vercel deploys,
the "Sign in with Google" button appears in the sidebar.

## How sync behaves

- **Logged out:** everything saves to this browser only (exactly as before).
- **First sign-in:** your existing local diet card and saved places are
  uploaded to your account automatically.
- **After that:** every edit saves locally *and* to the cloud (debounced),
  so your profile follows you across devices. On sign-in from a new device,
  the cloud profile wins; saved places are merged by place id.
- **Data stored per user:** one Firestore document `users/{uid}` containing
  the diet profile (restrictions + safe foods), saved places, email, and name.
