// Runs the game simulation from index.html in Node, without a browser.
// Usage: node tests/sim.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const block = id => html.match(new RegExp(`<script[^>]*id="${id}">([\\s\\S]*?)</script>`))[1];
const { Sim, CONFIG } = vm.runInNewContext(block('config') + block('sim') + '\n;({ Sim, CONFIG })', {});
const MAP = JSON.parse(block('map-uk'));
Sim.setMap(MAP);
const I = Object.fromEntries(MAP.cities.map((c, i) => [c.id, i]));

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok -', name); }

function game(n = 4) {
  const g = Sim.createGame();
  ['amy', 'ben', 'cat', 'dev'].slice(0, n).forEach(id => Sim.addPlayer(g, id, id));
  Sim.start(g, () => 0.999);   // no shuffle: player k gets slot k
  return g;
}
const run = (g, ms) => { for (let t = 0; t < ms; t += CONFIG.tickMs) Sim.step(g); };
const until = (g, fn, max = 60000) => { for (let t = 0; t < max && !fn(); t += CONFIG.tickMs) Sim.step(g); assert(fn(), 'condition never met'); };

test('map: every link names real cities, the graph is connected, Belfast only by sea', () => {
  const seen = new Set([0]), q = [0];
  while (q.length) for (const v of Sim.adj(q.shift())) if (!seen.has(v)) { seen.add(v); q.push(v); }
  assert.strictEqual(seen.size, MAP.cities.length);
  assert.strictEqual(Sim.adj(I.belfast).join(), String(I.glasgow));
  assert.strictEqual(MAP.slots.length, 4);
  for (const s of MAP.slots) for (const c of s.cities) assert(c in I, c);
});

test('lobby: fifth player refused, no joining mid-match, rejoin allowed', () => {
  const g = Sim.createGame();
  for (const n of ['a', 'b', 'c', 'd']) assert(Sim.addPlayer(g, n, n).ok);
  assert.strictEqual(Sim.addPlayer(g, 'e', 'e').err, 'full');
  assert(Sim.start(g));
  assert.strictEqual(Sim.addPlayer(g, 'e', 'e').err, 'started');
  assert(Sim.addPlayer(g, 'a', 'a').ok);
});

test('start: four different corners, three cities each, rest neutral', () => {
  const g = Sim.createGame();
  ['a', 'b', 'c', 'd'].forEach(id => Sim.addPlayer(g, id, id));
  Sim.start(g);
  const slots = Object.values(g.players).map(p => p.slot);
  assert.strictEqual(new Set(slots).size, 4);
  for (let o = 0; o < 4; o++) assert.strictEqual(g.cities.filter(c => c.o === o).length, 3);
  assert.strictEqual(g.cities.filter(c => c.o === -1).length, MAP.cities.length - 12);
  assert.strictEqual(g.cities[I.birmingham].n, CONFIG.neutralGarrison.L);
});

test('production ticks up and stops at the cap; neutrals do not produce', () => {
  const g = game();
  run(g, 5000);
  assert(Math.abs(g.cities[I.london].n - (20 + 5 * CONFIG.production.L)) < 0.01);
  assert.strictEqual(g.cities[I.birmingham].n, CONFIG.neutralGarrison.L);
  run(g, 120000);
  assert.strictEqual(g.cities[I.london].n, CONFIG.cap.L);
  assert.strictEqual(g.cities[I.cambridge].n, CONFIG.cap.S);
});

test('send: half the garrison travels along the link and captures a weak neutral', () => {
  const g = game();
  g.cities[I.london].n = 40;
  g.cities[I.oxford].n = 5;
  assert(Sim.send(g, 'amy', [I.london], I.oxford));
  assert.strictEqual(g.cities[I.london].n, 20);
  const f = g.fleets[0];
  assert.strictEqual(f.n, 20);
  assert(f.t1 - f.t0 > 1000 && f.t1 - f.t0 < 6000, 'travel time ' + (f.t1 - f.t0));
  until(g, () => g.fleets.length === 0);
  assert.strictEqual(g.cities[I.oxford].o, 0);
  assert(Math.abs(g.cities[I.oxford].n - (20 - 5 * CONFIG.defenderBonus)) < 0.01);
});

test('combat: defenders count 1.1x and keep the city when attackers fall short', () => {
  const g = game();
  g.cities[I.london].n = 41;       // sends 20
  g.cities[I.oxford].n = 19;       // defends as 20.9
  Sim.send(g, 'amy', [I.london], I.oxford);
  until(g, () => g.fleets.length === 0);
  assert.strictEqual(g.cities[I.oxford].o, -1);
  assert(Math.abs(g.cities[I.oxford].n - 0.9 / 1.1) < 0.01);
});

