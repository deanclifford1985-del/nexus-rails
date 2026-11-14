// The heads-up display, drawn in plain DOM over the 3D canvas and updated each frame straight
// from the simulation (no React here: it changes sixty times a second).

import * as THREE from 'three';
import { RANKS } from '../game/ranks.js';
import { levelProgress } from '../game/character.js';
import { ITEMS } from '../game/items.js';

const TEMPLATE = `
<div class="hud">
  <div class="hud-map"><canvas width="176" height="176"></canvas><div class="hud-clock"></div></div>
  <div class="hud-compass"><canvas width="420" height="34"></canvas></div>
  <div class="hud-obj"><div class="obj-title"></div><div class="obj-lines"></div><div class="obj-bar"><i></i></div><div class="obj-timer"></div></div>
  <div class="hud-feed"></div>
  <div class="hud-squad"></div>
  <div class="hud-radio"><b></b><span></span></div>
  <div class="hud-markers"></div>
  <div class="hud-dmg"></div>
  <div class="hud-center">
    <div class="cross"><i class="c-t"></i><i class="c-b"></i><i class="c-l"></i><i class="c-r"></i><i class="c-dot"></i></div>
    <div class="hitmark"></div>
    <div class="eye"><div class="eye-bar"><i></i></div><span></span></div>
    <div class="prompt"><b>F</b><span></span><div class="prompt-bar"><i></i></div></div>
    <div class="busy"><span></span><div><i></i></div></div>
  </div>
  <div class="hud-scope"><div class="scope-glass"><i class="s-h"></i><i class="s-v"></i><i class="s-m1"></i><i class="s-m2"></i><i class="s-m3"></i></div><div class="scope-info"></div><div class="breath"><i></i></div></div>
  <div class="hud-binoc"><div class="binoc-glass"><i class="b-mark"></i><div class="binoc-tag"><i></i></div></div><div class="scope-info"></div><div class="breath"><i></i></div></div>
  <div class="hud-vitals">
    <div class="rankline"><b></b><span></span><em></em></div>
    <div class="xpbar"><i></i></div>
    <div class="bar hp"><i></i><span></span></div>
    <div class="bar st"><i></i></div>
    <div class="stance"></div>
  </div>
  <div class="hud-support"></div>
  <div class="hud-items"></div>
  <div class="hud-weapon"><div class="w-name"></div><div class="w-ammo"><b></b><span></span></div><div class="w-sub"></div><div class="w-reload"><i></i></div></div>
  <div class="hud-banner"></div>
  <div class="hud-hints"></div>
  <div class="hud-vig"></div>
  <div class="hud-nvg"></div>
  <div class="hud-flash"></div>
  <div class="hud-fade"></div>
</div>`;

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const TONES = { xp: 'f-xp', gold: 'f-gold', good: 'f-good', bad: 'f-bad', warn: 'f-warn', order: 'f-order', skill: 'f-skill', info: '' };
const two = (n) => String(Math.floor(n)).padStart(2, '0');
const clock = (hour) => `${two(hour)}:${two((hour % 1) * 60)}`;
const mmss = (s) => `${Math.floor(s / 60)}:${two(s % 60)}`;

export class Hud {
  constructor(root, game) {
    this.game = game;
    this.sim = game.sim;
    root.insertAdjacentHTML('beforeend', TEMPLATE);
    this.el = root.querySelector('.hud');
    const q = (sel) => this.el.querySelector(sel);
    this.q = q;
    this.map = q('.hud-map canvas');
    this.mapCtx = this.map.getContext('2d');
    this.compass = q('.hud-compass canvas');
    this.compassCtx = this.compass.getContext('2d');
    this.cache = {};
    this.markers = [];
    this.markerRoot = q('.hud-markers');
    this.dmgRoot = q('.hud-dmg');
    this.dmg = [];
    this.v = new THREE.Vector3();
    this.mapTimer = 0;
    this.slowTimer = 0;
    this.hitT = 0;
    this.banner = null;
    this.bannerUntil = 0;
    this.feedSeen = 0;
    this.touch = game.input?.isTouch ?? false;
    if (this.touch) this.el.classList.add('is-touch');
  }

