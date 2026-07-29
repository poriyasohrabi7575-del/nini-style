import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyClt2axVJvvmc27LviTzp3cijZ-8oo",
  authDomain: "nini-style.firebaseapp.com",
  projectId: "nini-style",
  storageBucket: "nini-style.firebasestorage.app",
  messagingSenderId: "935164642738",
  appId: "1:935164642738:web:33ecf6b01c00f9f08b10ab",
  measurementId: "G-XWDZJ4J9M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default async function handler(req, res) {
  try {
    const snapshot = await getDocs(collection(db, "products"));

    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json(products);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
}
