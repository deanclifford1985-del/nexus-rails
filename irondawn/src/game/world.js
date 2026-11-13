// The island of Corvane as data: how big it is, where everything stands and how the roads run.
// North is -z, east is +x, one unit is one metre. The simulation (sim/terrain.js, sim/worldgen.js)
// turns this into ground and buildings; the map screen draws from the same list.

export const WORLD = {
  size: 2400, // metres across
  half: 1200,
  cell: 8, // metres between terrain samples
  seed: 20261113,
  coast: 1120, // rough radius of the island
  front: 120, // z of the front line: the Legion holds everything north of it
};

// layout names a builder in sim/worldgen.js. side is who holds it when the story begins.
export const LOCATIONS = [
  { id: 'hawthorne', name: 'Camp Hawthorne', kind: 'base', x: -260, z: 640, r: 190, side: 'ally', layout: 'base', text: 'Basic training and the island’s headquarters.' },
  { id: 'halden', name: 'Port Halden', kind: 'town', x: 150, z: 900, r: 85, side: 'ally', layout: 'port', text: 'The southern harbour. Everything the island eats comes through here.' },
  { id: 'echo', name: 'Checkpoint Echo', kind: 'checkpoint', x: -80, z: 250, r: 62, side: 'ally', layout: 'checkpoint', text: 'The last friendly post on the north road.' },
  { id: 'brightwater', name: 'Brightwater', kind: 'village', x: 340, z: 390, r: 90, side: 'ally', layout: 'village', text: 'A farming village a short walk from the front.' },
  { id: 'sawmill', name: 'Sawmill Camp', kind: 'camp', x: 470, z: 30, r: 78, side: 'enemy', tier: 1, layout: 'sawmill', text: 'A Legion patrol base in the eastern woods.' },
  { id: 'relay', name: 'Relay Hill', kind: 'outpost', x: -560, z: 80, r: 58, side: 'enemy', tier: 2, layout: 'relay', text: 'A radio relay on the western heights.' },
  { id: 'quarry', name: 'Karst Quarry', kind: 'camp', x: -690, z: -320, r: 92, side: 'enemy', tier: 3, layout: 'quarry', text: 'The Legion’s stores, dug into an old quarry.' },
  { id: 'villa', name: 'Lakeside Villa', kind: 'estate', x: 250, z: -400, r: 62, side: 'enemy', tier: 4, layout: 'villa', text: 'An officer’s residence on the north shore of Lake Miren.' },
  { id: 'anvil', name: 'Fort Anvil', kind: 'fort', x: -170, z: -500, r: 98, side: 'enemy', tier: 4, layout: 'fort', text: 'An old stone fort commanding the north road.' },
  { id: 'depot', name: 'Fuel Depot', kind: 'depot', x: 800, z: -90, r: 82, side: 'enemy', tier: 5, layout: 'depot', text: 'Fuel for every Legion vehicle on the island.' },
  { id: 'stonebridge', name: 'Stonebridge', kind: 'village', x: 620, z: -410, r: 92, side: 'enemy', tier: 6, layout: 'village2', text: 'An occupied village in the north-east.' },
  { id: 'highcrag', name: 'Highcrag Camp', kind: 'camp', x: 390, z: -780, r: 74, side: 'enemy', tier: 7, layout: 'powcamp', text: 'A prison camp high in the northern range.' },
  { id: 'grayport', name: 'Grayport', kind: 'harbor', x: -790, z: -660, r: 96, side: 'enemy', tier: 8, layout: 'harbor', text: 'The Legion’s harbour and the way their supplies arrive.' },
  { id: 'citadel', name: 'The Citadel', kind: 'fortress', x: -20, z: -880, r: 125, side: 'enemy', tier: 10, layout: 'citadel', text: 'General Drach’s headquarters.' },
];

export const LAKES = [{ id: 'miren', name: 'Lake Miren', x: 90, z: -250, r: 135 }];

// Roads as lists of location ids or [x, z] points.
export const ROADS = [
  ['halden', [10, 800], 'hawthorne'],
  ['hawthorne', [-190, 440], 'echo'],
  ['echo', [120, 300], 'brightwater'],
  ['brightwater', [430, 220], 'sawmill'],
  ['echo', [-330, 190], 'relay'],
  ['echo', [-110, 40], [-180, -200], [-190, -380], 'anvil'],
  ['anvil', [-420, -420], 'quarry'],
  ['quarry', [-760, -500], 'grayport'],
  ['anvil', [-110, -690], 'citadel'],
  ['sawmill', [650, 0], 'depot'],
  ['sawmill', [560, -200], 'stonebridge'],
  ['stonebridge', [520, -610], 'highcrag'],
  [[-180, -200], [60, -330], 'villa'],
  ['villa', [440, -420], 'stonebridge'],
];

const BY_ID = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));
export const locationOf = (id) => BY_ID[id] ?? null;

// Who holds a location now: the story moves some from the Legion to you.
export function sideOf(save, id) {
  const loc = BY_ID[id];
  if (!loc) return 'none';
  if (save?.world?.liberated?.[id]) return 'ally';
  return loc.side;
}

export const KIND_NAMES = {
  base: 'Headquarters',
  town: 'Town',
  checkpoint: 'Checkpoint',
  village: 'Village',
  camp: 'Legion camp',
  outpost: 'Legion outpost',
  estate: 'Estate',
  fort: 'Fort',
  depot: 'Depot',
  harbor: 'Harbour',
  fortress: 'Fortress',
};

// Places you can be flown to: headquarters always, anything you hold once you have been there.
export function travelPoints(save) {
  return LOCATIONS.filter((loc) => sideOf(save, loc.id) === 'ally' && (loc.id === 'hawthorne' || save.world.discovered?.[loc.id]));
}

export const compassName = (degrees) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
