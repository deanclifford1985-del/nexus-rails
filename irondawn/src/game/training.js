// Basic training: five evaluations at Camp Hawthorne. Each one scores 0 to 100 and that score
// sets part of the recruit's baseline attributes. The simulation runs the events; this file only
// turns what happened into a score and the score into attribute gains.

import { B, clamp } from './balance.js';

export const EVENTS = [
  {
    id: 'range',
    name: 'Rifle Qualification',
    place: 'Firing Range',
    instructor: 'Range Master Okoro',
    sets: ['accuracy', 'scope', 'quickness'],
    brief: 'Eighteen pop-up targets from 25 to 150 metres with the training carbine, then six long targets through a scope. Each target is only up for a moment.',
    tips: ['Right mouse button aims. Aimed shots are far tighter than firing from the hip.', 'Crouch (C) to steady yourself.', 'For the long targets hold Shift to hold your breath.'],
  },
  {
    id: 'obstacle',
    name: 'Confidence Course',
    place: 'Obstacle Course',
    instructor: 'Sergeant Vasquez',
    sets: ['speed', 'endurance', 'climbing', 'quickness', 'strength', 'toughness'],
    brief: 'A timed run: sprint lane, hurdles, the low crawl, the wall and the long drag to the line. Pass every gate in order.',
    tips: ['Shift sprints. Watch your stamina: an empty bar means a slow finish.', 'Space jumps hurdles and pulls you up the wall.', 'Z goes prone for the crawl under the wire.'],
  },
  {
    id: 'stealth',
    name: 'Infiltration Lane',
    place: 'The Woodline',
    instructor: 'Sergeant Ilves',
    sets: ['stealth', 'perception', 'quickness'],
    brief: 'Cross the woodline and touch the flag without the sentries spotting you. Three strikes and the lane is over.',
    tips: ['Crouch (C) or go prone (Z). Slow is quiet.', 'Stay out of the cone in front of a sentry and use the brush.', 'The eye above your crosshair fills as someone notices you. Break line of sight and it drains.'],
  },
  {
    id: 'observation',
    name: 'Observation Post',
    place: 'Lookout Hill',
    instructor: 'Corporal Dane',
    sets: ['vision', 'perception', 'intelligence'],
    brief: 'Eight camouflaged dummies are hidden in the valley below. Find and tag as many as you can before time runs out.',
    tips: ['B raises your binoculars.', 'Hold the centre mark on a dummy for a moment to tag it.', 'Look for straight lines and odd colours at the edges of brush.'],
  },
  {
    id: 'exam',
    name: 'Field Leadership Exam',
    place: 'Classroom Tent',
    instructor: 'Lieutenant Sato',
    sets: ['intelligence', 'medicine', 'engineering', 'leadership', 'communication', 'negotiating'],
    brief: 'Eight questions on tactics, first aid, demolitions, radio procedure and handling people. There is always a best answer and usually a second-best.',
    tips: ['Read all four answers. The quick answer is rarely the right one.'],
  },
];

const BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
export const eventOf = (id) => BY_ID[id] ?? null;

export function gradeFor(score) {
  for (const [at, name] of B.TRAINING.GRADES) if (score >= at) return name;
  return 'Marginal';
}

// ---------- scoring ----------
// Each returns { score, parts } where parts are 0..1 shares used to split the attribute gains.

export function scoreRange({ hits = 0, total = B.TRAINING.RANGE_TARGETS, longHits = 0, longTotal = B.TRAINING.RANGE_LONG, avgReact = 2 }) {
  const near = clamp(hits / Math.max(1, total), 0, 1);
  const far = clamp(longHits / Math.max(1, longTotal), 0, 1);
  // Reaction: a hit inside 0.8 s is perfect, the full 2.6 s is nothing.
  const quick = clamp(1 - (avgReact - 0.8) / (B.TRAINING.RANGE_SHOW - 0.8), 0, 1);
  const score = Math.round((near * 0.6 + far * 0.3 + quick * 0.1) * 100);
  return { score, parts: { accuracy: near, scope: far, quickness: quick } };
}

export function scoreObstacle({ time, faults = 0, finished = true, staminaLeft = 0.5 }) {
  if (!finished) return { score: 0, parts: { speed: 0, endurance: 0, climbing: 0, quickness: 0, strength: 0, toughness: 0 } };
  const { OBSTACLE_PAR: par, OBSTACLE_SLOW: slow } = B.TRAINING;
  const pace = clamp(1 - (time - par) / (slow - par), 0, 1);
  const clean = clamp(1 - faults * 0.12, 0, 1);
  const score = Math.round(clamp(pace * 0.85 + clean * 0.15, 0, 1) * 100);
  return {
    score,
    parts: { speed: pace, endurance: clamp(pace * 0.7 + staminaLeft * 0.3, 0, 1), climbing: clamp(pace * 0.6 + clean * 0.4, 0, 1), quickness: clean, strength: pace, toughness: clamp(0.4 + pace * 0.6, 0, 1) },
  };
}

