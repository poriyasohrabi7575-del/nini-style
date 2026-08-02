import db from "../lib/firebaseAdmin";

export default async function handler(req, res) {
  try {
    const collection = db.collection("products");

    // دریافت محصولات
    if (req.method === "GET") {
      const snapshot = await collection.get();

      const products = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return res.status(200).json(products);
    }

    // اضافه کردن محصول جدید
    if (req.method === "POST") {
      const data = req.body;

      const product = {
        name: data.name,
        price: Number(data.price),
        oldPrice: Number(data.oldPrice || 0),
        image: data.image || "",
        category: data.category || "عمومی",
        createdAt: new Date(),
      };

      const result = await collection.add(product);

      return res.status(200).json({
        success: true,
        id: result.id,
      });
    }

    return res.status(405).json({
      error: "Method not allowed",
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message,
    });
  }
}
