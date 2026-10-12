import { getNetwork, getTrafficSnapshot, getBounds } from "lib/traffic.js";
export const access = "public";
export const methods = ["GET"];
export default async function(req, res) {
  const net = getNetwork(), traffic = getTrafficSnapshot();
  const q = String((req.query && req.query.q) || "").toLowerCase();
  const segments = traffic.filter(s => !q || s.segment_id.toLowerCase().includes(q) || s.road_class.toLowerCase().includes(q));
  res.json({ mode: "synthetic_demo", bounds: getBounds(), nodes: net.nodes.map(n => ({ node_id: n.node_id, lat: n.lat, lon: n.lon })),
    count: segments.length, segments: segments.slice(0, 436).map(s => ({ segment_id:s.segment_id, source_node:s.source_node, target_node:s.target_node,
      road_class:s.road_class, lanes:s.lanes, capacity:s.capacity, free_flow_speed:s.free_flow_speed, length_km:s.length_km,
      grade_pct:s.grade_pct, structural_bottleneck:s.structural_bottleneck, importance:s.importance,
      speed:s.speed, congestion_index:s.congestion_index, delay:s.delay, anomaly:s.anomaly, coordinates:s.coordinates })) });
}