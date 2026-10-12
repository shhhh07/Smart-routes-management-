import { getNetwork, getStats } from "lib/traffic.js";
export const access = "public";
export const methods = ["GET"];
export default async function(req, res) {
  const net = getNetwork(), stats = getStats();
  res.json({ status: "demo_ready", mode: "SYNTHETIC DEMO", organizer_dataset_connected: false,
    dataset_path: "Not connected on hosted demo", road_segments: net.segments.length, network_nodes: net.nodes.length,
    training_observations: stats.training_observations, validation_observations: stats.validation_observations,
    unique_timestamps: stats.unique_timestamps, resolution_minutes: 5,
    traffic_columns: ["speed","flow","occupancy","travel_time","delay","queue_length","congestion_index","sensor_quality"],
    network_columns: ["road_class","lanes","capacity","free_flow_speed","length_km","grade_pct","structural_bottleneck","importance"],
    message: "The hosted version uses a generated synthetic demo network. Upload the organizer files to replace it with official data." });
}