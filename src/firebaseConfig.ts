import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDjMUEHFjYJ3J3ncWZhVI7KvErwD0JlGiA",
  authDomain: "nextjs-teste-9c06c.firebaseapp.com",
  projectId: "nextjs-teste-9c06c",
  storageBucket: "nextjs-teste-9c06c.firebasestorage.app",
  messagingSenderId: "532623484087",
  appId: "1:532623484087:web:6b38c2a87c3ea60d1c5932"
};

// Initialize Firebase only if it hasn't been initialized already
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Export the app instance as well
export default app;

// Debug: Log initialization
console.log("Firebase initialized:", {
  app: app.name,
  auth: auth.app.name,
  db: db.app.name
});