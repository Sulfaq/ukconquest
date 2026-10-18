// Shared helpers for the map builders: projection, spreading crowded cities, proposing links, writing JSON.
'use strict';
const fs = require('fs');

// Equirectangular projection squashed by cos(midLat), scaled to `width` map units across.
// `stretch` > 1 makes it taller than true, to use a portrait phone's height.
function projection({ lon0, lon1, lat0, lat1, midLat, width, stretch = 1 }) {
  const cos = Math.cos(midLat * Math.PI / 180);
  const k = width / ((lon1 - lon0) * cos);
  const proj = ([lon, lat]) => [+((lon - lon0) * cos * k).toFixed(1), +((lat1 - lat) * k * stretch).toFixed(1)];
  return { proj, width, height: Math.round((lat1 - lat0) * k * stretch) };
}

function inside(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const onLand = (x, y, polys) => polys.some(p => inside(x, y, p));

// Push overlapping cities apart (keeping them on land), with a spring back to their real position.
function relax(cities, R, gap, polys, iterations = 400) {
  for (const c of cities) { c.ax = c.x; c.ay = c.y; }
  for (let it = 0; it < iterations; it++) {
    for (const a of cities) for (const b of cities) {
      if (a === b) continue;
      const need = R[a.size] + R[b.size] + gap;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      if (d < need) {
        const p = (need - d) / 2 * 0.5;
        for (const [c, s] of [[a, -1], [b, 1]]) {
          const nx = c.x + s * dx / d * p, ny = c.y + s * dy / d * p;
          if (!polys || onLand(nx, ny, polys)) { c.x = nx; c.y = ny; }
        }
      }
    }
    for (const c of cities) { c.x += (c.ax - c.x) * 0.02; c.y += (c.ay - c.y) * 0.02; }
  }
}

// Move a city that landed in the sea to the nearest land point (coarse outlines put some ports offshore).
function pullOnLand(c, polys, step = 1, inset = 3) {
  const ok = (x, y) => [[0, 0], [inset, 0], [-inset, 0], [0, inset], [0, -inset]].every(([dx, dy]) => onLand(x + dx, y + dy, polys));
  if (ok(c.x, c.y)) return;
  for (let r = step; r < 80; r += step) {
    for (let a = 0; a < 16; a++) {
      const x = c.x + r * Math.cos(a * Math.PI / 8), y = c.y + r * Math.sin(a * Math.PI / 8);
      if (ok(x, y)) { c.x = x; c.y = y; return; }
    }
  }
}

// Share of a straight line between two cities that runs over land.
function landShare(a, b, polys, samples = 24) {
  let n = 0;
  for (let k = 1; k < samples; k++) {
    const t = k / samples;
    if (onLand(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, polys)) n++;
  }
  return n / (samples - 1);
}

// Each city to its 2-4 nearest neighbours within `maxLen`, over land only; shorter links win where two would cross.
function landLinks(cities, polys, { maxLen, minLand = 0.85, perCity = 4 }) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const cand = new Map();
  for (const a of cities) {
    const near = cities.filter(b => b !== a).sort((p, q) => dist(a, p) - dist(a, q)).slice(0, perCity);
    near.forEach((b, i) => {
      if ((i < 2 || dist(a, b) < maxLen) && dist(a, b) < maxLen * 1.4 && landShare(a, b, polys) >= minLand) cand.set([a.id, b.id].sort().join('|'), [a, b]);
    });
  }
  const kept = [];
  for (const l of [...cand.values()].sort((p, q) => dist(...p) - dist(...q))) if (!kept.some(k => crosses(l[0], l[1], k[0], k[1]))) kept.push(l);
  return kept.map(([a, b]) => [a.id, b.id]);
}
function crosses(p1, p2, p3, p4) {
  const o = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  if ([p1, p2].includes(p3) || [p1, p2].includes(p4)) return false;
  return o(p1, p2, p3) !== o(p1, p2, p4) && o(p3, p4, p1) !== o(p3, p4, p2);
}

// Every link touching a city: [a, b] or [a, b, 'sea'].
function addLinks(links, extra) {
  const key = (a, b) => [a, b].sort().join('|');
  const have = new Set(links.map(([a, b]) => key(a, b)));
  for (const l of extra) if (!have.has(key(l[0], l[1]))) { links.push(l); have.add(key(l[0], l[1])); }
  return links;
}
function dropLinks(links, gone) {
  const key = (a, b) => [a, b].sort().join('|');
  const out = new Set(gone.map(([a, b]) => key(a, b)));
  return links.filter(([a, b]) => !out.has(key(a, b)));
}

function connected(map) {
  const adj = {};
  for (const [a, b] of map.links) { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); }
  const seen = new Set([map.cities[0].id]), q = [map.cities[0].id];
  while (q.length) for (const v of adj[q.shift()] || []) if (!seen.has(v)) { seen.add(v); q.push(v); }
  return map.cities.filter(c => !seen.has(c.id)).map(c => c.id);
}

// One point or link per line keeps the file easy to hand-tune.
function write(file, map) {
  fs.writeFileSync(file, JSON.stringify(map, null, 1)
    .replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1,$2]')
    .replace(/\[\s+"(\w+)",\s+"(\w+)"\s+\]/g, '["$1","$2"]')
    .replace(/\[\s+"(\w+)",\s+"(\w+)",\s+"sea"\s+\]/g, '["$1","$2","sea"]'));
}

module.exports = { pullOnLand, projection, inside, onLand, relax, landShare, landLinks, addLinks, dropLinks, connected, write };
