import { describe, expect, it } from 'vitest';
import { B } from '../src/game/balance.js';
import { ATTRIBUTES, ATTR_IDS, ATTR_MAX, GROUPS } from '../src/game/attributes.js';
import { SPECS, hasPerk, specOf } from '../src/game/specializations.js';
import { ATTACHMENTS, GEAR, GEAR_SLOTS, ITEMS, WEAPONS, WEAPON_CLASSES, attachmentFits, slotKind } from '../src/game/items.js';
import {
  addXp, applyPractice, carryLimits, deriveStats, describeDerived, fullName, levelForXp, levelProgress, newCharacter, pointCost, practiceNeed, practiceShare,
  primaryOf, secondaryOf, totalAttrs, weaponByUid, weaponEff, xpForLevel,
} from '../src/game/character.js';
import { EVENTS, EXAM, gradeFor, scoreExam, scoreObservation, scoreObstacle, scoreRange, scoreStealth, trainingBonuses, trainingSummary } from '../src/game/training.js';
import { RANKS, RANK_INDEX, SUPPORTS, nextRankGap, promotionDue, rankOf } from '../src/game/ranks.js';
import { squadCap } from '../src/game/squad.js';
import { STORY } from '../src/game/missions.js';
import * as A from '../src/game/actions.js';
import { AVERAGE, NOW, PERFECT, at, bestAnswers, numbers, recruit, refusal, soldier, trained } from './helpers.js';

describe('attributes', () => {
  it('names every skill the design asks for, each in a real group', () => {
    for (const id of ['accuracy', 'endurance', 'speed', 'stealth', 'quickness', 'climbing', 'scope', 'vision', 'perception', 'intelligence', 'negotiating', 'communication', 'leadership']) {
      expect(ATTR_IDS).toContain(id);
    }
    expect(new Set(ATTR_IDS).size).toBe(ATTR_IDS.length);
    const groups = GROUPS.map((g) => g.id);
    for (const attr of ATTRIBUTES) {
      expect(groups).toContain(attr.group);
      expect(attr.name.length).toBeGreaterThan(0);
      expect(attr.uses.length).toBeGreaterThan(0);
    }
    for (const group of groups) expect(ATTRIBUTES.some((a) => a.group === group)).toBe(true);
  });
});

describe('creation and specializations', () => {
  it('a recruit steps off the truck with nothing but fatigues', () => {
    const save = newCharacter({ name: '  Jo Brennan-Castillo the Third  ', callsign: 'Sparrow', now: NOW });
    expect(save.name).toBe('Jo Brennan-Castill');
    expect(newCharacter({ name: '   ' }).name).toBe('Recruit');
    expect(save.phase).toBe('intake');
    expect(save.rank).toBe(0);
    expect(save.spec).toBeNull();
    expect(save.weapons).toEqual([]);
    expect(save.loadout.gear.uniform).toBe('bdu');
    expect(save.loadout.gear.boots).toBe('issue');
    expect(Object.keys(save.loadout.gear).sort()).toEqual(Object.keys(GEAR_SLOTS).sort());
    for (const id of ATTR_IDS) expect(save.attrs[id]).toBe(B.ATTR.START);
    expect(save.level).toBe(1);
    expect(save.xp).toBe(0);
    expect(fullName(save)).toBe('RCT Jo Brennan-Castill');
  });

  it('every specialization adds exactly its bonuses', () => {
    expect(SPECS.length).toBe(7);
    for (const spec of SPECS) {
      const save = recruit(spec.id);
      expect(save.spec).toBe(spec.id);
      expect(save.phase).toBe('training');
      for (const id of ATTR_IDS) expect(save.attrs[id]).toBe(B.ATTR.START + (spec.bonuses[id] ?? 0));
    }
  });

  it('specializations are worth about the same and practise what they are given', () => {
    for (const spec of SPECS) {
      const total = Object.values(spec.bonuses).reduce((sum, n) => sum + n, 0);
      expect(total).toBeGreaterThanOrEqual(26);
      expect(total).toBeLessThanOrEqual(32);
      for (const attr of Object.keys(spec.bonuses)) expect(ATTR_IDS).toContain(attr);
      for (const attr of spec.affinity) expect(Object.keys(spec.bonuses)).toContain(attr);
    }
  });

  it('every kit is real, fits its slots and can be carried', () => {
    for (const spec of SPECS) {
      const save = recruit(spec.id);
      const primary = primaryOf(save);
      const secondary = secondaryOf(save);
      expect(primary.id).toBe(spec.kit.primary.id);
      expect(secondary.id).toBe(spec.kit.secondary.id);
      expect(WEAPON_CLASSES[WEAPONS[primary.id].class].slot).toBe('primary');
      expect(WEAPON_CLASSES[WEAPONS[secondary.id].class].slot).toBe('secondary');
      for (const instance of [primary, secondary]) {
        for (const [slot, attachment] of Object.entries(instance.att)) {
          expect(ATTACHMENTS[attachment], `${spec.id}: ${attachment}`).toBeTruthy();
          expect(ATTACHMENTS[attachment].slot).toBe(slot);
          expect(attachmentFits(attachment, instance.id), `${attachment} on ${instance.id}`).toBe(true);
        }
      }
      for (const [slot, gearId] of Object.entries(save.loadout.gear)) {
        if (!gearId) continue;
        expect(GEAR[gearId], `${spec.id}: ${gearId}`).toBeTruthy();
        expect(GEAR[gearId].kind).toBe(slotKind(slot));
        expect(save.gearOwned).toContain(gearId);
      }
      expect(save.loadout.gear.uniform).toBeTruthy();
      expect(save.loadout.gear.boots).toBeTruthy();
      const limits = carryLimits(save);
      for (const [item, n] of Object.entries(save.items)) {
        expect(ITEMS[item], `${spec.id}: ${item}`).toBeTruthy();
        expect(n).toBeGreaterThan(0);
        expect(n, `${spec.id} carries ${n} ${item}`).toBeLessThanOrEqual(limits[item]);
      }
      // Nobody is issued more than they can carry without slowing down.
      expect(deriveStats(save).overload, `${spec.id} load`).toBe(0);
    }
  });

  it('each specialization has its own perk', () => {
    const perks = SPECS.map((s) => s.perk.id);
    expect(new Set(perks).size).toBe(SPECS.length);
    for (const spec of SPECS) {
      const save = recruit(spec.id);
      for (const other of SPECS) expect(hasPerk(save, other.perk.id)).toBe(other.id === spec.id);
    }
    expect(hasPerk(newCharacter({ name: 'x' }), 'shadow')).toBe(false);
    expect(specOf('nope')).toBeNull();
  });

  it('is chosen once, from the list', () => {
    const save = recruit(null);
    expect(refusal(() => A.chooseSpec(save, { spec: 'pilot' }))).toMatch(/No such/);
    A.chooseSpec(save, { spec: 'medic', now: NOW });
    expect(refusal(() => A.chooseSpec(save, { spec: 'recon' }))).toMatch(/already/);
    expect(save.spec).toBe('medic');
    expect(save.log.length).toBe(1);
  });
});

