import { registerPlugin } from '@capacitor/core';

// Native side: android/src/main/java/com/ronki/playgames/PlayGamesPlugin.java (registered as "PlayGames").
// On the web (and iOS) every call resolves { available: false } / { authenticated: false } / { data: null }.
export const PlayGames = registerPlugin('PlayGames', {
  web: () => import('./web.js').then((m) => new m.PlayGamesWeb())
});

// Error codes the native side rejects with (err.code).
export const PLAY_GAMES_ERRORS = ['NOT_AUTHENTICATED', 'NOT_CONFIGURED', 'NETWORK', 'CONFLICT', 'UNKNOWN'];
