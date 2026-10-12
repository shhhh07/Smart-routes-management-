import { getTomTomKey } from "lib/tomtom.js";
import { getIncidentDemo, getBounds } from "lib/traffic.js";
export const access = "public";
export const methods = ["GET", "POST"];
export default async function(req, res) {
  const key = await getTomTomKey();
  if (!key) return res.json({ available: false, configured: false, source: "TomTom Traffic Incidents",
    incidents: getIncidentDemo(), message: "Showing synthetic demo markers. Add TOMTOM_API_KEY in the secure project Setup page to request live incidents.", mode: "synthetic_demo" });
  const b = getBounds();
  const bbox = [b.minLon, b.minLat, b.maxLon, b.maxLat].join(",");
  const fields = "{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length,delay,roadNumbers,timeValidity}}}";
  try {
    const url = "https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=" + encodeURIComponent(bbox) +
      "&fields=" + encodeURIComponent(fields) + "&language=en-GB&category=0&timeValidityFilter=present&key=" + encodeURIComponent(key);
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ available: false, configured: true, source: "TomTom Traffic Incidents",
      incidents: [], message: data.error || data.description || "TomTom returned an error.", provider_status: response.status });
    const items = Array.isArray(data.incidents) ? data.incidents : [];
    res.json({ available: true, configured: true, source: "TomTom Traffic Incidents", count: items.length,
      incidents: items.map((item, i) => ({ incident_id: "TT-" + i, geometry: item.geometry, properties: item.properties })), fetched_at: new Date().toISOString() });
  } catch (error) {
    res.status(502).json({ available: false, configured: true, source: "TomTom Traffic Incidents", incidents: [], message: "Live incident request failed. Verify the key and API subscription." });
  }
}