// Everything brief: tracers, muzzle flashes, dust and sparks, blood, explosions, smoke, warning
// rings, and the beacons that stand over objectives. Fed by the events the simulation emits.

import * as THREE from 'three';
import { dotTexture } from './geo.js';

const TRACER_SPEED = 420;
const TRACER_LEN = 14;

class Particles {
  constructor(scene, count, material) {
    this.count = count;
    this.pos = new Float32Array(count * 3).fill(-9999);
    this.col = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.max = new Float32Array(count);
    this.base = new Float32Array(count * 3);
    this.gravity = new Float32Array(count);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
    this.fade = material.blending === THREE.AdditiveBlending;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, r, g, b, gravity = 6) {
    const i = this.next;
    this.next = (this.next + 1) % this.count;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.base[i * 3] = r;
    this.base[i * 3 + 1] = g;
    this.base[i * 3 + 2] = b;
    this.col[i * 3] = r;
    this.col[i * 3 + 1] = g;
    this.col[i * 3 + 2] = b;
    this.life[i] = this.max[i] = life;
    this.gravity[i] = gravity;
  }
  burst(n, x, y, z, speed, up, life, r, g, b, gravity) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.emit(x, y, z, Math.cos(a) * s, up * (0.3 + Math.random()), Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), r * (0.8 + Math.random() * 0.3), g * (0.8 + Math.random() * 0.3), b * (0.8 + Math.random() * 0.3), gravity);
    }
  }
  update(dt) {
    if (dt <= 0) return;
    const { pos, vel, life, col, base, max } = this;
    for (let i = 0; i < this.count; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) {
        pos[i * 3 + 1] = -9999;
        continue;
      }
      vel[i * 3 + 1] -= this.gravity[i] * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (this.fade) {
        const k = life[i] / max[i];
        col[i * 3] = base[i * 3] * k;
        col[i * 3 + 1] = base[i * 3 + 1] * k;
        col[i * 3 + 2] = base[i * 3 + 2] * k;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    if (this.fade) this.points.geometry.attributes.color.needsUpdate = true;
  }
}

const SURFACE = {
  ground: [0.45, 0.38, 0.27],
  box: [0.6, 0.58, 0.54],
  tree: [0.42, 0.3, 0.18],
  rock: [0.55, 0.54, 0.5],
  prop: [0.5, 0.5, 0.5],
  target: [0.85, 0.8, 0.7],
};

