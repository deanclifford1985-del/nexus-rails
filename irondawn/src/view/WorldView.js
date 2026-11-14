// Draws the island: ground, sea and lake, roads, everything built on the sites, trees, brush and
// rocks, the sky, and the light as the day goes round. It only draws; sim/world.js is the truth.

import * as THREE from 'three';
import { GROUND } from '../sim/terrain.js';
import { daylight } from '../sim/world.js';
import { GeoBuilder, dotTexture, grainTexture } from './geo.js';

const CHUNK = 300;
const GROUND_RGB = {
  [GROUND.grass]: [0.37, 0.5, 0.24],
  [GROUND.forest]: [0.25, 0.36, 0.2],
  [GROUND.dirt]: [0.53, 0.44, 0.31],
  [GROUND.sand]: [0.79, 0.73, 0.53],
  [GROUND.rock]: [0.47, 0.46, 0.43],
  [GROUND.snow]: [0.92, 0.94, 0.96],
  [GROUND.tallgrass]: [0.5, 0.56, 0.28],
  [GROUND.farm]: [0.62, 0.55, 0.31],
  [GROUND.gravel]: [0.4, 0.5, 0.27],
  [GROUND.seabed]: [0.43, 0.47, 0.4],
};
export const groundColor = (type) => GROUND_RGB[type] ?? GROUND_RGB[GROUND.grass];

const lerp = (a, b, t) => a + (b - a) * t;
const mixColor = (out, a, b, t) => out.setRGB(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t));
const C = (hex) => new THREE.Color(hex);
const SKY = {
  dayTop: C(0x3d7bcb), dayHorizon: C(0xb9d3ea), duskTop: C(0x2c3d75), duskHorizon: C(0xf0a26e), nightTop: C(0x04060d), nightHorizon: C(0x0f1830),
  sunDay: C(0xfff3de), sunDusk: C(0xff9d5c), moon: C(0x9db4ff), hemiDay: C(0xc4dbff), hemiNight: C(0x6078b0), groundDay: C(0x6e6b4c), groundNight: C(0x2a3648),
};

export class WorldView {
  constructor(world, scene, quality) {
    this.world = world;
    this.scene = scene;
    this.quality = quality;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.chunks = [];
    this.buildTerrain();
    this.buildWater();
    this.buildRoads();
    this.buildSites();
    this.buildVegetation();
    this.buildSky();
    this.tmp = new THREE.Color();
    this.tmp2 = new THREE.Color();
  }

