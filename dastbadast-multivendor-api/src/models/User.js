import mongoose from 'mongoose';

const AddressSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Дом' },
    address: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    city: { type: String, default: 'Душанбе' },
    details: { type: String, default: '' },
    isSelected: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true }
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, required: true },
    addresses: [AddressSchema],
    notificationToken: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

UserSchema.index({ 'addresses.location': '2dsphere' });

export const User = mongoose.model('User', UserSchema);
