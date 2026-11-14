// Turns keyboard, mouse and touch into the one input record the simulation reads each step.
// Keys held are states; key presses are edges that are handed to the simulation exactly once.

const LOOK = 0.0021; // radians per pixel of mouse travel at sensitivity 1
const TOUCH_LOOK = 0.0052;

const KEY_EDGES = {
  Space: 'jump',
  KeyC: 'crouch',
  KeyZ: 'prone',
  KeyR: 'reload',
  KeyF: 'interact',
  KeyQ: 'swap',
  KeyE: 'grenade',
  Digit3: 'nextThrowable',
  KeyV: 'melee',
  KeyB: 'binoc',
  KeyN: 'nvg',
  KeyH: 'medkit',
  KeyJ: 'bandage',
  KeyK: 'stim',
  KeyT: 'support',
  KeyY: 'supportNext',
};
const KEY_ORDERS = { Digit5: 'follow', Digit6: 'hold', Digit7: 'move', Digit8: 'attack', KeyG: 'fire' };

export const blankInput = () => ({
  moveX: 0, moveZ: 0, lookX: 0, lookY: 0, fire: false, firePressed: false, aim: false, sprint: false, walk: false, jump: false, crouch: false, prone: false,
  reload: false, interact: false, interactHeld: false, slot: 0, swap: false, grenade: false, nextThrowable: false, melee: false, binoc: false, nvg: false,
  medkit: false, bandage: false, stim: false, breath: false, zoom: 0, order: null, support: false, supportNext: false,
});

export class Input {
  constructor(canvas, host) {
    this.canvas = canvas;
    this.host = host; // { settings(), blocked(), menu(name), fovScale() }
    this.keys = new Set();
    this.edges = new Set();
    this.order = null;
    this.slot = 0;
    this.zoom = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.fireHeld = false;
    this.firePressed = false;
    this.aimHeld = false;
    this.locked = false;
    this.touch = null;
    this.isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia?.('(pointer: coarse)').matches;
    this.listen();
  }

