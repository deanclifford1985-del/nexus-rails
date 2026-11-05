import { FOCUSES } from '../game/captain.js';
import { makeCaptainSave } from '../game/crates.js';
import { IS_NFT } from '../edition.js';
import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Dices, RefreshCw, TrainFront } from 'lucide-react';
import { B } from '../game/balance.js';
import { makeRng, newSeed } from '../game/rng.js';
import { TRAITS, TRAIT_RARITIES, traitsFromOffer } from '../game/traits.js';
import {
  ATTRIBUTES,
  buildConductor,
  dealOffer,
  dealOffers,
  offerHas,
  offerIds,
  picksAllowed,
  picksUsed,
  randomName,
  recommendStarter,
  rerollsAllowed,
  rollDice,
  rollDie,
  startingKitPreview,
} from '../game/conductor.js';
import { MODELS, STARTER_MODELS, deriveStats, generateLoco } from '../game/locomotives.js';
import { useGame } from '../state/store.jsx';
import { Die } from '../ui/Die.jsx';
import { LocoArt } from '../ui/LocoArt.jsx';
import { RarityTag, Stat, TraitChips, TraitRarityTag } from '../ui/bits.jsx';
import { fmt, lb } from '../ui/format.js';

const STEPS = ['Name', 'Traits', 'Roll', 'Assign', 'Locomotive'];
const ATTR_KEYS = ['str', 'agi', 'int', 'end'];

