// Which Dispatch tab a run came from, so "Back" lands where the player left.
export function dispatchTab(kind) {
  if (kind === 'company') return 'contracts:open';
  if (kind === 'contract') return 'contracts:compete';
  if (kind === 'race') return 'races';
  if (kind === 'bounty') return 'bounties';
  return 'deliveries';
}