  listen() {
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      (this.offs ??= []).push(() => target.removeEventListener(type, fn, opts));
    };
    on(window, 'keydown', (e) => this.keyDown(e));
    on(window, 'keyup', (e) => this.keys.delete(e.code));
    on(window, 'blur', () => this.release());
    on(this.canvas, 'mousedown', (e) => this.mouseDown(e));
    on(window, 'mouseup', (e) => this.mouseUp(e));
    on(window, 'mousemove', (e) => this.mouseMove(e));
    on(this.canvas, 'wheel', (e) => this.wheel(e), { passive: false });
    on(this.canvas, 'contextmenu', (e) => e.preventDefault());
    on(document, 'pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      if (was && !this.locked) {
        this.release();
        this.host.lockLost();
      }
    });
    on(document, 'pointerlockerror', () => {
      this.locked = false;
    });
  }

  release() {
    this.keys.clear();
    this.fireHeld = false;
    this.aimHeld = false;
    if (this.touch) this.touch.reset();
  }

  lock() {
    if (this.isTouch || this.locked) return;
    try {
      const promise = this.canvas.requestPointerLock();
      if (promise?.catch) promise.catch(() => {});
    } catch {
      /* the browser refuses a second lock for a moment after Esc; the next click works */
    }
  }
  unlock() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  keyDown(e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const blocked = this.host.blocked();
    const code = e.code;
    if (code === 'Tab' || code === 'KeyI') {
      e.preventDefault();
      if (!e.repeat) this.host.menu('menu');
      return;
    }
    if (code === 'KeyM') {
      if (!e.repeat) this.host.menu('map');
      return;
    }
    if (code === 'KeyP' || (code === 'Escape' && !this.locked)) {
      if (!e.repeat) this.host.menu('pause');
      return;
    }
    if (blocked) return;
    if (code === 'Space' || code.startsWith('Arrow')) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(code);
    if (KEY_EDGES[code]) this.edges.add(KEY_EDGES[code]);
    if (KEY_ORDERS[code]) this.order = KEY_ORDERS[code];
    if (code === 'Digit1') this.slot = 1;
    if (code === 'Digit2') this.slot = 2;
  }

  mouseDown(e) {
    if (this.host.blocked()) return;
    if (!this.locked && !this.isTouch) {
      this.lock();
      return;
    }
    if (e.button === 0) {
      this.fireHeld = true;
      this.firePressed = true;
    } else if (e.button === 2) this.aimHeld = true;
  }
  mouseUp(e) {
    if (e.button === 0) this.fireHeld = false;
    else if (e.button === 2) this.aimHeld = false;
  }
  mouseMove(e) {
    if (!this.locked || this.host.blocked()) return;
    const s = this.host.settings();
    const k = LOOK * s.sensitivity * this.host.fovScale();
    this.lookX += e.movementX * k;
    this.lookY -= e.movementY * k * (s.invertY ? -1 : 1);
  }
  wheel(e) {
    e.preventDefault();
    if (this.host.blocked()) return;
    this.zoom = e.deltaY < 0 ? 1 : -1;
  }

  // The input for one simulation step. Edges and look travel are handed over on the first step
  // of a frame only.
  sample(out, first) {
    const k = this.keys;
    const t = this.touch;
    let mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let mz = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    if (t && t.active) {
      mx = t.moveX;
      mz = t.moveZ;
      sprint = t.sprint;
    }
    out.moveX = mx;
    out.moveZ = mz;
    out.sprint = sprint;
    out.breath = sprint || (t ? t.breath : false);
    out.walk = k.has('AltLeft');
    out.fire = this.fireHeld || (t ? t.fire : false);
    out.aim = this.aimHeld || (t ? t.aim : false);
    out.interactHeld = k.has('KeyF') || (t ? t.use : false);
    const e = this.edges;
    out.lookX = first ? this.lookX + (t ? t.lookX : 0) : 0;
    out.lookY = first ? this.lookY + (t ? t.lookY : 0) : 0;
    out.firePressed = first && (this.firePressed || (t ? t.firePressed : false));
    for (const name of ['jump', 'crouch', 'prone', 'reload', 'interact', 'swap', 'grenade', 'nextThrowable', 'melee', 'binoc', 'nvg', 'medkit', 'bandage', 'stim', 'support', 'supportNext']) out[name] = first && e.has(name);
    out.order = first ? this.order : null;
    out.slot = first ? this.slot : 0;
    out.zoom = first ? this.zoom : 0;
    if (first) {
      this.lookX = this.lookY = 0;
      this.firePressed = false;
      e.clear();
      this.order = null;
      this.slot = 0;
      this.zoom = 0;
      if (t) t.consume();
    }
    return out;
  }

  press(name) {
    this.edges.add(name);
  }
  giveOrder(order) {
    this.order = order;
  }

  dispose() {
    for (const off of this.offs ?? []) off();
    this.touch?.dispose();
  }
}

