import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check } from 'lucide-react';
import { mulberry } from '../game/balance.js';
import { EXAM, scoreExam } from '../game/training.js';
import { Btn, Chip, Panel, cx, useKeys } from './bits.jsx';
import { useHost } from './context.jsx';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function shuffled(count, rng) {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// The written exam: eight questions, one at a time. The answers are shown in a fresh order
// each sitting; what is recorded is each chosen option's own index, as scoreExam expects.
export default function Exam() {
  const host = useHost();
  const order = useMemo(() => {
    const rng = mulberry(Math.floor(Math.random() * 1e9));
    return EXAM.map((question) => shuffled(question.options.length, rng));
  }, []);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [handedIn, setHandedIn] = useState(false);

  const question = EXAM[step];
  const options = order[step];
  const chosen = answers[question.id];
  const answered = chosen !== undefined;
  const lastStep = step === EXAM.length - 1;

  const choose = (optionIndex) => setAnswers((current) => ({ ...current, [question.id]: optionIndex }));
  const next = () => {
    if (!answered || handedIn) return;
    if (!lastStep) return setStep(step + 1);
    setHandedIn(true);
    if (host.call('finishTraining', 'exam', scoreExam(answers)) === null) setHandedIn(false);
  };

  useKeys((event) => {
    const key = event.key.toUpperCase();
    const slot = /^[1-9]$/.test(key) ? Number(key) - 1 : LETTERS.indexOf(key);
    if (slot >= 0 && slot < options.length) {
      choose(options[slot]);
      return true;
    }
    if (event.key === 'Enter' && answered && !(event.target instanceof HTMLButtonElement)) {
      next();
      return true;
    }
    return false;
  });

  return (
    <Panel
      size="md"
      icon={BookOpen}
      kicker="Classroom tent · Lieutenant Sato"
      title="Field Leadership Exam"
      side={
        <span className="ui-num ui-muted">
          {step + 1} / {EXAM.length}
        </span>
      }
      foot={
        <>
          <Btn tone="ghost" onClick={() => host.resume()} className="ui-push-left">
            Leave
          </Btn>
          <Btn icon={ArrowLeft} disabled={step === 0} onClick={() => setStep(step - 1)}>
            Back
          </Btn>
          <Btn tone="primary" icon={lastStep ? Check : ArrowRight} disabled={!answered || handedIn} onClick={next}>
            {lastStep ? 'Hand in' : 'Next'}
          </Btn>
        </>
      }
    >
      <div className="ui-exam">
        <div className="ui-exam-progress" aria-hidden="true">
          {EXAM.map((q, i) => (
            <i key={q.id} className={cx(i === step && 'is-here', answers[q.id] !== undefined && 'is-done')} />
          ))}
        </div>
        <Chip tone="khaki">{question.topic}</Chip>
        <p className="ui-exam-q">{question.q}</p>
        <div className="ui-options" role="radiogroup" aria-label="Answers">
          {options.map((optionIndex, slot) => (
            <button key={optionIndex} type="button" role="radio" aria-checked={chosen === optionIndex} className={cx('ui-option', chosen === optionIndex && 'is-on')} onClick={() => choose(optionIndex)}>
              <span className="ui-option-key">{LETTERS[slot]}</span>
              <span>{question.options[optionIndex].text}</span>
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}
