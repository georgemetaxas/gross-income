// ══ TURD SNAKE ══
// Old phone snake, but you're a turd. Every bite makes the log longer and
// thicker. Corn stays in. Chillies make you go faster (and louder).
// Loaded only when someone opens it from the Bog Arcade.
//
// window.TurdSnake.mount(el, { hourly: () => number, onExit: () => void })
// draws the game into el and returns { destroy() }.
(function () {
  // 15 wide; the height in cells follows the screen so the bowl fills it
  const COLS = 15;
  let ROWS = 19;
  const DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]];
  const FOODS = [
    { emoji: '🌽', name: 'corn', corn: true },
    { emoji: '🥦', name: 'broccoli' },
    { emoji: '🫘', name: 'beans' },
    { emoji: '🌮', name: 'taco' },
    { emoji: '🍕', name: 'pizza' },
  ];
  const CM_PER_SEG = 4;
  const BEST_KEY = 'gi.turdsnake.best';
  const MUTE_KEY = 'gi.turdsnake.muted';
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  const CSS = `
  .ts { position: relative; display: flex; flex-direction: column; height: 100%; touch-action: none;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; color: var(--cream, #f5ead6); }
  .ts-hud { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; padding: 10px 14px;
    background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 16px; }
  .ts-stat { flex: 1; min-width: 0; }
  .ts-lbl { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; color: var(--muted, #a08060); text-transform: uppercase; }
  .ts-val { font-family: 'Bebas Neue', sans-serif; font-size: 24px; line-height: 1.05; letter-spacing: 1px; }
  .ts-val.green { color: var(--green, #4caf6e); }
  .ts-val.gold { color: var(--gold, #f5c842); }
  .ts-pass { width: 36px; height: 36px; border-radius: 50%; border: 1px solid #7fd3f5; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 0 12px rgba(127,211,245,0.45); }
  .ts-pass[hidden] { display: none; }
  .ts-mute { background: none; border: 1px solid rgba(245,200,66,0.2); border-radius: 50%; width: 36px; height: 36px;
    font-size: 16px; cursor: pointer; flex-shrink: 0; }
  .ts-stage { flex: 1; min-height: 0; position: relative; display: flex; align-items: center; justify-content: center;
    background: var(--surface, #231a0a); border-radius: 20px; transition: box-shadow 0.2s; }
  .ts-stage.hot { box-shadow: inset 0 0 0 2px #e07b00, 0 0 24px rgba(224,123,0,0.4); }
  .ts-stage canvas { display: block; border-radius: 14px; }
  .ts-msg { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none;
    font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 3px; color: #1a1208; background: #f5c842;
    padding: 6px 18px; border-radius: 18px; white-space: nowrap; box-shadow: 0 0 24px rgba(245,200,66,0.6); }
  .ts-msg[hidden] { display: none; }
  .ts-msg.amber { background: #e07b00; box-shadow: 0 0 24px rgba(224,123,0,0.6); }
  .ts-hint { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
    color: var(--muted, #a08060); text-align: center; padding: 10px 0 0; }
  /* Scrolls on short phones: auto margins centre it without cutting off the top, and the
     swipe-to-steer handler leaves these screens alone */
  .ts-screen { position: absolute; inset: 0; z-index: 2; background: var(--bg, #1a1208); overflow-y: auto;
    overscroll-behavior: contain; touch-action: pan-y;
    display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 4px; }
  .ts-screen > :first-child { margin-top: auto; }
  .ts-screen > :last-child { margin-bottom: auto; }
  /* Play stays in view on short phones while the instructions scroll under it */
  .ts-btn[data-go] { position: sticky; bottom: 0; z-index: 1; box-shadow: 0 -10px 18px 6px var(--bg, #1a1208); }
  .ts-screen[hidden] { display: none; }
  .ts-hero { font-size: 84px; line-height: 1; filter: drop-shadow(0 0 24px rgba(224,123,0,0.45)); }
  .ts-title { font-family: 'Bebas Neue', sans-serif; font-size: 72px; line-height: 0.95; color: var(--gold, #f5c842); margin-top: 6px; }
  .ts-title.amber { color: var(--amber, #e07b00); }
  .ts-sub { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin: 8px 0 16px; }
  .ts-instr-text { font-size: 14px; line-height: 1.5; margin: 0 0 10px; }
  .ts-box { width: 100%; background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 20px;
    padding: 14px 16px; text-align: left; margin-bottom: 12px; }
  .ts-row { display: flex; align-items: center; gap: 12px; padding: 5px 0; }
  .ts-av { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;
    flex-shrink: 0; background: rgba(245,200,66,0.12); }
  .ts-row b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 19px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; color: var(--gold, #f5c842); }
  .ts-row span { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted, #a08060); }
  .ts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
  .ts-grid .ts-val { font-size: 34px; }
  .ts-note { font-size: 14px; opacity: 0.8; margin-top: 12px; }
  .ts-btn { width: 100%; border: none; border-radius: 12px; background: var(--gold, #f5c842); color: #1a1208;
    font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 3px; padding: 14px; cursor: pointer; margin-top: 4px; }
  .ts-link { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent;
    color: var(--cream, #f5ead6); border: 1px solid rgba(245,234,214,0.28); border-radius: 12px; font-family: 'Bebas Neue', sans-serif;
    font-size: 19px; letter-spacing: 2px; padding: 12px 14px; margin-top: 12px; cursor: pointer; }
  .ts-link svg { color: var(--gold, #f5c842); flex: 0 0 auto; margin-top: -2px; }
  `;

  function injectCss() {
    if (document.getElementById('ts-style')) return;
    const s = document.createElement('style');
    s.id = 'ts-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── SOUND ──
  // Web Audio only starts after a tap (iOS rule), so it's created on the first button press.
  const sound = {
    ac: null, muted: load(MUTE_KEY, false), flip: false,
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
    chomp() { this.flip = !this.flip; this.tone(this.flip ? 420 : 340, 140, 0.08, 'square', 0.05); },
    fart() { this.tone(110, 50, 0.6, 'sawtooth', 0.12, 26); },
    splat() { this.tone(180, 40, 0.5, 'sawtooth', 0.14, 14); },
    record() { this.tone(500, 1000, 0.15, 'triangle', 0.08); setTimeout(() => this.tone(700, 1400, 0.2, 'triangle', 0.08), 150); },
  };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  function mount(root, opts) {
    injectCss();
    const hourly = opts.hourly || (() => 0);
    root.innerHTML = `
      <div class="ts">
        <div class="ts-hud">
          <div class="ts-stat"><div class="ts-lbl">Log length</div><div class="ts-val gold" data-len>0 cm</div></div>
          <div class="ts-stat"><div class="ts-lbl">Paid to play</div><div class="ts-val green" data-paid>$0.00</div></div>
          <div class="ts-stat"><div class="ts-lbl">Record</div><div class="ts-val" data-best>0 cm</div></div>
          <div class="ts-pass" data-pass title="U-bend: one free pass through the bowl" hidden>🌀</div>
          <button type="button" class="ts-mute" data-mute aria-label="Sound"></button>
        </div>
        <div class="ts-stage"><canvas></canvas><div class="ts-msg" hidden></div></div>
        <div class="ts-hint">Swipe to turn · arrow keys on desktop</div>
        <div class="ts-screen" data-screen></div>
      </div>`;
    const $ = sel => root.querySelector(sel);
    const el = {
      wrap: $('.ts'), stage: $('.ts-stage'), canvas: $('canvas'), msg: $('.ts-msg'), screen: $('[data-screen]'),
      len: $('[data-len]'), paid: $('[data-paid]'), best: $('[data-best]'), mute: $('[data-mute]'), pass: $('[data-pass]'),
    };
    const ctx = el.canvas.getContext('2d');

    let T = 20, W = 0, H = 0, dpr = 1, bg = null;
    const g = {
      state: 'title', body: [], lastTail: null, dir: [1, 0], queue: [], grow: 0, step: 0, acc: 0,
      food: null, bonus: null, bend: null, pass: false, eaten: 0, hot: 0, playSecs: 0, timer: 0, clock: 0,
      corn: [], puffs: [], cause: '', best: load(BEST_KEY, 0),
    };
    let frame = null, last = 0, alive = true, hud = {};

    // ── LAYOUT ──
    function layout() {
      const r = el.stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      // Only reshape the bowl between games, never under a live log
      if (g.state === 'title' || g.state === 'over') {
        const t = Math.floor((r.width - 16) / COLS);
        ROWS = Math.max(15, Math.min(30, Math.floor((r.height - 16) / t)));
      }
      T = Math.max(8, Math.floor(Math.min((r.width - 16) / COLS, (r.height - 16) / ROWS)));
      W = T * COLS; H = T * ROWS;
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      el.canvas.width = W * dpr; el.canvas.height = H * dpr;
      el.canvas.style.width = W + 'px'; el.canvas.style.height = H + 'px';
      buildBg();
      draw();
    }

    // The bowl: a dark LCD with a faint dot grid, like the old phones
    function buildBg() {
      bg = document.createElement('canvas');
      bg.width = W * dpr; bg.height = H * dpr;
      const b = bg.getContext('2d');
      const px = T * dpr;
      b.fillStyle = '#140e06'; b.fillRect(0, 0, bg.width, bg.height);
      b.fillStyle = 'rgba(245,200,66,0.07)';
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        b.beginPath(); b.arc((c + 0.5) * px, (r + 0.5) * px, Math.max(1, px * 0.05), 0, Math.PI * 2); b.fill();
      }
      b.strokeStyle = 'rgba(224,123,0,0.55)'; b.lineWidth = Math.max(2, dpr * 2);
      b.strokeRect(b.lineWidth / 2, b.lineWidth / 2, bg.width - b.lineWidth, bg.height - b.lineWidth);
    }

    // ── GAME SETUP ──
    function newGame() {
      sound.init();
      const cy = Math.floor(ROWS / 2) + 2;
      g.body = [[6, cy], [5, cy], [4, cy]];
      g.lastTail = [3, cy];
      g.dir = [1, 0]; g.queue = []; g.grow = 0; g.acc = 0; g.eaten = 0; g.hot = 0;
      g.playSecs = 0; g.corn = []; g.puffs = []; g.bonus = null; g.cause = '';
      g.bend = null; g.pass = false; renderPass();
      layout();
      g.food = spawn();
      el.screen.hidden = true;
      el.stage.classList.remove('hot');
      setState('ready', 1.2, 'SQUEEZE!');
      startLoop();
    }

    function setState(state, time, msg, amber) {
      g.state = state; g.timer = time || 0;
      el.msg.hidden = !msg;
      if (msg) { el.msg.textContent = msg; el.msg.classList.toggle('amber', !!amber); }
    }

    function flash(msg, amber) {
      setState('play', 0, msg, amber);
      clearTimeout(g.msgTimer);
      g.msgTimer = setTimeout(() => { if (g.state === 'play') el.msg.hidden = true; }, 900);
    }

    const onSnake = (c, r) => g.body.some(([x, y]) => x === c && y === r);
    function spawn(extra) {
      for (let i = 0; i < 400; i++) {
        const c = Math.floor(Math.random() * COLS), r = Math.floor(Math.random() * ROWS);
        if (onSnake(c, r)) continue;
        if (g.food && g.food.x === c && g.food.y === r) continue;
        if (g.bonus && g.bonus.x === c && g.bonus.y === r) continue;
        if (g.bend && g.bend.x === c && g.bend.y === r) continue;
        return { x: c, y: r, ...(extra || FOODS[Math.floor(Math.random() * FOODS.length)]) };
      }
      return null;
    }

    // Faster as the log gets longer, and much faster on a chilli
    function stepTime() {
      const t = Math.max(0.07, 0.17 - g.body.length * 0.0022);
      return g.hot > 0 ? t * 0.62 : t;
    }

    // ── UPDATE ──
    function move() {
      // Up to two queued turns so quick swipes (up then left) both land
      while (g.queue.length) {
        const d = g.queue.shift();
        if (d[0] === -g.dir[0] && d[1] === -g.dir[1]) continue;
        if (d[0] === g.dir[0] && d[1] === g.dir[1]) continue;
        g.dir = d; break;
      }
      const [hx, hy] = g.body[0];
      let nx = hx + g.dir[0], ny = hy + g.dir[1];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
        if (!g.pass) return die('bowl');
        // A U-bend lets you through the bowl once: out one side, in the other
        nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS;
        g.pass = false; renderPass();
        sound.chomp(); buzz([20, 20, 40]);
        flash('U-BEND!', true);
      }
      // Moving into the tail's cell is fine unless it's about to grow
      const hitsSelf = g.body.some(([x, y], i) => x === nx && y === ny && (i < g.body.length - 1 || g.grow > 0));
      if (hitsSelf) return die('self');

      g.body.unshift([nx, ny]);
      if (g.grow > 0) { g.grow--; g.lastTail = null; }
      else g.lastTail = g.body.pop();

      for (const k of g.corn) if (k.at < k.rest) k.at = Math.min(k.rest, k.at + 0.5);

      if (g.food && nx === g.food.x && ny === g.food.y) eat(g.food, false);
      if (g.bonus && nx === g.bonus.x && ny === g.bonus.y) eat(g.bonus, true);
      if (g.bend && nx === g.bend.x && ny === g.bend.y) {
        g.bend = null; g.pass = true; renderPass();
        sound.chomp(); buzz([15, 15, 15]);
        flash('U-BEND: ONE FREE PASS!', true);
      }
    }

    function eat(f, bonus) {
      g.eaten++;
      buzz(15);
      if (bonus) {
        g.grow += 2; g.hot = 4.5; g.bonus = null;
        sound.fart(); buzz([30, 30, 60]);
        el.stage.classList.add('hot');
        flash('RING OF FIRE!', true);
      } else {
        g.grow += 1;
        sound.chomp();
        if (f.corn && g.corn.length < 40) {
          g.corn.push({ at: 1, rest: 2 + Math.random() * (g.body.length + 1), side: Math.random() * 1.2 - 0.6 });
        }
        g.food = spawn();
        if (!g.bonus && g.eaten % 6 === 0) g.bonus = spawn({ emoji: '🌶️', name: 'chilli', life: 7 });
        // Rare: about 1 bite in 10 once you're going, and only one pass at a time
        else if (!g.bend && !g.pass && g.eaten >= 4 && Math.random() < 0.1) g.bend = spawn({ emoji: '🌀', name: 'u-bend', life: 6 });
      }
    }

    function die(cause) {
      g.cause = cause;
      sound.splat(); buzz(200);
      el.stage.classList.remove('hot');
      setState('dying', 1.4, cause === 'bowl' ? 'SPLAT!' : 'ATE YOURSELF!', true);
    }

    function update(dt) {
      g.clock += dt;
      if (g.state === 'ready' || g.state === 'dying') g.playSecs += dt;
      for (const p of g.puffs) p.t += dt;
      g.puffs = g.puffs.filter(p => p.t < 1.1);
      if (g.state === 'ready') { if ((g.timer -= dt) <= 0) setState('play'); return; }
      if (g.state === 'dying') { if ((g.timer -= dt) <= 0) gameOver(); return; }
      if (g.state !== 'play') return;
      g.playSecs += dt;

      if (g.hot > 0) {
        if ((g.hot -= dt) <= 0) el.stage.classList.remove('hot');
        else if (!still && Math.random() < dt * 14) {
          const t = g.body[g.body.length - 1];
          g.puffs.push({ x: t[0] + 0.5 + (Math.random() - 0.5) * 0.6, y: t[1] + 0.5 + (Math.random() - 0.5) * 0.6, t: 0 });
        }
      }
      if (g.bonus && (g.bonus.life -= dt) <= 0) g.bonus = null;
      if (g.bend && (g.bend.life -= dt) <= 0) g.bend = null;

      g.acc += dt;
      let st = stepTime();
      while (g.acc >= st && g.state === 'play') { g.acc -= st; move(); st = stepTime(); }
    }

    // ── DRAW ──
    function emoji(ch, x, y, size, glow, alpha) {
      if (glow) {
        ctx.globalAlpha = 0.25 * (alpha ?? 1);
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, size * 0.62, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = alpha ?? 1;
      ctx.font = `${size}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, x, y + size * 0.06);
      ctx.globalAlpha = 1;
    }

    // The log is drawn one step behind the game and slid forward, so it moves
    // smoothly even though the game moves a whole cell at a time.
    function bodyPoints(f) {
      const b = unwrap(g.body), pts = [];
      if (b.length < 2) return b.map(([x, y]) => [x + 0.5, y + 0.5]);
      const tail = g.lastTail && near(g.lastTail, b[b.length - 1]);
      const lerp = (a, c, t) => [a[0] + (c[0] - a[0]) * t + 0.5, a[1] + (c[1] - a[1]) * t + 0.5];
      pts.push(lerp(b[1], b[0], f));
      for (let i = 1; i < b.length; i++) pts.push([b[i][0] + 0.5, b[i][1] + 0.5]);
      if (tail) pts[pts.length - 1] = lerp(tail, b[b.length - 1], f);
      return pts;
    }

    // Cells that crossed the edge are shifted so the log is one unbroken path
    // (it may hang off the bowl; draw() repeats it on the other side)
    function near([x, y], [rx, ry]) {
      const dx = x - rx, dy = y - ry;
      return [x - Math.round(dx / COLS) * COLS, y - Math.round(dy / ROWS) * ROWS];
    }
    function unwrap(b) {
      const out = b.length ? [b[0]] : [];
      for (let i = 1; i < b.length; i++) out.push(near(b[i], out[i - 1]));
      return out;
    }

    // Walks the path from head to tail and returns evenly spaced points
    function sample(pts, gap) {
      const out = [];
      let carry = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        const len = Math.hypot(bx - ax, by - ay);
        let d = carry;
        while (d <= len) { const t = len ? d / len : 0; out.push([ax + (bx - ax) * t, ay + (by - ay) * t]); d += gap; }
        carry = d - len;
      }
      out.push(pts[pts.length - 1]);
      return out;
    }

    function drawLog(pts, main) {
      const s = sample(pts, 0.2);
      const n = s.length;
      // Thicker as it grows, tapered tail, a lumpy wobble along its length
      const girth = T * Math.min(0.5, 0.24 + g.body.length * 0.006);
      const radius = i => {
        const fromTail = (n - 1 - i) / 5;
        const taper = Math.min(1, 0.45 + fromTail * 0.55);
        const lump = 1 + 0.09 * Math.sin(i * 1.3);
        return girth * taper * lump;
      };
      const dying = g.state === 'dying';
      // Classic death blink
      if (dying && !still && Math.floor(g.clock * 8) % 2 === 0) return;
      const base = g.hot > 0 ? '#9C4E1C' : '#7A4A22';
      ctx.fillStyle = '#3A2210';
      for (let i = n - 1; i >= 0; i--) { const [x, y] = s[i]; ctx.beginPath(); ctx.arc(x * T, y * T, radius(i) + Math.max(1.5, T * 0.07), 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = base;
      for (let i = n - 1; i >= 0; i--) { const [x, y] = s[i]; ctx.beginPath(); ctx.arc(x * T, y * T, radius(i), 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,220,170,0.16)';
      for (let i = n - 1; i >= 0; i--) { const [x, y] = s[i]; ctx.beginPath(); ctx.arc(x * T - radius(i) * 0.25, y * T - radius(i) * 0.3, radius(i) * 0.45, 0, Math.PI * 2); ctx.fill(); }

      // Corn: it always comes out the other end
      for (const k of g.corn) {
        const i = Math.min(pts.length - 1, Math.floor(k.at)), a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)];
        const t = k.at - Math.floor(k.at);
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        const nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const kx = (x + nx * k.side * 0.35) * T, ky = (y + ny * k.side * 0.35) * T;
        ctx.fillStyle = '#F5C842'; ctx.strokeStyle = '#B8860B'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(kx, ky, T * 0.09, T * 0.07, k.side * 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }

      // Face on the front end: googly eyes that look where it's heading
      const [hx, hy] = pts[0];
      if (g.pass && !dying) {
        // Holding a U-bend: a blue swirl spins round the head
        ctx.strokeStyle = '#7fd3f5'; ctx.lineWidth = Math.max(2, T * 0.09);
        const a = still ? 0 : g.clock * 5;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath(); ctx.arc(hx * T, hy * T, girth + T * 0.22, a + k * 2.09, a + k * 2.09 + 1.2); ctx.stroke();
        }
      }
      const [dx, dy] = g.dir;
      const px = -dy, py = dx;
      const er = Math.max(3, girth * 0.42);
      for (const side of [-1, 1]) {
        const ex = (hx + dx * 0.08) * T + px * side * er * 1.05, ey = (hy + dy * 0.08) * T + py * side * er * 1.05;
        ctx.fillStyle = '#F5EAD6';
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1A1208';
        const wob = still ? 0 : Math.sin(g.clock * 9 + side) * er * 0.12;
        ctx.beginPath(); ctx.arc(ex + dx * er * 0.4 + wob, ey + dy * er * 0.4, er * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      if (dying) {
        ctx.strokeStyle = '#1A1208'; ctx.lineWidth = Math.max(1.5, T * 0.06);
        for (const side of [-1, 1]) {
          const ex = hx * T + px * side * er * 1.05, ey = hy * T + py * side * er * 1.05, r = er * 0.6;
          ctx.beginPath(); ctx.moveTo(ex - r, ey - r); ctx.lineTo(ex + r, ey + r); ctx.moveTo(ex + r, ey - r); ctx.lineTo(ex - r, ey + r); ctx.stroke();
        }
      }

      // Long logs attract flies
      if (!main) return;
      const flies = Math.min(4, Math.floor(g.body.length / 12));
      for (let i = 0; i < flies; i++) {
        const tp = pts[Math.min(pts.length - 1, Math.floor(pts.length * (0.5 + i * 0.15)))];
        const a = g.clock * (2.2 + i * 0.4) + i * 2;
        const fx = (tp[0] + Math.cos(a) * 0.9) * T, fy = (tp[1] + Math.sin(a * 1.3) * 0.7) * T;
        emoji('🪰', fx, fy, T * 0.55);
      }
    }

    function draw() {
      if (!bg) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
      ctx.drawImage(bg, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!g.body.length) return;
      const pulse = still ? 1 : 1 + Math.sin(g.clock * 6) * 0.08;
      if (g.food) emoji(g.food.emoji, (g.food.x + 0.5) * T, (g.food.y + 0.5) * T, T * 0.8 * pulse, '#f5c842');
      if (g.bonus) {
        const blink = g.bonus.life < 2 && !still && Math.floor(g.clock * 8) % 2 === 0;
        if (!blink) emoji(g.bonus.emoji, (g.bonus.x + 0.5) * T, (g.bonus.y + 0.5) * T, T * 0.9 * pulse, '#e07b00');
      }
      if (g.bend) {
        const blink = g.bend.life < 2 && !still && Math.floor(g.clock * 8) % 2 === 0;
        if (!blink) emoji('🌀', (g.bend.x + 0.5) * T, (g.bend.y + 0.5) * T, T * 0.9 * pulse, '#7fd3f5');
      }
      for (const p of g.puffs) {
        ctx.globalAlpha = Math.max(0, 0.5 * (1 - p.t / 1.1));
        ctx.fillStyle = '#7DBA4A';
        ctx.beginPath(); ctx.arc(p.x * T, (p.y - p.t * 0.4) * T, T * (0.2 + p.t * 0.35), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const f = g.state === 'play' ? Math.min(1, g.acc / stepTime()) : 1;
      const pts = bodyPoints(f);
      // Draw a copy for each side of the bowl the log pokes through
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      for (const oy of [0, -1, 1]) for (const ox of [0, -1, 1]) {
        const sx = ox * COLS, sy = oy * ROWS;
        if (x1 + sx < -1 || x0 + sx > COLS + 1 || y1 + sy < -1 || y0 + sy > ROWS + 1) continue;
        ctx.save(); ctx.translate(sx * T, sy * T);
        drawLog(pts, !ox && !oy);
        ctx.restore();
      }
    }

    const cm = segs => (segs * CM_PER_SEG).toLocaleString('en-US') + ' cm';
    function renderHud() {
      const paid = '$' + (hourly() * g.playSecs / 3600).toFixed(2);
      const len = g.body.length ? cm(g.body.length) : '0 cm';
      const best = cm(g.best);
      if (hud.len !== len) el.len.textContent = hud.len = len;
      if (hud.paid !== paid) el.paid.textContent = hud.paid = paid;
      if (hud.best !== best) el.best.textContent = hud.best = best;
    }

    function renderPass() { el.pass.hidden = !g.pass; }
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
      if (g.state !== 'over' && g.state !== 'title') frame = requestAnimationFrame(tick);
    }
    function startLoop() {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }

    // ── SCREENS ──
    function titleScreen() {
      g.state = 'title';
      el.screen.innerHTML = `
        <div class="ts-hero">💩</div>
        <div class="ts-title">Turd Snake</div>
        <div class="ts-sub">Eat. Grow. Don't touch the bowl.</div>
        <div class="ts-box">
          <div class="ts-lbl" style="margin-bottom:6px">Instructions</div>
          <div class="ts-instr-text">Swipe to turn. Eat everything to grow your log.</div>
          <div class="ts-row"><div class="ts-av">🌽</div><div><b>Corn &amp; mates</b><span>+${CM_PER_SEG} cm each. Corn stays in, obviously.</span></div></div>
          <div class="ts-row"><div class="ts-av">🌶️</div><div><b>Chilli</b><span>+${CM_PER_SEG * 2} cm and ring of fire speed</span></div></div>
          <div class="ts-row"><div class="ts-av">🪰</div><div><b>Flies</b><span>harmless. They just like you.</span></div></div>
          <div class="ts-row"><div class="ts-av">🚽</div><div><b>The bowl</b><span>hit the edge or bite your own tail and it's over</span></div></div>
          <div class="ts-row"><div class="ts-av">🌀</div><div><b>U-bend</b><span>rare. One free pass through the bowl: out one side, in the other</span></div></div>
        </div>
        <div class="ts-box ts-grid">
          <div><div class="ts-lbl">Longest log</div><div class="ts-val gold">${cm(g.best)}</div></div>
          <div><div class="ts-lbl">Gets faster</div><div class="ts-val">As you grow</div></div>
        </div>
        <button type="button" class="ts-btn" data-go><svg width="0.8em" height="0.8em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-0.05em"><path d="M7 4.8v14.4a1.2 1.2 0 0 0 1.8 1l11.6-7.2a1.2 1.2 0 0 0 0-2L8.8 3.8A1.2 1.2 0 0 0 7 4.8z"/></svg> Start squeezing</button>`;
      el.screen.hidden = false;
      el.screen.querySelector('[data-go]').onclick = newGame;
    }

    function gameOver() {
      g.state = 'over';
      el.msg.hidden = true;
      const len = g.body.length;
      const record = len > g.best;
      if (record) { g.best = len; save(BEST_KEY, len); sound.record(); }
      const paid = '$' + (hourly() * g.playSecs / 3600).toFixed(2);
      const verdict = len >= 40 ? 'An absolute unit. Call a plumber.'
        : len >= 20 ? 'That one\'s going to need two flushes.'
        : len >= 10 ? 'Respectable. Fibre is working.'
        : 'More of a nugget, really.';
      el.screen.innerHTML = `
        <div class="ts-hero">${g.cause === 'bowl' ? '🚽' : '😵'}</div>
        <div class="ts-title amber">Flushed!</div>
        <div class="ts-sub">${g.cause === 'bowl' ? 'You hit the bowl' : 'You ate your own tail. Gross.'}</div>
        <div class="ts-box">
          <div class="ts-grid">
            <div><div class="ts-lbl">Log length</div><div class="ts-val gold">${cm(len)}</div></div>
            <div><div class="ts-lbl">Corn inside</div><div class="ts-val">${g.corn.length} 🌽</div></div>
            <div><div class="ts-lbl">Paid to play</div><div class="ts-val green">${paid}</div></div>
            <div><div class="ts-lbl">New record?</div><div class="ts-val" style="color:${record ? '#f5c842' : '#a08060'}">${record ? 'YES!' : 'Nah · ' + cm(g.best)}</div></div>
          </div>
          <div class="ts-note">${verdict}</div>
        </div>
        <button type="button" class="ts-btn" data-go><svg width="0.8em" height="0.8em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-0.05em"><path d="M7 4.8v14.4a1.2 1.2 0 0 0 1.8 1l11.6-7.2a1.2 1.2 0 0 0 0-2L8.8 3.8A1.2 1.2 0 0 0 7 4.8z"/></svg> Squeeze another</button>
        <button type="button" class="ts-link" data-exit><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>Back to the bog timer</button>`;
      el.screen.hidden = false;
      el.screen.querySelector('[data-go]').onclick = newGame;
      el.screen.querySelector('[data-exit]').onclick = () => opts.onExit && opts.onExit();
    }

    // ── INPUT ──
    function turn(d) { if (g.queue.length < 2) g.queue.push(d); }
    const KEYS = { ArrowUp: 0, KeyW: 0, ArrowLeft: 1, KeyA: 1, ArrowDown: 2, KeyS: 2, ArrowRight: 3, KeyD: 3 };
    function onKey(e) {
      if (e.code in KEYS) { e.preventDefault(); turn(DIRS[KEYS[e.code]]); }
      else if (e.key === 'Escape' && opts.onExit) opts.onExit();
    }
    let sx = 0, sy = 0, touching = false;
    function onTouchStart(e) {
      if (e.target.closest('button, .ts-screen')) return;
      const t = e.touches[0]; sx = t.clientX; sy = t.clientY; touching = true;
    }
    function onTouchMove(e) {
      if (!touching) return;
      e.preventDefault();
      const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS[3] : DIRS[1]) : (dy > 0 ? DIRS[2] : DIRS[0]));
      sx = t.clientX; sy = t.clientY; // keep sliding a finger to keep steering
    }
    function onTouchEnd() { touching = false; }
    function onVisible() { if (document.visibilityState === 'visible' && g.state !== 'over' && g.state !== 'title') startLoop(); }

    el.mute.onclick = () => { sound.muted = !sound.muted; save(MUTE_KEY, sound.muted); sound.init(); renderMute(); };
    window.addEventListener('keydown', onKey);
    el.wrap.addEventListener('touchstart', onTouchStart, { passive: true });
    el.wrap.addEventListener('touchmove', onTouchMove, { passive: false });
    el.wrap.addEventListener('touchend', onTouchEnd);
    document.addEventListener('visibilitychange', onVisible);
    const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
    if (ro) ro.observe(el.stage); else window.addEventListener('resize', layout);

    renderMute();
    renderHud();
    titleScreen();
    layout();

    return {
      state: g,
      destroy() {
        alive = false;
        // Let the phone power the audio down; the next tap on Play wakes it
        if (sound.ac && sound.ac.state === 'running') sound.ac.suspend().catch(() => {});
        if (frame) cancelAnimationFrame(frame);
        clearTimeout(g.msgTimer);
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisible);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', layout);
        root.innerHTML = '';
      },
    };
  }

  window.TurdSnake = { mount };
})();
