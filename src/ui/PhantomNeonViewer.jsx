import React, { useEffect, useRef, useState } from 'react';
import { createPhantomViewer } from '../three/PhantomNeonModel.js';
import { PhantomHero } from './PhantomHero.jsx';

// Phantom Neon on the showroom turntable. Falls back to the flat drawing without WebGL.
export function PhantomNeonViewer() {
  const host = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!host.current) return undefined;
    let viewer = null;
    try {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      viewer = createPhantomViewer(host.current, { reducedMotion: reduced });
    } catch (error) {
      console.warn('Phantom Neon 3D view unavailable', error);
      setFailed(true);
    }
    return () => viewer?.dispose();
  }, []);

  if (failed) return <PhantomHero />;
  return (
    <figure className="phantom-hero phantom-3d" aria-label="Phantom Neon, a gunmetal steam locomotive with blue plasma flowing through it, turning on a showroom turntable">
      <div className="phantom-3d-stage" ref={host} />
      <figcaption>
        <span className="ph-name">Phantom Neon</span>
        <span className="ph-tag">Nexus steam · drag to turn</span>
      </figcaption>
    </figure>
  );
}