export class Effects {
  constructor(scene, sim) {
    this.scene = scene;
    this.sim = sim;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.shake = 0;
    this.flash = 0;
    const dot = dotTexture(64, 0.45);
    this.dust = new Particles(this.group, 700, new THREE.PointsMaterial({ size: 0.42, map: dot, transparent: true, opacity: 0.8, depthWrite: false, vertexColors: true }));
    this.sparks = new Particles(this.group, 500, new THREE.PointsMaterial({ size: 0.2, map: dot, transparent: true, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending }));

    // tracers
    this.tracerGeo = new THREE.BoxGeometry(1, 1, 1);
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.tracerMatFoe = new THREE.MeshBasicMaterial({ color: 0xff8a6a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.tracers = [];
    for (let i = 0; i < 48; i++) {
      const mesh = new THREE.Mesh(this.tracerGeo, this.tracerMat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.tracers.push({ mesh, t: 0, dist: 0, live: false, s: new THREE.Vector3(), d: new THREE.Vector3() });
    }
    this.tracerIndex = 0;

    // muzzle flashes
    this.flashes = [];
    for (let i = 0; i < 10; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xffd28a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sprite.visible = false;
      this.group.add(sprite);
      this.flashes.push({ sprite, t: 0 });
    }
    this.flashIndex = 0;
    this.light = new THREE.PointLight(0xffc880, 0, 16);
    this.group.add(this.light);

    // fireballs
    const ball = new THREE.IcosahedronGeometry(1, 1);
    this.balls = [];
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      mesh.visible = false;
      this.group.add(mesh);
      this.balls.push({ mesh, t: 0, r: 1, live: false });
    }
    // smoke
    this.smokeGeo = new THREE.IcosahedronGeometry(1, 1);
    this.clouds = [];
    // rings on the ground
    this.ringGeo = new THREE.RingGeometry(0.9, 1, 40);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.rings = [];
    // beacons
    const pillar = new THREE.CylinderGeometry(0.45, 0.45, 1, 8, 1, true);
    pillar.translate(0, 0.5, 0);
    this.beacons = [];
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xf0c24a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const mesh = new THREE.Mesh(pillar, mat);
      mesh.visible = false;
      this.group.add(mesh);
      const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xf0c24a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      ring.visible = false;
      this.group.add(ring);
      this.beacons.push({ mesh, ring });
    }
    this.v = new THREE.Vector3();
  }

  tracer(x, y, z, tx, ty, tz, foe) {
    const tr = this.tracers[this.tracerIndex];
    this.tracerIndex = (this.tracerIndex + 1) % this.tracers.length;
    tr.s.set(x, y, z);
    tr.d.set(tx - x, ty - y, tz - z);
    tr.dist = tr.d.length();
    if (tr.dist < 0.5) return;
    tr.d.multiplyScalar(1 / tr.dist);
    tr.t = 0;
    tr.live = true;
    tr.mesh.material = foe ? this.tracerMatFoe : this.tracerMat;
  }

  muzzle(x, y, z, near) {
    const f = this.flashes[this.flashIndex];
    this.flashIndex = (this.flashIndex + 1) % this.flashes.length;
    f.sprite.position.set(x, y, z);
    f.sprite.scale.setScalar(0.5 + Math.random() * 0.5);
    f.sprite.visible = true;
    f.t = 0.05;
    if (near) {
      this.light.position.set(x, y, z);
      this.light.intensity = 1.6;
    }
  }

  play(fx) {
    const sim = this.sim;
    const p = sim.player;
    switch (fx.t) {
      case 'shot': {
        const d = Math.hypot(fx.x - p.x, fx.z - p.z);
        if (fx.own ? fx.first !== false : true) this.muzzle(fx.x, fx.y, fx.z, d < 70 && fx.loud);
        this.tracer(fx.x, fx.y, fx.z, fx.tx, fx.ty, fx.tz, !fx.own && d > 2);
        if (fx.surface === 'flesh') break;
        const c = SURFACE[fx.surface];
        if (c) {
          this.dust.burst(5, fx.tx, fx.ty, fx.tz, 1.6, 2.2, 0.5, c[0], c[1], c[2], 7);
          if (fx.surface === 'box' || fx.surface === 'rock' || fx.surface === 'prop') this.sparks.burst(3, fx.tx, fx.ty, fx.tz, 3, 2, 0.25, 1, 0.8, 0.4, 9);
        }
        break;
      }
      case 'blood':
        this.dust.burst(6, fx.x, fx.y, fx.z, 1.3, 1.2, 0.45, 0.55, 0.05, 0.04, 8);
        break;
      case 'explosion': {
        const ball = this.balls.find((b) => !b.live) ?? this.balls[0];
        ball.live = true;
        ball.t = 0;
        ball.r = fx.r * 0.55;
        ball.mesh.position.set(fx.x, fx.y + 0.6, fx.z);
        ball.mesh.visible = true;
        this.dust.burst(fx.big ? 60 : 34, fx.x, fx.y + 0.3, fx.z, fx.r * 1.1, fx.r * 0.9, 1.3, 0.34, 0.3, 0.25, 5);
        this.sparks.burst(fx.big ? 50 : 30, fx.x, fx.y + 0.5, fx.z, fx.r * 1.6, fx.r * 1.2, 0.7, 1, 0.6, 0.2, 7);
        this.cloud(fx.x, fx.y + 1, fx.z, fx.r * 0.5, 3.5, 0x4a4640, 1.4);
        const d = Math.hypot(fx.x - p.x, fx.z - p.z);
        this.shake = Math.max(this.shake, Math.min(1.2, (fx.big ? 30 : 18) / Math.max(4, d)));
        if (d < 60) {
          this.light.position.set(fx.x, fx.y + 2, fx.z);
          this.light.intensity = 3;
        }
        break;
      }
      case 'smoke':
        this.cloud(fx.x, fx.y + 0.6, fx.z, fx.r, fx.seconds, 0xcfcfc6, 0);
        break;
      case 'flashbang':
        this.sparks.burst(40, fx.x, fx.y + 0.4, fx.z, 9, 6, 0.3, 1, 1, 1, 0);
        this.flash = 1;
        break;
      case 'marker': {
        const mesh = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: fx.hostile ? 0xff5040 : 0xf0c24a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
        mesh.position.set(fx.x, fx.y + 0.25, fx.z);
        mesh.scale.setScalar(fx.r);
        this.group.add(mesh);
        this.rings.push({ mesh, t: fx.seconds });
        break;
      }
      case 'land':
        this.dust.burst(6, fx.x, fx.y + 0.1, fx.z, 1.5, 0.8, 0.4, 0.5, 0.44, 0.34, 4);
        break;
      case 'death':
      case 'down':
        this.dust.burst(5, fx.x, fx.y + 0.2, fx.z, 1.2, 0.6, 0.5, 0.48, 0.42, 0.32, 4);
        break;
      case 'hurt':
        this.shake = Math.max(this.shake, Math.min(0.5, fx.amount / 60));
        break;
      default:
    }
  }

  cloud(x, y, z, r, seconds, color, rise) {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.0, depthWrite: false });
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(this.smokeGeo, mat);
      const a = (i / 7) * Math.PI * 2;
      const d = i === 0 ? 0 : 0.55;
      m.position.set(Math.cos(a) * d, (i % 3) * 0.28, Math.sin(a) * d);
      m.scale.setScalar(0.55 + (i % 3) * 0.12);
      m.rotation.set(i, i * 2, i * 3);
      group.add(m);
    }
    group.position.set(x, y, z);
    this.group.add(group);
    this.clouds.push({ group, mat, t: 0, seconds, r, rise });
  }

  update(dt, camera) {
    const sim = this.sim;
    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.flash = Math.max(0, this.flash - dt * 1.4);
    this.light.intensity = Math.max(0, this.light.intensity - dt * 30);
    this.dust.update(dt);
    this.sparks.update(dt);
    const v = this.v;
    for (const tr of this.tracers) {
      if (!tr.live) continue;
      tr.t += dt;
      const head = Math.min(tr.dist, tr.t * TRACER_SPEED);
      const tail = Math.max(0, head - TRACER_LEN);
      if (tail >= tr.dist - 0.01 || (dt === 0 && tr.t > 0.3)) {
        tr.live = false;
        tr.mesh.visible = false;
        continue;
      }
      const mid = (head + tail) / 2;
      const len = Math.max(0.4, head - tail);
      tr.mesh.position.copy(tr.s).addScaledVector(tr.d, mid);
      v.copy(tr.s).addScaledVector(tr.d, mid + 1);
      tr.mesh.lookAt(v);
      // thicker far away so it still reads
      const w = 0.02 + camera.position.distanceTo(tr.mesh.position) * 0.0011;
      tr.mesh.scale.set(w, w, len);
      tr.mesh.visible = true;
    }
    for (const f of this.flashes) {
      if (f.t <= 0) continue;
      f.t -= dt;
      if (f.t <= 0) f.sprite.visible = false;
    }
    for (const b of this.balls) {
      if (!b.live) continue;
      b.t += dt;
      const k = b.t / 0.45;
      if (k >= 1) {
        b.live = false;
        b.mesh.visible = false;
        continue;
      }
      b.mesh.scale.setScalar(b.r * (0.35 + k * 0.9));
      b.mesh.material.opacity = (1 - k) * 0.9;
    }
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.t += dt;
      if (c.t >= c.seconds) {
        this.group.remove(c.group);
        c.mat.dispose();
        this.clouds.splice(i, 1);
        continue;
      }
      const grow = Math.min(1, c.t / 2.2);
      c.group.scale.setScalar(c.r * (0.25 + grow * 0.95));
      c.group.position.y += c.rise * dt;
      c.group.rotation.y += dt * 0.12;
      c.mat.opacity = Math.min(0.88, c.t * 1.5, (c.seconds - c.t) / 3);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t -= dt;
      if (r.t <= 0) {
        this.group.remove(r.mesh);
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
        continue;
      }
      r.mesh.material.opacity = 0.45 + 0.4 * Math.sin(sim.time * 12);
    }
    // beacons over what the compass points at
    const markers = sim.objective?.markers ?? [];
    const p = sim.player;
    for (let i = 0; i < this.beacons.length; i++) {
      const b = this.beacons[i];
      const m = markers[i];
      if (!m) {
        b.mesh.visible = false;
        b.ring.visible = false;
        continue;
      }
      const ground = sim.world.terrain.heightAt(m.x, m.z);
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      const color = m.kind === 'exfil' ? 0x7fe08a : m.kind === 'target' ? 0xff6a50 : m.kind === 'npc' ? 0x9fd0ff : 0xf0c24a;
      if (m.kind === 'area') {
        b.mesh.visible = false;
        b.ring.visible = true;
        b.ring.position.set(m.x, ground + 0.4, m.z);
        b.ring.scale.setScalar(m.r ?? 40);
        b.ring.material.color.setHex(0xff6a50);
        continue;
      }
      b.ring.visible = false;
      b.mesh.visible = d > 7;
      b.mesh.position.set(m.x, ground, m.z);
      const w = 0.6 + Math.min(4, d * 0.012);
      b.mesh.scale.set(w, 70, w);
      b.mesh.material.color.setHex(color);
      b.mesh.material.opacity = 0.16 + 0.06 * Math.sin(sim.time * 3 + i);
    }
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
