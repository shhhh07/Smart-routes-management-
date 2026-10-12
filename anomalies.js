import { getAnomalies } from "lib/traffic.js";
export const access = "public";
export const methods = ["GET"];
export default async function(req, res) {
  const limit = req.query && req.query.limit ? Number(req.query.limit) : 40;
  const severity = String((req.query && req.query.severity) || "all");
  let anomalies = getAnomalies(limit);
  if (severity !== "all") anomalies = anomalies.filter(a => a.severity === severity);
  res.json({ count: anomalies.length, mode: "synthetic_demo_rule_detector", anomalies: anomalies,
    note: "This hosted demo uses deterministic statistical/rule-based anomaly flags, not a trained Isolation Forest model." });
}