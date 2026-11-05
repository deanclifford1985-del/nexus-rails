import React, { useEffect, useRef, useState } from 'react';
import phoenixUrl from '../assets/phoenix.jpg';
import { createPhoenixViewer } from '../three/PhoenixModel.js';

// The Iron Phoenix as a live 3D model on a turntable. Falls back to the painted card
// if this browser cannot draw WebGL.
export function PhoenixViewer({ caption = true }) {
  const host = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!host.current) return undefined;
    let viewer = null;
    try {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      viewer = createPhoenixViewer(host.current, { reducedMotion: reduced });
    } catch (error) {
      console.warn('Phoenix 3D view unavailable', error);
      setFailed(true);
    }
    return () => viewer?.dispose();
  }, []);

  if (failed) return <img className="phoenix-art" src={phoenixUrl} alt="The Iron Phoenix, a black locomotive with wings of fire" />;
  return (
    <figure className="phoenix-3d" aria-label="The Iron Phoenix, a black iron locomotive with a phoenix head and wings of fire, turning on a turntable">
      <div className="phoenix-3d-stage" ref={host} />
      {caption ? (
        <figcaption>
          <span className="ph-name">The Iron Phoenix</span>
          <span className="ph-tag">Flagship · drag to turn</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
