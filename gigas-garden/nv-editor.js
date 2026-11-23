// Edit mode. Loaded only when the page URL has ?edit=1.
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './nv-layout.js';

const SNAP_MOVE = 0.5;
const SNAP_ROTATE = 15 * Math.PI / 180;
const SNAP_SCALE = 0.1;

function icon(path) {
  return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}"/></svg>`;
}

const ICONS = {
  move: icon('M8 1.5v13M8 1.5L5.5 4M8 1.5L10.5 4M8 14.5L5.5 12M8 14.5L10.5 12M1.5 8h13M1.5 8L4 5.5M1.5 8L4 10.5M14.5 8L12 5.5M14.5 8L12 10.5'),
  rotate: icon('M12.5 6.5A4.5 4.5 0 1 0 13 9M12.5 3.5v3h-3'),
  scale: icon('M3 13L13 3M9.5 3H13v3.5M3 9.5V13h3.5'),
  snap: icon('M3 8h4l1.2-2.2L9.5 10 11 8h2'),
  world: icon('M8 2.2a5.8 5.8 0 1 0 0 11.6 5.8 5.8 0 0 0 0-11.6M2.4 8h11.2M8 2.3c1.6 1.6 2.4 3.5 2.4 5.7s-.8 4.1-2.4 5.7c-1.6-1.6-2.4-3.5-2.4-5.7s.8-4.1 2.4-5.7'),
  focus: icon('M6 2.5H2.5V6M10 2.5h3.5V6M6 13.5H2.5V10M10 13.5h3.5V10M8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6'),
  undo: icon('M6 4H2.5v3.5M3 7.2A5 5 0 1 1 3.4 11'),
  redo: icon('M10 4h3.5v3.5M13 7.2A5 5 0 1 0 12.6 11'),
  save: icon('M3 2.5h8l2.5 2.5V13.5H3zM5 2.5V6h5M5 13.5v-3.5h6v3.5'),
  export: icon('M8 2.5v7M5.2 6.8L8 9.5l2.8-2.7M3 12.5h10'),
  import: icon('M8 9.5v-7M5.2 5.2L8 2.5l2.8 2.7M3 12.5h10'),
  add: icon('M8 2.5v11M2.5 8h11'),
  revert: icon('M3 8a5 5 0 1 0 1.2-3.3M3 2.8v2.6h2.6'),
};

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (value != null) node.setAttribute(key, value);
    }
  }
  for (const child of children || []) node.append(child);
  return node;
}

function button(id, name, label, extraClass) {
  return el('button', {
    type: 'button',
    id,
    class: extraClass || '',
    title: label,
    'aria-label': label,
    html: ICONS[name] || '',
  });
}

function returnUrl() {
  const url = new URL(location.href);
  url.hash = '';
  for (const key of ['code', 'state', 'error', 'error_code', 'error_description']) url.searchParams.delete(key);
  return url.toString();
}

function client() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
}

