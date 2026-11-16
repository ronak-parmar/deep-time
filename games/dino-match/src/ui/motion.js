// prefers-reduced-motion, read live. Tweens become instant and shake/particles stop.
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reducedMotion = () => (window.__forceMotion === true ? false : window.__forceReduced === true || !!(mq && mq.matches));
