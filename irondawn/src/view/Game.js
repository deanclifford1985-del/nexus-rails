// The running game: owns the renderer, the simulation and everything that draws or sounds, runs
// the frame loop, and is the "host" that menus talk to (host.startMission, host.runCommand, ...).

import * as THREE from 'three';
import { World } from '../sim/world.js';
import { Sim } from '../sim/sim.js';
import { missionById } from '../game/missions.js';
import { LOCATIONS, sideOf } from '../game/world.js';
import { WorldView } from './WorldView.js';
import { ActorViews } from './ActorView.js';
import { Effects } from './Effects.js';
import { Hud } from './Hud.js';
import { GameAudio } from './Audio.js';
import { Input, TouchControls, blankInput } from './Input.js';

const STEP = 1 / 60;
const QUALITY = {
  low: { name: 'low', shadows: false, shadowSize: 1024, pixelRatio: 1, treeDistance: 380, antialias: false },
  medium: { name: 'medium', shadows: true, shadowSize: 1024, pixelRatio: 1.25, treeDistance: 620, antialias: true },
  high: { name: 'high', shadows: true, shadowSize: 2048, pixelRatio: 2, treeDistance: 900, antialias: true },
};

let sharedWorld = null;

export class Game {
  constructor({ canvas, hudRoot, api }) {
    this.canvas = canvas;
    this.api = api;
    const settings = api.settings();
    const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    const wanted = settings.quality === 'auto' ? (touch ? 'low' : (navigator.hardwareConcurrency ?? 4) >= 8 ? 'high' : 'medium') : settings.quality;
    this.quality = QUALITY[wanted] ?? QUALITY.medium;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.12, 5200);
    this.camera.rotation.order = 'YXZ';