  // Sets text or a style only when it has changed.
  text(key, el, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    el.textContent = value;
  }
  html(key, el, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    el.innerHTML = value;
  }
  style(key, el, prop, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    el.style[prop] = value;
  }
  show(key, el, on) {
    this.style(`show:${key}`, el, 'display', on ? '' : 'none');
  }

  setFade(on) {
    this.q('.hud-fade').classList.toggle('on', on);
  }

  event(fx) {
    const sim = this.sim;
    if (fx.t === 'hitmark') {
      this.hitT = 0.22;
      const el = this.q('.hitmark');
      el.className = `hitmark on${fx.kill ? ' kill' : ''}${fx.head ? ' head' : ''}`;
    } else if (fx.t === 'hurt' && fx.fromX !== undefined) {
      const p = sim.player;
      const rel = Math.atan2(fx.fromX - p.x, -(fx.fromZ - p.z)) - p.yaw;
      const el = document.createElement('i');
      el.style.transform = `rotate(${rel}rad)`;
      this.dmgRoot.appendChild(el);
      this.dmg.push({ el, t: 1.1 });
    } else if (fx.t === 'missionwon') this.showBanner('MISSION COMPLETE', 'gold', 3);
    else if (fx.t === 'missionlost') this.showBanner('MISSION FAILED', 'bad', 3.4);
    else if (fx.t === 'playerdown') this.showBanner('YOU ARE DOWN', 'bad', 2.5);
    else if (fx.t === 'levelup') this.showBanner('LEVEL UP', 'gold', 2);
    else if (fx.t === 'wave') this.showBanner('INCOMING', 'bad', 1.6);
    else if (fx.t === 'alarm') this.showBanner('ALARM RAISED', 'bad', 2);
  }

  showBanner(text, tone, seconds) {
    this.banner = { text, tone };
    this.bannerUntil = performance.now() + seconds * 1000;
  }

