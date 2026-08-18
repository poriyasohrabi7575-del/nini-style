const db = require("../../lib/firebaseAdmin");

// =====================================================
// تنظیمات زرین‌پال
// =====================================================

const ZARINPAL_REQUEST_URL =
  "https://payment.zarinpal.com/pg/v4/payment/request.json";

const ZARINPAL_STARTPAY_URL =
  "https://payment.zarinpal.com/pg/StartPay/";


// =====================================================
// تبدیل مقدار به عدد
// =====================================================

function toNumber(value) {
  const number = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .replace(/٬/g, "")
      .replace(/[^\d.]/g, "")
  );

  return Number.isFinite(number)
    ? number
    : 0;
}


// =====================================================
// تعداد محصول
// =====================================================

function getQuantity(item) {
  const quantity =
    item.quantity ??
    item.qty ??
    item.count ??
    1;

  const number = Number(quantity);

  return Number.isFinite(number) && number > 0
    ? Math.floor(number)
    : 0;
}


// =====================================================
// شناسه محصول
// =====================================================

function getProductId(item) {
  return String(
    item.id ??
    item.productId ??
    item.productID ??
    ""
  ).trim();
}


// =====================================================
// رنگ انتخاب‌شده
// =====================================================

function getColor(item) {
  return String(
    item.color ??
    item.selectedColor ??
    item.variantColor ??
    ""
  ).trim();
}


// =====================================================
// سایز انتخاب‌شده
// =====================================================

function getSize(item) {
  return String(
    item.size ??
    item.selectedSize ??
    item.variantSize ??
    ""
  ).trim();
}


// =====================================================
// تطبیق Variant
// =====================================================

function findVariant(product, cartItem) {
  const variants = Array.isArray(product.variants)
    ? product.variants
    : [];

  // محصول قدیمی بدون Variant
  if (!variants.length) {
    return null;
  }

  const selectedColor = getColor(cartItem);
  const selectedSize = getSize(cartItem);

  // اگر محصول Variant دارد ولی انتخابی ارسال نشده
  if (!selectedColor && !selectedSize) {
    return null;
  }

  const variant = variants.find((item) => {
    const variantColor =
      String(item.color || "").trim();

    const variantSize =
      String(item.size || "").trim();

    const colorMatches =
      !selectedColor ||
      variantColor === selectedColor;

    const sizeMatches =
      !selectedSize ||
      variantSize === selectedSize;

    return colorMatches && sizeMatches;
  });

  return variant || null;
}


// =====================================================
// محاسبه مبلغ واقعی سفارش
// =====================================================

async function calculateRealOrderAmount(order) {
  if (
    !order ||
    !Array.isArray(order.products) ||
    !order.products.length
  ) {
    throw new Error(
      "محصولات سفارش معتبر نیستند"
    );
  }

  let totalToman = 0;
  let totalQuantity = 0;

  const verifiedProducts = [];

  for (const cartItem of order.products) {
    const productId =
      getProductId(cartItem);

    const quantity =
      getQuantity(cartItem);

    if (!productId) {
      throw new Error(
        "شناسه یکی از محصولات سفارش نامعتبر است"
      );
    }

    if (!quantity) {
      throw new Error(
        "تعداد یکی از محصولات سفارش نامعتبر است"
      );
    }

    // -----------------------------------------------
    // دریافت محصول واقعی از Firestore
    // -----------------------------------------------

    const productDoc =
      await db
        .collection("products")
        .doc(productId)
        .get();

    if (!productDoc.exists) {
      throw new Error(
        "یکی از محصولات سفارش دیگر موجود نیست"
      );
    }

    const product =
      productDoc.data();

    // -----------------------------------------------
    // قیمت واقعی Firestore
    // -----------------------------------------------

    const price =
      toNumber(product.price);

    if (price <= 0) {
      throw new Error(
        "قیمت یکی از محصولات معتبر نیست"
      );
    }

    // -----------------------------------------------
    // بررسی Variant
    // -----------------------------------------------

    const variants =
      Array.isArray(product.variants)
        ? product.variants
        : [];

    const selectedColor =
      getColor(cartItem);

    const selectedSize =
      getSize(cartItem);

    let matchedVariant = null;

    if (variants.length) {
      matchedVariant =
        findVariant(
          product,
          cartItem
        );

      if (!matchedVariant) {
        throw new Error(
          `رنگ یا سایز محصول «${product.name || "محصول"}» معتبر نیست`
        );
      }

      const stock =
        Math.max(
          0,
          toNumber(
            matchedVariant.stock
          )
        );

      if (stock < quantity) {
        throw new Error(
          `موجودی محصول «${product.name || "محصول"}» برای انتخاب شما کافی نیست`
        );
      }
    }

    // -----------------------------------------------
    // محاسبه
    // -----------------------------------------------

    const itemTotal =
      price * quantity;

    totalToman += itemTotal;
    totalQuantity += quantity;

    verifiedProducts.push({
      productId,
      name:
        product.name || "محصول",
      price,
      quantity,
      color: selectedColor,
      size: selectedSize,
    });
  }

  if (totalToman <= 0) {
    throw new Error(
      "مبلغ سفارش معتبر نیست"
    );
  }

  return {
    totalToman,
    totalRial:
      totalToman * 10,
    totalQuantity,
    verifiedProducts,
  };
}


