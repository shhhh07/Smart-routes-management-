import { routeBySegments, analyzeSegments } from "lib/traffic.js";
export const access = "public";
export const methods = ["POST"];
export default async function(req, res) {
  const body = req.body || {};
  const route = body.route && typeof body.route === "object" ? body.route : null;
  if (route && Number.isFinite(Number(route.travel_time_min)) && Number.isFinite(Number(route.distance_km))) {
    const causes = ["The route geometry and base drive-time estimate come from OpenStreetMap-based OSRM routing."];
    if (route.traffic_status === "tomtom_sampled" && route.traffic_sample) {
      causes.push("TomTom returned a traffic-flow observation near the route midpoint: " + route.traffic_sample.current_speed_kmh + " km/h versus " + route.traffic_sample.free_flow_speed_kmh + " km/h free flow.");
    } else {
      causes.push("No live traffic observation is configured for this route, so route congestion and delay are intentionally not reported as real values.");
    }
    res.json({ route_id: route.route_id || null, what_happened: "The selected road route is " + Number(route.distance_km).toFixed(1) + " km with an estimated base travel time of " + Number(route.travel_time_min).toFixed(1) + " minutes.",
      why: causes, recommendation: "Compare actual distance and ETA across alternatives; consult the live traffic provider before using this information for an operational decision.",
      evidence: { distance_km: Number(route.distance_km), travel_time_min: Number(route.travel_time_min), average_speed_kmh: Number(route.average_speed_kmh) || null, congestion_index: route.congestion_index ?? null, delay_min: route.delay_min ?? null },
      confidence: route.traffic_status === "tomtom_sampled" ? "One TomTom road-segment sample; not a whole-route confidence estimate." : "Base routing estimate only; live traffic is not configured.",
      source: route.source || "OpenStreetMap / OSRM", generated_at: new Date().toISOString() });
    return;
  }
  const segments = routeBySegments(Array.isArray(body.segment_ids) ? body.segment_ids : []);
  if (!segments.length) return res.status(400).json({ error: "Calculate a route first or provide valid segment_ids." });
  const m = analyzeSegments(segments, Date.now());
  const highCongestion = m.segments.filter(s => s.congestion >= 0.75).length;
  const lowSpeed = m.segments.filter(s => s.speed < 0.55 * segments.find(a => a.segment_id === s.segment_id).free_flow_speed).length;
  const bottlenecks = segments.filter(s => s.structural_bottleneck).length;
  const causes = [];
  if (highCongestion) causes.push(highCongestion + " segment(s) have elevated demo congestion.");
  if (lowSpeed) causes.push(lowSpeed + " segment(s) are moving below the synthetic free-flow benchmark.");
  if (bottlenecks) causes.push(bottlenecks + " structural demo bottleneck(s) are present.");
  if (!causes.length) causes.push("No severe synthetic traffic signals were detected.");
  res.json({ route_id: body.route_id || null, what_happened: "The selected synthetic segment set has a modeled congestion index of " + m.congestion_index.toFixed(2) + ".",
    why: causes, recommendation: "Use these indicators for demo analysis only; validate against the organizer dataset before operational use.",
    evidence: { segment_count: segments.length, average_speed_kmh: m.average_speed_kmh, congestion_index: m.congestion_index, delay_min: m.delay_min, anomaly_count: m.anomaly_count, bottleneck_count: bottlenecks },
    confidence: "Demo indicator only; not a calibrated probability", source: "synthetic_demo", generated_at: new Date().toISOString() });
}