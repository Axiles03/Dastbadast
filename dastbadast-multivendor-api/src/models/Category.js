import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    image: { type: String, default: '' },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  },
  { timestamps: true }
);

export const Category = mongoose.model('Category', CategorySchema);
