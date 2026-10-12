(function () {
"use strict";
const API=(window.__HATCHABLE__&&window.__HATCHABLE__.api)||"/api";
const S={page:"dashboard",summary:null,data:null,traffic:[],network:null,anomalies:[],incidents:null,tomtomStatus:null,routes:[],selected:null,forecast:null,simulation:null,explanation:null,map:null,simMap:null,scenario:"traffic_increase",percent:20,segment:"",origin:"Hyderabad Deccan Nampally, Telangana, India",destination:"Charminar, Hyderabad, Telangana, India",live:null,originPicked:false};
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const esc=x=>String(x==null?"":x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const n=(x,d)=>x===null||x===undefined||x===""||!Number.isFinite(Number(x))?"—":Number(x).toLocaleString(undefined,{maximumFractionDigits:d==null?1:d});
const pct=x=>x===null||x===undefined||!Number.isFinite(Number(x))?"—":Math.round(Number(x)*100)+"%";
const META={
 dashboard:["Dashboard","Traffic at a glance","Spot emerging congestion, compare routes and understand what may happen next."],
 routes:["Route intelligence","Find a route you can trust","Compare travel time, congestion, delay and modeled route certainty."],
 traffic:["Traffic intelligence","Detect emerging traffic risk","Inspect road speed, flow, congestion and anomaly signals."],
 forecast:["Forecast","Know what comes next","Explore modeled traffic indicators at +15, +30 and +45 minutes."],
 simulation:["What-if simulation","Test decisions before disruption","Compare baseline conditions with a closure, incident or demand surge."],
 live:["Live traffic","Connect external traffic data","TomTom integration is optional and requires your own API key."],
 network:["Network & data","Understand the road network","Review generated graph statistics and data coverage."],
 insights:["Insights","Evidence behind decisions","Understand why the selected route behaves as it does."],
 status:["System status","Know what is connected","Review services, dataset state and external dependencies."]
};
let toastTimer;
function toast(t){const e=$("#toast");if(!e)return;e.textContent=t;e.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove("show"),3500);}
async function api(path,opts){opts=opts||{};const headers={"Accept":"application/json"};if(opts.body!==undefined)headers["Content-Type"]="application/json";const r=await fetch(API+path,{method:opts.method||"GET",headers:headers,body:opts.body===undefined?undefined:JSON.stringify(opts.body)});const d=await r.json().catch(()=>({error:"Non-JSON response"}));if(!r.ok)throw new Error(d.message||d.error||("Request failed "+r.status));return d;}
function btn(label,action,kind){return '<button class="btn '+(kind||"btn-secondary")+'" data-action="'+action+'">'+label+'</button>';}
function heading(k,t,p,a){return '<div class="page-heading"><div><div class="eyebrow">'+k+'</div><h1>'+t+'</h1><p>'+p+'</p></div><div class="heading-actions">'+(a||"")+'</div></div>';}
function card(t,p,b,x){return '<section class="card"><div class="card-head"><div><h2 class="card-title">'+t+'</h2><p class="card-subtitle">'+(p||"")+'</p></div>'+(x||"")+'</div>'+b+'</section>';}
function body(s){return '<div class="card-body">'+s+'</div>';}
function pill(t,k){return '<span class="pill pill-'+(k||"gray")+'">'+t+'</span>';}
function metric(t,v){return '<div class="metric-box"><span>'+t+'</span><strong>'+v+'</strong></div>';}
function kpi(t,v,i,c,f){return '<section class="card kpi"><div class="kpi-top"><span class="kpi-label">'+t+'</span><span class="kpi-icon '+c+'">'+i+'</span></div><div class="kpi-value">'+v+'</div><div class="kpi-foot">'+f+'</div></section>';}
function routeCards(){
 if(!S.routes.length)return '<div class="empty-state">Enter a start and destination, then calculate route alternatives.</div>';
 return '<div class="route-list">'+S.routes.map(r=>'<div class="route-option '+(S.selected&&S.selected.route_id===r.route_id?"selected":"")+'" data-route="'+esc(r.route_id)+'"><div class="route-letter">'+esc(r.route_id)+'</div><div class="route-detail"><strong>'+esc(r.label||"Alternative")+'</strong><span>'+n(r.distance_km)+' km · '+n(r.average_speed_kmh)+' km/h</span></div><div class="route-time"><strong>'+n(r.travel_time_min)+' min</strong><span>score '+n(r.route_score,0)+'</span></div></div>').join("")+'</div>';
}
function routeMetrics(){
 if(!S.selected)return '<div class="notice">Calculate routes to enable route-specific forecasts, explanations and simulations.</div>';
 const r=S.selected;
 return '<div class="metric-row">'+metric("Travel time",n(r.travel_time_min)+" min")+metric("Traffic sample delay",n(r.delay_min)+" min")+metric("Sample congestion",pct(r.congestion_index))+'</div><div class="metric-row spacer-top">'+metric("Sample confidence",r.certainty_score==null?"N/A":n(r.certainty_score,0)+"/100")+metric("Route score",n(r.route_score,0)+"/100")+metric("Data source",esc(r.source||"—"))+'</div><p class="text-small spacer-top">'+esc(r.traffic_status==="tomtom_sampled"?"Traffic is sampled near the route midpoint only.": "Live traffic is not configured; congestion and delay remain unavailable.")+'</p>';
}
function routeForm(){
 return '<form class="route-form" id="routeForm"><div class="field"><label for="originInput">START LOCATION</label><div class="input-wrap"><span class="field-marker">●</span><input class="input" id="originInput" value="'+esc(S.origin)+'" placeholder="Address or lat, lon"></div></div><div class="field"><label for="destinationInput">DESTINATION</label><div class="input-wrap"><span class="field-marker" style="color:#FF6B4A">●</span><input class="input" id="destinationInput" value="'+esc(S.destination)+'" placeholder="Address or lat, lon"></div></div><div class="full text-small">Search real places or paste latitude, longitude. Routes follow real road geometry; live traffic is an optional overlay.</div><button class="btn btn-primary full" type="submit" id="calculateRoutes">⌁ Calculate routes</button></form>';
}
function mapCard(large){
 const map='<div class="map-wrap '+(large?"large":"")+'"><div id="trafficMap" aria-label="Interactive traffic map"></div><div class="map-tip">Real road map · route geometry from OSRM</div><div class="map-legend"><span><i class="legend-dot" style="background:#2563EB"></i>Selected route</span><span><i class="legend-dot" style="background:#FF6B4A"></i>TomTom traffic overlay (optional)</span></div></div>';
 return card("Road map & route","OpenStreetMap road tiles. Only actual calculated route geometry is drawn on top.",map,pill(S.tomtomStatus&&S.tomtomStatus.available?"LIVE TRAFFIC READY":"ROAD MAP READY","teal"));
}
function table(rows,headers,fn){
 const th='<thead><tr>'+headers.map(h=>"<th>"+h+"</th>").join("")+'</tr></thead>';
 const tr=rows.length?rows.map(fn).join(""):'<tr><td colspan="'+headers.length+'">No data returned.</td></tr>';
 return '<div class="table-wrap"><table>'+th+'<tbody>'+tr+'</tbody></table></div>';
}
function anomalyTable(rows){
 return table(rows,["Segment","Severity","Speed","Congestion"],a=>'<tr><td><strong>'+esc(a.segment_id)+'</strong></td><td><span class="severity '+esc(a.severity)+'">'+esc(a.severity)+'</span></td><td>'+n(a.speed)+' km/h</td><td>'+Math.round(a.congestion_index*100)+'%</td></tr>');
}
function trafficTable(rows){
 return table(rows,["Segment","Class","Speed","Flow","Occupancy","Congestion","Delay","Status"],s=>'<tr><td><strong>'+esc(s.segment_id)+'</strong></td><td>'+esc(s.road_class)+'</td><td>'+n(s.speed)+' km/h</td><td>'+n(s.flow,0)+'</td><td>'+Math.round(s.occupancy*100)+'%</td><td>'+Math.round(s.congestion_index*100)+'%</td><td>'+n(s.delay)+' min</td><td><span class="severity '+esc(s.severity)+'">'+(s.anomaly?"Anomaly · ":"")+esc(s.severity)+'</span></td></tr>');
}
function forecastData(){return S.forecast&&S.forecast.forecasts?S.forecast.forecasts:[];}
function bars(data,key){
 if(!data.length)return '<div class="empty-state">No forecast data available.</div>';
 if(key==="congestion"&&data.every(f=>f[key]===null||f[key]===undefined))return '<div class="empty-state">Live congestion is unavailable until TomTom is configured.</div>';
 const max=Math.max(1,...data.map(x=>Number(x[key])||0));
 return '<div class="small-bars">'+data.map((f,i)=>'<div class="bar-column"><div class="bar '+(key==="congestion"?"teal":i===data.length-1?"coral":"")+'" style="height:'+Math.max(6,(Number(f[key])||0)/max*93)+'%"></div><span>'+(f.minutes_ahead===0?"Now":"+"+f.minutes_ahead+"m")+'</span></div>').join("")+'</div>';
}
function dashboard(){
 const s=S.summary||{};
 return heading("TRAFFIC INTELLIGENCE / OVERVIEW","Traffic at a glance","Spot emerging congestion, compare routes and understand what may happen next.",btn("↻ Refresh data","refresh"))+
 '<div class="kpi-grid">'+kpi("Road segments",n(s.road_segments,0),"⌁","blue","Network available")+kpi("Network nodes",n(s.network_nodes,0),"⠿","teal","Connected demo graph")+kpi("Average speed",n(s.average_speed)+" km/h","↗","blue","Synthetic snapshot")+kpi("Anomaly signals",n(s.detected_anomalies,0),"!","coral","Demo detector")+'</div>'+
 '<div class="dashboard-grid">'+mapCard(false)+card("Intelligent route evaluation","Fastest is not always most reliable.",routeForm()+body(routeCards())+body(routeMetrics()),pill("OSRM ROAD ROUTING","blue"))+'</div>'+
 '<div class="section-grid">'+card("Emerging traffic signals","Synthetic rule/statistical detector",anomalyTable((S.anomalies||[]).slice(0,6)),btn("View all","traffic"))+card("Forecast preview","Modeled indicator trend",body('<div class="metric-row">'+metric("Avg. speed",n(s.average_speed)+" km/h")+metric("Mean congestion",Math.round((s.average_congestion||0)*100)+"%")+metric("Horizon","45 min")+'</div>'+bars(forecastData(),"congestion")),btn("Open forecast","forecast"))+'</div>'+
 '<div class="notice warning">DEMO MODE: generated synthetic road network. For software demonstration only, not real-world navigation or emergency dispatch.</div>';
}
function routesPage(){
 return heading("ROUTE INTELLIGENCE","Find a route you can trust","Compare real road distance and base drive time. Live congestion is added only when TomTom is configured.",btn("Recalculate","calculate","btn-primary"))+
 '<div class="dashboard-grid">'+card("Choose your journey","Enter coordinates or a place name.",routeForm()+body(routeCards())+body(routeMetrics()),pill("NETWORK ROUTING","blue"))+mapCard(true)+'</div>'+
 card("Route comparison","Metrics for calculated alternatives.",table(S.routes,["Route","Distance","Time","Speed","Delay","Congestion","Certainty"],r=>'<tr data-route="'+esc(r.route_id)+'"><td><strong>'+esc(r.route_id)+" · "+esc(r.label)+'</strong></td><td>'+n(r.distance_km)+' km</td><td>'+n(r.travel_time_min)+' min</td><td>'+n(r.average_speed_kmh)+' km/h</td><td>'+n(r.delay_min)+' min</td><td>'+pct(r.congestion_index)+'</td><td>'+(r.certainty_score==null?"N/A":n(r.certainty_score,0)+'%')+'</td></tr>'));
}
function trafficPage(){
 const rows=S.traffic||[];
 return heading("DETECT","Traffic intelligence","Inspect road speed, flow, occupancy, congestion and anomaly indicators.",btn("Refresh traffic","refresh"))+
 '<div class="kpi-grid">'+kpi("Segments inspected",n(rows.length,0),"≋","blue","Current snapshot")+kpi("High congestion",n(rows.filter(s=>s.congestion_index>=.82).length,0),"!","coral","Modeled threshold")+kpi("Anomaly flags",n(S.anomalies.length,0),"⌁","teal","Demo detector")+kpi("Resolution","5 min","◷","gray","Demo interval")+'</div>'+
 '<div class="card"><div class="card-head"><div><h2 class="card-title">Road segment monitor</h2><p class="card-subtitle">Filter by severity or search segment ID.</p></div><div class="heading-actions"><select id="severityFilter" class="select"><option value="all">All severity</option><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select><input id="trafficSearch" class="input" placeholder="Search segment…" style="max-width:160px"></div></div><div id="trafficTableWrap">'+trafficTable(rows)+'</div></div>';
}
function forecastPage(){
 const data=forecastData();
 const tiles=data.map((f,i)=>'<div class="forecast-tile '+(i===0?"current":"")+'"><div class="time">'+(i===0?"CURRENT":"+"+f.minutes_ahead+" MINUTES")+'</div><strong>'+n(f.speed)+' <small>km/h</small></strong><span>Speed estimate</span><div class="text-small spacer-top">Congestion '+pct(f.congestion)+' · Delay '+n(f.delay)+' min</div></div>').join("");
 return heading("PREDICT","Know what comes next","Base road ETA from OSRM plus an indicative future horizon; TomTom can add a midpoint traffic sample.",btn("Refresh forecast","forecast","btn-primary"))+
 '<div class="notice warning">The current route distance and base ETA come from real road routing. Future horizons are illustrative, not trained/validated predictions; congestion remains unavailable unless TomTom is configured.</div><div class="forecast-grid spacer-top">'+tiles+'</div>'+
 '<div class="section-grid">'+card("Speed projection","Average speed along the selected route or demo sample.",body(bars(data,"speed")))+card("Congestion projection","Modeled congestion indicator.",body(bars(data,"congestion")))+'</div>'+
 card("Forecast table","Route-specific after a route is selected.",table(data,["Horizon","Speed","Congestion","Delay","Travel time","Confidence indicator"],f=>'<tr><td><strong>'+(f.minutes_ahead===0?"Current":"+"+f.minutes_ahead+" min")+'</strong></td><td>'+n(f.speed)+' km/h</td><td>'+pct(f.congestion)+'</td><td>'+n(f.delay)+' min</td><td>'+n(f.travel_time)+' min</td><td>'+Math.round(f.confidence*100)+'% demo indicator</td></tr>'));
}
function simulationPage(){
 const sim=S.simulation;
 const types=[["traffic_increase","↗","Traffic increase","Increase demand"],["major_incident","!","Major incident","Slow one segment"],["road_closure","⊘","Road closure","Block an edge"],["lane_reduction","⇣","Lane reduction","Reduce capacity"]];
 let result='<div class="empty-state">Choose a scenario and run it to compare calculated metrics.</div>';
 if(sim){
  const metrics=[["Travel time",n(sim.baseline.travel_time_min)+" min",n(sim.simulated.travel_time_min)+" min"],["Average speed",n(sim.baseline.average_speed_kmh)+" km/h",n(sim.simulated.average_speed_kmh)+" km/h"],["Delay",n(sim.baseline.delay_min)+" min",n(sim.simulated.delay_min)+" min"],["Congestion",pct(sim.baseline.congestion_index),pct(sim.simulated.congestion_index)]];
  const diversion=sim.diversion||{};
  result='<div class="sim-result-grid">'+metrics.map(x=>'<div class="sim-result"><span>'+x[0]+'</span><strong>'+x[2]+'</strong><small>Before: '+x[1]+'</small></div>').join("")+'</div>'+
   '<div class="notice '+(diversion.changed_path?"success":"warning")+' spacer-top"><strong>'+(diversion.changed_path?"Path divergence detected":"No distinct diversion available")+'</strong><br>'+esc(diversion.message||"Calculate route alternatives to compare different road paths.")+
   (diversion.changed_path?'<br><strong>Path:</strong> Route '+esc(diversion.from_route_id)+' → Route '+esc(diversion.to_route_id)+' · mean separation '+n(diversion.average_path_separation_m,0)+' m':'')+'</div>'+
   '<div class="notice spacer-top"><strong>Suggested action</strong><br>'+esc(sim.recommendation)+'</div>'+
   '<p class="text-small spacer-top">Travel time delta '+n(sim.delta.travel_time_min)+' min ('+n(sim.delta.travel_time_pct)+'%). '+esc(sim.note||"")+'</p>';
 }
 return heading("SIMULATE","Test the what-if","Change a network assumption and compare baseline with the scenario.",btn("Run simulation","runSimulation","btn-primary"))+
 '<div class="simulation-layout"><section class="card"><div class="card-head"><div><h2 class="card-title">Configure scenario</h2><p class="card-subtitle">Calculate a route first for route-specific results.</p></div></div><div class="card-body"><div class="scenario-list">'+types.map(t=>'<button class="scenario-choice '+(S.scenario===t[0]?"active":"")+'" data-scenario="'+t[0]+'"><span class="scenario-icon">'+t[1]+'</span><strong>'+t[2]+'</strong><span>'+t[3]+'</span></button>').join("")+'</div>'+
 '<div class="range-wrap" id="demandRange" style="'+(S.scenario==="traffic_increase"?"":"display:none")+'"><div class="range-head"><label for="demandSlider">Traffic increase</label><output id="demandOutput">'+S.percent+'%</output></div><input type="range" id="demandSlider" min="10" max="50" step="10" value="'+S.percent+'"></div>'+
 '<div class="field" style="'+(S.selected?"display:none":"")+'"><label for="affectedSegment">DEMO SEGMENT (ONLY WITHOUT A ROUTE)</label><select class="select" id="affectedSegment">'+(S.traffic||[]).slice(0,150).map(s=>'<option value="'+esc(s.segment_id)+'" '+(S.segment===s.segment_id?"selected":"")+'>'+esc(s.segment_id)+" · "+esc(s.road_class)+'</option>').join("")+'</select></div>'+
 '<p class="text-small spacer-top">When a real route is selected, these controls apply illustrative whole-route stress-test multipliers; precise road-edge closures need a road-edge traffic graph.</p><button class="btn btn-primary" style="width:100%;margin-top:14px" data-action="runSimulation">▶ Run simulation</button></div></section>'+
 '<section class="card"><div class="card-head"><div><h2 class="card-title">Before vs after</h2><p class="card-subtitle">'+S.scenario+'</p></div>'+pill(sim&&sim.diversion&&sim.diversion.changed_path?"PATH DIVERGED":sim?"SIMULATED":"AWAITING RUN",sim&&sim.diversion&&sim.diversion.changed_path?"teal":"gray")+'</div><div class="card-body">'+result+'</div></section></div>'+
 '<div class="section-grid"><section class="card"><div class="card-head"><div><h2 class="card-title">Path divergence map</h2><p class="card-subtitle">Blue = baseline route · coral dashed = simulated diversion</p></div></div><div class="map-wrap large"><div id="simulationMap" aria-label="Before and after route divergence map"></div><div class="map-legend"><span><i class="legend-dot" style="background:#2563EB"></i>Baseline</span><span><i class="legend-dot" style="background:#FF6B4A"></i>What-if route</span></div></div></section></div>';
}
function livePage(){
 const l=S.live, i=S.incidents;
 let txt=l?(l.available?"Current speed "+n(l.current_speed_kmh)+" km/h · free-flow "+n(l.free_flow_speed_kmh)+" km/h":l.message||"Not connected"):"No request made yet.";
 let incidentText=i?(i.message||((i.count||0)+" live incidents returned.")):"Load incident status to check connectivity.";
 return heading("LIVE DATA","Live traffic connection","TomTom keys are read from secure project settings, never from browser code.",btn("Load incidents","loadIncidents"))+
 '<div class="section-grid">'+card("TomTom Traffic Flow","Credentials are read securely by the backend.",body('<div class="notice '+(S.tomtomStatus&&S.tomtomStatus.available?"success":"warning")+'">'+esc(S.tomtomStatus&&S.tomtomStatus.message||"TomTom setup status unavailable.")+'</div><p class="text-small spacer-top">Set TOMTOM_API_KEY in the secure project Setup page. Do not paste API keys into this webpage. <a href="https://hatchable.com/console/projects/smart-routes" target="_blank" rel="noopener">Open Setup ↗</a></p><form id="liveForm" class="spacer-top"><div class="metric-row spacer-top"><div class="field"><label for="liveLat">LATITUDE</label><input class="input" id="liveLat" type="number" step="any" value="17.3850"></div><div class="field"><label for="liveLon">LONGITUDE</label><input class="input" id="liveLon" type="number" step="any" value="78.4867"></div><div class="field" style="justify-content:end"><button class="btn btn-primary" type="submit" '+(S.tomtomStatus&&S.tomtomStatus.configured?"":"disabled")+ '>Check flow</button></div></div></form><div class="notice spacer-top">'+esc(txt)+'</div>'),pill(S.tomtomStatus&&S.tomtomStatus.available?"LIVE CONNECTED":S.tomtomStatus&&S.tomtomStatus.configured?"CHECK KEY":"NEEDS SETUP",S.tomtomStatus&&S.tomtomStatus.available?"teal":"coral"))+
 card("Incident feed","Live provider response or labeled demo markers.",body('<div class="notice '+(i&&i.available?"success":"warning")+'">'+esc(incidentText)+'</div><div class="text-small spacer-top">'+(i&&i.count!==undefined?n(i.count)+" incidents from provider":n(i&&i.incidents?i.incidents.length:0)+" demo incidents")+'</div>'),btn("Load incidents","loadIncidents"))+
 '</div><div class="dashboard-grid">'+mapCard(true)+'</div><div class="notice">OpenStreetMap provides the road map; the TomTom layer and live road-speed/incident observations appear when TOMTOM_API_KEY is configured in secure Setup.</div>';
}
function networkPage(){
 const d=S.data||{},s=S.summary||{};
 const stats=[["Road segments",d.road_segments||s.road_segments||436],["Network nodes",d.network_nodes||s.network_nodes||120],["Training observations",d.training_observations||1883520],["Validation observations",d.validation_observations||502272],["Unique timestamps",d.unique_timestamps||4320],["Resolution",(d.resolution_minutes||5)+" min"]];
 return heading("NETWORK / DATA","Understand the network","Review generated graph statistics and expected dataset fields.",btn("Reload network","refresh"))+
 '<div class="notice warning"><strong>ORGANIZER DATASET NOT CONNECTED</strong><br>'+esc(d.message||"The hosted workspace currently uses synthetic data.")+'</div><div class="data-stat-grid spacer-top">'+stats.map(x=>'<div class="data-stat"><span>'+x[0]+'</span><strong>'+n(x[1],0)+'</strong></div>').join("")+'</div>'+
 '<div class="dashboard-grid">'+mapCard(true)+card("Expected dataset schema","Fields from the project specification.",body('<div class="insight-item"><div class="insight-icon">≋</div><div><strong>Traffic attributes</strong><p>timestamp, segment_id, speed, flow, occupancy, travel_time, delay, queue_length, congestion_index, sensor_quality</p></div></div><div class="insight-item"><div class="insight-icon">⠿</div><div><strong>Network attributes</strong><p>segment_id, source_node, target_node, road_class, lanes, capacity, free_flow_speed, length_km, grade_pct, structural_bottleneck, importance</p></div></div><div class="insight-item"><div class="insight-icon">⌖</div><div><strong>Nodes</strong><p>node_id, latitude, longitude</p></div></div>'))+'</div>';
}
function insightsPage(){
 const e=S.explanation,r=S.selected;
 let result='<div class="empty-state">Generate an explanation to show supporting evidence.</div>';
 if(e)result='<div class="insight-item"><div class="insight-icon">✳</div><div><strong>'+esc(e.what_happened)+'</strong><p>'+esc((e.why||[]).join(" "))+'</p></div></div><div class="notice spacer-top">'+esc(e.recommendation)+'</div><div class="text-small spacer-top">Source: '+esc(e.source)+" · "+esc(e.confidence)+'</div>';
 let info='<div class="notice">No selected route. A sample segment set can be analyzed.</div>';
 if(r)info='<div class="metric-row">'+metric("Route",esc(r.route_id))+metric("Travel time",n(r.travel_time_min)+" min")+metric("Sample congestion",pct(r.congestion_index))+'</div>';
 const first=card("Selected route","Calculate a route for route-specific diagnosis.",body(info)+btn("Generate explanation","explain","btn-primary"));
 const second=card("Decision explanation","Calculated evidence and limitations.",body(result));
 return heading("EXPLAIN","Evidence behind decisions","Explain route metrics and understand their limitations.",btn("Explain route","explain","btn-primary"))+'<div class="dashboard-grid">'+first+second+'</div>';
}
function statusPage(){
 const rows=[["Hosted API gateway","Available"],["Demo data engine","Ready"],["Route calculation","Available"],["Anomaly endpoint","Available"],["Forecast endpoint","Available"],["Simulation endpoint","Available"],["OpenStreetMap tiles","External"],["TomTom live traffic",S.tomtomStatus&&S.tomtomStatus.available?"Connected":S.tomtomStatus&&S.tomtomStatus.configured?"Check key/API":"Needs setup"],["Organizer dataset","Not connected"]];
 const items=rows.map((r,i)=>'<div class="status-row"><div class="status-left"><div class="status-symbol">'+["⌘","▦","⌁","!","◷","◇","⌖","◉","▤"][i]+'</div><div><strong>'+r[0]+'</strong><small>'+["Request routing and JSON endpoints","Generated graph and traffic attributes","Weighted path calculation","Synthetic rule signals","Demo trend baseline","Scenario metrics","Needs internet","Requires API key","Official files not uploaded"][i]+'</small></div></div><span class="status-right '+(i>6?"offline":"")+'">'+r[1]+'</span></div>').join("");
 return heading("OBSERVABILITY","System status","Review service capabilities and external dependencies.",btn("Recheck","refresh"))+
 '<div class="dashboard-grid">'+card("Service health","Hosted feature status.",body('<div class="status-list">'+items+'</div>'))+
 card("Data status","Current demo metadata.",body('<div class="metric-row">'+metric("Segments",n((S.data||{}).road_segments||436,0))+metric("Nodes",n((S.data||{}).network_nodes||120,0))+metric("Mode","Demo")+'</div><div class="notice warning spacer-top">Hosted JavaScript implementation, not the separate Python microservice stack described in the project deck.</div><p class="text-small spacer-top">Last refreshed: '+new Date().toLocaleString()+'</p>'))+'</div>';
}
function render(){
 const m=META[S.page]||META.dashboard;$("#crumb").textContent=m[0];
 $$(".nav-item").forEach(e=>e.classList.toggle("active",e.dataset.page===S.page));
 const views={dashboard:dashboard,routes:routesPage,traffic:trafficPage,forecast:forecastPage,simulation:simulationPage,live:livePage,network:networkPage,insights:insightsPage,status:statusPage};
 $("#pageContent").innerHTML=(views[S.page]||dashboard)();bindForms();
 if(["dashboard","routes","network","traffic","live"].includes(S.page))initMap();
 if(S.page==="simulation")initSimulationMap();
}
async function loadAll(){
 const a=await Promise.allSettled([api("/dashboard/summary"),api("/data/status"),api("/traffic"),api("/anomalies?limit=100"),api("/network"),api("/live/incidents"),api("/live/status")]);
 if(a[0].status==="fulfilled")S.summary=a[0].value;
 if(a[1].status==="fulfilled")S.data=a[1].value;
 if(a[2].status==="fulfilled")S.traffic=a[2].value.segments||[];
 if(a[3].status==="fulfilled")S.anomalies=a[3].value.anomalies||[];
 if(a[4].status==="fulfilled")S.network=a[4].value;
 if(a[5].status==="fulfilled")S.incidents=a[5].value;
 if(a[6].status==="fulfilled")S.tomtomStatus=a[6].value;
 $("#navAlerts").textContent=n(S.anomalies.length,0);
 if(!S.forecast){try{S.forecast=await api("/forecast",{method:"POST",body:{segment_ids:[]}});}catch(e){}}
 render();
}
function initSimulationMap(){
 const el=$("#simulationMap");if(!el)return;
 if(!window.L){el.textContent="Leaflet could not load. Check internet and refresh.";return;}
 if(S.simMap){S.simMap.remove();S.simMap=null;}
 const sim=S.simulation;
 const baseline=(sim&&sim.baseline&&sim.baseline.geometry)|| (S.selected&&S.selected.geometry)||null;
 const after=sim&&sim.simulated&&sim.simulated.geometry;
 const start=(baseline&&baseline[0])||[17.385,78.4867];
 const map=L.map(el).setView(start,12);S.simMap=map;
 L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(map);
 if(S.tomtomStatus&&S.tomtomStatus.available)L.tileLayer(API+"/live/tile?z={z}&x={x}&y={y}",{maxZoom:19,opacity:.68,attribution:'Traffic © <a href="https://www.tomtom.com/">TomTom</a>'}).addTo(map);
 const layers=[];
 if(Array.isArray(baseline)&&baseline.length>1){
  const a=L.polyline(baseline,{color:"#2563EB",weight:7,opacity:.95,lineCap:"round",lineJoin:"round"}).addTo(map);
  a.bindPopup("<strong>Baseline route "+esc(sim&&sim.baseline&&sim.baseline.route_id||S.selected&&S.selected.route_id||"A")+"</strong>");
  layers.push(a);
 }
 if(Array.isArray(after)&&after.length>1&&sim&&sim.diversion&&sim.diversion.changed_path){
  const b=L.polyline(after,{color:"#FF6B4A",weight:5,opacity:.98,dashArray:"9 7",lineCap:"round",lineJoin:"round"}).addTo(map);
  b.bindPopup("<strong>What-if diversion "+esc(sim.simulated.route_id||"")+"</strong><br>"+n(sim.simulated.distance_km)+" km · "+n(sim.simulated.travel_time_min)+" min");
  layers.push(b);
 }
 if(layers.length){
  let bounds=layers[0].getBounds();
  for(let i=1;i<layers.length;i++)bounds=bounds.extend(layers[i].getBounds());
  map.fitBounds(bounds,{padding:[28,28],maxZoom:15});
  const ends=baseline&&baseline.length? [baseline[0],baseline[baseline.length-1]]:[];
  if(ends.length===2){
   L.circleMarker(ends[0],{radius:6,color:"#fff",weight:2,fillColor:"#14B8A6",fillOpacity:1}).addTo(map).bindPopup("Start");
   L.circleMarker(ends[1],{radius:6,color:"#fff",weight:2,fillColor:"#172033",fillOpacity:1}).addTo(map).bindPopup("Destination");
  }
 }else{
  map.setView([17.385,78.4867],12);
  L.control.zoom({position:"topright"}).addTo(map);
 }
 setTimeout(()=>{if(S.simMap)S.simMap.invalidateSize();},120);
}
function initMap(){
 const el=$("#trafficMap");if(!el)return;
 if(!window.L){el.textContent="Leaflet did not load. Check internet and refresh.";return;}
 if(S.map){S.map.remove();S.map=null;}
 const map=L.map(el).setView([17.385,78.4867],12);S.map=map;
 L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(map);
 // Never draw the synthetic graph edges: those straight lines created the misleading grid.
 if(S.tomtomStatus&&S.tomtomStatus.available){
  L.tileLayer(API+"/live/tile?z={z}&x={x}&y={y}",{maxZoom:19,opacity:.72,attribution:'Traffic © <a href="https://www.tomtom.com/">TomTom</a>'}).addTo(map);
 }
 // Only overlay a calculated real-road route, using the geometry returned by OSRM.
 if(S.selected&&Array.isArray(S.selected.geometry)&&S.selected.geometry.length>1){
  const routeLine=L.polyline(S.selected.geometry,{color:"#2563EB",weight:5,opacity:.92,lineCap:"round",lineJoin:"round"}).addTo(map);
  routeLine.bindPopup("<strong>"+esc(S.selected.label||"Selected route")+"</strong><br>"+n(S.selected.distance_km)+" km · "+n(S.selected.travel_time_min)+" min");
  map.fitBounds(routeLine.getBounds(),{padding:[24,24],maxZoom:15});
 }
 // Draw incidents only when they are returned by the real TomTom provider.
 if(S.incidents&&S.incidents.available&&Array.isArray(S.incidents.incidents)){
  S.incidents.incidents.forEach(item=>{
   const geometry=item.geometry&&item.geometry.coordinates;
   if(!Array.isArray(geometry))return;
   const point=typeof geometry[0]==="number"?[geometry[1],geometry[0]]:(geometry[0]&&typeof geometry[0][0]==="number"?[geometry[0][1],geometry[0][0]]:null);
   if(point)L.circleMarker(point,{radius:6,color:"#fff",weight:1.5,fillColor:"#FF6B4A",fillOpacity:.95}).addTo(map).bindPopup(esc((item.properties&&item.properties.from)||"Traffic incident"));
  });
 }
 map.on("click",ev=>{
  const text=ev.latlng.lat.toFixed(5)+", "+ev.latlng.lng.toFixed(5);
  if(!S.originPicked){S.origin=text;S.originPicked=true;toast("Start set. Click again for destination.");}
  else{S.destination=text;S.originPicked=false;toast("Destination set. Calculate routes.");}
  const o=$("#originInput"),d=$("#destinationInput");if(o)o.value=S.origin;if(d)d.value=S.destination;
 });
 setTimeout(()=>{if(S.map)S.map.invalidateSize();},100);
}
async function geocode(text){
 const raw=String(text||"").trim();
 if(!raw)throw new Error("Enter both locations.");
 const match=raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
 if(match)return {lat:Number(match[1]),lon:Number(match[2])};
 const data=await api("/geocode?q="+encodeURIComponent(raw));
 if(data.results&&data.results.length)return {lat:Number(data.results[0].lat),lon:Number(data.results[0].lon),display_name:data.results[0].display_name};
 if(Number.isFinite(Number(data.lat))&&Number.isFinite(Number(data.lon)))return {lat:Number(data.lat),lon:Number(data.lon),display_name:data.display_name||raw};
 throw new Error("No matching location found. Try a more specific address or enter latitude, longitude.");
}
async function calculate(){
 const b=$("#calculateRoutes");if(b){b.disabled=true;b.textContent="Calculating…";}
 try{
  if($("#originInput"))S.origin=$("#originInput").value;if($("#destinationInput"))S.destination=$("#destinationInput").value;
  const o=await geocode(S.origin);await new Promise(r=>setTimeout(r,1100));const d=await geocode(S.destination);
  const result=await api("/routes/calculate",{method:"POST",body:{origin:o,destination:d}});
  if(!result.coverage){S.routes=[];S.selected=null;render();toast(result.message||"No supporting traffic dataset found.");return;}
  S.routes=result.routes||[];S.selected=S.routes[0]||null;S.simulation=null;S.explanation=null;
  S.forecast=await api("/forecast",{method:"POST",body:{route:S.selected,route_id:S.selected&&S.selected.route_id,segment_ids:S.selected?S.selected.segment_ids:[]}});
  render();toast("Calculated "+S.routes.length+" alternative(s).");
 }catch(e){toast(e.message);}
 finally{const x=$("#calculateRoutes");if(x){x.disabled=false;x.textContent="⌁ Calculate routes";}}
}
async function refreshForecast(){
 try{S.forecast=await api("/forecast",{method:"POST",body:{route:S.selected,route_id:S.selected&&S.selected.route_id,segment_ids:S.selected?S.selected.segment_ids:[]}});if(S.page==="forecast")render();toast("Forecast refreshed.");}
 catch(e){toast(e.message);}
}
async function simulate(){
 try{
  const ids=S.selected&&S.selected.segment_ids&&S.selected.segment_ids.length?S.selected.segment_ids:(S.traffic||[]).slice(0,10).map(s=>s.segment_id);
  S.segment=($("#affectedSegment")&&$("#affectedSegment").value)||S.segment||ids[Math.floor(ids.length/2)];
  S.simulation=await api("/simulation/run",{method:"POST",body:{route:S.selected,routes:S.routes,route_id:S.selected&&S.selected.route_id,segment_ids:ids,scenario:{type:S.scenario,percent:S.percent,segment_id:S.segment,lanes:1}}});
  render();toast("Simulation completed.");
 }catch(e){toast(e.message);}
}
async function explain(){
 try{
  const ids=S.selected&&S.selected.segment_ids&&S.selected.segment_ids.length?S.selected.segment_ids:(S.traffic||[]).slice(0,10).map(s=>s.segment_id);
  S.explanation=await api("/explanation",{method:"POST",body:{route:S.selected,route_id:S.selected&&S.selected.route_id,segment_ids:ids}});
  S.page="insights";render();toast("Evidence explanation generated.");
 }catch(e){toast(e.message);}
}
async function loadIncidents(){
 try{
  S.tomtomStatus=await api("/live/status");
  const checks=await Promise.allSettled([
   api("/live/incidents"),
   S.tomtomStatus&&S.tomtomStatus.configured?api("/live/traffic",{method:"POST",body:{lat:17.385,lon:78.4867}}):Promise.resolve(null)
  ]);
  if(checks[0].status==="fulfilled")S.incidents=checks[0].value;
  if(checks[1].status==="fulfilled")S.live=checks[1].value;
  else S.live={available:false,message:checks[1].reason&&checks[1].reason.message||"TomTom flow request failed."};
  render();
  if(S.tomtomStatus&&S.tomtomStatus.available&&S.live&&S.live.available)toast("TomTom live traffic and incidents refreshed.");
  else if(S.tomtomStatus&&S.tomtomStatus.configured)toast(S.live&&S.live.message||S.tomtomStatus.message||"TomTom live flow is unavailable.");
  else toast("TomTom is not configured. Add a rotated TOMTOM_API_KEY in secure project Setup.");
 }catch(e){toast(e.message);}
}
async function submitLive(e){
 e.preventDefault();const lat=Number($("#liveLat").value),lon=Number($("#liveLon").value);
 try{S.live=await api("/live/traffic",{method:"POST",body:{lat:lat,lon:lon}});S.incidents=await api("/live/incidents");S.tomtomStatus=await api("/live/status");render();toast(S.live.available?"TomTom returned live flow data.":S.live.message||"Live traffic is not configured.");}
 catch(err){toast(err.message);}
}
function bindForms(){
 const f=$("#routeForm");if(f)f.addEventListener("submit",e=>{e.preventDefault();calculate();});
 const lf=$("#liveForm");if(lf)lf.addEventListener("submit",submitLive);
 const slider=$("#demandSlider");if(slider)slider.addEventListener("input",()=>{S.percent=Number(slider.value);const out=$("#demandOutput");if(out)out.textContent=slider.value+"%";});
 const filter=$("#severityFilter");if(filter)filter.addEventListener("change",filterTraffic);
 const search=$("#trafficSearch");if(search)search.addEventListener("input",filterTraffic);
}
function filterTraffic(){
 const sev=$("#severityFilter")?$("#severityFilter").value:"all",q=$("#trafficSearch")?$("#trafficSearch").value.toLowerCase():"";
 const rows=(S.traffic||[]).filter(s=>(sev==="all"||s.severity===sev)&&(!q||s.segment_id.toLowerCase().includes(q)||s.road_class.toLowerCase().includes(q)));
 const w=$("#trafficTableWrap");if(w)w.innerHTML=trafficTable(rows);
}
async function refresh(){
 const b=$("#refreshAll");if(b)b.disabled=true;
 try{await loadAll();toast("Data refreshed.");}catch(e){toast(e.message);}finally{if(b)b.disabled=false;}
}
document.addEventListener("click",async e=>{
 const nav=e.target.closest("[data-page]");
 if(nav){S.page=nav.dataset.page;$("#sidebar").classList.remove("open");$("#scrim").classList.remove("show");render();return;}
 const rr=e.target.closest("[data-route]");
 if(rr){S.selected=S.routes.find(r=>r.route_id===rr.dataset.route)||S.selected;try{S.forecast=await api("/forecast",{method:"POST",body:{route:S.selected,route_id:S.selected.route_id,segment_ids:S.selected.segment_ids}});}catch(err){}render();return;}
 const sc=e.target.closest("[data-scenario]");if(sc){S.scenario=sc.dataset.scenario;S.simulation=null;render();return;}
 const a=e.target.closest("[data-action]");if(!a)return;
 switch(a.dataset.action){
  case "refresh":await refresh();break;
  case "calculate":S.page="routes";render();break;
  case "forecast":await refreshForecast();if(S.page!=="forecast"){S.page="forecast";render();}break;
  case "runSimulation":await simulate();break;
  case "explain":await explain();break;
  case "loadIncidents":await loadIncidents();break;
  case "traffic":S.page="traffic";render();break;
 }
});
$("#openNav").addEventListener("click",()=>{$("#sidebar").classList.add("open");$("#scrim").classList.add("show");});
$("#closeNav").addEventListener("click",()=>{$("#sidebar").classList.remove("open");$("#scrim").classList.remove("show");});
$("#scrim").addEventListener("click",()=>{$("#sidebar").classList.remove("open");$("#scrim").classList.remove("show");});
$("#refreshAll").addEventListener("click",refresh);
$("#openData").addEventListener("click",()=>{S.page="network";render();});
const clock=$("#nowLabel");if(clock)clock.textContent=new Date().toLocaleString([],{weekday:"short",hour:"2-digit",minute:"2-digit"});
loadAll().catch(e=>toast("Could not load APIs: "+e.message));
})();