// The boss creatures of the 3D race: the wyrms (Frostmaw and Vharzul) and the Dune Devourer.
// Boss war-trains (Rustjaw, the Iron Bastion) are ordinary trains with their own decoration, in
// RailScene.decorate. Like everything in the scene these only draw: the engine decides what a boss does.
//
// Local axes match a train car: x to the right, y up, z along the line (forward is +z).
import * as THREE from 'three';

// Which boss looks are creatures (they have no track of their own) and how they ride.
export const CREATURES = {
  frostwyrm: { kind: 'wyrm', alt: 8.5, side: 12, scale: 1.6, shot: 'frost', body: 0x5f9fd4, belly: 0xd9f0ff, wing: 0x2f6fae, horn: 0xf4fbff, eye: 0x9ff3ff, glow: 0xbfeeff, css: '#7fc8ff' },
  dreadwyrm: { kind: 'wyrm', alt: 10.5, side: 14, scale: 2.1, shot: 'fire', body: 0x2c0b0b, belly: 0x7a1d12, wing: 0x8a1a10, horn: 0xe0a030, eye: 0xffb020, glow: 0xff6a1a, css: '#ff5a3a', crown: true },
  wurm: { kind: 'wurm', alt: 0, side: 13, scale: 1.25, shot: 'acid', body: 0x8a6a3c, plate: 0x5a4022, maw: 0xb03a2a, tooth: 0xf2e6c8, glow: 0x9dff6a, css: '#d9b36a' },
};

// The colours of the boss war-trains, in the same shape as RailScene's LIVERY.
export const BOSS_LIVERY = {
  scrap: { body: 0x4a3326, trim: 0xb5532a, wheel: 0x2a1d16, lamp: 0xff3b2a, win: 0xff7a3a, css: '#ff6a3a' },
  bastion: { body: 0x4b5560, trim: 0x8fa3b8, wheel: 0x2c333b, lamp: 0xff4a3a, win: 0x9fd0ff, css: '#9fb8d4' },
};

const cylZ = (r1, r2, l, s) => new THREE.CylinderGeometry(r1, r2, l, s).rotateX(Math.PI / 2);

// A wing membrane: a swept triangle with two fingers, lying flat (in the xz plane), root at the origin.
function wingGeometry(span) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(span * 0.35, 2.4);
  s.lineTo(span, 1.2);
  s.lineTo(span * 0.82, -0.8);
  s.lineTo(span * 0.62, -3.0);
  s.lineTo(span * 0.42, -1.6);
  s.lineTo(span * 0.22, -3.4);
  s.lineTo(0, -1.8);
  s.lineTo(0, 0);
  // Shape lies in xy; turn it flat so y becomes z (the leading edge points forward).
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
}

/**
 * A wyrm: a long body that ripples as it flies, a horned head with a jaw that opens when it is
 * about to strike, and two beating wings.
 * Returns { group, mouth: [x, y, z], anim(time, state) }.
 */
