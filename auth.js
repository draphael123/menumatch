// ── Google sign-in + cloud sync (Firebase Auth + Firestore) ──
// Loads as a module AFTER app.js. The app works fully logged-out (localStorage
// only); signing in adds cross-device sync of the diet profile + saved places.
//
// Contract with app.js:
//   mmGetCloudSnapshot()      → { profile, savedPlaces } current local data
//   mmApplyCloudData(data)    → replace local data + re-render (no push loop)
//   window.mmCloudPush()      → set here; app.js calls it after local saves
import { firebaseConfig } from './firebase-config.js?v=1';

const configured =
  firebaseConfig?.apiKey && !String(firebaseConfig.apiKey).startsWith('PASTE_');

const box = document.getElementById('accountBox');

if (!configured) {
  // Local-only mode: hide the account UI entirely.
  console.info('MenuMatch: Firebase not configured — running local-only. See FIREBASE_SETUP.md');
} else {
  init().catch(err => console.error('MenuMatch auth init failed:', err));
}

async function init() {
  // Dynamic imports so an unconfigured deploy never downloads Firebase.
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'),
  ]);

  const app = initializeApp(firebaseConfig);
  const authInst = auth.getAuth(app);
  const db = fs.getFirestore(app);

  let currentUser = null;
  let pushTimer = null;

  const userDocRef = () => fs.doc(db, 'users', currentUser.uid);

  // ── Account UI (sidebar) ──
  function renderAccount() {
    if (!box) return;
    box.style.display = '';
    if (!currentUser) {
      box.innerHTML = `
        <button class="google-signin-btn" id="signinBtn">
          <i class="ti ti-brand-google" aria-hidden="true"></i> Sign in with Google
        </button>
        <div class="account-hint">Sync your diet card &amp; saved places across devices</div>`;
      box.querySelector('#signinBtn').addEventListener('click', signIn);
    } else {
      const name = currentUser.displayName || currentUser.email || 'Signed in';
      const photo = currentUser.photoURL;
      box.innerHTML = `
        <div class="account-row">
          ${photo
            ? `<img class="account-avatar" src="${photo}" alt="" referrerpolicy="no-referrer">`
            : `<div class="account-avatar account-avatar-fallback"><i class="ti ti-user" aria-hidden="true"></i></div>`}
          <div class="account-info">
            <div class="account-name" title="${currentUser.email || ''}">${name}</div>
            <div class="account-sync" id="syncStatus"><i class="ti ti-cloud-check" aria-hidden="true"></i> Synced</div>
          </div>
          <button class="account-signout" id="signoutBtn" title="Sign out" aria-label="Sign out">
            <i class="ti ti-logout" aria-hidden="true"></i>
          </button>
        </div>`;
      box.querySelector('#signoutBtn').addEventListener('click', () => auth.signOut(authInst));
    }
  }

  function setSyncStatus(state) {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    if (state === 'syncing') el.innerHTML = '<i class="ti ti-cloud-up" aria-hidden="true"></i> Syncing…';
    else if (state === 'error') el.innerHTML = '<i class="ti ti-cloud-x" aria-hidden="true"></i> Sync failed';
    else el.innerHTML = '<i class="ti ti-cloud-check" aria-hidden="true"></i> Synced';
  }

  async function signIn() {
    const provider = new auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(authInst, provider);
    } catch (err) {
      // Popup blockers / iOS standalone mode: fall back to full redirect.
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
        await auth.signInWithRedirect(authInst, provider);
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        console.error('Sign-in failed:', err);
        alert('Sign-in failed: ' + (err.message || err.code));
      }
    }
  }

  // ── Cloud sync ──
  // Firestore rejects `undefined` values; JSON round-trip strips them.
  const clean = obj => JSON.parse(JSON.stringify(obj ?? null));

  async function pushNow() {
    if (!currentUser) return;
    const snap = window.mmGetCloudSnapshot ? window.mmGetCloudSnapshot() : null;
    if (!snap) return;
    setSyncStatus('syncing');
    try {
      await fs.setDoc(userDocRef(), {
        profile: clean(snap.profile),
        savedPlaces: clean(snap.savedPlaces || []),
        email: currentUser.email || null,
        name: currentUser.displayName || null,
        updatedAt: fs.serverTimestamp(),
      });
      setSyncStatus('ok');
    } catch (err) {
      console.error('Cloud push failed:', err);
      setSyncStatus('error');
    }
  }

  // Debounced push — app.js calls this after every local save (typing a note
  // fires per keystroke, so coalesce).
  window.mmCloudPush = function () {
    if (!currentUser) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, 1200);
  };

  // Saved places: union by id, cloud wins on conflicts (it may hold newer
  // notes from another device).
  function mergePlaces(local = [], cloud = []) {
    const byId = new Map();
    for (const p of local) if (p && p.id) byId.set(p.id, p);
    for (const p of cloud) if (p && p.id) byId.set(p.id, p);
    return [...byId.values()].sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
  }

  async function pullAndMerge() {
    const local = window.mmGetCloudSnapshot ? window.mmGetCloudSnapshot() : { profile: null, savedPlaces: [] };
    setSyncStatus('syncing');
    try {
      const docSnap = await fs.getDoc(userDocRef());
      if (docSnap.exists()) {
        const cloud = docSnap.data();
        const merged = {
          // Cloud profile is the source of truth once an account exists.
          profile: (cloud.profile && Array.isArray(cloud.profile.restrictions)) ? cloud.profile : local.profile,
          savedPlaces: mergePlaces(local.savedPlaces, cloud.savedPlaces),
        };
        if (window.mmApplyCloudData) window.mmApplyCloudData(merged);
      }
      // First login: seed the cloud with whatever was built locally.
      // (Also re-push after a merge so both sides converge.)
      await pushNow();
    } catch (err) {
      console.error('Cloud pull failed:', err);
      setSyncStatus('error');
    }
  }

  // Completes the signInWithRedirect flow, if one is in flight.
  auth.getRedirectResult(authInst).catch(() => {});

  auth.onAuthStateChanged(authInst, user => {
    currentUser = user;
    renderAccount();
    if (user) pullAndMerge();
  });

  renderAccount();
}
