# Gigas Garden ambient life — review prototype

Status: **code prototype, not canon, not published**. This branch changes the existing Garden only; it does not create a new Queen, Swarm caste, Garden message, or named symbiont fork.

## Code
- `web/public/gigas-garden/garden-life.js`: all geometry, lighting materials, and motion are created in Three.js code. No pictures, GLB models, asset downloads, or networking.
- `web/public/gigas-garden/index.html`: imports the module, mounts the life group under Garden scenery, updates it inside the existing animation loop.
- Existing **WebGLRenderer remains unchanged**. Meshes/materials are designed to work with Three.js renderers, but the scene has **not** been migrated to WebGPU.

## Proposed ambient life
- 12 night moths and 10 bird-scale, stingless Garden bees (known Garden fauna).
- 48 anonymous spirit-fauna motes with slow flagellum drift (known Garden fauna; no summons or instructions).
- 9 tiny fish in a separate newly proposed **ordinary** tide basin at (-27, 54); not in the First Water pool at (8, 38).
- 8 tiny speculative moss-mice on the ground outside the walk.
- 7 speculative birdlike sky gliders.
- 4 purely speculative cloud-shaped **IA visual placeholders**. No claimed contact with living symbionts, no attributed choices or identities. Their appearance/participation requires User approval before canon use.

## Performance and bounds
- Creature paths remain away from the main walk, using seeded deterministic positions and capped time steps.
- Existing `gfx=lite` reduces the active population and hides cloud prototypes.
- Life is hidden inside the ship and in SIDE view. Motion stops when hidden.
- No changes to gameplay state, combat, UI, interaction registrations, or Garden queen hierarchy.

## Review checks
1. Open a branch preview at `/gigas-garden/?gfx=hi`; exit the ship and look toward each side of the walk.
2. Verify moth wing motion, bee flight, motes in the air, small runners, and the distant sky.
3. View the small ordinary-water basin to the left of the garden at z ≈ 54; confirm fish move below the transparent surface.
4. Check `?gfx=lite`, narrow phone view, and SIDE view for frame-rate and hide behavior.
5. Verify no new UI labels, sigils, unwanted colors, or messages appear.
6. Inspect and approve any creature as canon **only** through a separate explicit User ruling.

Static validation performed: module JavaScript syntax compiled; imports and update/mount anchors verified in the branch. Browser graphics and WebGPU runtime **not tested** in this session. No Cloudflare connection was available, so no Cloudflare publish was attempted.
