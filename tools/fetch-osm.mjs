// Downloads Enugu roads + buildings from OpenStreetMap (Overpass) into client/public/data/enugu.json
// Data (c) OpenStreetMap contributors, ODbL. Run on a machine with internet access: npm run map
import { writeFileSync } from 'node:fs';

const [S, W, N, E] = [6.42, 7.47, 6.47, 7.53]; // central Enugu; adjust to taste
const q = `[out:json][timeout:120];
(way["highway"](${S},${W},${N},${E});
 way["building"](${S},${W},${N},${E}););
out geom;`;
const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
let data;
for (const url of endpoints) {
  try {
    const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }) });
    if (r.ok) { data = await r.json(); break; }
    console.warn(url, r.status);
  } catch (e) { console.warn(url, e.message); }
}
if (!data) { console.error('All Overpass endpoints failed'); process.exit(1); }

const lat0 = (S + N) / 2, lon0 = (W + E) / 2, R = 6371000;
const proj = (p) => [
  +((p.lon - lon0) * Math.PI / 180 * R * Math.cos(lat0 * Math.PI / 180)).toFixed(1),
  +(-(p.lat - lat0) * Math.PI / 180 * R).toFixed(1), // -> three.js z
];
const out = { origin: { lat: lat0, lon: lon0 }, roads: [], buildings: [] };
for (const el of data.elements) {
  if (!el.geometry) continue;
  const pts = el.geometry.map(proj);
  if (el.tags.highway) out.roads.push({ type: el.tags.highway, name: el.tags.name, pts });
  else if (el.tags.building) out.buildings.push({ h: parseFloat(el.tags.height) || (parseInt(el.tags['building:levels']) || 1) * 3.2, pts });
}
writeFileSync('client/public/data/enugu.json', JSON.stringify(out));
console.log(`roads: ${out.roads.length}, buildings: ${out.buildings.length}`);
