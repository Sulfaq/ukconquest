// One-off generator for maps/europe.json. After the first run, hand-tune maps/europe.json.
// Usage: node tools/build-europe.js --force
'use strict';
const fs = require('fs');
const path = require('path');
const { GB, IRELAND } = require('./coast');
const L = require('./maplib');

const out = path.join(__dirname, '..', 'maps', 'europe.json');
if (fs.existsSync(out) && !process.argv.includes('--force')) {
  console.log('maps/europe.json already exists (hand-tuned). Pass --force to regenerate it.');
  process.exit(0);
}

// Frame: Lisbon to Helsinki and Bucharest, Oslo down to Crete. Roughly square, so it suits a portrait phone.
const { proj, width, height } = L.projection({ lon0: -11, lon1: 32, lat0: 34.8, lat1: 62, midLat: 48, width: 600, stretch: 1.25 });

// Coastlines as [longitude, latitude], deliberately rough. Shapes cut by the frame run along its edge.
const MAINLAND = [
  [-5.6, 36.0], [-4.4, 36.7], [-2.3, 36.8], [-1.0, 37.6], [-0.5, 38.3], [-0.3, 39.5], [0.8, 40.7], [2.2, 41.4], [3.3, 42.3],
  [3.0, 42.7], [3.9, 43.5], [5.4, 43.3], [6.0, 43.1], [7.3, 43.7], [8.9, 44.4], [9.8, 44.1], [10.3, 43.5], [10.5, 42.9],
  [12.2, 41.8], [13.5, 41.2], [14.2, 40.8], [14.8, 40.6], [15.6, 40.0], [16.0, 39.0], [15.65, 38.0], [16.1, 38.0], [16.6, 38.4],
  [17.1, 39.0], [16.6, 39.7], [17.2, 40.45], [18.5, 40.1], [18.0, 40.6], [16.9, 41.1], [16.1, 41.9], [14.2, 42.5], [13.5, 43.6],
  [12.6, 44.1], [12.3, 45.4], [13.8, 45.6], [13.6, 45.0], [14.4, 45.3], [15.2, 44.1], [16.4, 43.5], [18.1, 42.65], [19.0, 42.0],
  [19.45, 41.3], [19.4, 40.4], [20.2, 39.5], [20.7, 38.95], [21.3, 38.3], [21.5, 37.6], [22.1, 36.75], [23.2, 36.45], [22.8, 37.5],
  [23.7, 37.9], [24.0, 37.65], [24.0, 38.5], [22.9, 39.3], [22.9, 40.6], [23.8, 40.0], [24.4, 40.9], [25.9, 40.85], [26.4, 40.1],
  [29.0, 41.0], [28.0, 42.5], [27.9, 43.2], [28.6, 44.2], [29.7, 45.2], [30.7, 46.5], [32, 46.5],
  [32, 61.0], [30.0, 60.3], [30.2, 59.95], [28.0, 59.4], [24.75, 59.45], [23.4, 59.0], [23.5, 58.3], [24.5, 58.4], [24.1, 57.0],
  [22.6, 57.75], [21.5, 57.4], [21.0, 56.5], [21.1, 55.7], [20.5, 54.9], [18.7, 54.4], [17.5, 54.75], [15.6, 54.2], [14.3, 53.9],
  [13.4, 54.6], [12.1, 54.2], [10.8, 54.0], [10.2, 54.4], [10.5, 55.0], [10.2, 56.15], [10.9, 56.4], [10.6, 57.7], [8.6, 57.1],
  [8.1, 56.5], [8.4, 55.5], [8.3, 54.9], [8.7, 53.9], [8.1, 53.5], [7.2, 53.35], [4.75, 52.95], [4.6, 52.45], [4.25, 52.1],
  [4.0, 51.95], [3.5, 51.5], [2.6, 51.1], [1.85, 50.95], [1.6, 50.7], [1.6, 50.2], [1.1, 49.95], [0.1, 49.5], [-0.4, 49.35],
  [-1.3, 49.65], [-1.9, 49.7], [-1.6, 48.8], [-1.5, 48.65], [-3.0, 48.8], [-4.7, 48.6], [-4.75, 48.35], [-4.4, 47.9], [-3.4, 47.7],
  [-2.2, 47.3], [-1.2, 46.15], [-1.1, 45.6], [-1.25, 44.65], [-1.55, 43.5], [-2.0, 43.3], [-3.0, 43.4], [-3.8, 43.45], [-5.7, 43.55],
  [-7.0, 43.55], [-8.4, 43.35], [-9.3, 42.9], [-8.75, 42.2], [-8.65, 41.15], [-9.1, 39.6], [-9.5, 38.75], [-8.9, 38.5], [-8.9, 37.95],
  [-8.95, 37.0], [-7.9, 37.0], [-7.0, 37.2], [-6.3, 36.5],
];
const SCANDINAVIA = [
  [5.0, 62.0], [5.0, 61.0], [4.9, 60.4], [5.3, 59.4], [5.6, 58.9], [6.4, 58.2], [7.05, 57.98], [8.0, 58.1], [9.4, 58.8], [10.0, 59.0],
  [10.7, 59.9], [10.9, 59.2], [11.2, 59.0], [11.8, 57.7], [12.25, 57.1], [12.85, 56.65], [12.7, 56.05], [13.0, 55.6], [13.15, 55.35],
  [13.8, 55.4], [14.3, 55.55], [14.9, 56.15], [15.6, 56.15], [16.35, 56.65], [16.6, 57.4], [16.65, 57.75], [16.9, 58.4], [17.1, 58.7],
  [18.0, 59.0], [18.9, 59.35], [18.8, 59.8], [18.4, 60.35], [17.2, 60.7], [17.3, 61.3], [17.45, 62.0],
];
const FINLAND = [
  [21.3, 62.0], [21.4, 61.5], [21.5, 60.8], [22.2, 60.4], [23.0, 59.85], [25.0, 60.15], [26.9, 60.45], [28.7, 60.7], [30.0, 60.3],
  [32, 61.0], [32, 62.0],
];
const ISLANDS = [
  [[10.9, 55.7], [11.7, 55.95], [12.6, 56.05], [12.65, 55.6], [12.4, 55.25], [11.9, 54.95], [11.2, 55.2]],   // Zealand
  [[9.75, 55.5], [10.5, 55.45], [10.7, 55.1], [10.2, 55.05], [9.9, 55.2]],                                      // Funen
  [[8.6, 42.9], [9.45, 43.0], [9.55, 42.1], [9.2, 41.4], [8.6, 41.9]],                                          // Corsica
  [[8.2, 41.0], [9.2, 41.25], [9.8, 40.5], [9.6, 39.2], [9.0, 39.0], [8.4, 39.0], [8.4, 40.0]],                 // Sardinia
  [[12.4, 38.1], [13.4, 38.2], [15.6, 38.3], [15.1, 37.3], [15.1, 36.7], [14.4, 36.8], [12.6, 37.6]],           // Sicily
  [[23.5, 35.5], [24.3, 35.6], [26.3, 35.3], [25.0, 34.95], [23.6, 35.2]],                                      // Crete
  [[2.4, 39.6], [3.1, 39.95], [3.45, 39.7], [3.1, 39.3], [2.6, 39.5]],                                          // Mallorca
  [[18.1, 57.3], [18.7, 57.9], [19.0, 57.8], [18.5, 57.1]],                                                     // Gotland
];
// Not in play, drawn quieter: North Africa and Anatolia.
const FOREIGN = [
  [[-6.2, 34.8], [-5.9, 35.8], [-5.3, 35.9], [-2.0, 35.1], [-0.6, 35.7], [3.0, 36.8], [5.0, 36.7], [7.8, 37.0], [9.9, 37.3],
   [10.3, 36.9], [11.1, 37.0], [10.6, 36.4], [11.1, 35.3], [11.0, 34.8]],
  [[26.2, 39.9], [26.8, 39.0], [26.9, 38.4], [27.3, 37.0], [28.2, 36.7], [29.6, 36.2], [30.6, 36.8], [32, 36.3], [32, 41.3],
   [31.2, 41.1], [29.2, 41.2], [28.0, 40.4], [26.6, 40.4]],
];

