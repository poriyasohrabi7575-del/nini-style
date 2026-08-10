```javascript
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const {
      name,
      mobile,
      postalCode,
      address,
      products,
      quantity,
      totalAmount,
    } = req.body;

    if (
      !name ||
      !mobile ||
      !postalCode ||
      !address ||
      !products ||
      quantity === undefined ||
      totalAmount === undefined
    ) {
      return res.status(400).json({
        error: "اطلاعات سفارش کامل نیست",
      });
    }

    const order = {
      name,
      mobile,
      postalCode,
      address,
      products,
      quantity,
      totalAmount,

      // تاریخ و ساعت واقعی ثبت سفارش
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("orders").add(order);

    return res.status(200).json({
      success: true,
      orderId: docRef.id,
      message: "سفارش با موفقیت ثبت شد",
    });
  } catch (error) {
    console.error("ORDER ERROR:", error);

    return res.status(500).json({
      error: "خطا در ثبت سفارش",
      details: error.message,
    });
  }
}
```
