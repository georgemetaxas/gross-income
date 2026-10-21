// ══ STOOL SWAP ══
// Match-3 mini game: swap the weird stuff found in poo (corn, peas, a toy brick
// you swallowed in 1998) to make rows of three. Loaded only when someone opens it.
//
// window.StoolSwap.mount(el, { hourly: () => number, onExit: () => void })
// draws the game into el and returns { destroy() }.
(function () {
  const N = 8;
  const GOLD = 9;
  const PIECES = [
    { name: 'Soft serve', color: '#A0652F', desc: 'a classic' },
    { name: 'Corn', color: '#F5C842', desc: 'never digested, never will be' },
    { name: 'Pea', color: '#5DBB63', desc: 'went straight through' },
    { name: 'Toy brick', color: '#E0525B', desc: "so that's where it went" },
    { name: 'Marble', color: '#4FA3F7', desc: 'lost one in 1997' },
    { name: 'Gum', color: '#F48FB1', desc: 'mum did warn you' },
  ];
  // Add a level by adding a line. kinds = how many piece types are in play,
  // collect = [piece index, how many] on top of the score target.
  const LEVELS = [
    { name: 'The Morning Movement', moves: 18, kinds: 5, score: 3000 },
    { name: 'Corn Season', moves: 22, kinds: 5, score: 4000, collect: [1, 25] },
    { name: 'Mystery Bowl', moves: 24, kinds: 6, score: 4500, collect: [3, 25] },
  ];
  const PROGRESS_KEY = 'gi.stoolswap.v1';
  const MUTE_KEY = 'gi.stoolswap.muted';
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  const CSS = `
  .ss { position: relative; display: flex; flex-direction: column; height: 100%;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; color: var(--cream, #f5ead6); }
  .ss-hud { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; padding: 10px 14px;
    background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 16px; }
  .ss-stat { flex: 1; min-width: 0; }
  .ss-lbl { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; color: var(--muted, #a08060); text-transform: uppercase; }
  .ss-val { font-family: 'Bebas Neue', sans-serif; font-size: 24px; line-height: 1.05; letter-spacing: 1px; }
  .ss-val.green { color: var(--green, #4caf6e); }
  .ss-val.warn { color: #ff8a65; }
  .ss-mute { background: none; border: 1px solid rgba(245,200,66,0.2); border-radius: 50%; width: 36px; height: 36px;
    font-size: 16px; cursor: pointer; flex-shrink: 0; }
  .ss-goal { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; padding: 0 4px; }
  .ss-bar { flex: 1; height: 10px; background: var(--surface, #231a0a); border-radius: 6px; overflow: hidden; border: 1px solid rgba(224,123,0,0.25); }
  .ss-bar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #e07b00, #f5c842); border-radius: 6px; transition: width 0.3s; }
  .ss-goal-txt { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted, #a08060); white-space: nowrap; }
  .ss-collect { display: flex; align-items: center; gap: 4px; font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; }
  .ss-collect canvas { width: 22px; height: 22px; }
  .ss-collect[hidden] { display: none; }
  .ss-stage { flex: 1; min-height: 0; position: relative; display: flex; align-items: flex-start; justify-content: center; padding-top: 6px; }
  .ss-stage canvas { display: block; touch-action: none; }
  .ss-msg { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none;
    font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 3px; color: #1a1208; background: #f5c842;
    padding: 6px 18px; border-radius: 18px; white-space: nowrap; box-shadow: 0 0 24px rgba(245,200,66,0.6); }
  .ss-msg[hidden] { display: none; }
  .ss-msg.green { background: #4caf6e; box-shadow: 0 0 24px rgba(76,175,110,0.6); }
  .ss-hint { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
    color: var(--muted, #a08060); text-align: center; padding: 8px 0 0; }
  .ss-screen { position: absolute; inset: 0; z-index: 2; background: var(--bg, #1a1208); overflow-y: auto;
    display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 4px; }
  .ss-screen > :first-child { margin-top: auto; }
  .ss-screen > :last-child { margin-bottom: auto; }
  .ss-screen[hidden] { display: none; }
  .ss-hero { font-size: 72px; line-height: 1; filter: drop-shadow(0 0 24px rgba(245,200,66,0.45)); }
  .ss-title { font-family: 'Bebas Neue', sans-serif; font-size: 68px; line-height: 0.95; color: var(--gold, #f5c842); margin-top: 6px; }
  .ss-title.amber { color: var(--amber, #e07b00); }
  .ss-sub { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin: 8px 0 14px; }
  .ss-instr-text { font-size: 14px; line-height: 1.5; margin: 0 0 10px; }
  .ss-box { width: 100%; background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 20px;
    padding: 12px 14px; text-align: left; margin-bottom: 12px; }
  .ss-pieces { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
  .ss-piece { display: flex; align-items: center; gap: 8px; }
  .ss-piece canvas { width: 30px; height: 30px; flex-shrink: 0; }
  .ss-piece b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 17px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; }
  .ss-piece span { font-family: 'DM Mono', monospace; font-size: 9.5px; color: var(--muted, #a08060); line-height: 1.3; display: block; }
  .ss-levels { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-bottom: 4px; }
  .ss-level { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer;
    background: var(--surface, #231a0a); border: 1.5px solid rgba(245,200,66,0.45); border-radius: 16px; padding: 10px 14px; color: inherit; }
  .ss-level:disabled { opacity: 0.4; cursor: default; border-color: rgba(224,123,0,0.25); }
  .ss-level-n { font-family: 'Bebas Neue', sans-serif; font-size: 34px; color: var(--gold, #f5c842); width: 26px; text-align: center; }
  .ss-level-t { flex: 1; min-width: 0; }
  .ss-level-t b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 21px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; }
  .ss-level-t span { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted, #a08060); }
  .ss-stars { font-size: 14px; letter-spacing: 0; white-space: nowrap; }
  .ss-play { flex-shrink: 0; min-width: 64px; text-align: center; background: var(--gold, #f5c842); color: #1a1208; border-radius: 10px;
    padding: 8px 12px; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; line-height: 1; white-space: nowrap; }
  .ss-play.locked { background: none; color: var(--muted, #a08060); border: 1px solid rgba(224,123,0,0.35); letter-spacing: 0; font-size: 15px; }
  .ss-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
  .ss-grid .ss-val { font-size: 32px; }
  .ss-bigstars { font-size: 40px; letter-spacing: 6px; margin: 2px 0 10px; }
  .ss-btn { width: 100%; border: none; border-radius: 16px; background: var(--gold, #f5c842); color: #1a1208;
    font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 3px; padding: 14px; cursor: pointer; margin-top: 4px; }
  .ss-btn.ghost { background: transparent; color: var(--gold, #f5c842); border: 1.5px solid rgba(245,200,66,0.6); margin-top: 10px; }
  .ss-link { background: none; border: none; color: var(--muted, #a08060); font-family: 'DM Mono', monospace; font-size: 11px;
    letter-spacing: 1px; margin-top: 14px; cursor: pointer; text-decoration: underline; }
  `;

  function injectCss() {
    if (document.getElementById('ss-style')) return;
    const s = document.createElement('style');
    s.id = 'ss-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── SOUND ──
  // Web Audio only starts after a tap (iOS rule), so it's created on the first button press.
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
    whoosh(dur, vol) {
      if (this.muted || !this.ac) return;
      const ac = this.ac, t = ac.currentTime;
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = buf; f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(180, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f).connect(g).connect(ac.destination);
      src.start(t);
    },
    swap() { this.tone(420, 560, 0.06, 'sine', 0.06); },
    nope() { this.tone(180, 120, 0.15, 'square', 0.04); },
    plop(combo) { const f = 260 * Math.pow(1.12, Math.min(combo - 1, 8)); this.tone(f, f * 0.45, 0.09, 'sine', 0.1); },
    fart() { this.tone(95, 45, 0.6, 'sawtooth', 0.12, 28); },
    flush() { this.whoosh(0.8, 0.35); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.18, 'triangle', 0.08), i * 120)); },
  };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  // ── SPRITES ── (drawn into a size x size box)
  function drawPoo(x, s, base, dark) {
    const cx = s / 2, cy = s * 0.55;
    x.fillStyle = base; x.strokeStyle = dark; x.lineWidth = Math.max(1, s * 0.035);
    const blob = (y, rx, ry) => { x.beginPath(); x.ellipse(cx, cy + y * s, rx * s, ry * s, 0, 0, Math.PI * 2); x.fill(); x.stroke(); };
    blob(0.2, 0.4, 0.16);
    blob(0.03, 0.3, 0.14);
    blob(-0.13, 0.19, 0.11);
    x.beginPath();
    x.moveTo(cx - 0.08 * s, cy - 0.2 * s);
    x.quadraticCurveTo(cx + 0.02 * s, cy - 0.28 * s, cx + 0.1 * s, cy - 0.4 * s);
    x.quadraticCurveTo(cx + 0.1 * s, cy - 0.26 * s, cx + 0.1 * s, cy - 0.18 * s);
    x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.35)';
    x.beginPath(); x.ellipse(cx - 0.13 * s, cy + 0.16 * s, 0.09 * s, 0.035 * s, 0, 0, Math.PI * 2); x.fill();
  }

  function shine(x, cx, cy, r) {
    x.fillStyle = 'rgba(255,255,255,0.55)';
    x.beginPath(); x.ellipse(cx, cy, r, r * 0.6, -0.6, 0, Math.PI * 2); x.fill();
  }

  const DRAW = [
    // Soft serve
    (x, s) => drawPoo(x, s, '#A0652F', '#5A3414'),
    // Corn kernel: wide flat top, tapering to a point
    (x, s) => {
      const cx = s / 2;
      x.fillStyle = '#F5C842'; x.strokeStyle = '#B8860B'; x.lineWidth = Math.max(1, s * 0.04);
      x.beginPath();
      x.moveTo(cx - 0.3 * s, 0.28 * s);
      x.quadraticCurveTo(cx, 0.1 * s, cx + 0.3 * s, 0.28 * s);
      x.quadraticCurveTo(cx + 0.34 * s, 0.55 * s, cx + 0.08 * s, 0.86 * s);
      x.quadraticCurveTo(cx, 0.9 * s, cx - 0.08 * s, 0.86 * s);
      x.quadraticCurveTo(cx - 0.34 * s, 0.55 * s, cx - 0.3 * s, 0.28 * s);
      x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#FFF2B3';
      x.beginPath(); x.ellipse(cx, 0.28 * s, 0.2 * s, 0.07 * s, 0, 0, Math.PI * 2); x.fill();
      shine(x, cx - 0.12 * s, 0.48 * s, 0.05 * s);
    },
    // Pea
    (x, s) => {
      const cx = s / 2, cy = s / 2;
      const gr = x.createRadialGradient(cx - 0.1 * s, cy - 0.1 * s, 0.02 * s, cx, cy, 0.34 * s);
      gr.addColorStop(0, '#9BE37F'); gr.addColorStop(1, '#3E9A44');
      x.fillStyle = gr; x.strokeStyle = '#256B2A'; x.lineWidth = Math.max(1, s * 0.035);
      x.beginPath(); x.arc(cx, cy, 0.32 * s, 0, Math.PI * 2); x.fill(); x.stroke();
      shine(x, cx - 0.12 * s, cy - 0.13 * s, 0.07 * s);
    },
    // Toy brick
    (x, s) => {
      const w = 0.66 * s, h = 0.42 * s, l = (s - w) / 2, t = 0.36 * s;
      x.fillStyle = '#E0525B'; x.strokeStyle = '#8E2A31'; x.lineWidth = Math.max(1, s * 0.035);
      for (const sx of [l + w * 0.27, l + w * 0.73]) {
        x.beginPath(); x.rect(sx - 0.09 * s, t - 0.1 * s, 0.18 * s, 0.12 * s); x.fill(); x.stroke();
        x.fillStyle = '#F07C84';
        x.beginPath(); x.ellipse(sx, t - 0.1 * s, 0.09 * s, 0.035 * s, 0, 0, Math.PI * 2); x.fill(); x.stroke();
        x.fillStyle = '#E0525B';
      }
      x.beginPath();
      x.roundRect ? x.roundRect(l, t, w, h, s * 0.05) : x.rect(l, t, w, h);
      x.fill(); x.stroke();
      x.fillStyle = 'rgba(255,255,255,0.3)';
      x.fillRect(l + w * 0.08, t + h * 0.15, w * 0.1, h * 0.6);
    },
    // Marble
    (x, s) => {
      const cx = s / 2, cy = s / 2;
      const gr = x.createRadialGradient(cx - 0.1 * s, cy - 0.12 * s, 0.02 * s, cx, cy, 0.34 * s);
      gr.addColorStop(0, '#B6DBFF'); gr.addColorStop(0.5, '#4FA3F7'); gr.addColorStop(1, '#1E5FB4');
      x.fillStyle = gr; x.strokeStyle = '#163F78'; x.lineWidth = Math.max(1, s * 0.035);
      x.beginPath(); x.arc(cx, cy, 0.32 * s, 0, Math.PI * 2); x.fill(); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineWidth = s * 0.05; x.lineCap = 'round';
      x.beginPath(); x.arc(cx + 0.05 * s, cy + 0.03 * s, 0.17 * s, 0.4, 2.4); x.stroke();
      shine(x, cx - 0.12 * s, cy - 0.14 * s, 0.06 * s);
    },
    // Gum
    (x, s) => {
      x.fillStyle = '#F48FB1'; x.strokeStyle = '#B04A75'; x.lineWidth = Math.max(1, s * 0.035);
      const blobs = [[0.4, 0.58, 0.2], [0.6, 0.6, 0.18], [0.5, 0.45, 0.2], [0.33, 0.44, 0.13]];
      for (const [bx, by, r] of blobs) { x.beginPath(); x.arc(bx * s, by * s, r * s, 0, Math.PI * 2); x.fill(); x.stroke(); }
      x.fillStyle = '#F48FB1';
      for (const [bx, by, r] of blobs) { x.beginPath(); x.arc(bx * s, by * s, r * s - x.lineWidth, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = 'rgba(255,220,235,0.75)'; x.strokeStyle = '#D9709A';
      x.beginPath(); x.arc(0.66 * s, 0.32 * s, 0.11 * s, 0, Math.PI * 2); x.fill(); x.stroke();
      shine(x, 0.63 * s, 0.29 * s, 0.03 * s);
    },
  ];
  function drawGold(x, s) {
    x.shadowColor = 'rgba(245,200,66,0.95)'; x.shadowBlur = s * 0.18;
    drawPoo(x, s, '#F5C842', '#B8860B');
    x.shadowBlur = 0;
    x.fillStyle = '#FFF8D6';
    for (const [sx, sy] of [[0.2, 0.25], [0.82, 0.4], [0.75, 0.15]]) {
      x.beginPath(); x.moveTo(sx * s, (sy - 0.06) * s); x.lineTo((sx + 0.02) * s, sy * s); x.lineTo(sx * s, (sy + 0.06) * s);
      x.lineTo((sx - 0.02) * s, sy * s); x.closePath(); x.fill();
      x.beginPath(); x.moveTo((sx - 0.06) * s, sy * s); x.lineTo(sx * s, (sy + 0.02) * s); x.lineTo((sx + 0.06) * s, sy * s);
      x.lineTo(sx * s, (sy - 0.02) * s); x.closePath(); x.fill();
    }
  }

  function sprite(size, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size);
    draw(c.getContext('2d'), size);
    return c;
  }
  const icon = (k, px) => sprite(px, (x, s) => (k === GOLD ? drawGold : DRAW[k])(x, s));

  // ── BOARD LOGIC ──
  // Runs of 3+ in rows and columns. Golden poos never match; stinkers match by their piece.
  function findRuns(grid) {
    const runs = [];
    const kindAt = (r, c) => { const t = grid[r][c]; return t && t.k !== GOLD ? t.k : -1; };
    for (const horiz of [true, false]) {
      for (let a = 0; a < N; a++) {
        let start = 0;
        for (let b = 1; b <= N; b++) {
          const k0 = horiz ? kindAt(a, start) : kindAt(start, a);
          const k1 = b < N ? (horiz ? kindAt(a, b) : kindAt(b, a)) : -2;
          if (k1 === k0) continue;
          if (k0 >= 0 && b - start >= 3) {
            const cells = [];
            for (let i = start; i < b; i++) cells.push(horiz ? [a, i] : [i, a]);
            runs.push({ k: k0, cells });
          }
          start = b;
        }
      }
    }
    return runs;
  }

  function swapCells(grid, a, b) {
    const t = grid[a[0]][a[1]]; grid[a[0]][a[1]] = grid[b[0]][b[1]]; grid[b[0]][b[1]] = t;
  }

  // First swap that makes a match (or any golden poo), else null
  function findMove(grid) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (grid[r][c] && grid[r][c].k === GOLD) return [[r, c], c + 1 < N ? [r, c + 1] : [r, c - 1]];
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc;
        if (r2 >= N || c2 >= N) continue;
        swapCells(grid, [r, c], [r2, c2]);
        const hit = findRuns(grid).length > 0;
        swapCells(grid, [r, c], [r2, c2]);
        if (hit) return [[r, c], [r2, c2]];
      }
    }
    return null;
  }

  function mount(root, opts) {
    injectCss();
    const hourly = opts.hourly || (() => 0);
    root.innerHTML = `
      <div class="ss">
        <div class="ss-hud">
          <div class="ss-stat"><div class="ss-lbl">Moves</div><div class="ss-val" data-moves>0</div></div>
          <div class="ss-stat"><div class="ss-lbl">Score</div><div class="ss-val" data-score>0</div></div>
          <div class="ss-stat"><div class="ss-lbl">Paid to play</div><div class="ss-val green" data-paid>$0.00</div></div>
          <button type="button" class="ss-mute" data-mute aria-label="Sound"></button>
        </div>
        <div class="ss-goal">
          <div class="ss-bar"><i data-bar></i></div>
          <div class="ss-goal-txt" data-target></div>
          <div class="ss-collect" data-collect hidden></div>
        </div>
        <div class="ss-stage"><canvas></canvas><div class="ss-msg" hidden></div></div>
        <div class="ss-hint">Swipe a piece to swap it · match 3 or more</div>
        <div class="ss-screen" data-screen></div>
      </div>`;
    const $ = sel => root.querySelector(sel);
    const el = {
      stage: $('.ss-stage'), canvas: $('canvas'), msg: $('.ss-msg'), screen: $('[data-screen]'),
      moves: $('[data-moves]'), score: $('[data-score]'), paid: $('[data-paid]'),
      bar: $('[data-bar]'), target: $('[data-target]'), collect: $('[data-collect]'), mute: $('[data-mute]'),
    };
    const ctx = el.canvas.getContext('2d');

    let T = 40, S = 0, dpr = 1, sprites = [], goldImg = null, cellBg = null;
    const g = {
      state: 'title', lv: 0, L: LEVELS[0], grid: null, moves: 0, score: 0, got: 0, combo: 0, playSecs: 0, clock: 0,
      busy: false, next: null, wait: 0, sel: null, dying: [], parts: [], floats: [], idle: 0, hint: null,
    };
    let frame = null, last = 0, alive = true, hud = {}, msgTimer = 0, nextId = 1;

    // ── LAYOUT ──
    function layout() {
      const r = el.stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      T = Math.max(20, Math.floor(Math.min(r.width - 4, r.height - 4) / N));
      S = T * N;
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      el.canvas.width = S * dpr; el.canvas.height = S * dpr;
      el.canvas.style.width = S + 'px'; el.canvas.style.height = S + 'px';
      const px = T * dpr;
      sprites = DRAW.map((d, k) => icon(k, px));
      goldImg = icon(GOLD, px);
      cellBg = sprite(S * dpr, () => {});
      const b = cellBg.getContext('2d');
      b.fillStyle = '#231A0A';
      b.beginPath(); b.roundRect ? b.roundRect(0, 0, S * dpr, S * dpr, px * 0.35) : b.rect(0, 0, S * dpr, S * dpr); b.fill();
      b.fillStyle = 'rgba(245,234,214,0.035)';
      for (let rr = 0; rr < N; rr++) for (let cc = 0; cc < N; cc++) if ((rr + cc) % 2) b.fillRect(cc * px, rr * px, px, px);
      draw();
    }

    // ── SETUP ──
    function tile(k, r, sp) { return { id: nextId++, k, sp: sp || null, x: 0, y: r, vy: 0, s: 1, pop: 0 }; }
    function randKind() { return Math.floor(Math.random() * g.L.kinds); }

    function fillBoard() {
      for (let tries = 0; tries < 50; tries++) {
        const grid = [];
        for (let r = 0; r < N; r++) {
          grid.push([]);
          for (let c = 0; c < N; c++) {
            let k;
            do k = randKind();
            while ((c >= 2 && grid[r][c - 1].k === k && grid[r][c - 2].k === k) ||
                   (r >= 2 && grid[r - 1][c].k === k && grid[r - 2][c].k === k));
            const t = tile(k, r); t.x = c;
            t.y = r - N - 1 - (N - r) * 0.4; // drops in from above
            grid[r].push(t);
          }
        }
        if (findMove(grid)) return grid;
      }
      return g.grid;
    }

    function startLevel(i) {
      sound.init();
      g.lv = i; g.L = LEVELS[i];
      g.moves = g.L.moves; g.score = 0; g.got = 0; g.combo = 0; g.playSecs = 0;
      g.sel = null; g.dying = []; g.parts = []; g.floats = []; g.hint = null; g.idle = 0;
      g.grid = fillBoard();
      el.screen.hidden = true;
      g.state = 'play';
      flash(g.L.name.toUpperCase());
      busyThen(endTurn);
      renderGoal();
      startLoop();
    }

    function flash(text, green) {
      el.msg.textContent = text; el.msg.classList.toggle('green', !!green); el.msg.hidden = false;
      clearTimeout(msgTimer);
      msgTimer = setTimeout(() => { el.msg.hidden = true; }, 1100);
    }

    // Wait for everything to land, then run fn
    function busyThen(fn, wait) { g.busy = true; g.next = fn; g.wait = wait || 0; }

    // ── TURN FLOW ──
    function trySwap(a, b) {
      if (g.busy || g.state !== 'play') return;
      if (b[0] < 0 || b[0] >= N || b[1] < 0 || b[1] >= N) return;
      g.sel = null; g.hint = null; g.idle = 0;
      const grid = g.grid, ta = grid[a[0]][a[1]], tb = grid[b[0]][b[1]];
      if (!ta || !tb) return;
      swapCells(grid, a, b);
      sound.swap();
      busyThen(() => {
        if (ta.k === GOLD || tb.k === GOLD) {
          g.moves--; g.combo = 1;
          const clear = new Set();
          if (ta.k === GOLD && tb.k === GOLD) { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) clear.add(r * N + c); }
          else {
            const other = ta.k === GOLD ? tb : ta;
            clear.add(a[0] * N + a[1]); clear.add(b[0] * N + b[1]);
            for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c].k === other.k) clear.add(r * N + c);
          }
          sound.flush(); buzz([20, 40, 20]);
          flash('GOLDEN FLUSH!');
          explode(clear, [], [a[0] * N + a[1], b[0] * N + b[1]]);
          return;
        }
        const runs = findRuns(grid);
        if (!runs.length) {
          swapCells(grid, a, b);
          sound.nope(); buzz(15);
          busyThen(null);
          return;
        }
        g.moves--; g.combo = 1;
        resolve(runs, [a, b]);
      });
    }

    function resolve(runs, swapped) {
      const clear = new Set(), creates = [];
      const inRun = new Map();
      for (const run of runs) for (const [r, c] of run.cells) {
        const key = r * N + c;
        clear.add(key);
        inRun.set(key, (inRun.get(key) || 0) + 1);
      }
      for (const run of runs) {
        const len = run.cells.length;
        // Pivot: where you swapped, else where an L or T crosses, else the middle
        let pivot = run.cells.find(([r, c]) => swapped.some(s => s[0] === r && s[1] === c)) ||
                    run.cells.find(([r, c]) => inRun.get(r * N + c) > 1) ||
                    run.cells[Math.floor(len / 2)];
        const key = pivot[0] * N + pivot[1];
        if (creates.some(cr => cr.key === key)) continue;
        if (len >= 5) creates.push({ key, k: GOLD, sp: null });
        else if (len === 4 || inRun.get(key) > 1) creates.push({ key, k: run.k, sp: 'stink' });
      }
      sound.plop(g.combo);
      explode(clear, creates);
    }

    function commonKind() {
      const n = new Array(PIECES.length).fill(0);
      for (const row of g.grid) for (const t of row) if (t && t.k !== GOLD) n[t.k]++;
      return n.indexOf(Math.max(...n));
    }

    function explode(clear, creates, spent) {
      const grid = g.grid;
      // Set off any specials caught in the blast, which can set off more.
      // spent = golden poos that already went off by being swapped.
      const queue = [...clear], fired = new Set(spent);
      while (queue.length) {
        const key = queue.pop();
        if (fired.has(key)) continue;
        fired.add(key);
        const r = Math.floor(key / N), c = key % N, t = grid[r][c];
        if (!t || creates.some(cr => cr.key === key)) continue;
        const add = k2 => { if (!clear.has(k2)) { clear.add(k2); queue.push(k2); } };
        if (t.sp === 'stink') {
          sound.fart(); buzz(40);
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const r2 = r + dr, c2 = c + dc;
            if (r2 >= 0 && r2 < N && c2 >= 0 && c2 < N) add(r2 * N + c2);
          }
        } else if (t.k === GOLD && clear.size < N * N) {
          const k = commonKind();
          sound.flush();
          for (let r2 = 0; r2 < N; r2++) for (let c2 = 0; c2 < N; c2++) if (grid[r2][c2] && grid[r2][c2].k === k) add(r2 * N + c2);
        }
      }
      for (const cr of creates) {
        clear.delete(cr.key);
        const t = grid[Math.floor(cr.key / N)][cr.key % N];
        if (t) { t.k = cr.k; t.sp = cr.sp; t.pop = 1; }
      }
      let sx = 0, sy = 0, n = 0;
      for (const key of clear) {
        const r = Math.floor(key / N), c = key % N, t = grid[r][c];
        if (!t) continue;
        if (g.L.collect && t.k === g.L.collect[0]) g.got++;
        t.x = c; t.y = r;
        g.dying.push(t);
        grid[r][c] = null;
        sx += c; sy += r; n++;
        if (!still) for (let i = 0; i < 5; i++) {
          const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 4;
          g.parts.push({ x: c + 0.5, y: r + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, t: 0.5,
            color: t.k === GOLD ? '#F5C842' : PIECES[t.k].color });
        }
      }
      const pts = n * 20 * g.combo + (creates.length ? 40 : 0);
      g.score += pts;
      if (n) g.floats.push({ text: '+' + pts + (g.combo > 1 ? ' ×' + g.combo : ''), x: sx / n + 0.5, y: sy / n + 0.5, t: 0.9 });
      if (g.combo === 3) flash('STINKY COMBO!', true);
      else if (g.combo === 5) flash('ABSOLUTE SEWER!', true);
      busyThen(collapse, 0.05);
    }

    function collapse() {
      const grid = g.grid;
      for (let c = 0; c < N; c++) {
        let w = N - 1;
        for (let r = N - 1; r >= 0; r--) {
          if (grid[r][c]) { const t = grid[r][c]; grid[r][c] = null; grid[w][c] = t; w--; }
        }
        const missing = w + 1;
        for (let r = w; r >= 0; r--) {
          const t = tile(randKind(), r); t.x = c; t.y = r - missing - 0.3;
          grid[r][c] = t;
        }
      }
      busyThen(() => {
        const runs = findRuns(grid);
        if (runs.length) { g.combo++; resolve(runs, []); }
        else endTurn();
      });
    }

    function goalsMet() {
      return g.score >= g.L.score && (!g.L.collect || g.got >= g.L.collect[1]);
    }

    function endTurn() {
      renderGoal();
      if (goalsMet()) { g.busy = true; setTimeout(() => alive && win(), 500); return; }
      if (g.moves <= 0) { g.busy = true; setTimeout(() => alive && lose(), 500); return; }
      if (!findMove(g.grid)) {
        flash('STIRRING THE BOWL…');
        // Reshuffle until there's a move and no ready-made matches
        const all = [];
        for (const row of g.grid) for (const t of row) all.push(t);
        for (let tries = 0; tries < 100; tries++) {
          for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
          for (let i = 0; i < all.length; i++) g.grid[Math.floor(i / N)][i % N] = all[i];
          if (!findRuns(g.grid).length && findMove(g.grid)) break;
        }
        busyThen(endTurn, 0.3);
        return;
      }
      g.busy = false; g.idle = 0;
    }

    // ── UPDATE ──
    function update(dt) {
      g.clock += dt;
      if (g.state !== 'play') return;
      g.playSecs += dt;
      const grid = g.grid;
      let moving = false;
      const fall = still ? 60 : 38, slide = still ? 40 : 9;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const t = grid[r][c];
        if (!t) continue;
        if (t.x !== c) {
          const d = c - t.x, s = slide * dt;
          t.x = Math.abs(d) <= s ? c : t.x + Math.sign(d) * s;
          moving = true;
        }
        if (t.y !== r) {
          if (t.y < r) {
            t.vy += fall * dt; t.y += t.vy * dt;
            if (t.y >= r) { t.y = r; t.vy = 0; }
          } else {
            const s = slide * dt;
            t.y = t.y - r <= s ? r : t.y - s;
          }
          moving = true;
        }
        if (t.pop > 0) t.pop = Math.max(0, t.pop - dt * 3);
      }
      for (const t of g.dying) t.s -= dt * (still ? 12 : 5);
      g.dying = g.dying.filter(t => t.s > 0);
      if (g.dying.length) moving = true;
      for (const p of g.parts) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 14 * dt; }
      g.parts = g.parts.filter(p => p.t > 0);
      for (const f of g.floats) { f.t -= dt; f.y -= dt * 0.8; }
      g.floats = g.floats.filter(f => f.t > 0);

      if (g.busy && !moving && g.next !== undefined) {
        if ((g.wait -= dt) <= 0) {
          const fn = g.next; g.next = undefined;
          if (fn) fn(); else g.busy = false;
        }
      }
      if (!g.busy) {
        g.idle += dt;
        if (g.idle > 6 && !g.hint) g.hint = findMove(grid);
      }
    }

    // ── DRAW ──
    function draw() {
      if (!cellBg) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
      ctx.drawImage(cellBg, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!g.grid) return;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.clip();
      if (g.sel) {
        ctx.fillStyle = 'rgba(245,200,66,0.22)'; ctx.strokeStyle = '#F5C842'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(g.sel[1] * T + 2, g.sel[0] * T + 2, T - 4, T - 4, T * 0.2) : ctx.rect(g.sel[1] * T + 2, g.sel[0] * T + 2, T - 4, T - 4);
        ctx.fill(); ctx.stroke();
      }
      const hintIds = g.hint ? g.hint.map(([r, c]) => g.grid[r][c] && g.grid[r][c].id) : [];
      const drawTile = (t, scale) => {
        let cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T, s = T * 0.92 * scale, rot = 0;
        if (t.pop > 0) s *= 1 + Math.sin(t.pop * Math.PI) * 0.35;
        if (!still && hintIds.includes(t.id)) rot = Math.sin(g.clock * 14) * 0.18;
        if (t.sp === 'stink') {
          const pulse = still ? 1 : 1 + Math.sin(g.clock * 5 + t.id) * 0.08;
          const gr = ctx.createRadialGradient(cx, cy, T * 0.1, cx, cy, T * 0.5 * pulse);
          gr.addColorStop(0, 'rgba(140,220,90,0.55)'); gr.addColorStop(1, 'rgba(140,220,90,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, T * 0.5 * pulse, 0, Math.PI * 2); ctx.fill();
          if (!still) rot += Math.sin(g.clock * 9 + t.id) * 0.08;
        }
        const img = t.k === GOLD ? goldImg : sprites[t.k];
        if (rot) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.drawImage(img, -s / 2, -s / 2, s, s); ctx.restore(); }
        else ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s);
        if (t.sp === 'stink') {
          // stink lines
          ctx.strokeStyle = 'rgba(150,230,100,0.9)'; ctx.lineWidth = Math.max(1.5, T * 0.04); ctx.lineCap = 'round';
          const wob = still ? 0 : Math.sin(g.clock * 6 + t.id) * T * 0.03;
          for (const ox of [-0.18, 0, 0.18]) {
            ctx.beginPath();
            ctx.moveTo(cx + ox * T, cy - T * 0.28);
            ctx.quadraticCurveTo(cx + ox * T + T * 0.06 + wob, cy - T * 0.36, cx + ox * T, cy - T * 0.44);
            ctx.stroke();
          }
        }
      };
      for (const row of g.grid) for (const t of row) if (t && t.y > -1) drawTile(t, 1);
      for (const t of g.dying) drawTile(t, Math.max(0, t.s));
      for (const p of g.parts) {
        ctx.globalAlpha = Math.min(1, p.t * 2.5);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x * T, p.y * T, T * 0.06, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const f of g.floats) {
        ctx.globalAlpha = Math.min(1, f.t * 2);
        ctx.font = `${Math.round(T * 0.55)}px 'Bebas Neue', sans-serif`;
        ctx.lineWidth = 4; ctx.strokeStyle = '#1A1208'; ctx.strokeText(f.text, f.x * T, f.y * T);
        ctx.fillStyle = '#F5C842'; ctx.fillText(f.text, f.x * T, f.y * T);
      }
      ctx.globalAlpha = 1;
    }

    function renderHud() {
      const paid = '$' + (hourly() * g.playSecs / 3600).toFixed(2);
      if (hud.moves !== g.moves) {
        el.moves.textContent = hud.moves = g.moves;
        el.moves.classList.toggle('warn', g.moves <= 3);
      }
      if (hud.score !== g.score) {
        el.score.textContent = (hud.score = g.score).toLocaleString('en-US');
        el.bar.style.width = Math.min(100, g.score / g.L.score * 100) + '%';
      }
      if (hud.got !== g.got && g.L.collect) {
        hud.got = g.got;
        el.collect.lastChild.textContent = Math.max(0, g.L.collect[1] - g.got) || '✓';
      }
      if (hud.paid !== paid) el.paid.textContent = hud.paid = paid;
    }

    function renderGoal() {
      el.target.textContent = 'Lvl ' + (g.lv + 1) + ' · target ' + g.L.score.toLocaleString('en-US');
      el.collect.hidden = !g.L.collect;
      if (g.L.collect) {
        el.collect.innerHTML = '';
        el.collect.appendChild(icon(g.L.collect[0], 44));
        el.collect.appendChild(document.createElement('span'));
        hud.got = -1;
      }
      hud.score = -1;
    }

    function renderMute() { el.mute.textContent = sound.muted ? '🔇' : '🔊'; }

    // ── LOOP ──
    function tick(now) {
      frame = null;
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      update(dt);
      draw();
      renderHud();
      if (g.state === 'play') frame = requestAnimationFrame(tick);
    }
    function startLoop() {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }

    // ── SCREENS ──
    const progress = () => load(PROGRESS_KEY, { unlocked: 0, stars: [], best: [] });
    const starsFor = (L, score) => score >= L.score * 2 ? 3 : score >= L.score * 1.5 ? 2 : 1;
    const starStr = n => '⭐'.repeat(n) + '<span style="opacity:0.25">' + '⭐'.repeat(3 - n) + '</span>';

    function pieceRow(k, name, desc) {
      return `<div class="ss-piece" data-icon="${k}"><div><b>${name}</b><span>${desc}</span></div></div>`;
    }
    function fillIcons() {
      el.screen.querySelectorAll('[data-icon]').forEach(d => d.prepend(icon(+d.dataset.icon, 60)));
    }

    function titleScreen() {
      g.state = 'title';
      el.msg.hidden = true;
      const p = progress();
      el.screen.innerHTML = `
        <div class="ss-hero">🌽</div>
        <div class="ss-title">Stool Swap</div>
        <div class="ss-sub">Match 3 weird things found in poo</div>
        <div class="ss-levels">
          ${LEVELS.map((L, i) => `<button type="button" class="ss-level" data-lv="${i}" ${i > p.unlocked ? 'disabled' : ''}>
            <div class="ss-level-n">${i + 1}</div>
            <div class="ss-level-t"><b>${L.name}</b><span>${i > p.unlocked ? '🔒 Beat level ' + i + ' first' :
              L.moves + ' moves · ' + L.score.toLocaleString('en-US') + ' pts' + (L.collect ? ' · ' + L.collect[1] + ' ' + PIECES[L.collect[0]].name.toLowerCase() : '')}</span></div>
            <div class="ss-stars">${p.stars[i] ? starStr(p.stars[i]) : ''}</div>
            ${i > p.unlocked ? '<div class="ss-play locked" aria-label="Locked">🔒</div>' : '<div class="ss-play">Play ▶</div>'}
          </button>`).join('')}
        </div>
        <div class="ss-box" style="margin-top:8px">
          <div class="ss-lbl" style="margin-bottom:6px">Instructions</div>
          <div class="ss-instr-text">Swipe a piece onto its neighbour to make 3 or more in a row. Hit the level's target before your moves run out.</div>
          <div class="ss-lbl" style="margin-bottom:8px">What's in the bowl</div>
          <div class="ss-pieces">
            ${PIECES.map((pc, k) => pieceRow(k, pc.name, pc.desc)).join('')}
          </div>
          <div class="ss-lbl" style="margin:12px 0 8px">Specials</div>
          <div class="ss-pieces">
            ${pieceRow(0, 'Stinker', 'match 4 or an L. Blows up the 3×3 around it').replace('data-icon="0"', 'data-icon="0" data-stink')}
            ${pieceRow(GOLD, 'Golden poo', 'match 5. Swap it to flush every piece of that type')}
          </div>
        </div>`;
      el.screen.hidden = false;
      fillIcons();
      el.screen.querySelectorAll('[data-stink] canvas').forEach(c => { c.style.filter = 'drop-shadow(0 0 6px rgba(140,220,90,0.9))'; });
      el.screen.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => startLevel(+b.dataset.lv); });
    }

    function win() {
      g.state = 'over';
      // Leftover moves pay out
      const bonus = g.moves * 60;
      g.score += bonus;
      const stars = starsFor(g.L, g.score);
      const p = progress();
      p.stars[g.lv] = Math.max(p.stars[g.lv] || 0, stars);
      const record = g.score > (p.best[g.lv] || 0);
      if (record) p.best[g.lv] = g.score;
      p.unlocked = Math.max(p.unlocked, Math.min(g.lv + 1, LEVELS.length - 1));
      save(PROGRESS_KEY, p);
      sound.win(); buzz([30, 60, 30]);
      const more = g.lv + 1 < LEVELS.length;
      const paid = '$' + (hourly() * g.playSecs / 3600).toFixed(2);
      el.screen.innerHTML = `
        <div class="ss-hero">🚽</div>
        <div class="ss-title">Bowl Cleared!</div>
        <div class="ss-sub">Level ${g.lv + 1} · ${g.L.name}</div>
        <div class="ss-bigstars">${starStr(stars)}</div>
        <div class="ss-box ss-grid">
          <div><div class="ss-lbl">Score</div><div class="ss-val">${g.score.toLocaleString('en-US')}</div></div>
          <div><div class="ss-lbl">Spare moves</div><div class="ss-val" style="color:#f5c842">+${bonus}</div></div>
          <div><div class="ss-lbl">Paid to play</div><div class="ss-val green">${paid}</div></div>
          <div><div class="ss-lbl">Level record?</div><div class="ss-val" style="color:${record ? '#f5c842' : '#a08060'}">${record ? 'YES!' : 'Nah · ' + p.best[g.lv].toLocaleString('en-US')}</div></div>
        </div>
        ${more ? '<button type="button" class="ss-btn" data-next>▶ Next level</button>' :
          '<div class="ss-note" style="font-size:14px;opacity:0.8;margin-bottom:8px">That\'s every level so far. More bowls coming soon.</div>'}
        <button type="button" class="ss-btn ghost" data-again>↺ Play again</button>
        <button type="button" class="ss-link" data-levels>All levels</button>
        <button type="button" class="ss-link" data-exit style="margin-top:6px">Back to the bog timer</button>`;
      el.screen.hidden = false;
      wireEnd(more);
    }

    function lose() {
      g.state = 'over';
      const paid = '$' + (hourly() * g.playSecs / 3600).toFixed(2);
      const short = [];
      if (g.score < g.L.score) short.push((g.L.score - g.score).toLocaleString('en-US') + ' pts');
      if (g.L.collect && g.got < g.L.collect[1]) short.push((g.L.collect[1] - g.got) + ' ' + PIECES[g.L.collect[0]].name.toLowerCase());
      el.screen.innerHTML = `
        <div class="ss-hero" style="filter:drop-shadow(0 0 24px rgba(224,123,0,0.5))">🪠</div>
        <div class="ss-title amber">Backed Up!</div>
        <div class="ss-sub">Out of moves, ${short.join(' and ')} short</div>
        <div class="ss-box ss-grid">
          <div><div class="ss-lbl">Score</div><div class="ss-val">${g.score.toLocaleString('en-US')}</div></div>
          <div><div class="ss-lbl">Paid to play</div><div class="ss-val green">${paid}</div></div>
        </div>
        <button type="button" class="ss-btn" data-again>↺ Try again</button>
        <button type="button" class="ss-link" data-levels>All levels</button>
        <button type="button" class="ss-link" data-exit style="margin-top:6px">Back to the bog timer</button>`;
      el.screen.hidden = false;
      wireEnd(false);
    }

    function wireEnd(more) {
      const on = (sel, fn) => { const b = el.screen.querySelector(sel); if (b) b.onclick = fn; };
      if (more) on('[data-next]', () => startLevel(g.lv + 1));
      on('[data-again]', () => startLevel(g.lv));
      on('[data-levels]', titleScreen);
      on('[data-exit]', () => opts.onExit && opts.onExit());
    }

    // ── INPUT ──
    // Swipe a piece toward a neighbour, or tap one then tap a neighbour.
    let down = null;
    function cellAt(e) {
      const r = el.canvas.getBoundingClientRect();
      const c = Math.floor((e.clientX - r.left) / T), rr = Math.floor((e.clientY - r.top) / T);
      return rr >= 0 && rr < N && c >= 0 && c < N ? [rr, c] : null;
    }
    function onDown(e) {
      if (g.state !== 'play') return;
      const cell = cellAt(e);
      if (!cell) return;
      sound.init();
      down = { cell, x: e.clientX, y: e.clientY, moved: false };
      try { el.canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMove(e) {
      if (!down || down.moved) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < T * 0.3) return;
      down.moved = true;
      const [r, c] = down.cell;
      const to = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
      trySwap(down.cell, to);
    }
    function onUp() {
      if (!down) return;
      const d = down; down = null;
      if (d.moved || g.busy) return;
      const s = g.sel, [r, c] = d.cell;
      if (s && Math.abs(s[0] - r) + Math.abs(s[1] - c) === 1) trySwap(s, d.cell);
      else g.sel = s && s[0] === r && s[1] === c ? null : d.cell;
    }
    function onKey(e) { if (e.key === 'Escape' && opts.onExit) opts.onExit(); }
    function onVisible() { if (document.visibilityState === 'visible' && g.state === 'play') startLoop(); }

    el.mute.onclick = () => { sound.muted = !sound.muted; save(MUTE_KEY, sound.muted); sound.init(); renderMute(); };
    el.canvas.addEventListener('pointerdown', onDown);
    el.canvas.addEventListener('pointermove', onMove);
    el.canvas.addEventListener('pointerup', onUp);
    el.canvas.addEventListener('pointercancel', () => { down = null; });
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisible);
    const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
    if (ro) ro.observe(el.stage); else window.addEventListener('resize', layout);

    renderMute();
    titleScreen();
    layout();

    return {
      destroy() {
        alive = false;
        // Let the phone power the audio down; the next tap on Play wakes it
        if (sound.ac && sound.ac.state === 'running') sound.ac.suspend().catch(() => {});
        if (frame) cancelAnimationFrame(frame);
        clearTimeout(msgTimer);
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisible);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', layout);
        root.innerHTML = '';
      },
      _test: { g, swap: trySwap, move: () => findMove(g.grid) },
    };
  }

  window.StoolSwap = { mount, LEVELS };
})();
