import React from 'react';

// The home-page hero: the Iron Phantom MK-4, a gunmetal Nexus steam engine with cyan power
// lines, a live firebox and a steam plume. Pure SVG + CSS animation (see nexus.css .phantom-hero).

function Wheel({ x, y, r, crank = 0 }) {
  const spokes = r > 24 ? 12 : 8;
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r + 2} fill="#070b11" />
      <circle r={r} fill="#141c28" stroke="#19c3e6" strokeWidth="2" filter="url(#ph-glow-soft)" />
      <circle r={r - 5} fill="none" stroke="#2c3a4f" strokeWidth="3" />
      <g className="ph-spin">
        {Array.from({ length: spokes }, (_, i) => {
          const a = (i / spokes) * Math.PI * 2;
          return <line key={i} x1="0" y1="0" x2={Math.cos(a) * (r - 6)} y2={Math.sin(a) * (r - 6)} stroke="#3b4c64" strokeWidth={r > 24 ? 2.4 : 1.8} />;
        })}
        {crank ? <circle cx={crank} cy="0" r="4.5" fill="#7fe9ff" /> : null}
        {r > 24 ? <path d={`M ${-r + 8} 0 A ${r - 8} ${r - 8} 0 0 1 ${-(r - 8) * 0.5} ${(r - 8) * 0.87} L 0 0 Z`} fill="#0c1118" opacity="0.9" /> : null}
      </g>
      <circle r={r * 0.22} fill="#0c1118" stroke="#7fe9ff" strokeWidth="1.5" />
    </g>
  );
}

