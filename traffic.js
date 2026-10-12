const CENTER = { lat: 17.3850, lon: 78.4867 };
const ROWS = 10, COLS = 12, NODE_COUNT = ROWS * COLS, SEGMENT_COUNT = 436;
const BOUNDS = { minLat: 17.325, maxLat: 17.445, minLon: 78.385, maxLon: 78.585 };
function hash(value) {
  let h = 2166136261;
  const s = String(value);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function unit(value) { return hash(value) / 4294967295; }
let networkCache;
export function getNetwork() {
  if (networkCache) return networkCache;
  const nodes = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const id = r * COLS + c;
    nodes.push({
      id: id,
      node_id: "N" + String(id + 1).padStart(3, "0"),
      lat: +(CENTER.lat + (r - (ROWS - 1) / 2) * 0.011 + (unit("lat" + id) - 0.5) * 0.006).toFixed(6),
      lon: +(CENTER.lon + (c - (COLS - 1) / 2) * 0.013 + (unit("lon" + id) - 0.5) * 0.006).toFixed(6)
    });
  }
  const pairs = new Map();
  function addEdge(a, b) {
    if (a === b) return;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    pairs.set(lo + ":" + hi, [lo, hi]);
  }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const a = r * COLS + c;
    if (c < COLS - 1) addEdge(a, a + 1);
    if (r < ROWS - 1) addEdge(a, a + COLS);
  }
  let attempt = 0;
  while (pairs.size < SEGMENT_COUNT && attempt < 20000) {
    const a = hash("a" + attempt) % NODE_COUNT;
    let b = hash("b" + attempt) % NODE_COUNT;
    if (a === b) b = (b + 1) % NODE_COUNT;
    addEdge(a, b);
    attempt++;
  }
  const edgePairs = Array.from(pairs.values()).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, SEGMENT_COUNT);
  const segments = edgePairs.map(function(pair, i) {
    const a = pair[0], b = pair[1], id = "SEG_" + String(i + 1).padStart(3, "0");
    const x = unit(id + "class");
    const roadClass = x > 0.94 ? "expressway" : x > 0.60 ? "arterial" : x > 0.28 ? "collector" : "local";
    const lanes = roadClass === "expressway" ? 3 + hash(id + "lanes") % 3 : roadClass === "arterial" ? 2 + hash(id + "lanes") % 2 : 1 + hash(id + "lanes") % 2;
    const freeSpeed = roadClass === "expressway" ? 65 + unit(id + "speed") * 25 : roadClass === "arterial" ? 40 + unit(id + "speed") * 25 : roadClass === "collector" ? 25 + unit(id + "speed") * 20 : 18 + unit(id + "speed") * 17;
    const dx = (nodes[a].lat - nodes[b].lat) * 111;
    const dy = (nodes[a].lon - nodes[b].lon) * 105;
    const length = Math.max(0.15, Math.hypot(dx, dy) * (0.9 + unit(id + "length") * 0.2));
    const capacity = lanes * (roadClass === "expressway" ? 2500 : roadClass === "arterial" ? 1600 : roadClass === "collector" ? 1100 : 700);
    return {
      segment_id: id, source: a, target: b, source_node: nodes[a].node_id, target_node: nodes[b].node_id,
      road_class: roadClass, lanes: lanes, capacity: Math.round(capacity), free_flow_speed: +freeSpeed.toFixed(1),
      length_km: +length.toFixed(3), grade_pct: +((unit(id + "grade") - 0.5) * 4).toFixed(2),
      structural_bottleneck: unit(id + "bottle") > 0.86, importance: +(0.2 + unit(id + "importance") * 0.8).toFixed(2),
      coordinates: [[nodes[a].lat, nodes[a].lon], [nodes[b].lat, nodes[b].lon]]
    };
  });
  const adjacency = Array.from({ length: NODE_COUNT }, () => []);
  segments.forEach(function(s) {
    adjacency[s.source].push({ node: s.target, segment: s });
    adjacency[s.target].push({ node: s.source, segment: s });
  });
  networkCache = { nodes: nodes, segments: segments, adjacency: adjacency, bounds: BOUNDS };
  return networkCache;
}
export function isInCoverage(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lon >= BOUNDS.minLon && lon <= BOUNDS.maxLon;
}
export function nearestNode(lat, lon) {
  const net = getNetwork();
  let winner = net.nodes[0], best = Infinity;
  net.nodes.forEach(function(n) {
    const d = Math.pow((n.lat - lat) * 111, 2) + Math.pow((n.lon - lon) * 105, 2);
    if (d < best) { best = d; winner = n; }
  });
  return winner;
}
export function getTraffic(segment, timeMs) {
  const now = Number.isFinite(timeMs) ? timeMs : Date.now();
  const d = new Date(now);
  const hour = d.getHours() + d.getMinutes() / 60;
  const peak = 0.36 + 0.52 * Math.exp(-Math.pow((hour - 9) / 2, 2)) + 0.62 * Math.exp(-Math.pow((hour - 18) / 2.4, 2));
  const demand = Math.min(1.25, peak + (unit(segment.segment_id + "demand") - 0.5) * 0.27);
  const anomalyWindow = Math.floor(now / 900000);
  const anomaly = hash(segment.segment_id + ":" + anomalyWindow) % 47 === 0;
  const flow = Math.max(50, segment.capacity * demand * (segment.structural_bottleneck ? 1.08 : 1));
  const occupancy = Math.min(0.98, 0.08 + 0.78 * flow / segment.capacity);
  const congestion = Math.max(0.03, Math.min(0.99, 0.14 + 0.64 * (flow / segment.capacity) + (segment.structural_bottleneck ? 0.12 : 0) + (anomaly ? 0.25 : 0)));
  const speed = Math.max(5, segment.free_flow_speed * (1 - 0.59 * congestion) * (anomaly ? 0.48 : 1) * (0.94 + unit(segment.segment_id + "variability") * 0.12));
  const travelTime = segment.length_km / speed * 60;
  const freeTime = segment.length_km / segment.free_flow_speed * 60;
  const delay = Math.max(0, travelTime - freeTime);
  const queue = Math.max(0, Math.min(300, flow / Math.max(speed, 1) * 0.025 * 100 + (anomaly ? 35 : 0)));
  return {
    segment_id: segment.segment_id, timestamp: new Date(Math.floor(now / 300000) * 300000).toISOString(),
    speed: +speed.toFixed(1), flow: +flow.toFixed(1), occupancy: +occupancy.toFixed(3),
    travel_time: +travelTime.toFixed(2), delay: +delay.toFixed(2), queue_length: +queue.toFixed(1),
    congestion_index: +congestion.toFixed(3), sensor_quality: anomaly ? 0.78 : +(0.91 + unit(segment.segment_id + "quality") * 0.09).toFixed(3),
    anomaly: anomaly, severity: congestion > 0.82 || anomaly ? "high" : congestion > 0.62 ? "moderate" : "low"
  };
}
export function getTrafficSnapshot() {
  const net = getNetwork(), now = Date.now();
  return net.segments.map(function(s) { return Object.assign({}, s, getTraffic(s, now)); });
}
export function findPath(startNode, endNode, variant, timeMs, scenario) {
  const net = getNetwork();
  const dist = Array(NODE_COUNT).fill(Infinity), prevNode = Array(NODE_COUNT).fill(-1), prevSeg = Array(NODE_COUNT).fill(null), visited = Array(NODE_COUNT).fill(false);
  dist[startNode] = 0;
  for (let i = 0; i < NODE_COUNT; i++) {
    let u = -1, best = Infinity;
    for (let j = 0; j < NODE_COUNT; j++) if (!visited[j] && dist[j] < best) { best = dist[j]; u = j; }
    if (u < 0 || u === endNode) break;
    visited[u] = true;
    for (const edge of net.adjacency[u]) {
      const s = edge.segment, t = getTraffic(s, timeMs);
      let cost = t.travel_time + t.congestion_index * (variant === 1 ? 8 : variant === 2 ? 3 : 1.8) + (s.structural_bottleneck ? (variant === 2 ? 7 : 1.5) : 0);
      if (variant === 2 && hash(s.segment_id) % 4 === 0) cost *= 1.55;
      if (scenario && scenario.type === "road_closure" && s.segment_id === scenario.segment_id) cost += 10000;
      if (scenario && scenario.type === "lane_reduction" && s.segment_id === scenario.segment_id) cost *= 1.8;
      if (scenario && scenario.type === "major_incident" && s.segment_id === scenario.segment_id) cost *= 2.2;
      const alt = dist[u] + cost;
      if (alt < dist[edge.node]) { dist[edge.node] = alt; prevNode[edge.node] = u; prevSeg[edge.node] = s; }
    }
  }
  if (!Number.isFinite(dist[endNode])) return [];
  const path = [];
  let cur = endNode, guard = 0;
  while (cur !== startNode && cur >= 0 && guard++ < NODE_COUNT + 2) {
    const s = prevSeg[cur];
    if (!s) return [];
    path.push(s);
    cur = prevNode[cur];
  }
  return path.reverse();
}
export function analyzeSegments(segments, timeMs, scenario) {
  const rows = segments.map(function(s) {
    const t = getTraffic(s, timeMs);
    let speed = t.speed, flow = t.flow, capacity = s.capacity, congestion = t.congestion_index;
    if (scenario && scenario.type === "traffic_increase") {
      const pct = Math.max(0, Math.min(100, Number(scenario.percent) || 20)) / 100;
      flow = Math.min(capacity * 1.5, flow * (1 + pct));
      congestion = Math.min(0.99, congestion + pct * 0.75);
      speed = Math.max(5, speed * (1 - pct * 0.38));
    }
    if (scenario && scenario.type === "lane_reduction" && s.segment_id === scenario.segment_id) {
      capacity *= Math.max(0.15, 1 - (Math.max(1, Number(scenario.lanes) || 1) / Math.max(1, s.lanes)));
      congestion = Math.min(0.99, congestion + 0.25);
      speed = Math.max(5, speed * 0.68);
    }
    if (scenario && scenario.type === "major_incident" && s.segment_id === scenario.segment_id) {
      speed = Math.max(4, speed * 0.4); congestion = Math.min(0.99, congestion + 0.35);
    }
    if (scenario && scenario.type === "road_closure" && s.segment_id === scenario.segment_id) {
      speed = 4; congestion = 0.99;
    }
    const travel = s.length_km / Math.max(speed, 1) * 60;
    const free = s.length_km / s.free_flow_speed * 60;
    return { segment_id: s.segment_id, distance_km: s.length_km, speed: speed, flow: flow, congestion: congestion, delay: Math.max(0, travel - free), travel_time: travel, queue_length: t.queue_length, anomaly: t.anomaly, severity: t.severity };
  });
  const distance = rows.reduce((a, r) => a + r.distance_km, 0);
  const travel = rows.reduce((a, r) => a + r.travel_time, 0);
  const delay = rows.reduce((a, r) => a + r.delay, 0);
  const congestion = rows.length ? rows.reduce((a, r) => a + r.congestion, 0) / rows.length : 0;
  const speed = travel > 0 ? distance / travel * 60 : 0;
  const bottlenecks = segments.filter(s => s.structural_bottleneck).length;
  const risk = Math.min(100, congestion * 65 + bottlenecks * 3 + rows.filter(r => r.anomaly).length * 8);
  const score = Math.max(0, Math.min(100, 100 - congestion * 48 - delay * 1.4 - risk * 0.18 + (speed / 80) * 12));
  return {
    distance_km: +distance.toFixed(2), travel_time_min: +travel.toFixed(1), average_speed_kmh: +speed.toFixed(1),
    delay_min: +delay.toFixed(1), congestion_index: +congestion.toFixed(3), bottleneck_count: bottlenecks,
    anomaly_count: rows.filter(r => r.anomaly).length, certainty_score: +Math.max(15, 100 - risk * 0.62).toFixed(0),
    route_score: +score.toFixed(0), segments: rows
  };
}
export function calculateRoutes(origin, destination) {
  const net = getNetwork();
  const olat = Number(origin && origin.lat), olon = Number(origin && (origin.lon !== undefined ? origin.lon : origin.lng));
  const dlat = Number(destination && destination.lat), dlon = Number(destination && (destination.lon !== undefined ? destination.lon : destination.lng));
  if (![olat, olon, dlat, dlon].every(Number.isFinite)) return { coverage: false, error: "Enter valid coordinates." };
  if (!isInCoverage(olat, olon) || !isInCoverage(dlat, dlon)) return { coverage: false, message: "No supporting traffic dataset found.", bounds: BOUNDS };
  const start = nearestNode(olat, olon), end = nearestNode(dlat, dlon), now = Date.now();
  if (start.id === end.id) return { coverage: true, error: "Choose start and destination locations farther apart." };
  const routeDefs = [
    { id: "A", label: "Fastest", variant: 0 },
    { id: "B", label: "Balanced", variant: 1 },
    { id: "C", label: "Alternative", variant: 2 }
  ];
  const routes = routeDefs.map(function(def) {
    const path = findPath(start.id, end.id, def.variant, now);
    const metrics = analyzeSegments(path, now);
    return Object.assign({ route_id: def.id, label: def.label, start_node: start.node_id, end_node: end.node_id,
      segment_ids: path.map(s => s.segment_id), geometry: path.length ? [ [olat, olon], ...path.map(s => [net.nodes[s.source === start.id ? s.target : s.source].lat, net.nodes[s.source === start.id ? s.target : s.source].lon]) ] : [] }, metrics);
  }).filter(r => r.segment_ids.length > 0);
  const uniqueRoutes = [];
  routes.forEach(r => { if (!uniqueRoutes.some(x => x.segment_ids.join(",") === r.segment_ids.join(","))) uniqueRoutes.push(r); });
  return { coverage: true, source: "synthetic_demo", origin: { lat: olat, lon: olon }, destination: { lat: dlat, lon: dlon },
    snapped_origin: { node_id: start.node_id, lat: start.lat, lon: start.lon }, snapped_destination: { node_id: end.node_id, lat: end.lat, lon: end.lon },
    routes: uniqueRoutes, timestamp: new Date(now).toISOString(), data_notice: "Synthetic demo network. Replace with organizer data for genuine project results." };
}
export function getAnomalies(limit) {
  const rows = getTrafficSnapshot().filter(s => s.anomaly || s.congestion_index >= 0.82 || s.sensor_quality < 0.82);
  rows.sort((a, b) => (Number(b.anomaly) * 2 + b.congestion_index) - (Number(a.anomaly) * 2 + a.congestion_index));
  return rows.slice(0, Math.max(1, Math.min(100, Number(limit) || 40))).map(function(s) {
    return { segment_id: s.segment_id, timestamp: s.timestamp, severity: s.anomaly || s.congestion_index > 0.86 ? "high" : "moderate",
      anomaly_score: +(s.anomaly ? 0.8 + s.congestion_index * 0.19 : s.congestion_index * 0.75).toFixed(3),
      speed: s.speed, expected_speed: +(s.free_flow_speed * (1 - 0.35 * s.congestion_index)).toFixed(1),
      congestion_index: s.congestion_index, delay: s.delay, reason: s.anomaly ? "Abrupt speed drop with elevated flow/occupancy pattern" : "Congestion index exceeds the advisory threshold",
      source: "synthetic rule/statistical demo detector" };
  });
}
export function forecastSegments(segmentIds, timeMs) {
  const net = getNetwork(), lookup = new Map(net.segments.map(s => [s.segment_id, s]));
  const segments = (segmentIds || []).map(id => lookup.get(id)).filter(Boolean);
  const chosen = segments.length ? segments : net.segments.slice(0, 12);
  const now = Number.isFinite(timeMs) ? timeMs : Date.now();
  return [0, 15, 30, 45].map(function(mins) {
    const rows = chosen.map(s => getTraffic(s, now + mins * 60000));
    const avg = function(k) { return rows.reduce((sum, x) => sum + x[k], 0) / Math.max(1, rows.length); };
    return { minutes_ahead: mins, speed: +avg("speed").toFixed(1), congestion: +avg("congestion_index").toFixed(3),
      delay: +avg("delay").toFixed(1), travel_time: +avg("travel_time").toFixed(1), confidence: mins === 0 ? 1 : +(Math.max(0.42, 0.78 - mins * 0.006)).toFixed(2) };
  });
}
export function routeBySegments(segmentIds) {
  const net = getNetwork(), map = new Map(net.segments.map(s => [s.segment_id, s]));
  return (segmentIds || []).map(id => map.get(id)).filter(Boolean);
}
export function getIncidentDemo() {
  const net = getNetwork();
  return Array.from({ length: 9 }, function(_, i) {
    const s = net.segments[(i * 43 + 11) % net.segments.length];
    const t = getTraffic(s, Date.now());
    return { incident_id: "DEMO_INC_" + String(i + 1).padStart(2, "0"), segment_id: s.segment_id,
      type: ["congestion", "accident", "roadwork", "breakdown"][i % 4],
      severity: i % 3 === 0 ? "high" : i % 2 === 0 ? "moderate" : "low",
      speed: t.speed, lat: net.nodes[s.source].lat, lon: net.nodes[s.source].lon,
      timestamp: new Date().toISOString(), source: "synthetic_demo" };
  });
}
export function getStats() {
  const net = getNetwork(), rows = getTrafficSnapshot();
  return { road_segments: net.segments.length, network_nodes: net.nodes.length, training_observations: 1883520,
    validation_observations: 502272, unique_timestamps: 4320, resolution_minutes: 5,
    average_speed: +(rows.reduce((a, x) => a + x.speed, 0) / rows.length).toFixed(1),
    average_congestion: +(rows.reduce((a, x) => a + x.congestion_index, 0) / rows.length).toFixed(3),
    detected_anomalies: rows.filter(x => x.anomaly).length, mode: "SYNTHETIC DEMO" };
}
export function getBounds() { return BOUNDS; }