export function buildWyrm(scene, look) {
  const group = new THREE.Group();
  const mBody = scene.lam(look.body);
  const mBelly = scene.lam(look.belly);
  const mHorn = scene.lam(look.horn);
  const mWing = scene.lam(look.wing, { side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  const mEye = scene.glow(look.eye);
  const mGlow = scene.glow(look.glow);

  // Body: tapered segments from the neck back to the tail.
  const N = 11;
  const segs = [];
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1);
    const r = 0.5 + 1.25 * Math.sin(Math.min(1, k * 1.5 + 0.18) * Math.PI) * (1 - k * 0.55);
    const seg = new THREE.Group();
    const hull = new THREE.Mesh(cylZ(r * 0.9, r, 2.3, 6), mBody);
    seg.add(hull);
    const under = new THREE.Mesh(new THREE.BoxGeometry(r * 1.1, 0.3, 2.1), mBelly);
    under.position.y = -r * 0.82;
    seg.add(under);
    if (i > 0 && i < N - 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22 + r * 0.12, 0.9 + r * 0.5, 4), mHorn);
      spike.position.y = r + 0.3;
      spike.rotation.x = -0.5;
      seg.add(spike);
    }
    seg.userData.z = 5.5 - i * 2.05;
    seg.userData.i = i;
    seg.position.z = seg.userData.z;
    group.add(seg);
    segs.push(seg);
  }
  // Tail fin.
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 4), mHorn);
  fin.rotation.x = -Math.PI / 2;
  fin.scale.set(1, 1, 0.25);
  fin.position.z = -1.6;
  segs[N - 1].add(fin);

  // Head: skull, snout, jaw, horns, eyes.
  const head = new THREE.Group();
  head.position.set(0, 0.3, 7.4);
  head.add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 2.2), mBody));
  const snout = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.9), mBody);
  snout.position.set(0, -0.05, 1.9);
  head.add(snout);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.55, 0.6);
  const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.32, 2.5), mBelly);
  jawMesh.position.z = 1.2;
  jaw.add(jawMesh);
  for (const sx of [-0.42, 0.42])
    for (const z of [1.3, 1.9, 2.3]) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 4), mHorn);
      tooth.position.set(sx, 0.3, z);
      jaw.add(tooth);
    }
  head.add(jaw);
  const throat = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), mGlow);
  throat.position.set(0, -0.3, 1.5);
  throat.scale.setScalar(0.4);
  head.add(throat);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.5), mEye);
    eye.position.set(sx * 0.97, 0.3, 0.7);
    head.add(eye);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.26, 2.3, 5), mHorn);
    horn.position.set(sx * 0.6, 1.2, -0.9);
    horn.rotation.set(-1.1, 0, sx * -0.25);
    head.add(horn);
    if (look.crown) {
      const horn2 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.5, 5), mHorn);
      horn2.position.set(sx * 0.95, 0.5, -0.7);
      horn2.rotation.set(-1.3, 0, sx * -0.7);
      head.add(horn2);
    }
  }
  group.add(head);

  // Wings: a pivot at each shoulder, the membrane and a leading bone.
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 1.1, 0.9, 2.2);
    const membrane = new THREE.Mesh(wingGeometry(9.5), mWing);
    membrane.scale.x = side;
    pivot.add(membrane);
    const bone = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.22, 0.3), mBody);
    bone.position.set(side * 4.8, 0.05, 1.7);
    bone.rotation.y = side * 0.12;
    pivot.add(bone);
    pivot.userData.side = side;
    group.add(pivot);
    wings.push(pivot);
  }
  // A shadow on the ground under it, so its height above the line reads at a glance.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.26, depthWrite: false }));
  shadow.scale.set(5.5, 1, 11);
  shadow.position.set(0, -(look.alt + 0.25) / (look.scale ?? 1), -2);
  group.add(shadow);
  group.scale.setScalar(look.scale ?? 1);

  const anim = (time, state = {}) => {
    const speed = state.enraged ? 7.5 : 5.2;
    for (const seg of segs) {
      const i = seg.userData.i;
      const wave = Math.sin(time * 3.1 - i * 0.62);
      seg.position.y = wave * (0.25 + i * 0.07);
      seg.position.x = Math.sin(time * 1.7 - i * 0.45) * (0.12 + i * 0.05);
      seg.rotation.x = Math.cos(time * 3.1 - i * 0.62) * 0.12;
    }
    head.position.y = 0.3 + Math.sin(time * 3.1 + 0.5) * 0.3 + (state.windup ? 0.9 : 0);
    head.rotation.x = state.windup ? -0.35 : Math.sin(time * 1.3) * 0.06;
    jaw.rotation.x = state.windup ? 0.55 + Math.sin(time * 30) * 0.05 : 0.08 + Math.max(0, Math.sin(time * 0.9)) * 0.1;
    throat.scale.setScalar(state.windup ? 1.3 + Math.sin(time * 26) * 0.25 : 0.4);
    for (const pivot of wings) {
      const side = pivot.userData.side;
      pivot.rotation.z = side * (0.18 + Math.sin(time * speed) * 0.6);
      pivot.rotation.x = Math.sin(time * speed + 1.2) * 0.12;
    }
  };
  return { group, mouth: [0, 0.2 * (look.scale ?? 1), 10.2 * (look.scale ?? 1)], anim };
}

