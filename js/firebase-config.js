// ============================================================
// FIREBASE - Configuración e inicialización central
// ============================================================
// Este archivo se encarga SOLO de inicializar Firebase.
// Todos los demás archivos (login.js, index.js, etc.) importan
// "auth" desde aquí, para no inicializar Firebase varias veces.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyClVaNwLm46yiC9AqGHdDO7WjPxn7JbAz8",
  authDomain: "prueba1ace.firebaseapp.com",
  projectId: "prueba1ace",
  storageBucket: "prueba1ace.firebasestorage.app",
  messagingSenderId: "1087315378491",
  appId: "1:1087315378491:web:88bc22092e9c8279e8f71e",
  measurementId: "G-SPF1EQGLRB",
};

// Inicializa Firebase y sus servicios
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

// Exporta "auth" (y "app" por si lo necesitas en otro archivo)
export { app, auth };

