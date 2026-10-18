# UK Conquest

A real-time conquest game for 2 to 4 mates on a map of the UK. Drag troops between cities, take the lot.

**Play:** open the page, start a room, and send friends the invite link (or the 4-letter code).

## Controls

- **Drag** from one of your cities to another city to send half its troops.
- **Drag through several** of your cities on the way to chain them: they all send at once.
- Troops can travel through your own cities, but not through anyone else's.
- **Tap** one of your cities to upgrade it (levels 1 to 3). It costs troops from that city: 20 for level 2, 40 for level 3.

## How it's built

- One self-contained `index.html` (game, PeerJS and map data all inline), so it hosts free as a static site.
- Host-authoritative multiplayer over WebRTC via [PeerJS](https://peerjs.com) (MIT), the same setup as Hob Mob:
  the host's browser runs the simulation at 10 Hz, everyone else only sends intents.
- `CONFIG` at the top of `index.html` holds every tuning knob.
- `maps/uk.json` holds city positions, sizes, links and start slots. Edit it, then run `node tools/inline.js`.
  (`tools/build-map.js` generated the first version from latitude and longitude; it won't overwrite the hand-tuned file without `--force`.)
- Tests: `node tests/sim.test.js`