export async function mountEditor(ctx) {
  const root = el('div', { id: 'nv-editor' });
  const auth = el('div', { id: 'nv-auth' });
  const google = el('button', { type: 'button', id: 'nv-sign-google', title: 'Google', 'aria-label': 'Sign in with Google' });
  google.append(el('span', { class: 'nv-mark', text: 'G' }), document.createTextNode(' Google'));
  const github = el('button', { type: 'button', id: 'nv-sign-github', title: 'GitHub', 'aria-label': 'Sign in with GitHub' });
  github.append(el('span', { class: 'nv-mark', text: 'GH' }), document.createTextNode(' GitHub'));
  auth.append(google, github);
  const viewOnly = el('div', { id: 'nv-viewonly', hidden: '', text: 'View only' });
  const tools = el('div', { id: 'nv-tools', hidden: '' });
  root.append(auth, viewOnly, tools);
  document.body.appendChild(root);
  ensureStyle();

  const supabase = client();
  let toolsMounted = false;

  async function signIn(provider) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: returnUrl() },
    });
    if (error) toast(root, 'sign-in failed');
  }
  google.addEventListener('click', () => { signIn('google'); });
  github.addEventListener('click', () => { signIn('github'); });

  async function refresh() {
    let session = null;
    try {
      const got = await supabase.auth.getSession();
      session = got.data && got.data.session;
    } catch {
      session = null;
    }
    if (!session) {
      auth.hidden = false;
      viewOnly.hidden = true;
      tools.hidden = true;
      return;
    }
    let allowed = false;
    try {
      const rpc = await supabase.rpc('is_world_editor');
      allowed = rpc.data === true && !rpc.error;
    } catch {
      allowed = false;
    }
    if (!allowed) {
      auth.hidden = true;
      viewOnly.hidden = false;
      tools.hidden = true;
      return;
    }
    auth.hidden = true;
    viewOnly.hidden = true;
    tools.hidden = false;
    if (!toolsMounted) {
      toolsMounted = true;
      mountEditorTools(ctx, { supabase, tools, root });
    }
  }

  supabase.auth.onAuthStateChange(() => { refresh(); });
  await refresh();
}