/**
 * The Dune Devourer: a sand wurm that arcs in and out of the ground beside the line. Its segments
 * ride a travelling wave, so whatever is below ground level is simply hidden by the ground.
 * Returns { group, mouth, anim(time, state) }.
 */
export function buildWurm(scene, look) {
  const group = new THREE.Group();
  const mBody = scene.lam(look.body);
  const mPlate = scene.lam(look.plate);
  const mTooth = scene.lam(look.tooth);
  const mMaw = scene.glow(look.maw);
  const N = 12;
  const segs = [];
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1);
    const r = 2.1 - k * 1.3;
    const seg = new THREE.Group();
    seg.add(new THREE.Mesh(cylZ(r * 0.92, r, 2.5, 8), mBody));
    const ring = new THREE.Mesh(cylZ(r * 1.06, r * 1.06, 0.5, 8), mPlate);
    ring.position.z = 0.9;
    seg.add(ring);
    seg.userData.i = i;
    seg.userData.z = 6 - i * 2.2;
    group.add(seg);
    segs.push(seg);
  }
  // The head: a ring of teeth round a glowing gullet.
  const head = new THREE.Group();
  const lip = new THREE.Mesh(cylZ(2.5, 2.1, 1.6, 8), mPlate);
  head.add(lip);
  const gullet = new THREE.Mesh(new THREE.CircleGeometry(1.9, 10), mMaw);
  gullet.position.z = 0.82;
  head.add(gullet);
  const teeth = [];
  for (let t = 0; t < 10; t++) {
    const a = (t / 10) * Math.PI * 2;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.5, 4), mTooth);
    tooth.position.set(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 1.3);
    tooth.rotation.x = Math.PI / 2;
    tooth.userData.a = a;
    head.add(tooth);
    teeth.push(tooth);
  }
  group.add(head);
  group.scale.setScalar(look.scale ?? 1);

  // Height of the travelling wave at a point `z` along the body.
  const wave = (time, z) => Math.sin(time * 2.2 + z * 0.3) * 3.6 + 0.6;
  const slope = (time, z) => Math.cos(time * 2.2 + z * 0.3) * 3.6 * 0.3;
  const anim = (time, state = {}) => {
    for (const seg of segs) {
      const z = seg.userData.z;
      seg.position.set(0, wave(time, z) - 0.4, z);
      seg.rotation.x = -Math.atan(slope(time, z));
    }
    // The head rides ahead of the body and rears up when it is about to strike.
    const hz = 8.4;
    const rear = state.windup ? 3.2 : 0;
    head.position.set(0, Math.max(1.2, wave(time, hz) + 1.4) + rear, hz);
    head.rotation.x = state.windup ? -0.75 : -Math.atan(slope(time, hz)) * 0.6 - 0.25;
    const gape = state.windup ? 2.5 + Math.sin(time * 28) * 0.12 : 1.9;
    for (const tooth of teeth) tooth.position.set(Math.cos(tooth.userData.a) * gape, Math.sin(tooth.userData.a) * gape, 1.3);
    gullet.scale.setScalar(state.windup ? 1.25 : 1);
  };
  return { group, mouth: [0, 6, 9.5], anim, burrows: true };
}

export function buildCreature(scene, lookId) {
  const look = CREATURES[lookId];
  if (!look) return null;
  const made = look.kind === 'wurm' ? buildWurm(scene, look) : buildWyrm(scene, look);
  return { ...made, look };
}
