export const firebaseConfig = {
  apiKey: "AIzaSyBPQq84aijaQIRe5aXuTbvUBM_-HGx_Ojg",
  authDomain: "smsv2-b09e8.firebaseapp.com",
  projectId: "smsv2-b09e8",
  storageBucket: "smsv2-b09e8.firebasestorage.app",
  messagingSenderId: "820027511232",
  appId: "1:820027511232:web:1d47d868aa07621893b825",
  measurementId: "G-ZC169VHDY1"
};
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, increment, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, increment, runTransaction };