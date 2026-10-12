import { getTomTomKey, fetchFlow } from "lib/tomtom.js";
export const access = "public";
export const methods = ["GET"];
export default async function(req, res) {
  const key = await getTomTomKey();
  if (!key) return res.json({
    available:false, configured:false, provider_reachable:null, source:"TomTom Traffic API",
    message:"TomTom is not configured. Add a rotated TOMTOM_API_KEY in the secure project Setup page; live flow, incidents and traffic tiles stay off until it is saved."
  });
  try {
    const check = await fetchFlow(key, 17.3850, 78.4867);
    if (!check.ok) return res.json({
      available:false, configured:true, provider_reachable:true, source:"TomTom Traffic API",
      provider_status:check.status,
      message:"A key is saved, but TomTom rejected the live-flow request (HTTP " + check.status + "). Check that the key is active and the Traffic API is enabled for its subscription."
    });
    const f=check.data;
    return res.json({
      available:true, configured:true, provider_reachable:true, source:"TomTom Traffic API",
      checked_at:new Date().toISOString(),
      sample:{current_speed_kmh:f.currentSpeed,free_flow_speed_kmh:f.freeFlowSpeed,confidence:f.confidence},
      message:"TomTom live traffic is connected. The map can load its traffic-flow tile overlay and route calculations can sample live speed near each route midpoint."
    });
  } catch(error) {
    return res.json({available:false,configured:true,provider_reachable:false,source:"TomTom Traffic API",
      message:"The key is saved, but the TomTom live-flow endpoint could not be reached. Check provider availability and the key's Traffic API access."});
  }
}