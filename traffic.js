import { getTrafficSnapshot } from "lib/traffic.js";
export const access = "public";
export const methods = ["GET"];
export default async function(req, res) {
  const rows = getTrafficSnapshot();
  const q = String((req.query && req.query.q) || "").toLowerCase();
  const severity = String((req.query && req.query.severity) || "all");
  const filtered = rows.filter(function(s) {
    const queryMatch = !q || s.segment_id.toLowerCase().includes(q) || s.road_class.toLowerCase().includes(q);
    const severityMatch = severity === "all" || s.severity === severity || (severity === "high" && s.congestion_index >= 0.82);
    return queryMatch && severityMatch;
  });
  res.json({ count: filtered.length, timestamp: new Date().toISOString(), mode: "synthetic_demo",
    segments: filtered.slice(0, 436).map(function(s) {
      return { segment_id:s.segment_id, source_node:s.source_node, target_node:s.target_node, road_class:s.road_class,
        lanes:s.lanes, capacity:s.capacity, free_flow_speed:s.free_flow_speed, length_km:s.length_km,
        structural_bottleneck:s.structural_bottleneck, importance:s.importance, coordinates:s.coordinates,
        speed:s.speed, flow:s.flow, occupancy:s.occupancy, travel_time:s.travel_time, delay:s.delay,
        queue_length:s.queue_length, congestion_index:s.congestion_index, sensor_quality:s.sensor_quality,
        anomaly:s.anomaly, severity:s.severity, timestamp:s.timestamp };
    }) });
}