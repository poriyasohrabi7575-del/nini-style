const db = require("../../lib/firebaseAdmin");

const ZARINPAL_VERIFY_URL =
  "https://payment.zarinpal.com/pg/v4/payment/verify.json";

const ZARINPAL_STARTPAY_URL =
  "https://payment.zarinpal.com/pg/StartPay/";

export default async function handler(req, res) {
  try {
    // =====================================================
    // فقط GET
    // =====================================================

    if (req.method !== "GET") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    // =====================================================
    // دریافت اطلاعات برگشتی از زرین پال
    // =====================================================

    const authority =
      String(req.query?.Authority || "").trim();

    const paymentStatus =
      String(req.query?.Status || "").trim().toUpperCase();

    if (!authority) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="fa" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>خطای پرداخت | نی نی استایل</title>
        </head>
        <body style="font-family:Tahoma;text-align:center;padding:50px;">
          <h2>❌ اطلاعات پرداخت ناقص است</h2>
          <p>شناسه پرداخت دریافت نشد.</p>
          <a href="/">بازگشت به فروشگاه</a>
        </body>
        </html>
      `);
    }

    // =====================================================
    // اگر کاربر پرداخت را لغو کرده باشد
    // =====================================================

    if (paymentStatus !== "OK") {
      const snapshot = await db
        .collection("orders")
        .where("paymentAuthority", "==", authority)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const orderDoc = snapshot.docs[0];

        await orderDoc.ref.update({
          status: "payment_failed",
          paymentStatus: "failed",
          updatedAt: new Date(),
        });
      }

      return res.redirect(
        302,
        "/checkout.html?payment=failed"
      );
    }

    // =====================================================
    // پیدا کردن سفارش با Authority
    // =====================================================

    const snapshot = await db
      .collection("orders")
      .where("paymentAuthority", "==", authority)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="fa" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>خطای پرداخت | نی نی استایل</title>
        </head>
        <body style="font-family:Tahoma;text-align:center;padding:50px;">
          <h2>❌ سفارش پیدا نشد</h2>
          <p>این تراکنش به هیچ سفارش معتبری متصل نیست.</p>
          <a href="/">بازگشت به فروشگاه</a>
        </body>
        </html>
      `);
    }

    const orderDoc = snapshot.docs[0];

    const order =
      orderDoc.data();

    const orderId =
      orderDoc.id;

    // =====================================================
    // جلوگیری از Verify دوباره
    // =====================================================

    if (
      order.paymentStatus === "paid" ||
      order.status === "paid"
    ) {
      return res.redirect(
        302,
        `/checkout.html?payment=success&orderId=${encodeURIComponent(orderId)}`
      );
    }

    // =====================================================
    // Merchant ID
    // =====================================================

    const merchantId =
      process.env.ZARINPAL_MERCHANT_ID;

    if (!merchantId) {
      console.error(
        "ZARINPAL_MERCHANT_ID is missing"
      );

      return res.status(500).send(`
        <!DOCTYPE html>
        <html lang="fa" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>خطای پرداخت | نی نی استایل</title>
        </head>
        <body style="font-family:Tahoma;text-align:center;padding:50px;">
          <h2>❌ خطای تنظیمات پرداخت</h2>
          <p>درگاه پرداخت هنوز تنظیم نشده است.</p>
        </body>
        </html>
      `);
    }

    // =====================================================
    // مبلغ واقعی سفارش
    // =====================================================

    const totalToman =
      Number(
        order.verifiedTotalAmount || 0
      );

    const totalRial =
      Number(
        order.verifiedTotalAmountRial ||
        totalToman * 10
      );

    if (
      !Number.isFinite(totalRial) ||
      totalRial <= 0
    ) {
      console.error(
        "INVALID PAYMENT AMOUNT:",
        orderId
      );

      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="fa" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>خطای پرداخت | نی نی استایل</title>
        </head>
        <body style="font-family:Tahoma;text-align:center;padding:50px;">
          <h2>❌ مبلغ سفارش معتبر نیست</h2>
          <a href="/">بازگشت به فروشگاه</a>
        </body>
        </html>
      `);
    }

    // =====================================================
    // Verify واقعی زرین پال
    // =====================================================

    const verifyResponse =
      await fetch(
        ZARINPAL_VERIFY_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            merchant_id:
              merchantId,

            amount:
              totalRial,

            authority:
              authority,
          }),
        }
      );

    const verifyResult =
      await verifyResponse.json();

    console.log(
      "ZARINPAL VERIFY RESPONSE:",
      JSON.stringify(verifyResult)
    );

    const verifyCode =
      Number(
        verifyResult?.data?.code
      );

    const refId =
      verifyResult?.data?.ref_id;

    // =====================================================
    // پرداخت موفق
    // =====================================================

    if (
      verifyResponse.ok &&
      (verifyCode === 100 ||
        verifyCode === 101)
    ) {
      await orderDoc.ref.update({
        status: "paid",

        paymentStatus: "paid",

        paymentAuthority:
          authority,

        paymentRefId:
          refId
            ? String(refId)
            : "",

        paidAt:
          new Date(),

        verifiedPaymentAmountRial:
          totalRial,

        updatedAt:
          new Date(),
      });

      console.log(
        "PAYMENT SUCCESS:",
        orderId,
        refId
      );

      return res.redirect(
        302,
        `/checkout.html?payment=success&orderId=${encodeURIComponent(orderId)}`
      );
    }

    // =====================================================
    // پرداخت ناموفق
    // =====================================================

    await orderDoc.ref.update({
      status:
        "payment_failed",

      paymentStatus:
        "failed",

      updatedAt:
        new Date(),
    });

    const verifyMessage =
      verifyResult?.errors?.[0]?.message ||
      verifyResult?.data?.message ||
      "پرداخت تأیید نشد.";

    return res.redirect(
      302,
      `/checkout.html?payment=failed&message=${encodeURIComponent(
        verifyMessage
      )}`
    );

  } catch (error) {
    console.error(
      "PAYMENT CALLBACK ERROR:",
      error
    );

    return res.status(500).send(`
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>خطای پرداخت | نی نی استایل</title>
      </head>
      <body style="font-family:Tahoma;text-align:center;padding:50px;">
        <h2>❌ خطایی در پردازش پرداخت رخ داد</h2>
        <p>لطفاً دوباره تلاش کنید.</p>
        <a href="/">بازگشت به فروشگاه</a>
      </body>
      </html>
    `);
  }
}
