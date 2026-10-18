// Structural fairness of a map's start slots, as the bigger-maps spec asks:
// similar starting strength, similar travel time to the nearest neutrals, similar travel time to the nearest enemy,
// and no slot that can be reached by only one link. Usage: node tools/fairness.js [map id]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const block = id => html.match(new RegExp(`<script[^>]*id="${id}">([\\s\\S]*?)</script>`))[1];
const { Sim, CONFIG } = vm.runInNewContext(block('config') + block('sim') + '\n;({ Sim, CONFIG })', {});
const id = process.argv[2] || 'uk';
const MAP = JSON.parse(fs.readFileSync(path.join(root, 'maps', id + '.json'), 'utf8'));
Sim.setMap(MAP);
const I = Object.fromEntries(MAP.cities.map((c, i) => [c.id, i]));
const N = MAP.cities.length;

// Travel seconds from a set of cities to every city (sea is slower).
function seconds(from) {
  const d = new Array(N).fill(Infinity), done = new Array(N).fill(false);
  for (const s of from) d[s] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0) break;
    done[u] = true;
    for (const v of Sim.adj(u)) d[v] = Math.min(d[v], d[u] + Sim.linkCost(u, v) / CONFIG.travelSpeed);
  }
  return d;
}

const starts = MAP.slots.map(s => s.cities.map(c => I[c]));
const owned = new Set(starts.flat());
const rows = MAP.slots.map((s, k) => {
  const mine = starts[k], d = seconds(mine);
  const prod = mine.reduce((t, i) => t + CONFIG.production[MAP.cities[i].size], 0);
  const neutrals = MAP.cities.map((c, i) => i).filter(i => !owned.has(i)).map(i => d[i]).sort((a, b) => a - b);
  const near3 = neutrals.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const enemy = Math.min(...starts.filter((_, j) => j !== k).flat().map(i => d[i]));
  // Links leading out of this slot's "home" (its cities plus neutrals closer to it than to any other slot).
  const others = starts.map((st, j) => (j === k ? null : seconds(st)));
  const home = new Set(MAP.cities.map((c, i) => i).filter(i => others.every(o => !o || d[i] < o[i])));
  const ways = new Set();
  for (const i of home) for (const j of Sim.adj(i)) if (!home.has(j)) ways.add([i, j].sort().join());
  return { name: s.name, prod, near3, enemy, ways: ways.size, home: home.size };
});
console.log(`${MAP.name}: slot fairness (seconds of travel)`);
console.log('slot'.padEnd(18) + 'production  3 nearest neutrals  nearest enemy  home cities  ways in');
for (const r of rows) console.log(r.name.padEnd(18) + r.prod.toFixed(2).padStart(10) + r.near3.toFixed(1).padStart(19) + r.enemy.toFixed(1).padStart(15) + String(r.home).padStart(13) + String(r.ways).padStart(9));
const spread = k => { const v = rows.map(r => r[k]); return Math.max(...v) / Math.min(...v); };
console.log(`max/min: neutrals x${spread('near3').toFixed(2)}, enemy x${spread('enemy').toFixed(2)}, home x${spread('home').toFixed(2)}`);
if (rows.some(r => r.ways < 2)) console.log('WARNING: a slot can only be reached one way');
