// Decorations: awarded once, shown on the service record. Each pays a small bonus when earned.

export const MEDALS = [
  { id: 'graduate', name: 'Basic Training Ribbon', text: 'Graduated from Camp Hawthorne.', rp: 0, test: (s) => s.training.graduated },
  { id: 'honor', name: 'Honor Graduate', text: 'Top of the training cycle.', rp: 0, test: (s) => s.training.honors },
  { id: 'first_blood', name: 'Combat Action Badge', text: 'Completed a first operation.', rp: 100, test: (s) => s.stats.missions >= 1 },
  { id: 'marksman', name: 'Marksman’s Badge', text: '25 headshots.', rp: 300, test: (s) => s.stats.headshots >= 25 },
  { id: 'longshot', name: 'Long Rifle Tab', text: 'A kill from beyond 300 metres.', rp: 400, test: (s) => s.stats.longestShot >= 300 },
  { id: 'ghost', name: 'Shadow Bar', text: '20 silent takedowns.', rp: 400, test: (s) => s.stats.stealthKills >= 20 },
  { id: 'rescuer', name: 'Lifeline Medal', text: 'Brought 10 captives home.', rp: 500, test: (s) => s.stats.rescued >= 10 },
  { id: 'captor', name: 'Provost’s Commendation', text: 'Took 3 targets alive.', rp: 500, test: (s) => s.stats.captured >= 3 },
  { id: 'veteran', name: 'Campaign Star', text: '20 operations completed.', rp: 800, test: (s) => s.stats.missions >= 20 },
  { id: 'leader', name: 'Leadership Cross', text: 'Your squad accounted for 100 of the enemy.', rp: 800, test: (s) => s.stats.squadKills >= 100 },
  { id: 'anvil', name: 'Anvil Clasp', text: 'Took and held Fort Anvil.', rp: 0, test: (s) => s.story.done.includes('hammer_and_anvil') },
  { id: 'liberator', name: 'Liberation Medal', text: 'Took the Citadel and ended the war.', rp: 0, test: (s) => s.story.done.includes('iron_dawn') },
];

export const medalOf = (id) => MEDALS.find((m) => m.id === id) ?? null;

// Awards any medal newly earned; returns the new ones.
export function awardMedals(save) {
  const fresh = [];
  for (const medal of MEDALS) {
    if (save.medals.includes(medal.id) || !medal.test(save)) continue;
    save.medals.push(medal.id);
    save.rp += medal.rp;
    fresh.push(medal);
  }
  return fresh;
}