  update(dt, camera, paused) {
    const sim = this.sim;
    const p = sim.player;
    const d = sim.derived;
    const q = this.q;
    const save = sim.save;
    const cam = p.cam;
    const scoped = cam.mode === 'scope';
    const binoc = cam.mode === 'binoc';

    // ----- crosshair, hit marker, prompt -----
    const w = p.weapon;
    const crossOn = !scoped && !binoc && p.alive && !p.downed && !paused;
    this.show('cross', q('.cross'), crossOn);
    if (crossOn) {
      // gap follows how wide the next shot would spread
      let spread = 2.2;
      if (w) {
        const aimed = p.aimT > 0.85;
        spread = w.eff.spread * (aimed ? 1 : 2.4 * (w.eff.hip ?? 1)) * (p.stance === 'prone' ? 0.5 : p.stance === 'crouch' ? 0.72 : 1) * (1 + Math.min(1, p.speedNow / 7) * 0.9) * (1 + p.bloom);
      }
      const px = Math.round(Math.max(3, Math.min(60, (spread / Math.max(8, cam.fov)) * window.innerHeight * 0.55)));
      this.style('crossgap', q('.cross'), '--gap', `${px}px`);
    }
    if (this.hitT > 0) {
      this.hitT -= dt;
      if (this.hitT <= 0) q('.hitmark').className = 'hitmark';
    }
    const prompt = !paused && p.prompt;
    this.show('prompt', q('.prompt'), !!prompt);
    if (prompt) {
      this.text('prompt', q('.prompt span'), prompt.hold ? `Hold: ${prompt.text}` : prompt.text);
      this.style('promptbar', q('.prompt-bar i'), 'width', `${Math.round((prompt.progress ?? 0) * 100)}%`);
      this.show('promptbarshow', q('.prompt-bar'), !!prompt.hold);
    }
    const busy = p.busy > 0 && p.busyTotal && (p.busyKind === 'medkit' || p.busyKind === 'bandage' || p.busyKind === 'takedown' || p.busyKind === 'stim');
    this.show('busy', q('.busy'), !!busy);
    if (busy) {
      this.text('busytext', q('.busy span'), p.busyKind === 'takedown' ? 'Takedown' : p.busyKind === 'stim' ? 'Injecting' : 'Treating wounds');
      this.style('busybar', q('.busy i'), 'width', `${Math.round((1 - p.busy / p.busyTotal) * 100)}%`);
    }

    // ----- how noticed you are -----
    const fight = sim.combatCount > 0;
    const watch = p.watch;
    const eyeOn = !paused && p.alive && (fight || watch > 0.04 || sim.alarmOn()) && sim.mode !== 'roam' ? true : !paused && (fight || watch > 0.04);
    this.show('eye', q('.eye'), eyeOn);
    if (eyeOn) {
      const state = fight ? 'spotted' : watch >= 0.7 ? 'alert' : watch >= 0.35 ? 'curious' : 'hidden';
      if (this.cache.eyeState !== state) {
        this.cache.eyeState = state;
        q('.eye').className = `eye ${state}`;
      }
      this.text('eyetext', q('.eye span'), fight ? (sim.alarmOn() ? 'ALARM' : 'SPOTTED') : watch >= 0.7 ? 'THEY ARE LOOKING' : watch >= 0.35 ? 'SUSPICIOUS' : 'UNSEEN');
      this.style('eyebar', q('.eye-bar i'), 'width', `${Math.round((fight ? 1 : watch) * 100)}%`);
    }

    // ----- optics -----
    this.show('scope', q('.hud-scope'), scoped);
    this.show('binoc', q('.hud-binoc'), binoc);
    if (scoped || binoc) {
      const root = scoped ? q('.hud-scope') : q('.hud-binoc');
      const range = p.rangeTo && d.rangefinder ? `  ·  ${Math.round(p.rangeTo)} m` : '';
      this.text(scoped ? 'scopeinfo' : 'binocinfo', root.querySelector('.scope-info'), `${cam.zoom}×${range}${this.touch ? '' : '   Shift: hold breath'}`);
      this.style(scoped ? 'breath1' : 'breath2', root.querySelector('.breath i'), 'width', `${Math.round(p.breath * 100)}%`);
      if (binoc) {
        const tag = q('.binoc-tag');
        this.show('tagring', tag, p.tagT > 0.02);
        this.style('tagfill', tag.querySelector('i'), 'width', `${Math.round(Math.min(1, p.tagT) * 100)}%`);
      }
    }

    // ----- vitals -----
    const hp = Math.max(0, p.health);
    this.style('hpw', q('.hp i'), 'width', `${Math.round((hp / d.maxHealth) * 100)}%`);
    this.text('hpt', q('.hp span'), `${Math.ceil(hp)}`);
    this.style('stw', q('.st i'), 'width', `${Math.round((p.stamina / d.maxStamina) * 100)}%`);
    const hpClass = hp / d.maxHealth < 0.3 ? 'bar hp low' : 'bar hp';
    if (this.cache.hpClass !== hpClass) {
      this.cache.hpClass = hpClass;
      q('.hp').className = hpClass;
    }
    this.text('stance', q('.stance'), p.downed ? 'DOWN' : p.stance === 'stand' ? (p.sprinting ? 'SPRINT' : 'STANDING') : p.stance === 'crouch' ? 'CROUCHED' : 'PRONE');
    this.text('rank', q('.rankline b'), RANKS[save.rank].abbr);
    this.text('name', q('.rankline span'), save.name);
    this.text('lvl', q('.rankline em'), `LV ${save.level}`);
    this.style('xp', q('.xpbar i'), 'width', `${Math.round(levelProgress(save).share * 100)}%`);

    // ----- weapon and kit -----
    this.show('weapon', q('.hud-weapon'), !!w);
    if (w) {
      this.text('wname', q('.w-name'), w.eff.name);
      this.text('wmag', q('.w-ammo b'), String(w.mag));
      this.text('wres', q('.w-ammo span'), `/ ${w.reserve}`);
      const count = p.items[p.throwable] ?? 0;
      this.text('wsub', q('.w-sub'), `${w.eff.auto ? 'AUTO' : w.eff.bolt ? 'BOLT' : 'SEMI'}${w.eff.suppressed ? ' · SUPPRESSED' : ''}   ${count > 0 ? `${ITEMS[p.throwable].name.toUpperCase()} ×${count}` : ''}`);
      const reloading = p.reloading > 0;
      this.show('wreload', q('.w-reload'), reloading);
      if (reloading) this.style('wreloadbar', q('.w-reload i'), 'width', `${Math.round((1 - p.reloading / w.eff.reload) * 100)}%`);
      const low = w.mag <= Math.max(1, Math.floor(w.eff.mag * 0.2)) ? 'w-ammo low' : 'w-ammo';
      if (this.cache.ammoClass !== low) {
        this.cache.ammoClass = low;
        q('.w-ammo').className = low;
      }
    }
    const items = `${p.items.medkit ? `<span><b>${this.touch ? '' : 'H'}</b> Medkit ×${p.items.medkit}</span>` : ''}${p.items.bandage ? `<span><b>${this.touch ? '' : 'J'}</b> Bandage ×${p.items.bandage}</span>` : ''}${p.items.stim ? `<span><b>${this.touch ? '' : 'K'}</b> Stim ×${p.items.stim}</span>` : ''}${p.nvg ? '<span class="on">NVG</span>' : ''}`;
    this.html('items', q('.hud-items'), items);

    // ----- slower things: objective, squad, feed, radio, support -----
    this.slowTimer -= dt;
    if (this.slowTimer <= 0) {
      this.slowTimer = 0.2;
      this.updateSlow();
    }
    // the banner: training countdowns, or a moment's announcement
    const now = performance.now();
    const trainingBanner = sim.objective?.banner ?? null;
    const banner = trainingBanner ? { text: trainingBanner, tone: 'gold' } : now < this.bannerUntil ? this.banner : null;
    this.show('banner', q('.hud-banner'), !!banner);
    if (banner) {
      this.text('bannertext', q('.hud-banner'), banner.text);
      if (this.cache.bannerTone !== banner.tone) {
        this.cache.bannerTone = banner.tone;
        q('.hud-banner').className = `hud-banner ${banner.tone}`;
      }
    }
    const timer = sim.objective?.timer;
    this.show('timer', q('.obj-timer'), timer !== null && timer !== undefined);
    if (timer !== null && timer !== undefined) this.text('timer', q('.obj-timer'), sim.objective.countUp ? `${timer.toFixed(1)} s` : mmss(Math.ceil(timer)));

    // ----- the screen itself -----
    const hurt = sim.time - p.lastHurt < 0.5 ? 0.5 : 0;
    const low = hp / d.maxHealth < 0.35 ? 0.35 + 0.2 * Math.sin(sim.time * 5) : 0;
    const vig = p.downed ? 0.85 : Math.max(hurt, low);
    this.style('vig', q('.hud-vig'), 'opacity', vig.toFixed(2));
    this.style('flash', q('.hud-flash'), 'opacity', Math.max(0, Math.min(1, p.flashed / 1.5)).toFixed(2));
    this.show('nvg', q('.hud-nvg'), p.nvg);

    this.updateCompass(camera);
    this.updateMarkers(camera, paused);
    for (let i = this.dmg.length - 1; i >= 0; i--) {
      const m = this.dmg[i];
      m.t -= dt;
      m.el.style.opacity = Math.max(0, m.t).toFixed(2);
      if (m.t <= 0) {
        m.el.remove();
        this.dmg.splice(i, 1);
      }
    }
    this.mapTimer -= dt;
    if (this.mapTimer <= 0) {
      this.mapTimer = 0.1;
      this.updateMap();
    }
  }

