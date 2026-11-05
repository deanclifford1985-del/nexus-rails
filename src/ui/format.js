import { B } from '../game/balance.js';

export const fmt = (value, digits = 0) =>
  Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const lt = (value) => fmt(Math.round((value || 0) * 10) / 10, 1);
export const ltWhole = (value) => fmt(Math.round(value || 0));
export const gal = (value) => fmt(value, value < 100 ? 1 : 0);
export const lb = (value) => fmt(Math.round(value));
export const pct = (value, digits = 0) => `${fmt(value * 100, digits)}%`;

// h:mm:ss or m:ss
export function clock(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// A length of game time shown as the real time it takes to play.
export const realTime = (gameSeconds) => clock(gameSeconds / B.TIME_SCALE);

export function minutes(realSeconds) {
  if (realSeconds < 90) return `${Math.round(realSeconds)} sec`;
  return `${fmt(realSeconds / 60, realSeconds < 600 ? 1 : 0)} min`;
}

export function countdownTo(timestamp, now) {
  return clock(Math.max(0, (timestamp - now) / 1000));
}

// An estimate range as text: "38-62" or, when Intelligence makes it tight, "about 50".
export function range(est, show = (v) => fmt(v)) {
  if (!est) return '';
  if (est.band <= 0.03) return `about ${show(est.value)}`;
  return `${show(est.lo)}-${show(est.hi)}`;
}
