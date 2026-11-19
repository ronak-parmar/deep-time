// Settings > Google Play Games row: pure view model (no DOM), used by ui/playgames.js and tests/cloudsave.test.js.
// What the row shows for a cloud save status ({ available, signedIn, name, syncing }); null = no row.
export function playGamesRowModel(s) {
  if (!s || !s.available) return null;
  if (!s.signedIn) return { title: 'Google Play Games', lines: ['Sign in to keep your progress in the cloud'], action: { id: 'pg-signin', label: 'Sign in', variant: 'gold', kind: 'signIn' } };
  return {
    title: 'Google Play Games',
    lines: [s.name ? `Signed in as ${s.name}` : 'Signed in', 'Cloud save on'],
    action: { id: 'pg-sync', label: s.syncing ? 'Syncing' : 'Sync now', variant: 'stone', kind: 'syncNow', disabled: !!s.syncing }
  };
}
