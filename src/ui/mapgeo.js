import { CITIES } from '../game/routemap.js';

// The geometry of the rail map of the United States, shared by the Dispatch map and the Empire map.

export const W = 1000;
export const H = 560;
export const px = (lon, lat) => [30 + ((lon + 125) / 59) * 940, 18 + (50 - lat) * 19.9];
export const pt = (id) => px(CITIES[id].lon, CITIES[id].lat);

// A rough outline of the lower 48, lon/lat, clockwise from the Olympic Peninsula.
const OUTLINE = [
  [-124.7, 48.4], [-123.0, 49.0], [-95.2, 49.0], [-94.8, 49.4], [-89.6, 48.0], [-84.8, 46.5], [-83.5, 46.1], [-82.4, 43.0], [-79.0, 43.3],
  [-76.5, 44.2], [-74.9, 45.0], [-71.5, 45.0], [-70.0, 46.7], [-67.8, 47.1], [-67.0, 44.8], [-70.6, 43.1], [-70.0, 41.7], [-71.9, 41.3],
  [-74.0, 40.6], [-74.2, 39.6], [-75.5, 38.5], [-76.0, 37.0], [-75.5, 35.3], [-77.9, 33.9], [-79.2, 33.2], [-80.9, 32.0], [-81.4, 30.7],
  [-80.0, 26.9], [-80.4, 25.2], [-81.8, 25.9], [-82.6, 27.5], [-82.8, 29.2], [-84.3, 30.0], [-86.5, 30.4], [-88.5, 30.3], [-89.6, 29.9],
  [-89.4, 29.0], [-90.9, 29.1], [-93.8, 29.7], [-95.0, 29.3], [-97.2, 27.6], [-97.4, 25.9], [-99.1, 26.4], [-100.6, 28.6], [-101.4, 29.8],
  [-103.1, 29.0], [-104.5, 29.6], [-106.5, 31.8], [-108.2, 31.8], [-111.1, 31.3], [-114.8, 32.5], [-117.1, 32.5], [-118.5, 34.0], [-120.6, 34.6],
  [-121.9, 36.6], [-122.5, 37.8], [-123.8, 39.8], [-124.2, 41.9], [-124.5, 43.0], [-124.0, 46.3],
];
export const OUTLINE_D = `M ${OUTLINE.map(([lon, lat]) => px(lon, lat).map((v) => v.toFixed(1)).join(' ')).join(' L ')} Z`;

export const TERRAIN = {
  plains: { color: '#7fcf6a', name: 'Plains' },
  flooded: { color: '#4fb0ff', name: 'Flooded' },
  desert: { color: '#f2a650', name: 'Desert' },
  snow: { color: '#e4f0ff', name: 'Frozen' },
};
// Labels that would collide with a neighbour sit somewhere else.
const LABEL_AT = { pittsburgh: [-9, 18, 'end'], newyork: [9, 4, 'start'], washington: [9, 16, 'start'], stlouis: [9, 16, 'start'], kansascity: [-9, -7, 'end'] };
export const labelAt = (id, x) => LABEL_AT[id] ?? (x > 820 ? [-9, -7, 'end'] : [9, -7, 'start']);
