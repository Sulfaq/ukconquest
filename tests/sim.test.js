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
CONFIG.chaos.firstAfterSeconds = 1e9;   // random events off unless a test fires one
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

// ---- M2: modes, teams, time limit, overtime, rematch ----
function teamGame() {
  const g = Sim.createGame();
  ['amy', 'ben', 'cat', 'dev'].forEach(id => Sim.addPlayer(g, id, id));
  assert(Sim.setMode(g, 'teams'));
  return g;
}
const teamsOf = g => ['amy', 'ben', 'cat', 'dev'].map(id => g.players[id].team).join();

test('2 v 2: joining alternates teams, teams cap at two, both need someone', () => {
  const g = teamGame();
  assert.strictEqual(teamsOf(g), '0,1,0,1');
  assert(!Sim.setTeam(g, 'ben', 0), 'team 0 is full');
  const h = Sim.createGame();
  Sim.addPlayer(h, 'a', 'a'); Sim.setMode(h, 'teams');
  assert(Sim.startProblem(h));
  Sim.addPlayer(h, 'b', 'b');
  assert.strictEqual(Sim.startProblem(h), '');
  Sim.setTeam(h, 'b', 0);
  assert(Sim.startProblem(h), 'everyone on one team');
});

test('2 v 2: teammates start in neighbouring corners and share a colour family', () => {
  for (let k = 0; k < 20; k++) {
    const g = teamGame();
    Sim.start(g);
    const halves = MAP.teamSlots.map(h => h.slice().sort().join());
    for (const t of [0, 1]) {
      const slots = Object.values(g.players).filter(p => p.team === t).map(p => p.slot).sort().join();
      assert(halves.includes(slots), slots);
    }
    const s = Sim.snapshot(g);
    for (const p of s.players) assert(CONFIG.teamColours[p.team].includes(p.colour));
    assert.strictEqual(new Set(s.players.map(p => p.colour)).size, 4);
  }
});

test('2 v 2: you can reinforce a teammate, never attack them', () => {
  const g = teamGame();
  Sim.start(g);
  const amy = g.players.amy, cat = g.players.cat;
  const catCity = I.oxford, amyCity = I.london;
  g.cities[catCity] = { o: cat.idx, n: 10 };
  g.cities[amyCity] = { o: amy.idx, n: 40 };
  const enemy = g.cities.findIndex(c => c.o === g.players.ben.idx);
  assert(!Sim.route(g, amy.idx, amyCity, enemy) || !Sim.allied(g, amy.idx, g.players.ben.idx));
  const before = g.cities[catCity].n;
  assert(Sim.send(g, 'amy', [amyCity], catCity), 'teammate is reachable');
  until(g, () => g.fleets.length === 0);
  assert.strictEqual(g.cities[catCity].o, cat.idx, "still the teammate's");
  assert(g.cities[catCity].n > before + 15);
  assert(amy.stats.gifted >= 20);
});

test('2 v 2: a team wins when the other team is wiped out', () => {
  const g = teamGame();
  Sim.start(g);
  const winner = Object.values(g.players).find(p => p.team === 1).idx;
  for (const c of g.cities) if (c.o >= 0) c.o = winner;
  Sim.step(g);
  assert.strictEqual(g.phase, 'over');
  assert.strictEqual(g.winTeam, 1);
  assert.strictEqual(g.endReason, 'elimination');
});

test('time limit: most cities wins, troops break a tie', () => {
  const g = game(2);
  g.cities[I.leeds].o = 1;   // ben has one more city
  run(g, CONFIG.matchSeconds * 1000);
  assert.strictEqual(g.phase, 'over');
  assert.strictEqual(g.endReason, 'time');
  assert.strictEqual(g.winner, 1);
  const h = game(2);
  h.t = CONFIG.matchSeconds * 1000 - CONFIG.tickMs;
  for (const c of h.cities) if (c.o === 0) c.n = 30;
  for (const c of h.cities) if (c.o === 1) c.n = 10;
  Sim.step(h);
  assert.strictEqual(h.winner, 0, 'tie on cities, amy has more troops');
});

test('overtime: production is boosted after the overtime mark', () => {
  const g = game();
  g.t = CONFIG.overtimeAtSeconds * 1000;
  g.cities[I.london].n = 10;
  run(g, 1000);
  assert(Math.abs(g.cities[I.london].n - (10 + CONFIG.production.L * CONFIG.overtimeBoost)) < 0.01);
  assert(Sim.snapshot(g).ot);
});

