// ══ FLING BONUS ══
// Distance game: Moe the monkey flings a turd as far as it'll go. Pull back
// anywhere, let go to fling. Best of three turds per round. Later levels bring
// heavier turds, pigeons, weeing cherubs and hand dryers.
//
// window.FlingBonus.mount(el, { hourly: () => number, onExit: () => void })
// draws the game into el and returns { destroy() }.
(function () {
  // ── LEVELS ──
  // Adding a level is a new entry here. World units are metres; y is up, ground is y = 0.
  //   turd: size (m), vmax (launch speed m/s), rest (bounce 0-1), drag, windK (how much wind moves it), fric (skid)
  //   obstacles: pigeon { x, y } paces ±range, knocks your speed down
  //              wee { x, w, h } a cherub on a cloud; its stream drags you to the ground
  //              dryer { x, w, h } a hand dryer blowing up; free lift
  const LEVELS = [
    {
      name: 'Monkey Business', blurb: 'Just Moe and a fresh one. Mind the wind.',
      turd: { name: 'The Regular', size: 0.8, vmax: 26, rest: 0.35, drag: 0.02, windK: 1, fric: 2.2 },
      wind: 3, target: 80, obstacles: [],
    },
    {
      name: 'Heavy Load', blurb: 'A big log and a sky full of pigeons.',
      turd: { name: 'The Big Log', size: 1.25, vmax: 24, rest: 0.12, drag: 0.012, windK: 0.5, fric: 3.2 },
      wind: 4, target: 60, obstacles: [
        { type: 'pigeon', x: 16, y: 6 }, { type: 'pigeon', x: 26, y: 11 }, { type: 'pigeon', x: 34, y: 4.5 },
        { type: 'pigeon', x: 44, y: 9 }, { type: 'pigeon', x: 24, y: 16 },
      ],
    },
    {
      name: 'Wee Hours', blurb: 'Cherubs weeing from the clouds. Hand dryers give you a lift.',
      turd: { name: 'The Corn Star', size: 0.9, vmax: 27, rest: 0.4, drag: 0.02, windK: 1, fric: 2, corn: true },
      wind: 3, target: 100, obstacles: [
        { type: 'wee', x: 24, w: 5, h: 15 }, { type: 'dryer', x: 36, w: 6, h: 18 },
        { type: 'wee', x: 52, w: 6, h: 13 }, { type: 'dryer', x: 68, w: 6, h: 16 },
        { type: 'wee', x: 86, w: 7, h: 12 }, { type: 'pigeon', x: 30, y: 13 }, { type: 'pigeon', x: 60, y: 7 },
      ],
    },
  ];
  const SOON = ['Code Brown', 'Seagull Season', 'Zero Gravity Dunny'];
  const SHOTS = 3;
  const G = 9.8;
  const HAND = { x: 0.3, y: 4.4 };
  const BEST_KEY = 'gi.fling.best';
  const MUTE_KEY = 'gi.fling.muted';
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Branch previews unlock every level so they can all be tested
  const preview = /\.pages\.dev$|^localhost$|^127\./.test(location.hostname);

  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  const bests = () => load(BEST_KEY, {});
  const unlocked = i => preview || i === 0 || (bests()[i - 1] || 0) >= LEVELS[i - 1].target;
  const metres = m => m.toFixed(1) + 'm';

  const CSS = `
  .fb { position: relative; display: flex; flex-direction: column; height: 100%;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; color: var(--cream, #f5ead6); }
  .fb-hud { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; padding: 10px 14px;
    background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 16px; }
  .fb-stat { flex: 1; min-width: 0; }
  .fb-lbl { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; color: var(--muted, #a08060); text-transform: uppercase; }
  .fb-val { font-family: 'Bebas Neue', sans-serif; font-size: 24px; line-height: 1.05; letter-spacing: 1px; white-space: nowrap; }
  .fb-val.green { color: var(--green, #4caf6e); }
  .fb-val.gold { color: var(--gold, #f5c842); }
  .fb-turds { font-size: 16px; line-height: 28px; white-space: nowrap; }
  .fb-mute { background: none; border: 1px solid rgba(245,200,66,0.2); border-radius: 50%; width: 36px; height: 36px;
    font-size: 16px; cursor: pointer; flex-shrink: 0; }
  .fb-stage { flex: 1; min-height: 0; position: relative; border-radius: 20px; overflow: hidden; touch-action: none; cursor: crosshair; }
  .fb-stage canvas { display: block; width: 100%; height: 100%; }
  .fb-msg { position: absolute; left: 50%; top: 22%; transform: translate(-50%, -50%); pointer-events: none;
    font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 3px; color: #1a1208; background: #f5c842;
    padding: 6px 18px; border-radius: 18px; white-space: nowrap; box-shadow: 0 0 24px rgba(245,200,66,0.6); }
  .fb-msg[hidden] { display: none; }
  .fb-msg.green { background: #4caf6e; box-shadow: 0 0 24px rgba(76,175,110,0.6); }
  .fb-msg.amber { background: #e07b00; box-shadow: 0 0 24px rgba(224,123,0,0.6); }
  .fb-hint { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
    color: var(--muted, #a08060); text-align: center; padding: 10px 0 0; }
  .fb-screen { position: absolute; inset: 0; z-index: 2; background: var(--bg, #1a1208); overflow-y: auto;
    display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 4px; }
  .fb-screen > :first-child { margin-top: auto; }
  .fb-screen > :last-child { margin-bottom: auto; }
  .fb-screen[hidden] { display: none; }
  .fb-hero { font-size: 84px; line-height: 1; filter: drop-shadow(0 0 24px rgba(224,123,0,0.5)); }
  .fb-title { font-family: 'Bebas Neue', sans-serif; font-size: 72px; line-height: 0.95; color: var(--gold, #f5c842); margin-top: 6px; }
  .fb-title.amber { color: var(--amber, #e07b00); }
  .fb-sub { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin: 8px 0 16px; }
  .fb-instr-text { font-size: 14px; line-height: 1.5; margin: 0 0 10px; }
  .fb-box { width: 100%; background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 20px;
    padding: 14px 16px; text-align: left; margin-bottom: 12px; }
  .fb-lvl { display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px 0; background: none; border: none;
    border-top: 1px solid rgba(224,123,0,0.15); color: inherit; text-align: left; cursor: pointer; font: inherit; }
  .fb-lvl:first-of-type { border-top: none; }
  .fb-lvl:disabled { cursor: default; opacity: 0.45; }
  .fb-num { width: 34px; height: 34px; border-radius: 50%; background: rgba(245,200,66,0.15); color: var(--gold, #f5c842);
    display: flex; align-items: center; justify-content: center; font-family: 'Bebas Neue', sans-serif; font-size: 20px; flex-shrink: 0; }
  .fb-lvl-text { flex: 1; min-width: 0; }
  .fb-lvl b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 20px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; color: var(--gold, #f5c842); }
  .fb-lvl span { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted, #a08060); }
  .fb-lvl-best { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; white-space: nowrap; }
  .fb-play { flex-shrink: 0; min-width: 64px; text-align: center; background: var(--gold, #f5c842); color: #1a1208; border-radius: 10px;
    padding: 8px 12px; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; line-height: 1; white-space: nowrap; }
  .fb-play.locked { background: none; color: var(--muted, #a08060); border: 1px solid rgba(224,123,0,0.35); letter-spacing: 0; font-size: 15px; }
  .fb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
  .fb-grid .fb-val { font-size: 34px; }
  .fb-note { font-size: 14px; opacity: 0.8; margin-top: 12px; }
  .fb-soon { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted, #a08060); padding-top: 8px; }
  .fb-btn { width: 100%; border: none; border-radius: 12px; background: var(--gold, #f5c842); color: #1a1208;
    font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 3px; padding: 14px; cursor: pointer; margin-top: 4px; }
  .fb-btn.ghost { background: transparent; color: var(--gold, #f5c842); border: 1.5px solid rgba(245,200,66,0.6); margin-top: 12px; }
  .fb-link { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent;
    color: var(--cream, #f5ead6); border: none; border-radius: 12px; font-family: 'Bebas Neue', sans-serif;
    font-size: 19px; letter-spacing: 2px; padding: 12px 14px; margin-top: 12px; cursor: pointer; }
  .fb-link svg { color: var(--gold, #f5c842); flex: 0 0 auto; margin-top: -2px; }
  `;

  function injectCss() {
    if (document.getElementById('fb-style')) return;
    const s = document.createElement('style');
    s.id = 'fb-style';
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
    noise(dur, vol, f0, f1, type) {
      if (this.muted || !this.ac) return;
      const ac = this.ac, t = ac.currentTime;
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = buf; f.type = type || 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f).connect(g).connect(ac.destination);
      src.start(t);
    },
    fling(p) { this.noise(0.35, 0.25 * p + 0.05, 600, 2600); this.tone(110, 50, 0.45, 'sawtooth', 0.08 * p + 0.02, 30); },
    splat(v) { this.noise(0.22, Math.min(0.5, 0.08 + v * 0.02), 900, 120, 'lowpass'); },
    squawk() { this.tone(900, 1500, 0.12, 'square', 0.05, 40); setTimeout(() => this.tone(1300, 700, 0.15, 'square', 0.04, 40), 110); },
    tinkle() { this.tone(1800 + Math.random() * 600, 1400, 0.08, 'sine', 0.03); },
    blow() { this.noise(0.5, 0.12, 300, 1400); },
    cheer() { this.tone(500, 1000, 0.15, 'triangle', 0.08); setTimeout(() => this.tone(700, 1400, 0.2, 'triangle', 0.08), 150); },
  };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  // ── SPRITES ──
  function drawPoo(ctx, cx, cy, s, base, dark, corn) {
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
    if (corn) {
      ctx.fillStyle = '#F5C842';
      for (const [x, y] of [[-0.22, 0.18], [0.12, 0.24], [0.05, 0.0], [-0.12, -0.02], [0.25, 0.14], [0.02, -0.16]]) {
        ctx.beginPath(); ctx.ellipse(cx + x * s, cy + y * s, 0.045 * s, 0.03 * s, 0.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(cx - 0.14 * s, cy + 0.17 * s, 0.09 * s, 0.04 * s, 0, 0, Math.PI * 2); ctx.fill();
  }

  function mount(root, opts) {
    injectCss();
    const hourly = opts.hourly || (() => 0);
    root.innerHTML = `
      <div class="fb">
        <div class="fb-hud">
          <div class="fb-stat"><div class="fb-lbl">Distance</div><div class="fb-val gold" data-dist>0.0m</div></div>
          <div class="fb-stat"><div class="fb-lbl">Paid to play</div><div class="fb-val green" data-paid>$0.00</div></div>
          <div class="fb-stat"><div class="fb-lbl">Turds left</div><div class="fb-turds" data-turds></div></div>
          <button type="button" class="fb-mute" data-mute aria-label="Sound"></button>
        </div>
        <div class="fb-stage"><canvas></canvas><div class="fb-msg" hidden></div></div>
        <div class="fb-hint">Pull back anywhere · let go to fling</div>
        <div class="fb-screen" data-screen></div>
      </div>`;
    const $ = sel => root.querySelector(sel);
    const el = {
      wrap: $('.fb'), stage: $('.fb-stage'), canvas: $('canvas'), msg: $('.fb-msg'), screen: $('[data-screen]'),
      dist: $('[data-dist]'), paid: $('[data-paid]'), turds: $('[data-turds]'), mute: $('[data-mute]'),
    };
    const ctx = el.canvas.getContext('2d');

    let W = 0, H = 0, dpr = 1, ppm = 25;
    const cam = { x: -4, y: -1.5 };
    const g = {
      state: 'title', li: 0, lv: LEVELS[0], shot: 0, shots: [], best: 0, playSecs: 0, clock: 0, timer: 0,
      wind: 0, turd: null, aim: null, piles: [], parts: [], obs: [], shake: 0, msgTimer: 0, acc: 0, inWee: false, inDryer: false,
    };
    let frame = null, last = 0, alive = true, hud = {};

    // ── LAYOUT ──
    function layout() {
      const r = el.stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      W = r.width; H = r.height;
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      el.canvas.width = Math.round(W * dpr); el.canvas.height = Math.round(H * dpr);
      ppm = Math.max(12, Math.min(H / 21, W / 13));
      draw();
    }
    const sx = wx => (wx - cam.x) * ppm;
    const sy = wy => H - (wy - cam.y) * ppm;

    // ── ROUND SETUP ──
    function startLevel(i) {
      sound.init();
      g.li = i; g.lv = LEVELS[i];
      g.shot = 0; g.shots = []; g.best = 0; g.piles = []; g.parts = [];
      g.obs = g.lv.obstacles.map((o, k) => ({ ...o, phase: k * 1.7, hit: false, fall: 0 }));
      el.screen.hidden = true;
      cam.x = -4; cam.y = -1.5;
      nextShot();
      flash(g.lv.name.toUpperCase(), '', 1800);
      startLoop();
    }

    function nextShot() {
      const s = g.lv.turd;
      g.turd = { x: HAND.x, y: HAND.y, vx: 0, vy: 0, rot: -0.3, r: s.size * 0.38, ground: false, splatted: false, still: 0, age: 0 };
      g.wind = Math.round((Math.random() * 2 - 1) * g.lv.wind * 10) / 10;
      g.aim = null;
      for (const o of g.obs) { o.hit = false; o.fall = 0; }
      g.state = 'aim';
    }

    function flash(text, tone, ms) {
      el.msg.textContent = text;
      el.msg.className = 'fb-msg' + (tone ? ' ' + tone : '');
      el.msg.hidden = false;
      clearTimeout(g.msgTimer);
      g.msgTimer = setTimeout(() => { el.msg.hidden = true; }, ms || 1300);
    }

    // ── AIM ──
    // Pull vector in screen px → launch velocity. Dragging down-left flings up-right.
    function aimVel(a) {
      const dx = a.x0 - a.x, dy = a.y - a.y0;
      const pull = Math.hypot(dx, dy);
      const power = Math.min(1, pull / (Math.min(W, H) * 0.38));
      const ang = Math.max(-0.2, Math.min(1.45, Math.atan2(dy, dx)));
      const v = power * g.lv.turd.vmax;
      return { vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, power, ang };
    }

    function fling() {
      const v = aimVel(g.aim);
      g.aim = null;
      if (v.power < 0.12) { g.state = 'aim'; return; }
      Object.assign(g.turd, { vx: v.vx, vy: v.vy, x: HAND.x, y: HAND.y });
      g.state = 'fly';
      sound.fling(v.power);
      buzz(15);
      if (v.power > 0.95) flash('FULL SEND!', 'amber', 900);
    }

    // ── PHYSICS ──
    function pigeonPos(o) {
      if (o.hit) return { x: o.hx, y: Math.max(0.4, o.hy - o.fall) };
      const t = g.clock * 0.6 + o.phase;
      return { x: o.x + Math.sin(t) * 5, y: o.y + Math.sin(t * 3.3) * 0.5, dir: Math.cos(t) };
    }

    function physics(dt) {
      const t = g.turd, s = g.lv.turd;
      t.age += dt;
      let weeNow = false, dryNow = false;
      if (t.y > t.r + 0.05) t.vx += g.wind * s.windK * 0.35 * dt;
      t.vy -= G * dt;
      for (const o of g.obs) {
        if (o.type === 'wee' && t.x > o.x && t.x < o.x + o.w && t.y < o.h) {
          weeNow = true; t.vy -= 14 * dt; t.vx *= 1 - 0.7 * dt;
        } else if (o.type === 'dryer' && t.x > o.x && t.x < o.x + o.w && t.y < o.h) {
          dryNow = true; t.vy += 18 * dt;
        } else if (o.type === 'pigeon' && !o.hit) {
          const p = pigeonPos(o);
          if (Math.hypot(p.x - t.x, p.y - t.y) < t.r + 0.6) {
            o.hit = true; o.hx = p.x; o.hy = p.y;
            t.vx *= 0.45; t.vy = Math.abs(t.vy) * 0.3 + 2;
            burst(p.x, p.y, 14, '#F5EAD6', 6, 0.18);
            sound.squawk(); buzz(30);
            flash('PIGEON\'D!', 'amber', 900);
            g.shake = 0.25;
          }
        }
      }
      if (weeNow && !g.inWee) flash('WEE\'D ON!', '', 900);
      if (dryNow && !g.inDryer) { flash('HAND DRYER BOOST', 'green', 900); sound.blow(); }
      if (weeNow && Math.random() < dt * 14) sound.tinkle();
      g.inWee = weeNow; g.inDryer = dryNow;
      const k = 1 - s.drag * Math.hypot(t.vx, t.vy) * dt * 0.1;
      t.vx *= k; t.vy *= k;
      t.x += t.vx * dt; t.y += t.vy * dt;
      if (t.y < t.r) {
        t.y = t.r;
        if (t.vy < -3) {
          const hit = -t.vy;
          t.vy = hit * s.rest; t.vx *= 0.72;
          burst(t.x, 0.1, Math.min(18, 4 + hit), '#8B5A2B', hit * 0.3, 0.12);
          sound.splat(hit); buzz(hit > 12 ? 40 : 15);
          if (!t.splatted) { t.splatted = true; g.shake = Math.min(0.35, hit * 0.02); }
        } else {
          t.vy = 0; t.ground = true;
          t.vx *= Math.max(0, 1 - s.fric * dt);
          t.vx -= Math.sign(t.vx) * Math.min(Math.abs(t.vx), 1.5 * dt);
        }
      } else t.ground = false;
      if (!t.ground) t.rot += t.vx * 0.25 * dt;
      else {
        // Skid along the ground and settle the right way up
        const up = Math.round(t.rot / (Math.PI * 2)) * Math.PI * 2;
        t.rot += (up - t.rot) * Math.min(1, dt * 8);
      }
      if (t.ground && Math.abs(t.vx) < 0.25) t.still += dt; else t.still = 0;
      if (t.still > 0.25 || t.age > 15 || t.x < -6) landed();
    }

    function burst(x, y, n, color, speed, size) {
      if (still) n = Math.ceil(n / 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI, v = speed * (0.4 + Math.random());
        g.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.8 + Math.random() * 0.6, color, size: size * (0.5 + Math.random()) });
      }
    }

    function landed() {
      const t = g.turd;
      const d = Math.max(0, t.x - HAND.x);
      g.shots.push(d);
      g.piles.push({ x: t.x, rot: 0 });
      g.shot++;
      const lvBest = bests()[g.li] || 0;
      const prevBest = g.best;
      g.best = Math.max(g.best, d);
      g.state = 'landed'; g.timer = 1.4;
      if (d >= g.lv.target && prevBest < g.lv.target) { flash(`BONUS PAID! ${metres(d)}`, 'green', 1500); sound.cheer(); }
      else if (d > lvBest && lvBest > 0) { flash(`NEW RECORD ${metres(d)}`, 'green', 1500); sound.cheer(); }
      else flash(`${rate(d)} · ${metres(d)}`, d < 15 ? 'amber' : '', 1500);
    }

    function rate(d) {
      const tg = g.lv.target;
      if (d < 5) return 'DROPPED IT';
      if (d < tg * 0.3) return 'LIMP WRIST';
      if (d < tg * 0.6) return 'DECENT CHUCK';
      if (d < tg) return 'BIG FLING';
      return 'MONSTER';
    }

    function update(dt) {
      g.clock += dt;
      g.playSecs += dt;
      g.shake = Math.max(0, g.shake - dt);
      if (g.state === 'fly') {
        g.acc += dt * 1.6; // flights play a bit faster than real time
        while (g.acc > 1 / 120 && g.state === 'fly') { physics(1 / 120); g.acc -= 1 / 120; }
      } else g.acc = 0;
      if (g.state === 'landed' && (g.timer -= dt) <= 0) {
        if (g.shot >= SHOTS) roundOver(); else nextShot();
      }
      for (const o of g.obs) if (o.hit) o.fall = Math.min(o.hy, o.fall + dt * 6);
      for (const p of g.parts) { p.vy -= G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
      g.parts = g.parts.filter(p => p.life > 0 && p.y > -1);

      // Camera: follow the turd in flight, drift back to Moe while aiming
      const view = W / ppm, viewH = H / ppm;
      let tx = -4, ty = -1.5;
      if (g.state === 'fly' || g.state === 'landed') {
        tx = Math.max(-4, g.turd.x - view * 0.38);
        ty = Math.max(-1.5, g.turd.y - viewH * 0.7);
      }
      const ease = g.state === 'aim' ? 4 : 8;
      cam.x += (tx - cam.x) * Math.min(1, dt * ease);
      cam.y += (ty - cam.y) * Math.min(1, dt * ease);
    }

    // ── DRAW ──
    function emoji(ch, x, y, size, alpha, flip, rot) {
      ctx.save();
      ctx.translate(x, y);
      if (rot) ctx.rotate(rot);
      if (flip) ctx.scale(-1, 1);
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.font = `${size}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    }

    function text(str, x, y, size, color, font, align) {
      ctx.font = `${size}px ${font || "'DM Mono', monospace"}`;
      ctx.fillStyle = color; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(str, x, y);
    }

    function hills(par, base, amp, f, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, H);
      const gy = H + cam.y * ppm * par;
      for (let x = 0; x <= W + 8; x += 8) {
        const wx = cam.x * par + x / ppm;
        const h = base + amp * (Math.sin(wx * f) + 0.6 * Math.sin(wx * f * 2.3 + 1));
        ctx.lineTo(x, gy - h * ppm);
      }
      ctx.lineTo(W, H);
      ctx.fill();
    }

    function draw() {
      if (!W) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const shake = g.shake && !still ? (Math.random() - 0.5) * g.shake * 30 : 0;
      ctx.translate(shake, shake * 0.5);

      // Sky, moon, hills
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#120c05'); sky.addColorStop(1, '#3a240f');
      ctx.fillStyle = sky; ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.fillStyle = 'rgba(245,234,214,0.85)';
      ctx.beginPath(); ctx.arc(W * 0.8 - cam.x * 0.5, H * 0.16 + cam.y * 0.5, Math.min(W, H) * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(245,234,214,0.5)';
      for (let i = 0; i < 24; i++) {
        const x = ((i * 137.5 - cam.x * ppm * 0.05) % W + W) % W, y = (i * 61) % (H * 0.5);
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      hills(0.2, 5, 1.6, 0.18, 'rgba(224,123,0,0.08)');
      for (let wx = Math.floor((cam.x * 0.45) / 22) * 22; wx < cam.x * 0.45 + W / ppm + 22; wx += 22) {
        const x = (wx - cam.x * 0.45) * ppm, y = H + cam.y * ppm * 0.45 - 4 * ppm;
        emoji('🌴', x, y, ppm * 5, 0.18);
      }
      hills(0.6, 1.5, 0.8, 0.3, 'rgba(76,175,110,0.12)');

      // Ground
      const gy = sy(0);
      ctx.fillStyle = '#2a1d0c'; ctx.fillRect(-20, gy, W + 40, H - gy + 20);
      ctx.fillStyle = 'rgba(76,175,110,0.55)'; ctx.fillRect(-20, gy, W + 40, Math.max(2, ppm * 0.12));

      // Distance posts every 10m, target flag, best line
      const view = W / ppm;
      for (let m = Math.ceil((cam.x - 1) / 10) * 10; m < cam.x + view + 1; m += 10) {
        if (m <= 0) continue;
        const x = sx(HAND.x + m);
        ctx.fillStyle = 'rgba(245,234,214,0.35)'; ctx.fillRect(x - 1, gy - ppm * 0.9, 2, ppm * 0.9);
        text(m + 'm', x, gy - ppm * 1.2, Math.max(9, ppm * 0.45), 'rgba(245,234,214,0.6)');
      }
      const lvBest = Math.max(bests()[g.li] || 0, g.best);
      if (lvBest > 0) {
        const x = sx(HAND.x + lvBest);
        ctx.strokeStyle = 'rgba(245,200,66,0.6)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - ppm * 6); ctx.stroke(); ctx.setLineDash([]);
        text('BEST ' + metres(lvBest), x, gy - ppm * 6.4, Math.max(9, ppm * 0.42), '#f5c842');
      }
      const fx = sx(HAND.x + g.lv.target);
      ctx.fillStyle = 'rgba(76,175,110,0.9)'; ctx.fillRect(fx - 1.5, gy - ppm * 3, 3, ppm * 3);
      ctx.beginPath(); ctx.moveTo(fx + 1.5, gy - ppm * 3); ctx.lineTo(fx + ppm * 1.6, gy - ppm * 2.6); ctx.lineTo(fx + 1.5, gy - ppm * 2.2); ctx.fill();
      text('BONUS ' + g.lv.target + 'm', fx, gy - ppm * 3.5, Math.max(10, ppm * 0.5), '#4caf6e', "'Bebas Neue', sans-serif");

      // Obstacles
      for (const o of g.obs) {
        if (o.type === 'wee') drawWee(o);
        else if (o.type === 'dryer') drawDryer(o);
      }

      // Moe's palm tree and Moe
      const trunkX = sx(-1.6);
      ctx.strokeStyle = '#6b4520'; ctx.lineWidth = ppm * 0.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(trunkX, gy); ctx.quadraticCurveTo(trunkX + ppm * 0.6, sy(2.5), trunkX - ppm * 0.2, sy(5.5)); ctx.stroke();
      ctx.lineWidth = ppm * 0.25;
      ctx.beginPath(); ctx.moveTo(trunkX + ppm * 0.2, sy(3.6)); ctx.lineTo(sx(0.4), sy(3.5)); ctx.stroke();
      ctx.strokeStyle = '#3d7a4f'; ctx.lineWidth = ppm * 0.22;
      for (const a of [-2.6, -2.0, -1.2, -0.5, 0.1]) {
        ctx.beginPath(); ctx.moveTo(trunkX - ppm * 0.2, sy(5.5));
        ctx.quadraticCurveTo(trunkX - ppm * 0.2 + Math.cos(a) * ppm * 1.4, sy(5.5) + Math.sin(a) * ppm * 1.4 - ppm * 0.5,
          trunkX - ppm * 0.2 + Math.cos(a) * ppm * 2.4, sy(5.5) + Math.sin(a) * ppm * 2.4 + ppm * 0.6);
        ctx.stroke();
      }
      const lastShot = g.shots[g.shots.length - 1];
      const moe = g.state === 'landed' ? (lastShot < 15 ? '🙈' : lastShot >= g.lv.target ? '🙊' : '🐒') : '🐒';
      const bob = still ? 0 : Math.sin(g.clock * 3) * ppm * 0.06;
      emoji(moe, sx(-0.4), sy(4.4) + bob, ppm * 1.8, 1, true);

      // Piles from earlier turds this round, with flies
      for (const p of g.piles) {
        if (p === g.piles[g.piles.length - 1] && g.state === 'landed') continue;
        drawPoo(ctx, sx(p.x), sy(g.lv.turd.size * 0.3), g.lv.turd.size * ppm, '#6e4622', '#3d2410', g.lv.turd.corn);
        if (!still) for (let i = 0; i < 2; i++) {
          const a = g.clock * (4 + i) + p.x;
          emoji('🪰', sx(p.x) + Math.cos(a) * ppm * 0.7, sy(g.lv.turd.size * 0.9) + Math.sin(a * 1.7) * ppm * 0.4, ppm * 0.35);
        }
      }

      // Pigeons
      for (const o of g.obs) {
        if (o.type !== 'pigeon') continue;
        const p = pigeonPos(o);
        emoji(o.hit ? '😵' : '🐦', sx(p.x), sy(p.y), ppm * (o.hit ? 0.8 : 1.1), 1, !o.hit && p.dir < 0, o.hit ? g.clock * 6 : 0);
      }

      // Aim guide
      const t = g.turd;
      let tx = sx(t.x), ty = sy(t.y);
      if (g.state === 'aim' && g.aim) {
        const v = aimVel(g.aim);
        const pull = Math.min(1.2, v.power * 1.2);
        tx = sx(HAND.x - Math.cos(v.ang) * pull); ty = sy(HAND.y - Math.sin(v.ang) * pull);
        ctx.strokeStyle = 'rgba(245,234,214,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx(-0.2), sy(4.2)); ctx.lineTo(tx, ty); ctx.stroke();
        let px = HAND.x, py = HAND.y, vx = v.vx, vy = v.vy;
        for (let i = 1; i <= 14; i++) {
          for (let k = 0; k < 4; k++) { vy -= G * 0.012; px += vx * 0.012; py += vy * 0.012; }
          if (py < 0) break;
          ctx.fillStyle = `rgba(245,200,66,${0.8 - i * 0.05})`;
          ctx.beginPath(); ctx.arc(sx(px), sy(py), Math.max(1.5, 3.5 - i * 0.15), 0, Math.PI * 2); ctx.fill();
        }
        text(Math.round(v.power * 100) + '%', sx(-0.4), sy(6), Math.max(10, ppm * 0.5), '#f5c842', "'Bebas Neue', sans-serif");
      }

      // The turd
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(t.rot);
      drawPoo(ctx, 0, -t.r * ppm * 0.2, g.lv.turd.size * ppm * (t.ground ? 1 : 1.3), '#8B5A2B', '#4A2C12', g.lv.turd.corn);
      ctx.restore();
      if (g.state === 'fly' && !still && t.y > 2) {
        ctx.fillStyle = 'rgba(139,90,43,0.35)';
        ctx.beginPath(); ctx.arc(tx - t.vx * 0.04 * ppm, ty + t.vy * 0.04 * ppm, ppm * 0.12, 0, Math.PI * 2); ctx.fill();
      }

      // Particles
      for (const p of g.parts) {
        ctx.globalAlpha = Math.min(1, p.life * 2);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), Math.max(1, p.size * ppm), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Off-screen up arrow
      if (ty < 0) text('▲ ' + metres(t.y), tx, 14, 12, '#f5c842');

      // Wind
      if (g.state !== 'title') {
        const dir = g.wind > 0 ? '→' : g.wind < 0 ? '←' : '·';
        const w = Math.abs(g.wind);
        text(`WIND ${dir} ${w.toFixed(1)}`, 12, 16, 11, w > g.lv.wind * 0.6 ? '#e07b00' : 'rgba(245,234,214,0.75)', null, 'left');
        text(`TURD ${Math.min(g.shot + 1, SHOTS)}/${SHOTS} · ${g.lv.turd.name.toUpperCase()}`, W - 12, 16, 11, 'rgba(245,234,214,0.75)', null, 'right');
      }
    }

    function drawWee(o) {
      const x0 = sx(o.x), x1 = sx(o.x + o.w), top = sy(o.h), gy = sy(0);
      if (x1 < -40 || x0 > W + 40) return;
      ctx.fillStyle = 'rgba(245,200,66,0.07)'; ctx.fillRect(x0, top, x1 - x0, gy - top);
      ctx.fillStyle = 'rgba(245,215,80,0.75)';
      const n = Math.round(o.w * 3);
      for (let i = 0; i < n; i++) {
        const fx = o.x + ((i * 0.618) % 1) * o.w;
        const fy = o.h - ((g.clock * 9 + i * 1.37) % o.h);
        ctx.beginPath(); ctx.ellipse(sx(fx), sy(fy), ppm * 0.06, ppm * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      }
      const cx = (x0 + x1) / 2;
      emoji('☁️', cx, top - ppm * 0.4, ppm * 2.6, 0.9);
      emoji('👶', cx, top - ppm * 1.3 + (still ? 0 : Math.sin(g.clock * 2 + o.x) * ppm * 0.15), ppm * 1.2);
    }

    function drawDryer(o) {
      const x0 = sx(o.x), x1 = sx(o.x + o.w), top = sy(o.h), gy = sy(0);
      if (x1 < -40 || x0 > W + 40) return;
      const grd = ctx.createLinearGradient(0, gy, 0, top);
      grd.addColorStop(0, 'rgba(127,211,245,0.16)'); grd.addColorStop(1, 'rgba(127,211,245,0)');
      ctx.fillStyle = grd; ctx.fillRect(x0, top, x1 - x0, gy - top);
      ctx.strokeStyle = 'rgba(127,211,245,0.45)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const x = x0 + (x1 - x0) * (i + 0.5) / 4;
        ctx.beginPath();
        for (let y = gy; y > top; y -= 6) {
          const phase = (gy - y) / 18 - g.clock * 6 + i;
          ctx.lineTo(x + Math.sin(phase) * 5, y);
        }
        ctx.stroke();
      }
      const cx = (x0 + x1) / 2, bw = ppm * 1.8, bh = ppm * 0.9;
      ctx.fillStyle = '#cfd6dc'; ctx.fillRect(cx - bw / 2, gy - bh, bw, bh);
      ctx.fillStyle = '#1a1208'; ctx.fillRect(cx - bw * 0.3, gy - bh * 0.95, bw * 0.6, bh * 0.25);
      text('HAND DRYER', cx, gy - bh * 0.45, Math.max(7, ppm * 0.26), '#1a1208');
    }

    function renderHud() {
      const d = g.state === 'fly' || g.state === 'landed' ? Math.max(0, g.turd.x - HAND.x) : g.best;
      const dist = metres(d);
      const paid = '$' + (hourly() * g.playSecs / 3600).toFixed(2);
      const turds = '💩'.repeat(Math.max(0, SHOTS - g.shot - (g.state === 'fly' ? 1 : 0)));
      if (hud.state !== g.state) el.wrap.dataset.state = hud.state = g.state;
      if (hud.dist !== dist) el.dist.textContent = hud.dist = dist;
      if (hud.paid !== paid) el.paid.textContent = hud.paid = paid;
      if (hud.turds !== turds) el.turds.textContent = hud.turds = turds || '—';
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
    function levelRows() {
      const b = bests();
      return LEVELS.map((lv, i) => {
        const open = unlocked(i), best = b[i] || 0;
        const sub = open ? `${lv.turd.name} · bonus at ${lv.target}m` : `Fling ${LEVELS[i - 1].target}m on level ${i} to unlock`;
        return `<button type="button" class="fb-lvl" data-lvl="${i}" ${open ? '' : 'disabled'}>
          <div class="fb-num">${i + 1}</div>
          <div class="fb-lvl-text"><b>${lv.name}</b><span>${sub}</span></div>
          <div class="fb-lvl-best" style="color:${best >= lv.target ? '#4caf6e' : '#a08060'}">${best ? metres(best) : ''}</div>
          ${open ? '<div class="fb-play">Play <svg width="0.8em" height="0.8em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-0.05em"><path d="M7 4.8v14.4a1.2 1.2 0 0 0 1.8 1l11.6-7.2a1.2 1.2 0 0 0 0-2L8.8 3.8A1.2 1.2 0 0 0 7 4.8z"/></svg></div>' : '<div class="fb-play locked" aria-label="Locked">🔒</div>'}
        </button>`;
      }).join('');
    }

    function bindLevels() {
      el.screen.querySelectorAll('[data-lvl]').forEach(b => { b.onclick = () => startLevel(+b.dataset.lvl); });
    }

    function titleScreen() {
      g.state = 'title';
      el.msg.hidden = true;
      el.screen.innerHTML = `
        <div class="fb-hero">🐒</div>
        <div class="fb-title">Fling Bonus</div>
        <div class="fb-sub">Fling a turd for the corner office</div>
        <div class="fb-box">
          <div class="fb-lbl" style="margin-bottom:4px">Levels · best fling</div>
          ${levelRows()}
          <div class="fb-soon">Coming soon: ${SOON.join(', ')}</div>
        </div>
        <div class="fb-box">
          <div class="fb-lbl" style="margin-bottom:6px">Instructions</div>
          <div class="fb-instr-text" style="margin:0">Pull back anywhere on the screen and let go. Three turds a round, your longest counts.
          Hit the green flag to get your bonus and unlock the next level.</div>
        </div>`;
      el.screen.hidden = false;
      bindLevels();
    }

    function roundOver() {
      g.state = 'over';
      el.wrap.dataset.state = hud.state = g.state;
      el.msg.hidden = true;
      const b = bests();
      const prev = b[g.li] || 0;
      const record = g.best > prev;
      if (record) { b[g.li] = Math.round(g.best * 10) / 10; save(BEST_KEY, b); }
      const bonus = g.best >= g.lv.target;
      const next = LEVELS[g.li + 1];
      const newUnlock = next && bonus && prev < g.lv.target && !preview;
      const paid = '$' + (hourly() * g.playSecs / 3600).toFixed(2);
      el.screen.innerHTML = `
        <div class="fb-hero">${bonus ? '🙊' : g.best < 15 ? '🙈' : '🐒'}</div>
        <div class="fb-title ${bonus ? '' : 'amber'}">${bonus ? 'Bonus paid!' : 'No bonus'}</div>
        <div class="fb-sub">Level ${g.li + 1}: ${g.lv.name}</div>
        <div class="fb-box">
          <div class="fb-grid">
            <div><div class="fb-lbl">Longest fling</div><div class="fb-val gold">${metres(g.best)}</div></div>
            <div><div class="fb-lbl">Bonus at</div><div class="fb-val" style="color:#4caf6e">${g.lv.target}m</div></div>
            <div><div class="fb-lbl">Paid to play</div><div class="fb-val green">${paid}</div></div>
            <div><div class="fb-lbl">New record?</div><div class="fb-val" style="color:${record ? '#f5c842' : '#a08060'}">${record ? 'YES!' : 'Nah · ' + metres(prev)}</div></div>
          </div>
          <div class="fb-note">${g.shots.map(metres).join(' · ')}${newUnlock ? `<br><b style="color:#4caf6e">Level ${g.li + 2} unlocked: ${next.name}</b>` : ''}</div>
        </div>
        ${next && unlocked(g.li + 1) ? `<button type="button" class="fb-btn" data-next><svg width="0.8em" height="0.8em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-0.05em"><path d="M7 4.8v14.4a1.2 1.2 0 0 0 1.8 1l11.6-7.2a1.2 1.2 0 0 0 0-2L8.8 3.8A1.2 1.2 0 0 0 7 4.8z"/></svg> Level ${g.li + 2}: ${next.name}</button>` : ''}
        <button type="button" class="fb-btn ${next && unlocked(g.li + 1) ? 'ghost' : ''}" data-go><svg width="0.8em" height="0.8em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-0.05em"><path d="M7 4.8v14.4a1.2 1.2 0 0 0 1.8 1l11.6-7.2a1.2 1.2 0 0 0 0-2L8.8 3.8A1.2 1.2 0 0 0 7 4.8z"/></svg> Fling again</button>
        <button type="button" class="fb-link" data-levels><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>All levels</button>
        <button type="button" class="fb-link" data-exit><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>Back to the bog timer</button>`;
      el.screen.hidden = false;
      const nb = el.screen.querySelector('[data-next]');
      if (nb) nb.onclick = () => startLevel(g.li + 1);
      el.screen.querySelector('[data-go]').onclick = () => startLevel(g.li);
      el.screen.querySelector('[data-levels]').onclick = titleScreen;
      el.screen.querySelector('[data-exit]').onclick = () => opts.onExit && opts.onExit();
    }

    // ── INPUT ──
    function point(e) {
      const r = el.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function onDown(e) {
      if (g.state !== 'aim') return;
      sound.init();
      const p = point(e);
      g.aim = { x0: p.x, y0: p.y, x: p.x, y: p.y, id: e.pointerId };
      try { el.stage.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    }
    function onMove(e) {
      if (!g.aim || e.pointerId !== g.aim.id) return;
      const p = point(e);
      g.aim.x = p.x; g.aim.y = p.y;
      e.preventDefault();
    }
    function onUp(e) {
      if (!g.aim || e.pointerId !== g.aim.id) return;
      if (e.type === 'pointercancel') { g.aim = null; return; }
      fling();
    }
    function onKey(e) {
      if (e.key === 'Escape' && opts.onExit) opts.onExit();
    }
    function onVisible() { if (document.visibilityState === 'visible' && g.state !== 'over' && g.state !== 'title') startLoop(); }

    el.mute.onclick = () => { sound.muted = !sound.muted; save(MUTE_KEY, sound.muted); sound.init(); renderMute(); };
    el.stage.addEventListener('pointerdown', onDown);
    el.stage.addEventListener('pointermove', onMove);
    el.stage.addEventListener('pointerup', onUp);
    el.stage.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisible);
    const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
    if (ro) ro.observe(el.stage); else window.addEventListener('resize', layout);

    renderMute();
    nextShot();
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

  window.FlingBonus = { mount };
})();
