// Settings > "Google Play Games" row, and the small cloud-save toast. The row follows the cloud save status
// (ports/save.js createCloudSaveStore().status()) and re-renders on every change; it is hidden when Play Games is not available
// (web build, or a build without a Play Games App ID).
import { h } from './dom.js';
import { KButton } from './kit.js';
import { Toast } from './components.js';
import { playGamesRowModel } from './playgames-model.js';
import { D, dur } from '../render/motion.js';
export { playGamesRowModel };

// cloud = { status(), subscribe(fn) -> unsubscribe, signIn(), syncNow() }. Returns { el, destroy }.
export function PlayGamesRow(cloud) {
  const el = h('div', { class: 'pg-row', id: 'set-playgames', role: 'group', 'aria-label': 'Google Play Games' });
  const render = (s) => {
    const m = playGamesRowModel(s);
    el.hidden = !m;
    if (!m) { el.replaceChildren(); return; }
    const a = m.action;
    el.replaceChildren(
      h('div', { class: 'pg-row__t' }, h('b', {}, m.title), ...m.lines.map((l) => h('small', {}, l))),
      KButton({ id: a.id, variant: a.variant, disabled: a.disabled, onClick: () => cloud[a.kind]?.() }, a.label));
  };
  render(cloud.status());
  const off = cloud.subscribe(render);
  return { el, destroy: off };
}

// One toast at a time, bottom of the stage, gone after a moment. Never blocks input.
let current = null;
export function showToast(root, message, tone = 'success', ms = D.celebrate * 3) {
  if (!root) return;
  current?.remove();
  const t = h('div', { class: 'pg-toast', 'aria-live': 'polite' }, Toast(message, tone));
  root.append(t); current = t;
  setTimeout(() => { t.classList.add('pg-toast--out'); setTimeout(() => { t.remove(); if (current === t) current = null; }, dur(D.slow)); }, ms);
}
