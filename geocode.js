export const access = "public";
export const methods = ["GET"];
export default async function(req, res) {
  const q = String((req.query && req.query.q) || "").trim();
  if (!q) return res.status(400).json({ error: "Enter a place name or address." });
  // Allow coordinate input without relying on an external geocoder.
  const match = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (match) {
    const lat = Number(match[1]), lon = Number(match[2]);
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return res.status(400).json({ error: "Coordinates are outside valid latitude/longitude ranges." });
    return res.json({ lat: lat, lon: lon, display_name: q, source: "coordinate_input" });
  }
  try {
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&q=" + encodeURIComponent(q);
    const response = await fetch(url, { headers: { "User-Agent": "VYNEX-SmartRoutes/1.0", "Accept": "application/json" } });
    const rows = await response.json().catch(() => []);
    if (!response.ok) return res.status(502).json({ error: "Location search provider is temporarily unavailable.", provider_status: response.status });
    if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ error: "No matching location found. Try a more specific place or enter latitude, longitude." });
    res.json({ results: rows.slice(0, 5).map(x => ({ lat: Number(x.lat), lon: Number(x.lon), display_name: x.display_name, type: x.type })), source: "OpenStreetMap Nominatim" });
  } catch (error) {
    res.status(502).json({ error: "Location search failed. Enter latitude, longitude or try again." });
  }
}