import React from 'react';
import { B } from '../game/balance.js';
import { themeFor } from '../game/course.js';

// The terrain a job runs through: plains, flooded, desert or a frozen pass.
const TERRAIN_TONE = { plains: '', flooded: 'water', desert: 'sand', snow: 'ice' };
export function Terrain({ id, theme }) {
  const t = theme ?? themeFor(id);
  const info = B.TRACK.themes[t];
  return (
    <span className={`terrain-chip ${TERRAIN_TONE[t]}`} title={info.text}>
      {info.name}
    </span>
  );
}
