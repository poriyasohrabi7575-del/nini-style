export default function handler(req, res) {
  res.status(200).json([
    {
      id: "1",
      name: "لباس دخترانه",
      price: 450000,
      image: "/images/test.jpg"
    }
  ]);
}