describe('basic training', () => {
  it('has five evaluations that set real attributes', () => {
    expect(EVENTS.map((e) => e.id)).toEqual(['range', 'obstacle', 'stealth', 'observation', 'exam']);
    for (const event of EVENTS) for (const attr of event.sets) expect(ATTR_IDS).toContain(attr);
    for (const table of ['RANGE', 'OBSTACLE', 'STEALTH', 'OBSERVATION']) for (const attr of Object.keys(B.TRAINING[table])) expect(ATTR_IDS).toContain(attr);
    // Between them the evaluations touch every attribute a recruit has.
    const touched = new Set(EVENTS.flatMap((e) => e.sets));
    for (const id of ATTR_IDS) expect(touched.has(id), id).toBe(true);
  });

  it('scores stay between 0 and 100 whatever happens on the course', () => {
    const scores = [];
    for (const hits of [-3, 0, 9, 18, 40]) for (const longHits of [-1, 0, 3, 6, 9]) for (const avgReact of [-1, 0.5, 1.7, 2.6, 9]) scores.push(scoreRange({ hits, longHits, avgReact }));
    for (const time of [0, 30, 62, 100, 135, 600]) for (const faults of [0, 3, 20]) for (const staminaLeft of [0, 0.5, 1]) for (const finished of [true, false]) scores.push(scoreObstacle({ time, faults, staminaLeft, finished }));
    for (const reached of [true, false]) for (const strikes of [0, 1, 3, 9]) for (const peak of [0, 0.6, 1, 4]) for (const time of [10, 90, 200, 2000]) scores.push(scoreStealth({ reached, strikes, peak, time }));
    for (const found of [-1, 0, 4, 8, 20]) for (const timeLeft of [0, 30, 75, 500]) scores.push(scoreObservation({ found, timeLeft }));
    scores.push(scoreExam({}), scoreExam(bestAnswers()), scoreExam({ ambush: 99, nonsense: 1 }));
    for (const result of scores) {
      expect(Number.isInteger(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      for (const share of Object.values(result.parts ?? {})) {
        expect(share).toBeGreaterThanOrEqual(0);
        expect(share).toBeLessThanOrEqual(1);
      }
    }
  });

  it('a better run never scores worse', () => {
    const rising = (list) => list.every((score, i) => i === 0 || score >= list[i - 1]);
    expect(rising([0, 3, 6, 9, 12, 15, 18].map((hits) => scoreRange({ hits, longHits: 2, avgReact: 1.5 }).score))).toBe(true);
    expect(rising([0, 1, 2, 3, 4, 5, 6].map((longHits) => scoreRange({ hits: 9, longHits, avgReact: 1.5 }).score))).toBe(true);
    expect(rising([2.6, 2.2, 1.8, 1.4, 1.0, 0.6].map((avgReact) => scoreRange({ hits: 9, longHits: 2, avgReact }).score))).toBe(true);
    expect(rising([200, 135, 110, 90, 75, 62, 40].map((time) => scoreObstacle({ time }).score))).toBe(true);
    expect(rising([6, 4, 2, 1, 0].map((faults) => scoreObstacle({ time: 80, faults }).score))).toBe(true);
    expect(rising([3, 2, 1, 0].map((strikes) => scoreStealth({ reached: true, strikes }).score))).toBe(true);
    expect(rising([1, 0.7, 0.4, 0].map((peak) => scoreStealth({ reached: true, peak }).score))).toBe(true);
    expect(rising([400, 250, 150, 90].map((time) => scoreStealth({ reached: true, time }).score))).toBe(true);
    expect(scoreStealth({ reached: true }).score).toBeGreaterThan(scoreStealth({ reached: false }).score);
    expect(rising([0, 1, 2, 3, 4, 5, 6, 7, 8].map((found) => scoreObservation({ found }).score))).toBe(true);
    expect(rising([0, 20, 40, 75].map((timeLeft) => scoreObservation({ found: 8, timeLeft }).score))).toBe(true);
    // A real range of scores, not a pass/fail.
    expect(scoreRange({ hits: 0, longHits: 0, avgReact: 3 }).score).toBe(0);
    expect(scoreObstacle({ time: 500 }).score).toBeLessThan(20);
    expect(scoreObstacle({ time: 60, finished: false }).score).toBe(0);
    expect(scoreStealth({ reached: false, strikes: 3 }).score).toBeLessThan(10);
    expect(scoreObservation({ found: 0 }).score).toBe(0);
  });

  it('a perfect run earns exactly the most each evaluation can give', () => {
    for (const [event, table] of [['range', 'RANGE'], ['obstacle', 'OBSTACLE'], ['stealth', 'STEALTH'], ['observation', 'OBSERVATION']]) {
      const result = PERFECT[event]();
      expect(result.score, event).toBe(100);
      expect(trainingBonuses(event, result), event).toEqual(B.TRAINING[table]);
    }
    const exam = PERFECT.exam();
    expect(exam.score).toBe(100);
    expect(exam.best).toBe(EXAM.length);
    const bonuses = trainingBonuses('exam', exam);
    for (const [attr, pts] of Object.entries(exam.gains)) expect(bonuses[attr]).toBe(Math.round(pts * B.TRAINING.EXAM_POINT));
    expect(trainingBonuses('parade', { score: 100 })).toEqual({});
  });

  it('a hopeless run earns next to nothing', () => {
    const runs = {
      range: scoreRange({ hits: 0, longHits: 0, avgReact: 3 }),
      obstacle: scoreObstacle({ time: 300, faults: 9, staminaLeft: 0 }),
      stealth: scoreStealth({ reached: false, strikes: 3, peak: 1, time: 600 }),
      observation: scoreObservation({ found: 0 }),
      exam: scoreExam({}),
    };
    for (const [event, result] of Object.entries(runs)) {
      const total = Object.values(trainingBonuses(event, result)).reduce((sum, n) => sum + n, 0);
      expect(total, event).toBeLessThanOrEqual(3);
    }
  });

  it('the exam has one best answer per question, and not always in the same place', () => {
    expect(EXAM.length).toBe(8);
    const positions = [];
    for (const question of EXAM) {
      expect(question.options.length).toBe(4);
      expect(question.options.filter((o) => o.best).length).toBe(1);
      const best = question.options.find((o) => o.best);
      const worth = (o) => Object.values(o.pts).reduce((sum, n) => sum + n, 0);
      for (const option of question.options) {
        for (const attr of Object.keys(option.pts)) expect(ATTR_IDS).toContain(attr);
        if (!option.best) expect(worth(option)).toBeLessThan(worth(best));
      }
      positions.push(question.options.indexOf(best));
    }
    // A recruit who always ticks the same box should not pass.
    for (const index of [0, 1, 2, 3]) {
      expect(positions.filter((p) => p === index).length, `answer ${index + 1} is best ${positions.filter((p) => p === index).length} times`).toBeLessThanOrEqual(3);
      const lazy = scoreExam(Object.fromEntries(EXAM.map((q) => [q.id, index])));
      expect(lazy.score).toBeLessThan(B.TRAINING.GRADES[1][0]);
    }
  });

  it('the exam marks the paper and pays the attributes the answers show', () => {
    const blank = scoreExam({});
    expect(blank.score).toBe(0);
    expect(blank.gains).toEqual({});
    expect(blank.marked.every((m) => m.chosen === null && !m.right)).toBe(true);
    const paper = scoreExam(bestAnswers());
    expect(paper.marked.every((m) => m.right && m.chosen === m.best && m.why.length > 0)).toBe(true);
    // Second-best answers are worth something, but less.
    const secondBest = scoreExam(Object.fromEntries(EXAM.map((q) => [q.id, q.options.findIndex((o) => !o.best && Object.keys(o.pts).length > 0)])));
    expect(secondBest.score).toBeGreaterThan(0);
    expect(secondBest.score).toBeLessThan(60);
    expect(secondBest.best).toBe(0);
  });

  it('grades follow the score', () => {
    expect(gradeFor(100)).toBe('Expert');
    expect(gradeFor(90)).toBe('Expert');
    expect(gradeFor(89)).toBe('Sharpshooter');
    expect(gradeFor(75)).toBe('Sharpshooter');
    expect(gradeFor(74)).toBe('Qualified');
    expect(gradeFor(55)).toBe('Qualified');
    expect(gradeFor(54)).toBe('Marginal');
    expect(gradeFor(0)).toBe('Marginal');
  });

  it('needs a specialization first, and a real evaluation', () => {
    const fresh = recruit(null);
    expect(refusal(() => A.finishTraining(fresh, { event: 'range', result: PERFECT.range() }))).toMatch(/intake/);
    const save = recruit('rifleman');
    expect(refusal(() => A.finishTraining(save, { event: 'parade', result: { score: 50 } }))).toMatch(/No such/);
  });

  it('the first result sets the baseline, a worse retake changes nothing and a better one replaces it', () => {
    const save = recruit('rifleman');
    const start = { ...save.attrs };
    const fair = scoreRange({ hits: 9, longHits: 2, avgReact: 1.7 });
    const first = A.finishTraining(save, { event: 'range', result: fair, now: NOW });
    expect(first.first).toBe(true);
    expect(first.grade).toBe(gradeFor(fair.score));
    const fairBonuses = trainingBonuses('range', fair);
    for (const id of ATTR_IDS) expect(save.attrs[id]).toBe(start[id] + (fairBonuses[id] ?? 0));
    expect(save.training.results.range.score).toBe(fair.score);

    const afterFirst = { ...save.attrs };
    const worse = A.finishTraining(save, { event: 'range', result: scoreRange({ hits: 4, longHits: 0, avgReact: 2.4 }), now: NOW });
    expect(worse.kept).toBe(true);
    expect(worse.best).toBe(fair.score);
    expect(save.attrs).toEqual(afterFirst);
    expect(save.training.results.range.score).toBe(fair.score);

    const same = A.finishTraining(save, { event: 'range', result: fair, now: NOW });
    expect(same.kept).toBe(true);
    expect(save.attrs).toEqual(afterFirst);

    const better = A.finishTraining(save, { event: 'range', result: PERFECT.range(), now: NOW });
    expect(better.improved).toBe(true);
    expect(better.first).toBe(false);
    // The best run's bonuses stand alone: nothing is counted twice.
    for (const id of ATTR_IDS) expect(save.attrs[id]).toBe(start[id] + (B.TRAINING.RANGE[id] ?? 0));
    expect(save.training.results.range.score).toBe(100);
    expect(save.log.filter((entry) => /Rifle Qualification/.test(entry.text)).length).toBe(1);
  });

  it('counts the evaluations done and what is left', () => {
    const save = recruit('recon');
    expect(trainingSummary(save)).toMatchObject({ done: 0, total: 5, complete: false, average: 0, honors: false });
    A.finishTraining(save, { event: 'stealth', result: PERFECT.stealth(), now: NOW });
    A.finishTraining(save, { event: 'exam', result: AVERAGE.exam(), now: NOW });
    const summary = trainingSummary(save);
    expect(summary.done).toBe(2);
    expect(summary.remaining).toEqual(['range', 'obstacle', 'observation']);
    expect(summary.complete).toBe(false);
    expect(summary.average).toBe(Math.round((100 + AVERAGE.exam().score) / 2));
  });

  it('graduation needs all five, makes a Private and pays the stipend', () => {
    const save = recruit('rifleman');
    for (const event of ['range', 'obstacle', 'stealth', 'observation']) A.finishTraining(save, { event, result: AVERAGE[event](), now: NOW });
    expect(refusal(() => A.graduate(save, { now: NOW }))).toMatch(/all five/);
    expect(save.phase).toBe('training');
    expect(promotionDue(save)).toBeNull();
    A.finishTraining(save, { event: 'exam', result: AVERAGE.exam(), now: NOW });
    const rpBefore = save.rp;
    const report = A.graduate(save, { now: NOW });
    expect(report.complete).toBe(true);
    expect(report.honors).toBe(false);
    expect(save.phase).toBe('service');
    expect(save.rank).toBe(RANK_INDEX.pvt);
    expect(rankOf(save).name).toBe('Private');
    expect(save.training.graduated).toBe(true);
    expect(save.story.flags.graduated).toBe(true);
    expect(save.rp).toBe(rpBefore + B.TRAINING.GRAD_RP.base);
    expect(save.medals).toContain('graduate');
    expect(save.medals).not.toContain('honor');
    expect(refusal(() => A.graduate(save, { now: NOW }))).toMatch(/already/);
  });

  it('honours start at an average of 82', () => {
    const cycle = (score) => {
      const save = recruit('leader');
      for (const event of EVENTS) A.finishTraining(save, { event: event.id, result: { score, gains: {} }, now: NOW });
      return A.graduate(save, { now: NOW });
    };
    expect(B.TRAINING.HONORS).toBe(82);
    expect(cycle(81).honors).toBe(false);
    const top = cycle(82);
    expect(top.honors).toBe(true);
    expect(top.rp).toBe(B.TRAINING.GRAD_RP.base + B.TRAINING.GRAD_RP.honors);
    expect(top.medals.map((m) => m.id)).toEqual(expect.arrayContaining(['graduate', 'honor']));
  });

  it('after graduation a course is a refresher: practice, not baseline', () => {
    const save = soldier({ spec: 'rifleman' });
    const attrs = { ...save.attrs };
    const results = structuredClone(save.training.results);
    const report = A.finishTraining(save, { event: 'range', result: PERFECT.range(), now: NOW });
    expect(report.refresher).toBe(true);
    expect(report.bonuses).toEqual({});
    expect(save.training.results).toEqual(results);
    expect(report.record).toBe(true);
    expect(save.records.range).toBe(100);
    // A refresher is worth a little practice in each attribute the course trains, never a jump.
    for (const attr of EVENTS.find((e) => e.id === 'range').sets) {
      const moved = save.attrs[attr] - attrs[attr];
      expect(moved).toBeGreaterThanOrEqual(0);
      expect(moved).toBeLessThanOrEqual(1);
      expect(moved + save.practice[attr], attr).toBeGreaterThan(0);
    }
    const again = A.finishTraining(save, { event: 'range', result: scoreRange({ hits: 9, longHits: 2 }), now: NOW });
    expect(again.record).toBe(false);
    expect(save.records.range).toBe(100);
  });

  it('prints where each specialization starts after an average and a perfect cycle', () => {
    const row = (save) => {
      const d = deriveStats(save);
      return `rating ${String(d.rating).padStart(3)}  health ${d.maxHealth}  run ${d.runSpeed.toFixed(2)}  evade ${(d.evade * 100).toFixed(0)}%  hide ${(d.stealth * 100).toFixed(0)}%  spot ${d.visionRange.toFixed(0)}m  plan ${d.planPoints}`;
    };
    const lines = SPECS.map((spec) => `  ${spec.name.padEnd(16)} average: ${row(soldier({ spec: spec.id }))}\n  ${''.padEnd(16)} perfect: ${row(soldier({ spec: spec.id, runs: PERFECT }))}`);
    console.log(`Baseline after basic training (first mission recommends rating ${110 + 55}):\n${lines.join('\n')}`);
    for (const spec of SPECS) {
      const average = soldier({ spec: spec.id });
      const perfect = soldier({ spec: spec.id, runs: PERFECT });
      expect(deriveStats(perfect).rating).toBeGreaterThan(deriveStats(average).rating);
      // Training matters, but it does not hand out a finished soldier: nothing starts above 45.
      for (const id of ATTR_IDS) expect(perfect.attrs[id], `${spec.id} ${id}`).toBeLessThanOrEqual(45);
    }
  });
});

describe('derived stats', () => {
  it('every number is finite for every specialization, weak or strong', () => {
    for (const spec of SPECS) {
      for (const all of [1, 30, 100]) {
        const save = soldier({ spec: spec.id, all });
        const derived = deriveStats(save);
        for (const [path, value] of Object.entries(numbers(derived))) expect(Number.isFinite(value), `${spec.id} at ${all}: ${path} = ${value}`).toBe(true);
        for (const instance of save.weapons) for (const [path, value] of Object.entries(numbers(weaponEff(save, instance, derived)))) expect(Number.isFinite(value), `${spec.id} ${instance.id}: ${path}`).toBe(true);
      }
    }
  });

  // Which way each attribute pushes each number: +1 the number rises, -1 it falls.
  const MOVES = {
    endurance: [['maxStamina', 1], ['staminaRegen', 1], ['sprintCost', -1], ['maxHealth', 1]],
    speed: [['runSpeed', 1], ['sprintSpeed', 1], ['crouchSpeed', 1], ['evade', 1]],
    quickness: [['evade', 1], ['adsTime', -1], ['reloadMul', -1]],
    strength: [['carry', 1], ['recoilMul', -1], ['meleeDamage', 1]],
    climbing: [['maxSlope', 1], ['mantle', 1], ['climbSpeed', 1], ['fallMul', -1]],
    toughness: [['maxHealth', 1]],
    accuracy: [['spreadMul', -1], ['recoilMul', -1], ['damageMul', 1]],
    scope: [['swayMul', -1], ['breathSeconds', 1], ['longRangeMul', 1]],
    stealth: [['stealth', 1], ['noiseMul', -1]],
    vision: [['visionRange', 1], ['nightSight', 1], ['tracking', 1]],
    perception: [['awareness', 1], ['tracking', 1], ['tagSeconds', 1], ['planning', 1]],
    intelligence: [['xpMul', 1], ['practiceMul', 1], ['planning', 1], ['intelReveal', 1], ['tracking', 1]],
    medicine: [['medkitHeal', 1], ['bandageHeal', 1], ['reviveSeconds', -1]],
    engineering: [['explosiveMul', 1], ['plantMul', -1]],
    leadership: [['aura.acc', 1], ['aura.dmg', 1], ['aura.hp', 1], ['aura.reaction', -1], ['aura.transfer', 1], ['planning', 1]],
    communication: [['commandRange', 1], ['orderDelay', -1], ['supportCooldownMul', -1], ['planning', 1]],
    negotiating: [['priceMul', -1], ['sellMul', 1], ['payMul', 1], ['surrender', 1]],
  };

  it('each attribute moves the numbers it says it moves, the right way', () => {
    expect(Object.keys(MOVES).sort()).toEqual([...ATTR_IDS].sort());
    const base = soldier({ all: 30 });
    const low = deriveStats(base);
    for (const [attr, moves] of Object.entries(MOVES)) {
      const high = deriveStats(soldier({ all: 30, attrs: { [attr]: 80 } }));
      expect(high.attrs[attr]).toBe(80);
      for (const [path, direction] of moves) {
        const change = at(high, path) - at(low, path);
        expect(Math.sign(change), `${attr} should move ${path} ${direction > 0 ? 'up' : 'down'} (${at(low, path)} -> ${at(high, path)})`).toBe(direction);
      }
      // Raising one attribute never makes the soldier worse overall.
      expect(high.rating).toBeGreaterThan(low.rating);
    }
  });

  it('limits hold at the extremes', () => {
    const D = B.DERIVE;
    for (const spec of SPECS) {
      const weak = deriveStats(soldier({ spec: spec.id, all: 1 }));
      const strong = deriveStats(soldier({ spec: spec.id, all: 100 }));
      for (const d of [weak, strong]) {
        expect(d.spreadMul).toBeGreaterThanOrEqual(D.SPREAD.min);
        expect(d.recoilMul).toBeGreaterThanOrEqual(D.RECOIL.min);
        expect(d.swayMul).toBeGreaterThanOrEqual(D.SWAY.min);
        expect(d.evade).toBeGreaterThanOrEqual(0);
        expect(d.evade).toBeLessThanOrEqual(D.EVADE.cap);
        expect(d.stealth).toBeGreaterThanOrEqual(0);
        expect(d.stealth).toBeLessThanOrEqual(D.STEALTH.cap);
        expect(d.armor).toBeLessThanOrEqual(0.6);
        expect(d.armorHead).toBeLessThanOrEqual(0.6);
        expect(d.reviveSeconds).toBeGreaterThanOrEqual(D.REVIVE.min);
        expect(d.orderDelay).toBeGreaterThanOrEqual(D.ORDER_DELAY.min);
        expect(d.nightSight).toBeLessThanOrEqual(1);
        expect(d.intelReveal).toBeLessThanOrEqual(0.9);
        expect(d.tracking).toBeLessThanOrEqual(100);
        expect(d.planning).toBeLessThanOrEqual(100);
        expect(d.planPoints).toBeGreaterThanOrEqual(1);
        expect(d.planPoints).toBeLessThanOrEqual(1 + Math.floor(100 / D.PLAN_POINTS.per));
        // You can never sell for more than you pay.
        expect(d.sellMul).toBeLessThanOrEqual(d.priceMul + 1e-9);
        for (const key of ['maxHealth', 'maxStamina', 'staminaRegen', 'sprintCost', 'runSpeed', 'carry', 'adsTime', 'reloadMul', 'noiseMul', 'fallMul', 'plantMul', 'supportCooldownMul', 'priceMul', 'visionRange', 'awareness', 'commandRange', 'mantle']) {
          expect(d[key], `${spec.id} ${key}`).toBeGreaterThan(0);
        }
        expect(d.aura.reaction).toBeGreaterThan(0);
        expect(d.sprintSpeed).toBeGreaterThan(d.runSpeed);
        expect(d.runSpeed).toBeGreaterThan(d.crouchSpeed);
        expect(d.crouchSpeed).toBeGreaterThan(d.proneSpeed);
      }
      expect(strong.maxHealth).toBeGreaterThan(weak.maxHealth * 1.8);
      expect(strong.spreadMul).toBeLessThan(weak.spreadMul * 0.5);
    }
    // A soldier at 100 across the board is strong, not a god.
    const best = deriveStats(soldier({ all: 100 }));
    expect(best.maxHealth).toBeLessThan(320);
    expect(best.sprintSpeed).toBeLessThan(11);
    expect(best.damageMul).toBeLessThanOrEqual(1.25);
    expect(best.aura.acc).toBeLessThanOrEqual(1.5);
  });

  it('gear adds to attributes but never past 100, and the same kit twice counts once', () => {
    const save = soldier({ all: 98 });
    save.gearOwned.push('ghillie', 'radio');
    save.loadout.gear.uniform = 'ghillie';
    expect(totalAttrs(save).stealth).toBe(ATTR_MAX);
    save.attrs.stealth = 250;
    expect(totalAttrs(save).stealth).toBe(ATTR_MAX);
    save.attrs.stealth = -40;
    expect(totalAttrs(save).stealth).toBeGreaterThanOrEqual(1);

    const one = soldier({ all: 20 });
    one.gearOwned.push('radio');
    one.loadout.gear.deviceA = 'radio';
    one.loadout.gear.deviceB = null;
    const two = structuredClone(one);
    two.loadout.gear.deviceB = 'radio';
    expect(deriveStats(two).attrs.communication).toBe(deriveStats(one).attrs.communication);
    expect(deriveStats(two).commandRange).toBeCloseTo(deriveStats(one).commandRange, 9);
    expect(deriveStats(two).load).toBeCloseTo(deriveStats(one).load, 9);
  });

  it('a heavier load slows you down and costs evade', () => {
    const light = soldier({ all: 20 });
    const d0 = deriveStats(light);
    expect(d0.overload).toBe(0);
    const heavy = structuredClone(light);
    heavy.weapons.push({ uid: 'wx', id: 'juggernaut', att: {} });
    heavy.loadout.primary = 'wx';
    heavy.gearOwned.push('heavy', 'ruck');
    heavy.loadout.gear.vest = 'heavy';
    const d1 = deriveStats(heavy);
    expect(d1.load).toBeGreaterThan(d0.load + 10);
    expect(d1.overload).toBeGreaterThan(0);
    expect(d1.runSpeed).toBeLessThan(d0.runSpeed);
    expect(d1.sprintSpeed).toBeLessThan(d0.sprintSpeed);
    expect(d1.evade).toBeLessThan(d0.evade);
    // Strength carries it.
    const strong = structuredClone(heavy);
    strong.attrs.strength = 90;
    const d2 = deriveStats(strong);
    expect(d2.carry).toBeGreaterThan(d1.carry);
    expect(d2.overload).toBeLessThan(d1.overload);
    expect(d2.runSpeed).toBeGreaterThan(d1.runSpeed);
    // However overloaded, you can still move.
    const mule = structuredClone(heavy);
    mule.attrs.strength = 1;
    mule.items = { medkit: 40, mine: 40, frag: 40 };
    expect(deriveStats(mule).runSpeed).toBeGreaterThan(1.5);
  });

  it('gear does what its card says', () => {
    const base = soldier({ all: 20 });
    for (const slot of Object.keys(base.loadout.gear)) if (slot !== 'uniform' && slot !== 'boots') base.loadout.gear[slot] = null;
    base.loadout.gear.uniform = 'bdu';
    base.loadout.gear.boots = 'issue';
    const bare = deriveStats(base);
    const slotFor = { helmet: 'helmet', vest: 'vest', uniform: 'uniform', boots: 'boots', gloves: 'gloves', pack: 'pack', device: 'deviceA' };
    for (const gear of Object.values(GEAR)) {
      const save = structuredClone(base);
      save.gearOwned.push(gear.id);
      save.loadout.gear[slotFor[gear.kind]] = gear.id;
      const d = deriveStats(save);
      const label = gear.name;
      for (const [attr, bonus] of Object.entries(gear.attrs ?? {})) expect(d.attrs[attr], `${label} ${attr}`).toBe(bare.attrs[attr] + bonus);
      expect(d.armor, label).toBeCloseTo(bare.armor + (gear.armor ?? 0), 9);
      expect(d.armorHead, label).toBeCloseTo(bare.armorHead + (gear.armorHead ?? 0), 9);
      expect(d.load, label).toBeCloseTo(bare.load + (gear.weight ?? 0), 9);
      expect(d.ammoMul, label).toBeCloseTo(bare.ammoMul * (gear.ammo ?? 1), 9);
      if (gear.carry) expect(d.carry, label).toBeCloseTo(bare.carry + gear.carry, 9);
      if (gear.health) expect(d.maxHealth, label).toBe(bare.maxHealth + gear.health);
      if (gear.nightStealth) expect(d.nightStealth, label).toBeCloseTo(gear.nightStealth, 9);
      if (gear.mantle) expect(d.mantle, label).toBeGreaterThanOrEqual(bare.mantle + gear.mantle - 1e-9);
      if (gear.commandRange) expect(d.commandRange, label).toBeGreaterThanOrEqual(bare.commandRange * gear.commandRange - 1e-9);
      if (gear.tracking) expect(d.tracking, label).toBeCloseTo(bare.tracking + gear.tracking, 9);
      if (gear.planning) expect(d.planning, label).toBeCloseTo(bare.planning + gear.planning, 9);
      if (gear.noise) expect(d.noiseMul, label).toBeLessThan(bare.noiseMul);
      if (gear.speed && !gear.weight) expect(d.runSpeed, label).toBeCloseTo(bare.runSpeed * gear.speed, 6);
      if (gear.enables) expect(d.enables[gear.enables], label).toBe(true);
      if (gear.rangefinder) expect(d.rangefinder, label).toBe(true);
      for (const [item, extra] of Object.entries(gear.extra ?? {})) expect(d.carryLimits[item], `${label} ${item}`).toBe(bare.carryLimits[item] + extra);
      // Every piece of gear that costs money does something.
      if (gear.price > 0) expect(JSON.stringify(numbers(d)) !== JSON.stringify(numbers(bare)) || Object.keys(d.enables).length > 0, `${label} changes nothing`).toBe(true);
    }
    expect(bare.enables).toEqual({});
    expect(bare.armor).toBe(0);
  });

  it('each perk changes what it promises', () => {
    const base = soldier({ spec: 'medic', all: 40 });
    base.spec = 'none';
    const plain = deriveStats(base);
    const as = (spec) => {
      const save = structuredClone(base);
      save.spec = spec;
      return { save, d: deriveStats(save) };
    };
    expect(as('gunner').d.maxHealth).toBe(plain.maxHealth + 25);
    expect(as('medic').d.medkitHeal).toBe(Math.round(plain.medkitHeal * 1.5));
    expect(as('medic').d.bandageHeal).toBe(Math.round(plain.bandageHeal * 1.5));
    expect(as('medic').d.reviveSeconds).toBeCloseTo(Math.max(B.DERIVE.REVIVE.min, plain.reviveSeconds / 2), 9);
    expect(as('marksman').d.breathSeconds).toBeCloseTo(plain.breathSeconds * 1.5, 9);
    expect(as('recon').d.tagSeconds).toBeCloseTo(plain.tagSeconds * 2, 9);
    expect(as('engineer').d.explosiveMul).toBeCloseTo(plain.explosiveMul * 1.3, 9);
    expect(as('engineer').d.plantMul).toBeCloseTo(plain.plantMul / 2, 9);
    expect(as('engineer').d.carryLimits.frag).toBe(plain.carryLimits.frag + 2);
    expect(as('engineer').d.carryLimits.mine).toBe(plain.carryLimits.mine + 2);
    const leader = as('leader').d;
    for (const key of ['acc', 'dmg', 'hp']) expect(leader.aura[key] - 1).toBeCloseTo((plain.aura[key] - 1) * 1.25, 9);
    expect(1 - leader.aura.reaction).toBeCloseTo((1 - plain.aura.reaction) * 1.25, 9);
    expect(leader.aura.transfer).toBeCloseTo(plain.aura.transfer * 1.25, 9);
    expect(leader.supportCooldownMul).toBeCloseTo(plain.supportCooldownMul * 0.8, 9);

    // Weapon perks show in the weapon's own numbers.
    const carbine = { uid: 'wc', id: 'm6', att: {} };
    const lmg = { uid: 'wl', id: 'bulldog', att: {} };
    const plainCarbine = weaponEff(base, carbine, plain);
    const rifleman = as('rifleman');
    const drilled = weaponEff(rifleman.save, carbine, rifleman.d);
    expect(drilled.damage).toBeCloseTo(plainCarbine.damage * 1.1, 9);
    expect(drilled.bloom).toBeCloseTo(0.7, 9);
    expect(plainCarbine.bloom).toBe(1);
    expect(weaponEff(rifleman.save, lmg, rifleman.d).damage).toBeCloseTo(weaponEff(base, lmg, plain).damage, 9);
    const gunner = as('gunner');
    expect(weaponEff(gunner.save, lmg, gunner.d).recoil).toBeCloseTo(weaponEff(base, lmg, plain).recoil * 0.7, 9);
    expect(weaponEff(gunner.save, carbine, gunner.d).recoil).toBeCloseTo(plainCarbine.recoil, 9);
  });

  it('a weapon in hand reflects skill', () => {
    const green = soldier({ all: 10 });
    const veteran = soldier({ all: 80 });
    const a = weaponEff(green, primaryOf(green));
    const b = weaponEff(veteran, primaryOf(veteran));
    expect(a.id).toBe('m6');
    expect(b.spread).toBeLessThan(a.spread);
    expect(b.recoil).toBeLessThan(a.recoil);
    expect(b.reload).toBeLessThan(a.reload);
    expect(b.adsTime).toBeLessThan(a.adsTime);
    expect(b.damage).toBeGreaterThan(a.damage);
    expect(b.sway).toBeLessThan(a.sway);
    expect(a.interval).toBeCloseTo(60 / WEAPONS.m6.rpm, 9);
    expect(a.uid).toBe(primaryOf(green).uid);
    expect(a.reserveMax).toBe(Math.round(WEAPONS.m6.reserve * deriveStats(green).ammoMul));
    // Scope Skill pays off only through glass.
    const marksman = soldier({ spec: 'marksman', all: 30, attrs: { scope: 90 } });
    const novice = soldier({ spec: 'marksman', all: 30 });
    const scoped = primaryOf(marksman);
    expect(weaponEff(marksman, scoped).scoped).toBe(true);
    expect(weaponEff(marksman, scoped).damage).toBeGreaterThan(weaponEff(novice, primaryOf(novice)).damage);
    const pistolA = weaponEff(marksman, secondaryOf(marksman));
    const pistolB = weaponEff(novice, secondaryOf(novice));
    expect(pistolA.damage).toBeCloseTo(pistolB.damage, 9);
    expect(weaponEff(green, { uid: 'zz', id: 'blunderbuss', att: {} })).toBeNull();
    expect(weaponByUid(green, 'nope')).toBeNull();
  });

  it('combat rating rises with level and with better kit', () => {
    const save = soldier({ all: 30 });
    const r0 = deriveStats(save).rating;
    const older = soldier({ all: 30, level: 12 });
    expect(deriveStats(older).rating).toBeGreaterThan(r0);
    const armed = structuredClone(save);
    armed.weapons.push({ uid: 'wx', id: 'spectre', att: { optic: 'holo', muzzle: 'compensator' } });
    armed.loadout.primary = 'wx';
    expect(deriveStats(armed).rating).toBeGreaterThan(r0);
    const armoured = structuredClone(save);
    armoured.gearOwned.push('plate', 'combat');
    armoured.loadout.gear.vest = 'plate';
    armoured.loadout.gear.helmet = 'combat';
    expect(deriveStats(armoured).rating).toBeGreaterThan(r0);
    // The scale the missions are written against: about 100-170 at graduation, several hundred late on.
    for (const spec of SPECS) {
      const rating = deriveStats(soldier({ spec: spec.id })).rating;
      expect(rating, spec.id).toBeGreaterThan(90);
      expect(rating, spec.id).toBeLessThan(200);
    }
    const late = soldier({ all: 70, level: 30 });
    late.weapons.push({ uid: 'wx', id: 'spectre', att: { optic: 'holo', muzzle: 'compensator', under: 'foregrip', mag: 'extmag' } });
    late.loadout.primary = 'wx';
    expect(deriveStats(late).rating).toBeGreaterThan(110 + 55 * 10);
  });

  it('the character sheet has a line for everything, already worked out', () => {
    const save = soldier({ spec: 'leader' });
    const groups = describeDerived(save);
    expect(groups.length).toBeGreaterThanOrEqual(5);
    for (const group of groups) {
      expect(group.name.length).toBeGreaterThan(0);
      expect(group.rows.length).toBeGreaterThan(0);
      for (const row of group.rows) {
        expect(typeof row.label).toBe('string');
        expect(typeof row.value).toBe('string');
        expect(row.value).not.toMatch(/NaN|undefined|Infinity/);
        expect(row.from.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('experience and practice', () => {
  it('each level needs more experience than the last', () => {
    expect(xpForLevel(1)).toBe(0);
    let gap = 0;
    for (let level = 2; level <= B.XP.LEVEL_CAP; level++) {
      const step = xpForLevel(level) - xpForLevel(level - 1);
      expect(step).toBeGreaterThan(gap);
      gap = step;
      expect(levelForXp(xpForLevel(level))).toBe(level);
      expect(levelForXp(xpForLevel(level) - 1)).toBe(level - 1);
    }
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(1e9)).toBe(B.XP.LEVEL_CAP);
  });

  it('experience levels you up and banks three points a level', () => {
    const save = soldier({ all: 20 });
    const report = addXp(save, xpForLevel(4), { raw: true });
    expect(report.gained).toBe(xpForLevel(4));
    expect(report.levels).toBe(3);
    expect(save.level).toBe(4);
    expect(save.points).toBe(3 * B.ATTR.POINTS_PER_LEVEL);
    expect(addXp(save, 1, { raw: true }).levels).toBe(0);
    expect(addXp(save, -50, { raw: true }).gained).toBe(0);
    const progress = levelProgress(save);
    expect(progress.share).toBeGreaterThanOrEqual(0);
    expect(progress.share).toBeLessThan(1);
    expect(progress.next).toBe(xpForLevel(5));
    // The cap holds.
    addXp(save, 1e7, { raw: true });
    expect(save.level).toBe(B.XP.LEVEL_CAP);
    expect(save.points).toBe((B.XP.LEVEL_CAP - 1) * B.ATTR.POINTS_PER_LEVEL);
    expect(levelProgress(save).share).toBe(1);
    expect(addXp(save, 5000, { raw: true }).levels).toBe(0);
  });

  it('Intelligence earns experience faster', () => {
    const dull = soldier({ all: 20, attrs: { intelligence: 5 } });
    const sharp = soldier({ all: 20, attrs: { intelligence: 80 } });
    expect(addXp(dull, 1000).gained).toBe(Math.round(1000 * (1 + 5 * B.DERIVE.XP_MUL.intelligence)));
    expect(addXp(sharp, 1000).gained).toBe(Math.round(1000 * (1 + 80 * B.DERIVE.XP_MUL.intelligence)));
    expect(A.gainXp(soldier({ all: 20 }), { amount: 100, raw: true }).gained).toBe(100);
  });

  it('points cost more as an attribute climbs', () => {
    expect(pointCost(5)).toBe(1);
    expect(pointCost(49)).toBe(1);
    expect(pointCost(50)).toBe(2);
    expect(pointCost(74)).toBe(2);
    expect(pointCost(75)).toBe(3);
    expect(pointCost(99)).toBe(3);
    expect(pointCost(100)).toBe(Infinity);
  });

  it('spending a point raises the attribute and is refused without the points', () => {
    const save = soldier({ all: 20 });
    expect(refusal(() => A.spendPoint(save, { attr: 'accuracy' }))).toMatch(/No attribute points/);
    save.points = 4;
    expect(A.spendPoint(save, { attr: 'accuracy' })).toEqual({ attr: 'accuracy', value: 21, cost: 1 });
    expect(save.points).toBe(3);
    save.attrs.stealth = 60;
    A.spendPoint(save, { attr: 'stealth' });
    expect(save.attrs.stealth).toBe(61);
    expect(save.points).toBe(1);
    expect(refusal(() => A.spendPoint(save, { attr: 'stealth' }))).toMatch(/costs 2/);
    save.attrs.speed = 100;
    save.points = 50;
    expect(refusal(() => A.spendPoint(save, { attr: 'speed' }))).toMatch(/limit/);
    expect(refusal(() => A.spendPoint(save, { attr: 'charisma' }))).toMatch(/No such/);
    expect(save.points).toBe(50);
  });

  it('practice gets harder as you get better', () => {
    for (let value = 1; value < 100; value++) expect(practiceNeed(value + 1)).toBeGreaterThan(practiceNeed(value));
    // Early points come in a mission or two; the last ones take a campaign.
    expect(practiceNeed(10)).toBeLessThan(30);
    expect(practiceNeed(90)).toBeGreaterThan(200);
  });

  it('practice honours a specialization’s affinity and Intelligence', () => {
    const save = soldier({ spec: 'rifleman', all: 30 });
    const mul = deriveStats(save).practiceMul;
    expect(mul).toBeCloseTo(1 + 30 * B.DERIVE.PRACTICE_MUL.intelligence, 9);
    const ups = applyPractice(save, { accuracy: 2, stealth: 2 });
    expect(ups).toEqual([]);
    expect(save.practice.accuracy).toBeCloseTo(2 * B.ATTR.AFFINITY * mul, 9);
    expect(save.practice.stealth).toBeCloseTo(2 * mul, 9);
    const sharp = soldier({ spec: 'rifleman', all: 30, attrs: { intelligence: 90 } });
    applyPractice(sharp, { stealth: 2 });
    expect(sharp.practice.stealth).toBeCloseTo(2 * (1 + 90 * B.DERIVE.PRACTICE_MUL.intelligence), 9);
    expect(sharp.practice.stealth).toBeGreaterThan(save.practice.stealth);
  });

  it('practice raises the attribute, carries the remainder and stops at 100', () => {
    const save = soldier({ spec: 'rifleman', all: 10 });
    const mul = deriveStats(save).practiceMul;
    const need = practiceNeed(10);
    const ups = applyPractice(save, { stealth: (need + 3) / mul });
    expect(ups).toEqual([{ attr: 'stealth', from: 10, to: 11 }]);
    expect(save.attrs.stealth).toBe(11);
    expect(save.practice.stealth).toBeCloseTo(3, 6);
    expect(practiceShare(save, 'stealth')).toBeCloseTo(3 / practiceNeed(11), 6);

    // A big day can be worth several points at once.
    const big = applyPractice(save, { stealth: 400 });
    expect(big.length).toBe(1);
    expect(big[0].to).toBeGreaterThan(13);
    expect(save.attrs.stealth).toBe(big[0].to);
    expect(save.practice.stealth).toBeLessThan(practiceNeed(save.attrs.stealth));

    save.attrs.speed = 99;
    applyPractice(save, { speed: 1e6 });
    expect(save.attrs.speed).toBe(ATTR_MAX);
    expect(save.practice.speed).toBe(0);
    expect(practiceShare(save, 'speed')).toBe(1);
    expect(applyPractice(save, { speed: 1e6 })).toEqual([]);
    expect(save.attrs.speed).toBe(ATTR_MAX);

    // Nonsense is ignored.
    const before = structuredClone(save);
    expect(applyPractice(save, { charisma: 50, accuracy: -5, vision: 0, stealth: NaN })).toEqual([]);
    expect(applyPractice(save, undefined)).toEqual([]);
    expect(save.attrs).toEqual(before.attrs);
    expect(save.practice).toEqual(before.practice);
    expect(A.practice(save, { gains: { vision: 500 } }).ups[0].attr).toBe('vision');
  });
});

describe('ranks', () => {
  it('the ladder only climbs', () => {
    expect(RANKS.length).toBe(14);
    expect(RANKS[0].id).toBe('rct');
    expect(RANKS[RANKS.length - 1].id).toBe('col');
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].xp).toBeGreaterThanOrEqual(RANKS[i - 1].xp);
      expect(RANKS[i].squad).toBeGreaterThanOrEqual(RANKS[i - 1].squad);
      expect(RANKS[i].tier).toBeGreaterThanOrEqual(RANKS[i - 1].tier);
      expect(RANKS[i].pay).toBeGreaterThanOrEqual(RANKS[i - 1].pay);
      expect((RANKS[i].supports ?? []).length).toBeGreaterThanOrEqual((RANKS[i - 1].supports ?? []).length);
      expect(RANK_INDEX[RANKS[i].id]).toBe(i);
      for (const support of RANKS[i].supports ?? []) expect(SUPPORTS[support], support).toBeTruthy();
      expect(RANKS[i].duty.length).toBeGreaterThan(0);
    }
    // From Private on, every promotion past the first few takes real experience.
    for (let i = 3; i < RANKS.length; i++) expect(RANKS[i].xp).toBeGreaterThan(RANKS[i - 1].xp);
    // The flags a rank waits for are ones the game can actually set.
    const settable = new Set(['graduated', ...STORY.map((m) => m.grants).filter(Boolean)]);
    for (const rank of RANKS) if (rank.needs) expect(settable.has(rank.needs), rank.needs).toBe(true);
  });

  it('a promotion needs the experience and, where it says so, the milestone', () => {
    const save = soldier();
    expect(promotionDue(save)).toBeNull();
    save.xp = RANKS[RANK_INDEX.pfc].xp - 1;
    expect(promotionDue(save)).toBeNull();
    save.xp = RANKS[RANK_INDEX.pfc].xp;
    expect(promotionDue(save)).toBe(RANK_INDEX.pfc);
    save.xp = RANKS[RANK_INDEX.sgt].xp + 10;
    expect(promotionDue(save)).toBe(RANK_INDEX.sgt);
    // No commission, no bars, however much experience.
    save.xp = 1e6;
    expect(promotionDue(save)).toBe(RANK_INDEX.msg);
    expect(nextRankGap({ ...save, rank: RANK_INDEX.msg })).toMatchObject({ xpLeft: 0, needs: 'commissioned' });
    save.story.flags.commissioned = true;
    expect(promotionDue(save)).toBe(RANK_INDEX.col);
    save.rank = RANK_INDEX.col;
    expect(promotionDue(save)).toBeNull();
    expect(nextRankGap(save)).toBeNull();
    // A recruit is nobody's Private until graduation.
    const cadet = trained('rifleman');
    cadet.xp = 5000;
    expect(promotionDue(cadet)).toBeNull();
    const gap = nextRankGap(soldier());
    expect(gap.rank.id).toBe('pfc');
    expect(gap.xpLeft).toBe(RANKS[RANK_INDEX.pfc].xp);
    expect(gap.needs).toBeNull();
  });

  it('being promoted pays a bonus, and a new Corporal is given a first soldier', () => {
    const save = soldier();
    expect(refusal(() => A.promote(save, { now: NOW }))).toMatch(/No promotion/);
    save.xp = RANKS[RANK_INDEX.pfc].xp;
    const rp = save.rp;
    const first = A.promote(save, { now: NOW });
    expect(first.from).toBe(RANK_INDEX.pvt);
    expect(first.to).toBe(RANK_INDEX.pfc);
    expect(first.rank.name).toBe('Private First Class');
    expect(first.bonus).toBeGreaterThan(0);
    expect(save.rp).toBe(rp + first.bonus);
    expect(first.recruit).toBeNull();
    expect(save.squad.roster.length).toBe(0);

    save.xp = RANKS[RANK_INDEX.cpl].xp;
    const second = A.promote(save, { now: NOW });
    expect(save.rank).toBe(RANK_INDEX.cpl);
    expect(second.recruit).toBeTruthy();
    expect(save.squad.roster.length).toBe(1);
    expect(save.squad.active).toEqual([second.recruit.id]);
    expect(second.recruit.status).toBe('ready');
    expect(refusal(() => A.promote(save, { now: NOW }))).toMatch(/No promotion/);
    // A later promotion does not hand out another.
    save.xp = RANKS[RANK_INDEX.sgt].xp;
    expect(A.promote(save, { now: NOW }).recruit).toBeNull();
    expect(save.squad.roster.length).toBe(1);
    expect(save.log.filter((entry) => /Promoted to/.test(entry.text)).length).toBeGreaterThanOrEqual(3);
  });

  it('several ranks earned at once are given at once', () => {
    const save = soldier();
    save.xp = RANKS[RANK_INDEX.ssg].xp;
    const report = A.promote(save, { now: NOW });
    expect(report.to).toBe(RANK_INDEX.ssg);
    expect(save.rank).toBe(RANK_INDEX.ssg);
    expect(report.recruit).toBeTruthy();
  });

  it('squad size grows with rank, and a Born Leader leads one more', () => {
    const rifleman = soldier({ spec: 'rifleman' });
    const leader = soldier({ spec: 'leader' });
    let last = 0;
    for (let rank = 0; rank < RANKS.length; rank++) {
      rifleman.rank = rank;
      leader.rank = rank;
      expect(squadCap(rifleman)).toBe(RANKS[rank].squad);
      expect(squadCap(rifleman)).toBeGreaterThanOrEqual(last);
      last = squadCap(rifleman);
      expect(squadCap(leader)).toBe(rank >= 1 ? Math.min(8, RANKS[rank].squad + 1) : 0);
    }
    expect(RANKS.map((r) => r.squad)).toEqual([0, 0, 0, 1, 3, 4, 5, 6, 7, 7, 7, 7, 7, 7]);
  });
});