const CITIES = [
  ['london', 'London', -0.13, 51.51, 'L'], ['birmingham', 'Birmingham', -1.89, 52.48, 'S'], ['manchester', 'Manchester', -2.24, 53.48, 'M'],
  ['edinburgh', 'Edinburgh', -3.19, 55.95, 'S'], ['dublin', 'Dublin', -6.26, 53.35, 'S'],
  ['paris', 'Paris', 2.35, 48.86, 'L'], ['marseille', 'Marseille', 5.37, 43.30, 'M'], ['lyon', 'Lyon', 4.83, 45.76, 'S'],
  ['bordeaux', 'Bordeaux', -0.58, 44.84, 'S'], ['brussels', 'Brussels', 4.35, 50.85, 'S'], ['amsterdam', 'Amsterdam', 4.90, 52.37, 'M'],
  ['berlin', 'Berlin', 13.40, 52.52, 'L'], ['hamburg', 'Hamburg', 9.99, 53.55, 'M'], ['munich', 'Munich', 11.58, 48.14, 'M'],
  ['frankfurt', 'Frankfurt', 8.68, 50.11, 'S'], ['zurich', 'Zurich', 8.54, 47.37, 'S'], ['vienna', 'Vienna', 16.37, 48.21, 'M'],
  ['prague', 'Prague', 14.42, 50.08, 'S'], ['warsaw', 'Warsaw', 21.01, 52.23, 'L'], ['copenhagen', 'Copenhagen', 12.57, 55.68, 'S'],
  ['stockholm', 'Stockholm', 18.07, 59.33, 'L'], ['oslo', 'Oslo', 10.75, 59.91, 'M'], ['helsinki', 'Helsinki', 24.94, 60.17, 'S'],
  ['madrid', 'Madrid', -3.70, 40.42, 'L'], ['barcelona', 'Barcelona', 2.17, 41.39, 'M'], ['lisbon', 'Lisbon', -9.14, 38.72, 'M'],
  ['seville', 'Seville', -5.98, 37.39, 'S'], ['rome', 'Rome', 12.50, 41.90, 'L'], ['milan', 'Milan', 9.19, 45.46, 'M'],
  ['naples', 'Naples', 14.27, 40.85, 'S'], ['athens', 'Athens', 23.73, 37.98, 'M'], ['budapest', 'Budapest', 19.04, 47.50, 'S'],
  ['bucharest', 'Bucharest', 26.10, 44.43, 'M'],
];

