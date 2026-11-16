/**
 * Analytics sink interface. The brain only calls track(name, props).
 * @typedef {Object} IAnalytics
 * @property {(name: string, props?: Record<string, any>) => void} track
 */

/** @type {IAnalytics} */
export const NullAnalytics = Object.freeze({ track() {} });

/** Collects events in memory (tests, simulator). */
export class MemoryAnalytics {
  constructor() {
    /** @type {{name:string, props:Record<string,any>}[]} */
    this.events = [];
  }
  track(name, props = {}) {
    this.events.push({ name, props });
  }
  count(name) {
    return this.events.filter((e) => e.name === name).length;
  }
}

/** Forwards to any function, e.g. (n, p) => firebase.logEvent(n, p). Errors in the sink never reach the game. */
export function createCallbackAnalytics(fn) {
  return { track: (name, props) => { try { fn(name, props); } catch { /* ignore sink errors */ } } };
}
