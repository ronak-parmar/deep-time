// Play Games port: a thin, never-throwing-on-import wrapper around the local Capacitor plugin
// (packages/capacitor-play-games, registered natively as "PlayGames"). Android only; elsewhere available() is false.
// Every method returns a promise; failures reject with an Error whose .code is one of
// NOT_AUTHENTICATED, NOT_CONFIGURED, NETWORK, CONFLICT, UNKNOWN.
export const PG_CODES = ['NOT_AUTHENTICATED', 'NOT_CONFIGURED', 'NETWORK', 'CONFLICT', 'UNKNOWN'];

const asError = (e) => {
  const code = PG_CODES.includes(e && e.code) ? e.code : 'UNKNOWN';
  const err = new Error((e && e.message) || code);
  err.code = code;
  return err;
};

// Wrap any object with the plugin's methods (the real plugin, or a fake in tests).
export function wrapPlayGames(plugin) {
  const call = async (name, args) => {
    if (!plugin || typeof plugin[name] !== 'function') throw asError({ code: 'NOT_CONFIGURED' });
    try { return (await plugin[name](args)) || {}; } catch (e) { throw asError(e); }
  };
  return {
    async available() { try { const r = await call('isAvailable'); return { available: !!r.available }; } catch { return { available: false }; } },
    async isAuthenticated() { const r = await call('isAuthenticated'); return { authenticated: !!r.authenticated, playerId: r.playerId, displayName: r.displayName }; },
    async signIn() { const r = await call('signIn'); return { authenticated: !!r.authenticated, playerId: r.playerId, displayName: r.displayName }; },
    async saveGame({ name, data, description = '' }) { return call('saveGame', { name, data, description }); },
    async loadGame({ name }) { const r = await call('loadGame', { name }); return { data: typeof r.data === 'string' && r.data ? r.data : null }; }
  };
}

const unavailable = wrapPlayGames(null);

// The real port: only on a native Android build; the plugin module is loaded lazily so the web build never needs it.
export async function createPlayGamesPort() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android' || !Capacitor.isPluginAvailable('PlayGames')) return unavailable;
    const { PlayGames } = await import('capacitor-play-games');
    return wrapPlayGames(PlayGames);
  } catch {
    return unavailable;
  }
}
