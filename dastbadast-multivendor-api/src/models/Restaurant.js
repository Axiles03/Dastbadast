import mongoose from 'mongoose';

const RestaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true },
    image: { type: String, default: '' },
    address: { type: String, default: '' },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    tax: { type: Number, default: 0 },
    minimumOrder: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

RestaurantSchema.index({ location: '2dsphere' });

export const Restaurant = mongoose.model('Restaurant', RestaurantSchema);