export default function Create() {
  const { saves, screen, go, createSave, notify } = useGame();
  const rng = useRef(null);
  if (!rng.current) rng.current = makeRng(newSeed());
  const slot = screen.slot ?? Math.max(0, saves.slots.findIndex((item) => !item));

  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState('business');
  const [name, setName] = useState('');
  const [offers, setOffers] = useState(() => dealOffers(rng.current, B.START.traitOffers));
  const [chosenKeys, setChosenKeys] = useState([]);
  const [rerollsUsed, setRerollsUsed] = useState(0);
  const [dice, setDice] = useState(null);
  const [kept, setKept] = useState([]);
  const [rollCount, setRollCount] = useState(0);
  const [assigned, setAssigned] = useState({ str: null, agi: null, int: null, end: null });
  const [holding, setHolding] = useState(null);
  const [starters, setStarters] = useState(null);
  const [locoId, setLocoId] = useState(null);

  const chosen = useMemo(() => chosenKeys.map((key) => offers.find((offer) => offer.key === key)).filter(Boolean), [chosenKeys, offers]);
  const allowed = picksAllowed(chosen);
  const used = picksUsed(chosen);
  // Gifted cards do not use a pick, so a deal heavy with them can leave fewer cards to pick than picks.
  const pickable = offers.filter((offer) => offer.rarity !== 'gifted').length;
  const needed = Math.min(allowed, pickable);
  const rerollsLeft = rerollsAllowed(chosen) - rerollsUsed;
  const focused = offerHas(chosen, 'focused');
  const traits = chosen.flatMap(traitsFromOffer);

  const dieById = (id) => dice?.find((die) => die.id === id) ?? null;
  const attributes = {
    str: dieById(assigned.str)?.value ?? null,
    agi: dieById(assigned.agi)?.value ?? null,
    int: dieById(assigned.int)?.value ?? null,
    end: dieById(assigned.end)?.value ?? null,
  };
  const allAssigned = ATTR_KEYS.every((key) => attributes[key] !== null);
  const draft = { traits, str: attributes.str ?? 0, agi: attributes.agi ?? 0, int: attributes.int ?? 0, end: attributes.end ?? 0 };
  const loco = starters?.find((item) => item.id === locoId) ?? null;

  // ---------- Traits ----------

  function toggleOffer(offer) {
    const isChosen = chosenKeys.includes(offer.key);
    if (isChosen) {
      if (offer.ids.includes('prodigy')) return notify('Prodigy cannot be put back once taken.', 'error');
      const without = chosen.filter((item) => item.key !== offer.key);
      if (rerollsAllowed(without) - rerollsUsed < 0) return notify('You have already spent the rerolls this trait gave you.', 'error');
      setChosenKeys(chosenKeys.filter((key) => key !== offer.key));
      return undefined;
    }
    if (offer.rarity !== 'gifted' && used >= allowed) return notify(`You have used all ${allowed} picks. Put one back to choose another.`, 'error');
    setChosenKeys([...chosenKeys, offer.key]);
    if (offer.ids.includes('prodigy')) {
      const extra = dealOffers(rng.current, B.START.prodigyExtraOffers, offerIds(offers));
      setOffers([...offers, ...extra]);
    }
    return undefined;
  }

  function rerollOffer(offer) {
    if (rerollsLeft <= 0) return;
    const fresh = dealOffer(rng.current, offerIds(offers));
    if (!fresh) return notify('There are no other traits left to deal.', 'error');
    setOffers(offers.map((item) => (item.key === offer.key ? fresh : item)));
    setRerollsUsed(rerollsUsed + 1);
    return undefined;
  }

  // ---------- Dice ----------

  function lockTraitsAndRoll() {
    if (!dice) {
      setDice(rollDice(rng.current, chosen));
      setRollCount(1);
    }
    setStep(2);
  }

  function rerollAll() {
    if (rerollsLeft <= 0) return;
    setDice(rollDice(rng.current, chosen));
    setKept([]);
    setAssigned({ str: null, agi: null, int: null, end: null });
    setRerollsUsed(rerollsUsed + 1);
    setRollCount(rollCount + 1);
  }

  function rerollOne(die) {
    if (rerollsLeft <= 0) return;
    const fresh = rollDie(rng.current, chosen);
    setDice(dice.map((item) => (item.id === die.id ? fresh : item)));
    setKept(kept.filter((id) => id !== die.id));
    setRerollsUsed(rerollsUsed + 1);
  }

  function toggleKeep(die) {
    if (kept.includes(die.id)) setKept(kept.filter((id) => id !== die.id));
    else if (kept.length < B.START.keep) setKept([...kept, die.id]);
    else notify(`Keep ${B.START.keep} dice. Tap a kept die to let it go.`, 'error');
  }

  function toAssign() {
    // Drop any assignment that points at a die no longer kept.
    const next = { ...assigned };
    for (const key of ATTR_KEYS) if (!kept.includes(next[key])) next[key] = null;
    setAssigned(next);
    setHolding(null);
    setStep(3);
  }

  // ---------- Assign ----------

  const pool = kept.filter((id) => !Object.values(assigned).includes(id));

  function place(key, dieId) {
    const next = { ...assigned };
    for (const other of ATTR_KEYS) if (next[other] === dieId) next[other] = null;
    next[key] = dieId;
    setAssigned(next);
    setHolding(null);
  }

  function tapSlot(key) {
    if (holding) return place(key, holding);
    if (assigned[key]) return setAssigned({ ...assigned, [key]: null });
    if (pool.length === 1) return place(key, pool[0]);
    return notify('Tap a die first, then the attribute it goes to.', 'info');
  }

  function autoPlace(dieId) {
    const free = ATTR_KEYS.find((key) => !assigned[key]);
    if (free) place(free, dieId);
  }

  // ---------- Locomotive ----------

  function toLocomotive() {
    // Starters are free, so they carry no resale value either.
    if (!starters) setStarters(STARTER_MODELS.map((model) => ({ ...generateLoco(rng.current, model), price: 0 })));
    setStep(4);
  }

  function finish() {
    const conductor = buildConductor({
      name,
      chosen,
      attributes,
      rerollsLeft: Math.max(0, rerollsLeft),
      loco,
      seed: newSeed(),
      now: Date.now(),
    });
    if (IS_NFT) makeCaptainSave(conductor, { focus, crewName: randomName(rng.current) });
    createSave(slot, conductor);
    go('setup', { ctx: { kind: 'test' } });
  }

  const advice = allAssigned ? recommendStarter(attributes) : null;
  const kit = startingKitPreview(chosen, Math.max(0, rerollsLeft), loco);

  return (
    <div className="page" style={{ paddingBottom: 48 }}>
      <div className="page-head">
        <div className="spread">
          <h1>{IS_NFT ? 'New Captain' : 'New conductor'}</h1>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('title')}>
            Cancel
          </button>
        </div>
        <ol className="steps" aria-label="Steps">
          {STEPS.map((label, index) => (
            <li key={label} className={index === step ? 'now' : index < step ? 'done' : ''} aria-current={index === step ? 'step' : undefined}>
              {index + 1}. {label}
            </li>
          ))}
        </ol>
      </div>

      <div className="cols">
        <section className="stack">
          {step === 0 ? (
            <div className="plate riveted stack">
              <h2>{IS_NFT ? 'Who is the Captain?' : 'Who is at the controls?'}</h2>
              {IS_NFT ? <p className="muted">You are the Captain: you own the trains and hire conductors to drive them. Next you roll your first conductor.</p> : null}
              <form
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (name.trim()) setStep(1);
                }}
              >
                <label className="label" htmlFor="conductor-name">
                  {IS_NFT ? 'Captain name' : 'Conductor name'}
                </label>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input id="conductor-name" className="field" style={{ background: 'var(--paper)' }} value={name} maxLength={28} autoComplete="off" placeholder="Captain Rex" onChange={(event) => setName(event.target.value)} />
                  <button type="button" className="btn" onClick={() => setName(randomName(rng.current))} aria-label="Suggest a name">
                    <Dices aria-hidden="true" />
                    <span className="hide-narrow">Suggest</span>
                  </button>
                </div>
                {IS_NFT ? (
                  <div className="stack-sm">
                    <span className="label">Your focus</span>
                    <div className="focus-pick">
                      {Object.entries(FOCUSES).map(([id, f]) => (
                        <button type="button" key={id} className={`focus-card ${focus === id ? 'on' : ''}`} aria-pressed={focus === id} onClick={() => setFocus(id)}>
                          <b>{f.name}</b>
                          <span>{f.blurb}</span>
                          <small>{f.perk}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <button type="submit" className="btn btn-brass btn-lg" disabled={!name.trim()}>
                  {IS_NFT ? "Roll your first conductor's traits" : 'Choose traits'}
                  <ArrowRight aria-hidden="true" />
                </button>
              </form>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="stack">
              <div className="plate riveted stack-sm">
                <div className="spread">
                  <h2>Pick {allowed} traits</h2>
                  <div className="row">
                    <span className="chip">
                      {used}/{allowed} picked
                    </span>
                    <span className="chip">
                      <RefreshCw aria-hidden="true" />
                      {rerollsLeft} rerolls
                    </span>
                  </div>
                </div>
                <p className="muted">
                  Rerolls are shared with your attribute dice, and each one you keep is worth {B.START.rerollBonusLt} LT. Swap any card you have not picked for one reroll.
                </p>
              </div>
              <div className="trait-grid">
                {offers.map((offer) => {
                  const isChosen = chosenKeys.includes(offer.key);
                  return (
                    <div key={offer.key} className="trait-wrap">
                      <button type="button" className={`trait-card ${offer.rarity}`} aria-pressed={isChosen ? 'true' : 'false'} onClick={() => toggleOffer(offer)}>
                        <h3>{offer.ids.map((id) => TRAITS[id].name).join(' + ')}</h3>
                        <div className="row" style={{ gap: 6 }}>
                          <TraitRarityTag rarity={offer.rarity} />
                          <span className="label">{offer.ids.map((id) => TRAITS[id].where).join(', ')}</span>
                        </div>
                        {offer.ids.map((id) => (
                          <p key={id}>{TRAITS[id].text}</p>
                        ))}
                        {offer.rarity !== 'normal' ? <p className="brass small">{TRAIT_RARITIES[offer.rarity].note}</p> : null}
                        {isChosen ? <Check className="trait-check" aria-hidden="true" /> : null}
                      </button>
                      {!isChosen ? (
                        <button type="button" className="btn btn-sm icon-btn reroll" disabled={rerollsLeft <= 0} onClick={() => rerollOffer(offer)} aria-label={`Swap ${TRAITS[offer.ids[0]].name} for another trait (1 reroll)`} title="Swap for another trait (1 reroll)">
                          <RefreshCw aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="row">
                <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>
                  <ArrowLeft aria-hidden="true" />
                  Name
                </button>
                <button type="button" className="btn btn-brass btn-lg grow" disabled={used < needed} onClick={lockTraitsAndRoll}>
                  {used >= needed ? 'Lock traits and roll' : `Pick ${needed - used} more`}
                  <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}

          {step === 2 && dice ? (
            <div className="plate riveted stack">
              <div className="spread">
                <h2>Roll for attributes</h2>
                <span className="chip">
                  <RefreshCw aria-hidden="true" />
                  {rerollsLeft} rerolls
                </span>
              </div>
              <p className="muted">
                {offerHas(chosen, 'consistent') ? `${B.START.dice} rolls of three six-sided dice.` : `${B.START.dice} twenty-sided dice.`} Keep the {B.START.keep} you want. Your traits are now locked.
              </p>
              <div className="dice-tray" key={rollCount}>
                {dice.map((die) => (
                  <div key={die.id} style={{ position: 'relative' }}>
                    <Die die={die} rolling selected={kept.includes(die.id)} onClick={() => toggleKeep(die)} label={`Die showing ${die.value}${kept.includes(die.id) ? ', kept' : ''}`} />
                    {focused ? (
                      <button type="button" className="btn btn-sm icon-btn" style={{ position: 'absolute', top: -6, right: -2 }} disabled={rerollsLeft <= 0} onClick={() => rerollOne(die)} aria-label={`Reroll the die showing ${die.value}`}>
                        <RefreshCw aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="row">
                {!focused ? (
                  <button type="button" className="btn" disabled={rerollsLeft <= 0} onClick={rerollAll}>
                    <Dices aria-hidden="true" />
                    Reroll all {B.START.dice}
                  </button>
                ) : (
                  <span className="muted small">Focused: reroll single dice with the button on each.</span>
                )}
                <button type="button" className="btn btn-brass btn-lg grow" disabled={kept.length !== B.START.keep} onClick={toAssign}>
                  {kept.length === B.START.keep ? `Assign these ${B.START.keep}` : `Keep ${B.START.keep - kept.length} more`}
                  <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="plate riveted stack">
              <h2>Assign your dice</h2>
              <p className="muted">Tap a die, then the attribute it goes to. Tap a placed die to take it back.</p>
              <div className="row" style={{ minHeight: 96, justifyContent: 'center', gap: 16 }}>
                {pool.length === 0 ? <span className="muted">All {B.START.keep} placed.</span> : null}
                {pool.map((id) => {
                  const die = dieById(id);
                  return (
                    <div key={id} style={{ width: 84 }} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', id)} onDoubleClick={() => autoPlace(id)}>
                      <Die die={die} selected={holding === id} onClick={() => setHolding(holding === id ? null : id)} />
                    </div>
                  );
                })}
              </div>
              <div className="slots">
                {ATTR_KEYS.map((key) => {
                  const die = dieById(assigned[key]);
                  return (
                    <button
                      type="button"
                      key={key}
                      className={`slot ${die ? 'filled' : ''} ${holding ? 'ready' : ''}`}
                      onClick={() => tapSlot(key)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const id = event.dataTransfer.getData('text/plain');
                        if (kept.includes(id)) place(key, id);
                      }}
                      aria-label={`${ATTRIBUTES[key].name}${die ? `, ${die.value}` : ', empty'}`}
                    >
                      <h3>{ATTRIBUTES[key].name}</h3>
                      {die ? <Die die={die} /> : <span className="empty">Empty</span>}
                      <span className="muted small">{ATTRIBUTES[key].gives}</span>
                      {die ? (
                        <span className="brass small num">
                          {key === 'int' ? `+${fmt(die.value * B.ATTR.researchSpeedPerInt * 100)}% research speed` : key === 'end' ? `${fmt((1 - 1 / (1 + die.value * B.HEAT.perCondEnd)) * 100, 1)}% less heat` : `+${fmt(die.value * B.ATTR.perPoint * 100, 1)}%`}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <div className="row">
                <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>
                  <ArrowLeft aria-hidden="true" />
                  Dice
                </button>
                <button type="button" className="btn btn-brass btn-lg grow" disabled={!allAssigned} onClick={toLocomotive}>
                  Choose a locomotive
                  <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}

          {step === 4 && starters ? (
            <div className="stack">
              <div className="plate riveted stack-sm">
                <h2>Choose your first locomotive</h2>
                <p className="muted">One of each model is on the lot today. Your starter is free. The numbers already include what your conductor adds.</p>
                {advice ? (
                  <p className="note">
                    <b>{MODELS[advice.model].name}</b> suits you. {advice.why}
                  </p>
                ) : null}
              </div>
              <div className="grid">
                {starters.map((item) => {
                  const stats = deriveStats(item, draft);
                  return (
                    <button type="button" key={item.id} className="plate loco-card" aria-pressed={locoId === item.id ? 'true' : 'false'} onClick={() => setLocoId(item.id)}>
                      <div className="spread">
                        <h3>{item.name}</h3>
                        <div className="row" style={{ gap: 6 }}>
                          {advice?.model === item.model ? <span className="tag tag-solid">Suits you</span> : null}
                          <RarityTag rarity={item.rarity} />
                        </div>
                      </div>
                      <LocoArt model={item.model} />
                      <p className="muted small">{MODELS[item.model].blurb}</p>
                      <div className="core3">
                        <div>
                          <span className="label">Power</span>
                          <b>{item.power}</b>
                        </div>
                        <div>
                          <span className="label">Efficiency</span>
                          <b>{item.efficiency}</b>
                        </div>
                        <div>
                          <span className="label">Armor</span>
                          <b>{item.durability}</b>
                        </div>
                      </div>
                      <div className="stats">
                        <Stat label="Horsepower" value={fmt(stats.hp)} />
                        <Stat label="Torque" value={fmt(stats.tq)} />
                        <Stat label="Weight" value={lb(stats.weight)} unit="lb" />
                        <Stat label="Top speed" value={fmt(stats.topSpeed)} unit="mph at 5 tons" />
                        <Stat label="Fuel economy" value={fmt(stats.tmpg, 1)} unit="ton-mi/gal" />
                        <Stat label="Can tow" value={lb(stats.tow)} unit="lb" />
                      </div>
                      <span className="brass small">{MODELS[item.model].perk}</span>
                    </button>
                  );
                })}
              </div>
              <div className="plate stack">
                <div className="spread">
                  <div>
                    <span className="label">Starting kit</span>
                    <div className="row">
                      <b className="num brass" style={{ fontSize: '1.3rem' }}>
                        {fmt(kit.lt)} LT
                      </b>
                      <b className="num fuel" style={{ fontSize: '1.3rem' }}>
                        {fmt(kit.fuel)} gal
                      </b>
                    </div>
                  </div>
                  <button type="button" className="btn btn-ghost" onClick={() => setStep(3)}>
                    <ArrowLeft aria-hidden="true" />
                    Attributes
                  </button>
                </div>
                <button type="button" className="btn btn-ember btn-lg btn-block" disabled={!loco} onClick={finish}>
                  <TrainFront aria-hidden="true" />
                  {loco ? `Take ${loco.name} to the first run` : 'Pick a locomotive'}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="paper licence" aria-label="Conductor licence">
          <div className="spread">
            <span className="label">Nexus Rails Company</span>
            <span className="stamp gold">Licence</span>
          </div>
          <div className={`licence-name ${name.trim() ? '' : 'blank'}`}>{name.trim() || 'Name of conductor'}</div>
          <div>
            <span className="label">Traits</span>
            <TraitChips traits={traits} />
          </div>
          <div>
            <span className="label">Attributes</span>
            <div className="attr-row">
              {ATTR_KEYS.map((key) => (
                <div className="attr-box" key={key}>
                  <span className="label">{ATTRIBUTES[key].name}</span>
                  <b>{attributes[key] ?? '–'}</b>
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Locomotive</span>
            <div className="row">
              <b>{loco ? loco.name : 'Not chosen'}</b>
              {loco ? <RarityTag rarity={loco.rarity} /> : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
