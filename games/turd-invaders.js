// ══ TURD INVADERS ══
// The old arcade shooter, but the fleet coming down is poo and you're the
// toilet. Fire squares of dunny paper, hide behind the toilet roll stacks,
// and don't let them reach the floor. Loaded only when someone opens it.
//
// window.TurdInvaders.mount(el, { hourly: () => number, onExit: () => void })
// draws the game into el and returns { destroy() }.
(function () {
  // Everything runs in a world 300 wide, scaled to fit the screen. Its height
  // follows the screen's shape (450 to 640) and is set when a level starts.
  const W = 300;
  let H = 450, PLAYER_Y = 420, SHIELD_Y = 350, FLOOR = 406;
  const SZ = 22;               // invader size
  const GAP_X = 30, GAP_Y = 26; // formation spacing
  const PLAYER_W = 30, PLAYER_H = 24;
  const CELL = 4, SHIELD_COLS = 10, SHIELD_ROWS = 6;
  function setHeight(h) {
    H = h;
    PLAYER_Y = H - 30;
    SHIELD_Y = H - 100;
    FLOOR = PLAYER_Y - 14; // invaders touching this line = overflow
  }
  const INVADERS = [
    { name: 'Soft serve', pts: 10, base: '#A0652F', dark: '#5A3414', desc: 'the classic' },
    { name: 'Corn cob', pts: 20, base: '#9A6A34', dark: '#4E3214', corn: true, desc: 'never digested' },
    { name: 'Vindaloo', pts: 30, base: '#7E8A2E', dark: '#3A4410', stink: true, desc: 'last night\'s mistake' },
    { name: 'Rock hard', pts: 40, base: '#6A5240', dark: '#2C2018', hp: 2, desc: 'takes two wipes' },
  ];
  // Add a level by adding a line. rows = formation from the top down (index into INVADERS),
  // step = seconds between marches at the start, fire = average seconds between drips,
  // drips = most drips falling at once, dripV = drip speed, shields = toilet roll stacks.
  const LEVELS = [
    { name: 'Number Ones', sub: '3 rows · slow and steady', rows: [2, 1, 0], cols: 6, step: 0.7, fire: 1.5, drips: 2, dripV: 105, shields: 4 },
    { name: 'Curry Night', sub: '4 rows · they fire back more', rows: [2, 1, 0, 0], cols: 7, step: 0.6, fire: 1.15, drips: 3, dripV: 125, shields: 4 },
    { name: 'Code Brown', sub: '5 rows · rock hard ones up top', rows: [3, 2, 1, 1, 0], cols: 7, step: 0.52, fire: 0.9, drips: 4, dripV: 145, shields: 3 },
    { name: 'Total Blockage', sub: '5 rows · 8 wide · fast', rows: [3, 3, 2, 1, 0], cols: 8, step: 0.45, fire: 0.7, drips: 5, dripV: 165, shields: 3 },
  ];
  const LIVES = 3;
  const UFO_PTS = [50, 100, 150, 300];
  const PROGRESS_KEY = 'gi.turdinvaders.v1';
  const MUTE_KEY = 'gi.turdinvaders.muted';
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Branch previews and localhost open every level for testing
  const preview = /\.pages\.dev$|^localhost$|^127\./.test(location.hostname);

  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  const CSS = `
  .ti { position: relative; display: flex; flex-direction: column; height: 100%;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; color: var(--cream, #f5ead6); }
  .ti-hud { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; padding: 10px 14px;
    background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 16px; }
  .ti-stat { flex: 1; min-width: 0; }
  .ti-lbl { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; color: var(--muted, #a08060); text-transform: uppercase; white-space: nowrap; }
  .ti-val { font-family: 'Bebas Neue', sans-serif; font-size: 24px; line-height: 1.05; letter-spacing: 1px; white-space: nowrap; }
  .ti-val.green { color: var(--green, #4caf6e); }
  .ti-mute { background: none; border: 1px solid rgba(245,200,66,0.2); border-radius: 50%; width: 36px; height: 36px;
    font-size: 16px; cursor: pointer; flex-shrink: 0; }
  .ti-stage { flex: 1; min-height: 0; position: relative; display: flex; align-items: flex-start; justify-content: center; }
  .ti-stage canvas { display: block; touch-action: none; border-radius: 16px; }
  .ti-msg { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); pointer-events: none;
    font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 3px; color: #1a1208; background: #f5c842;
    padding: 6px 18px; border-radius: 18px; white-space: nowrap; box-shadow: 0 0 24px rgba(245,200,66,0.6); }
  .ti-msg[hidden] { display: none; }
  .ti-msg.amber { background: #e07b00; box-shadow: 0 0 24px rgba(224,123,0,0.6); }
  .ti-hint { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
    color: var(--muted, #a08060); text-align: center; padding: 8px 0 0; }
  .ti-screen { position: absolute; inset: 0; z-index: 2; background: var(--bg, #1a1208); overflow-y: auto;
    overscroll-behavior: contain; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 4px; }
  .ti-screen > :first-child { margin-top: auto; }
  .ti-screen > :last-child { margin-bottom: auto; }
  .ti-screen[hidden] { display: none; }
  .ti-hero { font-size: 72px; line-height: 1; filter: drop-shadow(0 0 24px rgba(245,200,66,0.45)); }
  .ti-hero canvas { width: 84px; height: 84px; }
  .ti-title { font-family: 'Bebas Neue', sans-serif; font-size: 64px; line-height: 0.95; color: var(--gold, #f5c842); margin-top: 6px; }
  .ti-title.amber { color: var(--amber, #e07b00); }
  .ti-sub { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin: 8px 0 14px; }
  .ti-instr-text { font-size: 14px; line-height: 1.5; margin: 0 0 10px; }
  .ti-box { width: 100%; background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 20px;
    padding: 12px 14px; text-align: left; margin-bottom: 12px; }
  .ti-pieces { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
  .ti-piece { display: flex; align-items: center; gap: 8px; }
  .ti-piece canvas { width: 30px; height: 30px; flex-shrink: 0; }
  .ti-piece b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 17px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; }
  .ti-piece span { font-family: 'DM Mono', monospace; font-size: 9.5px; color: var(--muted, #a08060); line-height: 1.3; display: block; }
  .ti-levels { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-bottom: 4px; }
  .ti-level { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer;
    background: var(--surface, #231a0a); border: 1.5px solid rgba(245,200,66,0.45); border-radius: 16px; padding: 10px 14px; color: inherit; }
  .ti-level:disabled { opacity: 0.4; cursor: default; border-color: rgba(224,123,0,0.25); }
  .ti-level-n { font-family: 'Bebas Neue', sans-serif; font-size: 34px; color: var(--gold, #f5c842); width: 26px; text-align: center; }
  .ti-level-t { flex: 1; min-width: 0; }
  .ti-level-t b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 21px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; }
  .ti-level-t span { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted, #a08060); }
  .ti-stars { font-size: 14px; letter-spacing: 0; white-space: nowrap; }
  .ti-play { flex-shrink: 0; min-width: 64px; text-align: center; background: var(--gold, #f5c842); color: #1a1208; border-radius: 10px;
    padding: 8px 12px; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; line-height: 1; white-space: nowrap; }
  .ti-play.locked { background: none; color: var(--muted, #a08060); border: 1px solid rgba(224,123,0,0.35); letter-spacing: 0; font-size: 15px; }
  .ti-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
  .ti-grid .ti-val { font-size: 32px; }
  .ti-bigstars { font-size: 40px; letter-spacing: 6px; margin: 2px 0 10px; }
  .ti-btn { width: 100%; border: none; border-radius: 12px; background: var(--gold, #f5c842); color: #1a1208;
    font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 3px; padding: 14px; cursor: pointer; margin-top: 4px; }
  .ti-btn.ghost { background: transparent; color: var(--gold, #f5c842); border: 1.5px solid rgba(245,200,66,0.6); margin-top: 12px; }
  .ti-link { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent;
    color: var(--cream, #f5ead6); border: 1px solid rgba(245,234,214,0.28); border-radius: 12px; font-family: 'Bebas Neue', sans-serif;
    font-size: 19px; letter-spacing: 2px; padding: 12px 14px; margin-top: 12px; cursor: pointer; }
  .ti-link svg { color: var(--gold, #f5c842); flex: 0 0 auto; margin-top: -2px; }
  @media (max-width: 359px) {
    .ti-hud { gap: 6px; padding: 8px 10px; }
    .ti-val { font-size: 21px; }
    .ti-lbl { letter-spacing: 1px; }
    .ti-title { font-size: 54px; }
    .ti-level { gap: 8px; padding: 10px; }
    .ti-play { min-width: 56px; padding: 8px; font-size: 16px; letter-spacing: 1px; }
  }
  `;

  function injectCss() {
    if (document.getElementById('ti-style')) return;
    const s = document.createElement('style');
    s.id = 'ti-style';
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
    // The march: four low notes going round, faster as the fleet thins out
    beat: 0,
    march() { const f = [98, 87, 78, 73][this.beat++ % 4]; this.tone(f, f * 0.9, 0.09, 'square', 0.05); },
    // Every shot is a little toot, never quite the same twice
    toot() {
      const f = 85 + Math.random() * 50;
      this.tone(f, f * 0.6, 0.16 + Math.random() * 0.08, 'sawtooth', 0.07, 22 + Math.random() * 16);
    },
    // Getting hit: something big drops in the bowl
    plop() {
      this.tone(220, 900, 0.07, 'sine', 0.16);
      setTimeout(() => this.tone(700, 260, 0.18, 'sine', 0.1), 70);
    },
    splat() { this.tone(300, 90, 0.12, 'sine', 0.12); },
    clunk() { this.tone(160, 120, 0.06, 'square', 0.04); },
    fart() { this.tone(95, 45, 0.6, 'sawtooth', 0.12, 28); },
    ufo() { this.tone(520, 380, 0.25, 'sine', 0.035, 9); },
    bonus() { [784, 988, 1175].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.1, 'triangle', 0.07), i * 70)); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.18, 'triangle', 0.08), i * 120)); },
  };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  // ── SPRITES ── (each drawn into an s × s box)
  function sprite(px, fn) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.max(1, Math.round(px));
    fn(c.getContext('2d'), c.width);
    return c;
  }

  // A poo with eyes and stubby arms. frame 1 squashes it and swaps the arms, for the march.
  function drawInvader(x, s, k, frame, cracked) {
    const T = INVADERS[k];
    const cx = s / 2, cy = s * 0.56;
    x.save();
    if (frame) { x.translate(cx, cy); x.scale(1.07, 0.93); x.translate(-cx, -cy); }
    // Arms
    x.strokeStyle = T.dark; x.lineWidth = Math.max(1.2, s * 0.06); x.lineCap = 'round';
    for (const d of [-1, 1]) {
      x.beginPath();
      x.moveTo(cx + d * s * 0.3, cy + s * 0.08);
      x.lineTo(cx + d * s * 0.46, cy + (frame ? s * 0.26 : -s * 0.1));
      x.stroke();
    }
    x.fillStyle = T.base; x.strokeStyle = T.dark; x.lineWidth = Math.max(1, s * 0.04);
    const blob = (y, rx, ry) => { x.beginPath(); x.ellipse(cx, cy + y * s, rx * s, ry * s, 0, 0, Math.PI * 2); x.fill(); x.stroke(); };
    blob(0.2, 0.36, 0.15);
    blob(0.03, 0.27, 0.13);
    blob(-0.12, 0.17, 0.1);
    x.beginPath();
    x.moveTo(cx - 0.07 * s, cy - 0.19 * s);
    x.quadraticCurveTo(cx + 0.02 * s, cy - 0.27 * s, cx + 0.09 * s, cy - 0.38 * s);
    x.quadraticCurveTo(cx + 0.09 * s, cy - 0.25 * s, cx + 0.09 * s, cy - 0.17 * s);
    x.closePath(); x.fill();
    if (T.corn) {
      x.fillStyle = '#F5C842';
      for (const [dx, dy] of [[-0.2, 0.2], [0.14, 0.24], [0.22, 0.1], [-0.08, 0.04]]) {
        x.beginPath(); x.ellipse(cx + dx * s, cy + dy * s, s * 0.045, s * 0.035, 0, 0, Math.PI * 2); x.fill();
      }
    }
    // Eyes, looking down at you (to the side on the squash frame)
    const look = frame ? s * 0.025 : 0;
    for (const d of [-1, 1]) {
      x.fillStyle = '#FFFDF6';
      x.beginPath(); x.arc(cx + d * s * 0.1, cy, s * 0.075, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#1A1208';
      x.beginPath(); x.arc(cx + d * s * 0.1 + look, cy + s * 0.025, s * 0.038, 0, Math.PI * 2); x.fill();
    }
    if (T.hp) {
      // Cross eyebrows
      x.strokeStyle = '#1A1208'; x.lineWidth = Math.max(1, s * 0.045);
      for (const d of [-1, 1]) {
        x.beginPath(); x.moveTo(cx + d * s * 0.18, cy - s * 0.1); x.lineTo(cx + d * s * 0.04, cy - s * 0.05); x.stroke();
      }
    }
    if (cracked) {
      x.strokeStyle = '#F5EAD6'; x.lineWidth = Math.max(1, s * 0.035); x.lineJoin = 'round';
      x.beginPath();
      x.moveTo(cx + s * 0.05, cy - s * 0.3); x.lineTo(cx - s * 0.04, cy - s * 0.14);
      x.lineTo(cx + s * 0.06, cy + s * 0.08); x.lineTo(cx - s * 0.02, cy + s * 0.3);
      x.stroke();
    }
    x.restore();
    if (T.stink) {
      x.strokeStyle = 'rgba(160,220,90,0.75)'; x.lineWidth = Math.max(1, s * 0.035);
      for (const d of [-1, 1]) {
        const sx = cx + d * s * 0.3;
        x.beginPath();
        x.moveTo(sx, s * 0.3);
        x.quadraticCurveTo(sx + d * s * 0.06, s * 0.2, sx, s * 0.12);
        x.quadraticCurveTo(sx - d * s * 0.06, s * 0.04, sx, 0);
        x.stroke();
      }
    }
  }

  // Front-on toilet: tank on top, gold seat, bowl underneath
  function drawToilet(x, s) {
    const cx = s / 2;
    x.fillStyle = '#F5EAD6'; x.strokeStyle = '#A08060'; x.lineWidth = Math.max(1, s * 0.03);
    const rr = (l, t, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(l, t, w, h, r) : x.rect(l, t, w, h); x.fill(); x.stroke(); };
    rr(cx - s * 0.32, s * 0.08, s * 0.64, s * 0.3, s * 0.06);
    x.fillStyle = '#A08060';
    x.fillRect(cx - s * 0.1, s * 0.15, s * 0.2, s * 0.04);
    x.fillStyle = '#F5C842'; x.strokeStyle = '#E07B00';
    rr(cx - s * 0.44, s * 0.4, s * 0.88, s * 0.12, s * 0.06);
    x.fillStyle = '#F5EAD6'; x.strokeStyle = '#A08060';
    x.beginPath();
    x.moveTo(cx - s * 0.38, s * 0.52);
    x.quadraticCurveTo(cx - s * 0.36, s * 0.82, cx - s * 0.18, s * 0.86);
    x.lineTo(cx + s * 0.18, s * 0.86);
    x.quadraticCurveTo(cx + s * 0.36, s * 0.82, cx + s * 0.38, s * 0.52);
    x.closePath(); x.fill(); x.stroke();
    rr(cx - s * 0.2, s * 0.86, s * 0.4, s * 0.1, s * 0.03);
  }

  // Golden poo riding a flying saucer: the bonus ship
  function drawUfo(x, s) {
    const cx = s / 2, cy = s * 0.6;
    x.save();
    x.translate(cx - s * 0.25, cy - s * 0.62); x.scale(0.5, 0.5);
    drawGoldPoo(x, s);
    x.restore();
    const gr = x.createLinearGradient(0, cy - s * 0.1, 0, cy + s * 0.15);
    gr.addColorStop(0, '#D8D0C0'); gr.addColorStop(1, '#7A7268');
    x.fillStyle = gr; x.strokeStyle = '#4A443C'; x.lineWidth = Math.max(1, s * 0.025);
    x.beginPath(); x.ellipse(cx, cy, s * 0.46, s * 0.13, 0, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#F5C842';
    for (let i = -2; i <= 2; i++) { x.beginPath(); x.arc(cx + i * s * 0.16, cy + s * 0.02, s * 0.03, 0, Math.PI * 2); x.fill(); }
  }
  function drawGoldPoo(x, s) {
    const cx = s / 2, cy = s * 0.58;
    x.fillStyle = '#F5C842'; x.strokeStyle = '#B07800'; x.lineWidth = Math.max(1, s * 0.04);
    const blob = (y, rx, ry) => { x.beginPath(); x.ellipse(cx, cy + y * s, rx * s, ry * s, 0, 0, Math.PI * 2); x.fill(); x.stroke(); };
    blob(0.2, 0.38, 0.16); blob(0.03, 0.28, 0.14); blob(-0.13, 0.18, 0.11);
    x.fillStyle = 'rgba(255,255,255,0.55)';
    x.beginPath(); x.ellipse(cx - 0.12 * s, cy + 0.15 * s, 0.09 * s, 0.035 * s, 0, 0, Math.PI * 2); x.fill();
  }

  function drawDrip(x, s) {
    const cx = s / 2;
    x.fillStyle = '#8A5426'; x.strokeStyle = '#4A2A0E'; x.lineWidth = Math.max(1, s * 0.06);
    x.beginPath();
    x.moveTo(cx, s * 0.05);
    x.quadraticCurveTo(cx + s * 0.32, s * 0.55, cx + s * 0.26, s * 0.72);
    x.arc(cx, s * 0.7, s * 0.26, 0.1, Math.PI - 0.1);
    x.quadraticCurveTo(cx - s * 0.32, s * 0.55, cx, s * 0.05);
    x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.35)';
    x.beginPath(); x.arc(cx - s * 0.08, s * 0.66, s * 0.06, 0, Math.PI * 2); x.fill();
  }

  function drawSplat(x, s) {
    const cx = s / 2, cy = s / 2;
    x.fillStyle = '#8A5426';
    x.beginPath(); x.arc(cx, cy, s * 0.2, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.3, r = s * (i % 2 ? 0.3 : 0.42);
      x.beginPath(); x.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s * (i % 2 ? 0.07 : 0.05), 0, Math.PI * 2); x.fill();
    }
  }

  // Toilet roll stack: a blocky barricade the drips and wipes chew through
  function shieldMask() {
    const m = [];
    for (let r = 0; r < SHIELD_ROWS; r++) {
      m.push([]);
      for (let c = 0; c < SHIELD_COLS; c++) {
        const corner = r === 0 && (c === 0 || c === SHIELD_COLS - 1);
        const arch = r >= SHIELD_ROWS - 2 && c >= 3 && c <= SHIELD_COLS - 4;
        m[r].push(corner || arch ? 0 : 1);
      }
    }
    return m;
  }

  function mount(root, opts) {
    injectCss();
    const hourly = opts.hourly || (() => 0);
    root.innerHTML = `
      <div class="ti">
        <div class="ti-hud">
          <div class="ti-stat"><div class="ti-lbl">Score</div><div class="ti-val" data-score>0</div></div>
          <div class="ti-stat"><div class="ti-lbl">Lives</div><div class="ti-val" data-lives></div></div>
          <div class="ti-stat"><div class="ti-lbl">Paid to play</div><div class="ti-val green" data-paid>$0.00</div></div>
          <button type="button" class="ti-mute" data-mute aria-label="Sound"></button>
        </div>
        <div class="ti-stage"><canvas></canvas><div class="ti-msg" hidden></div></div>
        <div class="ti-hint">Tap to fire · drag to move</div>
        <div class="ti-screen" data-screen></div>
      </div>`;
    const $ = sel => root.querySelector(sel);
    const el = {
      stage: $('.ti-stage'), canvas: $('canvas'), msg: $('.ti-msg'), screen: $('[data-screen]'),
      score: $('[data-score]'), lives: $('[data-lives]'), paid: $('[data-paid]'), mute: $('[data-mute]'),
    };
    const ctx = el.canvas.getContext('2d');

    let scale = 1, dpr = 1, spr = {}, bg = null;
    const g = {
      state: 'title', lv: 0, L: LEVELS[0], score: 0, lives: LIVES, playSecs: 0, clock: 0,
      inv: [], dir: 1, stepT: 0, frame: 0, total: 0,
      px: W / 2, shots: [], reload: 0, drips: [], fireT: 0,
      shields: [], splats: [], floats: [], ufo: null, ufoT: 0, dead: 0, shake: 0, ending: 0, endFn: null,
    };
    let frame = null, last = 0, alive = true, hud = {}, msgTimer = 0;
    const keys = { l: false, r: false, fire: false };

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
      spr = {
        inv: INVADERS.map((_, i) => [0, 1].map(f => sprite(SZ * 1.3 * k, (x, s) => drawInvader(x, s, i, f)))),
        cracked: [0, 1].map(f => sprite(SZ * 1.3 * k, (x, s) => drawInvader(x, s, 3, f, true))),
        toilet: sprite(PLAYER_W * 1.1 * k, drawToilet),
        ufo: sprite(36 * k, drawUfo),
        drip: sprite(14 * k, drawDrip),
        splat: sprite(SZ * 1.4 * k, drawSplat),
      };
      // Night sky behind the fleet, drawn once
      bg = sprite(1, () => {});
      bg.width = W * k; bg.height = H * k;
      const b = bg.getContext('2d');
      const gr = b.createLinearGradient(0, 0, 0, bg.height);
      gr.addColorStop(0, '#0E0A05'); gr.addColorStop(1, '#231A0A');
      b.fillStyle = gr; b.fillRect(0, 0, bg.width, bg.height);
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 60; i++) {
        b.fillStyle = `rgba(245,234,214,${0.15 + rnd() * 0.45})`;
        b.fillRect(rnd() * bg.width, rnd() * bg.height * 0.8, k * (rnd() < 0.2 ? 1.6 : 0.9), k * (rnd() < 0.2 ? 1.6 : 0.9));
      }
      // Bathroom floor tiles under the toilet
      b.fillStyle = '#2E2210'; b.fillRect(0, (H - 10) * k, bg.width, 10 * k);
      b.fillStyle = 'rgba(224,123,0,0.5)'; b.fillRect(0, (H - 10) * k, bg.width, k);
      for (let x = 0; x < W; x += 20) { b.fillStyle = 'rgba(0,0,0,0.3)'; b.fillRect(x * k, (H - 10) * k, k, 10 * k); }
      draw();
    }

    // ── SETUP ──
    function buildFleet() {
      const L = g.L, fw = (L.cols - 1) * GAP_X + SZ;
      const left = (W - fw) / 2, inv = [];
      L.rows.forEach((k, r) => {
        for (let c = 0; c < L.cols; c++) inv.push({ k, x: left + c * GAP_X, y: 46 + r * GAP_Y, hp: INVADERS[k].hp || 1, alive: true });
      });
      return inv;
    }
    function buildShields() {
      const n = g.L.shields, w = SHIELD_COLS * CELL, out = [];
      for (let i = 0; i < n; i++) out.push({ x: Math.round(W * (i + 1) / (n + 1) - w / 2), y: SHIELD_Y, m: shieldMask() });
      return out;
    }

    function startLevel(i) {
      sound.init();
      const r = el.stage.getBoundingClientRect();
      if (r.width && r.height) setHeight(Math.round(Math.max(450, Math.min(640, W * r.height / r.width))));
      g.lv = i; g.L = LEVELS[i];
      g.score = 0; g.lives = LIVES; g.playSecs = 0;
      g.inv = buildFleet(); g.total = g.inv.length; g.dir = 1; g.stepT = 0; g.frame = 0;
      g.px = W / 2; g.shots = []; g.reload = 0.3; g.drips = []; g.fireT = 1.2;
      g.shields = buildShields(); g.splats = []; g.floats = [];
      g.ufo = null; g.ufoT = 14 + Math.random() * 10; g.dead = 0; g.shake = 0; g.ending = 0; g.endFn = null;
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

    // ── UPDATE ──
    const living = () => g.inv.filter(v => v.alive);
    const hit = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

    // Knock a few blocks out of a toilet roll stack where something landed. Returns true on a hit.
    function chewShield(x, y, w, h, bite) {
      for (const s of g.shields) {
        if (!hit(x, y, w, h, s.x, s.y, SHIELD_COLS * CELL, SHIELD_ROWS * CELL)) continue;
        const c0 = Math.max(0, Math.floor((x - s.x) / CELL)), c1 = Math.min(SHIELD_COLS - 1, Math.floor((x + w - s.x) / CELL));
        const r0 = Math.max(0, Math.floor((y - s.y) / CELL)), r1 = Math.min(SHIELD_ROWS - 1, Math.floor((y + h - s.y) / CELL));
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
          if (!s.m[r][c]) continue;
          if (!bite) return true;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < SHIELD_ROWS && cc >= 0 && cc < SHIELD_COLS && (dr === 0 && dc === 0 || Math.random() < 0.45)) s.m[rr][cc] = 0;
          }
          return true;
        }
      }
      return false;
    }

    function addScore(pts, x, y) {
      g.score += pts;
      g.floats.push({ text: '+' + pts, x, y, t: 0.8 });
    }

    function update(dt) {
      g.clock += dt;
      if (g.state !== 'play') return;
      g.playSecs += dt;
      for (const s of g.splats) s.t -= dt;
      g.splats = g.splats.filter(s => s.t > 0);
      for (const f of g.floats) { f.t -= dt; if (!still) f.y -= dt * 20; }
      g.floats = g.floats.filter(f => f.t > 0);
      g.shake = Math.max(0, g.shake - dt);

      // Win / lose waits a beat so you see what happened
      if (g.ending) {
        g.ending -= dt;
        if (g.ending <= 0) { const fn = g.endFn; g.ending = 0; g.endFn = null; fn(); }
        return;
      }

      // Player
      if (g.dead > 0) {
        const was = g.dead;
        g.dead -= dt;
        // Back in the middle with a clear sky for the last second
        if (was >= 1 && g.dead < 1) { g.px = W / 2; g.drips = []; }
        if (g.dead <= 0) g.dead = 0;
      } else {
        const v = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
        g.px = Math.max(PLAYER_W / 2 + 4, Math.min(W - PLAYER_W / 2 - 4, g.px + v * 190 * dt));
        g.reload -= dt;
        if (keys.fire) fire();
      }

      // Paper squares going up
      for (const s of g.shots) {
        s.y -= 430 * dt;
        let gone = s.y < 0;
        if (!gone) {
          for (const v of g.inv) {
            if (!v.alive || !hit(s.x, s.y, 4, 8, v.x + 2, v.y + 2, SZ - 4, SZ - 2)) continue;
            gone = true;
            v.hp--;
            if (v.hp > 0) { sound.clunk(); break; }
            v.alive = false;
            addScore(INVADERS[v.k].pts, v.x + SZ / 2, v.y);
            g.splats.push({ x: v.x + SZ / 2, y: v.y + SZ / 2, t: 0.3 });
            sound.splat(); buzz(8);
            break;
          }
        }
        if (!gone && g.ufo && hit(s.x, s.y, 4, 8, g.ufo.x - 16, g.ufo.y - 8, 32, 16)) {
          gone = true;
          const pts = UFO_PTS[Math.floor(Math.random() * UFO_PTS.length)];
          addScore(pts, g.ufo.x, g.ufo.y + 10);
          g.splats.push({ x: g.ufo.x, y: g.ufo.y, t: 0.4 });
          g.ufo = null;
          sound.bonus(); buzz([10, 30, 10]);
        }
        if (gone) s.gone = true;
      }
      g.shots = g.shots.filter(s => !s.gone);

      const fleet = living();
      if (!fleet.length) {
        sound.win(); buzz([30, 60, 30]);
        flash('BOWL DEFENDED!', false, 1200);
        g.ending = 1.2; g.endFn = win;
        return;
      }

      // March: the whole fleet steps sideways, drops at the edge, speeds up as it thins out
      g.stepT -= dt;
      if (g.stepT <= 0) {
        const ratio = fleet.length / g.total;
        g.stepT = Math.max(0.045, g.L.step * (0.12 + 0.88 * ratio));
        let minX = W, maxX = 0;
        for (const v of fleet) { minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x + SZ); }
        const dx = 6 * g.dir;
        if (minX + dx < 4 || maxX + dx > W - 4) {
          g.dir *= -1;
          for (const v of fleet) v.y += 10;
        } else {
          for (const v of fleet) v.x += dx;
        }
        g.frame ^= 1;
        sound.march();
        for (const v of fleet) {
          // Anything marching through a toilet roll stack wrecks it
          chewShield(v.x, v.y, SZ, SZ, true);
          if (v.y + SZ >= FLOOR) {
            sound.fart(); buzz([60, 40, 120]);
            g.shake = still ? 0 : 0.5;
            flash('OVERFLOW!', true, 1400);
            g.ending = 1.4; g.endFn = () => lose('overflow');
            return;
          }
        }
      }

      // Drips: a random poo at the bottom of its column lets one go, often the one above you
      g.fireT -= dt;
      if (g.fireT <= 0 && g.dead <= 0) {
        g.fireT = g.L.fire * (0.5 + Math.random());
        if (g.drips.length < g.L.drips) {
          const bottom = {};
          for (const v of fleet) { const c = Math.round(v.x / GAP_X); if (!bottom[c] || v.y > bottom[c].y) bottom[c] = v; }
          const cols = Object.values(bottom);
          let pick = cols[Math.floor(Math.random() * cols.length)];
          if (Math.random() < 0.4) pick = cols.reduce((a, b) => Math.abs(b.x + SZ / 2 - g.px) < Math.abs(a.x + SZ / 2 - g.px) ? b : a);
          g.drips.push({ x: pick.x + SZ / 2 - 3, y: pick.y + SZ });
        }
      }
      for (const d of g.drips) {
        d.y += g.L.dripV * dt;
        if (d.y > H - 10) d.gone = true;
        else if (chewShield(d.x, d.y, 7, 11, true)) d.gone = true;
        else if (g.shots.some(s => !s.gone && hit(d.x, d.y, 7, 11, s.x - 2, s.y, 8, 8) && (s.gone = true))) {
          // Paper meets drip: both gone
          d.gone = true;
          g.splats.push({ x: d.x + 3, y: d.y + 4, t: 0.2, small: true });
        } else if (g.dead <= 0 && hit(d.x, d.y, 7, 11, g.px - PLAYER_W / 2 + 3, PLAYER_Y - PLAYER_H / 2 + 4, PLAYER_W - 6, PLAYER_H - 4)) {
          d.gone = true;
          playerHit();
        }
      }
      g.drips = g.drips.filter(d => !d.gone);

      // Golden saucer drifts across the top now and then
      if (g.ufo) {
        g.ufo.x += g.ufo.vx * dt;
        g.ufo.snd -= dt;
        if (g.ufo.snd <= 0) { g.ufo.snd = 0.3; sound.ufo(); }
        if (g.ufo.x < -30 || g.ufo.x > W + 30) g.ufo = null;
      } else {
        g.ufoT -= dt;
        if (g.ufoT <= 0) {
          g.ufoT = 16 + Math.random() * 12;
          const fromLeft = Math.random() < 0.5;
          g.ufo = { x: fromLeft ? -20 : W + 20, y: 22, vx: fromLeft ? 70 : -70, snd: 0 };
        }
      }
    }

    function playerHit() {
      g.lives--;
      g.splats.push({ x: g.px, y: PLAYER_Y, t: 0.6 });
      g.shots = [];
      sound.plop(); buzz([60, 40, 120]);
      g.shake = still ? 0 : 0.35;
      if (g.lives <= 0) {
        flash('FLUSHED!', true, 1400);
        g.dead = 99;
        g.ending = 1.4; g.endFn = () => lose('flushed');
      } else {
        flash('SPLASHBACK!', true, 1000);
        g.dead = 1.6;
      }
    }

    // ── DRAW ──
    function draw() {
      if (!bg) return;
      const k = scale * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(bg, 0, 0);
      ctx.save();
      if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 6 * k, (Math.random() - 0.5) * 6 * k);
      ctx.scale(k, k);
      const show = g.state !== 'title';

      if (show) {
        // Toilet roll stacks
        for (const s of g.shields) {
          for (let r = 0; r < SHIELD_ROWS; r++) for (let c = 0; c < SHIELD_COLS; c++) {
            if (!s.m[r][c]) continue;
            ctx.fillStyle = r % 2 ? '#E8DCC6' : '#F5EAD6';
            ctx.fillRect(s.x + c * CELL, s.y + r * CELL, CELL, CELL);
          }
          // Roll seams so it reads as a stack of rolls
          ctx.fillStyle = 'rgba(160,128,96,0.45)';
          for (let c = 3; c < SHIELD_COLS; c += 3) for (let r = 0; r < SHIELD_ROWS; r++) {
            if (s.m[r][c]) ctx.fillRect(s.x + c * CELL, s.y + r * CELL, 0.8, CELL);
          }
        }

        // Fleet
        const box = SZ * 1.3, off = (box - SZ) / 2;
        for (const v of g.inv) {
          if (!v.alive) continue;
          const f = still ? 0 : g.frame;
          const img = INVADERS[v.k].hp && v.hp < INVADERS[v.k].hp ? spr.cracked[f] : spr.inv[v.k][f];
          ctx.drawImage(img, v.x - off, v.y - off, box, box);
        }

        if (g.ufo) ctx.drawImage(spr.ufo, g.ufo.x - 18, g.ufo.y - 18, 36, 36);

        // Drips
        for (const d of g.drips) ctx.drawImage(spr.drip, d.x - 3.5, d.y - 2, 14, 14);

        // Paper squares
        for (const s of g.shots) {
          ctx.fillStyle = '#FFFDF6';
          ctx.fillRect(s.x, s.y, 4, 8);
          ctx.fillStyle = 'rgba(160,128,96,0.6)';
          ctx.fillRect(s.x, s.y + 4, 4, 0.6);
        }

        // Toilet (gone for a moment when hit, then blinks back in the middle)
        const back = g.dead > 0 && g.dead < 1;
        if (g.dead <= 0 || (back && (still || Math.floor(g.clock * 10) % 2 === 0))) {
          ctx.drawImage(spr.toilet, g.px - PLAYER_W * 0.55, PLAYER_Y - PLAYER_H / 2 - 6, PLAYER_W * 1.1, PLAYER_W * 1.1);
        }

        // Splats
        for (const s of g.splats) {
          const sz = s.small ? 12 : SZ * 1.4;
          ctx.globalAlpha = Math.min(1, s.t * 4);
          ctx.drawImage(spr.splat, s.x - sz / 2, s.y - sz / 2, sz, sz);
        }
        ctx.globalAlpha = 1;

        // Points
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = "14px 'Bebas Neue', sans-serif";
        for (const f of g.floats) {
          ctx.globalAlpha = Math.min(1, f.t * 2);
          ctx.lineWidth = 3; ctx.strokeStyle = '#1A1208'; ctx.strokeText(f.text, f.x, f.y);
          ctx.fillStyle = '#F5C842'; ctx.fillText(f.text, f.x, f.y);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    function renderHud() {
      const paid = '$' + (hourly() * g.playSecs / 3600).toFixed(2);
      if (hud.score !== g.score) el.score.textContent = (hud.score = g.score).toLocaleString('en-US');
      if (hud.lives !== g.lives) el.lives.textContent = '🚽 ' + Math.max(0, hud.lives = g.lives);
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
    function fillIcons() {
      el.screen.querySelectorAll('[data-icon]').forEach(d => {
        const k = d.dataset.icon;
        const c = sprite(60, (x, s) => k === 'ufo' ? drawUfo(x, s) : k === 'toilet' ? drawToilet(x, s) : drawInvader(x, s, +k, 0));
        d.prepend(c);
      });
    }
    const pieceRow = (icon, name, desc) => `<div class="ti-piece" data-icon="${icon}"><div><b>${name}</b><span>${desc}</span></div></div>`;

    function titleScreen() {
      g.state = 'title';
      el.msg.hidden = true;
      const p = progress();
      const open = i => preview || i <= p.unlocked;
      el.screen.innerHTML = `
        <div class="ti-hero" data-hero></div>
        <div class="ti-title">Turd Invaders</div>
        <div class="ti-sub">Wipe them out before they land</div>
        <div class="ti-levels">
          ${LEVELS.map((L, i) => `<button type="button" class="ti-level" data-lv="${i}" ${open(i) ? '' : 'disabled'}>
            <div class="ti-level-n">${i + 1}</div>
            <div class="ti-level-t"><b>${L.name}</b><span>${open(i) ? L.sub + (p.best[i] ? ' · best ' + p.best[i].toLocaleString('en-US') : '') : '🔒 Beat level ' + i + ' first'}</span></div>
            <div class="ti-stars">${p.stars[i] ? starStr(p.stars[i]) : ''}</div>
            ${open(i) ? '<div class="ti-play">Play <svg width="0.8em" height="0.8em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-0.05em"><path d="M7 4.8v14.4a1.2 1.2 0 0 0 1.8 1l11.6-7.2a1.2 1.2 0 0 0 0-2L8.8 3.8A1.2 1.2 0 0 0 7 4.8z"/></svg></div>' : '<div class="ti-play locked" aria-label="Locked">🔒</div>'}
          </button>`).join('')}
        </div>
        <div class="ti-box" style="margin-top:8px">
          <div class="ti-lbl" style="margin-bottom:6px">Instructions</div>
          <div class="ti-instr-text">You're the toilet. Tap anywhere to fire a square of dunny paper (with a little toot). Drag to slide left and right; tap with another finger to fire while you drag.</div>
          <div class="ti-instr-text">Wipe out the whole fleet before it reaches the floor. Dodge the drips, or hide behind the toilet rolls (your paper goes straight through them, theirs doesn't). Lose all ${LIVES} toilets and you're flushed.</div>
          <div class="ti-lbl" style="margin:4px 0 8px">The fleet</div>
          <div class="ti-pieces">
            ${INVADERS.map((v, k) => pieceRow(k, v.name + ' · ' + v.pts, v.desc)).join('')}
            ${pieceRow('ufo', 'Golden saucer · ???', 'flies over now and then')}
          </div>
        </div>`;
      el.screen.hidden = false;
      el.screen.querySelector('[data-hero]').appendChild(sprite(168, (x, s) => drawInvader(x, s, 0, 0)));
      fillIcons();
      el.screen.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => startLevel(+b.dataset.lv); });
      draw();
    }

    function win() {
      g.state = 'over';
      const bonus = g.lives * 250;
      g.score += bonus;
      const stars = Math.max(1, g.lives);
      const p = progress();
      p.stars[g.lv] = Math.max(p.stars[g.lv] || 0, stars);
      const record = g.score > (p.best[g.lv] || 0);
      if (record) p.best[g.lv] = g.score;
      p.unlocked = Math.max(p.unlocked, Math.min(g.lv + 1, LEVELS.length - 1));
      save(PROGRESS_KEY, p);
      const more = g.lv + 1 < LEVELS.length;
      const paid = '$' + (hourly() * g.playSecs / 3600).toFixed(2);
      el.screen.innerHTML = `
        <div class="ti-hero">🧻</div>
        <div class="ti-title">Bowl Defended!</div>
        <div class="ti-sub">Level ${g.lv + 1} · ${g.L.name}</div>
        <div class="ti-bigstars">${starStr(stars)}</div>
        <div class="ti-box ti-grid">
          <div><div class="ti-lbl">Score</div><div class="ti-val">${g.score.toLocaleString('en-US')}</div></div>
          <div><div class="ti-lbl">Toilets left</div><div class="ti-val" style="color:#f5c842">+${bonus}</div></div>
          <div><div class="ti-lbl">Paid to play</div><div class="ti-val green">${paid}</div></div>
          <div><div class="ti-lbl">Level record?</div><div class="ti-val" style="color:${record ? '#f5c842' : '#a08060'}">${record ? 'YES!' : 'Nah · ' + p.best[g.lv].toLocaleString('en-US')}</div></div>
        </div>
        ${more ? '<button type="button" class="ti-btn" data-next><svg width="0.8em" height="0.8em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-0.05em"><path d="M7 4.8v14.4a1.2 1.2 0 0 0 1.8 1l11.6-7.2a1.2 1.2 0 0 0 0-2L8.8 3.8A1.2 1.2 0 0 0 7 4.8z"/></svg> Next level</button>' :
          '<div style="font-size:14px;opacity:0.8;margin-bottom:8px">That\'s every wave so far. More are on the way.</div>'}
        <button type="button" class="ti-btn ghost" data-again>↺ Play again</button>
        <button type="button" class="ti-link" data-levels><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>All levels</button>
        <button type="button" class="ti-link" data-exit><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>Back to the bog timer</button>`;
      el.screen.hidden = false;
      wireEnd(more);
    }

    function lose(why) {
      g.state = 'over';
      const p = progress();
      if (g.score > (p.best[g.lv] || 0)) { p.best[g.lv] = g.score; save(PROGRESS_KEY, p); }
      const left = living().length;
      const paid = '$' + (hourly() * g.playSecs / 3600).toFixed(2);
      el.screen.innerHTML = `
        <div class="ti-hero" style="filter:drop-shadow(0 0 24px rgba(224,123,0,0.5))">🪠</div>
        <div class="ti-title amber">${why === 'overflow' ? 'Overflow!' : 'Flushed!'}</div>
        <div class="ti-sub">${why === 'overflow' ? 'They hit the floor' : 'Out of toilets'}, ${left} still up there</div>
        <div class="ti-box ti-grid">
          <div><div class="ti-lbl">Score</div><div class="ti-val">${g.score.toLocaleString('en-US')}</div></div>
          <div><div class="ti-lbl">Paid to play</div><div class="ti-val green">${paid}</div></div>
        </div>
        <button type="button" class="ti-btn" data-again>↺ Try again</button>
        <button type="button" class="ti-link" data-levels><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>All levels</button>
        <button type="button" class="ti-link" data-exit><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>Back to the bog timer</button>`;
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
    // Drag anywhere on the play area: the toilet follows your finger sideways,
    // from wherever it was, so your thumb never has to cover it.
    // Every touch fires too, so a second finger shoots while the first one steers.
    let drag = null;
    function fire() {
      // Two squares of paper in the air at most, with a short reload between taps
      if (g.state !== 'play' || g.ending || g.dead > 0 || g.reload > 0 || g.shots.length >= 2) return;
      g.shots.push({ x: g.px - 2, y: PLAYER_Y - PLAYER_H / 2 - 8 });
      g.reload = 0.2;
      sound.toot();
    }
    function onDown(e) {
      if (g.state !== 'play') return;
      sound.init();
      fire();
      if (!drag) {
        drag = { id: e.pointerId, x: e.clientX, px: g.px };
        try { el.canvas.setPointerCapture(e.pointerId); } catch (err) {}
      }
      e.preventDefault();
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id || g.dead > 0) return;
      // A touch faster than 1:1 so a short thumb slide covers the bowl
      g.px = Math.max(PLAYER_W / 2 + 4, Math.min(W - PLAYER_W / 2 - 4, drag.px + (e.clientX - drag.x) / scale * 1.3));
    }
    function onUp(e) {
      if (drag && e.pointerId === drag.id) drag = null;
    }
    function onKey(e) {
      const down = e.type === 'keydown';
      if (down && e.key === 'Escape' && opts.onExit) { opts.onExit(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keys.l = down; e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.r = down; e.preventDefault(); }
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { keys.fire = down; e.preventDefault(); }
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
    window.addEventListener('keyup', onKey);
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
        window.removeEventListener('keyup', onKey);
        document.removeEventListener('visibilitychange', onVisible);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', layout);
        root.innerHTML = '';
      },
      _test: { g, win, lose, playerHit },
    };
  }

  window.TurdInvaders = { mount, LEVELS };
})();
