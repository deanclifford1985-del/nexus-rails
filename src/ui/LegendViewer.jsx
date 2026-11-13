import React, { useEffect, useRef, useState } from 'react';
import { createPhantomViewer } from '../three/PhantomNeonModel.js';
import { LocoArt } from './LocoArt.jsx';

// A legendary machine on the showroom turntable, in its own colours and with its own nameplate.
// Falls back to the flat drawing without WebGL.
export const LEGEND_THEMES = {
  wizard: { body: 0x2b1f5c, accent: 0x9ad7ff, hot: 0xe6f6ff, floor: 0x3a2a80, plate: 'Storm Magus' },
  titan: { body: 0x5d5a52, accent: 0xffb347, hot: 0xffe2a0, floor: 0x6a4a1e, plate: 'Iron Titan' },
  dragon: { body: 0x6e1414, accent: 0xff7a1a, hot: 0xffd08a, floor: 0x8a2a0a, plate: 'Ember Wyrm' },
  marauder: { body: 0x3b2a24, accent: 0xff6a2a, hot: 0xffc08a, floor: 0x6a2a10, plate: 'The Marauder' },
  glacier: { body: 0x8fb8d0, accent: 0x7fe9ff, hot: 0xf0fdff, floor: 0x1f6f9a, plate: 'The Glacier' },
  sandshark: { body: 0xa07a44, accent: 0xffc040, hot: 0xfff0c0, floor: 0x7a5a1e, plate: 'The Sandshark' },
  graviton: { body: 0x14101f, accent: 0x9b6bff, hot: 0xe0d0ff, floor: 0x3a1f8a, plate: 'The Graviton' },
};

export function LegendViewer({ model, name, tag = 'Legend · drag to turn', preserve = false }) {
  const host = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!host.current) return undefined;
    let viewer = null;
    try {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      viewer = createPhantomViewer(host.current, { reducedMotion: reduced, theme: LEGEND_THEMES[model], preserve });
    } catch (error) {
      console.warn('Legend 3D view unavailable', error);
      setFailed(true);
    }
    return () => viewer?.dispose();
  }, [model, preserve]);

  if (failed) return <LocoArt model={model} />;
  return (
    <figure className="phantom-hero phantom-3d legend-3d" aria-label={`${name}, turning on a showroom turntable`}>
      <div className="phantom-3d-stage" ref={host} />
      <figcaption>
        <span className="ph-name">{name}</span>
        <span className="ph-tag">{tag}</span>
      </figcaption>
    </figure>
  );
}
