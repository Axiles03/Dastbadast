export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ address: string; city: string }> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ru`,
    { headers: { 'User-Agent': 'Dastbadast/1.0 (food delivery)' } }
  );
  if (!res.ok) throw new Error('Не удалось определить адрес');
  const data = await res.json();
  const a = data.address || {};
  const road = a.road || a.pedestrian || a.neighbourhood || '';
  const house = a.house_number || '';
  const line =
    [road, house].filter(Boolean).join(' ') ||
    (data.display_name ? String(data.display_name).split(',')[0] : '');
  const city = a.city || a.town || a.village || a.state || 'Душанбе';
  return { address: line.trim(), city };
}