    sharedWorld ??= new World();
    this.world = sharedWorld;
    this.world.powerOff = {};
    this.world.colliders.smokes.length = 0;
    this.sim = new Sim({ world: this.world, api, fov: settings.fov });
    this.worldView = new WorldView(this.world, this.scene, this.quality);
    this.actorViews = new ActorViews(this.scene, this.sim);
    this.effects = new Effects(this.scene, this.sim);
    this.audio = new GameAudio(() => api.settings().volume);
    this.hud = new Hud(hudRoot, this);
    this.input = new Input(canvas, {
      settings: () => api.settings(),
      blocked: () => !!api.overlay() || this.fading,
      menu: (name) => this.menu(name),
      fovScale: () => this.sim.player.fovScale,
      lockLost: () => {
        if (!api.overlay() && !this.fading) api.open('pause', {});
      },
    });
    if (this.input.isTouch) this.input.touch = new TouchControls(hudRoot, this.input);
    this.inp = blankInput();
    this.acc = 0;
    this.last = performance.now();
    this.fading = false;
    this.slow = 0;
    this.frames = 0;
    this.lastMission = null;
    this.revealed = new Set();
    this.unsubscribe = api.subscribe((save) => this.sim.onSave(save));
    this.resize = () => this.fit();
    window.addEventListener('resize', this.resize);
    this.fit();
    this.running = true;
    this.loop = (now) => this.frame(now);
    this.raf = requestAnimationFrame(this.loop);
    if (typeof window !== 'undefined') window.__irondawn = this;
  }

  fit() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- the frame ----------
  frame(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const sim = this.sim;
    const paused = !!this.api.overlay() || this.fading;
    if (!paused) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 4) {
        this.input.sample(this.inp, steps === 0);
        if (steps === 0) this.assist(this.inp);
        sim.step(STEP, this.inp);
        this.acc -= STEP;
        steps++;
      }
      if (steps === 4) this.acc = 0;
    } else {
      this.input.sample(this.inp, true);
      this.acc = 0;
    }
    this.drain();
    this.draw(dt, paused);
    this.watchSpeed(dt, paused);
  }

  // Runs the simulation without drawing: used by tests to get somewhere quickly.
  fastForward(seconds, bot = null) {
    const inp = blankInput();
    for (let i = 0; i < Math.round(seconds / STEP); i++) {
      Object.assign(inp, blankInput());
      if (bot) bot(inp, i);
      this.sim.step(STEP, inp);
      if (this.sim.ui.length) break;
    }
    this.sim.fx.length = 0;
    this.drain();
  }

  // On touch screens the sights drift gently onto a soldier who is nearly in them.
  assist(inp) {
    if (!this.input.isTouch || !this.api.settings().autoAim) return;
    const p = this.sim.player;
    if (!inp.fire && p.aimT < 0.5) return;
    let best = null;
    let bestAng = 0.09;
    for (const a of this.sim.actors) {
      if (!a.alive || a.kind !== 'enemy' || a.captured || a.surrendered) continue;
      const dx = a.x - p.cam.x;
      const dz = a.z - p.cam.z;
      const d = Math.hypot(dx, dz);
      if (d > 140) continue;
      let dyaw = Math.atan2(dx, -dz) - p.yaw;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      const dpitch = Math.atan2(a.y + 1.2 - p.cam.y, d) - p.pitch;
      const ang = Math.hypot(dyaw, dpitch);
      if (ang < bestAng) {
        bestAng = ang;
        best = { dyaw, dpitch };
      }
    }
    if (best) {
      inp.lookX += best.dyaw * 0.14;
      inp.lookY += best.dpitch * 0.14;
    }
  }

  // Hands what the simulation produced this frame to the view, the speakers and the menus.
  drain() {
    const sim = this.sim;
    const p = sim.player;
    for (const fx of sim.fx) {
      this.effects.play(fx);
      this.audio.play(fx, p);
      this.hud.event(fx);
    }
    sim.fx.length = 0;
    while (sim.ui.length) {
      const ev = sim.ui.shift();
      if (ev.open) {
        this.input.unlock();
        this.api.open(ev.open, ev.props ?? {});
      } else if (ev.trainingEnd) {
        const report = this.api.act('finishTraining', { event: ev.trainingEnd, result: ev.result });
        this.input.unlock();
        if (report) this.api.open('trainingResult', { event: ev.trainingEnd, report, result: ev.result });
      } else if (ev.missionEnd) {
        const mission = sim.mission?.def ?? missionById(this.api.getSave(), ev.missionEnd.missionId);
        const report = this.api.act('settleMission', ev.missionEnd);
        this.input.unlock();
        if (report) this.api.open('debrief', { report, stats: ev.missionEnd.stats, mission });
        else this.returnToBase();
      }
    }
  }

  draw(dt, paused) {
    const sim = this.sim;
    const p = sim.player;
    const cam = p.cam;
    const camera = this.camera;
    const shake = this.effects.shake;
    camera.position.set(cam.x, cam.y, cam.z);
    camera.rotation.set(cam.pitch + (Math.random() - 0.5) * shake * 0.05, -cam.yaw + (Math.random() - 0.5) * shake * 0.05, 0);
    if (Math.abs(camera.fov - cam.fov) > 0.01) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }
    this.worldView.setTime(sim.hour, p.nvg, this.effects.flash);
    this.worldView.update(camera, p);
    this.actorViews.sync(paused ? 0 : dt, camera, cam.zoom ?? 1);
    this.effects.update(paused ? 0 : dt, camera);
    this.hud.update(dt, camera, paused);
    this.audio.update(sim, paused);
    if (this.input.touch) this.input.touch.show({ use: !!p.prompt, squad: sim.squad().length > 0, scoped: p.scoped || p.binoc });
    this.renderer.render(this.scene, camera);
  }

  // If the machine cannot keep up, give up shadows and resolution rather than playability.
  watchSpeed(dt, paused) {
    if (paused) return;
    this.frames++;
    this.slow += dt;
    if (this.frames < 240) return;
    const average = this.slow / this.frames;
    this.frames = 0;
    this.slow = 0;
    if (average > 0.04 && this.api.settings().quality === 'auto' && this.quality.name !== 'low') {
      this.quality = this.quality.name === 'high' ? QUALITY.medium : QUALITY.low;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
      this.renderer.shadowMap.enabled = this.quality.shadows;
      this.worldView.setQuality(this.quality);
      this.fit();
    }
  }

  // ---------- fades ----------
  fade(run) {
    if (this.fading) return;
    this.fading = true;
    this.hud.setFade(true);
    window.setTimeout(() => {
      run();
      window.setTimeout(() => {
        this.hud.setFade(false);
        this.fading = false;
        this.last = performance.now();
      }, 260);
    }, 360);
  }

  // ---------- the host: what menus can ask for ----------
  state() {
    const sim = this.sim;
    const p = sim.player;
    return { mode: sim.mode, atBase: Math.hypot(p.x - this.world.sites.hawthorne.x, p.z - this.world.sites.hawthorne.z) < 260, missionId: sim.mission?.def.id ?? null, hour: sim.hour, day: sim.day };
  }

  resume() {
    this.api.close();
    this.input.lock();
    this.last = performance.now();
  }

  // Tab, M and Esc.
  menu(name) {
    const open = this.api.overlay();
    if (open) {
      if (open.name === 'menu' || open.name === 'pause') this.resume();
      return;
    }
    if (this.fading) return;
    this.input.unlock();
    if (name === 'pause') this.api.open('pause', {});
    else this.api.open('menu', { tab: name === 'map' ? 'map' : 'character' });
  }

  runCommand(cmd) {
    const sim = this.sim;
    switch (cmd?.type) {
      case 'overlay': {
        const { type, name, ...props } = cmd;
        void type;
        this.api.open(name, props);
        break;
      }
      case 'training':
        this.startTraining(cmd.id);
        break;
      case 'specChosen':
        sim.feedMsg('Kit issued. Report to Drill Sergeant Briggs on the parade ground.', 'gold');
        this.resume();
        break;
      case 'graduate': {
        const report = this.api.act('graduate', {});
        if (report) this.api.open('graduation', { report });
        else this.resume();
        break;
      }
      case 'promote': {
        const report = this.api.act('promote', {});
        if (report) {
          this.audio.cue('fanfare');
          this.api.open('promotion', { report });
        } else this.resume();
        break;
      }
      case 'heal':
        sim.player.health = sim.derived.maxHealth;
        sim.feedMsg('Patched up. Full health.', 'good');
        this.resume();
        break;
      case 'flag':
        this.api.act('setFlag', { flag: cmd.flag, value: cmd.value ?? true }, { quiet: true });
        this.resume();
        break;
      case 'revealCache': {
        const p = sim.player;
        const open = this.world.caches.filter((c) => !this.api.getSave().world.looted[c.id] && !this.revealed.has(c.id));
        open.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
        if (open[0]) {
          this.revealed.add(open[0].id);
          sim.feedMsg('A supply cache has been marked on your map.', 'good');
          sim.practice('negotiating', 4);
        }
        this.resume();
        break;
      }
      default:
        this.resume();
    }
  }

  startTraining(id) {
    this.api.close();
    this.fade(() => {
      this.sim.startTraining(id);
      this.input.lock();
    });
  }

  // Called by the exam screen, which is a training event with no field part.
  finishTraining(event, result) {
    const report = this.api.act('finishTraining', { event, result });
    if (report) this.api.open('trainingResult', { event, report, result });
    else this.resume();
  }

  startMission(missionId, plan = []) {
    const started = this.api.act('startMission', { missionId, plan });
    if (!started) return false;
    this.lastMission = { missionId, plan: started.plan };
    this.api.close();
    this.sim.flush();
    this.fade(() => {
      this.sim.godMode = false;
      this.sim.startMission(started.mission, started.plan);
      this.input.lock();
    });
    return true;
  }

  retryMission() {
    if (!this.lastMission) return this.returnToBase();
    const { missionId, plan } = this.lastMission;
    this.sim.returnToBase();
    this.sim.godMode = false;
    if (!this.startMission(missionId, plan)) this.resume();
  }

  returnToBase() {
    this.api.close();
    this.fade(() => {
      this.sim.godMode = false;
      this.sim.returnToBase();
      this.input.lock();
    });
  }

  abortMission() {
    this.api.close();
    if (this.sim.mode === 'training') this.sim.abortTraining();
    else this.sim.abortMission();
    this.input.lock();
  }

  travel(locationId) {
    this.api.close();
    this.fade(() => {
      this.sim.travel(locationId);
      this.input.lock();
    });
  }

  rest(untilHour) {
    const report = this.api.act('rest', { until: untilHour });
    this.api.close();
    this.fade(() => {
      const save = this.api.getSave();
      this.sim.hour = save.world.hour;
      this.sim.day = save.world.day;
      this.sim.player.health = this.sim.derived.maxHealth;
      this.sim.player.stamina = this.sim.derived.maxStamina;
      if (report) this.sim.feedMsg(`You slept ${Math.round(report.hours)} hours.`, 'good');
      this.input.lock();
    });
  }

  // For the map screen: a picture of the island and what to mark on it.
  mapData() {
    const sim = this.sim;
    const p = sim.player;
    const save = this.api.getSave();
    const markers = [];
    for (const m of sim.objective?.markers ?? []) markers.push({ x: m.x, z: m.z, kind: 'objective', label: m.label, r: m.r });
    for (const a of sim.actors) {
      if (!a.alive) continue;
      if (a.kind === 'squad') markers.push({ x: a.x, z: a.z, kind: 'squad', label: a.name });
      else if (a.kind === 'enemy' && a.tagged > sim.time) markers.push({ x: a.x, z: a.z, kind: 'enemy', label: a.name });
      else if (a.kind === 'npc' && Math.hypot(a.x - p.x, a.z - p.z) < 400) markers.push({ x: a.x, z: a.z, kind: 'npc', label: a.name });
    }
    for (const c of this.world.caches) if (this.revealed.has(c.id) && !save.world.looted[c.id]) markers.push({ x: c.x, z: c.z, kind: 'cache', label: 'Supply cache' });
    return { image: this.worldView.mapCanvas(), player: { x: p.x, z: p.z, yaw: p.yaw }, markers, sides: Object.fromEntries(LOCATIONS.map((l) => [l.id, sideOf(save, l.id)])) };
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.unsubscribe?.();
    this.sim.flush();
    if (this.sim.mode === 'roam') this.api.act('setClock', { hour: this.sim.hour, day: this.sim.day }, { quiet: true });
    this.input.dispose();
    this.hud.dispose();
    this.audio.dispose();
    this.effects.dispose();
    this.actorViews.dispose();
    this.worldView.dispose();
    this.renderer.dispose();
    if (typeof window !== 'undefined' && window.__irondawn === this) window.__irondawn = null;
  }
}
