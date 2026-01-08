import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCNcyfWOjfrKl_miE23yctMRvHoejUW068",
  authDomain: "munchkin-game.firebaseapp.com",
  // ДОДАЄМО ЦЕЙ РЯДОК НИЖЧЕ:
  databaseURL: "https://munchkin-game-default-rtdb.europe-west1.firebasedatabase.app", 
  projectId: "munchkin-game",
  storageBucket: "munchkin-game.firebasestorage.app",
  messagingSenderId: "936960956282",
  appId: "1:936960956282:web:5db37009a5601e6a5ee8c3"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);