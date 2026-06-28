import { Zone } from '../models/Zone.js';

export const deliveryZone = async () => {
  const zone = await Zone.findOne({ isActive: true });
  if (!zone) return null;
  const polygon = zone.location?.coordinates?.[0];
  if (!polygon?.length) return null;
  return {
    id: zone._id,
    name: zone.name,
    description: zone.description,
    polygon,
  };
};
