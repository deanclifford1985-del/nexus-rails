import React, { useEffect, useRef, useState } from 'react';

// A number that counts up to its value: from zero when it first appears, then from the old value
// whenever it changes. A rise flashes briefly. Respects reduced motion.
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function CountUp({ value, format = (v) => v.toLocaleString(), duration = 1200, from = 0, className = '' }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(reduced() ? target : from);
  const [bump, setBump] = useState(false);
  const last = useRef(reduced() ? target : from);
  const frame = useRef(0);
  useEffect(() => {
    const start = last.current;
    if (start === target) return undefined;
    if (target > start && start !== from) {
      setBump(true);
      window.setTimeout(() => setBump(false), 1400);
    }
    if (reduced()) {
      last.current = target;
      setShown(target);
      return undefined;
    }
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = start + (target - start) * eased;
      last.current = v;
      setShown(v);
      if (k < 1) frame.current = requestAnimationFrame(tick);
      else last.current = target;
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration, from]);
  return (
    <span className={`countup ${bump ? 'bump' : ''} ${className}`} aria-label={format(target)}>
      <span aria-hidden="true">{format(shown)}</span>
    </span>
  );
}
