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

const allowedStatuses = [
  "new",
  "preparing",
  "shipped",
  "delivered"
];

export default async function handler(req, res) {

  // ==========================================
  // GET
  // ==========================================

  if (req.method === "GET") {

    try {

      const id = req.query?.id;

      // دریافت یک سفارش
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

            createdAt:
              data.createdAt
                ? data.createdAt.toDate().toISOString()
                : null,

            customerReceivedAt:
              data.customerReceivedAt
                ? data.customerReceivedAt.toDate().toISOString()
                : null
          }

        });

      }


      // دریافت همه سفارش‌ها
      const snapshot = await db
        .collection("orders")
        .orderBy("createdAt", "desc")
        .get();


      const orders =
        snapshot.docs.map(doc => {

          const data = doc.data();

          return {

            id: doc.id,

            ...data,

            status:
              data.status || "new",

            trackingCode:
              data.trackingCode || "",

            customerReceived:
              data.customerReceived || false,

            customerReceivedAt:
              data.customerReceivedAt
                ? data.customerReceivedAt
                    .toDate()
                    .toISOString()
                : null,

            createdAt:
              data.createdAt
                ? data.createdAt
                    .toDate()
                    .toISOString()
                : null

          };

        });


      return res.status(200).json({

        success: true,

        orders

      });


    } catch (error) {

      console.error(
        "GET ORDERS ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        error:
          error.message

      });

    }

  }



  // ==========================================
  // POST
  // ثبت سفارش جدید
  // ==========================================

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

          error:
            "اطلاعات سفارش کامل نیست"

        });

      }


      const docRef =
        await db
          .collection("orders")
          .add({

            name,

            mobile,

            postalCode,

            address,

            products,

            quantity,

            totalAmount,

            status:
              "new",

            trackingCode:
              "",

            customerReceived:
              false,

            customerReceivedAt:
              null,

            createdAt:
              admin.firestore
                .FieldValue
                .serverTimestamp(),

            updatedAt:
              admin.firestore
                .FieldValue
                .serverTimestamp()

          });


      return res.status(200).json({

        success: true,

        orderId:
          docRef.id,

        status:
          "new"

      });


    } catch (error) {

      console.error(
        "ORDER ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        error:
          "خطا در ثبت سفارش",

        details:
          error.message

      });

    }

  }



  // ==========================================
  // PATCH
  // تغییر وضعیت / کد رهگیری / دریافت مشتری
  // ==========================================

  if (req.method === "PATCH") {

    try {

      const {

        id,
        status,
        trackingCode,
        customerReceived

      } = req.body;


      if (!id) {

        return res.status(400).json({

          success: false,

          error:
            "شناسه سفارش ارسال نشده است"

        });

      }


      const updateData = {

        updatedAt:
          admin.firestore
            .FieldValue
            .serverTimestamp()

      };


      // ==============================
      // وضعیت سفارش
      // ==============================

      if (status !== undefined) {

        if (
          !allowedStatuses.includes(
            status
          )
        ) {

          return res.status(400).json({

            success: false,

            error:
              "وضعیت سفارش نامعتبر است"

          });

        }


        updateData.status =
          status;

      }



      // ==============================
      // کد رهگیری
      // ==============================

      if (
        trackingCode !== undefined
      ) {

        updateData.trackingCode =
          String(
            trackingCode
          ).trim();

      }



      // ==============================
      // اعلام دریافت مشتری
      // ==============================

      if (
        customerReceived === true
      ) {

        updateData.customerReceived =
          true;

        updateData.customerReceivedAt =
          admin.firestore
            .FieldValue
            .serverTimestamp();

      }



      await db
        .collection("orders")
        .doc(id)
        .update(updateData);


      return res.status(200).json({

        success: true

      });


    } catch (error) {

      console.error(
        "UPDATE ORDER ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        error:
          error.message

      });

    }

  }



  // ==========================================
  // DELETE
  // حذف کامل سفارش
  // ==========================================

  if (req.method === "DELETE") {

    try {

      const id =
        req.body?.id ||
        req.query?.id;


      if (!id) {

        return res.status(400).json({

          success: false,

          error:
            "شناسه سفارش ارسال نشده است"

        });

      }


      const orderRef =
        db
          .collection("orders")
          .doc(id);


      const orderDoc =
        await orderRef.get();


      if (!orderDoc.exists) {

        return res.status(404).json({

          success: false,

          error:
            "سفارش پیدا نشد"

        });

      }


      await orderRef.delete();


      console.log(
        "ORDER DELETED:",
        id
      );


      return res.status(200).json({

        success: true,

        message:
          "سفارش با موفقیت حذف شد",

        orderId:
          id

      });


    } catch (error) {

      console.error(
        "DELETE ORDER ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        error:
          "خطا در حذف سفارش",

        details:
          error.message

      });

    }

  }



  // ==========================================
  // متد نامعتبر
  // ==========================================

  return res.status(405).json({

    success: false,

    error:
      "Method not allowed"

  });

}
