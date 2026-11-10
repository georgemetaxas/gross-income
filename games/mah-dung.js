// ══ MAH-DUNG ══
// Tile-matching solitaire with a stack of bathroom tiles. Tap two matching tiles to
// clear them, but only tiles that are free: nothing on top, and open on the left or right.
// Clear the whole stack to win. Every deal can be solved; if you paint yourself into a
// corner the stack gets reshuffled.
// Loaded only when someone opens it.
//
// window.MahDung.mount(el, { hourly: () => number, onExit: () => void })
// draws the game into el and returns { destroy() }.
(function () {
  // Tile faces. Level n uses the first `faces` of these, 4 of each.
  // Heavy on the foods that send you running to the bog, plus cameos from the other
  // games: Turd Snake's menu and U-bend, the Fling Bonus monkey, Dung Run's plunger.
  const FACES = ['💩', '🌮', '🌶️', '☕', '🧻', '🍛', 'hot-sauce', '🌽', '🍕', '🌯', '🪠', '🐒', '🪰', '🥦', '🧀', '🥛', '🌀', '🫘'];
  // Faces with no emoji are drawn here instead (cartoon style, same outline as the logo)
  const FACE_ART = {
    'hot-sauce': '<svg viewBox="15 2 34 60" aria-hidden="true">'
      + '<path d="M27 4h10v9H27z" fill="#2e7d4a" stroke="#3f230c" stroke-width="3" stroke-linejoin="round"/>'
      + '<path d="M28 13h8v6c0 3 8 6 8 14v22c0 3-2 5-5 5H25c-3 0-5-2-5-5V33c0-8 8-11 8-14z" fill="#e5484d" stroke="#3f230c" stroke-width="3" stroke-linejoin="round"/>'
      + '<rect x="21.5" y="34" width="21" height="16" rx="3" fill="#f5ead6" stroke="#3f230c" stroke-width="2.5"/>'
      + '<path d="M32 37c3 3 4 5 2 8-1 2-4 2-5 0-1-2 1-3 1-5 1 1 2 2 2 3 1-2 0-4 0-6z" fill="#e07b00"/>'
      + '<ellipse cx="25.5" cy="27" rx="2" ry="5" fill="#fff" opacity="0.55" transform="rotate(12 25.5 27)"/></svg>',
  };
  const faceHtml = f => FACE_ART[f] || f;
  // Matching a pair of these pops up a one-liner
  const QUIPS = {
    '🌮': 'Taco Tuesday. Bog Wednesday.', '🌶️': 'Burns twice.', '☕': 'Morning coffee: nature\'s alarm clock.',
    '🍛': 'Extra hot vindaloo. Clear your diary.', '🫘': 'Beans, beans, good for the heart...', '🌯': 'One burrito, three toilet trips.',
    '🥛': 'Lactose intolerant? Brave.', '🌽': 'See you again tomorrow, corn.', '🧀': 'Cheese: the great blocker-upper.', 'hot-sauce': 'The hot sauce warning label was a suggestion.',
    '🥦': 'Fibre-rich. Very regular.', '💩': 'The main event.', '🍕': 'Servo pizza. Godspeed.',
    '🐒': 'Fling Bonus says hi.', '🌀': 'Straight round the U-bend.', '🪰': 'Lord of the flies.',
  };

  // Layouts: [layer, x, y] in half-tile steps, so a tile is 2 wide and 2 tall and can sit
  // half over the ones below. rect() lays out a block of tiles.
  function rect(layer, x0, y0, cols, rows) {
    const out = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) out.push([layer, x0 + i * 2, y0 + j * 2]);
    return out;
  }
  // Add a level by adding a line: tiles must be a multiple of 4, faces = tiles / 4.
  // par = seconds for 3 stars (2 stars inside double).
  const LEVELS = [
    { name: 'Half Flush', sub: '24 tiles · 2 layers', par: 60,
      tiles: [...rect(0, 0, 0, 5, 4), ...rect(1, 3, 2, 2, 2)] },
    { name: 'Full Flush', sub: '48 tiles · 2 layers', par: 180,
      tiles: [...rect(0, 0, 0, 6, 6), ...rect(1, 2, 3, 4, 3)] },
    { name: 'The Big Clog', sub: '72 tiles · 4 layers', par: 360,
      tiles: [...rect(0, 0, 0, 6, 8), ...rect(1, 2, 4, 4, 4), ...rect(2, 4, 5, 2, 3), ...rect(3, 4, 7, 2, 1)] },
  ];
  LEVELS.forEach(L => { L.faces = L.tiles.length / 4; });
  const HINT_SECS = 15;
  const PROGRESS_KEY = 'gi.mahdung.v1';
  const MUTE_KEY = 'gi.mahdung.muted';
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Branch previews unlock every level so they can all be tested
  const preview = /\.pages\.dev$|^localhost$|^127\./.test(location.hostname);

  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  const rnd = n => Math.floor(Math.random() * n);
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const clock = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const PLAY_ICON = '<svg width="0.8em" height="0.8em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-0.05em"><path d="M7 4.8v14.4a1.2 1.2 0 0 0 1.8 1l11.6-7.2a1.2 1.2 0 0 0 0-2L8.8 3.8A1.2 1.2 0 0 0 7 4.8z"/></svg>';
  const GRID_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>';
  const BACK_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>';

  // ── RULES ──
  // tiles: [{ l, x, y, face, gone }]. Free = nothing on top and nothing on the left or the right.
  function isFree(t, tiles) {
    let left = false, right = false;
    for (const o of tiles) {
      if (o === t || o.gone) continue;
      if (Math.abs(o.y - t.y) >= 2) continue;
      if (o.l === t.l + 1 && Math.abs(o.x - t.x) < 2) return false;
      if (o.l === t.l) {
        if (o.x === t.x - 2) left = true;
        else if (o.x === t.x + 2) right = true;
      }
    }
    return !(left && right);
  }

  // Deals by playing the game backwards: keep taking two random free tiles off the
  // stack, and give each pair taken the same face. That order of play always works,
  // so every deal can be cleared. faces = list of faces, one entry per pair.
  function deal(tiles, facePairs) {
    for (let attempt = 0; attempt < 300; attempt++) {
      tiles.forEach(t => { t.sim = false; });
      const live = tiles.filter(t => !t.gone);
      const order = [];
      let left = live.length, ok = true;
      while (left) {
        const free = live.filter(t => !t.sim && isFreeSim(t, live));
        if (free.length < 2) { ok = false; break; }
        const a = free.splice(rnd(free.length), 1)[0], b = free[rnd(free.length)];
        a.sim = b.sim = true;
        order.push([a, b]);
        left -= 2;
      }
      if (!ok) continue;
      const faces = shuffle(facePairs.slice());
      order.forEach(([a, b], i) => { a.face = b.face = faces[i]; });
      tiles.forEach(t => { delete t.sim; });
      return true;
    }
    return false;
  }
  function isFreeSim(t, live) {
    let left = false, right = false;
    for (const o of live) {
      if (o === t || o.sim) continue;
      if (Math.abs(o.y - t.y) >= 2) continue;
      if (o.l === t.l + 1 && Math.abs(o.x - t.x) < 2) return false;
      if (o.l === t.l) {
        if (o.x === t.x - 2) left = true;
        else if (o.x === t.x + 2) right = true;
      }
    }
    return !(left && right);
  }
  function findPair(tiles) {
    const free = tiles.filter(t => !t.gone && isFree(t, tiles));
    for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
      if (free[i].face === free[j].face) return [free[i], free[j]];
    }
    return null;
  }

  const CSS = `
  .md { position: relative; display: flex; flex-direction: column; height: 100%;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; color: var(--cream, #f5ead6); }
  .md-hud { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; padding: 10px 14px;
    background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 16px; }
  .md-stat { flex: 1; min-width: 0; }
  .md-lbl { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; color: var(--muted, #a08060); text-transform: uppercase; }
  .md-val { font-family: 'Bebas Neue', sans-serif; font-size: 24px; line-height: 1.05; letter-spacing: 1px; }
  .md-val.green { color: var(--green, #4caf6e); }
  .md-mute { background: none; border: 1px solid rgba(245,200,66,0.2); border-radius: 50%; width: 36px; height: 36px;
    font-size: 16px; cursor: pointer; flex-shrink: 0; }
  .md-stage { flex: 1; min-height: 0; position: relative; display: flex; align-items: center; justify-content: center; }
  .md-board { position: relative; }
  .md-tile { position: absolute; padding: 0; cursor: pointer; border-radius: 10px;
    border: 2.5px solid #3f230c; background: linear-gradient(170deg, #fffaf0 0%, #f5ead6 60%, #e9d6b0 100%); color: #1a1208;
    display: flex; align-items: center; justify-content: center; line-height: 1; overflow: visible;
    box-shadow: var(--d) var(--d) 0 -1px #f5c842, calc(var(--d) + 2px) calc(var(--d) + 2px) 0 -1px #3f230c,
      calc(var(--d) + 3px) calc(var(--d) + 4px) var(--blur, 6px) rgba(0,0,0,var(--shade, 0.35));
    transition: transform 0.12s, opacity 0.2s, filter 0.15s; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
  /* Cartoon shine, like the logo's highlight blobs */
  .md-tile::before { content: ''; position: absolute; left: 12%; top: 7%; width: 30%; height: 11%; border-radius: 50%;
    background: #fff; opacity: 0.85; transform: rotate(-14deg); pointer-events: none; }
  .md-tile svg { display: block; width: 0.85em; height: 1.25em; }
  .md-tile span { pointer-events: none; position: relative; filter: drop-shadow(0 1.5px 0 rgba(63,35,12,0.35)); }
  .md-tile.blocked { filter: brightness(0.66) saturate(0.6); }
  .md-tile.on { background: linear-gradient(170deg, #fff3b8, #f5c842); transform: translate(-2px, -4px) rotate(-3deg);
    box-shadow: var(--d) var(--d) 0 -1px #e07b00, calc(var(--d) + 2px) calc(var(--d) + 2px) 0 -1px #3f230c, 0 0 0 3px #e07b00, 0 8px 16px rgba(0,0,0,0.5); }
  .md-tile.hint { animation: mdHint 0.6s ease-in-out infinite alternate; }
  @keyframes mdHint { from { box-shadow: var(--d) var(--d) 0 -1px #f5c842, 0 0 0 2px rgba(76,175,110,0.4); }
    to { box-shadow: var(--d) var(--d) 0 -1px #f5c842, 0 0 0 6px #4caf6e; } }
  .md-tile.nope { animation: mdNope 0.3s; }
  @keyframes mdNope { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  .md-tile.gone { opacity: 0; transform: scale(0.6) translateY(-12px); pointer-events: none; }
  @media (prefers-reduced-motion: reduce) { .md-tile { transition: none; } .md-tile.hint, .md-tile.nope { animation: none; }
    .md-tile.hint { box-shadow: 0 0 0 4px #4caf6e; } }
  .md-toast { position: absolute; left: 50%; top: 0; transform: translateX(-50%); pointer-events: none; max-width: 94%; z-index: 900;
    background: #1a1208; border: 1.5px solid #f5c842; color: var(--cream, #f5ead6); border-radius: 14px; padding: 7px 14px;
    font-size: 13px; line-height: 1.3; text-align: center; box-shadow: 0 6px 20px rgba(0,0,0,0.5); }
  .md-toast[hidden] { display: none; }
  .md-bar { display: flex; gap: 8px; flex-shrink: 0; padding-top: 10px; }
  .md-btn2 { flex: 1; background: transparent; color: var(--gold, #f5c842); border: 1.5px solid rgba(245,200,66,0.5); border-radius: 12px;
    font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; padding: 9px; cursor: pointer; }
  .md-btn2:disabled { opacity: 0.35; cursor: default; }
  .md-screen { position: absolute; inset: 0; z-index: 1000; background: var(--bg, #1a1208); overflow-y: auto;
    display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 4px; }
  .md-screen > :first-child { margin-top: auto; }
  .md-screen > :last-child { margin-bottom: auto; }
  .md-screen[hidden] { display: none; }
  .md-hero { font-size: 72px; line-height: 1; filter: drop-shadow(0 0 24px rgba(245,200,66,0.45)); }
  .md-title { font-family: 'Bebas Neue', sans-serif; font-size: 68px; line-height: 0.95; color: var(--gold, #f5c842); margin-top: 6px; }
  .md-sub { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin: 8px 0 14px; }
  .md-box { width: 100%; background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 20px;
    padding: 12px 14px; text-align: left; margin-bottom: 12px; }
  .md-instr-text { font-size: 14px; line-height: 1.5; margin: 0 0 4px; }
  .md-levels { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-bottom: 4px; }
  .md-level { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer;
    background: var(--surface, #231a0a); border: 1.5px solid rgba(245,200,66,0.45); border-radius: 16px; padding: 10px 14px; color: inherit; }
  .md-level:disabled { opacity: 0.4; cursor: default; border-color: rgba(224,123,0,0.25); }
  .md-level-n { font-family: 'Bebas Neue', sans-serif; font-size: 34px; color: var(--gold, #f5c842); width: 26px; text-align: center; }
  .md-level-t { flex: 1; min-width: 0; }
  .md-level-t b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 21px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; }
  .md-level-t span { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted, #a08060); }
  .md-stars { font-size: 14px; letter-spacing: 0; white-space: nowrap; }
  .md-play { flex-shrink: 0; min-width: 64px; text-align: center; background: var(--gold, #f5c842); color: #1a1208; border-radius: 10px;
    padding: 8px 12px; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; line-height: 1; white-space: nowrap; }
  .md-play.locked { background: none; color: var(--muted, #a08060); border: 1px solid rgba(224,123,0,0.35); letter-spacing: 0; font-size: 15px; }
  .md-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
  .md-grid .md-val { font-size: 32px; }
  .md-bigstars { font-size: 40px; letter-spacing: 6px; margin: 2px 0 10px; }
  .md-btn { width: 100%; border: none; border-radius: 12px; background: var(--gold, #f5c842); color: #1a1208;
    font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 3px; padding: 14px; cursor: pointer; margin-top: 4px; }
  .md-btn.ghost { background: transparent; color: var(--gold, #f5c842); border: 1.5px solid rgba(245,200,66,0.6); margin-top: 20px; }
  .md-link { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent;
    color: var(--cream, #f5ead6); border: none; border-radius: 12px; font-family: 'Bebas Neue', sans-serif;
    font-size: 19px; letter-spacing: 2px; padding: 12px 14px; margin-top: 20px; cursor: pointer; }
  .md-link svg { color: var(--gold, #f5c842); flex: 0 0 auto; margin-top: -2px; }
  `;

  function injectCss() {
    if (document.getElementById('md-style')) return;
    const s = document.createElement('style');
    s.id = 'md-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── SOUND ──
  // Web Audio only starts after a tap (iOS rule), so it's created on the first touch.
  const sound = {
    ac: null, muted: load(MUTE_KEY, false),
    init() {
      if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
      if (this.ac.state === 'suspended') this.ac.resume();
    },
    tone(f0, f1, dur, type, vol, lfo) {
      if (this.muted || !this.ac) return;
      const ac = this.ac, t = ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      if (lfo) {
        const l = ac.createOscillator(), lg = ac.createGain();
        l.frequency.value = lfo; lg.gain.value = f0 * 0.3;
        l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur);
      }
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(ac.destination);
      o.start(t); o.stop(t + dur + 0.02);
    },
    click() { this.tone(1400, 1100, 0.04, 'square', 0.025); },
    nope() { this.tone(180, 120, 0.15, 'square', 0.04); },
    plop() { this.tone(340, 120, 0.16, 'sine', 0.13); },
    fart() { this.tone(95, 45, 0.5, 'sawtooth', 0.1, 28); },
    flush() { this.tone(900, 120, 0.9, 'sawtooth', 0.035, 40); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.18, 'triangle', 0.08), i * 120)); },
  };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  function mount(root, opts) {
    injectCss();
    const hourly = opts.hourly || (() => 0);
    root.innerHTML = `
      <div class="md">
        <div class="md-hud">
          <div class="md-stat"><div class="md-lbl">Tiles left</div><div class="md-val" data-left>0</div></div>
          <div class="md-stat"><div class="md-lbl">Time</div><div class="md-val" data-time>0:00</div></div>
          <div class="md-stat"><div class="md-lbl">Paid to play</div><div class="md-val green" data-paid>$0.00</div></div>
          <button type="button" class="md-mute" data-mute aria-label="Sound"></button>
        </div>
        <div class="md-stage">
          <div class="md-board"></div>
          <div class="md-toast" hidden></div>
        </div>
        <div class="md-bar">
          <button type="button" class="md-btn2" data-hint>💨 Hint (+${HINT_SECS}s)</button>
          <button type="button" class="md-btn2" data-undo>↶ Undo</button>
        </div>
        <div class="md-screen" data-screen></div>
      </div>`;
    const $ = sel => root.querySelector(sel);
    const el = {
      stage: $('.md-stage'), board: $('.md-board'), toast: $('.md-toast'), screen: $('[data-screen]'),
      left: $('[data-left]'), time: $('[data-time]'), paid: $('[data-paid]'), mute: $('[data-mute]'),
      hint: $('[data-hint]'), undo: $('[data-undo]'),
    };

    const g = {
      state: 'title', lv: 0, L: LEVELS[0], tiles: [], sel: null, history: [],
      secs: 0, penalty: 0, hints: 0, shuffles: 0,
    };
    let alive = true, timer = 0, last = 0, toastTimer = 0, hintTimer = 0, endTimer = 0;

    // ── LAYOUT ──
    // Each layer shifts up-left by a little so the stack looks 3D
    function layout() {
      if (!g.tiles.length) return;
      const r = el.stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const ts = g.tiles;
      const maxX = Math.max(...ts.map(t => t.x)) + 2, maxY = Math.max(...ts.map(t => t.y)) + 2;
      const maxL = Math.max(...ts.map(t => t.l));
      const ASPECT = 1.25, DEPTH = 0.12; // tile height / width, layer shift / width
      // Board width = maxX/2 tiles + layer shifts; height likewise
      const byW = (r.width - 8) / (maxX / 2 + maxL * DEPTH + DEPTH);
      const byH = (r.height - 8) / ((maxY / 2) * ASPECT + maxL * DEPTH + DEPTH);
      const tw = Math.floor(Math.min(byW, byH, 84)), th = Math.round(tw * ASPECT), d = Math.max(3, Math.round(tw * DEPTH));
      const bw = (maxX / 2) * tw + maxL * d + d, bh = (maxY / 2) * th + maxL * d + d;
      el.board.style.width = bw + 'px'; el.board.style.height = bh + 'px';
      el.board.style.setProperty('--d', Math.round(d * 0.6) + 'px');
      ts.forEach(t => {
        const b = t.el;
        if (!b) return;
        b.style.left = (t.x / 2 * tw + (maxL - t.l) * d) + 'px';
        b.style.top = (t.y / 2 * th + (maxL - t.l) * d) + 'px';
        b.style.width = (tw - 2) + 'px';
        b.style.height = (th - 2) + 'px';
        b.style.fontSize = Math.round(tw * 0.6) + 'px';
        // Higher layers cast a bigger shadow so the stack reads as a stack
        b.style.setProperty('--blur', (6 + t.l * 5) + 'px');
        b.style.setProperty('--shade', (0.35 + t.l * 0.1).toFixed(2));
      });
    }

    function build() {
      el.board.innerHTML = '';
      // Higher layers on top; on a layer, tiles to the right and below cover the edge of the one before
      g.tiles.slice().sort((a, b) => a.l - b.l || a.y - b.y || a.x - b.x).forEach((t, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'md-tile';
        b.style.zIndex = i + 1;
        b.innerHTML = `<span>${faceHtml(t.face)}</span>`;
        b.onclick = () => tap(t);
        t.el = b;
        el.board.appendChild(b);
      });
      layout();
      paint();
    }

    // Blocked tiles are dimmed so it's clear what can be played
    function paint() {
      g.tiles.forEach(t => {
        if (!t.el) return;
        const sp = t.el.querySelector('span');
        if (sp.dataset.f !== t.face) { sp.innerHTML = faceHtml(t.face); sp.dataset.f = t.face; }
        t.el.classList.toggle('gone', !!t.gone);
        t.el.hidden = !!t.gone && t.el.dataset.out === '1';
        const free = !t.gone && isFree(t, g.tiles);
        t.el.classList.toggle('blocked', !t.gone && !free);
        t.el.classList.toggle('on', g.sel === t);
        t.el.setAttribute('aria-label', (FACE_ART[t.face] ? t.face.replace('-', ' ') : t.face) + (free ? '' : ' (blocked)'));
      });
    }

    function renderHud() {
      el.left.textContent = g.tiles.filter(t => !t.gone).length;
      el.time.textContent = clock(g.secs + g.penalty);
      el.paid.textContent = '$' + (hourly() * g.secs / 3600).toFixed(2);
      el.undo.disabled = !g.history.length || g.state !== 'play';
      el.hint.disabled = g.state !== 'play';
    }
    function renderMute() { el.mute.textContent = sound.muted ? '🔇' : '🔊'; }
    function toast(html, ms) {
      clearTimeout(toastTimer);
      el.toast.innerHTML = html;
      el.toast.hidden = false;
      toastTimer = setTimeout(() => { el.toast.hidden = true; }, ms || 2200);
    }
    function clearHint() {
      clearTimeout(hintTimer);
      g.tiles.forEach(t => t.el && t.el.classList.remove('hint'));
    }

    // ── GAME ──
    function facePairs(n) {
      const out = [];
      for (let k = 0; k < n / 2; k++) out.push(FACES[k % g.L.faces]);
      return out;
    }

    function startLevel(i) {
      sound.init();
      clearTimeout(endTimer);
      g.lv = i; g.L = LEVELS[i];
      g.tiles = g.L.tiles.map(([l, x, y]) => ({ l, x, y, face: '', gone: false, el: null }));
      if (!deal(g.tiles, facePairs(g.tiles.length))) return;
      g.sel = null; g.history = []; g.secs = 0; g.penalty = 0; g.hints = 0; g.shuffles = 0;
      el.toast.hidden = true;
      el.screen.hidden = true;
      g.state = 'play';
      build();
      renderHud();
      last = performance.now();
      clearInterval(timer);
      timer = setInterval(tickClock, 250);
    }

    function tickClock() {
      const now = performance.now();
      // A locked phone or a long pause doesn't count
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      if (g.state === 'play' && document.visibilityState === 'visible') g.secs += dt;
      renderHud();
    }

    function tap(t) {
      if (g.state !== 'play' || t.gone) return;
      sound.init();
      if (!isFree(t, g.tiles)) {
        sound.nope();
        if (!still) { t.el.classList.remove('nope'); void t.el.offsetWidth; t.el.classList.add('nope'); }
        toast("That one's stuck. Tiles need nothing on top and a free side.", 1800);
        return;
      }
      if (!g.sel) { g.sel = t; sound.click(); paint(); return; }
      if (g.sel === t) { g.sel = null; paint(); return; }
      if (g.sel.face !== t.face) { g.sel = t; sound.click(); paint(); return; }
      // A pair
      const a = g.sel, b = t;
      g.sel = null;
      a.gone = b.gone = true;
      g.history.push([a, b]);
      clearHint();
      sound.plop(); buzz(20);
      if (QUIPS[a.face] && Math.random() < 0.6) toast(QUIPS[a.face], 1600);
      paint();
      renderHud();
      // Hide the faded tiles once their fade is done so they can't be tapped
      const out = () => { [a, b].forEach(x => { if (x.gone && x.el) { x.el.dataset.out = '1'; x.el.hidden = true; } }); };
      if (still) out(); else setTimeout(out, 220);
      if (g.tiles.every(x => x.gone)) { win(); return; }
      if (!findPair(g.tiles)) stuck();
    }

    // Nothing left to match: put the remaining faces back in a fresh, solvable order
    function stuck() {
      g.state = 'shuffling';
      renderHud();
      toast('<b>Clogged!</b> No pairs left, so the stack gets a flush and a shuffle.', 2400);
      sound.flush();
      endTimer = setTimeout(() => {
        if (!alive) return;
        reshuffle();
        g.state = 'play';
        last = performance.now();
        renderHud();
      }, 1300);
    }
    function reshuffle() {
      const live = g.tiles.filter(t => !t.gone);
      const pairs = [];
      const byFace = {};
      live.forEach(t => { byFace[t.face] = (byFace[t.face] || 0) + 1; });
      Object.entries(byFace).forEach(([f, n]) => { for (let k = 0; k < n / 2; k++) pairs.push(f); });
      deal(g.tiles, pairs);
      g.shuffles++;
      g.history = []; // old moves don't line up with the new faces
      g.sel = null;
      paint();
    }

    function hint() {
      if (g.state !== 'play') return;
      sound.init();
      const p = findPair(g.tiles);
      if (!p) { stuck(); return; }
      clearHint();
      p.forEach(t => t.el.classList.add('hint'));
      hintTimer = setTimeout(clearHint, 3500);
      g.penalty += HINT_SECS; g.hints++;
      sound.fart();
      renderHud();
    }

    function undo() {
      if (g.state !== 'play' || !g.history.length) return;
      const [a, b] = g.history.pop();
      [a, b].forEach(t => { t.gone = false; if (t.el) { delete t.el.dataset.out; t.el.hidden = false; } });
      g.sel = null;
      clearHint();
      sound.click();
      paint();
      renderHud();
    }

    // ── SCREENS ──
    const progress = () => load(PROGRESS_KEY, { unlocked: 0, stars: [], best: [] });
    const starsFor = (L, secs) => secs <= L.par ? 3 : secs <= L.par * 2 ? 2 : 1;
    const starStr = n => '⭐'.repeat(n) + '<span style="opacity:0.25">' + '⭐'.repeat(3 - n) + '</span>';

    function titleScreen() {
      g.state = 'title';
      clearInterval(timer);
      clearTimeout(endTimer);
      const p = progress();
      const open = i => preview || i <= p.unlocked;
      el.screen.innerHTML = `
        <div class="md-hero"><img class="game-hero-art" src="icons/games/mah-dung.svg" alt="" width="112" height="112"></div>
        <div class="md-title">Mah-Dung</div>
        <div class="md-sub">Match the tiles, clear the bog</div>
        <div class="md-levels">
          ${LEVELS.map((L, i) => `<button type="button" class="md-level" data-lv="${i}" ${open(i) ? '' : 'disabled'}>
            <div class="md-level-n">${i + 1}</div>
            <div class="md-level-t"><b>${L.name}</b><span>${open(i) ? L.sub + (p.best[i] ? ' · best ' + clock(p.best[i]) : '') : '🔒 Clear level ' + i + ' first'}</span></div>
            <div class="md-stars">${p.stars[i] ? starStr(p.stars[i]) : ''}</div>
            ${open(i) ? `<div class="md-play">Play ${PLAY_ICON}</div>` : '<div class="md-play locked" aria-label="Locked">🔒</div>'}
          </button>`).join('')}
        </div>
        <div class="md-box" style="margin-top:8px">
          <div class="md-lbl" style="margin-bottom:6px">Instructions</div>
          <div class="md-instr-text">Tap two matching tiles to clear them. Clear the whole stack to win.</div>
          <div class="md-instr-text">You can only take a tile that's free: nothing on top of it, and nothing on its left or its right. Stuck tiles look darker.</div>
          <div class="md-instr-text">Every stack can be cleared. 💨 Hint shows a pair but adds ${HINT_SECS} seconds. No pairs left? The stack gets shuffled for you.</div>
        </div>`;
      el.screen.hidden = false;
      el.screen.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => startLevel(+b.dataset.lv); });
    }

    function win() {
      g.state = 'won';
      clearInterval(timer);
      renderHud();
      const total = Math.round(g.secs + g.penalty);
      const stars = starsFor(g.L, total);
      const p = progress();
      p.stars[g.lv] = Math.max(p.stars[g.lv] || 0, stars);
      const record = !p.best[g.lv] || total < p.best[g.lv];
      if (record) p.best[g.lv] = total;
      p.unlocked = Math.max(p.unlocked, Math.min(g.lv + 1, LEVELS.length - 1));
      save(PROGRESS_KEY, p);
      sound.flush();
      setTimeout(() => sound.win(), 500);
      buzz([30, 60, 30]);
      const more = g.lv + 1 < LEVELS.length;
      const paid = '$' + (hourly() * g.secs / 3600).toFixed(2);
      endTimer = setTimeout(() => {
        if (!alive) return;
        el.screen.innerHTML = `
          <div class="md-hero">🚽✨</div>
          <div class="md-title">Bog Cleared!</div>
          <div class="md-sub">Level ${g.lv + 1} · ${g.L.name}</div>
          <div class="md-bigstars">${starStr(stars)}</div>
          <div class="md-box md-grid">
            <div><div class="md-lbl">Time</div><div class="md-val">${clock(total)}</div></div>
            <div><div class="md-lbl">Paid to play</div><div class="md-val green">${paid}</div></div>
            <div><div class="md-lbl">Hints</div><div class="md-val">${g.hints ? g.hints + ' · +' + g.hints * HINT_SECS + 's' : 'None'}</div></div>
            <div><div class="md-lbl">Level record?</div><div class="md-val" style="color:${record ? '#f5c842' : '#a08060'}">${record ? 'YES!' : 'Nah · ' + clock(p.best[g.lv])}</div></div>
          </div>
          ${more ? `<button type="button" class="md-btn" data-next>${PLAY_ICON} Next level</button>` : ''}
          <button type="button" class="md-btn ${more ? 'ghost' : ''}" data-again>↺ New stack</button>
          <button type="button" class="md-link" data-levels>${GRID_ICON}All levels</button>
          <button type="button" class="md-link" data-exit>${BACK_ICON}Back to the bog timer</button>`;
        el.screen.hidden = false;
        el.screen.scrollTop = 0;
        const on = (sel, fn) => { const b = el.screen.querySelector(sel); if (b) b.onclick = fn; };
        if (more) on('[data-next]', () => startLevel(g.lv + 1));
        on('[data-again]', () => startLevel(g.lv));
        on('[data-levels]', titleScreen);
        on('[data-exit]', () => opts.onExit && opts.onExit());
      }, 900);
    }

    function onKey(e) { if (e.key === 'Escape' && opts.onExit) opts.onExit(); }
    function onVisible() { last = performance.now(); }

    el.mute.onclick = () => { sound.muted = !sound.muted; save(MUTE_KEY, sound.muted); sound.init(); renderMute(); };
    el.hint.onclick = hint;
    el.undo.onclick = undo;
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisible);
    const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
    if (ro) ro.observe(el.stage); else window.addEventListener('resize', layout);

    renderMute();
    titleScreen();

    return {
      destroy() {
        alive = false;
        if (sound.ac && sound.ac.state === 'running') sound.ac.suspend().catch(() => {});
        clearInterval(timer);
        clearTimeout(toastTimer);
        clearTimeout(hintTimer);
        clearTimeout(endTimer);
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisible);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', layout);
        root.innerHTML = '';
      },
      _test: { g, tap, start: startLevel, findPair, isFree },
    };
  }

  window.MahDung = { mount, LEVELS, deal, isFree };
})();
