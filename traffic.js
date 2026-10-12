import { getTomTomKey, fetchFlow } from "lib/tomtom.js";
export const access = "public";
export const methods = ["GET", "POST"];
export default async function(req, res) {
  const body = req.body || {}, q = req.query || {};
  const lat = Number(body.lat !== undefined ? body.lat : q.lat !== undefined ? q.lat : 17.3850);
  const lon = Number(body.lon !== undefined ? body.lon : q.lon !== undefined ? q.lon : 78.4867);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ available: false, error: "Valid latitude and longitude are required." });
  }
  const key = await getTomTomKey();
  if (!key) return res.json({ available: false, configured: false, source: "TomTom Traffic API",
    message: "TomTom is not configured. Add TOMTOM_API_KEY in the project's secure Setup page to enable live flow data." });
  try {
    const result = await fetchFlow(key, lat, lon);
    if (!result.ok) return res.status(result.status || 502).json({ available: false, configured: true, source: "TomTom Traffic API", message: result.message });
    const flow = result.data;
    res.json({ available: true, configured: true, source: "TomTom Traffic API", location: { lat: lat, lon: lon },
      current_speed_kmh: flow.currentSpeed, free_flow_speed_kmh: flow.freeFlowSpeed,
      current_travel_time_sec: flow.currentTravelTime, free_flow_travel_time_sec: flow.freeFlowTravelTime,
      confidence: flow.confidence, road_closure: flow.roadClosure, fetched_at: new Date().toISOString() });
  } catch (error) {
    res.status(502).json({ available: false, configured: true, source: "TomTom Traffic API", message: "Live traffic request failed. Verify the API key and TomTom subscription." });
  }
}