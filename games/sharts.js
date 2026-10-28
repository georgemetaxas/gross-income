// ══ SHARTS ══
// Pub darts, bog edition. The dartboard hangs inside a toilet seat on the
// bathroom wall. Drag to aim, let go to throw. Your hand wobbles, it gets
// worse the longer you hold, and on some levels a draught (you know the one)
// pushes the dart sideways. Loaded only when someone opens it.
//
// window.Sharts.mount(el, { hourly: () => number, onExit: () => void })
// draws the game into el and returns { destroy() }.
(function () {
  // Everything runs in a world 300 wide, scaled to fit the screen. Its height
  // follows the screen's shape (450 to 640) and is set when a level starts.
  const W = 300;
  let H = 450, BY = 180;
  const BX = 150, R = 96;            // board centre x and radius (outside of the double ring)
  const SEAT_IN = 1.18;              // black surround with the numbers, in board radii
  const SEAT_W = 1.34, SEAT_H = 1.46; // toilet seat oval around it
  const BOX = 1.58;                   // half the board picture's size, in board radii
  // Real dartboard rings, as a share of R
  const RING = { bull: 0.037, outer: 0.094, tIn: 0.582, tOut: 0.629, dIn: 0.953 };
  const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const DRIFT = 7;                   // world units a dart is pushed per unit of wind
  function setHeight(h) {
    H = h;
    BY = Math.round(Math.max(178, Math.min(H * 0.42, H - 250)));
  }
  // Add a level by adding a line.
  //   darts = darts you get, wobble = how far your hand drifts, wind = strongest draught,
  //   slide = how far the seat swings side to side (0 = still).
  //   score levels: stars = points needed for 1, 2, 3 stars (1 star passes).
  //   count levels: start = where you count down from, stars = most darts used for 3, 2, 1 stars.
  const LEVELS = [
    { name: 'First Drop', sub: '9 darts · score 150 to pass', mode: 'score', darts: 9, wobble: 7, wind: 0, slide: 0, stars: [150, 220, 300] },
    { name: 'Curry Shakes', sub: '9 darts · shakier hands', mode: 'score', darts: 9, wobble: 13, wind: 0, slide: 0, stars: [150, 220, 300] },
    { name: 'Gale Force Guff', sub: '9 darts · mind the draught', mode: 'score', darts: 9, wobble: 8, wind: 3, slide: 0, stars: [150, 220, 300] },
    { name: 'Wobbly Seat', sub: '9 darts · the seat swings', mode: 'score', darts: 9, wobble: 8, wind: 0, slide: 34, stars: [140, 210, 280] },
    { name: '301 Blowout', sub: 'Hit exactly 0 · 18 darts', mode: 'count', start: 301, darts: 18, wobble: 8, wind: 1.5, slide: 0, stars: [9, 12, 18] },
  ];
  const PROGRESS_KEY = 'gi.sharts.v1';
  const MUTE_KEY = 'gi.sharts.muted';
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Branch previews and localhost open every level for testing
  const preview = /\.pages\.dev$|^localhost$|^127\./.test(location.hostname);

  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  // Where a dart landed, relative to the board centre → { pts, label, ring }
  function scoreAt(dx, dy) {
    const r = Math.hypot(dx, dy) / R;
    if (r <= RING.bull) return { pts: 50, label: 'BULLSHART!', ring: 'bull' };
    if (r <= RING.outer) return { pts: 25, label: 'Outer bull · 25', ring: 'outer' };
    if (r > 1) return { pts: 0, label: 'Missed · plop', ring: 'miss' };
    // Angle clockwise from straight up; 20 sits at the top, each number gets 18°
    const deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360 + 9) % 360;
    const n = ORDER[Math.floor(deg / 18)];
    if (r >= RING.tIn && r <= RING.tOut) return { pts: n * 3, label: 'Triple ' + n + ' · ' + n * 3, ring: 'triple' };
    if (r >= RING.dIn) return { pts: n * 2, label: 'Double ' + n + ' · ' + n * 2, ring: 'double' };
    return { pts: n, label: String(n), ring: 'single' };
  }

  const CSS = `
  .sh { position: relative; display: flex; flex-direction: column; height: 100%;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; color: var(--cream, #f5ead6); }
  .sh-hud { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; padding: 10px 14px;
    background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 16px; }
  .sh-stat { flex: 1; min-width: 0; }
  .sh-lbl { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; color: var(--muted, #a08060); text-transform: uppercase; white-space: nowrap; }
  .sh-val { font-family: 'Bebas Neue', sans-serif; font-size: 24px; line-height: 1.05; letter-spacing: 1px; white-space: nowrap; }
  .sh-val.green { color: var(--green, #4caf6e); }
  .sh-mute { background: none; border: 1px solid rgba(245,200,66,0.2); border-radius: 50%; width: 36px; height: 36px;
    font-size: 16px; cursor: pointer; flex-shrink: 0; }
  .sh-stage { flex: 1; min-height: 0; position: relative; display: flex; align-items: flex-start; justify-content: center; }
  .sh-stage canvas { display: block; touch-action: none; border-radius: 16px; }
  .sh-msg { position: absolute; left: 50%; top: 30%; transform: translate(-50%, -50%); pointer-events: none;
    font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 3px; color: #1a1208; background: #f5c842;
    padding: 6px 18px; border-radius: 18px; white-space: nowrap; box-shadow: 0 0 24px rgba(245,200,66,0.6); }
  .sh-msg[hidden] { display: none; }
  .sh-msg.amber { background: #e07b00; box-shadow: 0 0 24px rgba(224,123,0,0.6); }
  .sh-hint { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
    color: var(--muted, #a08060); text-align: center; padding: 8px 0 0; }
  .sh-screen { position: absolute; inset: 0; z-index: 2; background: var(--bg, #1a1208); overflow-y: auto;
    overscroll-behavior: contain; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 4px; }
  .sh-screen > :first-child { margin-top: auto; }
  .sh-screen > :last-child { margin-bottom: auto; }
  .sh-screen[hidden] { display: none; }
  .sh-hero { font-size: 72px; line-height: 1; filter: drop-shadow(0 0 24px rgba(245,200,66,0.35)); }
  .sh-hero canvas { width: 96px; height: 96px; }
  .sh-title { font-family: 'Bebas Neue', sans-serif; font-size: 64px; line-height: 0.95; color: var(--gold, #f5c842); margin-top: 6px; }
  .sh-title.amber { color: var(--amber, #e07b00); }
  .sh-sub { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin: 8px 0 14px; }
  .sh-instr-text { font-size: 14px; line-height: 1.5; margin: 0 0 10px; }
  .sh-box { width: 100%; background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 20px;
    padding: 12px 14px; text-align: left; margin-bottom: 12px; }
  .sh-rings { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
  .sh-ring { display: flex; align-items: center; gap: 8px; }
  .sh-dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
  .sh-ring b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 17px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; }
  .sh-ring span { font-family: 'DM Mono', monospace; font-size: 9.5px; color: var(--muted, #a08060); line-height: 1.3; display: block; }
  .sh-levels { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-bottom: 4px; }
  .sh-level { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer;
    background: var(--surface, #231a0a); border: 1.5px solid rgba(245,200,66,0.45); border-radius: 16px; padding: 10px 14px; color: inherit; }
  .sh-level:disabled { opacity: 0.4; cursor: default; border-color: rgba(224,123,0,0.25); }
  .sh-level-n { font-family: 'Bebas Neue', sans-serif; font-size: 34px; color: var(--gold, #f5c842); width: 26px; text-align: center; }
  .sh-level-t { flex: 1; min-width: 0; }
  .sh-level-t b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 21px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; }
  .sh-level-t span { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted, #a08060); }
  .sh-stars { font-size: 14px; letter-spacing: 0; white-space: nowrap; }
  .sh-play { flex-shrink: 0; min-width: 64px; text-align: center; background: var(--gold, #f5c842); color: #1a1208; border-radius: 10px;
    padding: 8px 12px; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; line-height: 1; white-space: nowrap; }
  .sh-play.locked { background: none; color: var(--muted, #a08060); border: 1px solid rgba(224,123,0,0.35); letter-spacing: 0; font-size: 15px; }
  .sh-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
  .sh-grid .sh-val { font-size: 32px; }
  .sh-bigstars { font-size: 40px; letter-spacing: 6px; margin: 2px 0 10px; }
  .sh-btn { width: 100%; border: none; border-radius: 12px; background: var(--gold, #f5c842); color: #1a1208;
    font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 3px; padding: 14px; cursor: pointer; margin-top: 4px; }
  .sh-btn.ghost { background: transparent; color: var(--gold, #f5c842); border: 1.5px solid rgba(245,200,66,0.6); margin-top: 10px; }
  .sh-link { background: none; border: none; color: var(--muted, #a08060); font-family: 'DM Mono', monospace; font-size: 11px;
    letter-spacing: 1px; margin-top: 14px; cursor: pointer; text-decoration: underline; }
  @media (max-width: 359px) {
    .sh-hud { gap: 6px; padding: 8px 10px; }
    .sh-val { font-size: 21px; }
    .sh-lbl { letter-spacing: 1px; }
    .sh-title { font-size: 54px; }
    .sh-level { gap: 8px; padding: 10px; }
    .sh-play { min-width: 56px; padding: 8px; font-size: 16px; letter-spacing: 1px; }
  }
  `;

  function injectCss() {
    if (document.getElementById('sh-style')) return;
    const s = document.createElement('style');
    s.id = 'sh-style';
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
    // Every throw is a quick little shart, never quite the same twice
    toot() {
      const f = 90 + Math.random() * 50;
      this.tone(f, f * 0.55, 0.14 + Math.random() * 0.08, 'sawtooth', 0.07, 24 + Math.random() * 14);
    },
    thock() { this.tone(180, 70, 0.06, 'square', 0.07); },
    plop() {
      this.tone(220, 900, 0.07, 'sine', 0.16);
      setTimeout(() => this.tone(700, 260, 0.18, 'sine', 0.1), 70);
    },
    fart() { this.tone(95, 42, 0.7, 'sawtooth', 0.13, 26); },
    bonus() { [784, 988, 1175].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.1, 'triangle', 0.07), i * 70)); },
    bust() { this.tone(300, 80, 0.4, 'square', 0.06); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.18, 'triangle', 0.08), i * 120)); },
  };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  // ── DRAWING ──
  function sprite(px, fn) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.max(1, Math.round(px));
    fn(c.getContext('2d'), c.width);
    return c;
  }

  // The dartboard inside a toilet seat, lid up behind it. Drawn into an s × s box.
  function drawBoard(x, s, numbers) {
    const c = s / 2, r = s / 2 / BOX;
    const sector = (r0, r1, a0, a1, fill) => {
      x.beginPath(); x.arc(c, c, r1 * r, a0, a1); x.arc(c, c, r0 * r, a1, a0, true); x.closePath();
      x.fillStyle = fill; x.fill();
    };
    // Seat: a slightly long oval around the board, like the real thing
    const sy = c + r * 0.05;
    x.fillStyle = '#F5EAD6'; x.strokeStyle = '#A08060'; x.lineWidth = Math.max(1, r * 0.025);
    x.beginPath(); x.ellipse(c, sy, SEAT_W * r, SEAT_H * r, 0, 0, Math.PI * 2); x.fill(); x.stroke();
    x.strokeStyle = 'rgba(160,128,96,0.45)';
    x.beginPath(); x.ellipse(c, sy, (SEAT_W - 0.05) * r, (SEAT_H - 0.05) * r, 0, 0, Math.PI * 2); x.stroke();
    // Hinges
    x.fillStyle = '#A08060';
    for (const d of [-1, 1]) x.fillRect(c + d * r * 0.45 - r * 0.11, sy - SEAT_H * r - r * 0.05, r * 0.22, r * 0.1);
    // Black surround with the numbers
    x.fillStyle = '#0E0A05';
    x.beginPath(); x.arc(c, c, SEAT_IN * r, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 20; i++) {
      const a0 = (-90 - 9 + i * 18) * Math.PI / 180, a1 = a0 + Math.PI / 10;
      const dark = i % 2 === 0;
      sector(RING.outer, RING.tIn, a0, a1, dark ? '#3A2410' : '#F5EAD6');
      sector(RING.tIn, RING.tOut, a0, a1, dark ? '#E07B00' : '#4CAF6E');
      sector(RING.tOut, RING.dIn, a0, a1, dark ? '#3A2410' : '#F5EAD6');
      sector(RING.dIn, 1, a0, a1, dark ? '#E07B00' : '#4CAF6E');
    }
    x.fillStyle = '#4CAF6E'; x.beginPath(); x.arc(c, c, RING.outer * r, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#F5C842'; x.beginPath(); x.arc(c, c, RING.bull * r, 0, Math.PI * 2); x.fill();
    // Wires
    x.strokeStyle = 'rgba(160,128,96,0.7)'; x.lineWidth = Math.max(0.5, r * 0.008);
    for (const k of [RING.outer, RING.tIn, RING.tOut, RING.dIn, 1]) { x.beginPath(); x.arc(c, c, k * r, 0, Math.PI * 2); x.stroke(); }
    for (let i = 0; i < 20; i++) {
      const a = (-90 - 9 + i * 18) * Math.PI / 180;
      x.beginPath(); x.moveTo(c + Math.cos(a) * RING.outer * r, c + Math.sin(a) * RING.outer * r);
      x.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); x.stroke();
    }
    if (numbers) {
      x.fillStyle = '#F5EAD6'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `${Math.round(r * 0.13)}px 'Bebas Neue', sans-serif`;
      ORDER.forEach((n, i) => {
        const a = (-90 + i * 18) * Math.PI / 180;
        x.fillText(n, c + Math.cos(a) * r * 1.09, c + Math.sin(a) * r * 1.09 + r * 0.008);
      });
    }
  }

  // A dart stuck in the board: tip at (0,0), barrel and a little brown flight trailing down-right
  function drawDart(x, k) {
    x.save();
    x.scale(k, k);
    x.lineCap = 'round';
    x.strokeStyle = '#1A1208'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(6, 12); x.stroke();
    x.strokeStyle = '#F5C842'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(5.4, 10.8); x.stroke();
    x.fillStyle = '#A0652F'; x.strokeStyle = '#5A3414'; x.lineWidth = 0.8;
    x.beginPath(); x.moveTo(5, 10); x.lineTo(13, 13); x.lineTo(9, 19); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(5, 10); x.lineTo(3, 18); x.lineTo(9, 19); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#F5EAD6';
    x.beginPath(); x.arc(0, 0, 1.3, 0, Math.PI * 2); x.fill();
    x.restore();
  }

  function mount(root, opts) {
    injectCss();
    const hourly = opts.hourly || (() => 0);
    root.innerHTML = `
      <div class="sh">
        <div class="sh-hud">
          <div class="sh-stat"><div class="sh-lbl" data-score-lbl>Score</div><div class="sh-val" data-score>0</div></div>
          <div class="sh-stat"><div class="sh-lbl">Darts</div><div class="sh-val" data-darts></div></div>
          <div class="sh-stat"><div class="sh-lbl">Paid to play</div><div class="sh-val green" data-paid>$0.00</div></div>
          <button type="button" class="sh-mute" data-mute aria-label="Sound"></button>
        </div>
        <div class="sh-stage"><canvas></canvas><div class="sh-msg" hidden></div></div>
        <div class="sh-hint">Drag to aim · let go to throw</div>
        <div class="sh-screen" data-screen></div>
      </div>`;
    const $ = sel => root.querySelector(sel);
    const el = {
      stage: $('.sh-stage'), canvas: $('canvas'), msg: $('.sh-msg'), screen: $('[data-screen]'),
      score: $('[data-score]'), scoreLbl: $('[data-score-lbl]'), darts: $('[data-darts]'), paid: $('[data-paid]'), mute: $('[data-mute]'),
    };
    const ctx = el.canvas.getContext('2d');

    let scale = 1, dpr = 1, bg = null, board = null;
    const g = {
      state: 'title', lv: 0, L: LEVELS[0], score: 0, left: 0, used: 0, playSecs: 0, clock: 0,
      aim: { x: BX, y: BY }, hold: 0, holding: false, ph: [0, 0, 0, 0], wind: 0, slide: 0,
      flight: null, stuck: [], round: 0, roundStart: 0, floats: [], pause: 0, pauseFn: null, shake: 0, best: null,
    };
    let frame = null, last = 0, alive = true, hud = {}, msgTimer = 0;

    // ── LAYOUT ──
    function layout() {
      const r = el.stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      scale = Math.min(r.width / W, r.height / H);
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      const cw = Math.round(W * scale), ch = Math.round(H * scale);
      el.canvas.width = cw * dpr; el.canvas.height = ch * dpr;
      el.canvas.style.width = cw + 'px'; el.canvas.style.height = ch + 'px';
      const k = scale * dpr;
      board = sprite(2 * R * BOX * k, (x, s) => drawBoard(x, s, true));
      // Bathroom wall tiles, drawn once
      bg = sprite(1, () => {});
      bg.width = W * k; bg.height = H * k;
      const b = bg.getContext('2d');
      const gr = b.createLinearGradient(0, 0, 0, bg.height);
      gr.addColorStop(0, '#2E2210'); gr.addColorStop(1, '#1A1208');
      b.fillStyle = gr; b.fillRect(0, 0, bg.width, bg.height);
      b.fillStyle = 'rgba(0,0,0,0.28)';
      for (let x = 0; x <= W; x += 30) b.fillRect(x * k, 0, Math.max(1, k * 0.8), bg.height);
      for (let y = 0; y <= H; y += 30) b.fillRect(0, y * k, bg.width, Math.max(1, k * 0.8));
      // Oche line to stand behind
      b.fillStyle = 'rgba(245,200,66,0.5)'; b.fillRect(20 * k, (H - 14) * k, (W - 40) * k, 2 * k);
      draw();
    }

    // ── GAME ──
    const boardX = () => BX + g.slide;
    const newWind = () => g.L.wind ? Math.round((Math.random() * 2 - 1) * g.L.wind * 2) / 2 : 0;
    function newPhases() { g.ph = [0, 1, 2, 3].map(() => Math.random() * Math.PI * 2); }

    function startLevel(i) {
      sound.init();
      const r = el.stage.getBoundingClientRect();
      if (r.width && r.height) setHeight(Math.round(Math.max(450, Math.min(640, W * r.height / r.width))));
      g.lv = i; g.L = LEVELS[i];
      g.score = 0; g.left = g.L.darts; g.used = 0; g.playSecs = 0; g.clock = 0;
      g.aim = { x: BX, y: BY }; g.hold = 0; g.holding = false; newPhases();
      g.wind = newWind(); g.slide = 0; g.flight = null; g.stuck = []; g.round = 0; g.floats = [];
      g.pause = 0; g.pauseFn = null; g.shake = 0;
      g.roundStart = g.L.mode === 'count' ? g.L.start : 0;
      if (g.L.mode === 'count') g.score = g.L.start;
      el.scoreLbl.textContent = g.L.mode === 'count' ? 'Left' : 'Score';
      el.screen.hidden = true;
      g.state = 'play';
      layout();
      flash(g.L.name.toUpperCase());
      startLoop();
    }

    function flash(text, amber, ms) {
      el.msg.textContent = text; el.msg.classList.toggle('amber', !!amber); el.msg.hidden = false;
      clearTimeout(msgTimer);
      msgTimer = setTimeout(() => { el.msg.hidden = true; }, ms || 1200);
    }

    // The hand drift: two wobbles on each axis, so it never settles into a pattern.
    // Holding longer than a second and a half makes it worse.
    function wobble() {
      const t = g.clock, p = g.ph;
      const a = g.L.wobble * (1 + Math.max(0, g.hold - 1.5) * 0.7);
      return {
        x: a * (Math.sin(t * 1.9 + p[0]) * 0.7 + Math.sin(t * 3.7 + p[1]) * 0.3),
        y: a * (Math.cos(t * 1.6 + p[2]) * 0.7 + Math.sin(t * 3.1 + p[3]) * 0.3),
      };
    }
    const aimPoint = () => { const w = wobble(); return { x: g.aim.x + w.x, y: g.aim.y + w.y }; };

    function throwDart() {
      if (g.state !== 'play' || g.flight || g.pause > 0 || g.left <= 0) return;
      const a = aimPoint();
      const jit = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2.6;
      g.flight = {
        x0: g.aim.x, y0: H + 10, x1: a.x + jit(), y1: a.y + jit(), drift: g.wind * DRIFT,
        t: 0, dur: still ? 0.12 : 0.3,
      };
      g.left--; g.used++;
      g.hold = 0;
      sound.toot();
    }

    function land(f) {
      const x = f.x1 + f.drift, y = f.y1;
      const res = scoreAt(x - boardX(), y - BY);
      // Darts that land on the board ride along with it when it swings
      if (res.ring !== 'miss') g.stuck.push({ dx: x - boardX(), y });
      const L = g.L;
      let text = res.label, gold = res.ring === 'bull' || res.ring === 'triple';
      if (L.mode === 'count') {
        const next = g.score - res.pts;
        if (next < 0) {
          g.score = g.roundStart;
          sound.bust(); buzz(80);
          flash('BUST! Back to ' + g.score, true, 1400);
          g.floats.push({ text: '-' + res.pts, x, y: Math.max(44, y - 10), t: 1, gold: false });
          return endRound(true);
        }
        g.score = next;
      } else g.score += res.pts;
      g.floats.push({ text: res.pts ? (res.ring === 'single' ? '+' + res.pts : text) : text, x: Math.max(50, Math.min(W - 50, x)), y: Math.max(44, y - 10), t: 1, gold });
      if (res.ring === 'miss') { sound.plop(); buzz(30); }
      else { sound.thock(); buzz(12); }
      if (res.ring === 'bull') { setTimeout(() => sound.fart(), 90); flash('BULLSHART!', false, 1300); g.shake = 0.25; }
      else if (res.ring === 'triple') setTimeout(() => sound.bonus(), 60);
      g.round += res.pts;
      if (L.mode === 'count' && g.score === 0) return finish(true);
      if (g.stuck.length >= 3 || g.left <= 0 || g.used % 3 === 0) endRound(false);
    }

    function endRound(bust) {
      if (!bust && g.round === 180) { flash('ONE HUNDRED AND EIGHTY!', false, 1600); sound.win(); }
      g.pause = still ? 0.6 : 0.95;
      g.pauseFn = () => {
        g.stuck = []; g.round = 0;
        g.roundStart = g.score;
        // A bust uses the rest of that round's darts, like the pub rule
        if (bust) { const r = g.used % 3 ? 3 - g.used % 3 : 0; g.used += r; g.left = Math.max(0, g.left - r); }
        if (g.left <= 0) return finish(g.L.mode === 'score' && g.score >= g.L.stars[0]);
        g.wind = newWind(); newPhases();
      };
    }

    function update(dt) {
      g.clock += dt;
      if (g.state !== 'play') return;
      g.playSecs += dt;
      if (g.holding) g.hold += dt;
      if (g.L.slide) g.slide = Math.sin(g.clock * 1.25) * g.L.slide;
      if (g.shake > 0) g.shake -= dt;
      for (const f of g.floats) { f.t -= dt; if (!still) f.y -= dt * 18; }
      g.floats = g.floats.filter(f => f.t > 0);
      if (g.flight) {
        g.flight.t += dt;
        if (g.flight.t >= g.flight.dur) { const f = g.flight; g.flight = null; land(f); }
      } else if (g.pause > 0) {
        g.pause -= dt;
        if (g.pause <= 0) { const fn = g.pauseFn; g.pauseFn = null; fn && fn(); }
      }
    }

    // ── DRAW ──
    function draw() {
      if (!bg) return;
      const k = scale * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(bg, 0, 0);
      ctx.save();
      if (g.shake > 0 && !still) ctx.translate((Math.random() - 0.5) * 5 * k, (Math.random() - 0.5) * 5 * k);
      ctx.scale(k, k);
      const bs = 2 * R * BOX;
      if (board) ctx.drawImage(board, boardX() - bs / 2, BY - bs / 2, bs, bs);
      if (g.state === 'title') { ctx.restore(); return; }

      for (const d of g.stuck) { ctx.save(); ctx.translate(boardX() + d.dx, d.y); drawDart(ctx, 1); ctx.restore(); }

      // Draught: a little gust sign over the board
      if (g.L.wind) {
        const y = 16, txt = g.wind === 0 ? 'No draught' : (g.wind < 0 ? '← ' : '') + 'Draught ' + Math.abs(g.wind) + (g.wind > 0 ? ' →' : '');
        ctx.font = "10px 'DM Mono', monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(txt).width + 34;
        ctx.fillStyle = 'rgba(14,10,5,0.75)';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(BX - w / 2, y - 10, w, 20, 10) : ctx.rect(BX - w / 2, y - 10, w, 20); ctx.fill();
        ctx.fillStyle = g.wind ? '#A0DC5A' : '#A08060';
        ctx.fillText('💨 ' + txt, BX, y + 0.5);
      }

      // Aim ring, while no dart is in the air
      if (!g.flight && g.pause <= 0 && g.left > 0) {
        const a = aimPoint();
        const shaky = g.hold > 1.5;
        ctx.strokeStyle = shaky ? '#E07B00' : '#F5C842';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(a.x, a.y, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(a.x - 12, a.y); ctx.lineTo(a.x - 4, a.y); ctx.moveTo(a.x + 4, a.y); ctx.lineTo(a.x + 12, a.y);
        ctx.moveTo(a.x, a.y - 12); ctx.lineTo(a.x, a.y - 4); ctx.moveTo(a.x, a.y + 4); ctx.lineTo(a.x, a.y + 12);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(a.x, a.y, 1.2, 0, Math.PI * 2); ctx.fill();
        // Where the draught will carry it
        if (g.wind) {
          ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(160,220,90,0.8)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(a.x + g.wind * DRIFT, a.y, 4, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Dart in the air: flies up from the oche, shrinking as it goes, curving with the draught
      if (g.flight) {
        const f = g.flight, p = Math.min(1, f.t / f.dur), e = 1 - (1 - p) * (1 - p);
        const x = f.x0 + (f.x1 - f.x0) * e + f.drift * p * p;
        const y = f.y0 + (f.y1 - f.y0) * e - Math.sin(p * Math.PI) * 30;
        ctx.save(); ctx.translate(x, y); drawDart(ctx, 1 + (1 - p) * 1.6); ctx.restore();
      }

      for (const f of g.floats) {
        ctx.globalAlpha = Math.min(1, f.t * 2);
        ctx.font = `${f.gold ? 20 : 17}px 'Bebas Neue', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = '#1A1208';
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.gold ? '#F5C842' : '#F5EAD6';
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
      }

      // This round's darts, bottom left
      ctx.font = "10px 'DM Mono', monospace"; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#A08060';
      const busy = g.flight || g.pause > 0;
      ctx.fillText('ROUND ' + (busy ? Math.ceil(g.used / 3) : Math.floor(g.used / 3) + 1) + ' · ' + g.round, 20, H - 28);
      ctx.restore();
    }

    function renderHud() {
      const paid = '$' + (hourly() * g.playSecs / 3600).toFixed(2);
      if (hud.score !== g.score) el.score.textContent = (hud.score = g.score).toLocaleString('en-US');
      if (hud.left !== g.left) el.darts.textContent = '🎯 ' + (hud.left = g.left);
      if (hud.paid !== paid) el.paid.textContent = hud.paid = paid;
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
    const starStr = n => '⭐'.repeat(n) + '<span style="opacity:0.25">' + '⭐'.repeat(3 - n) + '</span>';
    // Best for score levels = highest score; for count levels = fewest darts
    const bestText = (L, b) => L.mode === 'count' ? b + ' darts' : b.toLocaleString('en-US');
    const ringRow = (color, name, desc) => `<div class="sh-ring"><div class="sh-dot" style="background:${color}"></div><div><b>${name}</b><span>${desc}</span></div></div>`;

    function titleScreen() {
      g.state = 'title';
      el.msg.hidden = true;
      const p = progress();
      const open = i => preview || i <= p.unlocked;
      el.screen.innerHTML = `
        <div class="sh-hero" data-hero></div>
        <div class="sh-title">Sharts</div>
        <div class="sh-sub">Darts for the dunny</div>
        <div class="sh-levels">
          ${LEVELS.map((L, i) => `<button type="button" class="sh-level" data-lv="${i}" ${open(i) ? '' : 'disabled'}>
            <div class="sh-level-n">${i + 1}</div>
            <div class="sh-level-t"><b>${L.name}</b><span>${open(i) ? L.sub + (p.best[i] ? ' · best ' + bestText(L, p.best[i]) : '') : '🔒 Beat level ' + i + ' first'}</span></div>
            <div class="sh-stars">${p.stars[i] ? starStr(p.stars[i]) : ''}</div>
            ${open(i) ? '<div class="sh-play">Play ▶</div>' : '<div class="sh-play locked" aria-label="Locked">🔒</div>'}
          </button>`).join('')}
        </div>
        <div class="sh-box" style="margin-top:8px">
          <div class="sh-lbl" style="margin-bottom:6px">Instructions</div>
          <div class="sh-instr-text">Put your thumb anywhere and drag to move the aim. Let go to throw. Your hand wobbles, so let go when the aim drifts over what you want. Hold too long and the shakes get worse.</div>
          <div class="sh-instr-text">Three darts a round. When there's a draught, the dotted ring shows where it'll blow your dart. 301 Blowout: count down to exactly 0. Go under and it's a bust.</div>
          <div class="sh-lbl" style="margin:4px 0 8px">The board</div>
          <div class="sh-rings">
            ${ringRow('#F5C842', 'Bullshart · 50', 'the gold plughole')}
            ${ringRow('#4CAF6E', 'Outer bull · 25', 'green ring around it')}
            ${ringRow('#E07B00', 'Triple ring', 'inner thin ring, 3×')}
            ${ringRow('#E07B00', 'Double ring', 'outer thin ring, 2×')}
          </div>
        </div>`;
      el.screen.hidden = false;
      el.screen.querySelector('[data-hero]').appendChild(sprite(192, (x, s) => drawBoard(x, s, false)));
      el.screen.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => startLevel(+b.dataset.lv); });
      draw();
    }

    function finish(won) {
      g.state = 'over';
      g.holding = false;
      const L = g.L, p = progress();
      const count = L.mode === 'count';
      const paid = '$' + (hourly() * g.playSecs / 3600).toFixed(2);
      if (!won) {
        if (!count && g.score > (p.best[g.lv] || 0)) { p.best[g.lv] = g.score; save(PROGRESS_KEY, p); }
        el.screen.innerHTML = `
          <div class="sh-hero" style="filter:drop-shadow(0 0 24px rgba(224,123,0,0.5))">🪠</div>
          <div class="sh-title amber">${count ? 'Out of darts!' : 'Bog standard'}</div>
          <div class="sh-sub">${count ? g.score + ' still to go' : g.score + ' of ' + L.stars[0] + ' needed'}</div>
          <div class="sh-box sh-grid">
            <div><div class="sh-lbl">${count ? 'Left' : 'Score'}</div><div class="sh-val">${g.score}</div></div>
            <div><div class="sh-lbl">Paid to play</div><div class="sh-val green">${paid}</div></div>
          </div>
          <button type="button" class="sh-btn" data-again>↺ Try again</button>
          <button type="button" class="sh-link" data-levels>All levels</button>
          <button type="button" class="sh-link" data-exit style="margin-top:6px">Back to the bog timer</button>`;
        el.screen.hidden = false;
        return wireEnd(false);
      }
      sound.win();
      const stars = count ? (g.used <= L.stars[0] ? 3 : g.used <= L.stars[1] ? 2 : 1)
        : (g.score >= L.stars[2] ? 3 : g.score >= L.stars[1] ? 2 : 1);
      const mine = count ? g.used : g.score;
      const record = !p.best[g.lv] || (count ? mine < p.best[g.lv] : mine > p.best[g.lv]);
      if (record) p.best[g.lv] = mine;
      p.stars[g.lv] = Math.max(p.stars[g.lv] || 0, stars);
      p.unlocked = Math.max(p.unlocked, Math.min(g.lv + 1, LEVELS.length - 1));
      save(PROGRESS_KEY, p);
      const more = g.lv + 1 < LEVELS.length;
      const next = count ? `${L.stars[stars === 1 ? 1 : 0]} darts` : L.stars[Math.min(2, stars)];
      el.screen.innerHTML = `
        <div class="sh-hero">🎯</div>
        <div class="sh-title">${count ? 'Checked out!' : 'Nailed it!'}</div>
        <div class="sh-sub">Level ${g.lv + 1} · ${L.name}</div>
        <div class="sh-bigstars">${starStr(stars)}</div>
        ${stars < 3 ? `<div style="font-size:13px;opacity:0.8;margin:-4px 0 12px">Next star: ${count ? 'finish in ' + next : 'score ' + next}</div>` : ''}
        <div class="sh-box sh-grid">
          <div><div class="sh-lbl">${count ? 'Darts used' : 'Score'}</div><div class="sh-val">${mine}</div></div>
          <div><div class="sh-lbl">Paid to play</div><div class="sh-val green">${paid}</div></div>
          <div><div class="sh-lbl">Level record?</div><div class="sh-val" style="color:${record ? '#f5c842' : '#a08060'}">${record ? 'YES!' : 'Nah · ' + bestText(L, p.best[g.lv])}</div></div>
        </div>
        ${more ? '<button type="button" class="sh-btn" data-next>▶ Next level</button>' :
          '<div style="font-size:14px;opacity:0.8;margin-bottom:8px">That\'s every level so far. More on the way.</div>'}
        <button type="button" class="sh-btn ghost" data-again>↺ Play again</button>
        <button type="button" class="sh-link" data-levels>All levels</button>
        <button type="button" class="sh-link" data-exit style="margin-top:6px">Back to the bog timer</button>`;
      el.screen.hidden = false;
      wireEnd(more);
    }

    function wireEnd(more) {
      const on = (sel, fn) => { const b = el.screen.querySelector(sel); if (b) b.onclick = fn; };
      if (more) on('[data-next]', () => startLevel(g.lv + 1));
      on('[data-again]', () => startLevel(g.lv));
      on('[data-levels]', titleScreen);
      on('[data-exit]', () => opts.onExit && opts.onExit());
    }

    // ── INPUT ──
    // Put a thumb down anywhere and drag: the aim moves with it, from wherever it was,
    // so your thumb never covers the board. Let go to throw. A plain tap throws where the aim is.
    let drag = null;
    function onDown(e) {
      if (g.state !== 'play' || drag) return;
      sound.init();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, ax: g.aim.x, ay: g.aim.y };
      g.holding = true; g.hold = 0;
      try { el.canvas.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      g.aim.x = Math.max(10, Math.min(W - 10, drag.ax + (e.clientX - drag.x) / scale));
      g.aim.y = Math.max(10, Math.min(H - 40, drag.ay + (e.clientY - drag.y) / scale));
    }
    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      g.holding = false;
      if (e.type === 'pointerup') throwDart();
      g.hold = 0;
    }
    // Keyboard on a computer: arrows aim, space throws
    function onKey(e) {
      if (e.key === 'Escape' && opts.onExit) { opts.onExit(); return; }
      if (g.state !== 'play') return;
      const step = e.shiftKey ? 1 : 4;
      if (e.key === 'ArrowLeft') g.aim.x -= step;
      else if (e.key === 'ArrowRight') g.aim.x += step;
      else if (e.key === 'ArrowUp') g.aim.y -= step;
      else if (e.key === 'ArrowDown') g.aim.y += step;
      else if (e.key === ' ' || e.key === 'Enter') throwDart();
      else return;
      e.preventDefault();
    }
    function onVisible() {
      if (document.visibilityState === 'visible' && g.state === 'play') startLoop();
    }

    el.mute.onclick = () => { sound.muted = !sound.muted; save(MUTE_KEY, sound.muted); sound.init(); renderMute(); };
    el.canvas.addEventListener('pointerdown', onDown);
    el.canvas.addEventListener('pointermove', onMove);
    el.canvas.addEventListener('pointerup', onUp);
    el.canvas.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisible);
    const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
    if (ro) ro.observe(el.stage); else window.addEventListener('resize', layout);

    renderMute();
    renderHud();
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
      _test: { g, finish, throwDart, aimPoint },
    };
  }

  window.Sharts = { mount, LEVELS, scoreAt };
})();
