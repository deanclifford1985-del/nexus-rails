import React, { useEffect, useRef } from 'react';
import { KIND_NAMES, LOCATIONS, WORLD, sideOf } from '../game/world.js';
import { useHost, useUi } from './context.jsx';

const COLORS = { objective: '#f0c24a', squad: '#6fc3ff', enemy: '#ff5a46', cache: '#8fcf6a', npc: '#f0c24a' };

// The island from above: every place you know of, where you are, and what is marked.
export default function MapPanel() {
  const { save } = useUi();
  const host = useHost();
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const draw = () => {
      const data = host.mapData();
      // as big as the panel allows: its width, or the height left under the header and tabs
      const size = Math.max(220, Math.min(canvas.parentElement.clientWidth, window.innerHeight - 190, 900));
      const scale = window.devicePixelRatio || 1;
      canvas.width = canvas.height = Math.round(size * scale);
      canvas.style.width = canvas.style.height = `${size}px`;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#16303a';
      ctx.fillRect(0, 0, size, size);
      if (data?.image) ctx.drawImage(data.image, 0, 0, size, size);
      const at = (x, z) => [((x + WORLD.half) / WORLD.size) * size, ((z + WORLD.half) / WORLD.size) * size];
      // the front line
      ctx.strokeStyle = 'rgba(255, 90, 70, 0.55)';
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(...at(-WORLD.half, WORLD.front));
      ctx.lineTo(...at(WORLD.half, WORLD.front));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = 'center';
      for (const loc of LOCATIONS) {
        const [x, y] = at(loc.x, loc.z);
        const side = sideOf(save, loc.id);
        const known = save.world.discovered[loc.id] || side === 'ally';
        ctx.fillStyle = side === 'ally' ? '#6fc3ff' : '#ff5a46';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(x - 5, y - 5, 10, 10);
        ctx.fill();
        ctx.stroke();
        ctx.font = '600 13px Rajdhani, sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeText(loc.name, x, y - 10);
        ctx.fillStyle = known ? '#f2f4ec' : 'rgba(242,244,236,0.6)';
        ctx.fillText(loc.name, x, y - 10);
      }
      for (const m of data?.markers ?? []) {
        const [x, y] = at(m.x, m.z);
        ctx.fillStyle = COLORS[m.kind] ?? '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (m.kind === 'objective') {
          ctx.moveTo(x, y - 7);
          ctx.lineTo(x + 6, y);
          ctx.lineTo(x, y + 7);
          ctx.lineTo(x - 6, y);
          ctx.closePath();
        } else ctx.arc(x, y, m.kind === 'cache' ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (data?.player) {
        const [x, y] = at(data.player.x, data.player.z);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(data.player.yaw);
        ctx.fillStyle = '#f2f4ec';
        ctx.strokeStyle = '#10150e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(7, 8);
        ctx.lineTo(0, 4);
        ctx.lineTo(-7, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [host, save]);
  return (
    <div className="map-wrap">
      <div className="map-canvas">
        <canvas ref={ref} aria-label="Map of Corvane" />
      </div>
      <aside className="map-legend">
        <h4>Corvane</h4>
        <p className="ui-muted ui-small ui-p">North is up. The dashed line is the front: everything north of it began in the Legion’s hands.</p>
        <ul>
          <li>
            <i style={{ background: '#f2f4ec' }} /> You
          </li>
          <li>
            <i style={{ background: '#6fc3ff' }} /> Held by us · your squad
          </li>
          <li>
            <i style={{ background: '#ff5a46' }} /> Legion · tagged enemies
          </li>
          <li>
            <i style={{ background: '#f0c24a' }} /> Objective
          </li>
          <li>
            <i style={{ background: '#8fcf6a' }} /> Supply cache you were told about
          </li>
        </ul>
        <h4>Places</h4>
        <ul className="map-places">
          {LOCATIONS.map((loc) => (
            <li key={loc.id}>
              <strong>{loc.name}</strong>
              <span>
                {KIND_NAMES[loc.kind]} · {sideOf(save, loc.id) === 'ally' ? 'ours' : `Legion, tier ${loc.tier ?? 1}`}
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
