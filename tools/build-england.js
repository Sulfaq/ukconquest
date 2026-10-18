// One-off generator for maps/england.json: an England-only map, zoomed in so cities are bigger on a phone.
// Wales and Scotland are drawn grey (not in play). After the first run, hand-tune maps/england.json.
// Usage: node tools/build-england.js --force
'use strict';
const fs = require('fs');
const path = require('path');
const { GB, IRELAND } = require('./coast');

const out = path.join(__dirname, '..', 'maps', 'england.json');
if (fs.existsSync(out) && !process.argv.includes('--force')) {
  console.log('maps/england.json already exists (hand-tuned). Pass --force to regenerate it.');
  process.exit(0);
}

// Projection: equirectangular, squashed by cos(53°), into a 600-wide box.
const W = 600, LON0 = -6.0, LAT0 = 55.95, COS = Math.cos(53 * Math.PI / 180);
const K = W / ((1.95 - LON0) * COS);
const H = Math.round((LAT0 - 49.9) * K);
const proj = ([lon, lat]) => [+((lon - LON0) * COS * K).toFixed(1), +((LAT0 - lat) * K).toFixed(1)];

// England = the GB coastline from the Severn round the south and east to Berwick,
// then the Scottish border, the north-west coast down to the Dee, and the Welsh border back to the Severn.
const at = pt => GB.findIndex(([a, b]) => a === pt[0] && b === pt[1]);
const seg = (from, to) => GB.slice(at(from), at(to) + 1);
const ENGLAND = [
  ...seg([-2.72, 51.5], [1.18, 51.08]),            // Bristol, the South West, the south coast to Dover
  ...seg([1.35, 51.13], [-1.7, 55.45]),            // Kent up the east coast to Northumberland
  [-2.0, 55.77], [-2.25, 55.65], [-2.6, 55.3], [-2.9, 55.05], [-3.05, 54.98],   // the Scottish border
  ...seg([-3.2, 54.95], [-3.1, 53.25]),            // Cumbria and Lancashire down to the Dee
  [-2.95, 53.2], [-3.0, 52.9], [-3.15, 52.6], [-3.05, 52.35], [-3.1, 52.07], [-2.72, 51.82], [-2.67, 51.64],   // the Welsh border
];
if (ENGLAND.some(p => !p)) throw new Error('a coastline point was not found');

const CITIES = [
  ['london', 'London', -0.13, 51.51, 'L'], ['birmingham', 'Birmingham', -1.89, 52.48, 'L'],
  ['manchester', 'Manchester', -2.24, 53.48, 'L'], ['bristol', 'Bristol', -2.59, 51.45, 'L'],
  ['newcastle', 'Newcastle', -1.61, 54.97, 'L'],
  ['leeds', 'Leeds', -1.55, 53.80, 'M'], ['liverpool', 'Liverpool', -2.98, 53.41, 'M'],
  ['sheffield', 'Sheffield', -1.47, 53.38, 'M'], ['nottingham', 'Nottingham', -1.15, 52.95, 'M'],
  ['brighton', 'Brighton', -0.14, 50.83, 'M'], ['southampton', 'Southampton', -1.40, 50.91, 'M'],
  ['middlesbrough', 'Middlesbrough', -1.23, 54.57, 'M'], ['exeter', 'Exeter', -3.53, 50.72, 'M'],
  ['leicester', 'Leicester', -1.13, 52.64, 'S'], ['coventry', 'Coventry', -1.51, 52.41, 'S'],
  ['stoke', 'Stoke', -2.18, 53.00, 'S'], ['hull', 'Hull', -0.33, 53.74, 'S'], ['york', 'York', -1.08, 53.96, 'S'],
  ['norwich', 'Norwich', 1.30, 52.63, 'S'], ['cambridge', 'Cambridge', 0.12, 52.21, 'S'],
  ['oxford', 'Oxford', -1.26, 51.75, 'S'], ['portsmouth', 'Portsmouth', -1.09, 50.80, 'S'],
  ['plymouth', 'Plymouth', -4.14, 50.38, 'S'], ['carlisle', 'Carlisle', -2.93, 54.89, 'S'],
  ['preston', 'Preston', -2.70, 53.76, 'S'], ['lincoln', 'Lincoln', -0.54, 53.23, 'S'],
  ['ipswich', 'Ipswich', 1.15, 52.06, 'S'], ['gloucester', 'Gloucester', -2.24, 51.86, 'S'],
];

const R = { L: 26, M: 22, S: 18 };
const cities = CITIES.map(([id, name, lon, lat, size]) => {
  const [x, y] = proj([lon, lat]);
  return { id, name, x, y, ax: x, ay: y, size };
});
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
const cand = new Map();
for (const a of cities) {
  const near = cities.filter(b => b !== a).sort((p, q) => dist(a, p) - dist(a, q));
  near.slice(0, 4).forEach((b, i) => { if (i < 2 || dist(a, b) < 160) cand.set(key(a.id, b.id), [a, b]); });
}
const cross = (p1, p2, p3, p4) => {
  const o = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  if ([p1, p2].includes(p3) || [p1, p2].includes(p4)) return false;
  return o(p1, p2, p3) !== o(p1, p2, p4) && o(p3, p4, p1) !== o(p3, p4, p2);
};
const kept = [];
for (const l of [...cand.values()].sort((p, q) => dist(...p) - dist(...q))) if (!kept.some(k => cross(l[0], l[1], k[0], k[1]))) kept.push(l);

const map = {
  id: 'england', name: 'England', width: W, height: H,
  territories: true, southLine: Math.round(proj([0, 51.95])[1]), prizeCity: 'birmingham',
  land: [ENGLAND.map(proj)], ni: [], foreign: [GB.map(proj), IRELAND.map(proj)],
  islands: [[[-1.58, 50.67], [-1.3, 50.77], [-1.07, 50.68], [-1.3, 50.58]].map(proj)],   // Isle of Wight
  cities: cities.map(({ id, name, x, y, size }) => ({ id, name, x: Math.round(x), y: Math.round(y), size })),
  links: kept.map(([a, b]) => [a.id, b.id]),
  seaLinks: [],
  slots: [
    { name: 'South East', cities: ['london', 'brighton', 'cambridge'] },
    { name: 'North West', cities: ['manchester', 'liverpool', 'preston'] },
    { name: 'North East', cities: ['newcastle', 'middlesbrough', 'york'] },
    { name: 'South West', cities: ['bristol', 'exeter', 'gloucester'] },
  ],
  teamSlots: [[0, 3], [1, 2]],
};
fs.writeFileSync(out, JSON.stringify(map, null, 1).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1,$2]').replace(/\[\s+"(\w+)",\s+"(\w+)"\s+\]/g, '["$1","$2"]'));
console.log(`wrote maps/england.json: ${cities.length} cities, ${map.links.length} links, ${W}x${H}`);
