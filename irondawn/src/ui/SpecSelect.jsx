import React, { useState } from 'react';
import { ClipboardList, Sparkles, Star } from 'lucide-react';
import { B } from '../game/balance.js';
import { ATTRIBUTES, GROUPS } from '../game/attributes.js';
import { SPECS } from '../game/specializations.js';
import { attrName, kitLines } from './format.js';
import { AttrIcon, Bar, Chip, ConfirmBtn, Panel, Section, cx, useKeys } from './bits.jsx';
import { useHost, useUi } from './context.jsx';

// The intake board: seven specializations. The choice is final, so the button asks twice.
export default function SpecSelect() {
  const { act } = useUi();
  const host = useHost();
  const [pick, setPick] = useState(SPECS[0].id);
  const spec = SPECS.find((s) => s.id === pick) ?? SPECS[0];

  const sign = () => {
    const report = act('chooseSpec', { spec: spec.id });
    if (report) host.run({ type: 'specChosen' });
  };

  useKeys((event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
      const at = SPECS.findIndex((s) => s.id === pick);
      setPick(SPECS[(at + step + SPECS.length) % SPECS.length].id);
      return true;
    }
    return false;
  });

  // Affinity is a practice multiplier; say it in words.
  const faster = Math.round((B.ATTR.AFFINITY - 1) * 100);

  return (
    <Panel
      size="xl"
      tall
      icon={ClipboardList}
      kicker="Intake · Camp Hawthorne"
      title="Choose your specialization"
      foot={
        <>
          <span className="ui-foot-note">This is final. Any soldier can learn any skill in the field; your specialization decides what comes fastest.</span>
          <ConfirmBtn tone="primary" confirm={`Sign as ${spec.name}? It is final`} onConfirm={sign}>
            Sign as {spec.name}
          </ConfirmBtn>
        </>
      }
    >
      <div className="ui-spec">
        <nav className="ui-spec-list ui-scroll" aria-label="Specializations">
          {SPECS.map((s) => (
            <button key={s.id} type="button" className={cx('ui-pick', s.id === pick && 'is-on')} onClick={() => setPick(s.id)} aria-pressed={s.id === pick}>
              <strong>{s.name}</strong>
              <span>{s.branch}</span>
            </button>
          ))}
        </nav>

        <div className="ui-spec-detail" key={spec.id}>
          <header className="ui-spec-head">
            <h3>{spec.name}</h3>
            <Chip tone="khaki">{spec.branch}</Chip>
          </header>
          <p className="ui-spec-blurb">{spec.blurb}</p>

          <div className="ui-spec-cols">
            <div>
              <Section title="Starting bonuses">
                <ul className="ui-bonus-list">
                  {Object.entries(spec.bonuses).map(([attr, bonus]) => (
                    <li key={attr}>
                      <span className="ui-bonus-name">
                        <AttrIcon id={attr} />
                        {attrName(attr)}
                      </span>
                      <Bar share={(B.ATTR.START + bonus) / 30} tone="gold" />
                      <b className="ui-num ui-gold">+{bonus}</b>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Learns fastest">
                <div className="ui-row">
                  {spec.affinity.map((attr) => (
                    <Chip key={attr} tone="good" icon={Star}>
                      {attrName(attr)}
                    </Chip>
                  ))}
                </div>
                <p className="ui-muted ui-small ui-p" style={{ marginTop: 8 }}>
                  These improve {faster}% faster with practice in the field.
                </p>
              </Section>

              <Section title={`Perk: ${spec.perk.name}`}>
                <p className="ui-perk">
                  <Sparkles size={16} aria-hidden="true" />
                  <span>{spec.perk.text}</span>
                </p>
              </Section>
            </div>

            <div>
              <Section title="Issued kit">
                <dl className="ui-kit">
                  {kitLines(spec).map((line) => (
                    <React.Fragment key={line.label}>
                      <dt>{line.label}</dt>
                      <dd>{line.text || 'None'}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              </Section>

              <Section title="Attributes before training" side="basic training adds to these">
                <div className="ui-spec-attrs">
                  {GROUPS.map((group) => (
                    <div key={group.id} className="ui-spec-group">
                      <h4>{group.name}</h4>
                      {ATTRIBUTES.filter((a) => a.group === group.id).map((a) => {
                        const bonus = spec.bonuses[a.id] ?? 0;
                        return (
                          <div key={a.id} className={cx('ui-spec-attr', bonus > 0 && 'is-up')}>
                            <span>{a.name}</span>
                            <b className="ui-num">{B.ATTR.START + bonus}</b>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
