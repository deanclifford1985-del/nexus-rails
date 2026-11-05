import React, { useEffect, useRef, useState } from 'react';
import { Play, SkipForward, Volume2, VolumeX } from 'lucide-react';

// The launch trailer: plays full screen the first time the game opens in a browser,
// and again whenever the player taps "Watch trailer" on the title screen.
// Browsers only autoplay muted video, so it starts muted with a sound button.

const SEEN_KEY = 'nexus-rails/trailer-seen';

export function trailerSeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // private window: it will just play again next time
  }
}

export function Trailer({ src, onDone }) {
  const video = useRef(null);
  const [muted, setMuted] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [progress, setProgress] = useState(0);

  const finish = () => {
    markSeen();
    onDone();
  };

  useEffect(() => {
    const v = video.current;
    if (!v) return undefined;
    v.muted = true;
    v.play().catch(() => setBlocked(true));
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSound = () => {
    const v = video.current;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.paused) v.play().catch(() => {});
  };

  const start = () => {
    const v = video.current;
    v.muted = false;
    setMuted(false);
    v.play().then(() => setBlocked(false)).catch(() => {});
  };

  return (
    <div className="trailer" role="dialog" aria-label="Nexus Rails trailer">
      <video
        ref={video}
        className="trailer-video"
        playsInline
        muted
        preload="auto"
        onEnded={finish}
        onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
      >
        {src.map((file) => (
          <source key={file.src} src={file.src} type={file.type} onError={file.last ? onDone : undefined} />
        ))}
      </video>
      <div className="trailer-vignette" />
      <div className="trailer-brand">
        NEXUS<span>RAIL</span>
      </div>
      {blocked ? (
        <button type="button" className="trailer-play" onClick={start}>
          <Play aria-hidden="true" />
          Play trailer
        </button>
      ) : null}
      <div className="trailer-bar">
        <button type="button" className="btn btn-sm" onClick={toggleSound} aria-label={muted ? 'Turn sound on' : 'Mute'}>
          {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          {muted ? 'Sound on' : 'Mute'}
        </button>
        <div className="trailer-progress" aria-hidden="true">
          <i style={{ width: `${progress * 100}%` }} />
        </div>
        <button type="button" className="btn btn-brass btn-sm" onClick={finish}>
          Skip
          <SkipForward aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
