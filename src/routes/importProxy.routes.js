// server/routes/importProxy.routes.js
// Mailroom/DocuCenter proxy -> forwards CSV uploads to Syndicator (ana-api)
//
// REQUIRED ENV on Mailroom service (Render):
//   SYNDICATOR_BASE=https://ana-api-tov0.onrender.com
//   ADMIN_SECRET=wallsecure   (must match what Syndicator checks)
// Optional:
//   ADMIN_HEADER_NAME=x-admin-key

import express from "express";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const ADMIN_HEADER_NAME = process.env.ADMIN_HEADER_NAME || "x-admin-key";

function requireAdmin(req, res, next) {
  const key = String(req.header(ADMIN_HEADER_NAME) || "");
  const secret = String(process.env.ADMIN_SECRET || "wallsecure");
  if (!key || key !== secret) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}

// Read response as JSON or text, always return something usable
async function readJsonOrText(res) {
  const raw = await res.text();
  try {
    return { raw, data: JSON.parse(raw) };
  } catch {
    return { raw, data: null };
  }
}

async function forwardCsv(req, res, targetPath) {
  let base;
  try {
    base = mustEnv("SYNDICATOR_BASE").replace(/\/+$/, "");
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const file = req.file;
  if (!file?.buffer) return res.status(400).json({ error: "Missing CSV file (field name: file)" });

  // Build multipart form-data (Node 18+ has global FormData/Blob)
  const fd = new FormData();
  const blob = new Blob([file.buffer], { type: file.mimetype || "text/csv" });

  fd.append("file", blob, file.originalname || "upload.csv");
  fd.append("tenantId", String(req.body?.tenantId || "demo"));
  fd.append("matchKey", String(req.body?.matchKey || "item_id"));
  fd.append("mode", String(req.body?.mode || "update-only"));
  fd.append("dryRun", String(req.body?.dryRun ?? "true"));

  // Forward to Syndicator
  const url = `${base}${targetPath}`;
  const syndRes = await fetch(url, {
    method: "POST",
    headers: {
      // IMPORTANT: do NOT set Content-Type for FormData; fetch will set boundary.
      [ADMIN_HEADER_NAME]: String(process.env.ADMIN_SECRET || "wallsecure"),
    },
    body: fd,
  });

  const { raw, data } = await readJsonOrText(syndRes);

  // Mirror status + payload
  if (data !== null) return res.status(syndRes.status).json(data);
  return res.status(syndRes.status).send(raw);
}

/**
 * These are the endpoints your FRONTEND should call (API_BASE = Mailroom backend):
 *   POST /api/import/properties/csv
 *   POST /api/import/properties/csv/apply
 *
 * And they will forward to Syndicator:
 *   POST {SYNDICATOR_BASE}/api/import/properties/csv
 *   POST {SYNDICATOR_BASE}/api/import/properties/csv/apply
 */
router.post("/import/properties/csv", requireAdmin, upload.single("file"), async (req, res) => {
  try {
    return await forwardCsv(req, res, "/api/import/properties/csv");
  } catch (err) {
    console.error("Proxy preview failed:", err);
    return res.status(500).json({ error: err?.message || "Proxy failed" });
  }
});

router.post("/import/properties/csv/apply", requireAdmin, upload.single("file"), async (req, res) => {
  try {
    return await forwardCsv(req, res, "/api/import/properties/csv/apply");
  } catch (err) {
    console.error("Proxy apply failed:", err);
    return res.status(500).json({ error: err?.message || "Proxy failed" });
  }
});

export default router;