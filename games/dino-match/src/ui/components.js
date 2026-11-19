// Vanilla-DOM ports of the Deep Time React components we use (visuals and class names come from
// design-system/components/bundle.css; markup mirrors design-system/components/bundle.js).
import { h } from './dom.js';
import { glyph } from './glyphs.js';
import { slotUrl, slotsReady } from '../render/art.js';
import { UI_SLOTS } from '../render/artManifest.js';
import { aiUrl, aiKitOn } from './kitart.js';

export function Button({ variant = 'primary', full = false, onClick, id, label, disabled }, ...kids) {
  return h('button', { type: 'button', id, 'aria-label': label, disabled, onClick, class: `dt-btn dt-btn--${variant} heading${full ? ' dt-btn--full' : ''}` }, ...kids);
}

export function Stars(count) {
  const wrap = h('div', { class: 'dt-stars', role: 'img', 'aria-label': `${count} of 3 stars` });
  for (let i = 0; i < 3; i++) {
    if (aiKitOn() && aiUrl('star')) {    // the painted star from the AI kit; the empty one is the same star, dark
      const im = h('img', { class: 'dt-star-img dt-star-img--ai' + (i < count ? ' pop-in' : ' dt-star-img--off'), src: aiUrl('star'), alt: '', draggable: 'false' });
      im.style.animationDelay = `calc(var(--m-stagger-reward) * ${i + 1})`; wrap.append(im); continue;
    }
    if (slotsReady('star-on', 'star-off')) {    // painted stars; vector glyph otherwise
      const im = h('img', { class: 'dt-star-img' + (i < count ? ' pop-in' : ''), src: slotUrl(i < count ? 'star-on' : 'star-off'), alt: '', draggable: 'false' });
      im.style.animationDelay = `calc(var(--m-stagger-reward) * ${i + 1})`; wrap.append(im); continue;
    }
    const s = glyph('star', 40); s.setAttribute('class', 'dt-star' + (i < count ? ' dt-star--on pop-in' : ''));
    s.style.animationDelay = `calc(var(--m-stagger-reward) * ${i + 1})`;
    wrap.append(s);
  }
  return wrap;
}

export function Progress(pct) {
  if (slotsReady('progress-frame', 'progress-fill')) {   // painted bar: 9-slice frame via border-image, fill clipped by width
    const f = UI_SLOTS['progress-frame'], [l, t, r, b] = f.nine;
    const el = h('div', { class: 'dt-progress dt-progress--art', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pct * 100), style: { borderImageSource: `url(${slotUrl('progress-frame')})`, borderImageSlice: `${t * 2} ${r * 2} ${b * 2} ${l * 2} fill`, borderImageWidth: `${t}px ${r}px ${b}px ${l}px` } },
      h('div', { class: 'dt-progress__bar', style: { width: `calc((100% - 26px) * ${pct})`, backgroundImage: `url(${slotUrl('progress-fill')})` } }));
    return el;
  }
  return h('div', { class: 'dt-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pct * 100) },
    h('div', { class: 'dt-progress__bar', style: { width: Math.round(pct * 100) + '%' } }));
}

export function Toast(message, tone = 'info') {
  const g = { info: 'info', success: 'check', error: 'close' }[tone];
  return h('div', { class: `dt-toast dt-toast--${tone}`, role: 'status' }, glyph(g, 20), h('span', { class: 'body-small' }, message));
}

export function Coins(value) {
  return h('span', { class: 'coins heading dt-num', role: 'status', 'aria-label': `Coins ${value}` }, glyph('coin', 18), String(value));
}

// Opt-in rewarded ad button (green, always labelled AD). Mirrors design-system RewardButton.
export function RewardButton({ benefit, onClick, disabled, id }) {
  return h('button', { type: 'button', class: 'dt-reward', onClick, disabled, id },
    glyph('video', 24),
    h('span', { class: 'dt-reward__text' }, h('span', { class: 'dt-reward__benefit heading' }, benefit), h('span', { class: 'dt-reward__note body-small' }, 'Watch a short ad')),
    h('span', { class: 'dt-adtag caption' }, 'AD'));
}

// Runs a rewarded ad (AdMob on Android, the mock elsewhere) on a button: disables it, shows "Playing ad", resolves with true when completed.
export async function watchAd(ads, btn) {
  const label = btn.querySelector('.dt-reward__benefit');
  const old = label?.textContent;
  btn.disabled = true; if (label) label.textContent = 'Loading ad…';
  const r = await ads.showRewarded();
  if (!r.completed) { btn.disabled = false; if (label) label.textContent = old; }
  return !!r.completed;
}

// Header stat chip: glyph + value (+ optional small text).
export function Chip(name, value, label, cls = '') {
  if (name === 'coin' && aiKitOn() && aiUrl('currency')) return h('span', { class: `kit-cur dt-num ${cls}`, role: 'status', 'aria-label': `${label} ${value}` }, String(value));
  return h('span', { class: `chip heading dt-num ${cls}`, role: 'status', 'aria-label': `${label} ${value}` }, glyph(name, 18), String(value));
}

export const mmss = (ms) => { const t = Math.ceil(ms / 1000), m = Math.floor(t / 60), s = t % 60; return `${m}:${String(s).padStart(2, '0')}`; };
