// Experimental WebGPU compute module. Not connected to the live game.
// Model Mami / AI Studio integration: call step before the render pass.
// Particle layout: position.xyz, age, velocity.xyz, lifetime (32 bytes).
const shader = `
struct Particle { position: vec3f, age: f32, velocity: vec3f, lifetime: f32 }
struct Params { dt: f32, time: f32, count: u32, pad: u32 }
@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: Params;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= params.count) { return; }
  var p = particles[id.x];
  if (p.age >= p.lifetime) { return; }
  let dt = params.dt;
  let gust = vec3f(sin(p.position.z * 2.0 + params.time), 0.0,
                   cos(p.position.x * 2.0 - params.time)) * 0.35;
  p.velocity = (p.velocity + (gust + vec3f(0.0, -2.4, 0.0)) * dt) * exp(-1.8 * dt);
  p.position += p.velocity * dt;
  if (p.position.y < 0.0) {
    p.position.y = 0.0;
    p.velocity.y = 0.0;
    p.velocity.x *= 0.6;
    p.velocity.z *= 0.6;
  }
  p.age += dt;
  particles[id.x] = p;
}
`;
export function createGardenImpact(device, count = 8192, seed = 5150) {
  if (!Number.isInteger(count) || count < 1 || count > 65536) throw new RangeError("particle count");
  const particles = device.createBuffer({size: count * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
  const params = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
  const pipeline = device.createComputePipeline({layout: "auto", compute: {module: device.createShaderModule({code: shader}), entryPoint: "main"}});
  const bindGroup = device.createBindGroup({layout: pipeline.getBindGroupLayout(0), entries: [{binding:0,resource:{buffer:particles}},{binding:1,resource:{buffer:params}}]});
  let state = seed >>> 0;
  const rand = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const data = new Float32Array(count * 8);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2, speed = 0.5 + rand() * 7, r = rand() * 0.3;
    data.set([Math.cos(a)*r, 0.02, Math.sin(a)*r, 0, Math.cos(a)*speed, 0.4+rand()*4, Math.sin(a)*speed, 2+rand()*5], i*8);
  }
  device.queue.writeBuffer(particles, 0, data);
  const uniform = new ArrayBuffer(16);
  const view = new DataView(uniform);
  view.setUint32(8, count, true);
  let elapsed = 0;
  const smooth = (a,b,x) => {const t = Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t);};
  return {
    particles, count,
    step(encoder, seconds) {
      const dt = Math.max(0, Math.min(seconds, 1/30));
      elapsed += dt;
      view.setFloat32(0, dt, true);
      view.setFloat32(4, elapsed, true);
      device.queue.writeBuffer(params, 0, uniform);
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline); pass.setBindGroup(0,bindGroup);
      pass.dispatchWorkgroups(Math.ceil(count/64)); pass.end();
      return {time:elapsed, cyanIntensity:smooth(1.5,4.5,elapsed), mothVisibility:smooth(3.5,6.5,elapsed)};
    },
    destroy() { particles.destroy(); params.destroy(); }
  };
}
// Submit each encoded step before calling step again.
// Renderer follow-up: instanced soft dust quads, brown earth palette, depth-tested
// against scene geometry, alpha from age/lifetime. Cyan hue stays fixed;
// moths are bird-scale animal meshes, not particles. Keep one camera, no cuts.
// Prototype only: shader and integration require browser GPU validation.
