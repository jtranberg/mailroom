/* eslint-env node */
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";

import Document from "./models/Document.js";
import Tenant from "./models/Tenant.js";
import Property from "./models/Property.js";
import Note from "./models/Note.js";
import Message from "./models/Message.js";

import importProxyRoutes from "./src/routes/webflowproperties.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "https://mailroom-portal.netlify.app",
  "https://document-portal.netlify.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.options(/.*/, cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/**
 * ✅ Webflow proxy routes live here (keeps Mongo routes clean)
 * Example: /api/webflow/properties
 */
app.use("/api/webflow", importProxyRoutes);

// MongoDB Connection...
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Ensure uploads directory exists
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Routes
app.get("/", (req, res) => {
  res.send("📄 Documents API is running...");
});

/* =========================================================
   DOCUMENTS
========================================================= */

app.get("/api/documents", async (req, res) => {
  try {
    const docs = await Document.find();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch documents", details: err.message });
  }
});

app.post("/api/documents", upload.single("file"), async (req, res) => {
  try {
    const { type, label } = req.body;
    const file = req.file;

    const allowedTypes = ["lease", "maintenance", "inspection", "vacate", "other"];
    if (!allowedTypes.includes(type)) {
      return res
        .status(400)
        .json({ error: `Invalid type. Must be one of: ${allowedTypes.join(", ")}` });
    }

    if (!type || !label || !file) {
      return res.status(400).json({ error: "Missing type, label, or file" });
    }

    const newDoc = new Document({ type, label, filename: file.filename });
    await newDoc.save();

    res.status(201).json({ message: "✅ Document uploaded", document: newDoc });
  } catch (err) {
    res.status(500).json({ error: "Failed to upload document", details: err.message });
  }
});

/* =========================================================
   MESSAGES (Mongo "email log")
========================================================= */

// GET: /api/messages?propertyName=...&tenantId=...&limit=50
app.get("/api/messages", async (req, res) => {
  try {
    const { propertyKey, propertyName, tenantId, to, from, q } = req.query;

    let limit = parseInt(String(req.query.limit || "50"), 10);
    if (Number.isNaN(limit) || limit < 1) limit = 50;
    limit = Math.min(limit, 200);

    const filter = {};

    if (propertyKey) filter.propertyKey = String(propertyKey);
    if (propertyName) filter.propertyName = String(propertyName);
    if (tenantId) filter.tenantId = String(tenantId);

    if (to) filter.to = String(to).toLowerCase();
    if (from) filter.from = String(from).toLowerCase();

    if (q) {
      const s = String(q).trim();
      if (s) {
        filter.$or = [
          { subject: { $regex: s, $options: "i" } },
          { message: { $regex: s, $options: "i" } },
          { to: { $regex: s, $options: "i" } },
          { from: { $regex: s, $options: "i" } },
          { tenantName: { $regex: s, $options: "i" } },
          { propertyName: { $regex: s, $options: "i" } },
        ];
      }
    }

    const items = await Message.find(filter).sort({ createdAt: -1 }).limit(limit);
    const count = await Message.countDocuments(filter);

    res.status(200).json({ count, items });
  } catch (err) {
    console.error("❌ Failed to fetch messages:", err);
    res.status(500).json({ error: "Failed to fetch messages", details: err.message });
  }
});

/* =========================================================
   TENANTS
========================================================= */

// GET: tenants (ACTIVE by default). Add ?includeArchived=true for all.
// Supports: ?propertyName=Shannon%20Mews OR ?propertyId=<mongoId>
app.get("/api/tenants", async (req, res) => {
  try {
    const includeArchived = ["1", "true", "yes"].includes(
      String(req.query.includeArchived || "").toLowerCase()
    );

    const propertyName = String(req.query.propertyName || "").trim();
    const propertyId = String(req.query.propertyId || "").trim();

    const filter = {};
    if (!includeArchived) filter.isArchived = { $ne: true };

    /**
     * ✅ CRITICAL FIX:
     * If there are duplicate Property rows in Mongo with the same name,
     * we must match ALL of them so tenants don't "disappear".
     */
    if (propertyName) {
      const props = await Property.find({
        name: { $regex: new RegExp(`^${propertyName}$`, "i") }, // exact, case-insensitive
      });

      if (!props.length) return res.status(200).json([]);

      const ids = props.map((p) => String(p._id));
      filter.propertyId = { $in: ids };
    }

    if (propertyId) filter.propertyId = propertyId;

    const tenants = await Tenant.find(filter).sort({ createdAt: -1 });
    res.status(200).json(tenants);
  } catch (err) {
    console.error("❌ Failed to fetch tenants:", err);
    res.status(500).json({ error: "Failed to fetch tenants", details: err.message });
  }
});

