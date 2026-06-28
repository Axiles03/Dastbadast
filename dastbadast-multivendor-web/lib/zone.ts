/** Ray casting — point [lng, lat], polygon [[lng, lat], ...] */
export function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isInDeliveryZone(lng: number, lat: number, polygon?: number[][] | null): boolean {
  if (!polygon?.length) return true;
  return pointInPolygon([lng, lat], polygon);
}
