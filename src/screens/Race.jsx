import React, { useCallback, useEffect, useRef, useState } from 'react';
import { B } from '../game/balance.js';
import { useGame } from '../state/store.jsx';
import {
  accelFuelMult,
  castBlocker,
  bootStatus,
  heatPenalty,
  createRace,
  emergencyQuote,
  forfeitRace,
  leverFuelMult,
  orderEmergencyFuel,
  playerCast,
  playerOf,
  projectFinish,
  setLever,
  startRace,
  targetOf,
  fireAll,
  kindOf,
  armOf,
  setAim,
  stepRace,
  useAbility as fireAbility,
} from '../game/race.js';
import { RailScene, liveryFor } from '../three/RailScene.js';
import { sfx } from '../three/sfx.js';
import { bendAt, bendKeep, bendLimit, hillAt, hillEffect, nextBend } from '../game/course.js';
import { clock, fmt, lt, range } from '../ui/format.js';
import { estimateRange } from '../game/estimate.js';
import '../styles/race3d.css';

const C = B.COMBAT;
const COMP = B.RACE.competitive;
// Everything a train can fire or cast, in the order the command window lists it.
const ARM_INFO = {
  fire: { label: 'Fire' },
  bolt: { label: 'Bolt' },
  barrier: { label: 'Barrier' },
  cannon: { label: 'Cannon' },
  heavy: { label: 'Heavy' },
  plasma: { label: 'Plasma' },
  shield: { label: 'Shield' },
  launcher: { label: 'Missiles' },
  arc: { label: 'Lightning' },
  frost: { label: 'Frost Breath' },
  vent: { label: 'Coolant' },
};
// Ammo is counted in units; say it in the shots the fitted guns actually fire.
function ammoWords(train) {
  const kinds = [...new Set(train.arms.map(kindOf))];
  const balls = kinds.includes('cannon') || kinds.includes('heavy');
  const missiles = kinds.includes('launcher');
  const n = (cost) => Math.floor(train.ammo / cost);
  if (balls && !missiles) return `${n(3)} balls`;
  if (missiles && !balls) return `${n(2)} missiles`;
  return `${n(3)} balls / ${n(2)} missiles`;
}
function Afflictions({ train }) {
  if (!(train.burn > 0) && !(train.poison > 0)) return null;
  return (
    <span className="r3-afflict">
      {train.burn > 0 ? <span className="burn">Burning {train.burn}</span> : null}
      {train.poison > 0 ? <span className="poison">Poisoned {train.poison}</span> : null}
    </span>
  );
}
const ARM_ORDER = ['fire', 'bolt', 'launcher', 'cannon', 'heavy', 'plasma', 'arc', 'barrier', 'shield', 'frost', 'vent'];
const costText = (key) => {
  const arm = C[kindOf(key)];
  return arm.use === 'ammo' ? (arm.burst ? `${arm.burst}×` : '1 ball') : arm.use === 'charge' ? `${arm.cost}⚡` : `${arm.cost}`;
};
const AIMS = { auto: 'Aim: auto', track: 'Aim: track', rivals: 'Aim: rivals' };
const SIZE_NAME = { debris: 'Debris', boulder: 'Boulder', large: 'Large boulder', giant: 'Giant boulder' };

function gapText(miles) {
  if (miles === null || miles === undefined) return '';
  const abs = Math.abs(miles);
  if (abs < 0.01) return 'Neck and neck';
  const n = abs < 10 ? abs.toFixed(2) : abs.toFixed(1);
  return miles > 0 ? `Leading by ${n} mi` : `Trailing by ${n} mi`;
}

function Bar({ kind, value, max, low }) {
  const pctValue = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <div className={`r3-bar ${kind} ${low ? 'low' : ''}`}>
      <i style={{ width: `${pctValue}%` }} />
    </div>
  );
}

