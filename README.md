# GTA Enugu

An original open-world driving game set in Enugu, Nigeria, with online multiplayer. No Rockstar code or assets are used.

## Run
```
npm install
npm run map     # (already run: central Enugu data is committed) refresh roads/buildings from OpenStreetMap; (c) OSM contributors, ODbL
npm start       # build client + serve on :3000 (PORT env to change)
```
Friends join by opening your server's URL (host it somewhere reachable, e.g. a VPS or a tunnel). Use `npm start`; the Vite dev server has no multiplayer backend.

## Customize
- `client/public/data/config.json` – player name and spawn (the mansion).
- `client/public/data/missions.json` – missions (goal coordinates are metres from the map origin).