// POST: Add new tenant (blocks duplicates, warns on archived matches)
app.post("/api/tenants", async (req, res) => {
  try {
    let { name, email, unit, propertyId, propertyKey, propertyName } = req.body;

    // ✅ accept propertyKey as propertyId (if you ever send it)
    propertyId = propertyId || propertyKey;

    const cleanPropertyName = propertyName ? String(propertyName).trim() : "";

    // ✅ Verify propertyId is a REAL Mongo Property _id
    let propById = null;
    const hasValidObjectId =
      propertyId && mongoose.Types.ObjectId.isValid(String(propertyId));

    if (hasValidObjectId) {
      propById = await Property.findById(propertyId);
    }

    // ✅ If propertyId missing OR invalid OR not found -> map from propertyName
    if ((!propertyId || !hasValidObjectId || !propById) && cleanPropertyName) {
      const prop = await Property.findOne({
        name: { $regex: new RegExp(`^${cleanPropertyName}$`, "i") },
      }).sort({ createdAt: -1 }); // deterministic if duplicates exist

      if (prop) {
        propertyId = String(prop._id);
        propById = prop;
      }
    }

    // ✅ Optional: if both provided, but mismatch, override propertyId to match propertyName
    if (propById && cleanPropertyName) {
      const mongoName = String(propById.name || "").trim().toLowerCase();
      const uiName = cleanPropertyName.toLowerCase();
      if (mongoName && uiName && mongoName !== uiName) {
        const prop = await Property.findOne({
          name: { $regex: new RegExp(`^${cleanPropertyName}$`, "i") },
        }).sort({ createdAt: -1 });

        if (prop) {
          propertyId = String(prop._id);
          propById = prop;
        }
      }
    }

    if (!name || !email || !unit || !propertyId) {
      return res.status(400).json({
        error: "Missing required fields",
        missing: {
          name: !name,
          email: !email,
          unit: !unit,
          propertyId: !propertyId,
        },
      });
    }

    name = String(name).trim();
    unit = String(unit).trim();
    propertyId = String(propertyId).trim();
    email = String(email).trim().toLowerCase();

    const existing = await Tenant.findOne({ email });

    if (existing && existing.isArchived) {
      const noteCount = await Note.countDocuments({ tenantId: existing._id });
      return res.status(409).json({
        error: "This email belongs to a previous tenant. Review notes before re-adding.",
        code: "PREVIOUS_TENANT",
        tenantId: existing._id,
        archivedAt: existing.archivedAt,
        archivedReason: existing.archivedReason || null,
        noteCount,
      });
    }

    if (existing && !existing.isArchived) {
      return res.status(409).json({
        error: "Tenant email already exists.",
        code: "DUPLICATE_EMAIL",
        tenantId: existing._id,
      });
    }

    const newTenant = new Tenant({
      name,
      email,
      unit,
      propertyId, // ✅ must be Mongo Property _id now
      propertyName: cleanPropertyName || undefined,
      isArchived: false,
    });

    await newTenant.save();
    return res.status(201).json({ message: "✅ Tenant added", tenant: newTenant });
  } catch (err) {
    console.error("❌ Failed to add tenant:", err);
    return res.status(500).json({ error: "Failed to add tenant", details: err.message });
  }
});

// DELETE: archive tenant (soft delete). Notes stay forever.
app.delete("/api/tenants/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { reason } = req.body || {};

    const t = await Tenant.findById(tenantId);
    if (!t) return res.status(404).json({ error: "Tenant not found" });

    t.isArchived = true;
    t.archivedAt = new Date();
    t.archivedReason = reason ? String(reason).trim() : "Archived";
    await t.save();

    res.status(200).json({ message: "✅ Tenant archived", tenant: t });
  } catch (err) {
    console.error("❌ Failed to archive tenant:", err);
    res.status(500).json({ error: "Failed to archive tenant", details: err.message });
  }
});