  updateSlow() {
    const sim = this.sim;
    const q = this.q;
    const o = sim.objective;
    this.show('obj', q('.hud-obj'), !!o);
    if (o) {
      this.text('objtitle', q('.obj-title'), o.title);
      const lines = o.lines.map((l) => `<div class="ol ${l.state}">${l.text}${l.progress ? ` <b>${l.progress}</b>` : ''}</div>`).join('') + (o.bonus ?? []).map((b) => `<div class="ol bonus ${b.state}">${b.text}</div>`).join('');
      this.html('objlines', q('.obj-lines'), lines);
      const asset = o.asset;
      this.show('objbar', q('.obj-bar'), asset !== null && asset !== undefined);
      if (asset !== null && asset !== undefined) this.style('objbarw', q('.obj-bar i'), 'width', `${Math.round(Math.max(0, asset) * 100)}%`);
    }
    // squad and anyone fighting beside you
    const mates = sim.actors.filter((a) => (a.kind === 'squad' || a.escort) && (a.alive || a.downed));
    const orderName = { follow: 'ON ME', hold: 'HOLDING', move: 'MOVING' };
    const squad = mates
      .map((a) => `<div class="sq${a.downed ? ' down' : ''}"><span>${a.name}</span><div><i style="width:${Math.round(Math.max(0, a.health / a.maxHealth) * 100)}%"></i></div><em>${a.downed ? 'DOWN' : a.kind === 'squad' ? (orderName[a.ai.order] ?? '') : ''}</em></div>`)
      .join('');
    this.html('squad', q('.hud-squad'), squad ? `${squad}${sim.squad().length ? `<div class="sq-mode">${sim.holdFire ? 'HOLD FIRE' : 'WEAPONS FREE'}</div>` : ''}` : '');
    // the feed: newest at the bottom, each line a few seconds
    const recent = sim.feed.filter((f) => sim.time - f.t < 6.5).slice(-6);
    this.html('feed', q('.hud-feed'), recent.map((f) => `<div class="${TONES[f.tone] ?? ''}">${f.text}</div>`).join(''));
    const radio = sim.radio[sim.radio.length - 1];
    const radioOn = !!radio && sim.time - radio.t < Math.max(4, radio.text.length * 0.075);
    this.show('radio', q('.hud-radio'), radioOn);
    if (radioOn) {
      this.text('radiowho', q('.hud-radio b'), radio.who);
      this.text('radiotext', q('.hud-radio span'), radio.text);
    }
    const supports = sim.mode === 'mission' ? sim.supports() : [];
    if (supports.length) {
      const s = supports[sim.supportIndex % supports.length];
      this.html('support', q('.hud-support'), `<b>${this.touch ? '' : 'T'}</b> ${s.name} <em>${s.ready > 0 ? `${Math.ceil(s.ready)} s` : 'READY'}</em>${supports.length > 1 && !this.touch ? ' <small>Y: next</small>' : ''}`);
    } else this.html('support', q('.hud-support'), '');
    this.text('clock', q('.hud-clock'), `DAY ${sim.day}  ${clock(sim.hour)}`);
    // key hints while you are new
    const settings = this.game.api.settings();
    let hints = '';
    if (settings.hints && !this.touch) {
      if (sim.mode === 'training') hints = 'P: pause or leave the evaluation';
      else if (sim.save.phase !== 'service') hints = 'WASD move · Shift sprint · C crouch · Z prone · Space jump or climb · F talk · Tab field menu';
      else if (sim.mode === 'mission' && sim.save.stats.missions < 2) hints = 'RMB aim · R reload · E grenade · B binoculars · H medkit · V melee · F use · M map';
      else if (sim.mode === 'mission' && sim.squad().length && sim.save.stats.squadKills < 10) hints = '5 on me · 6 hold · 7 move there · 8 attack that one · G hold fire or weapons free';
    }
    this.text('hints', q('.hud-hints'), hints);
  }

