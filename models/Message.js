import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    // link back to Syndicator/Webflow “property”
    propertyKey: { type: String, trim: true }, // preferred stable key (webflow item id)
    propertyName: { type: String, trim: true },

    // tenant link
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },
    tenantName: { type: String, trim: true },
    unit: { type: String, trim: true },

    // email fields
    from: { type: String, trim: true, lowercase: true },
    to: { type: String, trim: true, lowercase: true },
    subject: { type: String, trim: true },
    message: { type: String },

    // optional tracking
    status: { type: String, default: "sent" }, // sent | failed | queued
    providerId: { type: String, default: null },
  },
  { timestamps: true }
);

// Helpful indexes
MessageSchema.index({ createdAt: -1 });
MessageSchema.index({ propertyKey: 1, createdAt: -1 });
MessageSchema.index({ tenantId: 1, createdAt: -1 });
MessageSchema.index({ to: 1 });

export default mongoose.model("Message", MessageSchema);