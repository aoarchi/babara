import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCaJMI7rgUF0ortiwJ6GNLn0J7tozCuxsk",
  authDomain: "babara-63621.firebaseapp.com",
  projectId: "babara-63621",
  storageBucket: "babara-63621.firebasestorage.app",
  messagingSenderId: "525756778394",
  appId: "1:525756778394:web:8ca3cf16bd4367226edc23",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);
