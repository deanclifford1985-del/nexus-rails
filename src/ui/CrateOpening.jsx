import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FastForward } from 'lucide-react';
import { CRATE_TIERS, crateRarity } from '../game/crates.js';
import { ratingOf } from '../game/power.js';
import { B } from '../game/balance.js';
import { NftGameCard } from './GameCard.jsx';

// The crate-opening scene: the crate shakes and glows, the lid blows off in a flash of light,
// sparks fly, and the two cards inside (locomotive and conductor) spin up out of the crate. Rarer crates shake longer and burn
// brighter; Legendary gets wide gold beams. Tap anywhere (or Skip) to jump to the card.

const TIMING = {
  uncommon: { shake: 1000, burst: 450, reveal: 2100, sparks: 18 },
  rare: { shake: 1300, burst: 500, reveal: 2200, sparks: 26 },
  epic: { shake: 1700, burst: 550, reveal: 2300, sparks: 36 },
  legendary: { shake: 2400, burst: 650, reveal: 2500, sparks: 54 },
};
const HEADLINE = { uncommon: 'Uncommon', rare: 'Rare!', epic: 'Epic!', legendary: 'Legendary!!' };

export default function CrateOpening({ opened, children, onDone }) {
  const { tier, nfts } = opened;
  const rarity = CRATE_TIERS[tier] ? crateRarity(tier) : 'uncommon';
  const T = TIMING[rarity] ?? TIMING.uncommon;
  const [phase, setPhase] = useState('shake');
  const timers = useRef([]);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduced) {
      setPhase('done');
      return undefined;
    }
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms));
    at(T.shake, () => {
      setPhase('burst');
      try {
        navigator.vibrate?.(rarity === 'legendary' ? [60, 40, 120] : 40);
      } catch {
        /* no vibration */
      }
    });
    at(T.shake + T.burst, () => setPhase('reveal'));
    at(T.shake + T.burst + T.reveal, () => {
      setPhase('done');
      onDone?.();
    });
    return () => timers.current.forEach(clearTimeout);
  }, [opened.crate]); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = () => {
    if (phase === 'done') return;
    timers.current.forEach(clearTimeout);
    setPhase('done');
    onDone?.();
  };

  const sparks = useMemo(
    () =>
      Array.from({ length: T.sparks }, (_, i) => {
        const a = (i / T.sparks) * Math.PI * 2 + (i % 3) * 0.3;
        const d = 120 + ((i * 53) % 160) * (rarity === 'legendary' ? 1.6 : 1);
        return { x: Math.cos(a) * d, y: Math.sin(a) * d - 40, delay: (i % 6) * 0.04 };
      }),
    [T.sparks, rarity],
  );
  const ratings = nfts.map((n) => `${n.data.name} ${ratingOf(n.kind, n.data).toLocaleString()}`).join(', ');
  const mix = nfts.map((n) => B.RARITY[n.data.rarity]?.label ?? n.data.rarity).join(' + ');

  return (
    <div
      className={`copen copen-${rarity} ph-${phase}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Opening ${CRATE_TIERS[tier]?.name ?? 'crate'}`}
      style={{ '--shake': `${T.shake}ms` }}
      onClick={phase !== 'done' ? skip : undefined}
    >
      <div className="copen-flash" aria-hidden="true" />
      {phase !== 'done' ? (
        <button type="button" className="btn btn-sm copen-skip" onClick={(e) => (e.stopPropagation(), skip())}>
          <FastForward aria-hidden="true" /> Skip
        </button>
      ) : null}
      <div className="copen-stage pair">
        <div className="copen-rays" aria-hidden="true" />
        <div className="copen-glow" aria-hidden="true" />
        <div className="copen-headline" aria-live="polite">
          {phase === 'reveal' || phase === 'done' ? (
            <>
              {HEADLINE[rarity]}
              <span className="copen-mix">{mix}</span>
            </>
          ) : ''}
        </div>
        <div className="copen-pit">
          <div className="copen-crate" aria-hidden="true">
            <div className="copen-lid" />
            <div className="copen-box" />
            <div className="copen-seam" />
            <div className="copen-gem" />
            <div className="copen-label">{CRATE_TIERS[tier]?.name}</div>
            <div className="copen-sparks">
              {sparks.map((s, i) => (
                <i key={i} style={{ '--x': `${s.x}px`, '--y': `${s.y}px`, '--d': `${s.delay}s` }} />
              ))}
            </div>
          </div>
          <div className="copen-card pair">
            <div className="gpair">
              {nfts.map((n, i) => (
                <div className="copen-card-inner" key={n.id} style={{ animationDelay: `${0.35 + i * 0.45}s` }}>
                  <div className="copen-front">
                    <NftGameCard nft={n} />
                  </div>
                  <div className="copen-back" aria-hidden="true">
                    NEXUS
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="copen-actions" aria-hidden={phase !== 'done'}>
          <span className="sr-only">Power ratings: {ratings}</span>
          {children}
        </div>
      </div>
    </div>
  );
}
