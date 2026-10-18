// Plays lots of bot-v-bot matches with the real Sim to see whether any start corner wins too often.
// Usage: node tools/balance.js [games]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const block = id => html.match(new RegExp(`<script[^>]*id="${id}">([\\s\\S]*?)</script>`))[1];
const { Sim, CONFIG } = vm.runInNewContext(block('config') + block('sim') + '\n;({ Sim, CONFIG })', {});
// MAP=england node tools/balance.js runs another map from maps/.
const MAP = process.env.MAP ? JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maps', process.env.MAP + '.json'), 'utf8')) : JSON.parse(block('map-uk'));
Sim.setMap(MAP);
const GAMES = +process.argv[2] || 300;

let seed = 1;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// The same bot the game uses to fill empty seats.
const think = (g, p) => Sim.botThink(g, p, rand);

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
