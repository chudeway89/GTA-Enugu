// Downloads Enugu roads + buildings from OpenStreetMap (Overpass) into client/public/data/enugu.json
// Data (c) OpenStreetMap contributors, ODbL. Run on a machine with internet access: npm run map
import { writeFileSync } from 'node:fs';

const [S, W, N, E] = [6.42, 7.47, 6.47, 7.53]; // central Enugu; adjust to taste
const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const STEP = 0.02; // tile size in degrees, keeps each query small enough for public mirrors
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTile(s, w, n, e) {
  const q = `[out:json][timeout:90];(way["highway"](${s},${w},${n},${e});way["building"](${s},${w},${n},${e}););out geom;`;
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const url of endpoints) {
      try {
        const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), signal: AbortSignal.timeout(120000) });
        if (r.ok) return (await r.json()).elements;
      } catch {}
    }
    await sleep(3000 * (attempt + 1));
  }
  return null;
}

const byId = new Map();
for (let s = S; s < N - 1e-9; s += STEP) for (let w = W; w < E - 1e-9; w += STEP) {
  const els = await fetchTile(+s.toFixed(4), +w.toFixed(4), +Math.min(s + STEP, N).toFixed(4), +Math.min(w + STEP, E).toFixed(4));
  if (!els) { console.error(`tile ${s.toFixed(2)},${w.toFixed(2)} failed`); continue; }
  for (const el of els) byId.set(el.id, el);
  console.log(`tile ${s.toFixed(2)},${w.toFixed(2)}: ${els.length} ways`);
}
const data = { elements: [...byId.values()] };
if (!data.elements.length) { console.error('No data fetched'); process.exit(1); }

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