test('rematch keeps players, mode and teams, and starts a fresh match', () => {
  const g = teamGame();
  Sim.start(g);
  for (const c of g.cities) if (c.o >= 0) c.o = g.players.amy.idx;
  Sim.step(g);
  assert.strictEqual(g.phase, 'over');
  const before = teamsOf(g);
  assert(Sim.rematch(g));
  assert.strictEqual(g.phase, 'play');
  assert.strictEqual(g.mode, 'teams');
  assert.strictEqual(teamsOf(g), before);
  assert.strictEqual(g.t, 0);
  for (const p of Object.values(g.players)) assert.strictEqual(p.stats.taken, 0);
});

test('end screen stats count captures, troops sent and peak cities', () => {
  const g = game(2);
  g.cities[I.london].n = 60; g.cities[I.oxford].n = 1;
  Sim.send(g, 'amy', [I.london], I.oxford);
  until(g, () => g.fleets.length === 0);
  assert.strictEqual(g.players.amy.stats.taken, 1);
  assert.strictEqual(g.players.amy.stats.sent, 30);
  assert.strictEqual(g.players.amy.stats.peak, 4);
  Sim.step(g); g.phase = 'over';
  assert.strictEqual(Sim.snapshot(g).c[I.london][2], 1, 'snapshot carries the level');
  assert(Sim.snapshot(g).players[0].stats, 'stats only travel at the end');
});


// ---- M3: upgrades ----
test('upgrade: costs troops from the garrison, one level at a time, up to level 3', () => {
  const g = game();
  const [, , c2, c3] = CONFIG.upgradeCost;
  g.cities[I.london].n = c2;
  assert.strictEqual(Sim.upgradeProblem(g, 'amy', I.london), 'troops', 'must pay the cost and keep one');
  g.cities[I.london].n = c2 + 1;
  assert(Sim.upgrade(g, 'amy', I.london));
  assert.strictEqual(g.cities[I.london].lv, 2);
  assert.strictEqual(g.cities[I.london].n, 1);
  g.cities[I.london].n = c3 + 10;
  assert(Sim.upgrade(g, 'amy', I.london));
  assert.strictEqual(g.cities[I.london].lv, 3);
  assert.strictEqual(g.cities[I.london].n, 10);
  g.cities[I.london].n = 100;
  g.cities[I.london].n = 100;
  assert.strictEqual(Sim.upgradeProblem(g, 'amy', I.london), 'max');
  assert(!Sim.upgrade(g, 'amy', I.london));
  assert.strictEqual(g.players.amy.stats.upgrades, 2);
});

test('upgrade: only your own cities, only while playing', () => {
  const g = game();
  for (const c of g.cities) c.n = 60;
  assert(!Sim.upgrade(g, 'amy', I.manchester), "ben's city");
  assert(!Sim.upgrade(g, 'amy', I.birmingham), 'neutral');
  assert(!Sim.upgrade(g, 'zed', I.london));
  assert(!Sim.upgrade(g, 'amy', 'london'));
  g.phase = 'over';
  assert(!Sim.upgrade(g, 'amy', I.london));
});

test('levels raise production and the cap (60 / 100 / 150 for a large city)', () => {
  const g = game();
  g.cities[I.london] = { o: 0, n: 10, lv: 2 };
  run(g, 1000);
  assert(Math.abs(g.cities[I.london].n - (10 + CONFIG.production.L * 1.5)) < 0.01);
  run(g, 300000);
  assert(Math.abs(g.cities[I.london].n - 100) < 0.01);
  g.cities[I.london].lv = 3;
  run(g, 300000);
  assert(Math.abs(g.cities[I.london].n - 150) < 0.01);
});

test('a captured city keeps its level', () => {
  const g = game();
  g.cities[I.oxford] = { o: -1, n: 1, lv: 3 };
  g.cities[I.london].n = 40;
  Sim.send(g, 'amy', [I.london], I.oxford);
  until(g, () => g.fleets.length === 0);
  assert.strictEqual(g.cities[I.oxford].o, 0);
  assert.strictEqual(g.cities[I.oxford].lv, 3);
});


// ---- M4: the real UK map ----
test('map: every city sits on land, and the North West has a backyard of its own', () => {
  const inside = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  for (const c of MAP.cities) assert([...MAP.land, ...MAP.ni].some(p => inside(c.x, c.y, p)), c.id + ' is in the sea');
  const nw = new Set(MAP.slots[1].cities.map(id => I[id]));
  for (const id of ['preston', 'wrexham']) assert(Sim.adj(I[id]).every(j => nw.has(j)), id);
  assert(MAP.territories);
});