const land = [MAINLAND, SCANDINAVIA, FINLAND, GB, IRELAND].map(p => p.map(proj));
const islands = ISLANDS.map(p => p.map(proj));
const all = [...land, ...islands];
// Spacing in map units: at phone size a city is at least 18px across its radius, about 30 units here.
const R = { L: 33, M: 31, S: 30 };
const cities = CITIES.map(([id, name, lon, lat, size]) => { const [x, y] = proj([lon, lat]); return { id, name, x, y, size }; });
L.relax(cities, R, 6, all, 800);
for (const c of cities) L.pullOnLand(c, all);

let links = L.landLinks(cities, all, { maxLen: 120 });
// The Øresund is a crossing here, not a land route.
links = L.dropLinks(links, [['copenhagen', 'stockholm']]);
// The crossings, plus land routes the straight-line check can't see (bridges and tunnels).
links = L.addLinks(links, [
  ['london', 'paris', 'sea'], ['manchester', 'dublin', 'sea'], ['edinburgh', 'oslo', 'sea'], ['copenhagen', 'stockholm', 'sea'],
  ['stockholm', 'helsinki', 'sea'], ['barcelona', 'rome', 'sea'], ['naples', 'athens', 'sea'],
  ['london', 'amsterdam', 'sea'], ['london', 'brussels', 'sea'], ['copenhagen', 'berlin', 'sea'],
  ['copenhagen', 'hamburg'], ['athens', 'bucharest'],
]);

const map = {
  id: 'europe', name: 'Europe', orientation: 'portrait', lengthLabel: '7 min', width, height,
  matchLengthSeconds: 420, overtimeStartSeconds: 240,
  territories: true, southLine: Math.round(proj([0, 43.6])[1]), prizeCity: 'brussels',
  land, ni: [], islands, foreign: FOREIGN.map(p => p.map(proj)),
  cities: cities.map(({ id, name, x, y, size }) => ({ id, name, x: Math.round(x), y: Math.round(y), size })),
  links,
  slots: [
    { name: 'UK and Ireland', cities: ['london', 'manchester', 'birmingham'] },
    { name: 'Iberia', cities: ['madrid', 'barcelona', 'seville'] },
    { name: 'Scandinavia', cities: ['stockholm', 'oslo', 'copenhagen'] },
    { name: 'Eastern Europe', cities: ['warsaw', 'bucharest', 'budapest'] },
  ],
  teamSlots: [[0, 3], [1, 2]],   // diagonal pairs: the fairest split in bot games
};
// Balance (tools/balance.js and tools/fairness.js): Eastern Europe has the easiest land expansion, so its neighbours
// start a little tougher; the British Isles and Scandinavia have to cross the sea, so theirs start weaker.
const G = { L: 30, M: 18, S: 10 };
for (const c of map.cities) {
  if (['vienna', 'prague', 'athens'].includes(c.id)) c.garrison = G[c.size] + 5;
  if (['edinburgh', 'dublin', 'helsinki'].includes(c.id)) c.garrison = 6;
  if (['hamburg', 'paris'].includes(c.id)) c.garrison = G[c.size] - 6;
}
const lost = L.connected(map);
if (lost.length) console.log('NOT CONNECTED:', lost.join(', '));
L.write(out, map);
console.log(`wrote maps/europe.json: ${cities.length} cities, ${links.length} links (${links.filter(l => l[2]).length} sea), ${width}x${height}`);
