import { B } from './balance.js';
import { randInt, randRange } from './rng.js';

// The rail map: real cities joined by rail lines across the United States. Each line has its
// terrain (Gulf lines flood, the Southwest bakes, the Rockies and the Northeast freeze) and the rail
// reputation it needs before jobs are posted on it. Express routes run city to city over several
// lines, a leg at a time, for a big bonus at the end.

export const CITIES = {
  seattle: { name: 'Seattle', lon: -122.33, lat: 47.61 },
  sanfrancisco: { name: 'San Francisco', lon: -122.42, lat: 37.77 },
  losangeles: { name: 'Los Angeles', lon: -118.24, lat: 34.05 },
  phoenix: { name: 'Phoenix', lon: -112.07, lat: 33.45 },
  saltlake: { name: 'Salt Lake City', lon: -111.89, lat: 40.76 },
  denver: { name: 'Denver', lon: -104.99, lat: 39.74 },
  albuquerque: { name: 'Albuquerque', lon: -106.65, lat: 35.08 },
  elpaso: { name: 'El Paso', lon: -106.49, lat: 31.76 },
  dallas: { name: 'Dallas', lon: -96.8, lat: 32.78 },
  houston: { name: 'Houston', lon: -95.37, lat: 29.76 },
  neworleans: { name: 'New Orleans', lon: -90.07, lat: 29.95 },
  kansascity: { name: 'Kansas City', lon: -94.58, lat: 39.1 },
  omaha: { name: 'Omaha', lon: -95.94, lat: 41.26 },
  minneapolis: { name: 'Minneapolis', lon: -93.27, lat: 44.98 },
  chicago: { name: 'Chicago', lon: -87.63, lat: 41.88 },
  stlouis: { name: 'St. Louis', lon: -90.2, lat: 38.63 },
  memphis: { name: 'Memphis', lon: -90.05, lat: 35.15 },
  atlanta: { name: 'Atlanta', lon: -84.39, lat: 33.75 },
  jacksonville: { name: 'Jacksonville', lon: -81.66, lat: 30.33 },
  miami: { name: 'Miami', lon: -80.19, lat: 25.76 },
  charlotte: { name: 'Charlotte', lon: -80.84, lat: 35.23 },
  washington: { name: 'Washington', lon: -77.04, lat: 38.9 },
  pittsburgh: { name: 'Pittsburgh', lon: -80.0, lat: 40.44 },
  newyork: { name: 'New York', lon: -74.0, lat: 40.71 },
  boston: { name: 'Boston', lon: -71.06, lat: 42.36 },
};

// [from, to, terrain, rail reputation needed]
const LINE_LIST = [
  // The heartland: open from day one.
  ['chicago', 'stlouis', 'plains', 0],
  ['stlouis', 'kansascity', 'plains', 0],
  ['kansascity', 'omaha', 'plains', 0],
  ['omaha', 'chicago', 'plains', 0],
  ['chicago', 'minneapolis', 'snow', 0],
  ['stlouis', 'memphis', 'flooded', 0],
  ['kansascity', 'dallas', 'plains', 0],
  ['dallas', 'houston', 'flooded', 0],
  ['memphis', 'atlanta', 'plains', 0],
  ['chicago', 'pittsburgh', 'plains', 0],
  // The coasts and the Gulf.
  ['houston', 'neworleans', 'flooded', 150],
  ['neworleans', 'memphis', 'flooded', 150],
  ['atlanta', 'charlotte', 'plains', 150],
  ['charlotte', 'washington', 'plains', 150],
  ['pittsburgh', 'washington', 'snow', 150],
  ['washington', 'newyork', 'plains', 150],
  ['newyork', 'boston', 'snow', 150],
  ['atlanta', 'jacksonville', 'flooded', 150],
  ['dallas', 'elpaso', 'desert', 150],
  ['omaha', 'denver', 'plains', 150],
  // Into the mountains and the far south.
  ['jacksonville', 'miami', 'flooded', 400],
  ['elpaso', 'albuquerque', 'desert', 400],
  ['albuquerque', 'denver', 'snow', 400],
  ['elpaso', 'phoenix', 'desert', 400],
  ['denver', 'saltlake', 'snow', 400],
  // The West Coast.
  ['phoenix', 'losangeles', 'desert', 800],
  ['losangeles', 'sanfrancisco', 'plains', 800],
  ['saltlake', 'sanfrancisco', 'snow', 800],
  ['saltlake', 'seattle', 'snow', 800],
  ['seattle', 'sanfrancisco', 'flooded', 800],
];

// Rail miles: the great-circle distance with 20% for the way rails really run, to the nearest 10.
function railMiles(a, b) {
  const R = 3959;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round((2 * R * Math.asin(Math.sqrt(h)) * 1.2) / 10) * 10;
}

export const LINES = LINE_LIST.map(([a, b, terrain, rep]) => ({
  id: `${a}-${b}`,
  a,
  b,
  terrain,
  rep,
  miles: railMiles(CITIES[a], CITIES[b]),
  name: `${CITIES[a].name} – ${CITIES[b].name}`,
}));
export const lineById = (id) => LINES.find((line) => line.id === id) ?? null;
export function lineBetween(a, b) {
  return LINES.find((line) => (line.a === a && line.b === b) || (line.a === b && line.b === a)) ?? null;
}

