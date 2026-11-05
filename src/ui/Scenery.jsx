import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { LocoArt } from './LocoArt.jsx';

// The view from trackside: hills, telegraph poles and sleepers slide past a locomotive.
// Call ref.current.moveTo(miles) to slide the backdrop.
const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const HILLS = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="90" preserveAspectRatio="none"><path d="M0 90 L0 60 Q80 10 170 52 Q230 76 300 40 Q380 0 470 46 Q560 84 640 60 L640 90 Z" fill="#2c3a36"/></svg>');
const POLES = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="260" height="80"><rect x="128" y="8" width="4" height="72" fill="#2a221b"/><rect x="112" y="14" width="36" height="3" fill="#2a221b"/><path d="M0 18 Q65 30 130 16 Q195 30 260 18" stroke="#2a221b" stroke-width="1" fill="none"/></svg>');
const TIES = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="60"><rect x="0" y="6" width="48" height="5" fill="#1b1714"/><rect x="18" y="11" width="12" height="16" fill="#2c231b"/></svg>');
const PX_PER_MILE = 1080;

export const Scenery = forwardRef(function Scenery({ model = 'stable', spin = '0s', children, className = '' }, ref) {
  const hills = useRef(null);
  const poles = useRef(null);
  const ties = useRef(null);
  useImperativeHandle(ref, () => ({
    moveTo(miles) {
      const px = miles * PX_PER_MILE;
      if (hills.current) hills.current.style.backgroundPositionX = `${-px * 0.12}px`;
      if (poles.current) poles.current.style.backgroundPositionX = `${-px * 0.6}px`;
      if (ties.current) ties.current.style.backgroundPositionX = `${-px}px`;
    },
  }));
  return (
    <div className={`scenery ${className}`} style={{ '--spin': spin }}>
      <div className="layer hills" ref={hills} style={{ backgroundImage: HILLS }} />
      <div className="layer poles" ref={poles} style={{ backgroundImage: POLES }} />
      <div className="layer ties" ref={ties} style={{ backgroundImage: TIES }} />
      <div className="train">
        <LocoArt model={model} spin={spin !== '0s'} className="loco-art" title="Locomotive" />
      </div>
      {children}
    </div>
  );
});
