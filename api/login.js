import crypto from "crypto";

function createToken(username) {
  const timestamp = Date.now().toString();

  const data = `${username}.${timestamp}`;

  const signature = crypto
    .createHmac("sha256", process.env.ADMIN_PASSWORD)
    .update(data)
    .digest("hex");

  return Buffer.from(`${data}.${signature}`).toString("base64url");
}

function verifyToken(token) {
  try {
    if (!token) return false;

    const decoded = Buffer.from(token, "base64url").toString("utf8");

    const parts = decoded.split(".");

    if (parts.length !== 3) return false;

    const [username, timestamp, signature] = parts;

    if (username !== process.env.ADMIN_USERNAME) {
      return false;
    }

    const age = Date.now() - Number(timestamp);

    if (age > 24 * 60 * 60 * 1000) {
      return false;
    }

    const data = `${username}.${timestamp}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.ADMIN_PASSWORD)
      .update(data)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

  } catch {
    return false;
  }
}

export default function handler(req, res) {

  // =========================
  // بررسی وضعیت ورود
  // =========================

  if (req.method === "GET") {

    const cookies = req.headers.cookie || "";

    const match = cookies.match(
      /admin_token=([^;]+)/
    );

    const authenticated = match
      ? verifyToken(match[1])
      : false;

    return res.status(200).json({
      authenticated
    });
  }


  // =========================
  // ورود
  // =========================

  if (req.method === "POST") {

    const {
      username,
      password
    } = req.body || {};

    if (
      username !== process.env.ADMIN_USERNAME ||
      password !== process.env.ADMIN_PASSWORD
    ) {

      return res.status(401).json({
        error: "نام کاربری یا رمز عبور اشتباه است."
      });

    }

    const token =
      createToken(username);


    res.setHeader(
      "Set-Cookie",
      `admin_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
    );


    return res.status(200).json({
      success: true
    });
  }


  // =========================
  // خروج
  // =========================

  if (req.method === "DELETE") {

    res.setHeader(
      "Set-Cookie",
      "admin_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
    );

    return res.status(200).json({
      success: true
    });
  }


  return res.status(405).json({
    error: "Method not allowed"
  });

}