  // ---------- ground ----------
  buildTerrain() {
    const t = this.world.terrain;
    const n = t.n;
    const pos = new Float32Array(n * n * 3);
    const col = new Float32Array(n * n * 3);
    const uv = new Float32Array(n * n * 2);
    let seed = 99;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const i = iz * n + ix;
        const x = ix * t.cell - t.half;
        const z = iz * t.cell - t.half;
        pos[i * 3] = x;
        pos[i * 3 + 1] = t.h[i];
        pos[i * 3 + 2] = z;
        uv[i * 2] = x / 6;
        uv[i * 2 + 1] = z / 6;
        const type = t.type[i];
        const rgb = groundColor(type);
        let k = 0.9 + rnd() * 0.2;
        if (type === GROUND.farm) k *= (Math.floor(x / 16) + Math.floor(z / 48)) % 2 ? 1.08 : 0.9;
        // a road shows as a paler ribbon even between samples
        const road = t.roadDist[i];
        const blend = road < 9 ? 1 - road / 9 : 0;
        col[i * 3] = lerp(rgb[0], 0.53, blend * 0.7) * k;
        col[i * 3 + 1] = lerp(rgb[1], 0.44, blend * 0.7) * k;
        col[i * 3 + 2] = lerp(rgb[2], 0.31, blend * 0.7) * k;
      }
    }
    const index = new Uint32Array((n - 1) * (n - 1) * 6);
    let k = 0;
    for (let iz = 0; iz < n - 1; iz++) {
      for (let ix = 0; ix < n - 1; ix++) {
        const a = iz * n + ix;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        index[k++] = a;
        index[k++] = c;
        index[k++] = b;
        index[k++] = b;
        index[k++] = c;
        index[k++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeVertexNormals();
    this.grain = grainTexture();
    this.terrainMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, map: this.grain });
    const mesh = new THREE.Mesh(geo, this.terrainMaterial);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.terrainMesh = mesh;
  }

  buildWater() {
    this.waterMaterial = new THREE.MeshLambertMaterial({ color: 0x2c6a88, transparent: true, opacity: 0.84 });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), this.waterMaterial);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = 0;
    this.group.add(sea);
    for (const lake of this.world.terrain.lakes) {
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(lake.r + 10, 40), this.waterMaterial);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(lake.x, lake.level, lake.z);
      this.group.add(mesh);
    }
  }

  // Roads are ribbons laid just above the ground.
  buildRoads() {
    const t = this.world.terrain;
    const b = new GeoBuilder();
    const W = 2.6;
    for (const line of t.roads) {
      for (let i = 0; i < line.length - 1; i++) {
        const p = line[i];
        const q = line[i + 1];
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        const nx = (-dz / d) * W;
        const nz = (dx / d) * W;
        const y = (x, z) => t.heightAt(x, z) + 0.1;
        const a = [p.x - nx, y(p.x - nx, p.z - nz), p.z - nz];
        const c = [q.x - nx, y(q.x - nx, q.z - nz), q.z - nz];
        const e = [q.x + nx, y(q.x + nx, q.z + nz), q.z + nz];
        const f = [p.x + nx, y(p.x + nx, p.z + nz), p.z + nz];
        const shade = 0.94 + ((i * 7) % 5) * 0.02;
        b.quad(a, f, e, c, 0.55 * shade, 0.46 * shade, 0.33 * shade);
      }
    }
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(b.build(), mat);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  // ---------- buildings ----------
  buildSites() {
    this.glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.poolMaterial = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: dotTexture(64, 0.3) });
    this.pools = {};
    for (const [id, shapes] of Object.entries(this.world.shapes)) {
      const solid = new GeoBuilder();
      const glow = new GeoBuilder();
      for (const s of shapes) {
        const b = s.glow ? glow : solid;
        if (s.t === 'box') b.box(s.x, s.y, s.z, s.sx, s.sy, s.sz, s.c);
        else if (s.t === 'roof') b.roof(s.x, s.y, s.z, s.sx, s.sy, s.sz, s.c, s.axis);
        else if (s.t === 'cyl') b.cyl(s.x, s.y, s.z, s.r, s.h, s.c, s.seg);
        else if (s.t === 'flag') {
          b.box(s.x + 0.8, s.y, s.z, 1.5, 0.95, 0.05, s.c);
          b.box(s.x + 0.8, s.y - 0.24, s.z, 1.5, 0.12, 0.06, 0xf2f0e6);
        } else if (s.t === 'heli') this.helicopter(solid, s.x, s.y, s.z);
      }
      const site = this.world.sites[id];
      if (solid.pos.length) {
        const mesh = new THREE.Mesh(solid.build(), this.material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        this.group.add(mesh);
      }
      if (glow.pos.length) {
        const mesh = new THREE.Mesh(glow.build(), this.glowMaterial);
        mesh.matrixAutoUpdate = false;
        this.group.add(mesh);
      }
      // pools of light under the lamps, shown at night
      const lamps = site.anchors.lamps;
      if (lamps.length) {
        const geo = new THREE.PlaneGeometry(1, 1);
        geo.rotateX(-Math.PI / 2);
        const inst = new THREE.InstancedMesh(geo, this.poolMaterial, lamps.length);
        const m = new THREE.Matrix4();
        lamps.forEach((lamp, i) => {
          m.makeScale(lamp.r * 1.7, 1, lamp.r * 1.7);
          m.setPosition(lamp.x, this.world.terrain.heightAt(lamp.x, lamp.z) + 0.12, lamp.z);
          inst.setMatrixAt(i, m);
        });
        inst.frustumCulled = false;
        inst.renderOrder = 2;
        this.group.add(inst);
        this.pools[id] = inst;
      }
    }
  }

  helicopter(b, x, y, z) {
    const body = 0x4d5a3a;
    b.box(x, y + 1.5, z, 1.9, 1.8, 4.6, body);
    b.box(x, y + 1.7, z - 2.6, 1.5, 1.2, 1.2, 0x9fc4cf);
    b.box(x, y + 1.9, z + 4.2, 0.5, 0.6, 4.4, body);
    b.box(x, y + 2.6, z + 6.2, 0.14, 1.6, 0.9, body);
    b.box(x, y + 2.75, z, 0.3, 0.5, 0.3, 0x2f3438);
    b.box(x, y + 3.02, z, 11, 0.06, 0.34, 0x2f3438);
    b.box(x, y + 3.02, z, 0.34, 0.06, 11, 0x2f3438);
    for (const sx of [-1, 1]) {
      b.box(x + sx * 1.05, y + 0.22, z, 0.12, 0.12, 4.2, 0x2f3438);
      b.box(x + sx * 1.0, y + 0.5, z - 1.2, 0.08, 0.5, 0.08, 0x2f3438);
      b.box(x + sx * 1.0, y + 0.5, z + 1.2, 0.08, 0.5, 0.08, 0x2f3438);
    }
  }

  // ---------- what grows ----------
  buildVegetation() {
    const pine = new GeoBuilder();
    pine.cyl(0, 0.8, 0, 0.17, 1.6, 0x4f3a26, 6);
    pine.cyl(0, 2.4, 0, 1.5, 2.3, 0x2c4f31, 7, 0, false);
    pine.cyl(0, 3.8, 0, 1.15, 2.0, 0x335c38, 7, 0, false);
    pine.cyl(0, 5.0, 0, 0.75, 1.7, 0x3b683e, 7, 0, false);
    const oak = new GeoBuilder();
    oak.cyl(0, 1.2, 0, 0.22, 2.4, 0x55402b, 6);
    oak.blob(0, 3.7, 0, 1.9, 0x4a7738, 0.85, 0.2, 3);
    oak.blob(1.0, 3.1, 0.4, 1.3, 0x426d33, 0.85, 0.2, 5);
    oak.blob(-0.8, 3.3, -0.6, 1.4, 0x528240, 0.85, 0.2, 7);
    const birch = new GeoBuilder();
    birch.cyl(0, 1.7, 0, 0.1, 3.4, 0xd9d5c4, 5);
    birch.blob(0, 3.9, 0, 1.15, 0x7c9c48, 1, 0.22, 9);
    birch.blob(0.3, 4.8, 0.2, 0.85, 0x8aa852, 1, 0.22, 11);
    const bush = new GeoBuilder();
    bush.blob(0, 0.55, 0, 1, 0x3c6332, 0.62, 0.25, 13);
    bush.blob(0.55, 0.4, 0.3, 0.7, 0x456f38, 0.6, 0.25, 15);
    const rock = new GeoBuilder();
    rock.blob(0, 0.35, 0, 1, 0x7c7a74, 0.7, 0.28, 17);
    const kinds = {
      t0: { geo: pine.build(), list: this.world.trees.filter((t) => t.type === 0), scale: (t) => t.s, y: 0, shadow: true },
      t1: { geo: oak.build(), list: this.world.trees.filter((t) => t.type === 1), scale: (t) => t.s, y: 0, shadow: true },
      t2: { geo: birch.build(), list: this.world.trees.filter((t) => t.type === 2), scale: (t) => t.s, y: 0, shadow: true },
      bush: { geo: bush.build(), list: this.world.bushes, scale: (b) => b.r, y: 0, shadow: false },
      rock: { geo: rock.build(), list: this.world.rocks, scale: (r) => r.r, y: -0.15, shadow: true },
    };
    const half = this.world.terrain.half;
    const cells = Math.ceil((half * 2) / CHUNK);
    const buckets = new Map();
    for (const [name, kind] of Object.entries(kinds)) {
      for (const item of kind.list) {
        const cx = Math.min(cells - 1, Math.floor((item.x + half) / CHUNK));
        const cz = Math.min(cells - 1, Math.floor((item.z + half) / CHUNK));
        const key = `${cx},${cz},${name}`;
        let list = buckets.get(key);
        if (!list) buckets.set(key, (list = []));
        list.push(item);
      }
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (const [key, list] of buckets) {
      const [cx, cz, name] = key.split(',');
      const kind = kinds[name];
      // each chunk gets its own geometry object (sharing the buffers) so it can be culled as a block
      const geo = new THREE.BufferGeometry();
      for (const attr of ['position', 'normal', 'color']) geo.setAttribute(attr, kind.geo.getAttribute(attr));
      const centre = new THREE.Vector3((Number(cx) + 0.5) * CHUNK - half, 40, (Number(cz) + 0.5) * CHUNK - half);
      geo.boundingSphere = new THREE.Sphere(centre, CHUNK * 0.75 + 40);
      const inst = new THREE.InstancedMesh(geo, this.material, list.length);
      list.forEach((item, i) => {
        const k = kind.scale(item);
        q.setFromAxisAngle(up, (item.x * 12.9898 + item.z * 78.233) % 6.283);
        p.set(item.x, item.y + kind.y, item.z);
        s.set(k, k * (name === 'rock' ? (item.h ?? k) / k : 1), k);
        m.compose(p, q, s);
        inst.setMatrixAt(i, m);
      });
      inst.castShadow = kind.shadow;
      inst.matrixAutoUpdate = false;
      this.group.add(inst);
      this.chunks.push({ mesh: inst, x: centre.x, z: centre.z, small: name === 'bush' || name === 'rock' });
    }
  }

  // ---------- sky ----------
  buildSky() {
    this.skyUniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, glow: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float glow; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.5));
        c = mix(c, horizon * 0.85, smoothstep(0.0, -0.25, d.y)); float s = max(dot(d, sunDir), 0.0);
        c += sunColor * (pow(s, 900.0) * 4.0 + pow(s, 14.0) * 0.28 * glow); gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(3800, 24, 14), mat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
    // stars
    const count = 500;
    const pos = new Float32Array(count * 3);
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const e = Math.asin(0.05 + rnd() * 0.95);
      pos[i * 3] = Math.cos(a) * Math.cos(e) * 3500;
      pos[i * 3 + 1] = Math.sin(e) * 3500;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 3500;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMaterial = new THREE.PointsMaterial({ color: 0xdfe6ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.stars = new THREE.Points(geo, this.starMaterial);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    this.scene.add(this.stars);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = this.quality.shadows;
    const sh = this.sun.shadow;
    sh.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
    sh.camera.left = sh.camera.bottom = -70;
    sh.camera.right = sh.camera.top = 70;
    sh.camera.near = 10;
    sh.camera.far = 420;
    sh.bias = -0.0006;
    sh.normalBias = 0.5;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.scene.fog = new THREE.FogExp2(0xb9d3ea, 0.0011);
    this.lampLights = [];
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xffd9a0, 0, 26, 1.6);
      this.scene.add(light);
      this.lampLights.push(light);
    }
    this.lampTimer = 0;
    this.sunDir = new THREE.Vector3(0.4, 0.8, 0.3);
  }

  // Sets sky, light and fog for an hour of the day. nvg lifts the gloom in green.
  setTime(hour, nvg, flash) {
    const day = daylight(hour);
    const k = (day - 0.14) / 0.86; // 0 night .. 1 day
    const dusk = Math.max(0, 1 - Math.abs(k - 0.45) / 0.45);
    const angle = ((hour - 6) / 12) * Math.PI;
    const up = Math.sin(angle);
    if (up > -0.05) this.sunDir.set(Math.cos(angle) * 0.9, Math.max(0.12, up), 0.38).normalize();
    else this.sunDir.set(-Math.cos(angle) * 0.6, 0.62, -0.4).normalize();
    const u = this.skyUniforms;
    const t = this.tmp;
    const t2 = this.tmp2;
    mixColor(t, SKY.nightTop, SKY.dayTop, k);
    mixColor(u.top.value, t, SKY.duskTop, dusk * 0.6);
    mixColor(t, SKY.nightHorizon, SKY.dayHorizon, k);
    mixColor(u.horizon.value, t, SKY.duskHorizon, dusk * 0.75);
    u.sunDir.value.copy(this.sunDir);
    mixColor(t, SKY.moon, SKY.sunDay, k);
    mixColor(u.sunColor.value, t, SKY.sunDusk, dusk * 0.8);
    u.glow.value = 0.4 + k * 0.6;
    this.sun.color.copy(u.sunColor.value);
    this.sun.intensity = 0.5 + k * 0.52;
    mixColor(this.hemi.color, SKY.hemiNight, SKY.hemiDay, k);
    mixColor(this.hemi.groundColor, SKY.groundNight, SKY.groundDay, k);
    this.hemi.intensity = 0.78 - k * 0.12;
    this.scene.fog.color.copy(u.horizon.value).multiplyScalar(0.96);
    this.scene.fog.density = lerp(0.0019, 0.00105, k);
    this.starMaterial.opacity = Math.max(0, 1 - k * 2.2);
    this.poolMaterial.opacity = Math.max(0, 0.34 * (1 - k * 1.6));
    this.glowMaterial.color.setScalar(0.55 + (1 - k) * 0.45);
    if (nvg) {
      this.hemi.color.setRGB(0.5, 1.0, 0.55);
      this.hemi.groundColor.setRGB(0.25, 0.6, 0.3);
      this.hemi.intensity = 1.25;
      this.scene.fog.color.setRGB(0.04, 0.16, 0.06);
      t2.setRGB(0.08, 0.3, 0.1);
      u.horizon.value.copy(t2);
      u.top.value.setRGB(0.02, 0.1, 0.03);
    }
    if (flash > 0) this.hemi.intensity += flash * 2;
    this.night = k < 0.3;
    this.dayShare = k;
  }

  // Each frame: the sky and the shadow box follow the camera, and far vegetation is skipped.
  update(camera, focus) {
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    const s = this.sun;
    s.target.position.set(focus.x, focus.y, focus.z);
    s.position.set(focus.x + this.sunDir.x * 220, focus.y + this.sunDir.y * 220, focus.z + this.sunDir.z * 220);
    s.target.updateMatrixWorld();
    const far = this.quality.treeDistance;
    for (const chunk of this.chunks) {
      const d = Math.hypot(chunk.x - camera.position.x, chunk.z - camera.position.z);
      chunk.mesh.visible = d < (chunk.small ? far * 0.55 : far) + CHUNK * 0.75;
    }
    for (const [id, inst] of Object.entries(this.pools)) inst.visible = this.poolMaterial.opacity > 0.01 && !this.world.powerOff[id];
    // at night the four lamps nearest you cast real light
    const night = Math.max(0, 1 - this.dayShare * 2.2);
    if (night <= 0) {
      for (const light of this.lampLights) light.intensity = 0;
    } else if (--this.lampTimer <= 0) {
      this.lampTimer = 20;
      const near = this.world.lamps
        .filter((l) => !this.world.powerOff[l.site])
        .map((l) => ({ l, d: (l.x - focus.x) ** 2 + (l.z - focus.z) ** 2 }))
        .filter((e) => e.d < 120 * 120)
        .sort((a, b) => a.d - b.d);
      this.lampLights.forEach((light, i) => {
        const e = near[i];
        light.intensity = e ? 1.5 * night : 0;
        if (e) light.position.set(e.l.x, e.l.y - 0.3, e.l.z);
      });
    }
  }

  setQuality(quality) {
    this.quality = quality;
    this.sun.castShadow = quality.shadows;
  }

  // A picture of the whole island from above, north up, for the minimap and the map screen.
  mapCanvas(size = 640) {
    if (this.map) return this.map;
    const t = this.world.terrain;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const x = (i / size) * t.size - t.half;
        const z = (j / size) * t.size - t.half;
        const h = t.heightAt(x, z);
        const depth = t.waterAt(x, z) - h;
        let r;
        let g;
        let b;
        if (depth > 0) {
          const k = Math.max(0.35, 1 - depth / 18);
          r = 40 * k + 14;
          g = 96 * k + 26;
          b = 128 * k + 34;
        } else {
          const rgb = groundColor(t.typeAt(x, z));
          const shade = 0.78 + (t.heightAt(x - 5, z - 5) - t.heightAt(x + 5, z + 5)) * 0.035 + h * 0.0012;
          const wood = t.forestAt(x, z) > 0.5 ? 0.86 : 1;
          r = rgb[0] * 255 * shade * wood;
          g = rgb[1] * 255 * shade * wood;
          b = rgb[2] * 255 * shade * wood;
          if (t.roadDistAt(x, z) < 4.5) {
            r = 196;
            g = 172;
            b = 126;
          }
        }
        const o = (j * size + i) * 4;
        img.data[o] = Math.max(0, Math.min(255, r));
        img.data[o + 1] = Math.max(0, Math.min(255, g));
        img.data[o + 2] = Math.max(0, Math.min(255, b));
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // footprints of what is built
    ctx.fillStyle = 'rgba(40,36,30,0.8)';
    const k = size / t.size;
    for (const shapes of Object.values(this.world.shapes)) {
      for (const s of shapes) {
        if (s.t !== 'box' || s.sy < 2 || s.sx * s.sz < 12 || s.sx * s.sz > 900) continue;
        ctx.fillRect((s.x - s.sx / 2 + t.half) * k, (s.z - s.sz / 2 + t.half) * k, Math.max(1, s.sx * k), Math.max(1, s.sz * k));
      }
    }
    this.map = canvas;
    return canvas;
  }

  dispose() {
    this.scene.remove(this.group, this.sky, this.stars, this.hemi, this.sun, this.sun.target);
    this.group.traverse((o) => {
      o.geometry?.dispose();
    });
    this.grain.dispose();
  }
}
