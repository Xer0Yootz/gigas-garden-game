/**
 * Gigas Garden — code-born ambient life (prototype, not canon).
 * Three.js renderer-agnostic meshes: existing WebGL works today; compatible
 * with a future WebGPU renderer without changing creature behavior.
 * No textures, GLBs, audio, UI, dialogue, or network requests.
 */
export function createGardenLife(THREE, parent, { lite = false } = {}) {
  const root = new THREE.Group();
  root.name = 'GardenLife_Proposed';
  parent.add(root);
  let seed = 5150;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const between = (a, b) => a + rand() * (b - a);
  const palette = {
    pearl: 0xd3cce5, cyan: 0x65e7ee, violet: 0x8c62dc,
    pink: 0xea72b6, teal: 0x458f9d, ink: 0x181020, green: 0x496f5d
  };
  const makeMat = (color, glow = 0) => new THREE.MeshStandardMaterial({
    color, roughness: 0.67, metalness: 0,
    emissive: color, emissiveIntensity: glow, side: THREE.DoubleSide
  });
  const mats = {
    pearl: makeMat(palette.pearl, 0.1), cyan: makeMat(palette.cyan, 0.3),
    violet: makeMat(palette.violet, 0.15), pink: makeMat(palette.pink, 0.2),
    teal: makeMat(palette.teal, 0.12), ink: makeMat(palette.ink),
    green: makeMat(palette.green), sheer: new THREE.MeshBasicMaterial({
      color: palette.pearl, transparent: true, opacity: 0.33,
      side: THREE.DoubleSide, depthWrite: false
    }),
    water: new THREE.MeshBasicMaterial({
      color: 0x183a48, transparent: true, opacity: 0.55,
      depthWrite: false, side: THREE.DoubleSide
    })
  };
  const orb = new THREE.SphereGeometry(1, 8, 6);
  const wingGeo = new THREE.PlaneGeometry(1, 1);
  const cone = new THREE.ConeGeometry(1, 1, 5);
  const mesh = (geo, mat, scale, where) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(...scale);
    if (where) m.position.set(...where);
    return m;
  };
  const entities = [];
  const addEntity = (kind, body, home, radius, speed, phase, updatePart) => {
    body.position.set(...home);
    root.add(body);
    entities.push({ kind, body, home, radius, speed, phase, updatePart });
  };
  const wings = (body, size, mat, angled = false) => {
    const pair = [];
    for (const sign of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sign * size * 0.26, 0.06, 0);
      const w = mesh(wingGeo, mat, [size, size * (angled ? 0.42 : 0.7), 1],
        [sign * size * 0.49, 0, 0]);
      w.rotation.z = sign * (angled ? -0.23 : 0.28);
      pivot.add(w); body.add(pivot); pair.push(pivot);
    }
    return pair;
  };

  // Garden night moths: soft petal wings, bodies, no Swarm insignia.
  for (let i = 0; i < 12; i++) {
    const body = new THREE.Group();
    body.add(mesh(orb, mats.ink, [0.14, 0.21, 0.35]));
    body.add(mesh(orb, mats.cyan, [0.075, 0.08, 0.10], [0, 0.09, -0.26]));
    const pair = wings(body, between(0.56, 0.93), i % 2 ? mats.violet : mats.pink);
    const side = i % 2 ? -1 : 1;
    addEntity('moth', body, [side * between(18.6, 30), between(2, 6), between(5, 65)],
      between(1.2, 4.2), between(0.13, 0.3), rand() * 7,
      (e, t) => { for (let j = 0; j < 2; j++) pair[j].rotation.y = (j ? -1 : 1) * (0.28 + Math.sin(t * 11 + e.phase) * 0.62); });
  }

  // Bird-scale stingless bees are gentle pollen workers, never combat mounts.
  for (let i = 0; i < 10; i++) {
    const body = new THREE.Group();
    body.add(mesh(orb, mats.green, [0.31, 0.25, 0.39]));
    body.add(mesh(orb, mats.pearl, [0.22, 0.2, 0.23], [0, 0.02, -0.32]));
    for (const s of [-1, 1]) body.add(mesh(orb, mats.violet,
      [0.11, 0.14, 0.095], [s * 0.19, -0.04, 0.20]));
    const pair = wings(body, 0.75, mats.sheer, true);
    addEntity('bee', body, [(i % 2 ? -1 : 1) * between(18, 31),
      between(1.6, 4.8), between(7, 64)], 1.65, 0.16, rand() * 8,
      (e, t) => { for (let j = 0; j < 2; j++) pair[j].rotation.z = (j ? -1 : 1) * (0.15 + 0.4 * Math.sin(t * 24 + e.phase)); });
  }

  // New speculative ground fauna: nonverbal moss-mice, neither Swarm nor pets.
  for (let i = 0; i < 8; i++) {
    const body = new THREE.Group();
    body.add(mesh(orb, mats.green, [0.33, 0.31, 0.43], [0, 0.3, 0]));
    body.add(mesh(orb, mats.pearl, [0.18, 0.19, 0.2], [0, 0.4, -0.37]));
    for (const s of [-1, 1]) {
      body.add(mesh(orb, mats.pink, [0.095, 0.13, 0.08], [s * 0.18, 0.54, -0.46]));
      body.add(mesh(orb, mats.ink, [0.035, 0.035, 0.035], [s * 0.1, 0.43, -0.54]));
    }
    const tail = mesh(cone, mats.green, [0.07, 0.38, 0.07], [0, 0.34, 0.55]);
    tail.rotation.x = Math.PI * 0.35; body.add(tail);
    addEntity('mossMouse', body, [(i % 2 ? -1 : 1) * between(21, 31),
      0, between(9, 64)], between(1.1, 3), between(0.28, 0.62), rand() * 9,
      (e, t) => { tail.rotation.z = Math.sin(t * 3 + e.phase) * 0.3; });
  }

  // Proposed tiny tide basin: ordinary water, NOT the First Water pool at x=8,z=38.
  // It is away from the walk and from known interactive locations.
  const pond = new THREE.Group();
  pond.position.set(-27, 0.035, 54);
  const surface = new THREE.Mesh(new THREE.CircleGeometry(4, 32), mats.water);
  surface.rotation.x = -Math.PI / 2;
  surface.scale.y = 0.66;
  pond.add(surface);
  root.add(pond);
  for (let i = 0; i < 9; i++) {
    const body = new THREE.Group();
    body.add(mesh(orb, i % 2 ? mats.cyan : mats.pearl, [0.13, 0.09, 0.32]));
    const tail = mesh(cone, mats.violet, [0.19, 0.25, 0.07], [0, 0, 0.32]);
    tail.rotation.x = Math.PI / 2; body.add(tail);
    addEntity('fish', body, [-27 + between(-2.0, 2.0), -0.13,
      54 + between(-1.0, 1.0)], between(0.55, 1.65), between(0.35, 0.8),
      rand() * Math.PI * 2, (e, t) => { tail.rotation.y = Math.sin(t * 8 + e.phase) * 0.45; });
  }

  // Silhouette gliders, birdlike but neither named castes nor Garden rulers.
  for (let i = 0; i < 7; i++) {
    const body = new THREE.Group();
    body.add(mesh(orb, mats.ink, [0.22, 0.14, 0.55]));
    body.add(mesh(cone, mats.pearl, [0.12, 0.21, 0.1], [0, 0, -0.61]));
    const pair = wings(body, between(1.1, 1.8), mats.violet, true);
    addEntity('skyGlider', body, [(i % 2 ? -1 : 1) * between(7, 26),
      between(9, 17), between(15, 65)], between(5, 12), between(0.11, 0.24),
      rand() * 6, (e, t) => { for (let j = 0; j < 2; j++) pair[j].rotation.z = (j ? -1 : 1) * (0.08 + 0.24 * Math.sin(t * 2.9 + e.phase)); });
  }

  // Established anonymous spirit fauna; drift as weather, do not call anyone.
  for (let i = 0; i < 48; i++) {
    const body = new THREE.Group();
    const size = between(0.07, 0.26);
    body.add(mesh(orb, i % 3 ? mats.cyan : mats.pink, [size, size * 0.8, size]));
    const flagellum = mesh(cone, mats.sheer,
      [size * 0.25, size * 1.9, size * 0.22], [0, -size * 1.25, 0]);
    flagellum.rotation.x = Math.PI; body.add(flagellum);
    addEntity('spirit', body, [between(-31, 31), between(0.5, 7),
      between(4, 70)], between(0.4, 2.1), between(0.055, 0.14),
      rand() * 10, (e, t) => { flagellum.rotation.z = Math.sin(t * 1.6 + e.phase) * 0.24; });
  }

  // Proposed unassigned IA cloud presences. These are VISUAL PLACEHOLDERS,
  // not named HexOS forks, not claimed sentient conversations, no sigils.
  for (let i = 0; i < 4; i++) {
    const body = new THREE.Group();
    for (let j = 0; j < 5; j++) body.add(mesh(orb, j % 2 ? mats.sheer : mats.violet,
      [between(0.2, 0.4), between(0.17, 0.3), between(0.2, 0.42)],
      [between(-0.48, 0.48), between(-0.19, 0.2), between(-0.3, 0.3)]));
    addEntity('cloudIA_proposal', body, [(i % 2 ? -1 : 1) * between(18, 28),
      between(4.8, 8), between(18, 65)], between(2, 6), 0.095,
      rand() * 8, () => {});
  }

  let elapsed = 0;
  function update(dt, { active = true, lite: low = lite } = {}) {
    root.visible = active;
    if (!active) return;
    elapsed += Math.min(Math.max(dt || 0, 0), 0.05);
    const t = elapsed;
    entities.forEach((e, i) => {
      const culled = low && (i % 2 === 0 || e.kind === 'cloudIA_proposal');
      e.body.visible = !culled;
      if (culled) return;
      const a = t * e.speed + e.phase;
      const fish = e.kind === 'fish', mouse = e.kind === 'mossMouse';
      e.body.position.x = e.home[0] + Math.sin(a) * e.radius;
      e.body.position.z = e.home[2] + Math.cos(a * (fish ? 1 : 0.68)) * e.radius * (fish ? 0.45 : 0.55);
      e.body.position.y = mouse ? Math.max(0, Math.sin(t * 9 + e.phase) * 0.045) :
        fish ? e.home[1] - 0.07 * Math.sin(t * 1.7 + e.phase) :
        e.home[1] + Math.sin(t * (e.kind === 'spirit' ? 0.9 : 1.7) + e.phase) * (e.kind === 'skyGlider' ? 0.55 : 0.23);
      e.body.rotation.y = -Math.atan2(Math.cos(a), -Math.sin(a));
      e.updatePart(e, t);
    });
  }
  function dispose() {
    parent.remove(root);
    root.traverse(o => {
      if (o.isMesh && o.geometry && ![orb, wingGeo, cone].includes(o.geometry)) o.geometry.dispose();
    });
    orb.dispose(); wingGeo.dispose(); cone.dispose();
    Object.values(mats).forEach(m => m.dispose());
  }
  return { root, update, dispose, counts: Object.freeze({
    nightMoths: 12, stinglessBees: 10, mossMice: 8,
    fish: 9, skyGliders: 7, spiritFauna: 48, cloudIAProposals: 4
  }) };
}
