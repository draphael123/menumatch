// Firebase project configuration for menumatch-b2ad4.
// These values are safe to commit — they identify the project publicly;
// security comes from Firestore rules + authorized domains, not secrecy.
// See FIREBASE_SETUP.md for how this project was configured.
export const firebaseConfig = {
  apiKey: 'AIzaSyDlPlJzrJbTXuUoJ4ornue3GWVllnQvW0A',
  // Same-origin auth: vercel.json proxies /__/* to the Firebase auth
  // handler, so popups/redirects never depend on third-party storage.
  authDomain: 'menumatch-beta.vercel.app',
  projectId: 'menumatch-b2ad4',
  storageBucket: 'menumatch-b2ad4.firebasestorage.app',
  messagingSenderId: '388477164591',
  appId: '1:388477164591:web:bf04c842392c166d15fada',
};