// ---- M5: chaos events ----
test('rail strike shuts one line: no route along it until it ends', () => {
  const g = game();
  for (const c of g.cities) c.n = 60;
  const e = Sim.chaos(g, 'railStrike', () => 0);
  const [i, j] = e.links[0].split(',').map(Number);
  assert(Sim.blocked(g, i, j));
  const owner = g.cities[i].o >= 0 ? i : j, other = owner === i ? j : i;
  const p = Object.values(g.players).find(q => q.idx === g.cities[owner].o);
  const r = Sim.route(g, p.idx, owner, other);
  assert(!r || r.path.length > 2, 'must go the long way round, if at all');
  run(g, CONFIG.chaos.railStrike.seconds * 1000 + 200);
  assert(!Sim.blocked(g, i, j), 'line reopens');
});

test('Storm Gerald cuts Belfast off; bank holiday doubles production; heatwave halves the South', () => {
  const g = game();
  g.cities[I.glasgow] = { o: 0, n: 60, lv: 1 };
  Sim.chaos(g, 'stormGerald');
  assert(!Sim.send(g, 'amy', [I.glasgow], I.belfast));
  const h = game();
  h.cities[I.london].n = 10; h.cities[I.manchester].n = 10;
  Sim.chaos(h, 'bankHoliday');
  run(h, 1000);
  assert(Math.abs(h.cities[I.london].n - (10 + 2 * CONFIG.production.L)) < 0.01);
  const k = game();
  k.cities[I.london].n = 10; k.cities[I.manchester].n = 10;
  Sim.chaos(k, 'heatwave');
  run(k, 1000);
  assert(Math.abs(k.cities[I.london].n - (10 + 0.5 * CONFIG.production.L)) < 0.01, 'London is in the South');
  assert(Math.abs(k.cities[I.manchester].n - (10 + CONFIG.production.L)) < 0.01, 'Manchester is not');
});

test('Greggs only ever strengthens a neutral city', () => {
  for (let n = 0; n < 30; n++) {
    const g = game();
    const before = g.cities.map(c => c.n);
    const e = Sim.chaos(g, 'greggs');
    assert.strictEqual(g.cities[e.c].o, -1);
    assert.strictEqual(g.cities[e.c].n, before[e.c] + CONFIG.chaos.greggs.troops);
  }
});

test('events fire on a schedule when chaos is on, never near the end, never when off', () => {
  const saved = CONFIG.chaos.firstAfterSeconds;
  CONFIG.chaos.firstAfterSeconds = 60;
  try {
    const g = game(2);
    for (const c of g.cities) if (c.o < 0) c.n = 1e6;   // nobody can take anything, so the match runs the full time
    const fired = [];
    while (g.phase === 'play') { Sim.step(g); for (const e of g.events) if (e.k === 'chaos' && e.t === g.t) fired.push(e.t); }
    assert(fired.length >= 4, fired.length + ' events');
    assert(fired[0] >= 60000);
    assert(fired.every(t => t < (CONFIG.matchSeconds - CONFIG.chaos.quietLastSeconds) * 1000));
    const h = Sim.createGame();
    Sim.addPlayer(h, 'a', 'a');
    assert(Sim.setChaos(h, false));
    Sim.start(h);
    run(h, 300000);
    assert(!h.events.some(e => e.k === 'chaos'));
  } finally { CONFIG.chaos.firstAfterSeconds = saved; }
});

// ---- M6: power-ups ----
test('power-ups: every third capture earns one, and you hold at most two', () => {
  const g = game();
  const amy = g.players.amy;
  for (let k = 0; k < 2; k++) Sim.earn(g, amy);
  assert.strictEqual(amy.powers.length, 0);
  Sim.earn(g, amy);
  assert.strictEqual(amy.powers.length, 1);
  for (let k = 0; k < 9; k++) Sim.earn(g, amy);
  assert.strictEqual(amy.powers.length, CONFIG.powerups.maxHeld);
  // Captures through real combat count too.
  const h = game();
  for (const id of ['oxford', 'southampton', 'norwich']) { h.cities[I[id]].n = 1; h.cities[I.london].n = 60; Sim.send(h, 'amy', [I.london], I[id]); until(h, () => h.fleets.length === 0); }
  assert.strictEqual(h.players.amy.powers.length, 1);
});

test('speed: troops sent while it lasts travel twice as fast', () => {
  const g = game();
  g.cities[I.london].n = 60;
  g.players.amy.powers = ['speed'];
  Sim.send(g, 'amy', [I.london], I.oxford);
  const slow = g.fleets[0].t1 - g.fleets[0].t0;
  assert(Sim.usePower(g, 'amy', 0));
  Sim.send(g, 'amy', [I.london], I.oxford);
  const fast = g.fleets[1].t1 - g.fleets[1].t0;
  assert(Math.abs(fast * 2 - slow) <= 2, slow + ' vs ' + fast);
  assert.strictEqual(g.players.amy.powers.length, 0, 'used up');
});

