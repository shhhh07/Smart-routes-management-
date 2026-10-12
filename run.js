import { routeBySegments, analyzeSegments } from "lib/traffic.js";
export const access = "public";
export const methods = ["POST"];

function distanceMeters(a, b) {
  const lat = (Number(a[0]) + Number(b[0])) / 2 * Math.PI / 180;
  const dy = (Number(a[0]) - Number(b[0])) * 111320;
  const dx = (Number(a[1]) - Number(b[1])) * 111320 * Math.cos(lat);
  return Math.hypot(dx, dy);
}
function sampled(geometry, n) {
  if (!Array.isArray(geometry) || !geometry.length) return [];
  if (geometry.length <= n) return geometry;
  return Array.from({length:n}, (_,i) => geometry[Math.round(i * (geometry.length - 1) / (n - 1))]);
}
function divergence(a, b) {
  if (!a || !b || a.length < 2 || b.length < 2) return { mean_m:0, over_60m_pct:0, over_150m_pct:0 };
  const aa = sampled(a, 26), bb = sampled(b, 26);
  const nearest = (from, to) => from.map(p => Math.min(...to.map(q => distanceMeters(p, q))));
  const ds = nearest(aa,bb).concat(nearest(bb,aa));
  return { mean_m:Math.round(ds.reduce((sum,d)=>sum+d,0)/ds.length),
    over_60m_pct:Math.round(ds.filter(d=>d>60).length/ds.length*100),
    over_150m_pct:Math.round(ds.filter(d=>d>150).length/ds.length*100) };
}
function distinctEnough(a,b) {
  const d=divergence(a.geometry,b.geometry);
  return d.mean_m>=18 && (d.over_60m_pct>=6 || d.over_150m_pct>=4);
}
function routeMetrics(route, penalty) {
  const factor=penalty||1;
  const time=Number(route.travel_time_min)*factor;
  const distance=Number(route.distance_km);
  const speed=time>0?distance/time*60:0;
  return {
    route_id:route.route_id, label:route.label, distance_km:+distance.toFixed(2),
    travel_time_min:+time.toFixed(1), average_speed_kmh:+speed.toFixed(1),
    delay_min:route.delay_min===null||route.delay_min===undefined?null:+(Number(route.delay_min)+(time-Number(route.travel_time_min))).toFixed(1),
    congestion_index:route.congestion_index===null||route.congestion_index===undefined?null:
      +Math.min(.99,Number(route.congestion_index)+(factor-1)*.55).toFixed(3),
    route_score:route.route_score===null||route.route_score===undefined?null:Math.max(0,Math.round(Number(route.route_score)-(factor-1)*65)),
    geometry:route.geometry, traffic_status:route.traffic_status||"not_configured",
    source:route.source||"OpenStreetMap / OSRM"
  };
}
export default async function(req,res) {
  const body=req.body||{}, route=body.route&&typeof body.route==="object"?body.route:null;
  const routes=Array.isArray(body.routes)?body.routes.filter(r=>r&&Array.isArray(r.geometry)&&r.geometry.length>1):[];
  const ids=Array.isArray(body.segment_ids)?body.segment_ids:[];
  const segments=routeBySegments(ids);
  const type=String((body.scenario&&body.scenario.type)||body.scenario||"traffic_increase");
  const allowed=["traffic_increase","major_incident","road_closure","lane_reduction"];
  if(!allowed.includes(type))return res.status(400).json({error:"Unsupported scenario.",allowed_scenarios:allowed});
  const scenario={type,percent:Number((body.scenario&&body.scenario.percent)||body.percent)||20,
    segment_id:body.segment_id||(body.scenario&&body.scenario.segment_id)||(segments.length?segments[Math.floor(segments.length/2)].segment_id:null),
    lanes:Number((body.scenario&&body.scenario.lanes)||body.lanes)||1};

  if(route&&Number.isFinite(Number(route.travel_time_min))&&Number.isFinite(Number(route.distance_km))&&Array.isArray(route.geometry)) {
    const baseline=routeMetrics(route,1);
    const alternatives=routes.filter(r=>r.route_id!==route.route_id&&distinctEnough(r,route));
    let diverted=null;
    if(alternatives.length) {
      const scored=alternatives.map(r=>({route:r,divergence:divergence(route.geometry,r.geometry)}));
      // Closures/incidents prioritize a visibly different corridor; other scenarios
      // choose the quickest genuinely different alternative.
      if(type==="road_closure"||type==="major_incident") {
        scored.sort((a,b)=>(b.divergence.mean_m-a.divergence.mean_m)||(a.route.travel_time_min-b.route.travel_time_min));
      } else {
        scored.sort((a,b)=>(a.route.travel_time_min-b.route.travel_time_min)||(b.divergence.mean_m-a.divergence.mean_m));
      }
      diverted=scored[0];
    }
    const fallbackFactor=type==="traffic_increase"?1+Math.min(.45,scenario.percent/100*.65):
      type==="major_incident"?1.28:type==="road_closure"?1.12:1.18;
    const simulatedBase=diverted?diverted.route:route;
    const factor=diverted?(type==="traffic_increase"?1.03:type==="major_incident"?1.13:type==="road_closure"?1.08:1.10):fallbackFactor;
    const simulated=routeMetrics(simulatedBase,factor);
    const divergenceInfo=diverted?diverted.divergence:divergence(route.geometry,simulated.geometry);
    const changedPath=Boolean(diverted&&divergenceInfo.mean_m>=18);
    const delta=(a,b)=>a===null||a===undefined||b===null||b===undefined?null:+(b-a).toFixed(1);
    const pct=(a,b)=>!Number.isFinite(Number(a))||!Number.isFinite(Number(b))||Number(a)===0?null:+((Number(b)-Number(a))/Number(a)*100).toFixed(1);
    const recommendations={
      traffic_increase:"The scenario selects a different road corridor if an alternative is available. Compare its ETA and live flow sample before acting.",
      major_incident:"The scenario diverts to a different road corridor. Confirm the incident and actual restrictions using the live provider before dispatch decisions.",
      road_closure:"The scenario uses an alternate road path. This is a route diversion stress test, not a confirmed road closure; validate closures with live incident data.",
      lane_reduction:"The scenario selects an alternative road path and adds a capacity-related ETA penalty. Treat the result as an illustrative stress test."
    };
    return res.json({
      simulation_id:"SIM-"+Date.now().toString(36).toUpperCase(),
      mode:"osrm_route_diversion_scenario",
      scenario,
      baseline,
      simulated,
      diversion:{
        available:changedPath,
        changed_path:changedPath,
        from_route_id:route.route_id,
        to_route_id:simulatedBase.route_id,
        average_path_separation_m:divergenceInfo.mean_m,
        points_over_60m_pct:divergenceInfo.over_60m_pct,
        points_over_150m_pct:divergenceInfo.over_150m_pct,
        message:changedPath?"The orange path is a different road corridor from the blue baseline route.":"No sufficiently different alternate route was supplied; calculate alternatives again."
      },
      delta:{travel_time_min:delta(baseline.travel_time_min,simulated.travel_time_min),
        travel_time_pct:pct(baseline.travel_time_min,simulated.travel_time_min),
        distance_km:delta(baseline.distance_km,simulated.distance_km),
        delay_min:delta(baseline.delay_min,simulated.delay_min),
        speed_kmh:delta(baseline.average_speed_kmh,simulated.average_speed_kmh),
        congestion_index:delta(baseline.congestion_index,simulated.congestion_index),
        route_score:delta(baseline.route_score,simulated.route_score)},
      affected_segment_found:false,
      recommendation:recommendations[type],
      generated_at:new Date().toISOString(),
      note:"Route geometry and base ETA are from OSRM. The alternate path is a real OSRM road route. Scenario time penalties are illustrative, not calibrated forecasts or a confirmed prediction of traffic impact."
    });
  }

  if(!segments.length)return res.status(400).json({error:"Calculate a road route first, or provide valid demo segment_ids."});
  const before=analyzeSegments(segments,Date.now());
  const after=analyzeSegments(segments,Date.now(),scenario);
  const delta=(a,b)=>a===null||a===undefined||b===null||b===undefined?null:+(b-a).toFixed(1);
  return res.json({simulation_id:"SIM-"+Date.now().toString(36).toUpperCase(),mode:"synthetic_demo",scenario,baseline:before,simulated:after,
    diversion:{available:false,changed_path:false,message:"The synthetic demo graph does not represent a real-world road route."},
    delta:{travel_time_min:delta(before.travel_time_min,after.travel_time_min),speed_kmh:delta(before.average_speed_kmh,after.average_speed_kmh),
      congestion_index:delta(before.congestion_index,after.congestion_index)},
    affected_segment_found:segments.some(s=>s.segment_id===scenario.segment_id),
    recommendation:"Synthetic data only: validate results using the organizer dataset before using them for operational decisions.",
    generated_at:new Date().toISOString(),note:"Scenario results use the generated demo graph and are not real-world impact estimates."});
}