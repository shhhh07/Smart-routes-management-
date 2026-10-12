import { getTomTomKey, fetchFlow } from "lib/tomtom.js";
export const access = "public";
export const methods = ["POST"];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function distanceMeters(a, b) {
  const lat = (Number(a[0]) + Number(b[0])) / 2 * Math.PI / 180;
  const dy = (Number(a[0]) - Number(b[0])) * 111320;
  const dx = (Number(a[1]) - Number(b[1])) * 111320 * Math.cos(lat);
  return Math.hypot(dx, dy);
}
function sampleGeometry(g, count) {
  if (!Array.isArray(g) || !g.length) return [];
  if (g.length <= count) return g;
  const out = [];
  for (let i = 0; i < count; i++) out.push(g[Math.round(i * (g.length - 1) / (count - 1))]);
  return out;
}
function divergence(a, b) {
  if (!a || !b || a.length < 2 || b.length < 2) return { mean_m: 0, over_60m_pct: 0, over_150m_pct: 0 };
  const aa = sampleGeometry(a, 28), bb = sampleGeometry(b, 28);
  const d = (from, to) => from.map(p => Math.min(...to.map(q => distanceMeters(p, q))));
  const values = d(aa, bb).concat(d(bb, aa));
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return {
    mean_m: Math.round(mean),
    over_60m_pct: Math.round(values.filter(v => v > 60).length / values.length * 100),
    over_150m_pct: Math.round(values.filter(v => v > 150).length / values.length * 100)
  };
}
function sufficientlyDifferent(candidate, accepted) {
  return accepted.every(other => {
    const d = divergence(candidate.geometry, other.geometry);
    return d.mean_m >= 40 && (d.over_60m_pct >= 12 || d.over_150m_pct >= 8);
  });
}
function normalizeRoute(raw, kind) {
  const coords = raw && raw.geometry && raw.geometry.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const geometry = coords.map(c => [Number(c[1]), Number(c[0])]).filter(c => c.every(Number.isFinite));
  const distanceKm = Number(raw.distance) / 1000, timeMin = Number(raw.duration) / 60;
  if (geometry.length < 2 || !Number.isFinite(distanceKm) || !Number.isFinite(timeMin)) return null;
  const first = geometry[0], last = geometry[geometry.length - 1];
  return {
    distance_km: +distanceKm.toFixed(2),
    travel_time_min: +timeMin.toFixed(1),
    average_speed_kmh: timeMin > 0 ? +(distanceKm / timeMin * 60).toFixed(1) : null,
    geometry,
    segment_ids: [],
    source: "OpenStreetMap / OSRM",
    route_kind: kind
  };
}
async function osrm(coords, alternatives) {
  const encoded = coords.map(c => Number(c[0]) + "," + Number(c[1])).join(";");
  const url = "https://router.project-osrm.org/route/v1/driving/" + encoded +
    "?steps=false&overview=full&geometries=geojson&alternatives=" + (alternatives ? "3" : "false");
  const response = await fetch(url, { headers: { "Accept": "application/json", "User-Agent": "VYNEX-SmartRoutes/1.0" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.code !== "Ok" || !Array.isArray(data.routes)) return [];
  return data.routes.map(r => normalizeRoute(r, coords.length > 2 ? "via-road-detour" : "fastest-road")).filter(Boolean);
}
function waypointCandidates(olat, olon, dlat, dlon) {
  const midLat = (olat + dlat) / 2;
  const scaleLon = Math.max(0.2, Math.cos(midLat * Math.PI / 180));
  const east = (dlon - olon) * 111.32 * scaleLon;
  const north = (dlat - olat) * 111.32;
  const length = Math.max(0.1, Math.hypot(east, north));
  const perpEast = -north / length, perpNorth = east / length;
  const offsets = [
    [0.50, 0.45, 1], [0.50, 0.45, -1],
    [0.42, 0.85, 1], [0.58, 0.85, -1],
    [0.33, 1.25, -1], [0.67, 1.25, 1],
    [0.50, clamp(length * 0.28, 1.4, 3.5), 1],
    [0.50, clamp(length * 0.28, 1.4, 3.5), -1],
    [0.25, clamp(length * 0.18, 0.8, 2.5), 1],
    [0.75, clamp(length * 0.18, 0.8, 2.5), -1]
  ];
  const output = [], seen = new Set();
  for (const [fraction, offsetKm, sign] of offsets) {
    const baseLat = olat + (dlat - olat) * fraction;
    const baseLon = olon + (dlon - olon) * fraction;
    const lat = baseLat + sign * perpNorth * offsetKm / 111.32;
    const lon = baseLon + sign * perpEast * offsetKm / (111.32 * scaleLon);
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const key = lat.toFixed(4) + "," + lon.toFixed(4);
    if (!seen.has(key)) { seen.add(key); output.push([lon, lat]); }
  }
  return output;
}
async function tomtomSample(key, route) {
  if (!key || !route.geometry || route.geometry.length < 2) return null;
  const coord = route.geometry[Math.floor(route.geometry.length / 2)];
  const result = await fetchFlow(key, coord[0], coord[1]);
  if (!result.ok) return { available: false, message: result.message, status: result.status };
  const f = result.data, current = Number(f.currentSpeed), free = Number(f.freeFlowSpeed);
  const nowSec = Number(f.currentTravelTime), freeSec = Number(f.freeFlowTravelTime);
  if (![current, free].every(Number.isFinite) || free <= 0) return { available: false, message: "TomTom returned incomplete traffic data." };
  return {
    available: true, current_speed_kmh: current, free_flow_speed_kmh: free,
    congestion_index: +clamp(1 - current / free, 0, 0.98).toFixed(3),
    delay_min: Number.isFinite(nowSec) && Number.isFinite(freeSec) ? +Math.max(0, nowSec - freeSec).toFixed(0) / 60 : null,
    confidence: Number.isFinite(Number(f.confidence)) ? Number(f.confidence) : null,
    road_closure: Boolean(f.roadClosure),
    location: { lat: coord[0], lon: coord[1] }
  };
}
export default async function(req, res) {
  const body = req.body || {}, origin = body.origin || {}, destination = body.destination || {};
  const olat = Number(origin.lat), olon = Number(origin.lon !== undefined ? origin.lon : origin.lng);
  const dlat = Number(destination.lat), dlon = Number(destination.lon !== undefined ? destination.lon : destination.lng);
  if (![olat, olon, dlat, dlon].every(Number.isFinite)) return res.status(400).json({ error: "Enter valid origin and destination coordinates." });
  if (olat < -90 || olat > 90 || dlat < -90 || dlat > 90 || olon < -180 || olon > 180 || dlon < -180 || dlon > 180)
    return res.status(400).json({ error: "Coordinates are outside valid latitude/longitude ranges." });
  if (Math.abs(olat - dlat) + Math.abs(olon - dlon) < 0.0005) return res.status(400).json({ error: "Choose start and destination locations farther apart." });

  try {
    // Get the provider's fastest road route and any alternatives it already has.
    const direct = await osrm([[olon, olat], [dlon, dlat]], true);
    if (!direct.length) return res.status(502).json({ error: "The road-routing service could not find a driving route. Try another location or retry shortly.", provider: "OSRM" });
    const pool = [];
    for (const route of direct) {
      if (sufficientlyDifferent(route, pool)) pool.push(route);
    }

    // OSRM can legally return a single route for a pair of points. Ask the same
    // road router for real detours through offset mid-corridor points until we
    // find three spatially different street paths or exhaust safe alternatives.
    if (pool.length < 3) {
      const candidates = waypointCandidates(olat, olon, dlat, dlon);
      for (let i = 0; i < candidates.length && pool.length < 3; i++) {
        // Public OSRM demo service is shared; keep requests paced.
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 1050));
        const waypoint = candidates[i];
        const via = await osrm([[olon, olat], waypoint, [dlon, dlat]], false);
        if (!via.length) continue;
        const candidate = via[0];
        if (sufficientlyDifferent(candidate, pool)) pool.push(candidate);
      }
    }

    // If the city's road graph cannot produce three strong detours, keep honest
    // route diversity metadata instead of inventing traffic values or duplicate
    // paths. Relax the spatial threshold only for one final candidate pool pass.
    if (pool.length < 3) {
      const candidates = waypointCandidates(olat, olon, dlat, dlon);
      for (let i = 0; i < candidates.length && pool.length < 3; i++) {
        const via = await osrm([[olon, olat], candidates[i], [dlon, dlat]], false);
        const candidate = via[0];
        if (!candidate) continue;
        const distinct = pool.every(other => {
          const d = divergence(candidate.geometry, other.geometry);
          return d.mean_m >= 18 && (d.over_60m_pct >= 6 || d.over_150m_pct >= 4);
        });
        if (distinct) pool.push(candidate);
        if (i < candidates.length - 1 && pool.length < 3) await new Promise(resolve => setTimeout(resolve, 1050));
      }
    }
    if (!pool.length) return res.status(502).json({ error: "The routing service returned no usable road paths." });

    pool.sort((a, b) => a.travel_time_min - b.travel_time_min);
    const chosen = pool.slice(0, 3);
    const ids = ["A", "B", "C"], labels = ["Fastest route", "Alternative route", "Detour alternative"];
    let tomtomKey = null;
    try { tomtomKey = await getTomTomKey(); } catch (e) { tomtomKey = null; }
    const sampled = tomtomKey ? await Promise.all(chosen.map(r => tomtomSample(tomtomKey, r))) : chosen.map(() => null);
    const routes = chosen.map((r, i) => {
      const live = sampled[i] && sampled[i].available ? sampled[i] : null;
      const score = Math.max(1, Math.round(100 - (r.travel_time_min / Math.max(1, chosen[0].travel_time_min)) * 24 - (live ? live.congestion_index * 24 : 0)));
      const div = i === 0 ? { mean_m: 0, over_60m_pct: 0, over_150m_pct: 0 } : divergence(r.geometry, chosen[0].geometry);
      return Object.assign({}, r, {
        route_id: ids[i], label: labels[i], route_score: score,
        delay_min: live ? live.delay_min : null,
        congestion_index: live ? live.congestion_index : null,
        certainty_score: live && live.confidence !== null ? Math.round(live.confidence * 100) : null,
        traffic_status: !tomtomKey ? "not_configured" : live ? "tomtom_sampled" : "tomtom_unavailable",
        traffic_sample: live, divergence_from_fastest: div,
        diverges_from_fastest: i === 0 ? false : div.mean_m >= 18
      });
    });
    res.json({
      coverage: true, source: "OpenStreetMap / OSRM",
      origin: { lat: olat, lon: olon }, destination: { lat: dlat, lon: dlon },
      routes, route_count: routes.length, requested_route_count: 3,
      alternatives_note: routes.length >= 3 ? "A, B and C use distinct road geometries. Some road sections may be shared." : "The routing provider returned fewer than three distinct road paths in this area; results are not duplicated to meet a count.",
      timestamp: new Date().toISOString(),
      data_notice: tomtomKey
        ? "Route geometry and base drive times are from OSRM. TomTom live speed is sampled near each route midpoint, not across every road section."
        : "Route geometry and base drive times are from OSRM. Set TOMTOM_API_KEY in secure project Setup to enable live speed, traffic-flow tiles and incident reports."
    });
  } catch (error) {
    res.status(502).json({ error: "Could not calculate route alternatives right now. Please retry in a few seconds.", provider: "OSRM" });
  }
}