// ---------- touch ----------
// Left thumb: a stick that appears where you put it down. Right thumb: drag to look. Buttons on
// the right for everything else. The fire button also looks, so you can track while shooting.
export class TouchControls {
  constructor(root, input) {
    this.input = input;
    this.active = true;
    this.moveX = 0;
    this.moveZ = 0;
    this.sprint = false;
    this.lookX = 0;
    this.lookY = 0;
    this.fire = false;
    this.firePressed = false;
    this.aim = false;
    this.use = false;
    this.breath = false;
    this.pointers = new Map();
    const el = document.createElement('div');
    el.className = 'touch';
    el.innerHTML = `
      <div class="touch-pad" data-pad="move"><div class="touch-stick"><div class="touch-knob"></div></div></div>
      <div class="touch-pad" data-pad="look"></div>
      <button class="tb tb-fire" data-hold="fire">FIRE</button>
      <button class="tb tb-aim" data-toggle="aim">AIM</button>
      <button class="tb tb-jump" data-edge="jump">JUMP</button>
      <button class="tb tb-crouch" data-stance="1">LOW</button>
      <button class="tb tb-reload" data-edge="reload">RLD</button>
      <button class="tb tb-use" data-hold="use" data-edge="interact">USE</button>
      <button class="tb tb-nade" data-edge="grenade">NADE</button>
      <button class="tb tb-swap" data-edge="swap">SWAP</button>
      <button class="tb tb-med" data-edge="medkit">MED</button>
      <button class="tb tb-bino" data-edge="binoc">BINO</button>
      <button class="tb tb-menu" data-menu="menu">MENU</button>
      <button class="tb tb-pause" data-menu="pause">II</button>
      <div class="touch-orders">
        <button class="tb tb-order" data-order="follow">ON ME</button>
        <button class="tb tb-order" data-order="hold">HOLD</button>
        <button class="tb tb-order" data-order="move">MOVE</button>
        <button class="tb tb-order" data-order="attack">ATTACK</button>
        <button class="tb tb-order" data-order="fire">FIRE?</button>
      </div>`;
    root.appendChild(el);
    this.el = el;
    this.stick = el.querySelector('.touch-stick');
    this.knob = el.querySelector('.touch-knob');
    this.useButton = el.querySelector('.tb-use');
    this.orders = el.querySelector('.touch-orders');
    this.aimButton = el.querySelector('.tb-aim');
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('pointerdown', (e) => {
      stop(e);
      const target = e.target.closest('[data-pad],[data-hold],[data-edge],[data-toggle],[data-menu],[data-order],[data-stance]');
      if (!target) return;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* older browsers */
      }
      const d = target.dataset;
      const rec = { target, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, pad: d.pad ?? null, hold: d.hold ?? null, at: performance.now(), stance: !!d.stance };
      this.pointers.set(e.pointerId, rec);
      if (d.pad === 'move') {
        this.stick.style.display = 'block';
        this.stick.style.left = `${e.clientX}px`;
        this.stick.style.top = `${e.clientY}px`;
      }
      if (d.hold === 'fire') {
        this.fire = true;
        this.firePressed = true;
      }
      if (d.hold === 'use') this.use = true;
      if (d.edge) input.press(d.edge);
      if (d.toggle === 'aim') {
        this.aim = !this.aim;
        this.aimButton.classList.toggle('on', this.aim);
      }
      if (d.menu) input.host.menu(d.menu);
      if (d.order) input.giveOrder(d.order);
      target.classList.add('down');
    });
    el.addEventListener('pointermove', (e) => {
      const rec = this.pointers.get(e.pointerId);
      if (!rec) return;
      stop(e);
      const dx = e.clientX - rec.x;
      const dy = e.clientY - rec.y;
      rec.x = e.clientX;
      rec.y = e.clientY;
      if (rec.pad === 'move') {
        const ox = e.clientX - rec.sx;
        const oy = e.clientY - rec.sy;
        const len = Math.hypot(ox, oy);
        const max = 56;
        const k = len > max ? max / len : 1;
        this.moveX = (ox * k) / max;
        this.moveZ = (-oy * k) / max;
        this.sprint = len > max * 1.25;
        this.knob.style.transform = `translate(${ox * k}px, ${oy * k}px)`;
      } else if (rec.pad === 'look' || rec.hold === 'fire') {
        const s = input.host.settings();
        const scale = TOUCH_LOOK * s.sensitivity * input.host.fovScale();
        this.lookX += dx * scale;
        this.lookY -= dy * scale * (s.invertY ? -1 : 1);
      }
    });
    const up = (e) => {
      const rec = this.pointers.get(e.pointerId);
      if (!rec) return;
      this.pointers.delete(e.pointerId);
      rec.target.classList.remove('down');
      if (rec.pad === 'move') {
        this.moveX = this.moveZ = 0;
        this.sprint = false;
        this.stick.style.display = 'none';
        this.knob.style.transform = '';
      }
      if (rec.hold === 'fire') this.fire = false;
      if (rec.hold === 'use') this.use = false;
      // a tap goes to a crouch, a long press goes prone
      if (rec.stance) input.press(performance.now() - rec.at > 380 ? 'prone' : 'crouch');
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // Shows the buttons that only make sense some of the time.
  show({ use, squad, scoped }) {
    this.useButton.style.display = use ? 'block' : 'none';
    this.orders.style.display = squad ? 'flex' : 'none';
    this.breath = scoped;
  }
  consume() {
    this.lookX = this.lookY = 0;
    this.firePressed = false;
  }
  reset() {
    this.pointers.clear();
    this.moveX = this.moveZ = 0;
    this.fire = false;
    this.use = false;
    this.sprint = false;
    this.stick.style.display = 'none';
  }
  setVisible(on) {
    this.el.style.display = on ? 'block' : 'none';
    if (!on) this.reset();
  }
  dispose() {
    this.el.remove();
  }
}
