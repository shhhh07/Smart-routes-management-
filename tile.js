import { getTomTomKey } from "lib/tomtom.js";
export const access = "public";
export const methods = ["GET"];
export default async function(req, res) {
  const key = await getTomTomKey();
  if (!key) return res.status(412).json({ error: "TomTom key is not configured." });
  const z = Math.round(Number(req.query && req.query.z)), x = Math.round(Number(req.query && req.query.x)), y = Math.round(Number(req.query && req.query.y));
  if (![z, x, y].every(Number.isFinite) || z < 0 || z > 22 || x < 0 || y < 0 || x >= Math.pow(2,z) || y >= Math.pow(2,z)) {
    return res.status(400).json({ error: "Invalid map tile coordinates." });
  }
  try {
    const url = "https://api.tomtom.com/traffic/map/4/tile/flow/absolute/" + z + "/" + x + "/" + y + ".png?key=" + encodeURIComponent(key);
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(upstream.status).json({ error: "TomTom traffic tile request failed.", provider_status: upstream.status });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=45");
    res.send(new Uint8Array(await upstream.arrayBuffer()));
  } catch (error) {
    res.status(502).json({ error: "TomTom traffic overlay could not be loaded." });
  }
}