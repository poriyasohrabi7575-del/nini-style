import admin from "firebase-admin";

const privateKey = process.env.FIREBASE_PRIVATE_KEY
console.log("KEY START:", privateKey?.substring(0, 30));
console.log("KEY END:", privateKey?.substring(privateKey.length - 30));
  ?.replace(/\\n/g, "\n")
  .replace(/^"|"$/g, "")
  .trim();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

const db = admin.firestore();

export default db;
