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

    // ⭐ Фаза 1 (аудит): множитель цены доставки для этой зоны. 1 = обычная
    // цена. Полу-ручной триггер — правит админ через updateZone, когда в
    // зоне дефицит курьеров/пик спроса. Автоматизация (по соотношению
    // заказов в очереди к доступным курьерам) — уже следующий шаг, не
    // входит в Фазу 1. См. services/delivery-price.service.js.
    surgeMultiplier: { type: Number, default: 1, min: 1, max: 5 },
  },
  { timestamps: true }
);

ZoneSchema.index({ location: '2dsphere' });

export const Zone = mongoose.model('Zone', ZoneSchema);
