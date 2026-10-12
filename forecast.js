import { forecastSegments, routeBySegments } from "lib/traffic.js";
export const access = "public";
export const methods = ["GET", "POST"];
export default async function(req, res) {
  const body = req.body || {}, q = req.query || {};
  const route = body.route && typeof body.route === "object" ? body.route : null;
  const ids = Array.isArray(body.segment_ids) ? body.segment_ids : (q.segment_ids ? String(q.segment_ids).split(",") : []);
  if (route && Number.isFinite(Number(route.travel_time_min)) && Number.isFinite(Number(route.distance_km))) {
    const minutes = Number(route.travel_time_min), distance = Number(route.distance_km);
    const speed = Number(route.average_speed_kmh) || (minutes > 0 ? distance / minutes * 60 : 0);
    const congestion = route.congestion_index === null || route.congestion_index === undefined ? null : Number(route.congestion_index);
    const flowSpeed = [0, 15, 30, 45].map((ahead, index) => {
      const gradual = ahead === 0 ? 1 : 1 - index * (route.traffic_status === "tomtom_sampled" ? 0.015 : 0.008);
      return {
        minutes_ahead: ahead, speed: +(speed * gradual).toFixed(1),
        congestion: congestion === null ? null : +Math.min(0.99, congestion + index * 0.025).toFixed(3),
        delay: route.delay_min === null || route.delay_min === undefined ? null : +(Number(route.delay_min) * gradual + index * 0.8).toFixed(1),
        travel_time: +(minutes * (ahead === 0 ? 1 : 1 + index * 0.04)).toFixed(1),
        confidence: +(Math.max(0.42, (route.certainty_score === null || route.certainty_score === undefined ? 0.65 : Number(route.certainty_score)/100) - index * 0.06)).toFixed(2)
      };
    });
    return res.json({ route_id: route.route_id || null, selected_segments: 0, generated_at: new Date().toISOString(),
      method: route.traffic_status === "tomtom_sampled" ? "OSRM route + midpoint TomTom observation + illustrative horizon trend" : "OSRM route-time baseline + illustrative horizon trend",
      note: "Only base route distance/duration comes from the routing provider. Future horizons are illustrative projections, not trained or validated forecasts. TomTom is sampled near one point per route.",
      forecasts: flowSpeed });
  }
  const known = routeBySegments(ids).length;
  res.json({ route_id: body.route_id || q.route_id || null, selected_segments: known,
    generated_at: new Date().toISOString(), method: "deterministic synthetic trend baseline",
    note: "Forecasts are demo estimates from synthetic traffic, not a trained or validated production model.",
    forecasts: forecastSegments(ids) });
}