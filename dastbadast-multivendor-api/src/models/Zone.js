import mongoose from 'mongoose';

const ZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    location: {
      type: { type: String, enum: ['Polygon'], default: 'Polygon' },
      coordinates: { type: [[[Number]]], default: [] },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ZoneSchema.index({ location: '2dsphere' });

export const Zone = mongoose.model('Zone', ZoneSchema);
