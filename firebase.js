import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA7nSceEW016Tjr0nkZaIMCWLAhLXsNCXs",
  authDomain: "frostcargo-69bf2.firebaseapp.com",
  projectId: "frostcargo-69bf2",
  storageBucket: "frostcargo-69bf2.firebasestorage.app",
  messagingSenderId: "179639564391",
  appId: "1:179639564391:web:b00e7495ad7dcd6df67cc2",
  measurementId: "G-WG470FV1E1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };