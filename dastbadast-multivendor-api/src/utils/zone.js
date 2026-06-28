// zone.js
// Ray casting algorithm. coords: [lng, lat] одной точки.
// polygon: массив [[lng, lat], [lng, lat], ...]
export function pointInPolygon(point, polygon) {
  if (!point || !polygon || !polygon.length) return false;

  const [x, y] = point;
  let inside = false;

  // Безопасное извлечение на случай, если пришел GeoJSON верхнего уровня (массив массивов)
  const coords = Array.isArray(polygon[0]?.[0]) ? polygon[0] : polygon;

  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const [xi, yi] = coords[i];
    const [xj, yj] = coords[j];
    
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}