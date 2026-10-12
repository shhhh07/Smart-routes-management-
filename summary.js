import { getStats, getTrafficSnapshot, getAnomalies, getIncidentDemo } from "lib/traffic.js";
export const access = "public";
export const methods = ["GET"];
export default async function(req, res) {
  const stats = getStats(), traffic = getTrafficSnapshot(), anomalies = getAnomalies(100), incidents = getIncidentDemo();
  res.json({ ...stats, severe_segments: traffic.filter(s => s.congestion_index >= 0.82).length,
    moderate_segments: traffic.filter(s => s.congestion_index >= 0.62 && s.congestion_index < 0.82).length,
    incidents: incidents.length, recent_anomalies: anomalies.slice(0, 8), updated_at: new Date().toISOString(),
    notice: "Synthetic demo data. Official organizer traffic files are not connected." });
}