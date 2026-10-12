import { config } from "hatchable";
export async function getTomTomKey() {
  try {
    const value = await config.get("TOMTOM_API_KEY");
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch (error) {
    return null;
  }
}
export async function fetchFlow(key, lat, lon) {
  const url = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=" +
    encodeURIComponent(Number(lat) + "," + Number(lon)) + "&unit=KMPH&key=" + encodeURIComponent(key);
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, status: response.status, message: data.error || data.description || "TomTom Traffic API request failed." };
  return { ok: true, data: data.flowSegmentData || {} };
}