import React from 'react';
import { PhoenixViewer } from './PhoenixViewer.jsx';

// Side-on locomotive drawings, one silhouette with a few parts that change per model.
// Swap this component's output for real illustrations later; everything else stays the same.

const LOOKS = {
  tank: { body: '#2f4b3c', dark: '#1e3127', boilerTop: 30, domes: [176, 214], stack: 30, tender: false, nose: false },
  bullet: { body: '#8e302b', dark: '#5f1f1c', boilerTop: 42, domes: [190], stack: 14, tender: false, nose: true },
  stable: { body: '#34495e', dark: '#22313f', boilerTop: 38, domes: [180, 216], stack: 26, tender: false, nose: false },
  longrun: { body: '#5d4833', dark: '#3d2f21', boilerTop: 40, domes: [196], stack: 24, tender: true, nose: false },
  scrappy: { body: '#7c5338', dark: '#523624', boilerTop: 38, domes: [184], stack: 28, tender: false, nose: false, patches: true },
  // The Phoenix seen from the side in the race view.
  ember: { body: '#2b2422', dark: '#151211', boilerTop: 40, domes: [188], stack: 18, tender: false, nose: true, trim: '#e5602c' },
  benchmark: { body: '#5b5e60', dark: '#3b3e40', boilerTop: 38, domes: [180, 216], stack: 26, tender: false, nose: false },
  // The mythic engines of the late game.
  dragon: { body: '#6e1414', dark: '#3a0a0a', boilerTop: 38, domes: [], stack: 10, tender: false, nose: true, trim: '#e0a030', mythic: 'dragon' },
  wizard: { body: '#2b1f5c', dark: '#1c1440', boilerTop: 40, domes: [196], stack: 0, tender: false, nose: false, trim: '#9ad7ff', mythic: 'wizard' },
  titan: { body: '#5d5a52', dark: '#3a3833', boilerTop: 26, domes: [184, 222], stack: 22, tender: true, nose: false, trim: '#c08a3e', mythic: 'titan' },
  // The newer legendary machines.
  marauder: { body: '#3b2a24', dark: '#1e1512', boilerTop: 36, domes: [184], stack: 28, tender: true, nose: false, trim: '#c8502a', mythic: 'marauder' },
  glacier: { body: '#9fc8e0', dark: '#4f7f9f', boilerTop: 40, domes: [], stack: 14, tender: false, nose: true, trim: '#e6fbff', mythic: 'glacier' },
  sandshark: { body: '#b08a52', dark: '#6e5230', boilerTop: 38, domes: [], stack: 10, tender: false, nose: true, trim: '#f2e6c8', mythic: 'sandshark' },
  graviton: { body: '#17122a', dark: '#0b0814', boilerTop: 40, domes: [], stack: 0, tender: true, nose: true, trim: '#9b6bff', mythic: 'graviton' },
};

const DEFAULT_TRIM = '#c99a3f';
const STEEL = '#191614';

function Wheel({ cx, cy, r, spin, trim = DEFAULT_TRIM }) {
  const spokes = [0, 45, 90, 135];
  return (
    <g className={spin ? 'wheel-spin' : undefined}>
      <circle cx={cx} cy={cy} r={r} fill={STEEL} stroke="#6b6157" strokeWidth="3" />
      {spokes.map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const dx = Math.cos(rad) * (r - 3);
        const dy = Math.sin(rad) * (r - 3);
        return <line key={angle} x1={cx - dx} y1={cy - dy} x2={cx + dx} y2={cy + dy} stroke="#6b6157" strokeWidth="1.6" />;
      })}
      <circle cx={cx} cy={cy} r={r * 0.24} fill={trim} />
    </g>
  );
}