export function PhantomHero() {
  const drivers = [310, 386, 462];
  return (
    <figure className="phantom-hero" aria-label="Phantom Neon, a Nexus steam engine">
      <svg viewBox="0 0 640 380" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="ph-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#05080d" />
            <stop offset="0.75" stopColor="#0a1522" />
            <stop offset="1" stopColor="#081019" />
          </linearGradient>
          <linearGradient id="ph-boiler" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3c4d66" />
            <stop offset="0.28" stopColor="#253246" />
            <stop offset="0.75" stopColor="#151d2a" />
            <stop offset="1" stopColor="#0b1018" />
          </linearGradient>
          <linearGradient id="ph-plate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2d3a4f" />
            <stop offset="1" stopColor="#111823" />
          </linearGradient>
          <linearGradient id="ph-window" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7fe9ff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#0f6f8a" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="ph-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7fe9ff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#19c3e6" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="ph-fire" cx="0.5" cy="0.5" r="0.6">
            <stop offset="0" stopColor="#ffd27a" />
            <stop offset="0.5" stopColor="#ff9d1c" />
            <stop offset="1" stopColor="#ff5a1f" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ph-horizon" cx="0.5" cy="1" r="0.7">
            <stop offset="0" stopColor="#19c3e6" stopOpacity="0.28" />
            <stop offset="1" stopColor="#19c3e6" stopOpacity="0" />
          </radialGradient>
          <filter id="ph-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="ph-glow-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="ph-steam" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id="ph-blur">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <pattern id="ph-sleepers" width="40" height="12" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="20" height="9" rx="1" fill="#1a2433" />
          </pattern>
        </defs>

        {/* sky, stars, distant ridges */}
        <rect width="640" height="380" fill="url(#ph-sky)" />
        {[
          [40, 40], [120, 70], [210, 30], [300, 58], [380, 22], [470, 64], [560, 36], [610, 90], [90, 120], [520, 110],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 ? 0.9 : 1.4} fill="#9fdcff" opacity={0.35 + (i % 4) * 0.12} />
        ))}
        <path d="M0 262 L60 228 L110 246 L170 204 L240 240 L300 214 L360 236 L430 196 L500 232 L560 210 L640 238 L640 300 L0 300 Z" fill="#0c1623" />
        <path d="M0 280 L80 254 L150 270 L230 248 L320 268 L400 246 L480 266 L560 250 L640 266 L640 300 L0 300 Z" fill="#0f1b2a" />
        <rect y="200" width="640" height="130" fill="url(#ph-horizon)" />

        {/* ground grid */}
        <g stroke="#19c3e6" strokeOpacity="0.12" strokeWidth="1">
          {Array.from({ length: 17 }, (_, i) => (
            <line key={i} x1={320} y1={330} x2={-320 + i * 80} y2={380} />
          ))}
          <line x1="0" y1="345" x2="640" y2="345" />
          <line x1="0" y1="362" x2="640" y2="362" />
        </g>

        {/* rails */}
        <g className="ph-track">
          <rect x="-40" y="326" width="720" height="10" fill="url(#ph-sleepers)" />
        </g>
        <rect x="0" y="321" width="640" height="5" fill="#2c3a4f" />
        <rect x="0" y="320" width="640" height="1.6" fill="#19c3e6" filter="url(#ph-glow-soft)" />

        {/* under-glow */}
        <ellipse cx="330" cy="322" rx="270" ry="10" fill="#19c3e6" opacity="0.22" filter="url(#ph-blur)" />

        {/* headlight beam */}
        <polygon points="566,170 566,184 640,150 640,214" fill="url(#ph-beam)" className="ph-beam" />

        {/* steam plume */}
        <g transform="translate(486 128)" filter="url(#ph-steam)">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={i} className="ph-puff" style={{ animationDelay: `${-i * 0.55}s` }} r="11" fill="#bcd6e4" />
          ))}
        </g>

        {/* tender */}
        <path d="M64 200 L78 184 L152 184 L164 200 Z" fill="#0c1118" />
        <g fill="#ff9d1c" opacity="0.7">
          <circle cx="96" cy="193" r="2" className="ph-ember" />
          <circle cx="122" cy="190" r="1.6" className="ph-ember" style={{ animationDelay: '-0.6s' }} />
          <circle cx="140" cy="195" r="1.8" className="ph-ember" style={{ animationDelay: '-1.1s' }} />
        </g>
        <path d="M58 200 L166 200 L174 214 L174 296 L58 296 L50 282 L50 214 Z" fill="url(#ph-plate)" stroke="#3b4c64" strokeWidth="1.5" />
        <path d="M58 214 L166 214" stroke="#0c1118" strokeWidth="2" />
        <rect x="58" y="244" width="110" height="3" fill="#19c3e6" filter="url(#ph-glow-soft)" />
        <path d="M66 258 L104 258 L110 270 L66 270 Z" fill="#0f151f" stroke="#2c3a4f" />
        {[66, 90, 114, 138, 160].map((x) => (
          <circle key={x} cx={x} cy="226" r="1.8" fill="#4a5d78" />
        ))}
        <rect x="174" y="280" width="10" height="6" fill="#2c3a4f" />

        {/* cab */}
        <path d="M182 296 L182 170 L174 162 L282 150 L292 158 L282 168 L282 296 Z" fill="url(#ph-plate)" stroke="#3b4c64" strokeWidth="1.5" />
        <path d="M174 162 L282 150 L292 158 L180 168 Z" fill="#3c4d66" />
        <rect x="196" y="180" width="58" height="44" rx="5" fill="#0c1118" stroke="#3b4c64" strokeWidth="2" />
        <rect x="200" y="184" width="50" height="36" rx="3" fill="url(#ph-window)" className="ph-window" filter="url(#ph-glow-soft)" />
        <line x1="225" y1="184" x2="225" y2="220" stroke="#0c1118" strokeWidth="2" />
        <rect x="182" y="244" width="100" height="3" fill="#19c3e6" filter="url(#ph-glow-soft)" />
        <text x="232" y="238" textAnchor="middle" fontFamily="Orbitron, sans-serif" fontSize="11" fontWeight="800" fill="#7fe9ff" letterSpacing="2">
          MK-4
        </text>

        {/* firebox glow under the cab */}
        <rect x="250" y="270" width="48" height="16" rx="3" fill="#120a06" />
        <rect x="252" y="272" width="44" height="12" rx="2" fill="url(#ph-fire)" className="ph-fire" />
        {[258, 266, 274, 282, 290].map((x) => (
          <line key={x} x1={x} y1="272" x2={x} y2="284" stroke="#120a06" strokeWidth="2" />
        ))}

        {/* boiler */}
        <rect x="276" y="186" width="240" height="82" rx="10" fill="url(#ph-boiler)" stroke="#3b4c64" strokeWidth="1.5" />
        {[318, 378, 438, 494].map((x) => (
          <rect key={x} x={x} y="186" width="7" height="82" fill="#33445c" />
        ))}
        <path d="M284 230 L508 230" stroke="#19c3e6" strokeWidth="2.5" filter="url(#ph-glow)" className="ph-conduit" />
        {[300, 350, 410, 470].map((x) => (
          <circle key={x} cx={x} cy="230" r="3.2" fill="#7fe9ff" filter="url(#ph-glow-soft)" />
        ))}
        <path d="M288 196 L506 196" stroke="#5c7392" strokeWidth="1.2" opacity="0.7" />

        {/* domes, stack, whistle */}
        <path d="M326 188 L330 172 L350 168 L356 188 Z" fill="url(#ph-plate)" stroke="#3b4c64" />
        <path d="M384 188 Q384 162 404 160 Q424 162 424 188 Z" fill="url(#ph-plate)" stroke="#3b4c64" />
        <rect x="398" y="166" width="12" height="3" fill="#19c3e6" filter="url(#ph-glow-soft)" />
        <rect x="446" y="168" width="4" height="20" fill="#4a5d78" />
        <path d="M442 168 L454 168 L452 162 L444 162 Z" fill="#7fe9ff" />
        <path d="M472 188 L476 150 L466 136 L506 136 L496 150 L500 188 Z" fill="url(#ph-plate)" stroke="#3b4c64" strokeWidth="1.5" />
        <ellipse cx="486" cy="137" rx="18" ry="3.5" fill="#ff9d1c" filter="url(#ph-glow)" className="ph-fire" />
        <rect x="476" y="160" width="20" height="3" fill="#19c3e6" filter="url(#ph-glow-soft)" />

        {/* smokebox and headlight */}
        <path d="M510 182 L548 182 Q562 182 562 196 L562 262 Q562 272 552 272 L510 272 Z" fill="#0f151f" stroke="#3b4c64" strokeWidth="1.5" />
        <rect x="510" y="208" width="52" height="3" fill="#19c3e6" filter="url(#ph-glow-soft)" />
        <rect x="538" y="166" width="28" height="20" rx="4" fill="#1c2533" stroke="#3b4c64" />
        <circle cx="560" cy="176" r="7" fill="#d9fbff" filter="url(#ph-glow)" className="ph-lamp" />

        {/* running board */}
        <path d="M188 262 L520 262 L542 282 L188 282 Z" fill="#0f151f" />
        <line x1="188" y1="262" x2="520" y2="262" stroke="#19c3e6" strokeWidth="2" filter="url(#ph-glow-soft)" />

        {/* cylinder */}
        <rect x="500" y="272" width="48" height="24" rx="4" fill="url(#ph-plate)" stroke="#3b4c64" />
        <rect x="506" y="282" width="36" height="3" fill="#19c3e6" filter="url(#ph-glow-soft)" />

        {/* plow */}
        <path d="M546 282 L564 274 L608 320 L548 320 Z" fill="#141c28" stroke="#3b4c64" />
        <line x1="564" y1="274" x2="608" y2="320" stroke="#19c3e6" strokeWidth="2.5" filter="url(#ph-glow)" />
        {[560, 572, 584].map((x, i) => (
          <line key={x} x1={x} y1={286 + i * 2} x2={x + 10} y2={318} stroke="#2c3a4f" strokeWidth="2" />
        ))}

        {/* wheels */}
        <Wheel x={88} y={304} r={17} />
        <Wheel x={142} y={304} r={17} />
        <Wheel x={232} y={304} r={17} />
        {drivers.map((x) => (
          <Wheel key={x} x={x} y={288} r={33} crank={12} />
        ))}
        <Wheel x={526} y={305} r={15} />

        {/* rods follow the crank pins */}
        <g className="ph-rod-x">
          <g className="ph-rod-y">
            <rect x={drivers[0] - 3} y="285" width={drivers[2] - drivers[0] + 6} height="6" rx="3" fill="#7d93b2" />
            <line x1={drivers[1]} y1="288" x2="508" y2="284" stroke="#5c7392" strokeWidth="5" strokeLinecap="round" />
          </g>
        </g>
      </svg>
      <figcaption>
        <span className="ph-name">Phantom Neon</span>
        <span className="ph-tag">Nexus steam</span>
      </figcaption>
    </figure>
  );
}
