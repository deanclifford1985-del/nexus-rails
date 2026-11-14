import React from 'react';
import { useGame } from '../state/store.jsx';
import { cx, useKeys } from './bits.jsx';
import { useHost } from './context.jsx';
import Dialog from './Dialog.jsx';
import SpecSelect from './SpecSelect.jsx';
import Exam from './Exam.jsx';
import { Graduation, Promotion, TrainingResult } from './Training.jsx';
import { Briefing, Debrief, OpsBoard } from './Ops.jsx';
import FieldMenu, { Pause } from './FieldMenu.jsx';
import { Barracks, Shop } from './Shop.jsx';
import Travel from './Travel.jsx';

// Draws whichever menu is open over the 3D world. Each menu is named in the store
// (open('shop'), open('dialog', { id })); the list below maps a name to its screen.
const SCREENS = {
  dialog: { component: Dialog, dialog: true, fixed: true },
  spec: { component: SpecSelect, fixed: true },
  exam: { component: Exam },
  trainingResult: { component: TrainingResult, fixed: true },
  graduation: { component: Graduation, fixed: true },
  promotion: { component: Promotion, fixed: true },
  ops: { component: OpsBoard },
  briefing: { component: Briefing },
  debrief: { component: Debrief, fixed: true },
  menu: { component: FieldMenu },
  pause: { component: Pause },
  shop: { component: Shop },
  barracks: { component: Barracks },
  travel: { component: Travel },
};

export function registerScreens(more) {
  Object.assign(SCREENS, more);
}

export default function Overlays() {
  const { overlay } = useGame();
  const host = useHost();
  const screen = overlay ? SCREENS[overlay.name] : null;
  useKeys((event) => {
    if (!overlay || event.key !== 'Escape') return false;
    if (screen && !screen.fixed) host.resume();
    return true;
  });
  if (!overlay) return null;
  if (!screen) {
    return (
      <div className="ui-ov">
        <section className="ui-panel ui-panel-xs">
          <div className="ui-body">
            <p>Nothing to show for “{overlay.name}”.</p>
            <button type="button" className="ui-btn" onClick={() => host.resume()}>
              Close
            </button>
          </div>
        </section>
      </div>
    );
  }
  const Screen = screen.component;
  return (
    <div className={cx('ui-ov', screen.dialog && 'ui-ov-dialog')} onPointerDown={(e) => e.stopPropagation()}>
      <Screen key={overlay.name + (overlay.props?.id ?? overlay.props?.missionId ?? '')} {...overlay.props} />
    </div>
  );
}
