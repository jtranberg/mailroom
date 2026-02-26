// /middleware/requireAdmin.js
export function requireAdmin(req, res, next) {
  const key = String(req.headers["x-admin-key"] || "");
  const expected = String(process.env.ADMIN_SECRET || "");

  if (!expected) {
    return res.status(500).json({ error: "Server misconfigured: ADMIN_SECRET missing" });
  }

  if (key !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}