import React from 'react';
import { BedDouble, Plane } from 'lucide-react';
import { KIND_NAMES, travelPoints } from '../game/world.js';
import { Btn, Panel, Section } from './bits.jsx';
import { useHost, useUi } from './context.jsx';
import { clock, dayPart } from './format.js';

const RESTS = [
  { hour: 6, name: 'Until dawn', text: 'First light. Good for the long walk in.' },
  { hour: 13, name: 'Until midday', text: 'Full daylight. You see everything, and so do they.' },
  { hour: 19.5, name: 'Until dusk', text: 'The light is going. Sentries see less far.' },
  { hour: 23, name: 'Until night', text: 'Dark. Sentries see less than half as far.' },
];

// The flight line (fly to a place you hold) and your bunk (sleep until an hour of the day).
export default function Travel({ rest = false }) {
  const { save } = useUi();
  const host = useHost();
  const state = host.state();
  const points = travelPoints(save);
  return (
    <Panel size="sm" icon={rest ? BedDouble : Plane} kicker={`Day ${state.day} · ${clock(state.hour)} · ${dayPart(state.hour)}`} title={rest ? 'Your bunk' : 'Flight line'} onClose={() => host.resume()}>
      {!rest ? (
        <Section title="Fly to">
          <div className="pause-list">
            {points.map((loc) => (
              <Btn key={loc.id} onClick={() => host.call('travel', loc.id)}>
                {loc.name} · {KIND_NAMES[loc.kind]}
              </Btn>
            ))}
          </div>
          <p className="ui-muted ui-small ui-p" style={{ marginTop: 10 }}>
            You can fly to headquarters and to any place we hold that you have been to. Operations fly you in on their own.
          </p>
        </Section>
      ) : null}
      <Section title="Rest">
        <div className="pause-list">
          {RESTS.map((r) => (
            <Btn key={r.hour} onClick={() => host.call('rest', r.hour)}>
              {r.name} ({clock(r.hour)})
            </Btn>
          ))}
        </div>
        <p className="ui-muted ui-small ui-p" style={{ marginTop: 10 }}>
          Sleep restores your health. Out in the open world the hour matters: Legion sentries see much less in the dark.
        </p>
      </Section>
    </Panel>
  );
}
