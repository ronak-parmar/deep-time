// Turns design-system/tokens.json into CSS custom properties, type classes and @font-face rules.
import tokens from '../../../../design-system/tokens.json';
import bundleCss from '../../../../design-system/components/bundle.css?inline';
import { cssVars } from '../render/motion.js';
import f400 from '../../../../design-system/fonts/Nunito-400.woff2?url';
import f700 from '../../../../design-system/fonts/Nunito-700.woff2?url';
import f800 from '../../../../design-system/fonts/Nunito-800.woff2?url';

const alias = (v) => v.replace(/\{([\w-]+)\}/g, 'var(--$1)');

export function eraPalette(id) {
  const get = (k) => tokens.color.tokens.find((t) => t.name === `era-${id}-${k}`)?.value;
  return { top: get('sky-top'), bottom: get('sky-bottom'), field: get('field'), tiers: [1, 2, 3, 4, 5].map((n) => get('tier-' + n)) };
}
export const color = (name) => tokens.color.tokens.find((t) => t.name === name)?.value;

export function injectDesignSystem() {
  const vars = [];
  for (const group of [tokens.color, tokens.spacing, tokens.radius, tokens.size, tokens.duration, tokens.zIndex])
    for (const t of group.tokens) vars.push(`--${t.name}:${alias(t.value)}`);
  const type = tokens.type.groups[0].styles.map((s) =>
    `.${s.name}{font-size:${s.fontSize};line-height:${s.lineHeight};font-weight:${s.fontWeight};margin:0}`).join('');
  const faces = [[400, f400], [700, f700], [800, f800]].map(([w, u]) =>
    `@font-face{font-family:Nunito;font-weight:${w};font-style:normal;font-display:swap;src:url(${u}) format('woff2')}`).join('');
  const style = document.createElement('style');
  style.id = 'deep-time-tokens';
  style.textContent = `${faces}:root{${vars.join(';')};--font-sans:${tokens.type.families.sans}}${type}${bundleCss}${cssVars()}`;
  document.head.prepend(style);
}

export async function loadFonts() {
  if (!document.fonts) return;
  await Promise.all(['400 16px Nunito', '700 16px Nunito', '800 16px Nunito'].map((f) => document.fonts.load(f).catch(() => null)));
}
