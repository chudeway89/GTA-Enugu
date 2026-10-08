import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const root = join(fileURLToPath(new URL('..', import.meta.url)), 'client', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const http = createServer(async (req, res) => {
  const path = normalize(new URL(req.url, 'http://x').pathname).replace(/^(\.\.[/\\])+/, '');
  try {
    const file = await readFile(join(root, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' }).end(file);
  } catch { res.writeHead(404).end('Not found'); }
});

const wss = new WebSocketServer({ server: http });
const players = new Map(); // id -> {id,name,x,z,heading}
let nextId = 1;

wss.on('connection', (ws) => {
  const id = nextId++;
  ws.send(JSON.stringify({ t: 'welcome', id, players: [...players.values()] }));
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t !== 'state' || !Number.isFinite(m.x) || !Number.isFinite(m.z) || !Number.isFinite(m.h)) return;
    players.set(id, { id, name: String(m.name || 'Player').slice(0, 20), x: m.x, z: m.z, h: m.h });
  });
  ws.on('close', () => {
    players.delete(id);
    broadcast({ t: 'leave', id });
  });
});

function broadcast(msg) {
  const s = JSON.stringify(msg);
  for (const c of wss.clients) if (c.readyState === 1) c.send(s);
}
setInterval(() => broadcast({ t: 'players', players: [...players.values()] }), 50);

const port = process.env.PORT || 3000;
http.listen(port, () => console.log(`GTA Enugu server on :${port}`));