// =====================================================
// Handler
// =====================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const {
      orderId,
    } = req.body || {};

    // =================================================
    // بررسی Order ID
    // =================================================

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error:
          "شناسه سفارش ارسال نشده است",
      });
    }

    // =================================================
    // Merchant ID
    // =================================================

    const merchantId =
      process.env.ZARINPAL_MERCHANT_ID;

    if (!merchantId) {
      return res.status(500).json({
        success: false,
        error:
          "ZARINPAL_MERCHANT_ID در Environment Variables تنظیم نشده است",
      });
    }

    // =================================================
    // آدرس سایت
    // =================================================

    const siteUrl =
      String(
        process.env.SITE_URL || ""
      )
        .trim()
        .replace(/\/+$/, "");

    if (!siteUrl) {
      return res.status(500).json({
        success: false,
        error:
          "SITE_URL در Environment Variables تنظیم نشده است",
      });
    }

    // =================================================
    // دریافت سفارش
    // =================================================

    const orderRef =
      db
        .collection("orders")
        .doc(orderId);

    const orderDoc =
      await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        error:
          "سفارش پیدا نشد",
      });
    }

    const order =
      orderDoc.data();

    // =================================================
    // جلوگیری از پرداخت دوباره
    // =================================================

    if (
      order.paymentStatus === "paid" ||
      order.status === "paid"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "این سفارش قبلاً پرداخت شده است",
      });
    }

    // =================================================
    // محاسبه مبلغ واقعی از Firestore
    // =================================================

    const calculated =
      await calculateRealOrderAmount(
        order
      );

    const {
      totalToman,
      totalRial,
      totalQuantity,
      verifiedProducts,
    } = calculated;

    // =================================================
    // حداقل مبلغ
    // =================================================

    if (totalRial < 10000) {
      return res.status(400).json({
        success: false,
        error:
          "مبلغ سفارش کمتر از حد مجاز پرداخت است",
      });
    }

    // =================================================
    // callback
    // =================================================

    const callbackUrl =
      `${siteUrl}/api/payment/callback`;

    // =================================================
    // درخواست پرداخت زرین‌پال
    // =================================================

    const zarinpalResponse =
      await fetch(
        ZARINPAL_REQUEST_URL,
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

            // قیمت‌های سایت تومان هستند.
            // زرین‌پال را با ریال صدا می‌زنیم.
            currency:
              "IRR",

            amount:
              totalRial,

            callback_url:
              callbackUrl,

            description:
              `پرداخت سفارش نی نی استایل - ${orderId}`,

            metadata: {
              mobile:
                String(
                  order.mobile || ""
                ),

              order_id:
                orderId,
            },
          }),
        }
      );

    const result =
      await zarinpalResponse.json();

    console.log(
      "ZARINPAL REQUEST RESPONSE:",
      JSON.stringify(result)
    );

    const code =
      Number(
        result?.data?.code
      );

    const authority =
      String(
        result?.data?.authority || ""
      ).trim();

    // =================================================
    // درخواست موفق
    // =================================================

    if (
      zarinpalResponse.ok &&
      code === 100 &&
      authority
    ) {
      await orderRef.update({
        status:
          "pending_payment",

        paymentStatus:
          "pending",

        paymentAuthority:
          authority,

        paymentRefId:
          "",

        paidAt:
          null,

        // مبلغ واقعی محاسبه‌شده
        verifiedTotalAmount:
          totalToman,

        verifiedTotalAmountRial:
          totalRial,

        verifiedQuantity:
          totalQuantity,

        verifiedProducts:
          verifiedProducts,

        updatedAt:
          new Date(),
      });

      return res.status(200).json({
        success: true,

        orderId:
          orderId,

        status:
          "pending_payment",

        paymentStatus:
          "pending",

        authority:

          authority,

        paymentUrl:
          ZARINPAL_STARTPAY_URL +
          authority,
      });
    }

    // =================================================
    // درخواست ناموفق
    // =================================================

    const errorMessage =
      result?.errors?.[0]?.message ||
      result?.data?.message ||
      "خطا در ایجاد درخواست پرداخت زرین‌پال";

    return res.status(502).json({
      success: false,

      error:
        errorMessage,

      code:
        Number.isFinite(code)
          ? code
          : null,
    });

  } catch (error) {

    console.error(
      "PAYMENT REQUEST ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      error:
        error.message ||
        "خطا در ایجاد پرداخت",
    });
  }
}
