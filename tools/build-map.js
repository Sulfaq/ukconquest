// One-off generator for maps/uk.json: projects cities and coastline from longitude and latitude,
// spreads crowded cities apart so they can be tapped on a phone, and proposes links.
// After the first run, maps/uk.json is the source of truth: hand-tune it there.
// Usage: node tools/build-map.js --force     (overwrites maps/uk.json)
//        node tools/build-map.js --outline   (only redraws coastline and islands, keeping cities and links)
'use strict';
const fs = require('fs');
const path = require('path');
const { GB, IRELAND, NI, ISLANDS } = require('./coast');

const out = path.join(__dirname, '..', 'maps', 'uk.json');
const OUTLINE_ONLY = process.argv.includes('--outline');
if (fs.existsSync(out) && !process.argv.includes('--force') && !OUTLINE_ONLY) {
  console.log('maps/uk.json already exists (hand-tuned). Pass --force to regenerate it.');
  process.exit(0);
}

// Projection: equirectangular, squashed by cos(54.4°), into a 600 x 900 box.
const W = 600, LON0 = -8.25, LAT0 = 58.75, COS = Math.cos(54.4 * Math.PI / 180);
const K = W / ((1.9 - LON0) * COS);
const H = Math.round((LAT0 - 49.9) * K);
const proj = ([lon, lat]) => [+((lon - LON0) * COS * K).toFixed(1), +((LAT0 - lat) * K).toFixed(1)];

const CITIES = [
  ['london', 'London', -0.13, 51.51, 'L'], ['birmingham', 'Birmingham', -1.89, 52.48, 'L'],
  ['manchester', 'Manchester', -2.24, 53.48, 'L'], ['glasgow', 'Glasgow', -4.25, 55.86, 'L'],
  ['bristol', 'Bristol', -2.59, 51.45, 'L'],
  ['leeds', 'Leeds', -1.55, 53.80, 'M'], ['liverpool', 'Liverpool', -2.98, 53.41, 'M'],
  ['sheffield', 'Sheffield', -1.47, 53.38, 'M'], ['newcastle', 'Newcastle', -1.61, 54.97, 'M'],
  ['nottingham', 'Nottingham', -1.15, 52.95, 'M'], ['edinburgh', 'Edinburgh', -3.19, 55.95, 'M'],
  ['cardiff', 'Cardiff', -3.18, 51.48, 'M'], ['brighton', 'Brighton', -0.14, 50.83, 'M'],
  ['leicester', 'Leicester', -1.13, 52.64, 'S'], ['stoke', 'Stoke', -2.18, 53.00, 'S'],
  ['hull', 'Hull', -0.33, 53.74, 'S'], ['york', 'York', -1.08, 53.96, 'S'],
  ['norwich', 'Norwich', 1.30, 52.63, 'S'], ['cambridge', 'Cambridge', 0.12, 52.21, 'S'],
  ['oxford', 'Oxford', -1.26, 51.75, 'S'], ['southampton', 'Southampton', -1.40, 50.91, 'S'],
  ['exeter', 'Exeter', -3.53, 50.72, 'S'], ['plymouth', 'Plymouth', -4.14, 50.38, 'S'],
  ['swansea', 'Swansea', -3.94, 51.62, 'S'], ['carlisle', 'Carlisle', -2.93, 54.89, 'S'],
  ['aberdeen', 'Aberdeen', -2.10, 57.15, 'S'], ['inverness', 'Inverness', -4.22, 57.48, 'S'],
  ['belfast', 'Belfast', -5.93, 54.60, 'M'],
];



if (OUTLINE_ONLY) {
  const map = JSON.parse(fs.readFileSync(out, 'utf8'));
  Object.assign(map, { land: [GB.map(proj)], ni: [NI.map(proj)], ireland: [IRELAND.map(proj)], islands: ISLANDS.map(p => p.map(proj)) });
  write(map);
  console.log('redrew the outline and ' + ISLANDS.length + ' islands in maps/uk.json');
  process.exit(0);
}
function write(map) {
  // One point or link per line keeps the file easy to hand-tune.
  fs.writeFileSync(out, JSON.stringify(map, null, 1).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1,$2]').replace(/\[\s+"(\w+)",\s+"(\w+)"\s+\]/g, '["$1","$2"]'));
}

const R = { L: 26, M: 22, S: 18 };
const cities = CITIES.map(([id, name, lon, lat, size]) => {
  const [x, y] = proj([lon, lat]);
  return { id, name, x, y, ax: x, ay: y, size };
});

// Push overlapping cities apart, with a spring back to their real position.
for (let it = 0; it < 400; it++) {
  for (const a of cities) for (const b of cities) {
    if (a === b) continue;
    const need = R[a.size] + R[b.size] + 26;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
    if (d < need) { const p = (need - d) / 2 * 0.5; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; }
  }
  for (const c of cities) { c.x += (c.ax - c.x) * 0.02; c.y += (c.ay - c.y) * 0.02; }
}

// Links: each city to its 2-4 nearest within range, dropping any that cross a shorter link.
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const key = (a, b) => [a, b].sort().join('|');
const MAX = 175;
const cand = new Map();
for (const a of cities) {
  if (a.id === 'belfast') continue;
  const near = cities.filter(b => b !== a && b.id !== 'belfast').sort((p, q) => dist(a, p) - dist(a, q));
  near.slice(0, 4).forEach((b, i) => { if (i < 2 || dist(a, b) < MAX) cand.set(key(a.id, b.id), [a, b]); });
}
const cross = (p1, p2, p3, p4) => {
  const o = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  if ([p1, p2].includes(p3) || [p1, p2].includes(p4)) return false;
  return o(p1, p2, p3) !== o(p1, p2, p4) && o(p3, p4, p1) !== o(p3, p4, p2);
};
const sorted = [...cand.values()].sort((p, q) => dist(...p) - dist(...q));
const kept = [];
for (const l of sorted) if (!kept.some(k => cross(l[0], l[1], k[0], k[1]))) kept.push(l);
const links = kept.map(([a, b]) => [a.id, b.id]);
links.push(['glasgow', 'belfast', 'sea']);   // the one sea crossing

const map = {
  id: 'uk', name: 'United Kingdom', orientation: 'portrait', lengthLabel: '5 to 8 min', width: W, height: H,
  territories: true,
  land: [GB.map(proj)], ni: [NI.map(proj)], ireland: [IRELAND.map(proj)], islands: ISLANDS.map(p => p.map(proj)),
  cities: cities.map(({ id, name, x, y, size }) => ({ id, name, x: Math.round(x), y: Math.round(y), size })),
  links,
  slots: [
    { name: 'South East', cities: ['london', 'brighton', 'cambridge'] },
    { name: 'North West', cities: ['manchester', 'liverpool', 'stoke'] },
    { name: 'Scotland', cities: ['glasgow', 'edinburgh', 'carlisle'] },
    { name: 'South West', cities: ['bristol', 'cardiff', 'exeter'] },
  ],
};
write(map);
console.log(`wrote maps/uk.json: ${cities.length} cities, ${links.length} links, ${W}x${H}`);
