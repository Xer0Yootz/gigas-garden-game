// Third-person walk and camera, matching the garden controls:
// WASD and arrows, speed 0.16 per 60fps frame, camera 3.9 m up and 7.4 m back,
// one-finger orbit, pinch zoom, move stick on touch.

export function createWalker(THREE, opts) {
  const speed = opts.speed == null ? 0.16 : opts.speed;
  const radius = opts.radius == null ? 0.28 : opts.radius;
  const keys = {};
  const moveInput = { x: 0, z: 0 };
  let enabled = opts.enabled !== false;
  const group = new THREE.Group();
  group.name = 'player';
  const spawn = opts.spawn || { x: 1, z: 1 };
  group.position.set(spawn.x, 0, spawn.z);
  opts.scene.add(group);

  const CAM_BASE_EL = Math.atan2(2.3, 7.4);
  const CAM_BASE_LEN = Math.hypot(2.3, 7.4);
  const cam = { yaw: 0, el: CAM_BASE_EL, zoom: 1 };
  const goal = new THREE.Vector3();

  function bounds() {
    return opts.getBounds ? opts.getBounds() : { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity };
  }

  function hit(x, z) {
    const b = bounds();
    if (x < b.minX + radius || x > b.maxX - radius || z < b.minZ + radius || z > b.maxZ - radius) return true;
    const boxes = opts.getBlockers ? opts.getBlockers() : [];
    for (const box of boxes) {
      if (x > box.minX - radius && x < box.maxX + radius && z > box.minZ - radius && z < box.maxZ + radius) return true;
    }
    return false;
  }

  function place(x, z) {
    const b = bounds();
    group.position.x = THREE.MathUtils.clamp(x, b.minX + radius, b.maxX - radius);
    group.position.z = THREE.MathUtils.clamp(z, b.minZ + radius, b.maxZ - radius);
    if (hit(group.position.x, group.position.z)) {
      group.position.x = b.minX + radius + 0.05;
      group.position.z = b.minZ + radius + 0.05;
    }
    snapCamera();
  }

  function snapCamera() {
    const fx = Math.sin(cam.yaw);
    const fz = Math.cos(cam.yaw);
    const len = CAM_BASE_LEN * cam.zoom;
    const ce = Math.cos(cam.el);
    const se = Math.sin(cam.el);
    goal.set(
      group.position.x - fx * ce * len,
      Math.max(0.4, 1.6 + se * len),
      group.position.z - fz * ce * len
    );
    opts.camera.position.copy(goal);
    opts.camera.lookAt(
      group.position.x + fx * 6 * Math.min(cam.zoom, 1),
      1.6,
      group.position.z + fz * 6 * Math.min(cam.zoom, 1)
    );
  }

  function onKeyDown(e) {
    if (!enabled) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD' || e.code.startsWith('Arrow')) {
      keys[e.code] = true;
      e.preventDefault();
    }
  }
  function onKeyUp(e) { keys[e.code] = false; }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const root = document.createElement('div');
  root.id = 'nv-walk-touch';
  root.innerHTML = '<div id="nv-stick" role="application" aria-label="Move"><div id="nv-stick-knob"></div></div><button id="nv-cam-reset" type="button" aria-label="Reset camera"></button>';
  document.body.appendChild(root);
  const style = document.createElement('style');
  style.textContent = `
    #nv-walk-touch { display: none; }
    html.nv-touch-ui #nv-walk-touch { display: block; }
    #nv-stick {
      position: fixed; z-index: 12; left: 16px; bottom: 96px; width: 116px; height: 116px; border-radius: 50%;
      background: rgba(7,3,12,0.55); border: 2px solid #00f0ff; touch-action: none;
    }
    #nv-stick-knob {
      position: absolute; left: 50%; top: 50%; width: 50px; height: 50px; margin: -25px 0 0 -25px;
      border-radius: 50%; background: rgba(20,8,36,0.9); border: 2px solid #ff1e8a; pointer-events: none;
    }
    #nv-cam-reset {
      position: fixed; z-index: 12; right: 16px; bottom: 96px; width: 44px; height: 44px; border-radius: 50%;
      background: rgba(7,3,12,0.8); border: 2px solid #00f0ff; color: #00f0ff;
    }
  `;
  document.head.appendChild(style);

  const stick = root.querySelector('#nv-stick');
  const knob = root.querySelector('#nv-stick-knob');
  const STICK_R = 42;
  let stickId = null;
  let sx = 0;
  let sy = 0;
  function stickSet(clientX, clientY) {
    let ox = clientX - sx;
    let oy = clientY - sy;
    const d = Math.hypot(ox, oy);
    if (d > STICK_R) { ox *= STICK_R / d; oy *= STICK_R / d; }
    knob.style.transform = 'translate(' + ox + 'px,' + oy + 'px)';
    let nx = ox / STICK_R;
    let ny = oy / STICK_R;
    if (Math.hypot(nx, ny) < 0.12) { nx = 0; ny = 0; }
    moveInput.x = nx;
    moveInput.z = ny;
  }
  function stickEnd(e) {
    if (e.pointerId !== stickId) return;
    stickId = null;
    knob.style.transform = '';
    moveInput.x = 0;
    moveInput.z = 0;
  }
  stick.addEventListener('pointerdown', (e) => {
    if (!enabled || stickId !== null) return;
    e.preventDefault();
    stickId = e.pointerId;
    const r = stick.getBoundingClientRect();
    sx = r.left + r.width / 2;
    sy = r.top + r.height / 2;
    stickSet(e.clientX, e.clientY);
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickSet(e.clientX, e.clientY); });
  stick.addEventListener('pointerup', stickEnd);
  stick.addEventListener('pointercancel', stickEnd);
  root.querySelector('#nv-cam-reset').addEventListener('click', () => {
    cam.yaw = 0; cam.el = CAM_BASE_EL; cam.zoom = 1;
  });

  const el = opts.domElement;
  const pts = new Map();
  let gesture = null;
  el.addEventListener('pointerdown', (e) => {
    if (!enabled || e.pointerType !== 'touch') return;
    document.documentElement.classList.add('nv-touch-ui');
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) {
      const p = [...pts.values()][0];
      gesture = { mode: 'orbit', x0: p.x, y0: p.y, lx: p.x, ly: p.y, moved: false };
    } else if (pts.size >= 2) {
      const a = [...pts.values()];
      gesture = { mode: 'two', pinchD: Math.max(Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), 1) };
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (!enabled || !pts.has(e.pointerId) || !gesture) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.mode === 'orbit' && pts.size === 1) {
      if (Math.hypot(e.clientX - gesture.x0, e.clientY - gesture.y0) > 8) gesture.moved = true;
      const ddx = e.clientX - gesture.lx;
      const ddy = e.clientY - gesture.ly;
      gesture.lx = e.clientX;
      gesture.ly = e.clientY;
      if (gesture.moved) {
        cam.yaw -= ddx * 0.0065;
        cam.el = THREE.MathUtils.clamp(cam.el + ddy * 0.0065, -0.35, 1.35);
      }
    } else if (gesture.mode === 'two' && pts.size >= 2) {
      const a = [...pts.values()];
      const d = Math.max(Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), 1);
      cam.zoom = THREE.MathUtils.clamp(cam.zoom * (gesture.pinchD / d), 0.15, 2.4);
      gesture.pinchD = d;
    }
  });
  function endPointer(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size === 0) gesture = null;
  }
  el.addEventListener('pointerup', endPointer);
  el.addEventListener('pointercancel', endPointer);
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') document.documentElement.classList.add('nv-touch-ui');
  }, true);

  function update(dt) {
    if (!enabled) return;
    const step = (Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 1 / 60) / (1 / 60);
    let dx = moveInput.x;
    let dz = moveInput.z;
    if (keys.ArrowUp || keys.KeyW) dz = -1;
    if (keys.ArrowDown || keys.KeyS) dz = 1;
    if (keys.ArrowLeft || keys.KeyA) dx = -1;
    if (keys.ArrowRight || keys.KeyD) dx = 1;
    if (cam.yaw !== 0 && (dx || dz)) {
      const fwd = -dz;
      const rt = dx;
      const sy = Math.sin(cam.yaw);
      const cy = Math.cos(cam.yaw);
      const vx = fwd * sy - rt * cy;
      const vz = fwd * cy + rt * sy;
      dx = -vx;
      dz = -vz;
    }
    const len = Math.hypot(dx, dz);
    if (len > 0) {
      const mx = (dx / len) * speed * step;
      const mz = -(dz / len) * speed * step;
      const nx = group.position.x + mx;
      const nz = group.position.z + mz;
      if (!hit(nx, group.position.z)) group.position.x = nx;
      if (!hit(group.position.x, nz)) group.position.z = nz;
      group.rotation.y = Math.atan2(mx, mz);
    }
    const fx = Math.sin(cam.yaw);
    const fz = Math.cos(cam.yaw);
    const dist = CAM_BASE_LEN * cam.zoom;
    const ce = Math.cos(cam.el);
    const se = Math.sin(cam.el);
    goal.set(
      group.position.x - fx * ce * dist,
      Math.max(0.4, 1.6 + se * dist),
      group.position.z - fz * ce * dist
    );
    opts.camera.position.lerp(goal, 0.18);
    opts.camera.lookAt(
      group.position.x + fx * 6 * Math.min(cam.zoom, 1),
      1.6,
      group.position.z + fz * 6 * Math.min(cam.zoom, 1)
    );
  }

  function setEnabled(on) {
    enabled = !!on;
    group.visible = enabled;
    root.hidden = !enabled;
    if (!enabled) {
      for (const k of Object.keys(keys)) keys[k] = false;
      moveInput.x = 0;
      moveInput.z = 0;
    } else snapCamera();
  }

  setEnabled(enabled);
  return { group, update, setEnabled, place, snapCamera, keys, moveInput };
}
