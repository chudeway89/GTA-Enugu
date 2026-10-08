import * as THREE from 'three';

const hud = document.getElementById('hud');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 200, 900);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.5, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
scene.add(new THREE.HemisphereLight(0xffffff, 0x445522, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(200, 400, 100); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshLambertMaterial({ color: 0x4a7a3a }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);

const getJson = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const [cfg, missions, map] = await Promise.all([getJson('/data/config.json'), getJson('/data/missions.json'), getJson('/data/enugu.json')]);

// --- world ---
const roadMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
const bldMat = new THREE.MeshLambertMaterial({ color: 0xcfc3a8 });
const roadWidth = { motorway: 14, trunk: 12, primary: 10, secondary: 8, tertiary: 7 };
function addRoad(pts, w) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1); if (len < 0.1) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), roadMat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(-(z2 - z1), x2 - x1);
    m.position.set((x1 + x2) / 2, 0.05, (z1 + z2) / 2); scene.add(m);
  }
}
if (map) {
  for (const r of map.roads) addRoad(r.pts, roadWidth[r.type] ?? 5);
  for (const b of map.buildings) {
    if (b.pts.length < 4) continue;
    const shape = new THREE.Shape(b.pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    scene.add(new THREE.Mesh(g, bldMat));
  }
} else {
  // placeholder grid until `npm run map` has been run
  for (let i = -10; i <= 10; i++) { addRoad([[i * 100, -1000], [i * 100, 1000]], 10); addRoad([[-1000, i * 100], [1000, i * 100]], 10); }
  for (let i = 0; i < 300; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(20, 10 + Math.random() * 40, 20), bldMat);
    b.position.set((Math.floor(Math.random() * 20) - 10) * 100 + 50, b.geometry.parameters.height / 2, (Math.floor(Math.random() * 20) - 10) * 100 + 50);
    scene.add(b);
  }
}

// --- car ---
const makeCar = (color) => { const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4.2), new THREE.MeshLambertMaterial({ color })); body.position.y = 0.8; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2), new THREE.MeshLambertMaterial({ color: 0x222222 })); top.position.set(0, 1.5, -0.2); g.add(top);
  scene.add(g); return g; };
const me = { car: makeCar(0xd22), x: cfg?.spawn?.x ?? 0, z: cfg?.spawn?.z ?? 0, h: 0, v: 0 };
const keys = {}; addEventListener('keydown', (e) => (keys[e.code] = true)); addEventListener('keyup', (e) => (keys[e.code] = false));

// --- multiplayer ---
const others = new Map();
let myId = null;
const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
ws.onmessage = (e) => { const m = JSON.parse(e.data);
  if (m.t === 'welcome') myId = m.id;
  if (m.t === 'players') { const seen = new Set();
    for (const p of m.players) { if (p.id === myId) continue; seen.add(p.id);
      if (!others.has(p.id)) others.set(p.id, makeCar(0x28d));
      const c = others.get(p.id); c.position.set(p.x, 0, p.z); c.rotation.y = p.h; }
    for (const [id, c] of others) if (!seen.has(id)) { scene.remove(c); others.delete(id); } } };
setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'state', name: cfg?.player?.name, x: me.x, z: me.z, h: me.h })), 50);

// --- missions ---
let mi = 0;
const marker = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 80, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.4 }));
scene.add(marker);

// --- loop ---
let last = performance.now();
function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  const acc = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  me.v += acc * 25 * dt; me.v *= keys.Space ? 0.93 : 0.99; me.v *= 1 - 0.4 * dt;
  const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
  me.h += steer * 1.8 * dt * Math.min(1, Math.abs(me.v) / 6) * Math.sign(me.v || 1);
  me.x += Math.sin(me.h) * me.v * dt; me.z += Math.cos(me.h) * me.v * dt;
  me.car.position.set(me.x, 0, me.z); me.car.rotation.y = me.h;
  camera.position.set(me.x - Math.sin(me.h) * 10, 5, me.z - Math.cos(me.h) * 10); camera.lookAt(me.x, 1.5, me.z);
  const m = missions?.[mi];
  if (m) { marker.position.set(m.goal.x, 40, m.goal.z);
    if (Math.hypot(me.x - m.goal.x, me.z - m.goal.z) < m.goal.radius) mi++; }
  hud.innerHTML = m ? `<b>${m.title}</b><br>${m.briefing}<br>Distance: ${Math.round(Math.hypot(me.x - m.goal.x, me.z - m.goal.z))} m` : 'All missions complete!';
  hud.innerHTML += `<br><small>WASD drive · Space brake · players online: ${others.size + 1}${map ? '' : ' · placeholder map (run npm run map)'}</small>`;
  renderer.render(scene, camera); requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
