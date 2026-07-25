import { createServer } from "vite";

const firebaseKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

for (const key of firebaseKeys) {
  delete process.env[key];
}

const server = await createServer({
  configFile: false,
  envDir: false,
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const firebase = await server.ssrLoadModule("/src/lib/firebase.ts");

  if (
    firebase.isFirebaseConfigured !== false ||
    firebase.db !== null ||
    firebase.auth !== null
  ) {
    throw new Error("Firebase services initialized without configuration.");
  }

  console.log("Local fallback verified: Firebase remains uninitialized.");
} finally {
  await server.close();
}
