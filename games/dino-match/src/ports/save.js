import { newProfile, migrateProfile, mergeProfiles, sameProfile } from '../core/profile.js';

// SaveStore: load() and save(profile) both return promises.
// createLocalSaveStore = localStorage. createCloudSaveStore wraps one and adds Google Play Games saved games (ports/playgames.js).
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

export const CLOUD_SLOT = 'dino-match-profile';   // the one Play Games saved game (snapshot) name
export const CLOUD_MIN_INTERVAL = 30000;          // at most one upload every 30 s
export const CLOUD_QUIET = 2000;                  // wait this long after a save so a burst (level end) becomes one upload
export const CLOUD_TOASTS = {
  saved: 'Progress saved to Google Play',
  restored: 'Progress restored',
  offline: 'Could not reach Google Play. Progress is saved on this phone.',
  signInFailed: 'Could not sign in to Google Play'
};

// CloudSave: the local store is always written first (offline-safe; the game never waits for the network).
// When the player is signed in to Play Games, saves are uploaded (throttled), and on start / sign-in / Sync now the cloud copy
// is downloaded and MERGED with the local one (core/profile.js mergeProfiles), so neither copy's progress is lost.
//   local     a SaveStore (createLocalSaveStore)
//   games     the Play Games port (ports/playgames.js): available(), isAuthenticated(), signIn(), saveGame(), loadGame()
//   onRemote  (profile) => void: the cloud brought progress this phone did not have; main.js adopts it
//   toast     (message) => void
export function createCloudSaveStore({ local, games, onRemote = () => {}, toast = () => {}, now = () => Date.now(), minInterval = CLOUD_MIN_INTERVAL, quiet = CLOUD_QUIET, slot = CLOUD_SLOT, timers = globalThis } = {}) {
  let last = null;                              // newest profile written (the one main.js holds)
  let timer = null, lastUpload = -Infinity, dirty = false, inflight = null;
  const st = { available: false, signedIn: false, name: null, syncing: false, lastSync: null };
  const subs = new Set();
  const status = () => ({ ...st });
  const emit = () => { for (const f of subs) { try { f(status()); } catch { /* a listener never breaks saving */ } } };

  const handleError = (e) => {
    const code = e && e.code;
    if (code === 'NOT_AUTHENTICATED') { st.signedIn = false; st.name = null; }
    if (code === 'NOT_CONFIGURED') { st.available = false; st.signedIn = false; st.name = null; }
    emit();
    return code || 'UNKNOWN';
  };
  const clear = () => { if (timer != null) { timers.clearTimeout(timer); timer = null; } };
  const schedule = () => {
    if (!st.signedIn || !dirty || timer != null) return;
    const wait = Math.max(quiet, lastUpload + minInterval - now());
    timer = timers.setTimeout(() => { timer = null; upload(); }, wait);
  };

  async function upload() {
    if (inflight) return inflight;
    if (!st.signedIn || !last) return false;
    clear();
    dirty = false; lastUpload = now();
    const data = JSON.stringify(last);
    inflight = (async () => {
      try {
        await games.saveGame({ name: slot, data, description: `Dino Match, level ${last.level}` });
        st.lastSync = now(); emit();
        return true;
      } catch (e) {
        dirty = true; handleError(e);
        schedule();                             // offline: try again later (throttled), nothing is lost locally
        return false;
      } finally { inflight = null; }
    })();
    return inflight;
  }

  // Download the cloud copy and merge it into the local one. Returns 'restored' | 'same' | 'empty' | 'error'.
  async function pull() {
    if (!st.signedIn) return 'error';
    let res;
    try { res = await games.loadGame({ name: slot }); } catch (e) { handleError(e); return 'error'; }
    let cloud = null;
    if (res && typeof res.data === 'string' && res.data) { try { cloud = migrateProfile(JSON.parse(res.data)); } catch { cloud = null; } }
    if (!last) last = await local.load();
    if (!cloud) { dirty = true; schedule(); return 'empty'; }     // first sign-in on any phone: this phone's save goes up
    const merged = mergeProfiles(last, cloud);
    const gained = !sameProfile(merged, last);
    if (!sameProfile(merged, cloud)) { dirty = true; schedule(); }   // the cloud is missing something this phone has
    if (!gained) return 'same';
    last = { ...merged, savedAt: now() };
    await local.save(last);
    try { onRemote(last); } catch { /* ignore */ }
    toast(CLOUD_TOASTS.restored);
    return 'restored';
  }

  async function afterAuth(r) {
    st.signedIn = !!(r && r.authenticated);
    st.name = st.signedIn ? (r.displayName || null) : null;
    emit();
    if (!st.signedIn) return;
    st.syncing = true; emit();
    try { await pull(); } finally { st.syncing = false; emit(); }
  }

  return {
    status,
    subscribe(f) { subs.add(f); return () => subs.delete(f); },

    async load() {
      last = await local.load();
      return last;
    },
    async save(profile) {
      last = { ...profile, savedAt: now() };     // set before awaiting: a merge always sees the newest copy
      await local.save(last);
      if (st.signedIn) { dirty = true; schedule(); }
    },

    // App start: is Play Games here, and is the player already signed in (PGS v2 signs in automatically)? Never throws, never blocks play.
    async start() {
      try {
        const a = await games.available();
        st.available = !!(a && a.available); emit();
        if (!st.available) return status();
        await afterAuth(await games.isAuthenticated());
      } catch (e) { handleError(e); }
      return status();
    },

    // Settings > Sign in.
    async signIn() {
      if (!st.available) return status();
      try {
        await afterAuth(await games.signIn());
        if (!st.signedIn) toast(CLOUD_TOASTS.signInFailed);
      } catch (e) {
        if (handleError(e) !== 'NOT_CONFIGURED') toast(CLOUD_TOASTS.signInFailed);
      }
      return status();
    },

    // Settings > Sync now: pull + merge, then push straight away (ignores the 30 s throttle).
    async syncNow() {
      if (!st.signedIn) return false;
      st.syncing = true; emit();
      try {
        const r = await pull();
        if (r === 'error') { if (st.signedIn) toast(CLOUD_TOASTS.offline); return false; }
        dirty = true;
        const ok = await upload();
        toast(ok ? CLOUD_TOASTS.saved : CLOUD_TOASTS.offline);
        return ok;
      } finally { st.syncing = false; emit(); }
    },

    // The app goes to the background: upload now if anything is waiting (still at most once per minInterval).
    async flush() {
      if (!st.signedIn || !dirty) return false;
      if (now() - lastUpload < minInterval) { schedule(); return false; }
      return upload();
    },

    dispose() { clear(); subs.clear(); }
  };
}
