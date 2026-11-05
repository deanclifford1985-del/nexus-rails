// The launch trailer, served next to the page (public/ in the app; published files in the artifact).
// WebM first for browsers without H.264, MP4 for Safari and iOS. If neither plays, the player closes quietly.
export const TRAILER_SRC = [
  { src: 'trailer.webm', type: 'video/webm' },
  { src: 'trailer.mp4', type: 'video/mp4', last: true },
];
