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

          createdAt: data.createdAt
            ? data.createdAt.toDate().toISOString()
            : null
        };

      });

      return res.status(200).json({
        success: true,
        orders: orders
      });

    } catch (error) {

      console.error(
        "GET ORDERS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        error: error.message
      });

    }
  }


  // =========================
  // ثبت سفارش جدید
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

      const order = {

        name: name,

        mobile: mobile,

        postalCode: postalCode,

        address: address,

        products: products,

        quantity: quantity,

        totalAmount: totalAmount,

        createdAt: new Date()

      };

      const docRef = await db
        .collection("orders")
        .add(order);

      return res.status(200).json({

        success: true,

        orderId: docRef.id,

        message: "سفارش با موفقیت ثبت شد"

      });

    } catch (error) {

      console.error(
        "ORDER ERROR:",
        error
      );

      return res.status(500).json({

        error: "خطا در ثبت سفارش",

        details: error.message

      });

    }

  }


  // =========================
  // متد غیرمجاز
  // =========================
  return res.status(405).json({
    error: "Method not allowed"
  });

}
