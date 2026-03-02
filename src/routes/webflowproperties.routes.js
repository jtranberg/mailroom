import express from "express";
import {
  listWebflowProperties,
  createWebflowProperty,
  deleteWebflowProperty,
} from "../services/webflowProperties.js";

const router = express.Router();

function requireAdmin(req, res, next) {
  const key = String(req.header("x-admin-key") || "");
  const secret = String(process.env.ADMIN_SECRET || "wallsecure");
  if (!key || key !== secret) return res.status(401).json({ error: "Unauthorized" });
  next();
}

router.get("/properties", async (_req, res) => {
  try {
    const properties = await listWebflowProperties();
    return res.json(properties);
  } catch (err) {
    console.error("GET /properties failed:", err);
    return res.status(500).json({ error: err?.message || "Failed to fetch properties" });
  }
});

router.post("/properties", requireAdmin, async (req, res) => {
  try {
    const { name, suite, photoUrl } = req.body || {};
    const n = String(name || "").trim();
    const s = String(suite || "").trim();
    const p = String(photoUrl || "").trim();
    if (!n) return res.status(400).json({ error: "Property name is required" });

    const property = await createWebflowProperty({ name: n, suite: s, photoUrl: p });
    return res.json({ property });
  } catch (err) {
    console.error("POST /properties failed:", err);
    return res.status(500).json({ error: err?.message || "Failed to create property" });
  }
});

router.delete("/properties/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Missing :id" });

    await deleteWebflowProperty(id);
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /properties/:id failed:", err);
    return res.status(500).json({ error: err?.message || "Failed to delete property" });
  }
});

export default router;