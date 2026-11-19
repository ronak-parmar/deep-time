import { WebPlugin } from '@capacitor/core';

// Play Games Services exist only on Android: the web build reports "not available" and never throws.
export class PlayGamesWeb extends WebPlugin {
  async initialize() { return { available: false }; }
  async isAvailable() { return { available: false }; }
  async isAuthenticated() { return { available: false, authenticated: false }; }
  async signIn() { return { available: false, authenticated: false }; }
  async saveGame() { return { available: false, saved: false }; }
  async loadGame() { return { available: false, data: null }; }
}
