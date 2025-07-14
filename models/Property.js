import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema({
  name: { type: String, required: true }
}, { timestamps: true });

const Property = mongoose.model('Property', propertySchema);

export default Property;