  updateCompass() {
    const sim = this.sim;
    const p = sim.player;
    const ctx = this.compassCtx;
    const W = this.compass.width;
    const H = this.compass.height;
    ctx.clearRect(0, 0, W, H);
    const yawDeg = (((p.yaw * 180) / Math.PI) % 360 + 360) % 360;
    const span = 120;
    const pxPer = W / span;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let deg = 0; deg < 360; deg += 15) {
      let diff = deg - yawDeg;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      if (Math.abs(diff) > span / 2) continue;
      const x = W / 2 + diff * pxPer;
      const major = deg % 45 === 0;
      ctx.fillStyle = major ? 'rgba(223,230,212,0.95)' : 'rgba(223,230,212,0.5)';
      if (major) {
        ctx.font = `600 ${deg % 90 === 0 ? 15 : 12}px Rajdhani, sans-serif`;
        ctx.fillText(COMPASS[deg / 45], x, 12);
      } else ctx.fillRect(x - 0.5, 8, 1, 8);
    }
    for (const m of sim.objective?.markers ?? []) {
      let diff = (Math.atan2(m.x - p.x, -(m.z - p.z)) * 180) / Math.PI - yawDeg;
      diff = ((diff + 540) % 360) - 180;
      const x = Math.max(8, Math.min(W - 8, W / 2 + diff * pxPer));
      ctx.fillStyle = m.kind === 'exfil' ? '#7fe08a' : m.kind === 'target' ? '#ff6a50' : m.kind === 'npc' ? '#9fd0ff' : '#f0c24a';
      ctx.beginPath();
      ctx.moveTo(x, 22);
      ctx.lineTo(x - 5, 32);
      ctx.lineTo(x + 5, 32);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#f0c24a';
    ctx.fillRect(W / 2 - 1, 20, 2, 12);
  }

