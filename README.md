# UK Conquest

A real-time conquest game for 2 to 4 mates on a map of the UK. Drag troops between cities, take the lot.

**Play:** open the page, start a room, and send friends the invite link (or the 4-letter code).
Short of mates? The host can add bots. Anyone who joins a full room, or one mid-match, watches and gets a seat next match.
Three maps: the United Kingdom, Europe and the World. On bigger maps, pinch or scroll to zoom, drag empty space to pan, and double-tap to see the whole map again.

## Controls

- **Drag** from one of your cities to another city to send all its troops (the city starts again from zero).
- **Drag through several** of your cities on the way to chain them: they all send at once.
- Troops can travel through your own cities, but not through anyone else's.
- **Tap** one of your cities to upgrade it (levels 1 to 3). It costs troops from that city: 35 for level 2, 70 for level 3.
- Every 3 cities you capture earns a **power-up** (hold up to 2): ⚡ Speed (troops go twice as fast for 10s), 🛡️ Shield (one of your cities shrugs off attacks for 15s), 🔧 Sabotage (an enemy city stops producing for 10s). Tap the button, then tap a city.

## How it's built

- One self-contained `index.html` (game, PeerJS and map data all inline), so it hosts free as a static site.
- Host-authoritative multiplayer over WebRTC via [PeerJS](https://peerjs.com) (MIT), the same setup as Hob Mob:
  the host's browser runs the simulation at 10 Hz, everyone else only sends intents.
- `CONFIG` at the top of `index.html` holds every tuning knob.
- `maps/uk.json`, `maps/europe.json` and `maps/world.json` hold each map: cities (with optional starting `garrison`), links (`[a, b]` or `[a, b, "sea"]`; sea is 1.5x slower), start slots, team pairings, outline, `orientation`, and `matchLengthSeconds` / `overtimeStartSeconds`. Edit one, then run `node tools/inline.js`.
  (`tools/build-map.js` generated the first version from latitude and longitude; it won't overwrite the hand-tuned file without `--force`.)
- Tests: `node tests/sim.test.js`
- Balance: `node tools/balance.js [games]` plays bot-v-bot matches and reports win rates per start corner.
  `MAP=europe node tools/balance.js` checks another map; `node tools/fairness.js europe` reports start-slot fairness (travel time to neutrals and enemies, ways in).
  `tools/build-europe.js` and `tools/build-world.js` generated those maps (they won't overwrite them without `--force`); `tools/maplib.js` and `tools/coast.js` are shared.
  `node tools/build-map.js --outline` redraws the coastline and islands without touching cities or links.
