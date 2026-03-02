// server/routes/webflowProperties.routes.js
import express from "express";
import {
  listWebflowProperties,
  createWebflowProperty,
  deleteWebflowProperty,
} from "../services/webflowProperties.js";

const router = express.Router();

function requireAdmin(req, res, next) {
  const key = req.header("x-admin-key");
  const secret = process.env.ADMIN_SECRET || "wallsecure";
  if (key !== secret) return res.status(401).json({ error: "Unauthorized" });
  next();
}

router.get("/properties", async (req, res) => {
  try {
    const properties = await listWebflowProperties();
    res.json(properties);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.payload });
  }
});

router.post("/properties", requireAdmin, async (req, res) => {
  try {
    const { name, suite, photoUrl } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "Property name is required" });

    const property = await createWebflowProperty({
      name: name.trim(),
      suite: (suite || "").trim(),
      photoUrl: (photoUrl || "").trim(),
    });

    res.json({ property });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.payload });
  }
});

router.delete("/properties/:id", requireAdmin, async (req, res) => {
  try {
    await deleteWebflowProperty(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.payload });
  }
});

export default router;