// Which Dispatch tab a run came from, so "Back" lands where the player left.
export function dispatchTab(kind) {
  if (kind === 'company') return 'contracts:open';
  if (kind === 'contract') return 'contracts:compete';
  if (kind === 'race') return 'races:prize';
  if (kind === 'open') return 'races:open';
  if (kind === 'trial') return 'races:trials';
  if (kind === 'bounty') return 'bounties';
  return 'deliveries';
}
