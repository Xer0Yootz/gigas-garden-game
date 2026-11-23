// Saved zone layout. Always loaded. The editor module is not imported here.

export const SUPABASE_URL = 'https://xlikqzdpctuayyqttdce.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_gQIlogZ4VMNf-lg-uZEntw_M_4ngnsD';

function finiteArray(value, length) {
  if (!Array.isArray(value) || value.length !== length) return null;
  for (let i = 0; i < length; i++) {
    if (typeof value[i] !== 'number' || !Number.isFinite(value[i])) return null;
  }
  return value;
}

function capture(object) {
  return {
    position: object.position.toArray(),
    quaternion: object.quaternion.toArray(),
    scale: object.scale.toArray(),
    visible: object.visible !== false,
  };
}

function applyTransform(object, spec) {
  if (!object || !spec || typeof spec !== 'object') return;
  const position = finiteArray(spec.position, 3);
  const quaternion = finiteArray(spec.quaternion, 4);
  const scale = finiteArray(spec.scale, 3);
  if (position) object.position.fromArray(position);
  if (quaternion) object.quaternion.fromArray(quaternion);
  if (scale) object.scale.fromArray(scale);
  if (typeof spec.visible === 'boolean') object.visible = spec.visible;
}

function normalize(layout) {
  const src = layout && typeof layout === 'object' ? layout : {};
  const objects = src.objects && typeof src.objects === 'object' && !Array.isArray(src.objects) ? src.objects : {};
  const added = Array.isArray(src.added) ? src.added.filter((item) => item && typeof item === 'object') : [];
  return { objects, added };
}

export function createLayoutHost(THREE) {
  const registry = new Map();
  const mixers = [];
  let current = { objects: {}, added: [] };
  let deps = null;
  let loaderPromise = null;

  function sharedLoader() {
    if (!loaderPromise) {
      loaderPromise = (async () => {
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        return loader;
      })();
    }
    return loaderPromise;
  }

  function loadGltf(url) {
    return sharedLoader().then((loader) => new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    }));
  }

  function ensureMixer(entry) {
    if (!THREE || !entry.clips || !entry.clips.length) return null;
    if (!entry.mixer) {
      entry.mixer = new THREE.AnimationMixer(entry.mixerRoot || entry.object);
      mixers.push(entry.mixer);
    }
    return entry.mixer;
  }

  function applyClip(entry, spec) {
    if (!spec || typeof spec.clip !== 'string' || !spec.clip) return;
    const clip = (entry.clips || []).find((item) => item && item.name === spec.clip);
    if (!clip) return;
    const mixer = ensureMixer(entry);
    if (!mixer) return;
    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    const loop = spec.loop !== false;
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.reset();
    action.play();
    entry.clip = spec.clip;
    entry.loop = loop;
    entry.action = action;
  }

  function register(key, object, info = {}) {
    const entry = {
      key,
      object,
      file: info.file || '',
      clips: info.clips || [],
      mixerRoot: info.mixerRoot || object,
      added: !!info.added,
      localPreview: !!info.localPreview,
      mixer: null,
      action: null,
      clip: null,
      loop: true,
      defaults: capture(object),
    };
    object.userData.nvKey = key;
    registry.set(key, entry);
    const spec = !entry.added && current.objects ? current.objects[key] : null;
    if (spec) {
      applyTransform(object, spec);
      applyClip(entry, spec);
    }
    if (typeof host.onChange === 'function') host.onChange();
    return entry;
  }

  function bindClips(key, clips, mixerRoot) {
    const entry = registry.get(key);
    if (!entry) return;
    entry.clips = clips || [];
    if (mixerRoot) entry.mixerRoot = mixerRoot;
    const spec = current.objects && current.objects[key];
    if (spec) applyClip(entry, spec);
  }

  function setClip(key, name, loop) {
    const entry = registry.get(key);
    if (!entry) return;
    applyClip(entry, { clip: name, loop });
  }

  function serialize() {
    const objects = {};
    const added = [];
    for (const entry of registry.values()) {
      if (entry.localPreview) continue;
      const data = { file: entry.file, ...capture(entry.object) };
      if (entry.clip) {
        data.clip = entry.clip;
        data.loop = entry.loop !== false;
      }
      if (entry.added) added.push({ key: entry.key, ...data });
      else objects[entry.key] = data;
    }
    return { objects, added };
  }

  async function spawnOne(item) {
    if (!deps || !deps.scene || !item || item.localPreview) return;
    const key = typeof item.key === 'string' ? item.key : '';
    const file = typeof item.file === 'string' ? item.file : '';
    if (!key || !file || file.includes('/') || file.includes('\\') || !file.endsWith('.glb')) return;
    let entry = registry.get(key);
    if (!entry) {
      try {
        const gltf = await loadGltf('./assets/' + file);
        const root = gltf.scene;
        deps.scene.add(root);
        entry = register(key, root, {
          file,
          clips: gltf.animations || [],
          mixerRoot: root,
          added: true,
        });
      } catch {
        return;
      }
    }
    applyTransform(entry.object, item);
    applyClip(entry, item);
  }

  async function applyLayout(layout, { replaceAdded = false } = {}) {
    const doc = normalize(layout);
    current = doc;
    if (replaceAdded) {
      for (const [key, entry] of [...registry.entries()]) {
        if (!entry.added && !entry.localPreview) continue;
        if (entry.object.parent) entry.object.parent.remove(entry.object);
        registry.delete(key);
      }
    }
    for (const [key, spec] of Object.entries(doc.objects)) {
      const entry = registry.get(key);
      if (!entry || entry.added || entry.localPreview) continue;
      applyTransform(entry.object, spec);
      applyClip(entry, spec);
    }
    for (const item of doc.added) {
      await spawnOne(item);
    }
    if (typeof host.onChange === 'function') host.onChange();
  }

  async function fetchLayout(zone) {
    const url = `${SUPABASE_URL}/rest/v1/world_layouts?zone=eq.${encodeURIComponent(zone)}&select=layout,version`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows[0]) return null;
    return rows[0];
  }

  async function load(zone, options) {
    deps = options || deps;
    try {
      const row = await fetchLayout(zone);
      if (row && row.layout && typeof row.layout === 'object') {
        await applyLayout(row.layout, { replaceAdded: false });
      }
    } catch {
      // Keep the hard-coded placement.
    }
  }

  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const step = Math.min(dt, 0.1);
    for (const mixer of mixers) {
      try { mixer.update(step); } catch { /* a bad clip should not stop the shell */ }
    }
  }

  const host = {
    registry,
    register,
    bindClips,
    setClip,
    serialize,
    applyLayout,
    load,
    update,
    loadGltf,
    onChange: null,
    view: null,
  };
  return host;
}

export function openEditor(ctx) {
  if (new URLSearchParams(location.search).get('edit') !== '1') return;
  import('./nv-editor.js').then((mod) => {
    mod.mountEditor(ctx).catch(() => {});
  }).catch(() => {});
}
