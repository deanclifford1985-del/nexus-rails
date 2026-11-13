import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Star, Sparkles, Gift, Layers } from 'lucide-react';
import { B } from '../game/balance.js';
import { TRAITS, TRAIT_RARITIES } from '../game/traits.js';

export function Stat({ label, value, unit, tone }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <b className={tone}>
        {value}
        {unit ? <small>{unit}</small> : null}
      </b>
    </div>
  );
}

export function Meter({ value, max = 1, tone = '', thin = false, label }) {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className={`meter ${tone} ${thin ? 'thin' : ''}`} role="progressbar" aria-label={label} aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${share * 100}%` }} />
    </div>
  );
}

export function Pips({ filled, open, total }) {
  return (
    <span className="pips" aria-label={`${filled} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < filled ? 'on' : i < open ? 'open' : ''} />
      ))}
    </span>
  );
}

export function Stars({ count, total = 5 }) {
  return (
    <span className="stars" aria-label={`${count} of ${total} stars`}>
      {Array.from({ length: total }, (_, i) => (
        <Star key={i} className={i < count ? 'on' : ''} />
      ))}
    </span>
  );
}

export function RarityTag({ rarity }) {
  return <span className={`tag tag-${rarity}`}>{B.RARITY[rarity].label}</span>;
}

const RARITY_ICON = { profound: Sparkles, gifted: Gift, infused: Layers };

export function TraitRarityTag({ rarity }) {
  if (rarity === 'normal' || !rarity) return null;
  const Icon = RARITY_ICON[rarity];
  const tone = rarity === 'profound' ? 'tag-rare' : rarity === 'gifted' ? 'go' : 'tag-epic';
  return (
    <span className={`tag ${tone}`} title={TRAIT_RARITIES[rarity].note}>
      <Icon aria-hidden="true" />
      {TRAIT_RARITIES[rarity].label}
    </span>
  );
}

// Trait names as held by a conductor, e.g. "Leader", "Profound Competitive".
export function TraitChips({ traits }) {
  const list = (traits ?? []).map((trait) => (typeof trait === 'string' ? { id: trait } : trait)).filter((trait) => TRAITS[trait?.id]);
  if (!list.length) return <span className="muted">No traits</span>;
  return (
    <div className="row" style={{ gap: 6 }}>
      {list.map((trait, index) => (
        <span key={`${trait.id}-${index}`} className={`tag ${trait.rarity === 'profound' ? 'tag-rare' : trait.rarity === 'infused' ? 'tag-epic' : 'tag-uncommon'}`} title={TRAITS[trait.id].text}>
          {trait.rarity === 'profound' ? 'Profound ' : trait.rarity === 'infused' ? 'Half ' : ''}
          {TRAITS[trait.id].name}
        </span>
      ))}
    </div>
  );
}

export function Dialog({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label={title}>
      <div className="paper dialog stack">
        {title ? <h2>{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}

// A button that asks once more before doing something that cannot be undone.
export function ConfirmButton({ children, confirmLabel, onConfirm, className = 'btn btn-ghost btn-sm' }) {
  const [armed, setArmed] = useState(false);
  const armedAt = useRef(0);
  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);
  if (!armed) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          armedAt.current = Date.now();
          setArmed(true);
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="btn btn-ember btn-sm"
      onClick={() => {
        // The second half of a double-click must not count as the confirmation.
        if (Date.now() - armedAt.current < 600) return;
        setArmed(false);
        onConfirm();
      }}
    >
      {confirmLabel}
    </button>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

// After a purchase the layout shifts, so a second click can land on a different button.
// `cooling` is true for a moment after `start()`; disable nearby buy buttons while it is.
export function useCooldown(ms = 700) {
  const [cooling, setCooling] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const start = useCallback(() => {
    setCooling(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCooling(false), ms);
  }, [ms]);
  return [cooling, start];
}
