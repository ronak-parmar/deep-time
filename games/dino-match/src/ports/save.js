import { newProfile, migrateProfile } from '../core/profile.js';

// SaveStore: load() and save(profile) both return promises. LocalStorage now,
// Play Games Services (saved games, with mergeProfiles from core/profile.js) later.
export function createLocalSaveStore(key = 'dino-match.profile.v1', storage = globalThis.localStorage) {
  return {
    async load() {
      try {
        const raw = storage.getItem(key);
        return raw ? migrateProfile(JSON.parse(raw)) : newProfile();
      } catch {
        return newProfile();
      }
    },
    async save(profile) {
      try { storage.setItem(key, JSON.stringify(profile)); } catch { /* private mode or full: progress stays in memory */ }
    }
  };
}

export function createMemorySaveStore() {
  let p = newProfile();
  return { async load() { return p; }, async save(x) { p = x; } };
}
