// ══ DUNG RUN ══
// Maze mini game: you're a toilet catching every poo while the Clean Squad
// tries to scrub you out. Loaded only when someone opens it from the bog timer.
//
// window.DungRun.mount(el, { hourly: () => number, onExit: () => void })
// draws the game into el and returns { destroy() }.
(function () {
  const MAZE = [
    '###############',
    '#o....#.#....o#',
    '#.###.#.#.###.#',
    '#.............#',
    '#.##.#####.##.#',
    '#....#   #....#',
    '####.#   #.####',
    'T   .     .   T',
    '####.#####.####',
    '#......#......#',
    '#.###..#..###.#',
    '#o..#.....#..o#',
    '###.#.###.#.###',
    '#.....#.#.....#',
    '#.###.#.#.###.#',
    '#.............#',
    '###############',
  ];
  const COLS = 15, ROWS = 17;
  const DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]];
  const SQUAD = [
    { name: 'Bleachy', emoji: '🧴', color: '#7FD3F5', ai: 'chase', start: [7, 3], release: 0, desc: 'bottle, hunts you direct' },
    { name: 'The Plunger', emoji: '🪠', color: '#E0525B', ai: 'ambush', start: [7, 6], release: 2.5, desc: 'cuts you off ahead' },
    { name: 'Sir Scrubs', emoji: '🧽', color: '#F5C842', ai: 'random', start: [6, 6], release: 5, desc: 'sponge, fast, dumb' },
    { name: 'Fresh Breeze', emoji: '🫧', color: '#C9A2F5', ai: 'shy', start: [8, 6], release: 8, desc: 'wanders, smells nice' },
  ];
  const BEST_KEY = 'gi.dungrun.best';
  const MUTE_KEY = 'gi.dungrun.muted';
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  function cell(c, r) {
    if (r < 0 || r >= ROWS) return '#';
    if (c < 0 || c >= COLS) return MAZE[r][0] === 'T' ? ' ' : '#';
    return MAZE[r][c];
  }
  const open = (c, r) => cell(c, r) !== '#';
  const isHouse = (c, r) => c >= 6 && c <= 8 && r >= 5 && r <= 6;

  const CSS = `
  .dr { position: relative; display: flex; flex-direction: column; height: 100%; touch-action: none;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; color: var(--cream, #f5ead6); }
  .dr-hud { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; padding: 10px 14px;
    background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 16px; }
  .dr-stat { flex: 1; min-width: 0; }
  .dr-lbl { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; color: var(--muted, #a08060); text-transform: uppercase; }
  .dr-val { font-family: 'Bebas Neue', sans-serif; font-size: 24px; line-height: 1.05; letter-spacing: 1px; }
  .dr-val.green { color: var(--green, #4caf6e); }
  .dr-rolls { font-size: 16px; line-height: 28px; white-space: nowrap; }
  .dr-mute { background: none; border: 1px solid rgba(245,200,66,0.2); border-radius: 50%; width: 36px; height: 36px;
    font-size: 16px; cursor: pointer; flex-shrink: 0; }
  .dr-stage { flex: 1; min-height: 0; position: relative; display: flex; align-items: center; justify-content: center;
    background: var(--surface, #231a0a); border-radius: 20px; transition: box-shadow 0.2s; }
  .dr-stage.turbo { box-shadow: inset 0 0 0 2px #f5c842, 0 0 24px rgba(245,200,66,0.35); }
  .dr-stage canvas { display: block; }
  .dr-msg { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none;
    font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 3px; color: #1a1208; background: #f5c842;
    padding: 6px 18px; border-radius: 18px; white-space: nowrap; box-shadow: 0 0 24px rgba(245,200,66,0.6); }
  .dr-msg[hidden] { display: none; }
  .dr-msg.green { background: #4caf6e; box-shadow: 0 0 24px rgba(76,175,110,0.6); }
  .dr-hint { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
    color: var(--muted, #a08060); text-align: center; padding: 10px 0 0; }
  /* Scrolls on short phones: auto margins centre it without cutting off the top, and the
     swipe-to-steer handler leaves these screens alone */
  .dr-screen { position: absolute; inset: 0; z-index: 2; background: var(--bg, #1a1208); overflow-y: auto;
    overscroll-behavior: contain; touch-action: pan-y;
    display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 4px; }
  .dr-screen > :first-child { margin-top: auto; }
  .dr-screen > :last-child { margin-bottom: auto; }
  /* Play stays in view on short phones while the instructions scroll under it */
  .dr-btn[data-go] { position: sticky; bottom: 0; z-index: 1; box-shadow: 0 -10px 18px 6px var(--bg, #1a1208); }
  .dr-screen[hidden] { display: none; }
  .dr-hero { font-size: 84px; line-height: 1; filter: drop-shadow(0 0 24px rgba(127,211,245,0.45)); }
  .dr-title { font-family: 'Bebas Neue', sans-serif; font-size: 72px; line-height: 0.95; color: var(--gold, #f5c842); margin-top: 6px; }
  .dr-title.amber { color: var(--amber, #e07b00); }
  .dr-sub { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin: 8px 0 16px; }
  .dr-instr-text { font-size: 14px; line-height: 1.5; margin: 0 0 10px; }
  .dr-box { width: 100%; background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 20px;
    padding: 14px 16px; text-align: left; margin-bottom: 12px; }
  .dr-squad { display: flex; align-items: center; gap: 12px; padding: 5px 0; }
  .dr-av { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
  .dr-squad b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 19px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; }
  .dr-squad span { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted, #a08060); }
  .dr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
  .dr-grid .dr-val { font-size: 34px; }
  .dr-note { font-size: 14px; opacity: 0.8; margin-top: 12px; }
  .dr-btn { width: 100%; border: none; border-radius: 12px; background: var(--gold, #f5c842); color: #1a1208;
    font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 3px; padding: 14px; cursor: pointer; margin-top: 4px; }
  .dr-btn.ghost { background: transparent; color: var(--gold, #f5c842); border: 1.5px solid rgba(245,200,66,0.6); margin-top: 12px; }
  .dr-link { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent;
    color: var(--cream, #f5ead6); border: none; border-radius: 12px; font-family: 'Bebas Neue', sans-serif;
    font-size: 19px; letter-spacing: 2px; padding: 12px 14px; margin-top: 12px; cursor: pointer; }
  .dr-link svg { color: var(--gold, #f5c842); flex: 0 0 auto; margin-top: -2px; }
  `;

  function injectCss() {
    if (document.getElementById('dr-style')) return;
    const s = document.createElement('style');
    s.id = 'dr-style';
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
    plop() { this.flip = !this.flip; this.tone(this.flip ? 320 : 260, 120, 0.07, 'sine', 0.09); },
    golden() { this.tone(300, 1100, 0.3, 'square', 0.05); },
    flush() { this.whoosh(0.7, 0.35); },
    fart() { this.tone(95, 45, 0.7, 'sawtooth', 0.12, 28); },
    clear() { this.tone(500, 1000, 0.15, 'triangle', 0.08); setTimeout(() => this.tone(700, 1400, 0.2, 'triangle', 0.08), 150); },
  };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  // ── SPRITES ──
  function drawPoo(ctx, cx, cy, s, base, dark) {
    ctx.fillStyle = base; ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, s * 0.05);
    const blob = (y, rx, ry) => { ctx.beginPath(); ctx.ellipse(cx, cy + y * s, rx * s, ry * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
    blob(0.2, 0.42, 0.17);
    blob(0.02, 0.31, 0.15);
    blob(-0.15, 0.19, 0.12);
    ctx.beginPath();
    ctx.moveTo(cx - 0.08 * s, cy - 0.22 * s);
    ctx.quadraticCurveTo(cx + 0.02 * s, cy - 0.3 * s, cx + 0.1 * s, cy - 0.42 * s);
    ctx.quadraticCurveTo(cx + 0.1 * s, cy - 0.27 * s, cx + 0.1 * s, cy - 0.2 * s);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(cx - 0.14 * s, cy + 0.17 * s, 0.09 * s, 0.04 * s, 0, 0, Math.PI * 2); ctx.fill();
  }

  function sprite(size, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size);
    draw(c.getContext('2d'), size);
    return c;
  }

  function mount(root, opts) {
    injectCss();
    const hourly = opts.hourly || (() => 0);
    root.innerHTML = `
      <div class="dr">
        <div class="dr-hud">
          <div class="dr-stat"><div class="dr-lbl">Score</div><div class="dr-val" data-score>0</div></div>
          <div class="dr-stat"><div class="dr-lbl">Paid to play</div><div class="dr-val green" data-paid>$0.00</div></div>
          <div class="dr-stat"><div class="dr-lbl">Rolls left</div><div class="dr-rolls" data-rolls></div></div>
          <button type="button" class="dr-mute" data-mute aria-label="Sound"></button>
        </div>
        <div class="dr-stage"><canvas></canvas><div class="dr-msg" hidden></div></div>
        <div class="dr-hint">Swipe to slide · arrow keys on desktop</div>
        <div class="dr-screen" data-screen></div>
      </div>`;
    const $ = sel => root.querySelector(sel);
    const el = {
      wrap: $('.dr'), stage: $('.dr-stage'), canvas: $('canvas'), msg: $('.dr-msg'), screen: $('[data-screen]'),
      score: $('[data-score]'), paid: $('[data-paid]'), rolls: $('[data-rolls]'), mute: $('[data-mute]'),
    };
    const ctx = el.canvas.getContext('2d');

    let T = 20, W = 0, H = 0, dpr = 1, bg = null, pooImg = null, goldImg = null;
    const g = {
      state: 'title', level: 1, score: 0, lives: 3, caught: 0, playSecs: 0, timer: 0,
      dots: null, left: 0, fright: 0, combo: 0, killer: null, clock: 0,
      player: null, enemies: [], want: null,
    };
    let frame = null, last = 0, alive = true, hud = {};

    // ── LAYOUT ──
    function layout() {
      const r = el.stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      T = Math.max(8, Math.floor(Math.min((r.width - 16) / COLS, (r.height - 16) / ROWS)));
      W = T * COLS; H = T * ROWS;
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      el.canvas.width = W * dpr; el.canvas.height = H * dpr;
      el.canvas.style.width = W + 'px'; el.canvas.style.height = H + 'px';
      buildSprites();
      draw();
    }

    function buildSprites() {
      const px = T * dpr;
      bg = sprite(W * dpr, () => {});
      bg.width = W * dpr; bg.height = H * dpr;
      const b = bg.getContext('2d');
      const inset = Math.max(1, px * 0.05), rad = px * 0.2;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const ch = MAZE[r][c];
        if (ch === '#') {
          b.beginPath();
          b.roundRect ? b.roundRect(c * px + inset, r * px + inset, px - inset * 2, px - inset * 2, rad)
                      : b.rect(c * px + inset, r * px + inset, px - inset * 2, px - inset * 2);
          b.fillStyle = 'rgba(224,123,0,0.14)'; b.fill();
          b.strokeStyle = 'rgba(224,123,0,0.45)'; b.lineWidth = Math.max(1, dpr); b.stroke();
        } else if (ch === 'T') {
          b.fillStyle = 'rgba(76,175,110,0.7)';
          b.font = `${px * 0.8}px 'Bebas Neue', sans-serif`;
          b.textAlign = 'center'; b.textBaseline = 'middle';
          b.fillText('U', (c + 0.5) * px, (r + 0.55) * px);
        }
      }
      pooImg = sprite(px * 0.6, (x, s) => drawPoo(x, s / 2, s * 0.55, s, '#8B5A2B', '#4A2C12'));
      goldImg = sprite(px * 1.1, (x, s) => {
        x.shadowColor = 'rgba(245,200,66,0.9)'; x.shadowBlur = s * 0.25;
        drawPoo(x, s / 2, s * 0.55, s * 0.7, '#F5C842', '#B8860B');
      });
    }

    // ── GAME SETUP ──
    function resetDots() {
      g.dots = MAZE.map(row => row.split(''));
      g.left = 0;
      for (const row of g.dots) for (const ch of row) if (ch === '.' || ch === 'o') g.left++;
    }

    function resetActors() {
      g.player = { x: 7, y: 11, tx: 7, ty: 11, dx: 0, dy: 0 };
      g.want = [-1, 0];
      g.fright = 0;
      g.enemies = SQUAD.map(s => ({
        ...s, x: s.start[0], y: s.start[1], tx: s.start[0], ty: s.start[1], dx: 0, dy: 0,
        mode: isHouse(s.start[0], s.start[1]) ? 'house' : 'roam', wait: s.release, scared: false,
      }));
    }

    function newGame() {
      sound.init();
      g.level = 1; g.score = 0; g.lives = 3; g.caught = 0; g.playSecs = 0;
      resetDots(); resetActors();
      el.screen.hidden = true;
      setState('ready', 1.6, 'GET READY');
      startLoop();
    }

    function setState(state, time, msg, green) {
      g.state = state; g.timer = time || 0;
      el.msg.hidden = !msg;
      if (msg) { el.msg.textContent = msg; el.msg.classList.toggle('green', !!green); }
    }

    // ── MOVEMENT ──
    function step(e, speed, dt, choose) {
      let move = speed * dt;
      while (move > 0) {
        if (e.x === e.tx && e.y === e.ty) {
          if (e.tx < 0) e.x = e.tx = COLS - 1;
          else if (e.tx >= COLS) e.x = e.tx = 0;
          const d = choose(e);
          if (!d) { e.dx = e.dy = 0; return; }
          e.dx = d[0]; e.dy = d[1];
          e.tx = e.x + e.dx; e.ty = e.y + e.dy;
        }
        const dist = Math.abs(e.tx - e.x) + Math.abs(e.ty - e.y);
        const s = Math.min(dist, move);
        e.x += e.dx * s; e.y += e.dy * s; move -= s;
        if (s === dist) { e.x = e.tx; e.y = e.ty; }
      }
    }

    function choosePlayer(p) {
      eat(p.x, p.y);
      const w = g.want;
      if (w && open(p.x + w[0], p.y + w[1])) return w;
      if ((p.dx || p.dy) && open(p.x + p.dx, p.y + p.dy)) return [p.dx, p.dy];
      return null;
    }

    function chooseEnemy(e) {
      if (e.mode === 'leave') {
        if (isHouse(e.x, e.y)) return [0, 1];
        e.mode = 'roam';
      }
      let opts = DIRS.filter(([dx, dy]) => open(e.x + dx, e.y + dy) && !isHouse(e.x + dx, e.y + dy) && !(dx === -e.dx && dy === -e.dy && (e.dx || e.dy)));
      if (!opts.length) opts = DIRS.filter(([dx, dy]) => open(e.x + dx, e.y + dy));
      if (!opts.length) return null;
      const p = g.player;
      let target = null;
      if (e.scared) target = null;
      else if (e.ai === 'chase') target = [p.tx, p.ty];
      else if (e.ai === 'ambush') target = [p.tx + p.dx * 4, p.ty + p.dy * 4];
      else if (e.ai === 'random') target = Math.random() < 0.35 ? [p.tx, p.ty] : null;
      else if (e.ai === 'shy') target = Math.hypot(p.tx - e.x, p.ty - e.y) < 6 ? [p.tx, p.ty] : [1, 15];
      if (!target) return opts[Math.floor(Math.random() * opts.length)];
      let best = opts[0], bestD = Infinity;
      for (const d of opts) {
        const dd = (e.x + d[0] - target[0]) ** 2 + (e.y + d[1] - target[1]) ** 2;
        if (dd < bestD) { bestD = dd; best = d; }
      }
      return best;
    }

    function eat(c, r) {
      if (c < 0 || c >= COLS) return;
      const ch = g.dots[r][c];
      if (ch !== '.' && ch !== 'o') return;
      g.dots[r][c] = ' ';
      g.left--; g.caught++;
      if (ch === '.') { g.score += 10; sound.plop(); }
      else {
        g.score += 50; sound.golden(); buzz(30);
        g.fright = Math.max(4.5, 9.75 - g.level * 0.75); g.combo = 0;
        for (const e of g.enemies) if (e.mode !== 'house') {
          e.scared = true;
          if (e.dx || e.dy) { e.tx -= e.dx; e.ty -= e.dy; e.dx = -e.dx; e.dy = -e.dy; }
        }
        setState('play', 0, 'TURBO FLUSH!', false);
        clearTimeout(g.msgTimer);
        g.msgTimer = setTimeout(() => { if (g.state === 'play') el.msg.hidden = true; }, 1100);
      }
    }

    // ── UPDATE ──
    function update(dt) {
      g.clock += dt;
      if (g.state === 'ready' || g.state === 'dying' || g.state === 'clear') g.playSecs += dt;
      if (g.state === 'ready') { if ((g.timer -= dt) <= 0) setState('play'); return; }
      if (g.state === 'dying') {
        if ((g.timer -= dt) <= 0) {
          if (--g.lives <= 0) return gameOver();
          resetActors(); setState('ready', 1.4, 'GO AGAIN');
        }
        return;
      }
      if (g.state === 'clear') {
        if ((g.timer -= dt) <= 0) { g.level++; resetDots(); resetActors(); setState('ready', 1.4, 'LEVEL ' + g.level); }
        return;
      }
      if (g.state !== 'play') return;
      g.playSecs += dt;

      const p = g.player, w = g.want;
      // Reversing works mid-tile, everything else waits for the next junction
      if (w && (p.dx || p.dy) && w[0] === -p.dx && w[1] === -p.dy) {
        p.tx -= p.dx; p.ty -= p.dy; p.dx = w[0]; p.dy = w[1];
      }
      step(p, 6, dt, choosePlayer);

      if (g.fright > 0 && (g.fright -= dt) <= 0) for (const e of g.enemies) e.scared = false;
      el.stage.classList.toggle('turbo', g.fright > 0);

      const base = Math.min(7, 4.8 + (g.level - 1) * 0.35);
      for (const e of g.enemies) {
        if (e.mode === 'house') {
          if ((e.wait -= dt) <= 0) e.mode = 'leave';
          continue;
        }
        const speed = e.scared ? 3.2 : base + (e.ai === 'random' ? 0.5 : 0);
        step(e, speed, dt, chooseEnemy);
        let dx = Math.abs(e.x - p.x), dy = Math.abs(e.y - p.y);
        if (dx > COLS / 2) dx = COLS - dx;
        if (dx + dy < 0.7) {
          if (e.scared) {
            g.combo++;
            g.score += 100 * 2 ** g.combo;
            sound.flush(); buzz([20, 40, 20]);
            setState('play', 0, `FLUSHED ${e.name.toUpperCase()} +${100 * 2 ** g.combo}`, true);
            clearTimeout(g.msgTimer);
            g.msgTimer = setTimeout(() => { if (g.state === 'play') el.msg.hidden = true; }, 1100);
            Object.assign(e, { x: 7, y: 6, tx: 7, ty: 6, dx: 0, dy: 0, mode: 'house', wait: 2.5, scared: false });
          } else {
            g.killer = e;
            sound.fart(); buzz(200);
            el.stage.classList.remove('turbo');
            setState('dying', 1.3, 'CLOGGED!');
            return;
          }
        }
      }
      if (g.left <= 0) { sound.clear(); setState('clear', 1.6, 'BOG CLEARED!', true); }
    }

    // ── DRAW ──
    function emoji(ch, x, y, size, glow, alpha) {
      if (glow) {
        ctx.globalAlpha = 0.28 * (alpha ?? 1);
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, size * 0.62, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = alpha ?? 1;
      ctx.font = `${size}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, x, y + size * 0.06);
      ctx.globalAlpha = 1;
    }

    function draw() {
      if (!bg || !g.dots && g.state !== 'title') return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
      ctx.drawImage(bg, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const dots = g.dots || MAZE.map(r => r.split(''));
      const pulse = still ? 1 : 1 + Math.sin(g.clock * 6) * 0.08;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const ch = dots[r][c];
        if (ch === '.') ctx.drawImage(pooImg, (c + 0.5) * T - T * 0.3, (r + 0.5) * T - T * 0.3, T * 0.6, T * 0.6);
        else if (ch === 'o') { const s = T * 1.1 * pulse; ctx.drawImage(goldImg, (c + 0.5) * T - s / 2, (r + 0.5) * T - s / 2, s, s); }
      }
      if (!g.player) return;
      const flashing = g.fright > 0 && g.fright < 1.5 && Math.floor(g.clock * 6) % 2 === 0;
      for (const e of g.enemies) {
        const bob = e.mode === 'house' && !still ? Math.sin(g.clock * 5 + e.start[0]) * T * 0.12 : 0;
        if (e.scared) emoji('🤢', (e.x + 0.5) * T, (e.y + 0.5) * T + bob, T * 0.78, flashing ? '#ffffff' : '#4caf6e');
        else emoji(e.emoji, (e.x + 0.5) * T, (e.y + 0.5) * T + bob, T * 0.78, e.color);
      }
      const p = g.player;
      const dying = g.state === 'dying';
      const spin = dying && !still ? (1.3 - g.timer) * 8 : 0;
      ctx.save();
      ctx.translate((p.x + 0.5) * T, (p.y + 0.5) * T);
      if (spin) ctx.rotate(spin);
      if (p.dx > 0) ctx.scale(-1, 1);
      emoji('🚽', 0, 0, T * 0.95, g.fright > 0 ? '#f5c842' : '#7fd3f5', dying ? Math.max(0.2, g.timer / 1.3) : 1);
      ctx.restore();
    }

    function renderHud() {
      const paid = '$' + (hourly() * g.playSecs / 3600).toFixed(2);
      const rolls = '🧻'.repeat(Math.max(0, g.lives));
      if (hud.score !== g.score) el.score.textContent = (hud.score = g.score).toLocaleString('en-US');
      if (hud.paid !== paid) el.paid.textContent = hud.paid = paid;
      if (hud.rolls !== rolls) el.rolls.textContent = hud.rolls = rolls || '—';
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
      const best = load(BEST_KEY, 0);
      el.screen.innerHTML = `
        <div class="dr-hero">🚽</div>
        <div class="dr-title">Dung Run</div>
        <div class="dr-sub">Catch every poo. Dodge the Clean Squad.</div>
        <div class="dr-box">
          <div class="dr-lbl" style="margin-bottom:6px">Instructions</div>
          <div class="dr-instr-text">Swipe to steer the toilet and catch every poo to clear the bowl. Don't let the Clean Squad get you. You've got 3 lives.</div>
          <div class="dr-lbl" style="margin-bottom:6px">The Clean Squad</div>
          ${SQUAD.map(s => `<div class="dr-squad"><div class="dr-av" style="background:${s.color}33">${s.emoji}</div>
            <div><b style="color:${s.color}">${s.name}</b><span>${s.desc}</span></div></div>`).join('')}
          <div class="dr-squad"><div class="dr-av" style="background:#f5c84233">💩</div>
            <div><b style="color:#f5c842">Golden poo</b><span>turbo flush: the Squad turns green and runs</span></div></div>
        </div>
        <div class="dr-box dr-grid">
          <div><div class="dr-lbl">Your bog record</div><div class="dr-val">${best.toLocaleString('en-US')}</div></div>
          <div><div class="dr-lbl">Lives</div><div class="dr-val">🧻🧻🧻</div></div>
        </div>
        <button type="button" class="dr-btn" data-go><svg width="0.8em" height="0.8em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-0.05em"><path d="M7 4.8v14.4a1.2 1.2 0 0 0 1.8 1l11.6-7.2a1.2 1.2 0 0 0 0-2L8.8 3.8A1.2 1.2 0 0 0 7 4.8z"/></svg> Start flushing</button>`;
      el.screen.hidden = false;
      el.screen.querySelector('[data-go]').onclick = newGame;
    }

    function gameOver() {
      g.state = 'over';
      el.msg.hidden = true;
      el.stage.classList.remove('turbo');
      const best = load(BEST_KEY, 0);
      const record = g.score > best;
      if (record) save(BEST_KEY, g.score);
      const paid = '$' + (hourly() * g.playSecs / 3600).toFixed(2);
      const k = g.killer || SQUAD[0];
      el.screen.innerHTML = `
        <div class="dr-hero" style="filter:drop-shadow(0 0 24px rgba(224,123,0,0.5))">${k.emoji}</div>
        <div class="dr-title amber">Clogged!</div>
        <div class="dr-sub">${k.name} got you on level ${g.level}</div>
        <div class="dr-box">
          <div class="dr-grid">
            <div><div class="dr-lbl">Score</div><div class="dr-val">${g.score.toLocaleString('en-US')}</div></div>
            <div><div class="dr-lbl">Poos caught</div><div class="dr-val" style="color:#f5c842">${g.caught}</div></div>
            <div><div class="dr-lbl">Paid to play</div><div class="dr-val green">${paid}</div></div>
            <div><div class="dr-lbl">New bog record?</div><div class="dr-val" style="color:${record ? '#f5c842' : '#a08060'}">${record ? 'YES!' : 'Nah · ' + best.toLocaleString('en-US')}</div></div>
          </div>
          <div class="dr-note">You caught ${g.caught} poo${g.caught === 1 ? '' : 's'} on company time.</div>
        </div>
        <button type="button" class="dr-btn" data-go><svg width="0.8em" height="0.8em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-0.05em"><path d="M7 4.8v14.4a1.2 1.2 0 0 0 1.8 1l11.6-7.2a1.2 1.2 0 0 0 0-2L8.8 3.8A1.2 1.2 0 0 0 7 4.8z"/></svg> One more run</button>
        <button type="button" class="dr-link" data-exit><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>Back to the bog timer</button>`;
      el.screen.hidden = false;
      el.screen.querySelector('[data-go]').onclick = newGame;
      el.screen.querySelector('[data-exit]').onclick = () => opts.onExit && opts.onExit();
    }

    // ── INPUT ──
    const KEYS = { ArrowUp: 0, KeyW: 0, ArrowLeft: 1, KeyA: 1, ArrowDown: 2, KeyS: 2, ArrowRight: 3, KeyD: 3 };
    function onKey(e) {
      if (e.code in KEYS) { e.preventDefault(); g.want = DIRS[KEYS[e.code]]; }
      else if (e.key === 'Escape' && opts.onExit) opts.onExit();
    }
    let sx = 0, sy = 0, touching = false;
    function onTouchStart(e) {
      if (e.target.closest('button, .dr-screen')) return;
      const t = e.touches[0]; sx = t.clientX; sy = t.clientY; touching = true;
    }
    function onTouchMove(e) {
      if (!touching) return;
      e.preventDefault();
      const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      g.want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS[3] : DIRS[1]) : (dy > 0 ? DIRS[2] : DIRS[0]);
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

  window.DungRun = { mount };
})();
