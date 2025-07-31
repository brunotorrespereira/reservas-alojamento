import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Verificar se as variáveis de ambiente estão carregadas
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.warn("⚠️ Variáveis de ambiente não carregadas. Verifique o arquivo .env.local");
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
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