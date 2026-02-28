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
import webflowPropertiesRoutes from "./src/routes/webflowproperties.routes.js";

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
  "https://document-portal.netlify.app/"
];

app.use("/api/webflow", webflowPropertiesRoutes);

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

// Seed database with sample documents
// app.get("/api/seed", async (req, res) => {
//   try {
//     await Document.deleteMany();
//     const inserted = await Document.insertMany([
//       { type: "lease", label: "Lease Agreement" },
//       { type: "maintenance", label: "Maintenance Request" },
//       { type: "inspection", label: "Inspection Form" },
//     ]);
//     res.status(201).json({ message: "✅ Seeded documents", inserted });
//   } catch (err) {
//     res.status(500).json({ error: "Failed to seed documents", details: err.message });
//   }
// });

// GET: Fetch all documents
app.get("/api/documents", async (req, res) => {
  try {
    const docs = await Document.find();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch documents", details: err.message });
  }
});

// POST: Upload document with file
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
   TENANTS
========================================================= */

// GET: tenants (ACTIVE by default). Add ?includeArchived=true for all.
app.get("/api/tenants", async (req, res) => {
  try {
    const includeArchived = String(req.query.includeArchived || "") === "true";
    const filter = includeArchived ? {} : { isArchived: { $ne: true } };

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
    let { name, email, unit, propertyId } = req.body;

    if (!name || !email || !unit || !propertyId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    name = String(name).trim();
    unit = String(unit).trim();
    propertyId = String(propertyId).trim();
    email = String(email).trim().toLowerCase();

    const existing = await Tenant.findOne({ email });

    // ✅ archived match: warn + tell UI notes exist
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

    // ✅ active duplicate
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
      propertyId,
      isArchived: false,
    });

    await newTenant.save();
    res.status(201).json({ message: "✅ Tenant added", tenant: newTenant });
  } catch (err) {
    console.error("❌ Failed to add tenant:", err);
    res.status(500).json({ error: "Failed to add tenant", details: err.message });
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

/* =========================================================
   PROPERTIES
========================================================= */
/* =========================================================
   REPAIR: TENANT propertyId (name -> ObjectId)
   Admin-only (simple key)
   POST /api/repair/tenant-property-ids
========================================================= */

app.post("/api/repair/tenant-property-ids", async (req, res) => {
  try {
    const adminKey = String(req.headers["x-admin-key"] || "");
    const expectedKey = process.env.ADMIN_KEY || "wallsecure"; // keep same as your UI secret for now

    if (adminKey !== expectedKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Load properties once
    const properties = await Property.find();
    const propertyById = new Map(properties.map((p) => [String(p._id), p]));
    const propertyIdByName = new Map(
      properties.map((p) => [String(p.name || "").trim().toLowerCase(), String(p._id)])
    );

    // Fetch tenants (include archived too, so everything gets repaired)
    const tenants = await Tenant.find({});

    const updated = [];
    const unresolved = [];
    const skipped = [];

    for (const t of tenants) {
      const raw = String(t.propertyId || "").trim();
      if (!raw) {
        skipped.push({ tenantId: String(t._id), reason: "empty propertyId" });
        continue;
      }

      // Case A: already points to a real property _id
      if (propertyById.has(raw)) {
        skipped.push({ tenantId: String(t._id), reason: "already valid propertyId" });
        continue;
      }

      // Case B: propertyId is actually a property NAME (old data)
      const mappedId = propertyIdByName.get(raw.toLowerCase());
      if (mappedId && propertyById.has(mappedId)) {
        t.propertyId = mappedId;
        await t.save();

        updated.push({
          tenantId: String(t._id),
          tenantEmail: t.email,
          from: raw,
          to: mappedId,
          propertyName: propertyById.get(mappedId)?.name || null,
        });
        continue;
      }

      // Case C: orphan / no match
      unresolved.push({
        tenantId: String(t._id),
        tenantEmail: t.email,
        propertyId: raw,
      });
    }

    return res.status(200).json({
      message: "✅ Repair complete",
      counts: {
        totalTenants: tenants.length,
        updated: updated.length,
        skipped: skipped.length,
        unresolved: unresolved.length,
      },
      updated,
      unresolved,
      skipped,
    });
  } catch (err) {
    console.error("❌ Repair failed:", err);
    return res.status(500).json({ error: "Repair failed", details: err.message });
  }
});

// POST: Add new property
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

// GET: Fetch all properties
app.get("/api/properties", async (req, res) => {
  try {
    const properties = await Property.find();
    res.status(200).json(properties);
  } catch (err) {
    console.error("❌ Failed to fetch properties:", err);
    res.status(500).json({ error: "Failed to fetch properties", details: err.message });
  }
});
// DELETE: Remove property ONLY if no ACTIVE tenants are attached
app.delete("/api/properties/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;

    const prop = await Property.findById(propertyId);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Block deletion if any ACTIVE tenants still reference this property
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
   NOTES (Admin-only, internal)
========================================================= */


// GET: Fetch notes for a tenant (works for active OR archived)
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



// POST: Add a note for a tenant
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

// DELETE: Delete a note
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});