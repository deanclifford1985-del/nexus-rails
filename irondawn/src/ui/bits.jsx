import React, { useEffect, useRef, useState } from 'react';
import {
  Binoculars,
  Bomb,
  Brain,
  Crosshair,
  Dumbbell,
  Ear,
  Eye,
  Footprints,
  Handshake,
  HeartPulse,
  Lock,
  Mountain,
  Radio,
  Shield,
  Star,
  Stethoscope,
  Swords,
  Target,
  Users,
  Wind,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { RANKS } from '../game/ranks.js';
import { TIER_NAMES } from '../game/items.js';

// Shared pieces every menu is built from: the panel frame, buttons, bars, tabs, rank insignia.

export const cx = (...parts) => parts.filter(Boolean).join(' ');
const clamp01 = (v) => Math.max(0, Math.min(1, v ?? 0));

export function Panel({ kicker, title, icon: Icon, size = 'md', tall = false, onClose, side, tabs, foot, children, className, tone }) {
  return (
    <section className={cx('ui-panel', `ui-panel-${size}`, tall && 'ui-panel-tall', tone && `ui-panel-${tone}`, className)} role="dialog" aria-label={typeof title === 'string' ? title : undefined}>
      <header className="ui-head">
        {Icon ? <Icon className="ui-head-icon" size={22} aria-hidden="true" /> : null}
        <div className="ui-head-text">
          {kicker ? <span className="ui-kicker">{kicker}</span> : null}
          <h2 className="ui-title">{title}</h2>
        </div>
        {side ? <div className="ui-head-side">{side}</div> : null}
        {onClose ? (
          <button type="button" className="ui-close" onClick={onClose} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        ) : null}
      </header>
      {tabs}
      <div className="ui-body">{children}</div>
      {foot ? <footer className="ui-foot">{foot}</footer> : null}
    </section>
  );
}

export function Btn({ tone = 'plain', small = false, icon: Icon, children, className, ...rest }) {
  return (
    <button type="button" className={cx('ui-btn', `ui-btn-${tone}`, small && 'ui-btn-sm', className)} {...rest}>
      {Icon ? <Icon size={small ? 15 : 17} aria-hidden="true" /> : null}
      {children !== undefined && children !== null ? <span>{children}</span> : null}
    </button>
  );
}

// A button that asks once more before it acts.
export function ConfirmBtn({ children, confirm = 'Sure?', onConfirm, ...rest }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Btn
      {...rest}
      tone={armed ? 'danger' : rest.tone}
      onClick={() => {
        if (armed) {
          window.clearTimeout(timer.current);
          setArmed(false);
          onConfirm?.();
        } else {
          setArmed(true);
          timer.current = window.setTimeout(() => setArmed(false), 3500);
        }
      }}
    >
      {armed ? confirm : children}
    </Btn>
  );
}

export function Bar({ share, tone = 'olive', under, className, label }) {
  return (
    <div className={cx('ui-bar', `ui-bar-${tone}`, className)} role="img" aria-label={label}>
      <i style={{ width: `${clamp01(share) * 100}%` }} />
      {under !== undefined ? <u style={{ width: `${clamp01(under) * 100}%` }} /> : null}
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('ui-tabs', className)} role="tablist">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button key={tab.id} type="button" role="tab" aria-selected={value === tab.id} className={cx('ui-tab', value === tab.id && 'is-on')} onClick={() => onChange(tab.id)}>
            {Icon ? <Icon size={16} aria-hidden="true" /> : null}
            <span>{tab.name}</span>
            {tab.badge ? <em className="ui-badge">{tab.badge}</em> : null}
          </button>
        );
      })}
    </div>
  );
}

export const Kv = ({ label, value, hint, warn, tone }) => (
  <div className={cx('ui-kv', warn && 'is-warn', tone && `is-${tone}`)} title={hint}>
    <span>{label}</span>
    <b>{value}</b>
  </div>
);

export const Chip = ({ children, tone, icon: Icon, title }) => (
  <span className={cx('ui-chip', tone && `ui-chip-${tone}`)} title={title}>
    {Icon ? <Icon size={13} aria-hidden="true" /> : null}
    {children}
  </span>
);

export const Tier = ({ tier }) => <span className={cx('ui-tier', `ui-tier-${tier}`)}>{TIER_NAMES[tier] ?? `Tier ${tier}`}</span>;

export const Section = ({ title, side, children, className }) => (
  <section className={cx('ui-section', className)}>
    {title ? (
      <header className="ui-section-head">
        <h3>{title}</h3>
        {side ? <div className="ui-section-side">{side}</div> : null}
      </header>
    ) : null}
    {children}
  </section>
);

export const Empty = ({ children }) => <p className="ui-empty">{children}</p>;