export function LocoArt({ model = 'stable', spin = false, className = 'loco-art', title }) {
  if (model === 'phoenix') {
    return <PhoenixViewer />;
  }
  const look = LOOKS[model] ?? LOOKS.stable;
  const top = look.boilerTop;
  const BRASS = look.trim ?? DEFAULT_TRIM;
  return (
    <svg className={className} viewBox={look.mythic ? '0 -26 330 150' : '0 0 330 124'} role="img" aria-label={title ?? `${model} locomotive`}>
      {look.tender ? (
        <g>
          <rect x="4" y="46" width="54" height="36" rx="3" fill={look.dark} stroke={STEEL} strokeWidth="2" />
          <rect x="8" y="50" width="46" height="6" fill={BRASS} opacity="0.7" />
          <Wheel cx={18} cy={104} r={11} spin={spin} trim={BRASS} />
          <Wheel cx={44} cy={104} r={11} spin={spin} trim={BRASS} />
          <rect x="56" y="76" width="10" height="4" fill={STEEL} />
        </g>
      ) : null}

      {/* cab */}
      <rect x="64" y="20" width="56" height="62" rx="3" fill={look.body} stroke={STEEL} strokeWidth="2" />
      <rect x="60" y="14" width="64" height="8" rx="2" fill={look.dark} stroke={STEEL} strokeWidth="2" />
      <rect x="74" y="30" width="26" height="22" rx="2" fill="#e9dec5" opacity="0.85" stroke={STEEL} strokeWidth="2" />

      {/* boiler */}
      <rect x="116" y={top} width="150" height={80 - top} rx="10" fill={look.body} stroke={STEEL} strokeWidth="2" />
      {[150, 190, 230].map((x) => (
        <rect key={x} x={x} y={top} width="4" height={80 - top} fill={BRASS} opacity="0.75" />
      ))}
      {look.patches ? (
        <g opacity="0.9">
          <rect x="158" y={top + 8} width="22" height="16" fill="#8f6a4a" stroke={STEEL} strokeWidth="1" />
          <rect x="204" y={top + 18} width="18" height="14" fill="#5f6b63" stroke={STEEL} strokeWidth="1" />
          <rect x="84" y="58" width="20" height="14" fill="#8f6a4a" stroke={STEEL} strokeWidth="1" />
        </g>
      ) : null}

      {/* smokebox or streamlined nose */}
      {look.nose ? (
        <path d={`M262 ${top} L296 ${top + 14} Q312 ${top + 24} 300 80 L262 80 Z`} fill={look.dark} stroke={STEEL} strokeWidth="2" />
      ) : (
        <rect x="258" y={top - 2} width="26" height={84 - top} rx="5" fill={look.dark} stroke={STEEL} strokeWidth="2" />
      )}
      <circle cx={look.nose ? 292 : 276} cy={top + 14} r="5" fill="#f3ecdb" stroke={BRASS} strokeWidth="2" />

      {/* stack and domes */}
      {look.stack > 0 ? (
        <path d={`M252 ${top} L250 ${top - look.stack + 6} L244 ${top - look.stack} L274 ${top - look.stack} L268 ${top - look.stack + 6} L266 ${top} Z`} fill={STEEL} stroke="#3a332d" strokeWidth="1.5" />
      ) : null}
      {look.domes.map((x) => (
        <path key={x} d={`M${x - 11} ${top} Q${x} ${top - 22} ${x + 11} ${top} Z`} fill={BRASS} stroke={STEEL} strokeWidth="1.5" />
      ))}

      {look.mythic === 'dragon' ? (
        <g>
          <path d={`M270 ${top + 2} L262 ${top - 22} L280 ${top + 4} Z M288 ${top + 6} L286 ${top - 18} L298 ${top + 10} Z`} fill={BRASS} stroke={STEEL} strokeWidth="1.5" />
          <path d={`M150 ${top + 6} Q190 ${top - 40} 236 ${top + 4} Q210 ${top - 6} 196 ${top + 10} Q178 ${top - 4} 150 ${top + 6} Z`} fill="#b3261a" stroke={STEEL} strokeWidth="1.5" opacity="0.95" />
          {[160, 182, 204, 226, 248].map((x) => (
            <path key={x} d={`M${x} ${top} L${x + 5} ${top - 9} L${x + 10} ${top} Z`} fill={BRASS} />
          ))}
          <circle cx="293" cy={top + 14} r="4" fill="#ffb020" />
          <path d={`M308 ${top + 30} Q322 ${top + 24} 328 ${top + 34} Q318 ${top + 36} 326 ${top + 44} Q312 ${top + 40} 306 ${top + 38} Z`} fill="#ff7a1a" opacity="0.9" />
        </g>
      ) : null}
      {look.mythic === 'wizard' ? (
        <g>
          <path d={`M246 ${top} L259 ${top - 46} L272 ${top} Z`} fill="#3a2a80" stroke={STEEL} strokeWidth="1.5" />
          <rect x="240" y={top - 3} width="38" height="5" rx="2" fill="#3a2a80" stroke={STEEL} strokeWidth="1" />
          <path d={`M259 ${top - 52} l3 6 l6 1 l-5 4 l1 6 l-5 -3 l-5 3 l1 -6 l-5 -4 l6 -1 Z`} fill="#fff2a0" />
          {[150, 190, 230].map((x) => (
            <rect key={x} x={x - 1} y={top} width="6" height={80 - top} fill="#9ad7ff" opacity="0.8" />
          ))}
          <circle cx="92" cy="2" r="9" fill="#b69cff" opacity="0.95" />
          <circle cx="92" cy="2" r="14" fill="#b69cff" opacity="0.25" />
        </g>
      ) : null}
      {look.mythic === 'titan' ? (
        <g>
          <rect x="124" y={top + 10} width="130" height="22" rx="3" fill="#47443e" stroke={STEEL} strokeWidth="1.5" />
          {[140, 170, 200, 230].map((x) => (
            <circle key={x} cx={x} cy={top + 21} r="3" fill={BRASS} />
          ))}
          <rect x="58" y="8" width="68" height="12" rx="3" fill={BRASS} stroke={STEEL} strokeWidth="1.5" />
          <rect x="270" y={top + 14} width="12" height="10" fill="#ffc060" />
        </g>
      ) : null}

      {look.mythic === 'marauder' ? (
        <g>
          {[128, 150, 172, 194, 216, 238].map((x) => (
            <path key={x} d={`M${x} ${top} L${x + 6} ${top - 13} L${x + 12} ${top} Z`} fill={BRASS} stroke={STEEL} strokeWidth="1" />
          ))}
          <line x1="70" y1="14" x2="70" y2="-20" stroke={STEEL} strokeWidth="2.5" />
          <path d="M70 -20 L104 -14 L96 -6 L104 2 L70 -2 Z" fill="#0e0e10" stroke={STEEL} strokeWidth="1" />
          <circle cx="84" cy="-9" r="4.5" fill="#f2efe2" />
          <path d="M80 -3 L88 -3 M82 -5 L82 -1 M86 -5 L86 -1" stroke="#0e0e10" strokeWidth="1" />
          <path d="M284 60 L308 66 L286 70 L310 76 L286 80 Z" fill={BRASS} stroke={STEEL} strokeWidth="1" />
          <rect x="124" y={top + 12} width="130" height="14" rx="2" fill="#54382a" stroke={STEEL} strokeWidth="1" />
          {[136, 160, 184, 208, 232].map((x) => (
            <circle key={x} cx={x} cy={top + 19} r="2.4" fill={BRASS} />
          ))}
        </g>
      ) : null}
      {look.mythic === 'glacier' ? (
        <g>
          {[[150, 26], [174, 38], [198, 22], [222, 34], [244, 20]].map(([x, h]) => (
            <path key={x} d={`M${x - 8} ${top} L${x} ${top - h} L${x + 8} ${top} Z`} fill="#dff6ff" stroke="#6fc4ee" strokeWidth="1.2" opacity="0.92" />
          ))}
          <path d={`M296 ${top + 16} L324 ${top + 30} L300 ${top + 38} Z`} fill="#dff6ff" stroke="#6fc4ee" strokeWidth="1.2" />
          {[150, 190, 230].map((x) => (
            <rect key={x} x={x - 1} y={top} width="6" height={80 - top} fill="#e6fbff" opacity="0.85" />
          ))}
          <circle cx="92" cy="4" r="8" fill="#9fe6ff" opacity="0.9" />
          <circle cx="92" cy="4" r="14" fill="#9fe6ff" opacity="0.22" />
        </g>
      ) : null}
      {look.mythic === 'sandshark' ? (
        <g>
          <path d={`M150 ${top} L214 ${top - 44} L226 ${top} Z`} fill="#6e5230" stroke={STEEL} strokeWidth="1.5" />
          <path d={`M262 ${top + 20} L318 ${top + 18} L304 ${top + 30} L262 ${top + 32} Z`} fill="#8a6a3c" stroke={STEEL} strokeWidth="1.5" />
          <path d={`M262 ${top + 36} L312 ${top + 40} L262 ${top + 46} Z`} fill={STEEL} />
          {[270, 280, 290, 300].map((x) => (
            <path key={x} d={`M${x} ${top + 31} L${x + 4} ${top + 38} L${x + 8} ${top + 31} Z`} fill={BRASS} />
          ))}
          <circle cx="282" cy={top + 12} r="4" fill="#ffc040" stroke={STEEL} strokeWidth="1" />
          <rect x="124" y={top + 8} width="130" height="18" rx="3" fill="#8a6a3c" stroke={STEEL} strokeWidth="1" />
        </g>
      ) : null}
      {look.mythic === 'graviton' ? (
        <g>
          {[150, 190, 230].map((x) => (
            <rect key={x} x={x - 1} y={top} width="6" height={80 - top} fill="#9b6bff" opacity="0.9" />
          ))}
          <ellipse cx="200" cy={top - 26} rx="34" ry="9" fill="none" stroke="#c7a8ff" strokeWidth="2.5" opacity="0.9" />
          <ellipse cx="200" cy={top - 26} rx="24" ry="17" fill="none" stroke="#6b46d6" strokeWidth="1.6" opacity="0.8" />
          <circle cx="200" cy={top - 26} r="13" fill="#05030a" stroke="#9b6bff" strokeWidth="1.5" />
          <circle cx="200" cy={top - 26} r="22" fill="#9b6bff" opacity="0.14" />
          <rect x="116" y={top + 30} width="150" height="3" fill="#7a4ce0" opacity="0.9" />
        </g>
      ) : null}

      {/* running board, cowcatcher */}
      <rect x="60" y="80" width="236" height="6" fill={STEEL} />
      <path d="M288 86 L318 110 L288 110 Z" fill={look.dark} stroke={STEEL} strokeWidth="2" />
      <path d="M294 92 L294 110 M301 98 L301 110 M308 104 L308 110" stroke={BRASS} strokeWidth="1.5" />

      {/* wheels and rod */}
      <Wheel cx={92} cy={102} r={13} spin={spin} trim={BRASS} />
      <Wheel cx={150} cy={96} r={19} spin={spin} trim={BRASS} />
      <Wheel cx={194} cy={96} r={19} spin={spin} trim={BRASS} />
      <Wheel cx={238} cy={96} r={19} spin={spin} trim={BRASS} />
      <Wheel cx={276} cy={104} r={11} spin={spin} trim={BRASS} />
      <rect x="146" y="93" width="96" height="5" rx="2.5" fill={BRASS} stroke={STEEL} strokeWidth="1" />
    </svg>
  );
}
