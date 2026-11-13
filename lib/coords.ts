/** Tira latitude e longitude de um link do Google Maps (ou de "lat,lng" solto). null = link sem coordenada legível. */
export function parseLatLng(link: string | null | undefined): { lat: number; lng: number } | null {
  const s = (link ?? '').trim();
  if (!s) return null;
  const patterns = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll|destination|daddr)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i,
    /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 85 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)) return { lat, lng };
  }
  return null;
}