export function mountEditorTools(ctx, ui = {}) {
  const { zone, host, THREE, camera, renderer, scene, controls, manifestUrl } = ctx;
  const tools = ui.tools || document.getElementById('nv-tools');
  const root = ui.root || document.getElementById('nv-editor');
  if (!tools || !root || tools.dataset.ready === '1') return;
  tools.dataset.ready = '1';
  tools.hidden = false;
  const auth = document.getElementById('nv-auth');
  const viewOnly = document.getElementById('nv-viewonly');
  if (auth) auth.hidden = true;
  if (viewOnly) viewOnly.hidden = true;
  ensureStyle();
  const supabase = ui.supabase || client();

  const transform = new TransformControls(camera, renderer.domElement);
  transform.setMode('translate');
  transform.setSpace('local');
  transform.setSize(1.15);
  scene.add(transform);

  const toolbar = el('div', { class: 'nv-bar' });
  const move = button('nv-move', 'move', 'Move (W)');
  const rotate = button('nv-rotate', 'rotate', 'Rotate (E)');
  const scale = button('nv-scale', 'scale', 'Scale (R)');
  const snap = button('nv-snap', 'snap', 'Snap 0.5 m / 15°');
  const space = button('nv-space', 'world', 'Local or world');
  const focus = button('nv-focus', 'focus', 'Focus (F)');
  const undoBtn = button('nv-undo', 'undo', 'Undo');
  const redoBtn = button('nv-redo', 'redo', 'Redo');
  const saveBtn = button('nv-save', 'save', 'Save');
  const exportBtn = button('nv-export', 'export', 'Export layout JSON');
  const importBtn = button('nv-import-btn', 'import', 'Import layout JSON');
  const fileInput = el('input', { id: 'nv-import', type: 'file', accept: 'application/json,.json', hidden: '' });
  toolbar.append(move, rotate, scale, snap, space, focus, undoBtn, redoBtn, saveBtn, exportBtn, importBtn, fileInput);

  const revertBtn = el('button', { type: 'button', id: 'nv-revert', class: 'nv-text', text: 'Revert to previous save' });
  const addRow = el('div', { class: 'nv-add' });
  const addSelect = el('select', { id: 'nv-add-select', 'aria-label': 'Add model' });
  const addBtn = button('nv-add', 'add', 'Add model');
  addRow.append(addSelect, addBtn);

  const outliner = el('ul', { id: 'nv-outliner' });
  const anim = el('div', { id: 'nv-anim', hidden: '' });
  const clipSelect = el('select', { id: 'nv-clip', 'aria-label': 'Clip' });
  const playBtn = el('button', { type: 'button', id: 'nv-play', title: 'Play', 'aria-label': 'Play', text: 'Play' });
  const pauseBtn = el('button', { type: 'button', id: 'nv-pause', title: 'Pause', 'aria-label': 'Pause', text: 'Pause' });
  const loopLabel = el('label', { class: 'nv-loop', text: 'Loop' });
  const loopInput = el('input', { id: 'nv-loop', type: 'checkbox' });
  loopLabel.prepend(loopInput);
  const scrub = el('input', { id: 'nv-scrub', type: 'range', min: '0', max: '1', step: '0.01', value: '0', 'aria-label': 'Time' });
  anim.append(clipSelect, playBtn, pauseBtn, loopLabel, scrub);

  tools.append(toolbar, revertBtn, addRow, outliner, anim);

  let selected = null;
  let snapOn = false;
  let localSpace = true;
  let before = null;
  const undoStack = [];
  const redoStack = [];
  let ignorePointer = false;

  function setPressed() {
    move.setAttribute('aria-pressed', transform.mode === 'translate' ? 'true' : 'false');
    rotate.setAttribute('aria-pressed', transform.mode === 'rotate' ? 'true' : 'false');
    scale.setAttribute('aria-pressed', transform.mode === 'scale' ? 'true' : 'false');
    snap.setAttribute('aria-pressed', snapOn ? 'true' : 'false');
    space.setAttribute('aria-pressed', localSpace ? 'false' : 'true');
    space.title = localSpace ? 'Local space' : 'World space';
  }

  function applySnap() {
    transform.setTranslationSnap(snapOn ? SNAP_MOVE : null);
    transform.setRotationSnap(snapOn ? SNAP_ROTATE : null);
    transform.setScaleSnap(snapOn ? SNAP_SCALE : null);
  }

  function pushUndo() {
    undoStack.push(JSON.stringify(host.serialize()));
    if (undoStack.length > 60) undoStack.shift();
    redoStack.length = 0;
  }

  function commitUndo(previous) {
    const now = JSON.stringify(host.serialize());
    if (previous && previous !== now) {
      undoStack.push(previous);
      if (undoStack.length > 60) undoStack.shift();
      redoStack.length = 0;
    }
  }

  function rebuild() {
    outliner.replaceChildren();
    for (const key of host.registry.keys()) {
      const entry = host.registry.get(key);
      const item = el('li');
      const pick = el('button', { type: 'button', class: 'nv-key', text: key });
      pick.addEventListener('click', () => select(key));
      item.append(pick);
      if (entry.localPreview) item.append(el('span', { class: 'nv-local', text: 'local preview only' }));
      if (key === (selected && selected.key)) item.classList.add('is-on');
      outliner.append(item);
    }
    fillAnim();
  }

  function fillAnim() {
    const clips = selected && selected.clips ? selected.clips : [];
    if (!selected || !clips.length) {
      anim.hidden = true;
      return;
    }
    anim.hidden = false;
    const previous = clipSelect.value;
    clipSelect.replaceChildren();
    for (const clip of clips) clipSelect.append(el('option', { value: clip.name, text: clip.name }));
    const name = selected.clip || previous || clips[0].name;
    clipSelect.value = clips.some((clip) => clip.name === name) ? name : clips[0].name;
    loopInput.checked = selected.loop !== false;
    const clip = clips.find((item) => item.name === clipSelect.value);
    scrub.max = String(clip && clip.duration ? clip.duration : 1);
    scrub.value = selected.action ? String(selected.action.time || 0) : '0';
  }

  function select(key) {
    const entry = host.registry.get(key);
    if (!entry) return;
    selected = entry;
    transform.attach(entry.object);
    rebuild();
    setPressed();
  }

  function deselect() {
    selected = null;
    transform.detach();
    rebuild();
  }

  function focusSelection() {
    if (!selected) return;
    const box = new THREE.Box3().setFromObject(selected.object);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 1);
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(1, 0.45, 1);
    dir.normalize().multiplyScalar(radius * 2.4);
    controls.target.copy(center);
    camera.position.copy(center).add(dir);
    controls.update();
  }

  function findKey(object) {
    let node = object;
    while (node) {
      if (node.userData && node.userData.nvKey && host.registry.has(node.userData.nvKey)) return node.userData.nvKey;
      node = node.parent;
    }
    return null;
  }

  function isGizmo(object) {
    let node = object;
    while (node) {
      if (node === transform) return true;
      node = node.parent;
    }
    return false;
  }

  async function restore(json) {
    let doc = null;
    try { doc = JSON.parse(json); } catch { return; }
    const keep = selected && selected.key;
    await host.applyLayout(doc, { replaceAdded: true });
    if (keep && host.registry.has(keep)) select(keep);
    else deselect();
  }

  async function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(host.serialize()));
    await restore(undoStack.pop());
  }

  async function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(host.serialize()));
    await restore(redoStack.pop());
  }

  function useClip(play) {
    if (!selected) return;
    pushUndo();
    const name = clipSelect.value;
    selected.loop = loopInput.checked;
    host.setClip(selected.key, name, selected.loop);
    if (selected.action) {
      selected.action.paused = !play;
      if (play) selected.action.play();
    }
    fillAnim();
  }

  async function save() {
    let session = null;
    try {
      const got = await supabase.auth.getSession();
      session = got.data && got.data.session;
    } catch {
      session = null;
    }
    if (!session) {
      toast(root, 'sign in');
      return;
    }
    let allowed = false;
    try {
      const rpc = await supabase.rpc('is_world_editor');
      allowed = rpc.data === true && !rpc.error;
    } catch {
      allowed = false;
    }
    if (!allowed) {
      toast(root, 'View only');
      return;
    }
    const layout = host.serialize();
    const saved = await supabase.from('world_layouts').upsert({ zone, layout }, { onConflict: 'zone' });
    if (saved.error) {
      toast(root, 'save failed');
      return;
    }
    const read = await supabase.from('world_layouts').select('version').eq('zone', zone).maybeSingle();
    const version = read.data && Number.isFinite(read.data.version) ? read.data.version : 1;
    toast(root, 'saved v' + version);
  }

  async function revert() {
    const read = await supabase.from('world_layout_history').select('layout').eq('zone', zone).order('id', { ascending: false }).limit(1).maybeSingle();
    if (read.error || !read.data || !read.data.layout) {
      toast(root, 'no previous save');
      return;
    }
    const saved = await supabase.from('world_layouts').upsert({ zone, layout: read.data.layout }, { onConflict: 'zone' });
    if (saved.error) {
      toast(root, 'revert failed');
      return;
    }
    await host.applyLayout(read.data.layout, { replaceAdded: true });
    deselect();
    const versionRead = await supabase.from('world_layouts').select('version').eq('zone', zone).maybeSingle();
    const version = versionRead.data && Number.isFinite(versionRead.data.version) ? versionRead.data.version : '';
    toast(root, version === '' ? 'reverted' : 'saved v' + version);
  }

  function exportLayout() {
    const blob = new Blob([JSON.stringify(host.serialize(), null, 2)], { type: 'application/json' });
    const link = el('a', { href: URL.createObjectURL(blob), download: zone + '-layout.json' });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function importFile(file) {
    let doc = null;
    try { doc = JSON.parse(await file.text()); } catch { toast(root, 'import failed'); return; }
    if (!doc || typeof doc !== 'object' || (!doc.objects && !doc.added)) {
      toast(root, 'import failed');
      return;
    }
    pushUndo();
    try {
      await host.applyLayout(doc, { replaceAdded: true });
      deselect();
      toast(root, 'imported');
    } catch {
      toast(root, 'import failed');
    }
  }

  async function addFromManifest() {
    const file = addSelect.value;
    if (!file) return;
    let n = 0;
    while (host.registry.has(file + '#' + n)) n += 1;
    const key = file + '#' + n;
    pushUndo();
    try {
      const gltf = await host.loadGltf('./assets/' + file);
      const rootObject = gltf.scene;
      scene.add(rootObject);
      host.register(key, rootObject, {
        file,
        clips: gltf.animations || [],
        mixerRoot: rootObject,
        added: true,
      });
      select(key);
    } catch {
      toast(root, 'add failed');
    }
  }

  async function addLocal(file) {
    const url = URL.createObjectURL(file);
    let n = 1;
    while (host.registry.has('local-' + n)) n += 1;
    const key = 'local-' + n;
    try {
      const gltf = await host.loadGltf(url);
      const rootObject = gltf.scene;
      scene.add(rootObject);
      host.register(key, rootObject, {
        file: file.name,
        clips: gltf.animations || [],
        mixerRoot: rootObject,
        localPreview: true,
      });
      select(key);
    } catch {
      toast(root, 'preview failed');
    }
  }

  move.addEventListener('click', () => { transform.setMode('translate'); setPressed(); });
  rotate.addEventListener('click', () => { transform.setMode('rotate'); setPressed(); });
  scale.addEventListener('click', () => { transform.setMode('scale'); setPressed(); });
  snap.addEventListener('click', () => { snapOn = !snapOn; applySnap(); setPressed(); });
  space.addEventListener('click', () => {
    localSpace = !localSpace;
    transform.setSpace(localSpace ? 'local' : 'world');
    setPressed();
  });
  focus.addEventListener('click', focusSelection);
  undoBtn.addEventListener('click', () => { undo(); });
  redoBtn.addEventListener('click', () => { redo(); });
  saveBtn.addEventListener('click', () => { save(); });
  exportBtn.addEventListener('click', exportLayout);
  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (file) importFile(file);
  });
  revertBtn.addEventListener('click', () => { revert(); });
  addBtn.addEventListener('click', () => { addFromManifest(); });
  playBtn.addEventListener('click', () => useClip(true));
  pauseBtn.addEventListener('click', () => {
    if (selected && selected.action) selected.action.paused = true;
  });
  loopInput.addEventListener('change', () => useClip(true));
  clipSelect.addEventListener('change', () => useClip(true));
  scrub.addEventListener('input', () => {
    if (!selected || !selected.action) return;
    selected.action.paused = true;
    selected.action.time = Number(scrub.value) || 0;
    if (selected.mixer) selected.mixer.update(0);
  });

  transform.addEventListener('dragging-changed', (event) => {
    controls.enabled = !event.value;
  });
  transform.addEventListener('mouseDown', () => {
    ignorePointer = true;
    before = JSON.stringify(host.serialize());
  });
  transform.addEventListener('mouseUp', () => {
    commitUndo(before);
    before = null;
    setTimeout(() => { ignorePointer = false; }, 0);
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    down = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!down || ignorePointer || transform.dragging) {
      down = null;
      return;
    }
    const dx = event.clientX - down.x;
    const dy = event.clientY - down.y;
    down = null;
    if (dx * dx + dy * dy > 16) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const hit of hits) {
      if (isGizmo(hit.object)) return;
      const key = findKey(hit.object);
      if (key) {
        select(key);
        return;
      }
    }
    deselect();
  });

  window.addEventListener('keydown', (event) => {
    const tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (event.metaKey || event.ctrlKey) {
      if (event.code === 'KeyZ' && event.shiftKey) { event.preventDefault(); redo(); }
      else if (event.code === 'KeyZ') { event.preventDefault(); undo(); }
      else if (event.code === 'KeyS') { event.preventDefault(); save(); }
      return;
    }
    if (event.code === 'KeyW') { transform.setMode('translate'); setPressed(); }
    else if (event.code === 'KeyE') { transform.setMode('rotate'); setPressed(); }
    else if (event.code === 'KeyR') { transform.setMode('scale'); setPressed(); }
    else if (event.code === 'Escape') deselect();
    else if (event.code === 'KeyF') focusSelection();
  });

  window.addEventListener('dragover', (event) => {
    const items = event.dataTransfer && event.dataTransfer.items ? [...event.dataTransfer.items] : [];
    if (!items.some((item) => item.kind === 'file')) return;
    event.preventDefault();
  });
  window.addEventListener('drop', (event) => {
    const files = event.dataTransfer && event.dataTransfer.files ? [...event.dataTransfer.files] : [];
    const file = files.find((item) => item.name.toLowerCase().endsWith('.glb'));
    if (!file) return;
    event.preventDefault();
    addLocal(file);
  });

  host.onChange = rebuild;
  fetch(manifestUrl).then((res) => res.ok ? res.json() : []).then((list) => {
    const files = Array.isArray(list) ? list.filter((name) => typeof name === 'string' && name.endsWith('.glb')) : [];
    addSelect.replaceChildren();
    if (!files.length) addSelect.append(el('option', { value: '', text: 'No models' }));
    for (const name of files) addSelect.append(el('option', { value: name, text: name }));
  }).catch(() => {
    addSelect.replaceChildren(el('option', { value: '', text: 'No models' }));
  });

  setPressed();
  rebuild();
}