  // Labels pinned to things in the world: objectives, tagged enemies, your people.
  updateMarkers(camera, paused) {
    const sim = this.sim;
    const p = sim.player;
    const list = [];
    if (!paused) {
      for (const m of sim.objective?.markers ?? []) {
        if (m.kind === 'area') continue;
        list.push({ x: m.x, y: m.y, z: m.z, cls: `mk-obj ${m.kind}`, label: m.label, clamp: true });
      }
      for (const a of sim.actors) {
        if (!a.alive) continue;
        if (a.kind === 'enemy' && !a.captured) {
          if (a.tagged > sim.time) list.push({ x: a.x, y: a.y + (a.stance === 'stand' ? 2.05 : 1.45), z: a.z, cls: `mk-foe${a.isTarget ? ' target' : ''}${a.surrendered ? ' yield' : ''}`, label: a.isTarget ? a.name : '' });
        } else if (a.kind === 'squad' || a.escort) list.push({ x: a.x, y: a.y + 2.1, z: a.z, cls: `mk-ally${a.downed ? ' down' : ''}`, label: a.downed ? `${a.name} DOWN` : '' });
        else if (a.kind === 'captive' || a.kind === 'prisoner') list.push({ x: a.x, y: a.y + 1.9, z: a.z, cls: 'mk-civ', label: '' });
        else if (a.kind === 'npc' && Math.hypot(a.x - p.x, a.z - p.z) < 26) list.push({ x: a.x, y: a.y + 2.15, z: a.z, cls: 'mk-npc', label: a.name });
      }
    }
    const W = window.innerWidth;
    const H = window.innerHeight;
    const v = this.v;
    let n = 0;
    for (const m of list) {
      v.set(m.x, m.y, m.z).project(camera);
      let x = (v.x * 0.5 + 0.5) * W;
      let y = (-v.y * 0.5 + 0.5) * H;
      const behind = v.z > 1;
      const off = behind || x < 0 || x > W || y < 0 || y > H;
      if (off && !m.clamp) continue;
      if (off) {
        if (behind) {
          x = W - x;
          y = H - 40;
        }
        x = Math.max(46, Math.min(W - 46, x));
        y = Math.max(96, Math.min(H - 150, y));
      }
      let el = this.markers[n];
      if (!el) {
        el = document.createElement('div');
        el.innerHTML = '<i></i><span></span>';
        this.markerRoot.appendChild(el);
        this.markers.push(el);
        el._c = {};
      }
      n++;
      const c = el._c;
      const dist = Math.hypot(m.x - p.x, m.z - p.z);
      const cls = `mk ${m.cls}${off ? ' off' : ''}`;
      if (c.cls !== cls) {
        c.cls = cls;
        el.className = cls;
      }
      const label = m.clamp ? `${m.label ?? ''} ${Math.round(dist)} m` : (m.label ?? '');
      if (c.label !== label) {
        c.label = label;
        el.lastChild.textContent = label;
      }
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      if (c.shown !== true) {
        c.shown = true;
        el.style.display = '';
      }
    }
    for (let i = n; i < this.markers.length; i++) {
      const el = this.markers[i];
      if (el._c.shown !== false) {
        el._c.shown = false;
        el.style.display = 'none';
      }
    }
  }