// PATCH: restore tenant
app.patch("/api/tenants/:tenantId/restore", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const t = await Tenant.findById(tenantId);
    if (!t) return res.status(404).json({ error: "Tenant not found" });

    t.isArchived = false;
    t.archivedAt = null;
    t.archivedReason = null;

    await t.save();
    return res.status(200).json({ message: "✅ Tenant restored", tenant: t });
  } catch (err) {
    console.error("❌ Failed to restore tenant:", err);
    return res.status(500).json({ error: "Failed to restore tenant", details: err.message });
  }
});

/* =========================================================
   PROPERTIES (Mongo internal list)
========================================================= */

app.post("/api/properties", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Missing property name" });

    const newProperty = new Property({ name: String(name).trim() });
    await newProperty.save();

    res.status(201).json({ message: "✅ Property added", property: newProperty });
  } catch (err) {
    console.error("❌ Failed to add property:", err);
    res.status(500).json({ error: "Failed to add property", details: err.message });
  }
});

app.get("/api/properties", async (req, res) => {
  try {
    const properties = await Property.find();
    res.status(200).json(properties);
  } catch (err) {
    console.error("❌ Failed to fetch properties:", err);
    res.status(500).json({ error: "Failed to fetch properties", details: err.message });
  }
});

app.delete("/api/properties/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;

    const prop = await Property.findById(propertyId);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    const activeTenantCount = await Tenant.countDocuments({
      propertyId,
      isArchived: { $ne: true },
    });

    if (activeTenantCount > 0) {
      return res.status(400).json({
        error: "Cannot delete property with active tenants.",
        code: "PROPERTY_HAS_TENANTS",
        activeTenantCount,
      });
    }

    await Property.findByIdAndDelete(propertyId);

    res.status(200).json({ message: "✅ Property deleted" });
  } catch (err) {
    console.error("❌ Failed to delete property:", err);
    res.status(500).json({ error: "Failed to delete property", details: err.message });
  }
});

/* =========================================================
   NOTES
========================================================= */

app.get("/api/tenants/:tenantId/notes", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const notes = await Note.find({ tenantId }).sort({ createdAt: -1 });
    res.status(200).json(notes);
  } catch (err) {
    console.error("❌ Failed to fetch notes:", err);
    res.status(500).json({ error: "Failed to fetch notes", details: err.message });
  }
});

app.post("/api/tenants/:tenantId/notes", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { text, propertyId, tags } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Missing note text" });
    }

    const note = new Note({
      tenantId,
      propertyId: propertyId || undefined,
      text: text.trim(),
      tags: Array.isArray(tags) ? tags : [],
    });

    await note.save();
    res.status(201).json({ message: "✅ Note saved", note });
  } catch (err) {
    console.error("❌ Failed to save note:", err);
    res.status(500).json({ error: "Failed to save note", details: err.message });
  }
});

app.delete("/api/notes/:noteId", async (req, res) => {
  try {
    const { noteId } = req.params;
    const deleted = await Note.findByIdAndDelete(noteId);

    if (!deleted) return res.status(404).json({ error: "Note not found" });

    res.status(200).json({ message: "✅ Note deleted" });
  } catch (err) {
    console.error("❌ Failed to delete note:", err);
    res.status(500).json({ error: "Failed to delete note", details: err.message });
  }
});

// DEBUG: show every tenant in MongoDB
app.get("/api/debug/tenants", async (req, res) => {
  try {
    const tenants = await Tenant.find().sort({ createdAt: -1 });
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/debug/property-by-name", async (req, res) => {
  const name = String(req.query.name || "").trim();
  const props = await Property.find({
    name: { $regex: new RegExp(`^${name}$`, "i") },
  }).sort({ createdAt: -1 });

  res.json(props.map(p => ({ _id: String(p._id), name: p.name, createdAt: p.createdAt })));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});