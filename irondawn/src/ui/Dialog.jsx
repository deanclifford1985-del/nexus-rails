import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, CircleCheck, CircleX } from 'lucide-react';
import { DIALOGS, NPCS, checkPasses, fillText } from '../game/story.js';
import { attrName } from './format.js';
import { Avatar, cx, useKeys } from './bits.jsx';
import { useHost, useUi } from './context.jsx';

const CHARS_PER_SECOND = 70;

// A conversation: the speaker's lines one at a time, then the choices (if any). When it ends the
// dialog is marked as seen and its command, or the chosen choice's, is handed to the game.
export default function Dialog({ id: startId }) {
  const { save, derived, act } = useUi();
  const host = useHost();
  const [id, setId] = useState(startId);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const finished = useRef(false);

  const dialog = DIALOGS[id];
  const lines = dialog?.lines ?? [];
  const line = lines[index] ?? '';
  const text = fillText(typeof line === 'string' ? line : line.text, save);
  const speaker = NPCS[(typeof line === 'object' && line.npc) || dialog?.npc] ?? { name: 'Unknown', role: '', tone: 'olive' };
  const last = index >= lines.length - 1;
  const typing = shown < text.length;
  const choices = dialog?.choices ?? [];
  const choosing = last && !typing && choices.length > 0;

  // The typewriter.
  useEffect(() => {
    if (!typing) return undefined;
    const timer = window.setInterval(() => setShown((n) => Math.min(text.length, n + Math.max(1, Math.round(CHARS_PER_SECOND / 30)))), 1000 / 30);
    return () => window.clearInterval(timer);
  }, [typing, text.length, index, id]);

  // A dialog that does not exist has nothing to say.
  useEffect(() => {
    if (!dialog && !finished.current) {
      finished.current = true;
      host.resume();
    }
  }, [dialog, host]);

  const finish = (cmd) => {
    if (finished.current) return;
    finished.current = true;
    act('markSeen', { id }, { quiet: true });
    if (cmd) host.run(cmd);
    else host.resume();
  };

  const jump = (next) => {
    if (finished.current) return;
    act('markSeen', { id }, { quiet: true });
    if (DIALOGS[next]) {
      setId(next);
      setIndex(0);
      setShown(0);
    } else finish(null);
  };

  const advance = () => {
    if (!dialog || finished.current) return;
    if (typing) setShown(text.length);
    else if (!last) {
      setIndex(index + 1);
      setShown(0);
    } else if (!choices.length) finish(dialog.cmd ?? null);
  };

  const choose = (choice) => {
    if (!choice) return;
    if (choice.check) {
      const next = checkPasses(choice.check, derived.attrs) ? choice.pass : choice.fail;
      if (next) jump(next);
      else finish(choice.cmd ?? null);
    } else if (choice.goto) jump(choice.goto);
    else finish(choice.cmd ?? null);
  };

  // Escape hurries to the end without losing what the dialog does.
  const skip = () => {
    if (!dialog) return;
    if (choices.length) {
      setIndex(lines.length - 1);
      setShown(Number.MAX_SAFE_INTEGER);
    } else finish(dialog.cmd ?? null);
  };

  useKeys((event) => {
    if (event.repeat) return true;
    const key = event.key;
    if (key === 'Escape') {
      skip();
      return true;
    }
    if (choosing && /^[1-9]$/.test(key)) {
      choose(choices[Number(key) - 1]);
      return true;
    }
    if (key === ' ' || key === 'Enter' || key === 'e' || key === 'E') {
      // With choices up, Space and Enter belong to whichever choice button has the focus.
      if (choosing) return false;
      advance();
      return true;
    }
    return false;
  });

  if (!dialog) return null;

  return (
    <div className="ui-dialog-wrap" onClick={choosing ? undefined : advance}>
      <section className={cx('ui-dialog', `ui-dialog-${speaker.tone ?? 'olive'}`)} role="dialog" aria-label={`${speaker.name} speaking`}>
        <header className="ui-dialog-speaker">
          <Avatar name={speaker.name} tone={speaker.tone} size={48} />
          <div className="ui-dialog-who">
            <strong>{speaker.name}</strong>
            <span>{speaker.role}</span>
          </div>
          {lines.length > 1 ? (
            <div className="ui-dialog-dots" aria-hidden="true">
              {lines.map((_, i) => (
                <i key={i} className={i <= index ? 'is-on' : ''} />
              ))}
            </div>
          ) : null}
        </header>
        <p className="ui-dialog-text" aria-live="polite">
          <span>{text.slice(0, shown)}</span>
          <span className="ui-ghost" aria-hidden="true">
            {text.slice(shown)}
          </span>
        </p>
        {choosing ? (
          <div className="ui-choices">
            {choices.map((choice, i) => {
              const pass = choice.check ? checkPasses(choice.check, derived.attrs) : null;
              return (
                <button key={i} type="button" className={cx('ui-choice', choice.check && (pass ? 'is-pass' : 'is-fail'))} onClick={() => choose(choice)}>
                  <span className="ui-choice-key">{i + 1}</span>
                  <span className="ui-choice-text">
                    {choice.check ? (
                      <span className={cx('ui-check', pass ? 'is-pass' : 'is-fail')}>
                        {pass ? <CircleCheck size={14} aria-hidden="true" /> : <CircleX size={14} aria-hidden="true" />}[{attrName(choice.check.attr)} {choice.check.dc}]
                        <em>you have {derived.attrs[choice.check.attr] ?? 0}</em>
                      </span>
                    ) : null}
                    {fillText(choice.text, save)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="ui-dialog-next" aria-hidden="true">
            <span>{typing ? '' : last && !choices.length ? 'Done' : 'Continue'}</span>
            <ChevronRight size={18} />
          </div>
        )}
      </section>
    </div>
  );
}
