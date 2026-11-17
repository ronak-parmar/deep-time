// Debug picker, only mounted with ?debug in the URL: jump to a level or trigger any special / combination in one swap.
import { h } from '../ui/dom.js';

export function mountPicker({ ALL_TESTS, go, test, home, intros }) {
  const level = h('input', { type: 'number', min: 1, value: 5, id: 'dbg-level', 'aria-label': 'Level number', class: 'dbg__in' });
  const sel = h('select', { id: 'dbg-test', 'aria-label': 'Special test board', class: 'dbg__in' }, ...ALL_TESTS.map((n) => h('option', { value: n }, n)));
  const body = h('div', { class: 'dbg__body', hidden: true });
  const tab = h('button', { type: 'button', class: 'dbg__tab', id: 'dbg-tab', 'aria-expanded': 'false', onClick: () => { body.hidden = !body.hidden; tab.setAttribute('aria-expanded', String(!body.hidden)); } }, 'DBG');
  const panel = h('div', { class: 'dbg', id: 'dbg' }, tab, body);
  body.append(
    h('div', { class: 'dbg__row' }, level, h('button', { type: 'button', id: 'dbg-go', onClick: () => go(+level.value || 1) }, 'Go')),
    h('div', { class: 'dbg__row' }, sel, h('button', { type: 'button', id: 'dbg-run', onClick: () => test(sel.value) }, 'Board')),
    h('div', { class: 'dbg__hint' }, 'Board: swap the two highlighted gems (hint pulses after 6 s)'),
    h('button', { type: 'button', id: 'dbg-intros', onClick: intros }, 'All intros'),
    h('button', { type: 'button', id: 'dbg-home', onClick: home }, 'Home'));
  document.body.append(panel);
  return panel;
}
