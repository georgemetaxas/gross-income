// ══ STEP IN IT ══
// A walk across the dog park without stepping in anything. Tap grass to step on it:
// a number says how many dog poos are in the 8 squares around it. Bag every poo you're
// sure of (long-press, or switch to Bag mode) and clear the whole park to win.
// Loaded only when someone opens it.
//
// window.StepInIt.mount(el, { hourly: () => number, onExit: () => void })
// draws the game into el and returns { destroy() }.
(function () {
  // Add a level by adding a line. par = seconds for 3 stars (2 stars inside double).
  const LEVELS = [
    { name: 'Off-Lead Area', cols: 8, rows: 10, poos: 10, par: 60, sub: '8×10 · 10 dogs did their business' },
    { name: 'Dog Park', cols: 9, rows: 12, poos: 18, par: 150, sub: '9×12 · 18 little surprises' },
    { name: 'Doggy Daycare', cols: 10, rows: 14, poos: 30, par: 330, sub: '10×14 · 30 landmines, good luck' },
  ];
  const HOLD_MS = 380; // long-press to bag
  const PROGRESS_KEY = 'gi.stepinit.v1';
  const MUTE_KEY = 'gi.stepinit.muted';
  const MODE_KEY = 'gi.stepinit.mode';
  const NUM_INK = ['', '#2f6fb8', '#2e7d4a', '#c0392b', '#5b3a8f', '#8a4b14', '#1f7f7f', '#1a1208', '#6b5a45'];
  // One of these shows when you step in it
  const SPLATS = [
    'Fresh, warm and right under your shoe.',
    "That's going in the car with you.",
    'Scrape it off on the grass. All of it.',
    'Should have brought the bags.',
    "Every dog in the park saw that.",
  ];
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Branch previews unlock every level so they can all be tested
  const preview = /\.pages\.dev$|^localhost$|^127\./.test(location.hostname);

  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  const rnd = n => Math.floor(Math.random() * n);
  const clock = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const PLAY_ICON = '<svg width="0.8em" height="0.8em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-0.05em"><path d="M7 4.8v14.4a1.2 1.2 0 0 0 1.8 1l11.6-7.2a1.2 1.2 0 0 0 0-2L8.8 3.8A1.2 1.2 0 0 0 7 4.8z"/></svg>';
  const GRID_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>';
  const BACK_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>';

  const CSS = `
  .si { position: relative; display: flex; flex-direction: column; height: 100%;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; color: var(--cream, #f5ead6); }
  .si-hud { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; padding: 10px 14px;
    background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 16px; }
  .si-stat { flex: 1; min-width: 0; }
  .si-lbl { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; color: var(--muted, #a08060); text-transform: uppercase; }
  .si-val { font-family: 'Bebas Neue', sans-serif; font-size: 24px; line-height: 1.05; letter-spacing: 1px; }
  .si-val.green { color: var(--green, #4caf6e); }
  .si-mute { background: none; border: 1px solid rgba(245,200,66,0.2); border-radius: 50%; width: 36px; height: 36px;
    font-size: 16px; cursor: pointer; flex-shrink: 0; }
  .si-stage { flex: 1; min-height: 0; position: relative; display: flex; align-items: center; justify-content: center; }
  .si-park { background: #2a5a33; border-radius: 12px; padding: 5px; box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
  .si-park canvas { display: block; touch-action: none; border-radius: 8px; }
  .si-park.shake { animation: siShake 0.4s; }
  @keyframes siShake { 0%,100% { transform: none; } 20% { transform: translate(-6px,2px); } 40% { transform: translate(5px,-3px); }
    60% { transform: translate(-4px,1px); } 80% { transform: translate(3px,-1px); } }
  .si-toast { position: absolute; left: 50%; top: 0; transform: translateX(-50%); pointer-events: none; max-width: 94%;
    background: #1a1208; border: 1.5px solid #f5c842; color: var(--cream, #f5ead6); border-radius: 14px; padding: 7px 14px;
    font-size: 13px; line-height: 1.3; text-align: center; box-shadow: 0 6px 20px rgba(0,0,0,0.5); z-index: 1; }
  .si-toast[hidden] { display: none; }
  .si-bar { display: flex; gap: 8px; flex-shrink: 0; padding-top: 10px; }
  .si-mode { flex: 1; display: flex; background: var(--surface, #231a0a); border: 1.5px solid rgba(245,200,66,0.35); border-radius: 12px; padding: 3px; }
  .si-mode button { flex: 1; background: none; border: none; border-radius: 9px; color: var(--muted, #a08060); cursor: pointer;
    font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; padding: 8px 6px; }
  .si-mode button.on { background: var(--gold, #f5c842); color: #1a1208; }
  .si-tip { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.5px; color: var(--muted, #a08060); text-align: center; padding-top: 6px; flex-shrink: 0; }
  .si-screen { position: absolute; inset: 0; z-index: 2; background: var(--bg, #1a1208); overflow-y: auto;
    display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 4px; }
  .si-screen > :first-child { margin-top: auto; }
  .si-screen > :last-child { margin-bottom: auto; }
  .si-screen[hidden] { display: none; }
  .si-hero { font-size: 72px; line-height: 1; filter: drop-shadow(0 0 24px rgba(245,200,66,0.45)); }
  .si-title { font-family: 'Bebas Neue', sans-serif; font-size: 64px; line-height: 0.95; color: var(--gold, #f5c842); margin-top: 6px; }
  .si-sub { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin: 8px 0 14px; }
  .si-box { width: 100%; background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 20px;
    padding: 12px 14px; text-align: left; margin-bottom: 12px; }
  .si-instr-text { font-size: 14px; line-height: 1.5; margin: 0 0 4px; }
  .si-levels { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-bottom: 4px; }
  .si-level { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer;
    background: var(--surface, #231a0a); border: 1.5px solid rgba(245,200,66,0.45); border-radius: 16px; padding: 10px 14px; color: inherit; }
  .si-level:disabled { opacity: 0.4; cursor: default; border-color: rgba(224,123,0,0.25); }
  .si-level-n { font-family: 'Bebas Neue', sans-serif; font-size: 34px; color: var(--gold, #f5c842); width: 26px; text-align: center; }
  .si-level-t { flex: 1; min-width: 0; }
  .si-level-t b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 21px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; }
  .si-level-t span { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted, #a08060); }
  .si-stars { font-size: 14px; letter-spacing: 0; white-space: nowrap; }
  .si-play { flex-shrink: 0; min-width: 64px; text-align: center; background: var(--gold, #f5c842); color: #1a1208; border-radius: 10px;
    padding: 8px 12px; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; line-height: 1; white-space: nowrap; }
  .si-play.locked { background: none; color: var(--muted, #a08060); border: 1px solid rgba(224,123,0,0.35); letter-spacing: 0; font-size: 15px; }
  .si-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
  .si-grid .si-val { font-size: 32px; }
  .si-bigstars { font-size: 40px; letter-spacing: 6px; margin: 2px 0 10px; }
  .si-quip { font-size: 15px; line-height: 1.4; margin: -4px 0 14px; opacity: 0.9; }
  .si-btn { width: 100%; border: none; border-radius: 12px; background: var(--gold, #f5c842); color: #1a1208;
    font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 3px; padding: 14px; cursor: pointer; margin-top: 4px; }
  .si-btn.ghost { background: transparent; color: var(--gold, #f5c842); border: 1.5px solid rgba(245,200,66,0.6); margin-top: 20px; }
  .si-link { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent;
    color: var(--cream, #f5ead6); border: none; border-radius: 12px; font-family: 'Bebas Neue', sans-serif;
    font-size: 19px; letter-spacing: 2px; padding: 12px 14px; margin-top: 20px; cursor: pointer; }
  .si-link svg { color: var(--gold, #f5c842); flex: 0 0 auto; margin-top: -2px; }
  `;

  function injectCss() {
    if (document.getElementById('si-style')) return;
    const s = document.createElement('style');
    s.id = 'si-style';
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
    step() { this.tone(520, 380, 0.05, 'triangle', 0.05); },
    sweep() { this.tone(300, 700, 0.18, 'triangle', 0.06); },
    bag() { this.tone(700, 1000, 0.07, 'square', 0.03); },
    unbag() { this.tone(800, 500, 0.07, 'square', 0.03); },
    squelch() { this.tone(160, 40, 0.6, 'sawtooth', 0.14, 22); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.18, 'triangle', 0.08), i * 120)); },
  };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  // ── PARK ──
  // Poos go down on the first step, never on or next to it, so the first step always opens some grass.
  function plant(L, safeR, safeC) {
    const n = L.cols * L.rows, poo = new Uint8Array(n);
    const spots = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / L.cols), c = i % L.cols;
      if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
      spots.push(i);
    }
    for (let k = 0; k < L.poos && spots.length; k++) poo[spots.splice(rnd(spots.length), 1)[0]] = 1;
    return poo;
  }

  function mount(root, opts) {
    injectCss();
    const hourly = opts.hourly || (() => 0);
    root.innerHTML = `
      <div class="si">
        <div class="si-hud">
          <div class="si-stat"><div class="si-lbl">Poos left</div><div class="si-val" data-left>0</div></div>
          <div class="si-stat"><div class="si-lbl">Time</div><div class="si-val" data-time>0:00</div></div>
          <div class="si-stat"><div class="si-lbl">Paid to play</div><div class="si-val green" data-paid>$0.00</div></div>
          <button type="button" class="si-mute" data-mute aria-label="Sound"></button>
        </div>
        <div class="si-stage">
          <div class="si-park"><canvas></canvas></div>
          <div class="si-toast" hidden></div>
        </div>
        <div class="si-bar">
          <div class="si-mode" role="group" aria-label="Tap does">
            <button type="button" data-mode="step">👟 Step</button>
            <button type="button" data-mode="bag">🛍️ Bag it</button>
          </div>
        </div>
        <div class="si-tip" data-tip></div>
        <div class="si-screen" data-screen></div>
      </div>`;
    const $ = sel => root.querySelector(sel);
    const el = {
      stage: $('.si-stage'), park: $('.si-park'), canvas: $('canvas'), toast: $('.si-toast'), screen: $('[data-screen]'),
      left: $('[data-left]'), time: $('[data-time]'), paid: $('[data-paid]'), mute: $('[data-mute]'), tip: $('[data-tip]'),
      modes: root.querySelectorAll('[data-mode]'),
    };
    const ctx = el.canvas.getContext('2d');

    let T = 30, W = 0, H = 0, dpr = 1;
    const g = {
      state: 'title', lv: 0, L: LEVELS[0], poo: null, open: null, bag: null, nums: null,
      secs: 0, started: false, opened: 0, bags: 0, boom: -1, mode: load(MODE_KEY, 'step'), press: -1,
    };
    let alive = true, timer = 0, last = 0, toastTimer = 0, frame = null, endTimer = 0;

    // ── LAYOUT ──
    function layout() {
      if (!g.open) return;
      const r = el.stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const { cols, rows } = g.L;
      T = Math.max(20, Math.floor(Math.min((r.width - 10) / cols, (r.height - 10) / rows)));
      W = T * cols; H = T * rows;
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      el.canvas.width = W * dpr; el.canvas.height = H * dpr;
      el.canvas.style.width = W + 'px'; el.canvas.style.height = H + 'px';
      draw();
    }

    // ── DRAW ──
    function rrect(x, y, w, h, rad) {
      ctx.beginPath();
      ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
    }
    // A knotted green doggy bag
    function drawBag(x, y) {
      const s = T;
      ctx.fillStyle = '#1f2a1c';
      ctx.beginPath(); ctx.ellipse(x + s * 0.5, y + s * 0.84, s * 0.26, s * 0.06, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath();
      ctx.moveTo(x + s * 0.42, y + s * 0.36);
      ctx.quadraticCurveTo(x + s * 0.2, y + s * 0.5, x + s * 0.26, y + s * 0.78);
      ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.88, x + s * 0.74, y + s * 0.78);
      ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.5, x + s * 0.58, y + s * 0.36);
      ctx.closePath(); ctx.fill();
      // knot ears
      ctx.beginPath(); ctx.ellipse(x + s * 0.4, y + s * 0.26, s * 0.08, s * 0.11, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + s * 0.6, y + s * 0.26, s * 0.08, s * 0.11, 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.ellipse(x + s * 0.38, y + s * 0.6, s * 0.04, s * 0.12, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    function draw() {
      frame = null;
      if (!alive || !g.open) return;
      const { cols, rows } = g.L;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const over = g.state === 'lost';
      for (let i = 0; i < cols * rows; i++) {
        const r = Math.floor(i / cols), c = i % cols, x = c * T, y = r * T;
        const odd = (r + c) % 2;
        if (g.open[i]) {
          ctx.fillStyle = odd ? '#e3d1ab' : '#ecdcba';
          ctx.fillRect(x, y, T, T);
          if (g.poo && g.poo[i]) {
            if (i === g.boom) { ctx.fillStyle = '#e6525b'; ctx.fillRect(x, y, T, T); }
            ctx.font = `${Math.round(T * 0.68)}px sans-serif`;
            ctx.fillText('💩', x + T / 2, y + T * 0.54);
          } else if (g.nums[i]) {
            ctx.fillStyle = NUM_INK[g.nums[i]];
            ctx.font = `${Math.round(T * 0.78)}px 'Bebas Neue', sans-serif`;
            ctx.fillText(g.nums[i], x + T / 2, y + T * 0.56);
          }
        } else {
          ctx.fillStyle = odd ? '#45a365' : '#4caf6e';
          ctx.fillRect(x, y, T, T);
          // Grass tufts, same spot in every square
          ctx.strokeStyle = 'rgba(30,80,40,0.22)'; ctx.lineWidth = Math.max(1, T * 0.05); ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x + T * 0.22, y + T * 0.78); ctx.lineTo(x + T * 0.18, y + T * 0.64);
          ctx.moveTo(x + T * 0.27, y + T * 0.78); ctx.lineTo(x + T * 0.3, y + T * 0.62);
          ctx.moveTo(x + T * 0.72, y + T * 0.36); ctx.lineTo(x + T * 0.69, y + T * 0.24);
          ctx.stroke();
          if (i === g.press) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, T, T); }
          if (g.bag[i]) {
            drawBag(x, y);
            if (over && !g.poo[i]) { // bagged nothing
              ctx.strokeStyle = '#e6525b'; ctx.lineWidth = Math.max(2, T * 0.1);
              ctx.beginPath(); ctx.moveTo(x + T * 0.2, y + T * 0.2); ctx.lineTo(x + T * 0.8, y + T * 0.8);
              ctx.moveTo(x + T * 0.8, y + T * 0.2); ctx.lineTo(x + T * 0.2, y + T * 0.8); ctx.stroke();
            }
          } else if (over && g.poo[i]) {
            ctx.font = `${Math.round(T * 0.62)}px sans-serif`;
            ctx.globalAlpha = 0.85;
            ctx.fillText('💩', x + T / 2, y + T * 0.54);
            ctx.globalAlpha = 1;
          }
        }
      }
      // Faint lines between squares
      ctx.strokeStyle = 'rgba(26,18,8,0.12)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 1; c < cols; c++) { ctx.moveTo(c * T + 0.5, 0); ctx.lineTo(c * T + 0.5, H); }
      for (let r = 1; r < rows; r++) { ctx.moveTo(0, r * T + 0.5); ctx.lineTo(W, r * T + 0.5); }
      ctx.stroke();
    }
    const redraw = () => { if (!frame) frame = requestAnimationFrame(draw); };

    function renderHud() {
      el.left.textContent = g.L.poos - g.bags;
      el.time.textContent = clock(g.secs);
      el.paid.textContent = '$' + (hourly() * g.secs / 3600).toFixed(2);
    }
    function renderMode() {
      el.modes.forEach(b => { const on = b.dataset.mode === g.mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      el.tip.textContent = g.mode === 'step' ? 'Tap to step · hold to bag a poo' : 'Tap to bag a poo · hold to step';
    }
    function renderMute() { el.mute.textContent = sound.muted ? '🔇' : '🔊'; }
    function toast(html, ms) {
      clearTimeout(toastTimer);
      el.toast.innerHTML = html;
      el.toast.hidden = false;
      toastTimer = setTimeout(() => { el.toast.hidden = true; }, ms || 2200);
    }

    // ── GAME ──
    const around = i => {
      const { cols, rows } = g.L, r = Math.floor(i / cols), c = i % cols, out = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc);
      }
      return out;
    };

    function startLevel(i) {
      sound.init();
      clearTimeout(endTimer);
      g.lv = i; g.L = LEVELS[i];
      const n = g.L.cols * g.L.rows;
      g.poo = null; g.open = new Uint8Array(n); g.bag = new Uint8Array(n); g.nums = new Uint8Array(n);
      g.secs = 0; g.started = false; g.opened = 0; g.bags = 0; g.boom = -1; g.press = -1;
      el.toast.hidden = true;
      el.screen.hidden = true;
      el.park.classList.remove('shake');
      g.state = 'play';
      renderHud();
      renderMode();
      layout();
      toast('First step is always safe', 1800);
      last = performance.now();
      clearInterval(timer);
      timer = setInterval(tickClock, 250);
    }

    function tickClock() {
      const now = performance.now();
      // A locked phone or a long pause doesn't count
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      if (g.state === 'play' && g.started && document.visibilityState === 'visible') g.secs += dt;
      renderHud();
    }

    // Opens a square; an empty one (no poos around) opens everything around it too.
    function reveal(i) {
      const stack = [i];
      let n = 0;
      while (stack.length) {
        const k = stack.pop();
        if (g.open[k] || g.bag[k]) continue;
        g.open[k] = 1; n++;
        if (g.poo[k]) continue;
        g.opened++;
        if (!g.nums[k]) around(k).forEach(j => { if (!g.open[j]) stack.push(j); });
      }
      return n;
    }

    function step(i) {
      if (g.bag[i]) return;
      if (!g.poo) {
        g.poo = plant(g.L, Math.floor(i / g.L.cols), i % g.L.cols);
        for (let k = 0; k < g.poo.length; k++) g.nums[k] = around(k).reduce((s, j) => s + g.poo[j], 0);
        g.started = true;
        last = performance.now();
      }
      if (g.open[i]) { chord(i); return; }
      if (g.poo[i]) { lose(i); return; }
      const n = reveal(i);
      if (n > 6) sound.sweep(); else sound.step();
      afterMove();
    }

    // Tapping a number that already has that many bags around it steps on the rest
    function chord(i) {
      if (!g.nums[i]) return;
      const ns = around(i);
      if (ns.filter(j => g.bag[j]).length !== g.nums[i]) return;
      const hit = ns.find(j => !g.open[j] && !g.bag[j] && g.poo[j]);
      if (hit !== undefined) { lose(hit); return; }
      let n = 0;
      ns.forEach(j => { if (!g.open[j] && !g.bag[j]) n += reveal(j); });
      if (!n) return;
      sound.sweep();
      afterMove();
    }

    function toggleBag(i) {
      if (g.open[i]) return;
      g.bag[i] = g.bag[i] ? 0 : 1;
      g.bags += g.bag[i] ? 1 : -1;
      if (g.bag[i]) { sound.bag(); buzz(15); } else sound.unbag();
      renderHud();
      redraw();
    }

    function afterMove() {
      renderHud();
      redraw();
      const safe = g.L.cols * g.L.rows - g.L.poos;
      if (g.opened >= safe) win();
    }

    function lose(i) {
      g.state = 'lost';
      g.boom = i;
      g.open[i] = 1;
      clearInterval(timer);
      sound.squelch(); buzz([60, 40, 120]);
      if (!still) el.park.classList.add('shake');
      redraw();
      endTimer = setTimeout(() => { if (alive) loseScreen(); }, 1300);
    }

    // ── SCREENS ──
    const progress = () => load(PROGRESS_KEY, { unlocked: 0, stars: [], best: [] });
    const starsFor = (L, secs) => secs <= L.par ? 3 : secs <= L.par * 2 ? 2 : 1;
    const starStr = n => '⭐'.repeat(n) + '<span style="opacity:0.25">' + '⭐'.repeat(3 - n) + '</span>';
    const endButtons = (again, ghost) => `
        <button type="button" class="si-btn${ghost ? ' ghost' : ''}" data-again>${again}</button>
        <button type="button" class="si-link" data-levels>${GRID_ICON}All levels</button>
        <button type="button" class="si-link" data-exit>${BACK_ICON}Back to the bog timer</button>`;
    function wireEnd(extra) {
      const on = (sel, fn) => { const b = el.screen.querySelector(sel); if (b) b.onclick = fn; };
      on('[data-again]', () => startLevel(g.lv));
      on('[data-levels]', titleScreen);
      on('[data-exit]', () => opts.onExit && opts.onExit());
      if (extra) extra(on);
      el.screen.hidden = false;
      el.screen.scrollTop = 0;
    }

    function titleScreen() {
      g.state = 'title';
      clearInterval(timer);
      clearTimeout(endTimer);
      const p = progress();
      const open = i => preview || i <= p.unlocked;
      el.screen.innerHTML = `
        <div class="si-hero"><img class="game-hero-art" src="icons/games/step-in-it.svg" alt="" width="112" height="112"></div>
        <div class="si-title">Step In It</div>
        <div class="si-sub">Cross the dog park, keep your shoes clean</div>
        <div class="si-levels">
          ${LEVELS.map((L, i) => `<button type="button" class="si-level" data-lv="${i}" ${open(i) ? '' : 'disabled'}>
            <div class="si-level-n">${i + 1}</div>
            <div class="si-level-t"><b>${L.name}</b><span>${open(i) ? L.sub + (p.best[i] ? ' · best ' + clock(p.best[i]) : '') : '🔒 Clear level ' + i + ' first'}</span></div>
            <div class="si-stars">${p.stars[i] ? starStr(p.stars[i]) : ''}</div>
            ${open(i) ? `<div class="si-play">Play ${PLAY_ICON}</div>` : '<div class="si-play locked" aria-label="Locked">🔒</div>'}
          </button>`).join('')}
        </div>
        <div class="si-box" style="margin-top:8px">
          <div class="si-lbl" style="margin-bottom:6px">Instructions</div>
          <div class="si-instr-text">Tap the grass to step on it. A number tells you how many dog poos are hiding in the 8 squares around it.</div>
          <div class="si-instr-text">Sure there's one there? Hold the square to bag it 🛍️, or switch to Bag it mode. Tap a number with all its poos bagged to step round them fast.</div>
          <div class="si-instr-text">Uncover every clean square to win. Step in one and it's all over your shoe.</div>
        </div>`;
      el.screen.hidden = false;
      el.screen.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => startLevel(+b.dataset.lv); });
    }

    function win() {
      g.state = 'won';
      clearInterval(timer);
      // Bag whatever's left so the board shows the finished park
      for (let k = 0; k < g.poo.length; k++) if (g.poo[k] && !g.bag[k]) { g.bag[k] = 1; g.bags++; }
      renderHud();
      redraw();
      const total = Math.round(g.secs);
      const stars = starsFor(g.L, total);
      const p = progress();
      p.stars[g.lv] = Math.max(p.stars[g.lv] || 0, stars);
      const record = !p.best[g.lv] || total < p.best[g.lv];
      if (record) p.best[g.lv] = total;
      p.unlocked = Math.max(p.unlocked, Math.min(g.lv + 1, LEVELS.length - 1));
      save(PROGRESS_KEY, p);
      sound.win(); buzz([30, 60, 30]);
      const more = g.lv + 1 < LEVELS.length;
      const paid = '$' + (hourly() * g.secs / 3600).toFixed(2);
      endTimer = setTimeout(() => {
        if (!alive) return;
        el.screen.innerHTML = `
          <div class="si-hero">👟✨</div>
          <div class="si-title">Clean Shoes!</div>
          <div class="si-sub">Level ${g.lv + 1} · ${g.L.name}</div>
          <div class="si-bigstars">${starStr(stars)}</div>
          <div class="si-box si-grid">
            <div><div class="si-lbl">Time</div><div class="si-val">${clock(total)}</div></div>
            <div><div class="si-lbl">Paid to play</div><div class="si-val green">${paid}</div></div>
            <div><div class="si-lbl">Poos dodged</div><div class="si-val">${g.L.poos}</div></div>
            <div><div class="si-lbl">Level record?</div><div class="si-val" style="color:${record ? '#f5c842' : '#a08060'}">${record ? 'YES!' : 'Nah · ' + clock(p.best[g.lv])}</div></div>
          </div>
          ${more ? `<button type="button" class="si-btn" data-next>${PLAY_ICON} Next level</button>` : ''}
          ${endButtons(more ? '↺ New park' : '↺ Play again', more)}`;
        wireEnd(on => { if (more) on('[data-next]', () => startLevel(g.lv + 1)); });
      }, 900);
    }

    function loseScreen() {
      const safe = g.L.cols * g.L.rows - g.L.poos;
      const pct = Math.floor(100 * g.opened / safe);
      const paid = '$' + (hourly() * g.secs / 3600).toFixed(2);
      el.screen.innerHTML = `
        <div class="si-hero">💩👟</div>
        <div class="si-title">Stepped In It!</div>
        <div class="si-sub">Level ${g.lv + 1} · ${g.L.name}</div>
        <div class="si-quip">${SPLATS[rnd(SPLATS.length)]}</div>
        <div class="si-box si-grid">
          <div><div class="si-lbl">Park cleared</div><div class="si-val">${pct}%</div></div>
          <div><div class="si-lbl">Paid to play</div><div class="si-val green">${paid}</div></div>
          <div><div class="si-lbl">Time</div><div class="si-val">${clock(g.secs)}</div></div>
          <div><div class="si-lbl">Bags right</div><div class="si-val">${[...g.bag].filter((b, k) => b && g.poo[k]).length}/${g.L.poos}</div></div>
        </div>
        ${endButtons('↺ Wipe off and go again')}`;
      wireEnd();
    }

    // ── INPUT ──
    // Tap does the current mode; holding does the other one.
    let down = null;
    function cellAt(e) {
      const r = el.canvas.getBoundingClientRect();
      const c = Math.floor((e.clientX - r.left) / T), rr = Math.floor((e.clientY - r.top) / T);
      return rr >= 0 && rr < g.L.rows && c >= 0 && c < g.L.cols ? rr * g.L.cols + c : -1;
    }
    function act(i, held) {
      const bagIt = (g.mode === 'bag') !== held;
      // Bagging only makes sense on grass; on an open number, either action steps round it
      if (bagIt && !g.open[i]) toggleBag(i); else step(i);
    }
    function onDown(e) {
      if (g.state !== 'play') return;
      const i = cellAt(e);
      if (i < 0) return;
      sound.init();
      try { el.canvas.setPointerCapture(e.pointerId); } catch (err) {}
      down = { i, x: e.clientX, y: e.clientY, held: false };
      down.t = setTimeout(() => {
        if (!down || g.state !== 'play') return;
        down.held = true;
        g.press = -1;
        act(down.i, true);
      }, HOLD_MS);
      g.press = i;
      redraw();
    }
    function onMove(e) {
      if (!down) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > T * 0.6) cancel();
    }
    function cancel() {
      if (down) clearTimeout(down.t);
      down = null; g.press = -1; redraw();
    }
    function onUp() {
      if (!down) return;
      const d = down;
      clearTimeout(d.t);
      down = null; g.press = -1;
      if (!d.held && g.state === 'play') act(d.i, false);
      redraw();
    }
    function onKey(e) { if (e.key === 'Escape' && opts.onExit) opts.onExit(); }
    function onVisible() { last = performance.now(); }

    el.mute.onclick = () => { sound.muted = !sound.muted; save(MUTE_KEY, sound.muted); sound.init(); renderMute(); };
    el.modes.forEach(b => { b.onclick = () => { g.mode = b.dataset.mode; save(MODE_KEY, g.mode); renderMode(); }; });
    el.canvas.addEventListener('pointerdown', onDown);
    el.canvas.addEventListener('pointermove', onMove);
    el.canvas.addEventListener('pointerup', onUp);
    el.canvas.addEventListener('pointercancel', cancel);
    el.canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisible);
    const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
    if (ro) ro.observe(el.stage); else window.addEventListener('resize', layout);

    renderMute();
    renderMode();
    titleScreen();

    return {
      destroy() {
        alive = false;
        if (sound.ac && sound.ac.state === 'running') sound.ac.suspend().catch(() => {});
        if (frame) cancelAnimationFrame(frame);
        if (down) clearTimeout(down.t);
        clearInterval(timer);
        clearTimeout(toastTimer);
        clearTimeout(endTimer);
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisible);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', layout);
        root.innerHTML = '';
      },
      _test: { g, step, toggleBag, start: startLevel },
    };
  }

  window.StepInIt = { mount, LEVELS };
})();