export function scoreStealth({ reached = false, strikes = 0, peak = 0, time = 120 }) {
  // peak is the highest awareness any sentry reached on a clean pass (0..1).
  const base = reached ? 1 : 0.25;
  const clean = clamp(1 - strikes / B.TRAINING.STEALTH_STRIKES, 0, 1);
  const quiet = clamp(1 - peak * 0.5, 0.5, 1);
  const brisk = clamp(1 - (time - 90) / 240, 0.6, 1);
  const score = Math.round(clamp(base * (clean * 0.75 + 0.25) * quiet * brisk, 0, 1) * 100);
  return { score, parts: { stealth: score / 100, perception: clamp(quiet * clean, 0, 1), quickness: brisk * (reached ? 1 : 0.3) } };
}

export function scoreObservation({ found = 0, total = B.TRAINING.OBSERVE_TARGETS, timeLeft = 0 }) {
  const share = clamp(found / Math.max(1, total), 0, 1);
  const early = found >= total ? clamp(timeLeft / B.TRAINING.OBSERVE_SECONDS, 0, 1) : 0;
  const score = Math.round(clamp(share * 0.9 + early * 0.2, 0, 1) * 100);
  return { score, parts: { vision: share, perception: clamp(share * 0.8 + early * 0.4, 0, 1), intelligence: share } };
}

// ---------- the written exam ----------
// Each option carries points for the attributes it shows. `best` marks the instructor's answer.
export const EXAM = [
  {
    id: 'ambush',
    topic: 'Tactics',
    q: 'Your patrol walks into a near ambush: fire from the treeline ten metres to your left. What do you do?',
    options: [
      { text: 'Turn into the fire and assault through the ambush at once.', pts: { intelligence: 2, leadership: 1 }, best: true },
      { text: 'Drop where you are and return fire until it stops.', pts: { intelligence: 1 } },
      { text: 'Run forward along the trail to get out of the kill zone.', pts: {} },
      { text: 'Fall back the way you came and call for support.', pts: { communication: 1 } },
    ],
    why: 'At that distance the kill zone is where you stand. The only way out is through them.',
  },
  {
    id: 'bleed',
    topic: 'First aid',
    q: 'A soldier takes a round through the thigh and the blood is bright and pulsing. First action?',
    options: [
      { text: 'Tourniquet high and tight above the wound, then note the time.', pts: { medicine: 2, intelligence: 1 }, best: true },
      { text: 'Pressure dressing on the wound and elevate the leg.', pts: { medicine: 1 } },
      { text: 'Give water and keep the soldier talking until the medic arrives.', pts: {} },
      { text: 'Carry the soldier to the aid post as fast as you can.', pts: { leadership: 1 } },
    ],
    why: 'Arterial bleeding kills in minutes. Stop it first; everything else can wait.',
  },
  {
    id: 'radio',
    topic: 'Radio procedure',
    q: 'You need mortar fire on an enemy position. What does the fire mission need first?',
    options: [
      { text: 'Who you are, where the target is, what it is, and where friendlies are.', pts: { communication: 2, intelligence: 1 }, best: true },
      { text: 'The target location, repeated twice so there is no mistake.', pts: { communication: 1 } },
      { text: 'A request to speak to the fire direction officer.', pts: {} },
      { text: 'How many rounds you want and how fast.', pts: { communication: 1 } },
    ],
    why: 'A short, complete call. The guns cannot ask questions while you are being shot at.',
  },
  {
    id: 'charge',
    topic: 'Demolitions',
    q: 'You are setting a breaching charge on a steel door. Where does the team stand?',
    options: [
      { text: 'Stacked on the hinge side, backs to the wall, clear of the door’s swing.', pts: { engineering: 2, leadership: 1 }, best: true },
      { text: 'Directly in front, far enough back to see the door.', pts: {} },
      { text: 'Around the corner, wherever each soldier finds cover.', pts: { engineering: 1 } },
      { text: 'Close on both sides so everyone enters at once.', pts: { leadership: 1 } },
    ],
    why: 'The blast and the door both go outward. Stay out of the line and stay together.',
  },
  {
    id: 'elder',
    topic: 'Dealing with people',
    q: 'A village elder will not tell you where the fighters went. His people are watching. What do you say?',
    options: [
      { text: 'Ask what the village needs, offer what you can honestly give, and let him decide.', pts: { negotiating: 2, communication: 1 }, best: true },
      { text: 'Explain plainly that hiding fighters puts his village in danger.', pts: { negotiating: 1, leadership: 1 } },
      { text: 'Tell him you will search every house until someone talks.', pts: {} },
      { text: 'Thank him, leave, and watch the village from the ridge.', pts: { intelligence: 1, negotiating: 1 } },
    ],
    why: 'He cannot be seen to give in. Give him a reason he can defend to his own people.',
  },
  {
    id: 'private',
    topic: 'Leadership',
    q: 'Your best rifleman freezes in his first firefight and afterwards will not look at anyone. What do you do?',
    options: [
      { text: 'Talk to him alone, tell him it happens, and put him next to you on the next patrol.', pts: { leadership: 2, communication: 1 }, best: true },
      { text: 'Say nothing. He will sort himself out.', pts: {} },
      { text: 'Address it in front of the squad so nobody else does the same.', pts: { leadership: 1 } },
      { text: 'Report him to the platoon sergeant for reassignment.', pts: { communication: 1 } },
    ],
    why: 'Fix it privately and show him he is still trusted. A squad watches how its leader treats its worst day.',
  },
  {
    id: 'route',
    topic: 'Planning',
    q: 'Two routes to the objective: a road that takes twenty minutes, or a ridge that takes an hour and cannot be seen from the enemy camp. You have until dawn. Which?',
    options: [
      { text: 'The ridge. Time is the one thing you have plenty of.', pts: { intelligence: 2, leadership: 1 }, best: true },
      { text: 'The road, fast, before they can react.', pts: {} },
      { text: 'Split the squad and take both.', pts: { leadership: 1 } },
      { text: 'The road, with a scout sent ahead.', pts: { intelligence: 1, communication: 1 } },
    ],
    why: 'Spend what you have spare to buy what you lack. Here that is time for surprise.',
  },
  {
    id: 'surrender',
    topic: 'Dealing with people',
    q: 'A wounded enemy soldier is behind a wall, rifle beside him, shouting that he gives up. What now?',
    options: [
      { text: 'Tell him, slowly and loudly, to push the rifle away and show his hands. Cover him while one soldier moves in.', pts: { negotiating: 2, leadership: 1 }, best: true },
      { text: 'Walk over and take the rifle.', pts: {} },
      { text: 'Keep everyone back and wait for him to come out.', pts: { negotiating: 1 } },
      { text: 'Have the medic go to him first.', pts: { medicine: 1 } },
    ],
    why: 'Clear words, one instruction at a time, and nobody takes a risk they do not need to. A prisoner is worth more than a body.',
  },
];