  updateMap() {
    const sim = this.sim;
    const p = sim.player;
    const ctx = this.mapCtx;
    const S = this.map.width;
    const image = this.game.worldView.mapCanvas();
    const world = sim.world.terrain.size;
    const view = 260; // metres across
    const k = image.width / world;
    ctx.fillStyle = '#16303a';
    ctx.fillRect(0, 0, S, S);
    ctx.drawImage(image, (p.x + world / 2 - view / 2) * k, (p.z + world / 2 - view / 2) * k, view * k, view * k, 0, 0, S, S);
    const px = (x) => ((x - p.x) / view + 0.5) * S;
    const pz = (z) => ((z - p.z) / view + 0.5) * S;
    const dot = (x, z, r, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px(x), pz(z), r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const m of sim.objective?.markers ?? []) {
      const x = Math.max(6, Math.min(S - 6, px(m.x)));
      const z = Math.max(6, Math.min(S - 6, pz(m.z)));
      ctx.strokeStyle = m.kind === 'exfil' ? '#7fe08a' : m.kind === 'target' ? '#ff6a50' : m.kind === 'npc' ? '#9fd0ff' : '#f0c24a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (m.kind === 'area') ctx.arc(px(m.x), pz(m.z), ((m.r ?? 40) / view) * S, 0, Math.PI * 2);
      else ctx.rect(x - 4, z - 4, 8, 8);
      ctx.stroke();
    }
    for (const a of sim.actors) {
      if (!a.alive) continue;
      if (a.kind === 'enemy' && !a.captured) {
        if (a.tagged > sim.time) dot(a.x, a.z, 3, a.isTarget ? '#ffb340' : '#ff5a46');
        else if (a.sensed > sim.time) dot(a.x, a.z, 3, 'rgba(255,90,70,0.45)');
      } else if (a.kind === 'squad' || a.escort) dot(a.x, a.z, 3, a.downed ? '#8894a0' : '#6fc3ff');
      else if (a.kind === 'ally') dot(a.x, a.z, 2.2, 'rgba(111,195,255,0.6)');
      else if (a.kind === 'captive' || a.kind === 'prisoner') dot(a.x, a.z, 2.5, '#f2f4ec');
      else if (a.kind === 'npc') dot(a.x, a.z, 2.5, '#f0c24a');
    }
    // you
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(p.yaw);
    ctx.fillStyle = '#f2f4ec';
    ctx.strokeStyle = '#10150e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  dispose() {
    this.el.remove();
  }
}