test('shield: enemy troops bounce off, only on your own city, and it wears off', () => {
  const g = game();
  g.players.ben.powers = ['shield'];
  assert(!Sim.usePower(g, 'ben', 0, I.london), "not on someone else's city");
  g.cities[I.stoke].n = 5;
  assert(Sim.usePower(g, 'ben', 0, I.stoke));
  g.cities[I.birmingham] = { o: 0, n: 80, lv: 1 };
  Sim.send(g, 'amy', [I.birmingham], I.stoke);
  until(g, () => g.fleets.length === 0);
  assert.strictEqual(g.cities[I.stoke].o, 1, 'still ben');
  assert(g.cities[I.stoke].n >= 5, 'no damage');
  run(g, CONFIG.powerups.shield.seconds * 1000);
  g.cities[I.birmingham].n = 80;
  Sim.send(g, 'amy', [I.birmingham], I.stoke);
  until(g, () => g.fleets.length === 0);
  assert.strictEqual(g.cities[I.stoke].o, 0, 'taken once the shield is gone');
});

test('sabotage: stops an enemy city producing for a while; not on neutrals, yourself or a teammate', () => {
  const g = game();
  g.players.amy.powers = ['sabotage'];
  assert(!Sim.usePower(g, 'amy', 0, I.london));
  assert(!Sim.usePower(g, 'amy', 0, I.birmingham));
  g.cities[I.manchester].n = 10;
  assert(Sim.usePower(g, 'amy', 0, I.manchester));
  run(g, 5000);
  assert.strictEqual(g.cities[I.manchester].n, 10);
  run(g, CONFIG.powerups.sabotage.seconds * 1000);
  assert(g.cities[I.manchester].n > 10, 'producing again');
  const t = teamGame();
  Sim.start(t);
  const mate = Object.values(t.players).find(p => p.id !== 'amy' && p.team === t.players.amy.team);
  t.players.amy.powers = ['sabotage'];
  assert(!Sim.usePower(t, 'amy', 0, t.cities.findIndex(c => c.o === mate.idx)));
});

test('power-ups: bad slots and junk do nothing', () => {
  const g = game();
  assert(!Sim.usePower(g, 'amy', 0));
  g.players.amy.powers = ['shield'];
  assert(!Sim.usePower(g, 'amy', 5, I.london));
  assert(!Sim.usePower(g, 'amy', 0, 'x'));
  assert(!Sim.usePower(g, 'zed', 0, I.london));
  assert.strictEqual(g.players.amy.powers.length, 1);
});

// ---- M7: awards ----
const awardOf = (g, k) => (g.awards || []).find(a => a.k === k);
test('awards: most cities taken, the Birmingham baron, and nothing for doing nothing', () => {
  const g = game(2);
  g.cities[I.birmingham].o = 1;
  run(g, 30000);
  g.players.amy.stats.taken = 4; g.players.ben.stats.taken = 2;
  for (const c of g.cities) if (c.o === 1) c.o = 0;
  Sim.step(g);
  assert.strictEqual(g.phase, 'over');
  assert.strictEqual(awardOf(g, 'taken').o, 0);
  assert.strictEqual(awardOf(g, 'prize').o, 1, 'ben held Birmingham for 30s');
  assert(!awardOf(g, 'comeback'), 'no comeback happened');
  assert(!awardOf(g, 'betrayer'), 'not a team game');
  assert(Sim.snapshot(g).awards.length >= 2);
});

test('awards: biggest comeback needs a real climb back', () => {
  const g = game(2);
  g.players.ben.stats.low = 1;
  for (const id of ['leeds', 'sheffield', 'york', 'hull']) g.cities[I[id]].o = 1;
  Sim.step(g);
  for (const c of g.cities) if (c.o === 0) c.o = 1;
  Sim.step(g);
  assert.strictEqual(awardOf(g, 'comeback').o, 1);
});

test('awards: a 2 v 2 player who walks out on their teammate is the Betrayer', () => {
  const g = teamGame();
  Sim.start(g);
  Sim.setConnected(g, 'amy', false);
  const amyTeam = g.players.amy.team;
  const winner = Object.values(g.players).find(p => p.team === amyTeam && p.id !== 'amy').idx;
  for (const c of g.cities) if (c.o >= 0) c.o = winner;
  Sim.step(g);
  assert.strictEqual(awardOf(g, 'betrayer').o, g.players.amy.idx);
});

test('captures say how big the beaten garrison was, for the shake', () => {
  const g = game();
  g.cities[I.london].n = 80; g.cities[I.oxford].n = 25;
  Sim.send(g, 'amy', [I.london], I.oxford);
  let cap = null;
  until(g, () => (cap = g.events.find(e => e.k === 'cap')));
  assert(cap.lost >= 25);
});

console.log(`\n${passed} passed`);