// answers: { questionId: optionIndex }. Returns score, gains per attribute and the marked paper.
export function scoreExam(answers) {
  const gains = {};
  let best = 0;
  const marked = EXAM.map((question) => {
    const index = answers?.[question.id];
    const option = question.options[index] ?? null;
    for (const [attr, pts] of Object.entries(option?.pts ?? {})) gains[attr] = (gains[attr] ?? 0) + pts;
    if (option?.best) best++;
    return { id: question.id, chosen: index ?? null, best: question.options.findIndex((o) => o.best), right: !!option?.best, why: question.why };
  });
  const earned = Object.values(gains).reduce((sum, pts) => sum + pts, 0);
  const possible = EXAM.reduce((sum, q) => sum + Object.values(q.options.find((o) => o.best).pts).reduce((s, p) => s + p, 0), 0);
  const score = Math.round(clamp(earned / possible, 0, 1) * 100);
  return { score, best, gains, marked };
}

// ---------- score -> attributes ----------
const TABLE = { range: 'RANGE', obstacle: 'OBSTACLE', stealth: 'STEALTH', observation: 'OBSERVATION' };

// What an evaluation adds to the baseline. `result` is what a score* function returned.
export function trainingBonuses(eventId, result) {
  if (eventId === 'exam') {
    const out = {};
    for (const [attr, pts] of Object.entries(result.gains ?? {})) out[attr] = Math.round(pts * B.TRAINING.EXAM_POINT);
    return out;
  }
  const caps = B.TRAINING[TABLE[eventId]];
  if (!caps) return {};
  const out = {};
  for (const [attr, cap] of Object.entries(caps)) out[attr] = Math.round(cap * clamp(result.parts?.[attr] ?? result.score / 100, 0, 1));
  return out;
}

export function trainingSummary(save) {
  const results = save.training?.results ?? {};
  const done = EVENTS.filter((e) => results[e.id]);
  const average = done.length ? Math.round(done.reduce((sum, e) => sum + results[e.id].score, 0) / done.length) : 0;
  return {
    done: done.length,
    total: EVENTS.length,
    complete: done.length === EVENTS.length,
    average,
    honors: done.length === EVENTS.length && average >= B.TRAINING.HONORS,
    remaining: EVENTS.filter((e) => !results[e.id]).map((e) => e.id),
  };
}
