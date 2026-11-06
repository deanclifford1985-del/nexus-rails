import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FastForward } from 'lucide-react';
import { CRATE_TIERS } from '../game/crates.js';
import { ratingOf } from '../game/power.js';
import { NftGameCard } from './GameCard.jsx';

// The crate-opening scene: the crate shakes and glows, the lid blows off in a flash of light,
// sparks fly, and the NFT's card spins up out of the crate. Rarer crates shake longer and burn
// brighter; Legendary gets wide gold beams. Tap anywhere (or Skip) to jump to the card.

const TIMING = {
  uncommon: { shake: 1000, burst: 450, reveal: 1700, sparks: 18 },
  rare: { shake: 1300, burst: 500, reveal: 1800, sparks: 26 },
  epic: { shake: 1700, burst: 550, reveal: 1900, sparks: 36 },
  legendary: { shake: 2400, burst: 650, reveal: 2100, sparks: 54 },
};
const HEADLINE = { uncommon: 'Uncommon', rare: 'Rare!', epic: 'Epic!', legendary: 'Legendary!!' };

export default function CrateOpening({ nft, children, onDone }) {
  const rarity = CRATE_TIERS[nft.tier]?.rarity ?? 'uncommon';
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
  }, [nft.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const rating = ratingOf(nft.kind, nft.data);

  return (
    <div
      className={`copen copen-${rarity} ph-${phase}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Opening ${CRATE_TIERS[nft.tier]?.name ?? 'crate'}`}
      style={{ '--shake': `${T.shake}ms` }}
      onClick={phase !== 'done' ? skip : undefined}
    >
      <div className="copen-flash" aria-hidden="true" />
      {phase !== 'done' ? (
        <button type="button" className="btn btn-sm copen-skip" onClick={(e) => (e.stopPropagation(), skip())}>
          <FastForward aria-hidden="true" /> Skip
        </button>
      ) : null}
      <div className="copen-stage">
        <div className="copen-rays" aria-hidden="true" />
        <div className="copen-glow" aria-hidden="true" />
        <div className="copen-headline" aria-live="polite">
          {phase === 'reveal' || phase === 'done' ? HEADLINE[rarity] : ''}
        </div>
        <div className="copen-pit">
          <div className="copen-crate" aria-hidden="true">
            <div className="copen-lid" />
            <div className="copen-box" />
            <div className="copen-seam" />
            <div className="copen-gem" />
            <div className="copen-label">{CRATE_TIERS[nft.tier]?.name}</div>
            <div className="copen-sparks">
              {sparks.map((s, i) => (
                <i key={i} style={{ '--x': `${s.x}px`, '--y': `${s.y}px`, '--d': `${s.delay}s` }} />
              ))}
            </div>
          </div>
          <div className="copen-card">
            <div className="copen-card-inner">
              <div className="copen-front">
                <NftGameCard nft={nft} size="lg" />
              </div>
              <div className="copen-back" aria-hidden="true">
                NEXUS
              </div>
            </div>
          </div>
        </div>
        <div className="copen-actions" aria-hidden={phase !== 'done'}>
          <span className="sr-only">Power rating {rating.toLocaleString()}</span>
          {children}
        </div>
      </div>
    </div>
  );
}
