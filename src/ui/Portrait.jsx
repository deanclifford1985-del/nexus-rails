import React, { useMemo } from 'react';

// A conductor's portrait, drawn from their id: the same conductor always looks the same.
// Face, skin, hair, facial hair, coat, cap and accessories vary; the trim follows the rarity.

const RARITY = {
  common: { glow: '#8a96a8', trim: '#9aa6b6', badge: '#c9d2de' },
  uncommon: { glow: '#9aa6b5', trim: '#c9d3df', badge: '#eef3f8' },
  rare: { glow: '#2f9dff', trim: '#5fb6ff', badge: '#bfe0ff' },
  epic: { glow: '#a65cff', trim: '#c08cff', badge: '#ead8ff' },
  legendary: { glow: '#ff8a1e', trim: '#ffc451', badge: '#fff1c4' },
};
const SKIN = ['#f6d3b8', '#eac0a0', '#dba67f', '#c98d63', '#b07650', '#8f5a3a', '#6f4429', '#55331f'];
const HAIR = ['#1b1512', '#3a2618', '#5a3a22', '#8a5a2e', '#b98a4a', '#d8b878', '#9b9b9b', '#e8e2d6', '#7a2a1a', '#2a2f3a'];
const COAT = ['#1d2a44', '#3a1622', '#1e3326', '#2a2a30', '#35204a', '#40301c', '#16323a'];
const EYES = ['#3a2a1e', '#2a4a6a', '#3a5a3a', '#5a4a2a', '#1e1e24'];

function hashOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rngOf(seed) {
  let s = hashOf(seed) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function portraitLook(seed) {
  const r = rngOf(String(seed));
  const pick = (list) => list[Math.floor(r() * list.length)];
  const long = r() < 0.42;
  return {
    skin: pick(SKIN),
    hair: pick(HAIR),
    coat: pick(COAT),
    eye: pick(EYES),
    faceW: 30 + r() * 7,
    faceH: 38 + r() * 6,
    jaw: r(),
    long, // long hair: a ponytail or loose hair below the cap
    beard: long ? 'none' : pick(['none', 'none', 'mustache', 'full', 'goatee', 'chops', 'stubble']),
    brow: r() * 4 - 2,
    smile: r() * 6 - 1,
    goggles: r() < 0.28,
    monocle: r() < 0.08,
    scarf: r() < 0.45,
    scarfColor: pick(['#b8322a', '#d8b04a', '#2f9dff', '#2fd27a', '#e6e6e6', '#a65cff']),
    capTilt: r() * 8 - 4,
    scar: r() < 0.12,
    freckles: r() < 0.18,
    earring: r() < 0.2,
  };
}

export default function Portrait({ seed, rarity = 'uncommon', className = '', title }) {
  const look = useMemo(() => portraitLook(seed), [seed]);
  const R = RARITY[rarity] ?? RARITY.uncommon;
  const id = `p${hashOf(String(seed)).toString(36)}`;
  const { faceW: fw, faceH: fh } = look;
  const cx = 100;
  const cy = 112;
  const jawY = cy + fh * 0.62;
  const chin = 0.55 + look.jaw * 0.25;
  const face = `M ${cx - fw} ${cy - 6} Q ${cx - fw} ${cy - fh} ${cx} ${cy - fh} Q ${cx + fw} ${cy - fh} ${cx + fw} ${cy - 6} Q ${cx + fw * 0.98} ${jawY - 8} ${cx + fw * chin} ${jawY} Q ${cx} ${jawY + 10} ${cx - fw * chin} ${jawY} Q ${cx - fw * 0.98} ${jawY - 8} ${cx - fw} ${cy - 6} Z`;
  const eyeY = cy - 4;
  const shade = 'rgba(0,0,0,0.18)';
  return (
    <svg className={`portrait ${className}`} viewBox="0 0 200 200" role="img" aria-label={title ?? 'Conductor portrait'}>
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor={R.glow} stopOpacity="0.55" />
          <stop offset="55%" stopColor="#0b1220" stopOpacity="1" />
          <stop offset="100%" stopColor="#05080d" />
        </radialGradient>
        <linearGradient id={`${id}-coat`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={look.coat} />
          <stop offset="100%" stopColor="#05070b" />
        </linearGradient>
        <linearGradient id={`${id}-cap`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a3446" />
          <stop offset="100%" stopColor="#0e131c" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="200" height="200" fill={`url(#${id}-bg)`} />
      {/* rails in the background */}
      <g stroke={R.glow} strokeOpacity="0.16" strokeWidth="1.2">
        <line x1="0" y1="168" x2="200" y2="150" />
        <line x1="0" y1="182" x2="200" y2="162" />
      </g>
      {rarity === 'legendary' || rarity === 'epic' ? (
        <circle cx={cx} cy={cy - 6} r="78" fill="none" stroke={R.glow} strokeOpacity="0.35" strokeWidth="2" filter={`url(#${id}-glow)`} />
      ) : null}

      {/* long hair behind the head */}
      {look.long ? <path d={`M ${cx - fw - 6} ${cy - 18} Q ${cx - fw - 14} ${cy + 40} ${cx - fw + 4} ${cy + 58} L ${cx + fw - 4} ${cy + 58} Q ${cx + fw + 14} ${cy + 40} ${cx + fw + 6} ${cy - 18} Z`} fill={look.hair} /> : null}

      {/* coat and shoulders */}
      <path d={`M 18 200 Q 22 ${cy + 52} ${cx - 34} ${cy + 46} L ${cx + 34} ${cy + 46} Q 178 ${cy + 52} 182 200 Z`} fill={`url(#${id}-coat)`} />
      <path d={`M ${cx - 34} ${cy + 46} L ${cx} ${cy + 88} L ${cx + 34} ${cy + 46}`} fill="#e8e4da" />
      <path d={`M ${cx - 34} ${cy + 46} L ${cx - 6} ${cy + 92} L ${cx - 24} 200 L 40 200 Q 44 ${cy + 60} ${cx - 34} ${cy + 46} Z`} fill={look.coat} stroke={R.trim} strokeOpacity="0.55" strokeWidth="1.4" />
      <path d={`M ${cx + 34} ${cy + 46} L ${cx + 6} ${cy + 92} L ${cx + 24} 200 L 160 200 Q 156 ${cy + 60} ${cx + 34} ${cy + 46} Z`} fill={look.coat} stroke={R.trim} strokeOpacity="0.55" strokeWidth="1.4" />
      {[0, 1, 2].map((k) => (
        <circle key={k} cx={cx + 16} cy={cy + 104 + k * 16} r="3" fill={R.trim} filter={`url(#${id}-glow)`} />
      ))}
      <path d={`M ${cx - 8} ${cy + 64} L ${cx} ${cy + 74} L ${cx + 8} ${cy + 64} L ${cx} ${cy + 96} Z`} fill="#141820" />
      {look.scarf ? <path d={`M ${cx - 30} ${cy + 44} Q ${cx} ${cy + 62} ${cx + 30} ${cy + 44} L ${cx + 26} ${cy + 56} Q ${cx} ${cy + 72} ${cx - 26} ${cy + 56} Z`} fill={look.scarfColor} /> : null}

      {/* neck and face */}
      <rect x={cx - 13} y={jawY - 6} width="26" height="26" fill={look.skin} />
      <rect x={cx - 13} y={jawY - 6} width="26" height="10" fill={shade} />
      <ellipse cx={cx - fw - 2} cy={cy + 2} rx="6" ry="10" fill={look.skin} />
      <ellipse cx={cx + fw + 2} cy={cy + 2} rx="6" ry="10" fill={look.skin} />
      {look.earring ? <circle cx={cx + fw + 3} cy={cy + 12} r="2.4" fill={R.trim} /> : null}
      <path d={face} fill={look.skin} />
      <path d={face} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      {look.freckles
        ? [-14, -9, 9, 14, -11, 11].map((dx, k) => <circle key={k} cx={cx + dx} cy={cy + 10 + (k % 2) * 3} r="1" fill="rgba(120,60,30,0.45)" />)
        : null}

      {/* facial hair */}
      {look.beard === 'stubble' ? <path d={`M ${cx - fw * 0.9} ${cy + 12} Q ${cx} ${jawY + 18} ${cx + fw * 0.9} ${cy + 12} Q ${cx} ${jawY + 4} ${cx - fw * 0.9} ${cy + 12} Z`} fill={look.hair} opacity="0.35" /> : null}
      {look.beard === 'full' ? <path d={`M ${cx - fw * 0.95} ${cy + 4} Q ${cx - fw} ${jawY + 14} ${cx} ${jawY + 20} Q ${cx + fw} ${jawY + 14} ${cx + fw * 0.95} ${cy + 4} Q ${cx + 10} ${cy + 22} ${cx} ${cy + 22} Q ${cx - 10} ${cy + 22} ${cx - fw * 0.95} ${cy + 4} Z`} fill={look.hair} /> : null}
      {look.beard === 'goatee' ? <path d={`M ${cx - 9} ${jawY - 6} Q ${cx} ${jawY + 16} ${cx + 9} ${jawY - 6} Z`} fill={look.hair} /> : null}
      {look.beard === 'chops'
        ? [-1, 1].map((sgn) => <path key={sgn} d={`M ${cx + sgn * fw} ${cy - 6} L ${cx + sgn * fw * 0.95} ${cy + 22} Q ${cx + sgn * (fw - 8)} ${cy + 30} ${cx + sgn * (fw - 14)} ${cy + 18} L ${cx + sgn * (fw - 8)} ${cy - 6} Z`} fill={look.hair} />)
        : null}

      {/* eyes and brows */}
      {[-1, 1].map((sgn) => (
        <g key={sgn}>
          <ellipse cx={cx + sgn * 13} cy={eyeY} rx="6" ry="4" fill="#f4f1ea" />
          <circle cx={cx + sgn * 13} cy={eyeY} r="3" fill={look.eye} />
          <circle cx={cx + sgn * 13 + 1} cy={eyeY - 1} r="1" fill="#fff" />
          <path d={`M ${cx + sgn * 6} ${eyeY - 9 + (sgn > 0 ? look.brow : -look.brow) * 0.3} L ${cx + sgn * 20} ${eyeY - 10 - look.brow}`} stroke={look.hair} strokeWidth="3.2" strokeLinecap="round" />
        </g>
      ))}
      {look.monocle ? <circle cx={cx + 13} cy={eyeY} r="8" fill="none" stroke={R.trim} strokeWidth="1.6" /> : null}
      {look.scar ? <path d={`M ${cx - 20} ${eyeY - 8} L ${cx - 12} ${eyeY + 12}`} stroke="rgba(150,60,60,0.55)" strokeWidth="1.6" /> : null}

      {/* nose, mustache, mouth */}
      <path d={`M ${cx - 1} ${eyeY + 4} Q ${cx - 6} ${cy + 14} ${cx} ${cy + 16} Q ${cx + 5} ${cy + 16} ${cx + 4} ${cy + 13}`} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.6" strokeLinecap="round" />
      {look.beard === 'mustache' || look.beard === 'full' || look.beard === 'chops' ? (
        <path d={`M ${cx - 14} ${cy + 24} Q ${cx - 7} ${cy + 17} ${cx} ${cy + 20} Q ${cx + 7} ${cy + 17} ${cx + 14} ${cy + 24} Q ${cx + 6} ${cy + 22} ${cx} ${cy + 24} Q ${cx - 6} ${cy + 22} ${cx - 14} ${cy + 24} Z`} fill={look.hair} />
      ) : null}
      <path d={`M ${cx - 9} ${cy + 28} Q ${cx} ${cy + 28 + look.smile} ${cx + 9} ${cy + 28}`} fill="none" stroke="#6a2a22" strokeWidth="2.2" strokeLinecap="round" />

      {/* hair at the sides, then the cap */}
      <path d={`M ${cx - fw - 2} ${cy - 4} Q ${cx - fw - 4} ${cy - 30} ${cx - fw + 10} ${cy - 30} L ${cx - fw + 6} ${cy - 6} Z`} fill={look.hair} />
      <path d={`M ${cx + fw + 2} ${cy - 4} Q ${cx + fw + 4} ${cy - 30} ${cx + fw - 10} ${cy - 30} L ${cx + fw - 6} ${cy - 6} Z`} fill={look.hair} />
      <g transform={`rotate(${look.capTilt} ${cx} ${cy - fh})`}>
        <path d={`M ${cx - fw - 8} ${cy - fh + 22} L ${cx - fw - 4} ${cy - fh - 10} Q ${cx} ${cy - fh - 26} ${cx + fw + 4} ${cy - fh - 10} L ${cx + fw + 8} ${cy - fh + 22} Z`} fill={`url(#${id}-cap)`} />
        <rect x={cx - fw - 8} y={cy - fh + 12} width={2 * fw + 16} height="10" fill="#0a0d12" />
        <rect x={cx - fw - 8} y={cy - fh + 14} width={2 * fw + 16} height="3" fill={R.trim} opacity="0.85" />
        <path d={`M ${cx - fw - 6} ${cy - fh + 22} Q ${cx} ${cy - fh + 36} ${cx + fw + 6} ${cy - fh + 22} Q ${cx} ${cy - fh + 28} ${cx - fw - 6} ${cy - fh + 22} Z`} fill="#06080c" />
        <path d={`M ${cx} ${cy - fh - 8} l 7 5 l -3 8 h -8 l -3 -8 Z`} fill={R.badge} stroke={R.trim} strokeWidth="1" filter={`url(#${id}-glow)`} />
        {look.goggles ? (
          <g>
            <rect x={cx - fw - 4} y={cy - fh + 2} width={2 * fw + 8} height="5" fill="#2a2018" />
            {[-1, 1].map((sgn) => (
              <g key={sgn}>
                <circle cx={cx + sgn * 14} cy={cy - fh + 4} r="8" fill="#2a2018" />
                <circle cx={cx + sgn * 14} cy={cy - fh + 4} r="5.5" fill={R.glow} opacity="0.85" filter={`url(#${id}-glow)`} />
              </g>
            ))}
          </g>
        ) : null}
      </g>
    </svg>
  );
}
