const db = require("../lib/firebaseAdmin");

export default async function handler(req, res) {

  // =========================
  // دریافت سفارش‌ها
  // =========================
  if (req.method === "GET") {
    try {

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
  // ثبت سفارش
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

          createdAt: new Date()
        });

      return res.status(200).json({
        success: true,
        orderId: docRef.id
      });

    } catch (error) {

      console.error("ORDER ERROR:", error);

      return res.status(500).json({
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
          error: "شناسه سفارش ارسال نشده است"
        });
      }

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          error: "وضعیت سفارش نامعتبر است"
        });
      }

      await db
        .collection("orders")
        .doc(id)
        .update({
          status,
          updatedAt: new Date()
        });

      return res.status(200).json({
        success: true
      });

    } catch (error) {

      console.error("UPDATE ORDER ERROR:", error);

      return res.status(500).json({
        error: error.message
      });
    }
  }


  return res.status(405).json({
    error: "Method not allowed"
  });
}
