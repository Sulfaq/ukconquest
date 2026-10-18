// One-off generator for maps/uk.json: projects cities and coastline from longitude and latitude,
// spreads crowded cities apart so they can be tapped on a phone, and proposes links.
// After the first run, maps/uk.json is the source of truth: hand-tune it there.
// Usage: node tools/build-map.js --force   (overwrites maps/uk.json)
'use strict';
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '..', 'maps', 'uk.json');
if (fs.existsSync(out) && !process.argv.includes('--force')) {
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

const GB = [[1.35,51.13],[1.42,51.38],[0.9,51.48],[0.75,51.6],[1.0,51.78],[1.28,51.95],[1.62,52.2],[1.75,52.48],[1.73,52.7],[1.3,52.93],[0.5,52.97],[0.2,52.82],[0.35,53.15],[0.12,53.6],[-0.08,54.12],[-0.4,54.28],[-0.62,54.48],[-1.15,54.63],[-1.37,54.9],[-1.42,55.05],[-1.7,55.45],[-2.0,55.77],[-2.13,55.9],[-2.5,56.0],[-2.75,56.06],[-3.2,55.98],[-3.6,56.03],[-3.1,56.12],[-2.58,56.28],[-2.85,56.43],[-2.58,56.56],[-2.47,56.71],[-2.2,56.96],[-2.07,57.15],[-1.78,57.5],[-2.0,57.69],[-2.52,57.68],[-3.28,57.72],[-3.87,57.6],[-4.2,57.5],[-4.0,57.7],[-4.0,57.87],[-3.65,58.12],[-3.08,58.44],[-3.02,58.64],[-3.52,58.6],[-5.0,58.62],[-5.25,58.15],[-5.35,57.9],[-5.7,57.73],[-5.82,57.43],[-5.72,57.28],[-5.83,57.0],[-6.22,56.72],[-5.47,56.41],[-5.6,56.0],[-5.8,55.3],[-5.45,55.55],[-5.0,55.85],[-4.75,55.95],[-4.63,55.46],[-4.86,55.24],[-5.15,54.85],[-4.86,54.64],[-4.05,54.83],[-3.5,54.97],[-3.2,54.95],[-3.5,54.72],[-3.63,54.49],[-3.23,54.1],[-2.88,54.07],[-3.05,53.82],[-3.0,53.65],[-3.05,53.45],[-3.15,53.38],[-3.1,53.25],[-3.83,53.33],[-4.2,53.3],[-4.6,53.4],[-4.55,53.15],[-4.75,52.8],[-4.05,52.72],[-4.08,52.41],[-4.67,52.1],[-5.3,51.88],[-5.05,51.7],[-4.7,51.67],[-4.3,51.7],[-4.3,51.57],[-3.95,51.6],[-3.7,51.48],[-3.17,51.45],[-2.95,51.55],[-2.6,51.62],[-2.72,51.5],[-2.98,51.33],[-3.45,51.2],[-3.83,51.23],[-4.53,51.0],[-4.55,50.83],[-4.93,50.55],[-5.08,50.42],[-5.48,50.21],[-5.71,50.06],[-5.2,49.96],[-5.07,50.15],[-4.63,50.33],[-4.15,50.36],[-3.64,50.22],[-3.52,50.45],[-3.4,50.62],[-2.93,50.72],[-2.45,50.52],[-1.95,50.6],[-1.85,50.72],[-1.4,50.8],[-1.08,50.78],[-0.79,50.73],[-0.14,50.82],[0.25,50.73],[0.57,50.85],[0.97,50.91],[1.18,51.08]];
const IRELAND = [[-7.37,55.38],[-6.15,55.22],[-5.75,54.85],[-5.55,54.65],[-5.45,54.4],[-5.65,54.22],[-6.1,54.0],[-6.1,53.35],[-6.0,52.97],[-6.36,52.17],[-7.0,52.13],[-8.3,51.8],[-9.0,51.6],[-9.5,52.3],[-9.0,53.2],[-9.6,54.2],[-8.6,54.3],[-8.8,54.6],[-8.3,55.15]];
const NI = [[-7.25,55.07],[-6.9,55.17],[-6.15,55.22],[-5.75,54.85],[-5.55,54.65],[-5.45,54.4],[-5.65,54.22],[-6.1,54.03],[-6.6,54.05],[-7.0,54.2],[-7.55,54.12],[-8.15,54.45],[-7.75,54.6],[-7.55,54.75],[-7.45,54.95]];

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
links.push(['glasgow', 'belfast']);

const map = {
  id: 'uk', name: 'United Kingdom', width: W, height: H,
  land: [GB.map(proj)], ni: [NI.map(proj)], ireland: [IRELAND.map(proj)],
  cities: cities.map(({ id, name, x, y, size }) => ({ id, name, x: Math.round(x), y: Math.round(y), size })),
  links,
  seaLinks: [['glasgow', 'belfast']],
  slots: [
    { name: 'South East', cities: ['london', 'brighton', 'cambridge'] },
    { name: 'North West', cities: ['manchester', 'liverpool', 'stoke'] },
    { name: 'Scotland', cities: ['glasgow', 'edinburgh', 'carlisle'] },
    { name: 'South West', cities: ['bristol', 'cardiff', 'exeter'] },
  ],
};
fs.writeFileSync(out, JSON.stringify(map, null, 1).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1,$2]').replace(/\[\s+"(\w+)",\s+"(\w+)"\s+\]/g, '["$1","$2"]'));
console.log(`wrote maps/uk.json: ${cities.length} cities, ${links.length} links, ${W}x${H}`);
