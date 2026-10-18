// Copies vendor libraries and map data into index.html between <!-- INLINE:name --> markers,
// so the game stays one self-contained file with no CDN requests.
// Usage: node tools/inline.js   (run after editing maps/*.json or updating a vendor file)
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const BLOCKS = {
  peerjs: () => `<script>${read('vendor/peerjs-1.5.5.min.js').replace(/\n?\/\/# sourceMappingURL=.*$/m, '').trim()}</script>`,
  'map-europe': () => `<script type="application/json" id="map-europe">${JSON.stringify(JSON.parse(read('maps/europe.json')))}</script>`,
  'map-world': () => `<script type="application/json" id="map-world">${JSON.stringify(JSON.parse(read('maps/world.json')))}</script>`,
  'map-uk': () => `<script type="application/json" id="map-uk">${JSON.stringify(JSON.parse(read('maps/uk.json')))}</script>`,
};

let html = fs.readFileSync(htmlPath, 'utf8');
for (const [name, make] of Object.entries(BLOCKS)) {
  const code = make();
  if (/<\/script/i.test(code.slice(8, -9))) throw new Error(`${name} contains </script and cannot be inlined`);
  const re = new RegExp(`(<!-- INLINE:${name} -->)[\\s\\S]*?(<!-- /INLINE:${name} -->)`);
  if (!re.test(html)) throw new Error(`Marker for ${name} not found in index.html`);
  html = html.replace(re, (_, open, close) => `${open}\n${code}\n${close}`);
  console.log(`inlined ${name} (${code.length} bytes)`);
}
fs.writeFileSync(htmlPath, html);
