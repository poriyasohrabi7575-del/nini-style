import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
}

const db = admin.firestore();

export default async function handler(req, res) {

  // =========================
  // GET سفارش
  // =========================
  if (req.method === "GET") {
    try {

      const id = req.query?.id;

      // دریافت یک سفارش برای مشتری
      if (id) {

        const doc = await db
          .collection("orders")
          .doc(id)
          .get();

        if (!doc.exists) {
          return res.status(404).json({
            success: false,
            error: "سفارش پیدا نشد"
          });
        }

        const data = doc.data();

        return res.status(200).json({
          success: true,
          order: {
            id: doc.id,
            ...data,
            createdAt: data.createdAt
              ? data.createdAt.toDate().toISOString()
              : null
          }
        });
      }

      // دریافت همه سفارش‌ها برای پنل
      const snapshot = await db
        .collection("orders")
        .orderBy("createdAt", "desc")
        .get();

      const orders = snapshot.docs.map(doc => {

        const data = doc.data();

        return {
          id: doc.id,
          ...data,
          status: data.status || "new",
          createdAt: data.createdAt
            ? data.createdAt.toDate().toISOString()
            : null
        };

      });

      return res.status(200).json({
        success: true,
        orders
      });

    } catch (error) {

      console.error("GET ORDERS ERROR:", error);

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }


  // =========================
  // POST ثبت سفارش
  // =========================
  if (req.method === "POST") {
    try {

      const {
        name,
        mobile,
        postalCode,
        address,
        products,
        quantity,
        totalAmount
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
          success: false,
          error: "اطلاعات سفارش کامل نیست"
        });
      }

      const docRef = await db
        .collection("orders")
        .add({

          name,
          mobile,
          postalCode,
          address,
          products,
          quantity,
          totalAmount,

          status: "new",

          createdAt: admin.firestore.FieldValue.serverTimestamp()

        });

      return res.status(200).json({
        success: true,
        orderId: docRef.id
      });

    } catch (error) {

      console.error("ORDER ERROR:", error);

      return res.status(500).json({
        success: false,
        error: "خطا در ثبت سفارش",
        details: error.message
      });
    }
  }


  // =========================
  // تغییر وضعیت سفارش
  // =========================
  if (req.method === "PATCH") {
    try {

      const {
        id,
        status
      } = req.body;

      const allowedStatuses = [
        "new",
        "preparing",
        "shipped",
        "delivered"
      ];

      if (!id) {
        return res.status(400).json({
          success: false,
          error: "شناسه سفارش ارسال نشده است"
        });
      }

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: "وضعیت سفارش نامعتبر است"
        });
      }

      await db
        .collection("orders")
        .doc(id)
        .update({
          status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

      return res.status(200).json({
        success: true
      });

    } catch (error) {

      console.error("UPDATE ORDER ERROR:", error);

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }


  return res.status(405).json({
    success: false,
    error: "Method not allowed"
  });
}
