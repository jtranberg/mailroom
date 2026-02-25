import mongoose from "mongoose";

const NoteSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property" }, // optional
    text: { type: String, required: true, trim: true },
    tags: [{ type: String, trim: true }], // optional
  },
  { timestamps: true } // gives createdAt/updatedAt
);

export default mongoose.model("Note", NoteSchema);