// Calls handler for every key press while mounted. The handler gets the event; return true to
// mark it handled (stops the browser's default, e.g. Space scrolling).
export function useKeys(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (event) => {
      if (event.defaultPrevented) return;
      const el = event.target;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing && event.key !== 'Escape') return;
      if (ref.current(event) === true) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

// ---------- rank insignia, drawn from RANKS[i].insignia ----------
const METAL = { gold: '#e7c257', silver: '#d5dbde' };

function chevronPaths({ chevrons = 0, rockers = 0 }) {
  const step = 6.5;
  const chevronsHeight = chevrons > 0 ? (chevrons - 1) * step + 11 : 0;
  const rockersHeight = rockers > 0 ? (rockers - 1) * step + 6 : 0;
  const gap = chevrons > 0 && rockers > 0 ? 1.5 : 0;
  const top = 24 - (chevronsHeight + gap + rockersHeight) / 2;
  const paths = [];
  for (let i = 0; i < chevrons; i++) {
    const y = top + i * step;
    paths.push(`M8 ${y + 11} L24 ${y} L40 ${y + 11}`);
  }
  const base = top + chevronsHeight + gap;
  for (let j = 0; j < rockers; j++) {
    const y = base + j * step;
    paths.push(`M8 ${y} Q24 ${y + 10} 40 ${y}`);
  }
  return paths;
}

export function Insignia({ rank = 0, size = 44, plain = false }) {
  const def = RANKS[Math.max(0, Math.min(RANKS.length - 1, rank))];
  const ins = def.insignia ?? { kind: 'none' };
  const metal = METAL[ins.metal] ?? METAL.gold;
  let art = null;
  if (ins.kind === 'chevron') {
    art = chevronPaths(ins).map((d, i) => <path key={i} d={d} fill="none" stroke={METAL.gold} strokeWidth="3.4" strokeLinejoin="miter" strokeLinecap="butt" />);
  } else if (ins.kind === 'bar') {
    const n = ins.bars ?? 1;
    const w = 9;
    const gap = 5;
    const total = n * w + (n - 1) * gap;
    art = Array.from({ length: n }, (_, i) => <rect key={i} x={24 - total / 2 + i * (w + gap)} y={10} width={w} height={28} rx={1.2} fill={metal} stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />);
  } else if (ins.kind === 'leaf') {
    art = (
      <g fill={metal} stroke="rgba(0,0,0,0.35)" strokeWidth="0.7">
        <path d="M24 5 C27 9 31 8 31 12.5 C35 12.5 35.5 17 33 19 C37.5 20 37.5 25.5 33 26.5 C36 29.5 33 33.5 29 32.5 C29 36 26.5 37 25.2 36 L25.2 43 L22.8 43 L22.8 36 C21.5 37 19 36 19 32.5 C15 33.5 12 29.5 15 26.5 C10.5 25.5 10.5 20 15 19 C12.5 17 13 12.5 17 12.5 C17 8 21 9 24 5 Z" />
        <path d="M24 10 L24 36 M24 17 L19 14.5 M24 17 L29 14.5 M24 24 L17.5 22 M24 24 L30.5 22 M24 30 L19.5 29.5 M24 30 L28.5 29.5" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="0.9" />
      </g>
    );
  } else if (ins.kind === 'eagle') {
    art = (
      <g fill={metal} stroke="rgba(0,0,0,0.35)" strokeWidth="0.7">
        <path d="M24 15 C19 10.5 10 10 3.5 13 C8 15 9.5 17 8.5 20.5 C12.5 19 15.5 20 16.5 23.5 C19 21.5 21 21.5 22 24 L22 30 L17.5 39 L22 36.5 L24 41.5 L26 36.5 L30.5 39 L26 30 L26 24 C27 21.5 29 21.5 31.5 23.5 C32.5 20 35.5 19 39.5 20.5 C38.5 17 40 15 44.5 13 C38 10 29 10.5 24 15 Z" />
        <path d="M21 10.5 C21 7.5 26 6.5 27.5 9 L30.5 10 L27.5 11.5 C27 14 21 14 21 10.5 Z" />
      </g>
    );
  } else {
    art = <circle cx="24" cy="24" r="7" fill="none" stroke="rgba(231,194,87,0.55)" strokeWidth="2" strokeDasharray="3 3.4" />;
  }
  return (
    <span className={cx('ui-insignia', plain && 'is-plain')} style={{ width: size, height: size }} title={def.name}>
      <svg viewBox="0 0 48 48" width={size} height={size} aria-label={def.name} role="img">
        {art}
      </svg>
    </span>
  );
}

// ---------- icons ----------
const ATTR_ICONS = {
  endurance: HeartPulse,
  speed: Wind,
  quickness: Zap,
  strength: Dumbbell,
  climbing: Mountain,
  toughness: Shield,
  accuracy: Crosshair,
  scope: Target,
  stealth: Footprints,
  vision: Eye,
  perception: Ear,
  intelligence: Brain,
  medicine: Stethoscope,
  engineering: Wrench,
  leadership: Star,
  communication: Radio,
  negotiating: Handshake,
};
export const AttrIcon = ({ id, size = 16 }) => {
  const Icon = ATTR_ICONS[id] ?? Star;
  return <Icon size={size} aria-hidden="true" />;
};

const MISSION_ICONS = { defense: Shield, rescue: Users, recon: Binoculars, capture: Lock, elimination: Crosshair, sabotage: Bomb, assault: Swords };
export const MissionIcon = ({ type, size = 18 }) => {
  const Icon = MISSION_ICONS[type] ?? Target;
  return <Icon size={size} aria-hidden="true" />;
};

// A speaker's badge: initials on their colour.
export function Avatar({ name, tone = 'olive', size = 52 }) {
  const initials = String(name ?? '?')
    .replace(/[“”"]/g, '')
    .split(/\s+/)
    .filter((word) => /^[A-Z]/.test(word))
    .slice(-2)
    .map((word) => word[0])
    .join('');
  return (
    <span className={cx('ui-avatar', `ui-avatar-${tone}`)} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {initials || '?'}
    </span>
  );
}

// Ten pips showing a mission's tier.
export const TierPips = ({ tier, max = 10 }) => (
  <span className="ui-pips" title={`Threat tier ${tier} of ${max}`} aria-label={`Threat tier ${tier} of ${max}`}>
    {Array.from({ length: max }, (_, i) => (
      <i key={i} className={i < tier ? 'is-on' : ''} />
    ))}
  </span>
);