test('chain: dragging through several of your cities sends from all of them', () => {
  const g = game();
  g.cities[I.london].n = 30; g.cities[I.cambridge].n = 30; g.cities[I.brighton].n = 30;
  assert(Sim.send(g, 'amy', [I.london, I.cambridge, I.brighton], I.oxford));
  assert.strictEqual(g.fleets.length, 3);
  // Cambridge and Brighton route through London (yours); none of them stop in someone else's city.
  for (const f of g.fleets) for (const c of f.path.slice(1, -1)) assert.strictEqual(g.cities[c].o, 0);
});

test('cheating: cannot send from cities you do not own, through enemy cities, or junk input', () => {
  const g = game();
  assert(!Sim.send(g, 'amy', [I.manchester], I.stoke), 'not your city');
  assert(!Sim.send(g, 'amy', [I.london], I.belfast), 'no route through others');
  assert(!Sim.send(g, 'amy', 'london', I.oxford));
  assert(!Sim.send(g, 'amy', [I.london], 999));
  assert(!Sim.send(g, 'zed', [I.london], I.oxford));
  g.cities[I.london].n = 1;
  assert(!Sim.send(g, 'amy', [I.london], I.oxford), 'must leave one behind');
  assert(!Sim.send(g, 'amy', [I.cambridge, I.cambridge, I.cambridge], I.london) || g.fleets.length === 1, 'duplicates send once');
});

test('reinforce your own city adds troops (and can go over the cap)', () => {
  const g = game();
  g.cities[I.london].n = 60; g.cities[I.cambridge].n = 40;
  Sim.send(g, 'amy', [I.cambridge], I.london);
  until(g, () => g.fleets.length === 0);
  assert(g.cities[I.london].n >= 79.9);
});

test('disconnect: cities keep producing for 60 seconds, then freeze; rejoin unfreezes', () => {
  const g = game();
  Sim.setConnected(g, 'amy', false);
  run(g, 10000);
  assert(g.cities[I.london].n > 25);
  run(g, 55000);
  const frozenAt = g.cities[I.london].n;
  g.cities[I.london].n = 10;
  run(g, 5000);
  assert.strictEqual(g.cities[I.london].n, 10, 'frozen');
  assert(frozenAt > 10);
  Sim.addPlayer(g, 'amy', 'amy');
  run(g, 1000);
  assert(g.cities[I.london].n > 10);
});

test('elimination: last player with cities wins', () => {
  const g = game(2);
  for (const c of g.cities) if (c.o === 1) c.o = 0;   // wipe out ben
  Sim.step(g);
  assert.strictEqual(g.phase, 'over');
  assert.strictEqual(g.winner, 0);
  assert(g.players.ben.out);
});

test('a player with troops still in the air is not out yet', () => {
  const g = game(2);
  for (const c of g.cities) if (c.o === 1 && c !== g.cities[I.manchester]) c.o = 0;
  g.cities[I.manchester].n = 30;
  Sim.send(g, 'ben', [I.manchester], I.leeds);
  g.cities[I.manchester].o = 0;
  Sim.step(g);
  assert.strictEqual(g.phase, 'play');
});

test('a full random match between two scripted players ends with a winner', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const g = Sim.createGame();
  Sim.addPlayer(g, 'amy', 'amy'); Sim.addPlayer(g, 'ben', 'ben');
  Sim.start(g, rand);
  for (let t = 0; t < 30 * 60000 && g.phase === 'play'; t += CONFIG.tickMs) {
    Sim.step(g);
    if (t % 1000) continue;
    for (const p of Object.values(g.players)) {
      const mine = g.cities.map((c, i) => i).filter(i => g.cities[i].o === p.idx);
      for (const s of mine) {
        const targets = Sim.adj(s).filter(j => g.cities[j].o !== p.idx && g.cities[j].n * 1.1 < g.cities[s].n / 2);
        if (targets.length) Sim.send(g, p.id, [s], targets[Math.floor(rand() * targets.length)]);
      }
      if (mine.length && rand() < 0.1) Sim.send(g, p.id, mine, mine[0]);
    }
  }
  assert.strictEqual(g.phase, 'over');
  assert(g.winner === 0 || g.winner === 1);
  const s = Sim.snapshot(g);
  assert(JSON.stringify(s).length < 6000);
});

test('snapshot stays small with lots of fleets in the air', () => {
  const g = game();
  for (const c of g.cities) c.n = 60;
  for (const p of Object.values(g.players)) {
    const mine = g.cities.map((c, i) => i).filter(i => g.cities[i].o === p.idx);
    for (const s of mine) for (const t of Sim.adj(s)) Sim.send(g, p.id, [s], t);
  }
  const bytes = JSON.stringify(Sim.snapshot(g)).length;
  assert(bytes < 8000, bytes + ' bytes');
});

console.log(`\n${passed} passed`);
