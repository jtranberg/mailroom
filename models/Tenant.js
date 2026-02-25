import mongoose from "mongoose";

const TenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    unit: { type: String, required: true, trim: true },
    propertyId: { type: String, required: true, trim: true },

    // ✅ soft delete / archive
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
    archivedReason: { type: String, trim: true },
  },
  { timestamps: true }
);

// optional index (don’t make it unique yet unless you’re sure all emails should be unique globally)
// TenantSchema.index({ email: 1 });

export default mongoose.model("Tenant", TenantSchema);