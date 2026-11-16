/* @ds-bundle: {"format":4,"namespace":"DeepTime","components":[{"name":"Button"},{"name":"RewardButton"},{"name":"Counter"},{"name":"Hud"},{"name":"Gem"},{"name":"Block"},{"name":"AdOverlay"},{"name":"ResultScreen"},{"name":"HistoryPlayer"},{"name":"ConsentSheet"},{"name":"Modal"},{"name":"Toast"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;

  function cx() {
    return Array.prototype.slice.call(arguments).filter(Boolean).join(' ');
  }

  /* ---------- glyphs: drawn from simple geometry, no emoji ---------- */
  function Glyph(props) {
    var size = props.size || 20;
    var common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', className: 'dt-glyph' };
    var shapes = {
      video: [h('rect', { key: 'a', x: 3, y: 5, width: 18, height: 14, rx: 3, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }), h('polygon', { key: 'b', points: '10,9 16,12 10,15', fill: 'currentColor' })],
      close: [h('path', { key: 'a', d: 'M6 6 L18 18 M18 6 L6 18', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', fill: 'none' })],
      check: [h('path', { key: 'a', d: 'M5 12.5 L10 17.5 L19 7', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' })],
      warn: [h('polygon', { key: 'a', points: '12,3 22,20 2,20', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }), h('path', { key: 'b', d: 'M12 9.5 V14 M12 16.5 V17', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })],
      info: [h('circle', { key: 'a', cx: 12, cy: 12, r: 9, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }), h('path', { key: 'b', d: 'M12 11 V16 M12 7.5 V8', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })],
      heart: [h('path', { key: 'a', d: 'M12 20 C4 14 3 9.5 6 7 C8.5 5 11 6.5 12 8.5 C13 6.5 15.5 5 18 7 C21 9.5 20 14 12 20 Z', fill: 'currentColor' })],
      coin: [h('circle', { key: 'a', cx: 12, cy: 12, r: 9, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }), h('rect', { key: 'b', x: 9.5, y: 7, width: 5, height: 10, rx: 1.5, fill: 'currentColor' })],
      level: [h('path', { key: 'a', d: 'M4 19 L10 8 L14 14 L16.5 10.5 L21 19 Z', fill: 'currentColor' })],
      score: [h('polygon', { key: 'a', points: starPoints(12, 12.5, 9.5, 4.2), fill: 'currentColor' })]
    };
    return h('svg', common, shapes[props.name] || null);
  }

  function starPoints(cx0, cy0, outer, inner) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var r = i % 2 === 0 ? outer : inner;
      var a = (-90 + i * 36) * Math.PI / 180;
      pts.push((cx0 + r * Math.cos(a)).toFixed(2) + ',' + (cy0 + r * Math.sin(a)).toFixed(2));
    }
    return pts.join(' ');
  }

  /* ---------- Button ---------- */
  function Button(props) {
    var variant = props.variant || 'primary';
    return h('button', {
      type: props.type || 'button',
      className: cx('dt-btn', 'dt-btn--' + variant, 'heading', props.fullWidth && 'dt-btn--full', props.className),
      disabled: props.disabled,
      onClick: props.onClick,
      id: props.id
    }, props.children);
  }

  /* ---------- RewardButton: opt-in ad, always labelled ---------- */
  function RewardButton(props) {
    return h('button', {
      type: 'button',
      className: cx('dt-reward', props.className),
      disabled: props.disabled,
      onClick: props.onClick,
      id: props.id
    },
      h(Glyph, { name: 'video', size: 24 }),
      h('span', { className: 'dt-reward__text' },
        h('span', { className: 'dt-reward__benefit heading' }, props.benefit),
        h('span', { className: 'dt-reward__note body-small' }, 'Watch a short ad')
      ),
      h('span', { className: 'dt-adtag caption' }, 'AD')
    );
  }

  /* ---------- Counter and Hud ---------- */
  var COUNTER_LABEL = { lives: 'Lives', coins: 'Coins', score: 'Score', level: 'Level' };
  function Counter(props) {
    var kind = props.kind || 'score';
    var glyph = { lives: 'heart', coins: 'coin', score: 'score', level: 'level' }[kind];
    return h('span', { className: cx('dt-counter', 'dt-counter--' + kind), role: 'status', 'aria-label': (props.label || COUNTER_LABEL[kind]) + ' ' + props.value },
      h(Glyph, { name: glyph, size: 16 }),
      h('span', { className: 'dt-counter__value heading dt-num' }, props.value)
    );
  }

  function Hud(props) {
    return h('header', { className: cx('dt-hud', props.className) },
      h(Counter, { kind: 'lives', value: props.lives }),
      h(Counter, { kind: 'level', value: props.level }),
      h(Counter, { kind: 'score', value: props.score }),
      h(Counter, { kind: 'coins', value: props.coins })
    );
  }

  /* ---------- Gem: shape and colour together ---------- */
  var GEMS = {
    lava: { label: 'Lava stone', color: 'var(--gem-lava)', shape: function () { return h('polygon', { points: '12,2 22,12 12,22 2,12' }); } },
    amber: { label: 'Amber', color: 'var(--gem-amber)', shape: function () { return h('polygon', { points: '12,2 21,7 21,17 12,22 3,17 3,7' }); } },
    jade: { label: 'Jade', color: 'var(--gem-jade)', shape: function () { return h('rect', { x: 3.5, y: 3.5, width: 17, height: 17, rx: 3 }); } },
    ice: { label: 'Ice crystal', color: 'var(--gem-ice)', shape: function () { return h('circle', { cx: 12, cy: 12, r: 10 }); } },
    geode: { label: 'Geode', color: 'var(--gem-geode)', shape: function () { return h('polygon', { points: '12,3 22,20 2,20' }); } },
    bone: { label: 'Fossil bone', color: 'var(--gem-bone)', shape: function () { return h('polygon', { points: starPoints(12, 12.5, 11, 4.9) }); } }
  };

  function Gem(props) {
    var def = GEMS[props.kind] || GEMS.amber;
    var size = props.size || 40;
    return h('svg', { width: size, height: size, viewBox: '0 0 24 24', role: 'img', 'aria-label': def.label, className: 'dt-gem' },
      h('g', { fill: def.color, stroke: 'var(--bg-0)', strokeWidth: 1.25, strokeLinejoin: 'round' }, def.shape()),
      h('g', { fill: 'var(--bg-0)', fillOpacity: 0.28, transform: 'translate(12 12) scale(0.5) translate(-12 -12)' }, def.shape())
    );
  }

  /* ---------- Block: tier colour from the active era, plus notches ---------- */
  function Block(props) {
    var tier = Math.max(1, Math.min(5, props.tier || 1));
    var w = props.width || 56, ht = props.height || 28;
    var damage = props.damage || 0;
    var notches = [];
    for (var i = 0; i < tier; i++) notches.push(h('span', { key: i, className: 'dt-block__notch' }));
    var cracks = null;
    if (damage > 0) {
      var paths = ['M' + (w * 0.5) + ' 0 L' + (w * 0.42) + ' ' + (ht * 0.45) + ' L' + (w * 0.55) + ' ' + ht,
        'M' + (w * 0.42) + ' ' + (ht * 0.45) + ' L' + (w * 0.25) + ' ' + (ht * 0.7),
        'M' + (w * 0.55) + ' ' + (ht * 0.6) + ' L' + (w * 0.78) + ' ' + (ht * 0.3)];
      cracks = h('svg', { className: 'dt-block__cracks', width: w, height: ht, viewBox: '0 0 ' + w + ' ' + ht, 'aria-hidden': 'true' },
        paths.slice(0, damage > 0.66 ? 3 : damage > 0.33 ? 2 : 1).map(function (d, k) {
          return h('path', { key: k, d: d, fill: 'none', stroke: 'var(--era-field)', strokeWidth: 1.5, strokeLinecap: 'round' });
        }));
    }
    return h('div', {
      className: cx('dt-block', props.className),
      style: { width: w, height: ht, background: 'var(--era-tier-' + tier + ')' },
      role: 'img',
      'aria-label': 'Block, ' + tier + (tier === 1 ? ' hit point' : ' hit points')
    }, h('div', { className: 'dt-block__notches' }, notches), cracks);
  }

  /* ---------- AdOverlay: always labelled, real close control ---------- */
  function AdOverlay(props) {
    var secondsLeft = props.secondsLeft || 0;
    var canClose = secondsLeft <= 0;
    var rewarded = props.kind === 'rewarded';
    return h('section', { className: cx('dt-ad', props.className), 'aria-label': 'Advertisement' },
      h('div', { className: 'dt-ad__bar' },
        h('span', { className: 'dt-adtag caption' }, 'AD'),
        h('span', { className: 'dt-ad__status body-small dt-num' },
          canClose ? (rewarded ? 'Reward earned' : 'You can close this ad') : (rewarded ? 'Reward in ' : 'Close in ') + secondsLeft + 's'),
        h('button', {
          type: 'button',
          className: 'dt-ad__close',
          disabled: !canClose,
          onClick: props.onClose,
          'aria-label': canClose ? 'Close ad' : 'Close available in ' + secondsLeft + ' seconds'
        }, h(Glyph, { name: 'close', size: 22 }))
      ),
      h('div', { className: 'dt-ad__media body-small' }, props.children || 'Ad content plays here')
    );
  }

  /* ---------- ResultScreen: one template for win and lose ---------- */
  function Stars(props) {
    var out = [];
    for (var i = 0; i < 3; i++) {
      var on = i < props.count;
      out.push(h('svg', { key: i, width: 40, height: 40, viewBox: '0 0 24 24', className: cx('dt-star', on && 'dt-star--on'), 'aria-hidden': 'true' },
        h('polygon', { points: starPoints(12, 12.8, 11, 4.9) })));
    }
    return h('div', { className: 'dt-stars', role: 'img', 'aria-label': props.count + ' of 3 stars' }, out);
  }

  function ResultScreen(props) {
    var win = props.outcome !== 'lose';
    return h('section', { className: cx('dt-result', props.className) },
      h('div', { className: 'dt-result__head' },
        h('h2', { className: 'dt-result__title display' }, win ? 'Level complete' : 'Out of balls'),
        win ? h(Stars, { count: props.stars || 0 }) : null,
        h('p', { className: 'dt-result__score title dt-num' }, props.score),
        props.detail ? h('p', { className: 'dt-result__detail body-small' }, props.detail) : null
      ),
      props.offer ? h('div', { className: 'dt-result__offer' }, h(RewardButton, { benefit: props.offer, onClick: props.onOffer })) : null,
      h('div', { className: 'dt-result__actions' },
        win ? null : h(Button, { variant: 'secondary', onClick: props.onRetry }, 'Try again'),
        win ? h(Button, { variant: 'primary', onClick: props.onNext }, 'Next level') : null
      )
    );
  }

  /* ---------- HistoryPlayer: frame for a short history video ---------- */
  function HistoryPlayer(props) {
    var pct = Math.round(Math.max(0, Math.min(1, props.progress || 0)) * 100);
    return h('section', { className: cx('dt-player', props.className), 'aria-label': 'History video' },
      h('div', { className: 'dt-player__frame' }, props.children),
      h('div', { className: 'dt-player__meta' },
        h('span', { className: 'dt-player__era caption' }, props.era),
        h('p', { className: 'dt-player__caption body' }, props.caption)
      ),
      h('div', { className: 'dt-player__foot' },
        h('div', { className: 'dt-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct },
          h('div', { className: 'dt-progress__bar', style: { width: pct + '%' } })),
        h(Button, { variant: 'secondary', onClick: props.onSkip }, 'Skip')
      )
    );
  }

  /* ---------- ConsentSheet: two buttons of equal weight ---------- */
  function ConsentSheet(props) {
    return h('section', { className: cx('dt-sheet', props.className), role: 'dialog', 'aria-label': 'Ad choices' },
      h('h2', { className: 'dt-sheet__title title' }, 'Your ad choices'),
      h('p', { className: 'dt-sheet__body body' }, props.children || 'This game shows ads. Ads can be personalized using data from your device. You can change this later in Settings.'),
      h('div', { className: 'dt-sheet__actions' },
        h(Button, { variant: 'secondary', onClick: props.onAccept }, 'Accept'),
        h(Button, { variant: 'secondary', onClick: props.onManage }, 'Manage choices')
      )
    );
  }

  /* ---------- Modal and Toast ---------- */
  function Modal(props) {
    return h('div', { className: cx('dt-modal', props.inline && 'dt-modal--inline') },
      h('div', { className: 'dt-modal__card', role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title },
        h('h2', { className: 'dt-modal__title title' }, props.title),
        h('div', { className: 'dt-modal__body body' }, props.children),
        props.actions ? h('div', { className: 'dt-modal__actions' }, props.actions) : null
      )
    );
  }

  function Toast(props) {
    var tone = props.tone || 'info';
    var glyph = { info: 'info', success: 'check', error: 'warn' }[tone];
    return h('div', { className: cx('dt-toast', 'dt-toast--' + tone), role: 'status' },
      h(Glyph, { name: glyph, size: 20 }),
      h('span', { className: 'body-small' }, props.message)
    );
  }

  window.DeepTime = {
    Button: Button, RewardButton: RewardButton, Counter: Counter, Hud: Hud, Gem: Gem, Block: Block,
    AdOverlay: AdOverlay, ResultScreen: ResultScreen, HistoryPlayer: HistoryPlayer, ConsentSheet: ConsentSheet,
    Modal: Modal, Toast: Toast
  };
})();