function ensureStyle() {
  if (document.getElementById('nv-editor-style')) return;
  const style = document.createElement('style');
  style.id = 'nv-editor-style';
  style.textContent = `
    #nv-editor {
      position: fixed; top: 12px; right: 12px; z-index: 40;
      width: min(320px, calc(100vw - 24px));
      font-family: "Courier New", Courier, monospace;
      color: #19e3ff; background: rgba(2, 8, 12, 0.88);
      border: 1px solid rgba(255, 94, 138, 0.7);
      box-shadow: 0 0 0 1px rgba(25, 227, 255, 0.18) inset;
      padding: 8px; display: grid; gap: 8px;
    }
    #nv-editor button, #nv-editor select, #nv-editor input[type="range"] {
      font: inherit; color: #19e3ff; background: #07030d;
      border: 1px solid rgba(25, 227, 255, 0.45);
    }
    #nv-editor button { width: 28px; height: 28px; padding: 4px; display: inline-grid; place-items: center; cursor: pointer; }
    #nv-editor button[aria-pressed="true"] { color: #ffd7e8; border-color: #ff5e8a; }
    #nv-editor button.nv-text, #nv-revert { width: 100%; height: auto; padding: 6px 8px; text-align: left; }
    #nv-editor svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: square; stroke-linejoin: miter; }
    #nv-auth, .nv-bar, .nv-add, #nv-anim { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
    #nv-sign-google, #nv-sign-github { width: auto; padding: 6px 8px; }
    .nv-mark { color: #ff5e8a; margin-right: 4px; }
    #nv-viewonly { color: #ffd7e8; letter-spacing: 0.4px; }
    #nv-add-select, #nv-clip { max-width: 220px; height: 28px; }
    #nv-outliner { list-style: none; margin: 0; padding: 0; max-height: 180px; overflow: auto; display: grid; gap: 3px; }
    #nv-outliner li { display: flex; gap: 6px; align-items: center; }
    #nv-outliner .nv-key { width: auto; height: auto; padding: 3px 6px; text-align: left; overflow: hidden; text-overflow: ellipsis; }
    #nv-outliner li.is-on .nv-key { border-color: #ff5e8a; color: #ffd7e8; }
    .nv-local { color: #ff5e8a; font-size: 10px; }
    #nv-scrub { flex: 1; min-width: 80px; accent-color: #ff5e8a; }
    #nv-loop { display: inline-flex; gap: 4px; align-items: center; color: #ffd7e8; }
    #nv-toast {
      position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
      z-index: 50; padding: 6px 10px; font-family: "Courier New", Courier, monospace;
      color: #e8fbff; background: rgba(2, 8, 12, 0.92); border: 1px solid #19e3ff;
    }
  `;
  document.head.appendChild(style);
}

function toast(root, text) {
  let node = document.getElementById('nv-toast');
  if (!node) {
    node = document.createElement('div');
    node.id = 'nv-toast';
    document.body.appendChild(node);
  }
  node.textContent = text;
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 2200);
  return root;
}