export default function Race() {
  const { screen, act, go } = useGame();
  const raceRef = useRef(null);
  if (!raceRef.current) raceRef.current = createRace(screen.config);
  const race = raceRef.current;
  const player = playerOf(race);

  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const numsRef = useRef(null);
  const flashRef = useRef(null);
  const sceneRef = useRef(null);

  const [, setTick] = useState(0);
  const redraw = useCallback(() => setTick((n) => n + 1), []);
  const [count, setCount] = useState(3);
  const [warp, setWarp] = useState(1);
  const [paused, setPaused] = useState(false);
  const [toast, setToast] = useState(null);
  const [msg, setMsg] = useState(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [sound, setSound] = useState(sfx.on);
  const [cineOn, setCineOn] = useState(true);
  const [pixels, setPixels] = useState(true);
  const warpRef = useRef(1);
  warpRef.current = warp;
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const settled = useRef(false);
  const msgTimer = useRef(0);

  const say = useCallback((text) => {
    setMsg(text);
    window.clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setMsg(null), 1600);
  }, []);

  // Build the 3D scene once, and run the engine and the renderer on the same animation frame.
  useEffect(() => {
    sfx.init();
    let scene;
    try {
      scene = new RailScene({ canvas: canvasRef.current, host: hostRef.current, nums: numsRef.current, flash: flashRef.current, race });
    } catch (error) {
      // No WebGL: the race still runs, with the windows only.
      console.warn('3D scene unavailable', error);
      scene = null;
    }
    sceneRef.current = scene;
    if (scene) {
      setPixels(scene.pixelMode);
      setCineOn(scene.cineOn);
    }
    let frame = 0;
    let last = null;
    const loop = (time) => {
      const dt = last === null ? 0 : Math.min(0.05, (time - last) / 1000);
      last = time;
      const live = !pausedRef.current;
      if (live && race.status === 'running') stepRace(race, dt * warpRef.current * (scene?.timeFactor ?? 1));
      if (scene) {
        scene.frame(live ? dt : 0);
        if (mapRef.current) scene.drawMap(mapRef.current);
      } else race.fx.length = 0;
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    const hud = window.setInterval(redraw, 100);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(hud);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [race, redraw]);

  // Countdown 3, 2, 1, GO.
  useEffect(() => {
    if (paused) return undefined;
    if (count <= 0) {
      startRace(race);
      setToast({ text: 'GO!', until: Date.now() + 800 });
      sfx.whistle();
      return undefined;
    }
    if (count === 3) sfx.whistle();
    setToast({ text: String(count), until: Date.now() + 750 });
    const timer = window.setTimeout(() => setCount(count - 1), 800);
    return () => window.clearTimeout(timer);
  }, [count, race, paused]);

  // When the engine reports a finish, show the result for a moment, settle once and show the receipt.
  useEffect(() => {
    if (race.status !== 'finished' || settled.current) return;
    settled.current = true;
    const result = race.result;
    let text = 'Arrived';
    if (result.reason === 'forfeit') text = 'Run abandoned';
    else if (result.reason === 'derailed') text = 'Knocked off the line';
    else if (result.reason === 'smashed') text = `Wall down in ${fmt(result.realSeconds, 1)} s!`;
    else if (race.kind === 'wall') text = "Time's up";
    else if (race.trains.length > 1) text = result.place === 1 ? (result.rivalsDerailed ? 'Victory!' : 'First across!') : `Finished ${result.place} of ${race.trains.length}`;
    else if (result.reason === 'late') text = 'Out of time';
    setToast({ text, until: Date.now() + 2300 });
    if (result.reason !== 'forfeit') (result.place === 1 && !result.derailed ? sfx.win : sfx.lose)();
    // No cleanup on purpose: the HUD redraws ten times a second and this timer must survive that.
    window.setTimeout(
      () => {
        const receipt = act('settleRun', { ctx: screen.ctx, result });
        go('receipt', { receipt, ctx: screen.ctx });
      },
      result.reason === 'forfeit' ? 600 : 2400,
    );
  });

  const togglePause = useCallback(() => {
    if (race.status === 'finished') return;
    setPaused((p) => !p);
  }, [race]);

  const cast = useCallback(
    (kind) => {
      sfx.init();
      const reason = castBlocker(race, player, kind);
      if (reason) {
        if (reason !== 'Nothing to fight') say(reason === 'Nothing in range' ? 'Out of range. Close the gap.' : reason);
        return;
      }
      playerCast(race, kind);
      if (kind === 'barrier' || kind === 'shield') say(kind === 'shield' ? 'Shield up' : 'Barrier up');
      redraw();
    },
    [race, player, say, redraw],
  );

  const siphon = useCallback(() => {
    if (!race.ability || race.ability.auto) return;
    if (race.ability.used) return say('Siphon Speed is used up');
    if (!fireAbility(race)) return say('No rival to drain');
    redraw();
    return undefined;
  }, [race, say, redraw]);

  const nudgeLever = useCallback(
    (by) => {
      setLever(race, player.lever + by);
      redraw();
    },
    [race, player, redraw],
  );

  const cycleCamera = useCallback(() => {
    const mode = sceneRef.current?.cycleCamera();
    const names = { chase: 'Chase', aerial: 'Aerial', helicopter: 'Helicopter (whole field)', side: 'Side', front: 'Front' };
    if (mode) say(`Camera: ${names[mode] ?? mode}`);
  }, [say]);

  // Keyboard: 1-5 the commands in order (F fire, B bolt, R shield or barrier), Q Siphon,
  // Up/W and Down/S the lever, C camera, P pause.
  // Commands in a steady order: spells, then weapons (doubles beside each other), then shields.
  const arms = [...player.arms].sort((a, b) => ARM_ORDER.indexOf(kindOf(a)) - ARM_ORDER.indexOf(kindOf(b)) || a.localeCompare(b));
  const labelOf = (key) => {
    const kind = kindOf(key);
    if (kind === 'fire' && player.model === 'dragon') return 'Dragonfire';
    const n = key.includes('#') ? ` ${key.split('#')[1]}` : arms.some((k) => k.startsWith(`${kind}#`)) ? ' 1' : '';
    return `${ARM_INFO[kind].label}${n}`;
  };
  const attacks = arms.filter((key) => !['barrier', 'shield', 'frost', 'vent'].includes(kindOf(key)));
  const doFireAll = () => {
    sfx.init();
    if (!fireAll(race)) say('Nothing ready with a target in range');
    redraw();
  };
  const cycleAim = () => {
    const next = race.aim === 'auto' ? 'track' : race.aim === 'track' ? 'rivals' : 'auto';
    setAim(race, next);
    say(next === 'auto' ? 'Aim: obstacles first, then rivals' : next === 'track' ? 'Aim: obstacles only' : 'Aim: rivals only');
    redraw();
  };
  const keys = useRef({});
  keys.current = { cast, siphon, nudgeLever, cycleCamera, togglePause, arms, doFireAll, cycleAim };
  useEffect(() => {
    const onKey = (event) => {
      if (event.target instanceof HTMLInputElement && event.target.type !== 'range') return;
      const k = event.key.toLowerCase();
      const h = keys.current;
      if (['arrowup', 'arrowdown', ' '].includes(k)) event.preventDefault();
      if (k === ' ' && !event.repeat) return h.doFireAll();
      if (k === 't' && !event.repeat) return h.cycleAim();
      if (k === 'arrowup' || k === 'w') h.nudgeLever(B.RACE.lever.step);
      if (k === 'arrowdown' || k === 's') h.nudgeLever(-B.RACE.lever.step);
      if (event.repeat) return;
      const n = Number(k);
      if (n >= 1 && n <= h.arms.length) h.cast(h.arms[n - 1]);
      if (k === 'f') h.doFireAll();
      if (k === 'b' && h.arms.includes('bolt')) h.cast('bolt');
      if (k === 'r') h.cast(h.arms.find((a) => kindOf(a) === 'barrier' || kindOf(a) === 'shield'));
      if (k === 'q' || (n === h.arms.length + 1 && n > 0)) h.siphon();
      if (k === 'c') h.cycleCamera();
      if ((k === 'enter' || k === 'escape') && sceneRef.current?.cine) sceneRef.current.skipCine();
      if (k === 'p') h.togglePause();
    };
    const onHide = () => {
      if (document.hidden && race.status !== 'finished') setPaused(true);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [race]);

  // ---------- derived numbers ----------
  const rivals = race.trains.slice(1);
  const hasRivals = rivals.length > 0;
  const comp = race.competitive;
  const nearest = rivals.find((train) => train.id === race.nearestId);
  // The next boulder still standing on your line, if one is within two miles.
  // What the lookout and radar have spotted ahead, nearest first.
  const spotted = race.obstacles.filter((item) => item.seen && !item.destroyed && !item.struck && item.at >= player.distance);
  const rock = spotted[0] ?? null;
  const longest = Math.max(0, ...attacks.map((key) => armOf(player, key).range ?? 0));
  const cine = sceneRef.current?.cineState?.() ?? null;
  const bend = bendAt(race.course, player.distance);
  const hillNow = hillAt(race.course, player.distance);
  const upcoming = nextBend(race.course, player.distance);
  // Only worth a warning when the bend is slower than this train can go.
  const matters = (b) => b && bendKeep(b, player.grip) < 0.97;
  const keepPct = (b) => Math.round(bendKeep(b, player.grip) * 100);
  const bendAhead = !bend && matters(upcoming) && upcoming.start - player.distance < 1.5 ? upcoming : null;
  const ammoLeft = player.ammoMax > 0;
  const hasCharge = player.chargeMax > 0;
  const hasSpells = player.arms.some((kind) => C[kind]?.use === 'mp');
  const weight = player.baseWeight + player.cargo + player.fuel * B.LOCO.fuelLbPerGallon;
  const ratio = player.vmax > 0 ? player.speed / player.vmax : 1;
  const galPerMile = (weight / 2000 / player.tmpg) * leverFuelMult(player.lever) * accelFuelMult(ratio);
  const remaining = Math.max(0, race.distance - player.distance);
  const rangeLeft = galPerMile > 0 ? player.fuel / galPerMile : 0;
  const limitLeft = race.timeLimit ? Math.max(0, race.timeLimit - race.game) / B.TIME_SCALE : null;
  // ETA: re-run twice a second from where the train is, at the current lever, bends included.
  const etaRef = useRef({ at: 0, value: null });
  if (race.status === 'running' && !player.parked && Date.now() - etaRef.current.at > 500) etaRef.current = { at: Date.now(), value: projectFinish(race) };
  const eta = race.status === 'running' && !player.parked ? etaRef.current.value : null;
  // Estimates are ranges; Intelligence narrows them. A fixed key per race keeps them steady.
  const band = screen.config.player.band ?? 0.02;
  const etaEst = eta && eta.realSeconds !== null ? estimateRange(eta.realSeconds, band, `${race.title}-eta`) : null;
  const spare = etaEst && limitLeft !== null ? { lo: limitLeft - etaEst.hi, hi: limitLeft - etaEst.lo } : null;
  const rangeEst = estimateRange(rangeLeft, band, `${race.title}-range`);
  const dry = race.status === 'running' && player.fuel <= 0 && player.speed < 1 && !race.emergency;
  const showToast = toast && Date.now() < toast.until ? toast.text : paused ? 'Paused' : null;
  const done = race.status === 'finished';

  return (
    <div className="r3" ref={hostRef}>
      <canvas ref={canvasRef} className={`r3-view ${pixels ? '' : 'smooth'}`} aria-label="The race, in 3D" />
      <div className="r3-vignette" />
      <div className="r3-flash" ref={flashRef} />
      <div className="r3-nums" ref={numsRef} />
      {showToast ? (
        <div className="r3-toast" key={showToast} aria-live="assertive">
          {showToast}
        </div>
      ) : null}
      {msg ? (
        <div className="r3-win r3-msg" role="status">
          {msg}
        </div>
      ) : null}

      {/* Top left: the run */}
      <div className="r3-hud r3-tl">
        <div className="r3-win r3-race">
          <div className="r3-title">{race.title}</div>
          <div className="r3-lbl">Distance</div>
          <div className="r3-big">
            {fmt(Math.min(player.distance, race.distance), 1)}
            <small> / {fmt(race.distance)} mi</small>
          </div>
          <div className="r3-row">
            <span className="r3-lbl">Speed</span>
            <span>{fmt(player.speed)}</span>
            <span className="r3-dim">of {fmt(player.vmax)} mph</span>
          </div>
          {hillNow ? (
            <div className={`r3-bend ${hillNow.grade > 0 ? 'climb' : 'descent'}`}>
              {hillNow.grade > 0 ? 'Climbing' : 'Descending'} {fmt(Math.abs(hillNow.grade) * 100, 1)}% · top speed {hillNow.grade > 0 ? '−' : '+'}
              {fmt(Math.abs(1 - hillEffect(hillNow.grade, player.hillGrip).speed) * 100)}% · {(hillNow.end - player.distance).toFixed(1)} mi to go
            </div>
          ) : null}
          {matters(bend) || bendAhead ? (
            <div className={`r3-bend ${(bend ?? bendAhead).kind}`}>
              {bend ? `In a ${bend.kind} bend` : `${bendAhead.kind[0].toUpperCase()}${bendAhead.kind.slice(1)} bend in ${(bendAhead.start - player.distance).toFixed(2)} mi`} · hold {fmt(bendLimit(bend ?? bendAhead, player.vmax, player.grip))} mph ({keepPct(bend ?? bendAhead)}% of top){bend ? `, ${(bend.end - player.distance).toFixed(1)} mi to go` : ''}
            </div>
          ) : null}
          {hasRivals ? (
            <>
              <div className={`r3-gap ${race.gap > 0.01 ? 'ahead' : race.gap < -0.01 ? 'behind' : ''}`}>{race.status === 'ready' ? 'Waiting for the flag' : nearest ? gapText(race.gap) : 'Everyone else is home'}</div>
              <div className="r3-row">
                <span className="r3-lbl">Place</span>
                <span>
                  {race.place} of {race.trains.length}
                </span>
              </div>
            </>
          ) : null}
          <div className="r3-row r3-small r3-clock">
            <span className="r3-lbl">On the line</span>
            <span>{clock(race.game)}</span>
            <span className="r3-dim">real {clock(race.real)}</span>
          </div>
          {eta ? (
            <div className="r3-eta">
              <div className="r3-row r3-small">
                <span className="r3-lbl">ETA</span>
                <span className={eta.dryAt !== null ? 'r3-danger' : ''}>{eta.dryAt !== null ? `Fuel runs out near ${range(estimateRange(eta.dryAt, band, `${race.title}-dry`), (v) => fmt(Math.min(v, race.distance), 1))} mi` : range(etaEst, clock)}</span>
              </div>
              {limitLeft !== null ? (
                <div className="r3-row r3-small">
                  <span className="r3-lbl">Time left</span>
                  <span>{clock(limitLeft)}</span>
                  {spare !== null ? (
                    <span className={spare.lo >= 0 ? 'r3-ahead' : spare.hi < 0 ? 'r3-danger' : 'r3-hot'}>
                      {spare.lo >= 0 ? `${band <= 0.03 ? clock(spare.lo) : `${clock(spare.lo)}+`} spare` : spare.hi < 0 ? `${clock(-spare.hi)}+ late` : 'Too close to call'}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : limitLeft !== null ? (
            <div className="r3-row r3-small">
              <span className="r3-lbl">Time left</span>
              <span>{clock(limitLeft)}</span>
            </div>
          ) : null}
          {comp.power > 0 ? (
            <div className={`r3-comp ${comp.boost > 0 ? 'hot' : ''}`}>
              <div className="r3-row r3-small">
                <span className="r3-lbl">Competitive</span>
                <span>{comp.boost > 0 ? `+${fmt(comp.boost * 100, 1)}% power` : comp.inRange > 0 ? `in range ${fmt(comp.inRange, 1)}s` : 'within ½ mi'}</span>
              </div>
              <Bar kind="st" value={Math.min(comp.inRange, COMP.t2)} max={COMP.t2} />
            </div>
          ) : null}
        </div>
      </div>

      {cine ? (
        <button type="button" className={`r3-cine ${cine.holding ? 'hold' : ''} ${cine.size}`} onClick={() => sceneRef.current?.skipCine()}>
          <span className="r3-cine-bars" aria-hidden="true" />
          <span className="r3-cine-reticle" aria-hidden="true" />
          <span className="r3-cine-card">
            <span className="r3-cine-kicker">{cine.size === 'giant' ? 'Uh oh. ' : ''}Obstacle spotted</span>
            <span className="r3-cine-title">{SIZE_NAME[cine.size] ?? 'Obstacle'}</span>
            <span className="r3-cine-line">
              {fmt(cine.hp)} HP · {fmt(cine.miles, 1)} mi ahead{cine.ahead > 1 ? ` · ${cine.ahead} on the line ahead` : ''}
            </span>
            <span className="r3-cine-line">
              {longest > 0
                ? cine.miles <= longest
                  ? 'In range now: open fire'
                  : `Your guns reach ${fmt(longest, 1)} mi: in range in ${fmt(cine.miles - longest, 1)} mi`
                : player.front && player.front !== 'cowcatcher'
                  ? 'No guns fitted: brace the front'
                  : 'No guns fitted: brace for impact'}
            </span>
            <span className="r3-cine-skip">Tap or Enter to skip</span>
          </span>
        </button>
      ) : null}

      {/* Top right: buttons and the nearest rival */}
      <div className="r3-hud r3-tr">
        <div className="r3-utils">
          <button type="button" className="r3-win r3-ubtn" onClick={cycleCamera} title="Change camera (C)">
            View
          </button>
          <button
            type="button"
            className="r3-win r3-ubtn"
            aria-pressed={pixels}
            onClick={() => {
              const on = sceneRef.current?.togglePixels();
              if (on === undefined) return;
              setPixels(on);
              say(on ? 'PS1 pixels on' : 'Smooth render');
            }}
          >
            Pixels
          </button>
          <button
            type="button"
            className="r3-win r3-ubtn"
            aria-pressed={cineOn}
            title="Slow-motion fly-to when the lookout spots an obstacle"
            onClick={() => {
              const on = sceneRef.current?.toggleCine();
              if (on === undefined) return;
              setCineOn(on);
              say(on ? 'Sighting cinematics on' : 'Sighting cinematics off');
            }}
          >
            Cine
          </button>
          <button
            type="button"
            className="r3-win r3-ubtn"
            aria-pressed={sound}
            onClick={() => {
              const on = sfx.toggle();
              setSound(on);
              say(on ? 'Sound on' : 'Sound off');
            }}
          >
            Sound
          </button>
          <button
            type="button"
            className="r3-win r3-ubtn"
            title="Time warp, for testing"
            onClick={() => {
              const next = warp === 1 ? 2 : warp === 2 ? 4 : 1;
              setWarp(next);
              say(`Time warp ${next}x`);
            }}
          >
            {warp}x
          </button>
          <button type="button" className="r3-win r3-ubtn" onClick={togglePause} title="Pause (P)" disabled={done}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          {confirmQuit ? (
            <button
              type="button"
              className="r3-win r3-ubtn r3-warn"
              onClick={() => {
                setConfirmQuit(false);
                // Before the start nothing has been spent, so simply step back to the setup screen.
                if (race.status === 'ready') {
                  settled.current = true;
                  go('setup', { ctx: screen.ctx });
                } else forfeitRace(race);
              }}
              onBlur={() => setConfirmQuit(false)}
            >
              Really give up?
            </button>
          ) : (
            <button type="button" className="r3-win r3-ubtn" onClick={() => setConfirmQuit(true)} disabled={done}>
              Forfeit
            </button>
          )}
        </div>
        {race.obstacles.length ? (
          <div className="r3-win r3-foe r3-rock">
            <div className="r3-row r3-spread">
              <span className="r3-name r3-hot">{rock?.big ? 'The Damage Wall' : 'Ahead on the line'}</span>
              <span className="r3-dim r3-small">radar {fmt(player.sight, 1)} mi</span>
            </div>
            {spotted.length ? (
              spotted.slice(0, 3).map((item) => {
                const d = item.at - player.distance;
                const inRange = d <= longest;
                return (
                  <div key={item.id} className="r3-obstacle">
                    <div className="r3-row r3-spread r3-small">
                      <span className={inRange ? 'r3-ahead' : ''}>{SIZE_NAME[item.size] ?? 'Boulder'}</span>
                      <span>
                        {d.toFixed(2)} mi{inRange ? ' · in range' : ''}
                      </span>
                    </div>
                    <Bar kind="hp" value={item.hp} max={item.hpMax} />
                  </div>
                );
              })
            ) : (
              <div className="r3-sub">Nothing spotted. {race.obstacles.filter((item) => !item.destroyed && !item.struck).length} left on this run.</div>
            )}
            {spotted.length > 3 ? <div className="r3-sub">+{spotted.length - 3} more spotted</div> : null}
          </div>
        ) : null}
        {nearest ? (
          <div className={`r3-win r3-foe ${nearest.out ? 'out' : ''}`}>
            <div className="r3-row r3-spread">
              <span className="r3-name" style={{ color: liveryFor(nearest).css }}>
                {nearest.name}
              </span>
              <span className="r3-dim r3-small">{nearest.locoName}</span>
            </div>
            {race.combat ? (
              <>
                <Bar kind="hp" value={nearest.hull} max={nearest.hullMax} low={nearest.hull < nearest.hullMax * 0.3} />
                <div className="r3-sub">
                  {nearest.barrier > 0 ? <span className="r3-barrier">Barrier · </span> : null}
                  {Math.ceil(nearest.hull)}/{nearest.hullMax} <Afflictions train={nearest} />
                </div>
              </>
            ) : null}
            <div className="r3-sub">
              {fmt(nearest.speed)} mph · {Math.abs(race.gap) < 10 ? Math.abs(race.gap).toFixed(2) : Math.abs(race.gap).toFixed(1)} mi {race.gap >= 0 ? 'behind you' : 'ahead'}
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom left: commands and your train */}
      <div className="r3-hud r3-bl">
        {(race.combat && arms.length) || (race.ability && !race.ability.auto) ? (
          <div className="r3-win r3-cmds" role="group" aria-label="Commands">
            {race.combat
              ? arms.map((key, index) => {
                  const blocked = castBlocker(race, player, key);
                  const arm = armOf(player, key);
                  const booting = bootStatus(race, player, key);
                  return (
                    <button
                      type="button"
                      key={key}
                      className={`r3-cmd ${blocked ? 'off' : ''} ${booting ? 'booting' : ''} ${arm.use === 'mp' ? 'spell' : ''}`}
                      onClick={() => cast(key)}
                      aria-disabled={blocked ? 'true' : 'false'}
                      title={`${arm.name ?? labelOf(key)}${arm.range ? `, reaches ${fmt(arm.range, 1)} mi` : ''}${blocked ? `: ${blocked}` : ''}`}
                    >
                      <span className="r3-cur">▶</span>
                      {labelOf(key)}
                      <span className="r3-key">{index + 1}</span>
                      <span className="r3-cost">{booting ? booting.replace('Booting ', '').replace('Boots in ', '').replace('Arms below ', '<').replace('Ready above ', '>') : costText(key)}</span>
                      <i className="r3-cd" style={{ transform: `scaleX(${(player.cooldown[key] ?? 0) / arm.cooldown})` }} />
                    </button>
                  );
                })
              : null}
            {race.combat && attacks.length > 1 ? (
              <button type="button" className="r3-cmd r3-fireall" onClick={doFireAll}>
                <span className="r3-cur">▶</span>
                Fire all
                <span className="r3-key">Space</span>
              </button>
            ) : null}
            {race.combat && attacks.length ? (
              <button type="button" className="r3-cmd r3-aim" onClick={cycleAim}>
                <span className="r3-cur">▶</span>
                {AIMS[race.aim]}
                <span className="r3-key">T</span>
              </button>
            ) : null}
            {race.ability && !race.ability.auto ? (
              <button
                type="button"
                className={`r3-cmd ${race.ability.used || !nearest || race.status !== 'running' ? 'off' : ''}`}
                onClick={siphon}
                aria-disabled={race.ability.used ? 'true' : 'false'}
              >
                <span className="r3-cur">▶</span>
                Siphon
                <span className="r3-key">{arms.length + 1}</span>
                <span className="r3-cost">{race.ability.activeFor > 0 ? `${fmt(race.ability.activeFor)}s` : race.ability.used ? 'used' : '1×'}</span>
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="r3-win r3-me">
          <div className="r3-row r3-spread">
            <span className="r3-name" style={{ color: liveryFor(player).css }}>
              {player.locoName || player.name}
            </span>
            {player.barrier > 0 ? <span className="r3-barrier r3-small">Barrier {player.barrier.toFixed(1)}s</span> : null}
            {race.ability?.activeFor > 0 ? <span className="r3-siphon r3-small">Siphon {fmt(race.ability.activeFor)}s</span> : null}
          </div>
          <div className="r3-meters">
            {race.combat ? (
              <>
                <span className="r3-lbl">HP</span>
                <Bar kind="hp" value={player.hull} max={player.hullMax} low={player.hull < player.hullMax * 0.3} />
                <span>
                  {Math.ceil(player.hull)} <Afflictions train={player} />
                </span>
                {hasSpells ? (
                  <>
                    <span className="r3-lbl">MP</span>
                    <Bar kind="mp" value={player.mp} max={C.mpMax} />
                    <span>{Math.floor(player.mp)}</span>
                  </>
                ) : null}
                {ammoLeft ? (
                  <>
                    <span className="r3-lbl">Ammo</span>
                    <Bar kind="ammo" value={player.ammo} max={player.ammoMax} low={player.ammo === 0} />
                    <span title={`${player.ammo} of ${player.ammoMax} ammo units`}>{ammoWords(player)}</span>
                  </>
                ) : null}
                {hasCharge ? (
                  <>
                    <span className="r3-lbl">Charge</span>
                    <Bar kind="charge" value={player.charge} max={player.chargeMax} />
                    <span>{Math.floor(player.charge)}</span>
                  </>
                ) : null}
              </>
            ) : null}
            <span className="r3-lbl">Fuel</span>
            <Bar kind="fuel" value={player.fuel} max={Math.max(player.fuelStart, player.fuel)} low={rangeLeft < remaining} />
            <span>{fmt(player.fuel, player.fuel < 100 ? 1 : 0)}</span>
            <span className="r3-lbl">Heat</span>
            <Bar kind={player.heat >= 100 ? 'heat over' : player.heat >= 50 ? 'heat warm' : 'heat'} value={Math.min(100, player.heat)} max={100} low={player.heat >= 100} />
            <span className={player.heat >= 100 ? 'r3-danger' : ''}>{fmt(player.heat)}%</span>
          </div>
          <div className={`r3-sub ${rangeLeft < remaining ? 'r3-danger' : ''}`}>
            {race.freeFuel ? 'Free fuel' : `gal · good for ${range(rangeEst)} of ${fmt(remaining, 1)} mi`}
          </div>
          {player.heat >= 50 ? (
            <div className={`r3-sub ${player.heat >= 100 ? 'r3-danger' : 'r3-warm'}`}>
              {player.heat >= 100 ? 'Overheating' : 'Running hot'}: −{fmt(heatPenalty(player.heat) * 100)}% speed and pull. Ease the lever below 90% to cool.
            </div>
          ) : null}
          {player.journey ? <div className="r3-sub r3-journey">The Journey: +{fmt(player.journeyStacks * B.JOURNEY.speed * 100, 1)}% speed, −{fmt(player.journeyStacks * B.JOURNEY.heat * 100)}% heat</div> : null}
        </div>
      </div>

      {/* Bottom right: map and the power lever */}
      <div className="r3-hud r3-br">
        <canvas ref={mapRef} className="r3-map" width="220" height="200" aria-label="Course map: the whole line, your dot and the others" role="img" />
        <div className="r3-win r3-lever">
          <div className="r3-row r3-spread">
            <label className="r3-lbl" htmlFor="r3-lever">
              Lever
            </label>
            <span className={player.lever > 1 ? 'r3-hot' : ''}>{Math.round(player.lever * 100)}%</span>
          </div>
          <div className="r3-lever-row">
            <button type="button" className="r3-win r3-tbtn" onClick={() => nudgeLever(-B.RACE.lever.step)} aria-label="Ease the lever">
              ▼
            </button>
            <input
              id="r3-lever"
              type="range"
              min={B.RACE.lever.min * 100}
              max={B.RACE.lever.max * 100}
              step={B.RACE.lever.step * 100}
              value={Math.round(player.lever * 100)}
              onChange={(event) => {
                setLever(race, Number(event.target.value) / 100);
                redraw();
              }}
              aria-valuetext={`${Math.round(player.lever * 100)} percent`}
            />
            <button type="button" className="r3-win r3-tbtn" onClick={() => nudgeLever(B.RACE.lever.step)} aria-label="Open the lever">
              ▲
            </button>
          </div>
          <div className="r3-sub">{player.lever > 1 ? 'Overdrive: fuel ×' : player.lever < 1 ? 'Easing: fuel ×' : 'Full: fuel ×'}{fmt(leverFuelMult(player.lever), 2)}</div>
        </div>
      </div>

      {race.emergency ? (
        <div className="r3-win r3-msg r3-truck" role="status">
          {race.emergency.phase === 'waiting' ? `Fuel truck arrives in ${fmt(Math.max(0, race.emergency.remaining), 1)} s` : `Refuelling, ${fmt(Math.max(0, race.emergency.remaining), 1)} s`}. The clock is still running.
        </div>
      ) : null}

      {dry ? (
        <div className="r3-overlay" role="dialog" aria-modal="true" aria-label="Out of fuel">
          <div className="r3-win r3-panel">
            <h2>Out of fuel</h2>
            <p>
              You have rolled to a stop {fmt(player.distance, 1)} miles in. A fuel truck can reach you at {B.RACE.emergency.price} LT a gallon. You have {lt(race.lt)} LT.
            </p>
            <div className="r3-choices">
              {B.RACE.emergency.options.map((gallons) => {
                const quote = emergencyQuote(race, gallons);
                const afford = race.freeFuel || quote.cost <= race.lt;
                return (
                  <button type="button" key={gallons} className="r3-cmd" disabled={!afford} onClick={() => orderEmergencyFuel(race, gallons)}>
                    <span className="r3-cur">▶</span>
                    {gallons} gal
                    <span className="r3-cost">
                      {fmt(quote.cost)} LT · {fmt(quote.waitSeconds + quote.refuelSeconds, 1)} s
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="r3-sub" style={{ textAlign: 'left' }}>
              The last {fmt(remaining, 1)} miles need about {fmt(Math.max(1, Math.ceil(remaining * galPerMile * 1.15)))} gallons.
            </p>
            <button type="button" className="r3-cmd" onClick={() => forfeitRace(race)}>
              <span className="r3-cur">▶</span>
              Give up this run
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
