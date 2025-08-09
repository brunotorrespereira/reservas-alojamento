import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Configuração temporária com chaves hardcoded
const firebaseConfig = {
  apiKey: "AIzaSyCAs6zdaK10zA7wPCUZjPr8W4XfEJodHGI",
  authDomain: "reservas-alojamentos.firebaseapp.com",
  projectId: "reservas-alojamentos",
  storageBucket: "reservas-alojamentos.firebasestorage.app",
  messagingSenderId: "109231578163",
  appId: "1:109231578163:web:67094368f86b375d841746"
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