export const EXPRESSES = [
  { id: 'gulf', name: 'Gulf Coast Flyer', path: ['dallas', 'houston', 'neworleans', 'memphis'], rep: 150, text: 'Through the flooded bayous of the Gulf.' },
  { id: 'atlantic', name: 'Atlantic Express', path: ['boston', 'newyork', 'washington', 'charlotte', 'atlanta', 'jacksonville', 'miami'], rep: 400, text: 'The whole East Coast: from the snow of New England down to Miami.' },
  { id: 'chief', name: 'Southwest Chief', path: ['chicago', 'stlouis', 'kansascity', 'dallas', 'elpaso', 'phoenix', 'losangeles'], rep: 800, text: 'Chicago to Los Angeles across the desert.' },
  { id: 'transcon', name: 'Transcontinental', path: ['newyork', 'washington', 'pittsburgh', 'chicago', 'omaha', 'denver', 'saltlake', 'sanfrancisco'], rep: 1500, text: 'Sea to sea over the Rockies and the Sierra.' },
  { id: 'coast', name: 'Coast to Coast', path: ['seattle', 'saltlake', 'denver', 'omaha', 'kansascity', 'stlouis', 'memphis', 'atlanta', 'jacksonville', 'miami'], rep: 2500, text: 'Seattle to Miami: the longest run on the map.' },
];
export const expressById = (id) => EXPRESSES.find((x) => x.id === id) ?? null;
export const expressLines = (express) => express.path.slice(1).map((city, i) => lineBetween(express.path[i], city));
export const expressMiles = (express) => expressLines(express).reduce((sum, line) => sum + line.miles, 0);

// Rail reputation: what the railroads think of you. Every company's reputation counts, plus what
// you earn on the map itself (deliveries and express legs).
export function railRep(conductor) {
  const companies = Object.values(conductor.companies ?? {}).reduce((sum, record) => sum + (record.rep ?? 0), 0);
  return (conductor.railRep ?? 0) + companies;
}
export const lineOpen = (conductor, line) => railRep(conductor) >= line.rep;
export const nextUnlock = (conductor) => [...new Set([...LINES.map((l) => l.rep), ...EXPRESSES.map((x) => x.rep)])].sort((a, b) => a - b).find((rep) => rep > railRep(conductor)) ?? null;

// Post this week's jobs on the open lines: each gets a line, a spot along it and the line's terrain.
export function placeJobs(conductor, rng) {
  const board = conductor.board;
  if (!board) return;
  const open = LINES.filter((line) => lineOpen(conductor, line));
  if (!open.length) return;
  const place = (job) => {
    if (job.line && lineById(job.line)) return;
    const line = open[Math.floor(rng() * open.length)];
    job.line = line.id;
    job.linePos = Math.round(randRange(rng, 0.12, 0.88) * 100) / 100;
    job.theme = line.terrain;
  };
  for (const job of board.simple ?? []) place(job);
  for (const job of board.contracts ?? []) place(job);
  for (const job of board.races ?? []) place(job);
  for (const jobs of Object.values(board.company ?? {})) for (const job of jobs) place(job);
}

// ---------- Express runs ----------

const X = () => B.EXPRESS;

// Split an express into legs: each line into equal legs of at most legMiles.
export function expressLegs(express, rng) {
  const legs = [];
  for (const line of expressLines(express)) {
    const forward = express.path.indexOf(line.a) < express.path.indexOf(line.b);
    const [from, to] = forward ? [line.a, line.b] : [line.b, line.a];
    const n = Math.ceil(line.miles / X().legMiles);
    for (let k = 0; k < n; k++) {
      const distance = Math.round(line.miles / n / 5) * 5;
      const each = Math.round(randInt(rng, ...X().containerLb) / 100) * 100;
      legs.push({
        line: line.id,
        theme: line.terrain,
        from: k === 0 ? CITIES[from].name : `${CITIES[from].name}–${CITIES[to].name} mile ${Math.round((line.miles * k) / n)}`,
        to: k === n - 1 ? CITIES[to].name : `${CITIES[from].name}–${CITIES[to].name} mile ${Math.round((line.miles * (k + 1)) / n)}`,
        distance,
        each,
        fee: Math.round((distance * X().feePerMile) / 5) * 5,
        perContainer: Math.round((distance * X().perContainerPerMile) / 5) * 5,
      });
    }
  }
  return legs;
}

// The leg being run now, as a job the setup and race screens understand.
export function expressJob(conductor) {
  const run = conductor.express;
  if (!run) return null;
  const express = expressById(run.id);
  const leg = run.legs[run.leg];
  if (!express || !leg) return null;
  return {
    id: `express-${run.id}-${run.leg}`,
    type: 'express',
    title: `${express.name}: leg ${run.leg + 1} of ${run.legs.length}`,
    cargo: 'Express freight',
    from: leg.from,
    to: leg.to,
    distance: leg.distance,
    containers: X().containers,
    each: leg.each,
    weight: X().containers * leg.each,
    fee: leg.fee,
    perContainer: leg.perContainer,
    hazard: leg.hazard ?? 0,
    boulders: leg.boulders ?? [],
    timeLimit: leg.distance * B.JOBS.limitSecondsPerMile * X().timeLimit,
    speedBonus: false,
    theme: leg.theme,
    line: leg.line,
  };
}
