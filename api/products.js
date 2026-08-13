const db = require("../lib/firebaseAdmin");

export default async function handler(req, res) {

  try {

    const collection = db.collection("products");

    // =========================
    // دریافت محصولات
    // =========================

    if (req.method === "GET") {

      const snapshot = await collection.get();

      const products = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      return res.status(200).json(products);
    }


    // =========================
    // افزودن محصول
    // =========================

    if (req.method === "POST") {

      const data = req.body || {};

      const product = {

        name: data.name || "",

        price: Number(data.price || 0),

        oldPrice: Number(data.oldPrice || 0),

        image: data.image || "",

        category: data.category || "عمومی",

        /*
         * رنگ + سایز + موجودی
         *
         * مثال:
         *
         * variants: [
         *   {
         *     color: "صورتی",
         *     size: "2-3 سال",
         *     stock: 5
         *   }
         * ]
         */

        variants:
          Array.isArray(data.variants)
            ? data.variants.map((item) => ({
                color: String(item.color || ""),
                size: String(item.size || ""),
                stock: Math.max(
                  0,
                  Number(item.stock || 0)
                )
              }))
            : [],

        createdAt: new Date()

      };

      const result =
        await collection.add(product);

      return res.status(200).json({

        success: true,

        id: result.id

      });
    }


    // =========================
    // ویرایش محصول
    // =========================

    if (req.method === "PUT") {

      const data = req.body || {};

      const id = data.id;

      if (!id) {

        return res.status(400).json({

          error:
            "شناسه محصول ارسال نشده است"

        });

      }


      const variants =
        Array.isArray(data.variants)

          ? data.variants.map((item) => ({

              color:
                String(item.color || ""),

              size:
                String(item.size || ""),

              stock:
                Math.max(
                  0,
                  Number(item.stock || 0)
                )

            }))

          : [];


      await collection.doc(id).update({

        name:
          data.name || "",

        price:
          Number(data.price || 0),

        oldPrice:
          Number(data.oldPrice || 0),

        image:
          data.image || "",

        category:
          data.category || "عمومی",

        variants,

        updatedAt:
          new Date()

      });


      return res.status(200).json({

        success: true

      });
    }


    // =========================
    // حذف محصول
    // =========================

    if (req.method === "DELETE") {

      const id =
        req.body?.id ||
        req.query?.id;

      if (!id) {

        return res.status(400).json({

          error:
            "شناسه محصول ارسال نشده است"

        });

      }


      await collection
        .doc(id)
        .delete();


      return res.status(200).json({

        success: true

      });
    }


    // =========================
    // متد غیرمجاز
    // =========================

    return res.status(405).json({

      error:
        "Method not allowed"

    });


  } catch (error) {

    console.error(
      "PRODUCT API ERROR:",
      error
    );

    return res.status(500).json({

      error:
        error.message

    });

  }

}
