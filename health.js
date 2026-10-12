export const access = "public";
export const methods = ["GET"];
export default async function(req, res) {
  res.json({ status: "ok", service: "Smart Routes Management API", mode: "synthetic_demo", timestamp: new Date().toISOString(),
    endpoints: ["/api/dashboard/summary", "/api/data/status", "/api/traffic", "/api/anomalies", "/api/routes/calculate", "/api/forecast", "/api/simulation/run", "/api/explanation", "/api/live/traffic", "/api/live/incidents"] });
}