// Plays lots of bot-v-bot matches with the real Sim to see whether any start corner wins too often.
// Usage: node tools/balance.js [games]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const block = id => html.match(new RegExp(`<script[^>]*id="${id}">([\\s\\S]*?)</script>`))[1];
const { Sim, CONFIG } = vm.runInNewContext(block('config') + block('sim') + '\n;({ Sim, CONFIG })', {});
const MAP = JSON.parse(block('map-uk'));
Sim.setMap(MAP);
const GAMES = +process.argv[2] || 300;

let seed = 1;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// A simple greedy bot: attack the weakest beatable neighbour, push spare troops to the front, upgrade when safe.
function think(g, p) {
  const ally = o => Sim.allied(g, o, p.idx);
  const mine = g.cities.map((c, i) => i).filter(i => g.cities[i].o === p.idx);
  for (const s of mine) {
    const c = g.cities[s];
    const foes = Sim.adj(s).filter(j => !ally(g.cities[j].o));
    const hit = foes.filter(j => Math.floor(c.n / 2) > g.cities[j].n * CONFIG.defenderBonus + 2)
      .sort((a, b) => g.cities[a].n - g.cities[b].n)[0];
    if (hit !== undefined && rand() < 0.7) { Sim.send(g, p.id, [s], hit); continue; }
    const enemiesNear = foes.some(j => g.cities[j].o >= 0);
    const cost = CONFIG.upgradeCost[(c.lv || 1) + 1];
    if (cost && !enemiesNear && c.n > cost + 10 && rand() < 0.3) { Sim.upgrade(g, p.id, s); continue; }
    if (!foes.length && c.n > 20) {
      const front = Sim.adj(s).filter(j => ally(g.cities[j].o) && Sim.adj(j).some(k => !ally(g.cities[k].o)));
      if (front.length) Sim.send(g, p.id, [s], front[Math.floor(rand() * front.length)]);
    }
  }
}

function play(mode) {
  const g = Sim.createGame();
  ['a', 'b', 'c', 'd'].forEach(id => Sim.addPlayer(g, id, id));
  if (mode === 'teams') Sim.setMode(g, 'teams');
  Sim.start(g, rand);
  const ps = Object.values(g.players);
  const phase = ps.map(() => Math.floor(rand() * 10));
  for (let tick = 0; g.phase === 'play'; tick++) {
    Sim.step(g);
    ps.forEach((p, k) => { if (!p.out && tick % 10 === phase[k]) think(g, p); });
  }
  return { g, ps };
}

if (process.env.TRACE) {
  const at = [60, 120, 240, 480].map(x => x * 1000), sum = at.map(() => MAP.slots.map(() => 0)), lost = MAP.slots.map(() => 0);
  for (let n = 0; n < 60; n++) {
    const g = Sim.createGame();
    ['a', 'b', 'c', 'd'].forEach(id => Sim.addPlayer(g, id, id));
    if (process.env.TRACE === 'teams') Sim.setMode(g, 'teams');
    Sim.start(g, rand);
    const ps = Object.values(g.players);
    for (let tick = 0; g.phase === 'play'; tick++) {
      Sim.step(g);
      ps.forEach((p, k) => { if (!p.out && tick % 10 === k) think(g, p); });
      at.forEach((t, i) => { if (g.t === t) for (const p of ps) sum[i][p.slot] += g.cities.filter(c => c.o === p.idx).length / 60; });
    }
    for (const p of ps) lost[p.slot] += p.stats.lost / 60;
  }
  MAP.slots.forEach((s, j) => console.log(s.name.padEnd(12), at.map((t, i) => sum[i][j].toFixed(1)).join('  '), ' lost', lost[j].toFixed(1)));
  process.exit(0);
}
const slotWins = MAP.slots.map(() => 0);
let draws = 0, byTime = 0, length = 0;
for (let n = 0; n < GAMES; n++) {
  const { g, ps } = play('ffa');
  length += g.t;
  if (g.endReason === 'time') byTime++;
  const w = ps.find(p => p.idx === g.winner);
  if (w) slotWins[w.slot]++; else draws++;
}
console.log(`Free for all, ${GAMES} bot games, average ${(length / GAMES / 60000).toFixed(1)} min, ${byTime} on time, ${draws} draws`);
MAP.slots.forEach((s, i) => console.log(`  ${s.name.padEnd(12)} ${(100 * slotWins[i] / GAMES).toFixed(0).padStart(3)}%`));

const halfWins = [0, 0];
for (let n = 0; n < GAMES; n++) {
  const { g, ps } = play('teams');
  if (g.winTeam === null) continue;
  const slot = ps.find(p => p.team === g.winTeam).slot;
  halfWins[MAP.teamSlots.findIndex(h => h.includes(slot))]++;
}
console.log(`2 v 2, ${GAMES} bot games`);
MAP.teamSlots.forEach((h, i) => console.log(`  ${h.map(s => MAP.slots[s].name).join(' + ').padEnd(26)} ${(100 * halfWins[i] / GAMES).toFixed(0).padStart(3)}%`));
