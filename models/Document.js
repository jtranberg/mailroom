import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['lease', 'maintenance', 'inspection','vacate', 'other'], // optional enum for clarity
  },
  label: {
    type: String,
    required: true,
  },
  filename: {
    type: String,
    required: false, // optional if only storing metadata initially
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  }
});

export default mongoose.model('Document', DocumentSchema);
