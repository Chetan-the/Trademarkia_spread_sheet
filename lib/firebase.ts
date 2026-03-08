import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAccEckmc-6wcaryYKGS7YJpguEfiQq2Fk",
  authDomain: "spreadhseet-a8bc3.firebaseapp.com",
  projectId: "spreadhseet-a8bc3",
  storageBucket: "spreadhseet-a8bc3.firebasestorage.app",
  messagingSenderId: "1069515297323",
  appId: "1:1069515297323:web:bc3ae263fa125116d6106e",
  measurementId: "G-T8N0TNZ9NL"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const rtdb = getDatabase(app);