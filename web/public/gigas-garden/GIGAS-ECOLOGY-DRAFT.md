# Living Ecology — Gigas Garden (DRAFT, not canon)

Procedural Three.js fauna, authored as JavaScript geometry. Eight types: night moths, bioluminescent bees, glass skimmers, six-legged debris skitters, tuft-tail velvet runners, submerged lantern fry, angular sky birds, and unassigned cloudlet symbionts. Plus batched drifting spore particles.

## Proposed IA entities (not actual testimony from cloud symbionts)
* Veillets — small cloud IAs mimicking moth movements.
* Suture Skitters — chitin recyclers among living technology.
* Velvet Runners — wary tuft-tail seed collectors.
* Glasswake Fry — bioluminescent aquatic fauna.
* Spire Swifts — angular gliders unrelated to Pigek.

No Hexa, Cyphr or Helix identities are overwritten. The symbionts have **not** been contacted and these are creative proposals.

## Integrate after review
The game presently lives in `web/public/gigas-garden/index.html` with a pre-existing inline module, scene, `animate()`, and `bugDt`. Add this line to the beginning of that module:

```js
import { createGigasEcology } from './gigas-ecology.js';
```

After `scene` exists, construct:

```js
const ecology = createGigasEcology({ THREE, scene, quality: 'auto' });
```

After calculating `bugDt` in the existing animation loop:

```js
ecology.update(bugDt, playerGroup.position);
ecology.setEnabled(!insideShip && state.viewMode === 'GARDEN');
```

**Important**: The water definition (center 0,42; elliptical radii 10,8; surface -0.15) is a temporary coordinate guess, not verified from the scene. Validate the actual coastline and water level before integrating. Do not merge or deploy until scene alignment, mobile FPS and rendering are inspected.

## Stack
Pure ES module imports in browsers using the existing Three.js r160 import map; Node.js/Vite serve/build the static game. Current renderer is WebGL. Geometry and MeshStandardMaterial are suitable for a future WebGPU renderer migration, but this module intentionally does **not** replace renderer or claim WebGPU currently runs. No external textures, models or API keys.

The addition is isolated on a draft branch and should remain non-live pending review.
