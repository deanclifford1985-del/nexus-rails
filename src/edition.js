// One codebase, two games. Nexus Rail Lite (free) is the default; the NFT edition is the same
// build with VITE_EDITION=nft set (in Replit: Secrets, or the NFT project's environment).
const raw = (import.meta.env?.VITE_EDITION ?? 'lite').toLowerCase();
export const EDITION = raw === 'nft' ? 'nft' : 'lite';
export const IS_NFT = EDITION === 'nft';
export const GAME_NAME = IS_NFT ? 'Nexus Rail' : 'Nexus Rail Lite';
// Test-build admin passcode. Not a security measure until the game has a server.
export const ADMIN_CODE = import.meta.env?.VITE_ADMIN_CODE || 'nexus-admin';
