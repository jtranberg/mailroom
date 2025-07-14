import mongoose from 'mongoose';

const TenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  unit: { type: String, required: true },
  propertyId: { type: String, required: true }, // match 'prop1', 'prop2', etc.
});

export default mongoose.model('Tenant', TenantSchema);
