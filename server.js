/* eslint-env node */
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Document from './models/Document.js';
import Tenant from './models/Tenant.js'; // ⬅️ add this near the top

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  'https://mailroom-portal.netlify.app',
  'https://document-portal.netlify.app'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Ensure uploads directory exists
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Routes
app.get('/', (req, res) => {
  res.send('📄 Documents API is running...');
});

// Seed database with sample documents
app.get('/api/seed', async (req, res) => {
  try {
    await Document.deleteMany();
    const inserted = await Document.insertMany([
      { type: 'lease', label: 'Lease Agreement' },
      { type: 'maintenance', label: 'Maintenance Request' },
      { type: 'inspection', label: 'Inspection Form' }
    ]);
    res.status(201).json({ message: '✅ Seeded documents', inserted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to seed documents', details: err.message });
  }
});

// GET: Fetch all documents
app.get('/api/documents', async (req, res) => {
  try {
    const docs = await Document.find();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents', details: err.message });
  }
});

// POST: Upload document with file
app.post('/api/documents', upload.single('file'), async (req, res) => {
  try {
    const { type, label } = req.body;
    const file = req.file;

    console.log('🔍 Incoming upload:', {
      type,
      label,
      file: file?.originalname,
      filename: file?.filename,
    });

    // Optional enum check for clarity
    const allowedTypes = ['lease', 'maintenance', 'inspection','vacate', 'other'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${allowedTypes.join(', ')}` });
    }

    if (!type || !label || !file) {
      console.error('❌ Missing input:', { type, label, file });
      return res.status(400).json({ error: 'Missing type, label, or file' });
    }

    const newDoc = new Document({
      type,
      label,
      filename: file.filename,
    });

    await newDoc.save();
    console.log('✅ Document saved:', newDoc);
    res.status(201).json({ message: '✅ Document uploaded', document: newDoc });
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ error: 'Failed to upload document', details: err.message });
  }
});
// POST: Add new tenant
app.post('/api/tenants', async (req, res) => {
   console.log('📥 POST /api/tenants called with:', req.body);
  try {
    const { name, email, unit, propertyId } = req.body;

    if (!name || !email || !unit || !propertyId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newTenant = new Tenant({ name, email, unit, propertyId });
    await newTenant.save();

    res.status(201).json({ message: '✅ Tenant added', tenant: newTenant });
  } catch (err) {
    console.error('❌ Failed to add tenant:', err);
    res.status(500).json({ error: 'Failed to add tenant', details: err.message });
  }
});

// GET: Fetch all tenants
app.get('/api/tenants', async (req, res) => {
  try {
    const tenants = await Tenant.find();
    res.status(200).json(tenants);
  } catch (err) {
    console.error('❌ Failed to fetch tenants:', err);
    res.status(500).json({ error: 'Failed to fetch tenants', details: err.message });
  }
});



// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
