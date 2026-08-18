const db = require("../lib/firebaseAdmin");

// =====================================================
// وضعیت‌های مجاز سفارش
// =====================================================

const allowedStatuses = [
  "new",
  "pending_payment",
  "paid",
  "payment_failed",
  "preparing",
  "shipped",
  "delivered",
];


// =====================================================
// تبدیل Timestamp فایربیس به ISO
// =====================================================

function timestampToISOString(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}


// =====================================================
// GET
// دریافت سفارش
// =====================================================

export default async function handler(req, res) {
  try {
    const collection = db.collection("orders");


    // ===================================================
    // GET
    // ===================================================

    if (req.method === "GET") {
      const id = req.query?.id;


      // -------------------------------------------------
      // دریافت یک سفارش
      // -------------------------------------------------

      if (id) {
        const doc = await collection.doc(id).get();

        if (!doc.exists) {
          return res.status(404).json({
            success: false,
            error: "سفارش پیدا نشد",
          });
        }

        const data = doc.data();

        return res.status(200).json({
          success: true,

          order: {
            id: doc.id,
            ...data,

            status: data.status || "new",

            trackingCode:
              data.trackingCode || "",

            customerReceived:
              data.customerReceived || false,

            customerReceivedAt:
              timestampToISOString(
                data.customerReceivedAt
              ),

            createdAt:
              timestampToISOString(
                data.createdAt
              ),

            updatedAt:
              timestampToISOString(
                data.updatedAt
              ),

            paidAt:
              timestampToISOString(
                data.paidAt
              ),

            // -------------------------------------------
            // اطلاعات پرداخت
            // -------------------------------------------

            paymentStatus:
              data.paymentStatus ||
              "unpaid",

            paymentAuthority:
              data.paymentAuthority ||
              "",

            paymentRefId:
              data.paymentRefId ||
              "",
          },
        });
      }


      // -------------------------------------------------
      // دریافت همه سفارش‌ها
      // -------------------------------------------------

      const snapshot = await collection
        .orderBy("createdAt", "desc")
        .get();

      const orders = snapshot.docs.map((doc) => {
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
            timestampToISOString(
              data.customerReceivedAt
            ),

          createdAt:
            timestampToISOString(
              data.createdAt
            ),

          updatedAt:
            timestampToISOString(
              data.updatedAt
            ),

          // -------------------------------------------
          // اطلاعات پرداخت
          // -------------------------------------------

          paymentStatus:
            data.paymentStatus ||
            "unpaid",

          paymentAuthority:
            data.paymentAuthority ||
            "",

          paymentRefId:
            data.paymentRefId ||
            "",

          paidAt:
            timestampToISOString(
              data.paidAt
            ),
        };
      });

      return res.status(200).json({
        success: true,
        orders,
      });
    }


    // ===================================================
    // POST
    // ثبت سفارش جدید
    // ===================================================

    if (req.method === "POST") {
      const {
        name,
        mobile,
        postalCode,
        address,
        products,
        quantity,
        totalAmount,
      } = req.body || {};


      // -------------------------------------------------
      // اعتبارسنجی اولیه
      // -------------------------------------------------

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
          error: "اطلاعات سفارش کامل نیست",
        });
      }


      // -------------------------------------------------
      // ایجاد سفارش
      // -------------------------------------------------

      const docRef = await collection.add({
        name,
        mobile,
        postalCode,
        address,

        products,

        quantity,

        // فعلاً مبلغ فعلی را حفظ می‌کنیم.
        // اعتبارسنجی نهایی مبلغ در API پرداخت انجام می‌شود.
        totalAmount,

        // -----------------------------------------------
        // وضعیت فعلی سفارش
        // -----------------------------------------------

        status: "new",

        // -----------------------------------------------
        // اطلاعات پرداخت
        // -----------------------------------------------

        paymentStatus: "unpaid",

        paymentAuthority: "",

        paymentRefId: "",

        paidAt: null,

        // -----------------------------------------------
        // اطلاعات ارسال
        // -----------------------------------------------

        trackingCode: "",

        customerReceived: false,

        customerReceivedAt: null,

        // -----------------------------------------------
        // زمان‌ها
        // -----------------------------------------------

        createdAt:
          new Date(),

        updatedAt:
          new Date(),
      });


      return res.status(200).json({
        success: true,

        orderId:
          docRef.id,

        status:
          "new",

        paymentStatus:
          "unpaid",
      });
    }


    // ===================================================
    // PATCH
    // تغییر وضعیت / پرداخت / رهگیری / دریافت مشتری
    // ===================================================

    if (req.method === "PATCH") {
      const {
        id,
        status,
        trackingCode,
        customerReceived,

        // اطلاعات پرداخت
        paymentStatus,
        paymentAuthority,
        paymentRefId,
        paidAt,
      } = req.body || {};


      // -------------------------------------------------
      // بررسی شناسه
      // -------------------------------------------------

      if (!id) {
        return res.status(400).json({
          success: false,
          error:
            "شناسه سفارش ارسال نشده است",
        });
      }


      // -------------------------------------------------
      // بررسی وجود سفارش
      // -------------------------------------------------

      const orderRef =
        collection.doc(id);

      const orderDoc =
        await orderRef.get();

      if (!orderDoc.exists) {
        return res.status(404).json({
          success: false,
          error:
            "سفارش پیدا نشد",
        });
      }


      // -------------------------------------------------
      // اطلاعات قابل بروزرسانی
      // -------------------------------------------------

      const updateData = {
        updatedAt:
          new Date(),
      };


      // =================================================
      // وضعیت سفارش
      // =================================================

      if (status !== undefined) {
        if (
          !allowedStatuses.includes(
            status
          )
        ) {
          return res.status(400).json({
            success: false,
            error:
              "وضعیت سفارش نامعتبر است",
          });
        }

        updateData.status =
          status;
      }


      // =================================================
      // وضعیت پرداخت
      // =================================================

      if (
        paymentStatus !== undefined
      ) {
        const allowedPaymentStatuses = [
          "unpaid",
          "pending",
          "paid",
          "failed",
        ];

        if (
          !allowedPaymentStatuses.includes(
            paymentStatus
          )
        ) {
          return res.status(400).json({
            success: false,
            error:
              "وضعیت پرداخت نامعتبر است",
          });
        }

        updateData.paymentStatus =
          paymentStatus;
      }


      // =================================================
      // Authority زرین‌پال
      // =================================================

      if (
        paymentAuthority !== undefined
      ) {
        updateData.paymentAuthority =
          String(
            paymentAuthority
          ).trim();
      }


      // =================================================
      // Ref ID زرین‌پال
      // =================================================

      if (
        paymentRefId !== undefined
      ) {
        updateData.paymentRefId =
          String(
            paymentRefId
          ).trim();
      }


      // =================================================
      // زمان پرداخت
      // =================================================

      if (
        paidAt !== undefined
      ) {
        updateData.paidAt =
          paidAt
            ? new Date(paidAt)
            : null;
      }


      // =================================================
      // کد رهگیری
      // =================================================

      if (
        trackingCode !== undefined
      ) {
        updateData.trackingCode =
          String(
            trackingCode
          ).trim();
      }


      // =================================================
      // اعلام دریافت مشتری
      // =================================================

      if (
        customerReceived === true
      ) {
        updateData.customerReceived =
          true;

        updateData.customerReceivedAt =
          new Date();
      }


      // =================================================
      // بروزرسانی
      // =================================================

      await orderRef.update(
        updateData
      );


      return res.status(200).json({
        success: true,
      });
    }


    // ===================================================
    // DELETE
    // حذف کامل سفارش
    // ===================================================

    if (req.method === "DELETE") {
      const id =
        req.body?.id ||
        req.query?.id;


      if (!id) {
        return res.status(400).json({
          success: false,
          error:
            "شناسه سفارش ارسال نشده است",
        });
      }


      const orderRef =
        collection.doc(id);

      const orderDoc =
        await orderRef.get();


      if (!orderDoc.exists) {
        return res.status(404).json({
          success: false,
          error:
            "سفارش پیدا نشد",
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
          id,
      });
    }


    // ===================================================
    // متد غیرمجاز
    // ===================================================

    return res.status(405).json({
      success: false,
      error:
        "Method not allowed",
    });

  } catch (error) {

    console.error(
      "ORDER API ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      error:
        "خطا در پردازش سفارش",

      details:
        error.message,
    });
  }
}
