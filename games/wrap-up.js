// ══ WRAP UP ══
// Jigsaw puzzle of a toilet roll wrapper. Drag the pieces into the frame; when the
// last one clicks in, the wrapper wobbles and lets one rip. Loaded only when someone opens it.
// The wrapper art is our own, drawn in code (no outside artwork).
//
// window.WrapUp.mount(el, { hourly: () => number, onExit: () => void })
// draws the game into el and returns { destroy() }.
(function () {
  // Add a wrapper by adding a line. pattern: stripes | dots | zigzag | stars
  const WRAPPERS = [
    { name: 'Golden Throne', bg: '#f5c842', alt: '#e07b00', ink: '#1a1208', label: '#1a1208', labelInk: '#f5c842',
      badge: '#e0525b', badgeInk: '#fff', pattern: 'stripes', hero: '💩', bits: ['💸', '🪙', '💩'],
      line1: 'GROSS INCOME', line2: '3-PLY · 100% EARNED', tag: 'NEW LOOK', foot: '4 ROLLS · PAID TO GO' },
    { name: 'Mint Condition', bg: '#3fbfa0', alt: '#1f7a68', ink: '#0f2a24', label: '#f5ead6', labelInk: '#1f7a68',
      badge: '#f5c842', badgeInk: '#1a1208', pattern: 'dots', hero: '🧻', bits: ['🌿', '🫧', '🧼'],
      line1: 'MINT CONDITION', line2: 'FRESH AS A DAISY', tag: 'EXTRA SOFT', foot: '6 ROLLS · BREEZY' },
    { name: 'Cheeky Pink', bg: '#ff7aa8', alt: '#c2185b', ink: '#3a0a1e', label: '#fff3c4', labelInk: '#c2185b',
      badge: '#4fa3f7', badgeInk: '#fff', pattern: 'zigzag', hero: '🍑', bits: ['💖', '✨', '🌸'],
      line1: 'CHEEKY PINK', line2: 'GENTLE ON THE GOODS', tag: '2X LONGER', foot: '9 ROLLS · BUM APPROVED' },
    { name: 'Night Shift', bg: '#24306b', alt: '#4a5bbf', ink: '#f5ead6', label: '#f5c842', labelInk: '#24306b',
      badge: '#4caf6e', badgeInk: '#fff', pattern: 'stars', hero: '🌙', bits: ['⭐', '💫', '🦉'],
      line1: 'NIGHT SHIFT', line2: 'OVERTIME RATES APPLY', tag: 'DOUBLE ROLL', foot: '12 ROLLS · 3AM READY' },
  ];
  const SIZES = [
    { n: 3, name: 'Quick one' },
    { n: 4, name: 'Standard sit' },
    { n: 5, name: 'Long haul' },
  ];
  const PROGRESS_KEY = 'gi.wrapup.v1';
  const MUTE_KEY = 'gi.wrapup.muted';
  const GAP = 12;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function progress() {
    const p = load(PROGRESS_KEY, {});
    return { best: p.best || {}, wrapper: p.wrapper || 0 };
  }

  const CSS = `
  .wu { position: relative; display: flex; flex-direction: column; height: 100%;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; color: var(--cream, #f5ead6); }
  .wu-hud { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; padding: 10px 14px;
    background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 16px; }
  .wu-stat { flex: 1; min-width: 0; }
  .wu-lbl { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; color: var(--muted, #a08060); text-transform: uppercase; }
  .wu-val { font-family: 'Bebas Neue', sans-serif; font-size: 24px; line-height: 1.05; letter-spacing: 1px; }
  .wu-val.green { color: var(--green, #4caf6e); }
  .wu-round { background: none; border: 1px solid rgba(245,200,66,0.2); border-radius: 50%; width: 36px; height: 36px;
    font-size: 16px; cursor: pointer; flex-shrink: 0; color: inherit; }
  .wu-round[aria-pressed="true"] { background: rgba(245,200,66,0.15); border-color: rgba(245,200,66,0.6); }
  .wu-stage { flex: 1; min-height: 0; position: relative; }
  .wu-stage canvas { position: absolute; left: 0; top: 0; display: block; }
  .wu-hint { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
    color: var(--muted, #a08060); text-align: center; padding: 8px 0 0; }
  .wu-screen { position: absolute; inset: 0; z-index: 2; background: var(--bg, #1a1208); overflow-y: auto;
    display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 4px; }
  .wu-screen > :first-child { margin-top: auto; }
  .wu-screen > :last-child { margin-bottom: auto; }
  .wu-screen[hidden] { display: none; }
  .wu-hero { font-size: 72px; line-height: 1; filter: drop-shadow(0 0 24px rgba(245,200,66,0.45)); }
  .wu-title { font-family: 'Bebas Neue', sans-serif; font-size: 68px; line-height: 0.95; color: var(--gold, #f5c842); margin-top: 6px; }
  .wu-sub { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin: 8px 0 14px; line-height: 1.5; }
  .wu-box { width: 100%; background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 20px;
    padding: 12px 14px; text-align: left; margin-bottom: 12px; }
  .wu-wraps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 8px; }
  .wu-wrap { background: none; border: 2px solid transparent; border-radius: 14px; padding: 4px; cursor: pointer; color: inherit;
    display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .wu-wrap canvas { width: 100%; aspect-ratio: 1; border-radius: 8px; display: block; }
  .wu-wrap span { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.5px; color: var(--muted, #a08060); line-height: 1.2; }
  .wu-wrap[aria-pressed="true"] { border-color: var(--gold, #f5c842); }
  .wu-wrap[aria-pressed="true"] span { color: var(--gold, #f5c842); }
  .wu-sizes { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-bottom: 4px; }
  .wu-size { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer;
    background: var(--surface, #231a0a); border: 1.5px solid rgba(245,200,66,0.45); border-radius: 16px; padding: 10px 14px; color: inherit; }
  .wu-size-n { font-family: 'Bebas Neue', sans-serif; font-size: 30px; color: var(--gold, #f5c842); min-width: 44px; text-align: center; }
  .wu-size-t { flex: 1; }
  .wu-size-t b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 21px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; }
  .wu-size-t span { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted, #a08060); }
  .wu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
  .wu-grid .wu-val { font-size: 32px; }
  .wu-done-art { width: 150px; height: 150px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 4px; }
  .wu-done-art.rip { animation: wu-rip 1.3s ease-out; }
  @keyframes wu-rip {
    0% { transform: scale(1); }
    10% { transform: scale(1.12, 0.86) rotate(-3deg); }
    22% { transform: scale(0.9, 1.1) rotate(3deg); }
    36% { transform: scale(1.07, 0.94) rotate(-2deg); }
    52% { transform: scale(0.96, 1.04) rotate(1deg); }
    70% { transform: scale(1.02, 0.98); }
    100% { transform: scale(1); }
  }
  .wu-btn { width: 100%; border: none; border-radius: 16px; background: var(--gold, #f5c842); color: #1a1208;
    font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 3px; padding: 14px; cursor: pointer; margin-top: 4px; }
  .wu-btn.ghost { background: transparent; color: var(--gold, #f5c842); border: 1.5px solid rgba(245,200,66,0.6); margin-top: 10px; }
  .wu-link { background: none; border: none; color: var(--muted, #a08060); font-family: 'DM Mono', monospace; font-size: 11px;
    letter-spacing: 1px; margin-top: 14px; cursor: pointer; text-decoration: underline; }
  `;

  function injectCss() {
    if (document.getElementById('wu-style')) return;
    const s = document.createElement('style');
    s.id = 'wu-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── SOUND ──
  // Web Audio only starts after a tap (iOS rule), so it's created on the first touch of a
  // piece. By the time the last piece goes in, the fart is allowed to play.
  const sound = {
    ac: null, muted: load(MUTE_KEY, false),
    init() {
      if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
      if (this.ac.state === 'suspended') this.ac.resume();
    },
    noise(dur) {
      const ac = this.ac;
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buf;
      return src;
    },
    snap() {
      if (this.muted || !this.ac) return;
      const ac = this.ac, t = ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(520, t);
      o.frequency.exponentialRampToValueAtTime(1100, t + 0.06);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(g).connect(ac.destination);
      o.start(t); o.stop(t + 0.1);
    },
    // A buzzy sawtooth through a fluttering gate, with a bit of breathy noise. Every one is different.
    fart() {
      if (this.muted || !this.ac) return;
      const ac = this.ac, t = ac.currentTime + 0.02;
      const dur = 0.8 + Math.random() * 0.7;
      const base = 60 + Math.random() * 40;

      const out = ac.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.7, t + 0.03);
      out.gain.setValueAtTime(0.7, t + dur * 0.55);
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 5;
      lp.frequency.setValueAtTime(1000, t);
      lp.frequency.exponentialRampToValueAtTime(320, t + dur);

      const gate = ac.createGain();
      gate.gain.value = 0.55;
      const flap = ac.createOscillator(), flapAmt = ac.createGain();
      flap.type = 'triangle';
      flap.frequency.setValueAtTime(24 + Math.random() * 10, t);
      flap.frequency.linearRampToValueAtTime(11, t + dur);
      flapAmt.gain.value = 0.45;
      flap.connect(flapAmt).connect(gate.gain);

      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 1.4, t);
      o.frequency.exponentialRampToValueAtTime(base * 0.6, t + dur);
      const wob = ac.createOscillator(), wobAmt = ac.createGain();
      wob.frequency.value = 5 + Math.random() * 5;
      wobAmt.gain.value = base * 0.18;
      wob.connect(wobAmt).connect(o.frequency);

      const n = this.noise(dur + 0.05), bp = ac.createBiquadFilter(), ng = ac.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 190; bp.Q.value = 0.9;
      ng.gain.value = 0.7;
      n.connect(bp).connect(ng).connect(lp);

      const shaper = ac.createWaveShaper(), curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.5); }
      shaper.curve = curve;
      o.connect(shaper).connect(lp);
      lp.connect(gate).connect(out).connect(ac.destination);

      [o, wob, flap, n].forEach(s => { s.start(t); s.stop(t + dur + 0.05); });
    },
  };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  // ── ART ──
  // Same seed for a wrapper every time, so the picture doesn't change on resize.
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function star(ctx, x, y, r, points, inner) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / points, rr = i % 2 ? r * inner : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  function fitFont(ctx, text, maxW, size, family) {
    do { ctx.font = `${size}px ${family}`; size -= 4; } while (ctx.measureText(text).width > maxW && size > 20);
  }

  // Draws wrapper W into a D×D pixel canvas. Laid out on a 1000×1000 grid.
  function drawWrapper(ctx, D, W, idx) {
    const rand = rng(1234 + idx * 97);
    ctx.save();
    ctx.scale(D / 1000, D / 1000);
    ctx.fillStyle = W.bg;
    ctx.fillRect(0, 0, 1000, 1000);

    ctx.save();
    if (W.pattern === 'stripes') {
      ctx.translate(500, 500); ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = W.alt; ctx.globalAlpha = 0.55;
      for (let x = -800; x < 800; x += 110) ctx.fillRect(x, -800, 48, 1600);
    } else if (W.pattern === 'dots') {
      ctx.fillStyle = W.alt; ctx.globalAlpha = 0.5;
      for (let y = 40, row = 0; y < 1000; y += 80, row++) {
        for (let x = row % 2 ? 40 : 0; x < 1040; x += 80) { ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill(); }
      }
    } else if (W.pattern === 'zigzag') {
      ctx.strokeStyle = W.alt; ctx.globalAlpha = 0.45; ctx.lineWidth = 16; ctx.lineJoin = 'round';
      for (let y = 30; y < 1040; y += 90) {
        ctx.beginPath();
        for (let x = -40, k = 0; x < 1060; x += 50, k++) ctx.lineTo(x, y + (k % 2 ? 26 : -26));
        ctx.stroke();
      }
    } else if (W.pattern === 'stars') {
      for (let i = 0; i < 90; i++) {
        ctx.globalAlpha = 0.3 + rand() * 0.6; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(rand() * 1000, rand() * 1000, 2 + rand() * 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 0.8; ctx.fillStyle = W.alt;
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(rand() * 1000, rand() * 1000, 30 + rand() * 50, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#f5c842'; ctx.globalAlpha = 0.9;
      for (let i = 0; i < 10; i++) { star(ctx, rand() * 1000, rand() * 1000, 14 + rand() * 14, 5, 0.45); ctx.fill(); }
    }
    ctx.restore();

    // Little pictures scattered around the label so every piece has something on it
    const placed = [];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let tries = 0; placed.length < 16 && tries < 400; tries++) {
      const x = 70 + rand() * 860, y = 130 + rand() * 740, s = 60 + rand() * 40;
      if (Math.hypot(x - 500, y - 500) < 300 + s / 2) continue;
      if (Math.hypot(x - 800, y - 200) < 150) continue;
      if (placed.some(p => Math.hypot(p[0] - x, p[1] - y) < (p[2] + s) * 0.6)) continue;
      placed.push([x, y, s]);
      ctx.save();
      ctx.translate(x, y); ctx.rotate((rand() - 0.5) * 0.9);
      ctx.font = `${s}px serif`;
      ctx.fillText(W.bits[placed.length % W.bits.length], 0, 0);
      ctx.restore();
    }

    // Crimped paper ends, top and bottom
    ctx.fillStyle = W.alt;
    for (const [y0, dir] of [[0, 1], [1000, -1]]) {
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(0, y0 + dir * 70);
      for (let x = 0; x <= 1000; x += 40) ctx.lineTo(x + 20, y0 + dir * (x % 80 ? 70 : 90));
      ctx.lineTo(1000, y0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 4;
      for (let x = 25; x < 1000; x += 50) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + 10, y0 + dir * 60); ctx.stroke(); }
    }

    // Label
    ctx.fillStyle = W.label;
    ctx.beginPath(); ctx.arc(500, 500, 250, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = W.labelInk; ctx.lineWidth = 10; ctx.stroke();
    ctx.setLineDash([16, 12]); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(500, 500, 222, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '150px serif';
    ctx.fillText(W.hero, 500, 405);
    ctx.fillStyle = W.labelInk;
    fitFont(ctx, W.line1, 380, 118, "'Bebas Neue', sans-serif");
    ctx.fillText(W.line1, 500, 562);
    fitFont(ctx, W.line2, 330, 28, "'DM Mono', monospace");
    ctx.globalAlpha = 0.85;
    ctx.fillText(W.line2, 500, 628);
    ctx.globalAlpha = 1;

    // Starburst badge
    ctx.save();
    ctx.translate(800, 200); ctx.rotate(0.22);
    ctx.fillStyle = W.badge;
    star(ctx, 0, 0, 112, 14, 0.82); ctx.fill();
    ctx.fillStyle = W.badgeInk;
    ctx.font = "46px 'Bebas Neue', sans-serif";
    const words = W.tag.split(' ');
    words.forEach((w, i) => ctx.fillText(w, 0, (i - (words.length - 1) / 2) * 44 + 3));
    ctx.restore();

    // Small print
    ctx.fillStyle = W.ink; ctx.textAlign = 'left';
    ctx.font = "44px 'Bebas Neue', sans-serif";
    ctx.fillText(W.foot, 40, 880);
    ctx.textAlign = 'right';
    ctx.font = "22px 'DM Mono', monospace";
    ctx.fillText('NET WT: 1 BOG', 960, 884);

    // Roll shading, so it reads as a wrapped cylinder
    const shade = ctx.createLinearGradient(0, 0, 1000, 0);
    shade.addColorStop(0, 'rgba(0,0,0,0.32)');
    shade.addColorStop(0.18, 'rgba(255,255,255,0.12)');
    shade.addColorStop(0.4, 'rgba(255,255,255,0)');
    shade.addColorStop(0.75, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.36)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.restore();
  }

  let fontsReady = null;
  function waitForFonts() {
    if (!fontsReady) {
      const loads = document.fonts && document.fonts.load
        ? Promise.all(["40px 'Bebas Neue'", "20px 'DM Mono'"].map(f => document.fonts.load(f))).catch(() => {})
        : Promise.resolve();
      fontsReady = Promise.race([loads, new Promise(r => setTimeout(r, 1500))]);
    }
    return fontsReady;
  }

  // ── PIECE SHAPES ──
  // One side of a piece from (x0,y0) to (x1,y1). s = 1 tab out, -1 hole in, 0 flat edge.
  function side(p, x0, y0, x1, y1, s) {
    if (!s) { p.lineTo(x1, y1); return; }
    const dx = x1 - x0, dy = y1 - y0, nx = dy * s, ny = -dx * s;
    const P = (t, o) => [x0 + dx * t + nx * o, y0 + dy * t + ny * o];
    p.lineTo(...P(0.36, 0));
    p.bezierCurveTo(...P(0.40, 0), ...P(0.28, 0.2), ...P(0.5, 0.2));
    p.bezierCurveTo(...P(0.72, 0.2), ...P(0.60, 0), ...P(0.64, 0));
    p.lineTo(x1, y1);
  }

  function piecePath(sides, cell, pad) {
    const p = new Path2D(), a = pad, b = pad + cell;
    p.moveTo(a, a);
    side(p, a, a, b, a, sides[0]);
    side(p, b, a, b, b, sides[1]);
    side(p, b, b, a, b, sides[2]);
    side(p, a, b, a, a, sides[3]);
    p.closePath();
    return p;
  }

  function fmtTime(s) {
    s = Math.floor(s);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function mount(root, opts) {
    injectCss();
    const hourly = opts.hourly || (() => 0);
    root.innerHTML = `
      <div class="wu">
        <div class="wu-hud">
          <div class="wu-stat"><div class="wu-lbl">Time</div><div class="wu-val" data-time>00:00</div></div>
          <div class="wu-stat"><div class="wu-lbl">Pieces</div><div class="wu-val" data-placed>0/0</div></div>
          <div class="wu-stat"><div class="wu-lbl">Paid to play</div><div class="wu-val green" data-paid>$0.00</div></div>
          <button type="button" class="wu-round" data-peek aria-label="Show the picture underneath" aria-pressed="true">👀</button>
          <button type="button" class="wu-round" data-mute aria-label="Sound"></button>
        </div>
        <div class="wu-stage"><canvas></canvas></div>
        <div class="wu-hint">Drag the pieces into the frame</div>
        <div class="wu-screen" data-screen></div>
      </div>`;
    const $ = sel => root.querySelector(sel);
    const el = {
      stage: $('.wu-stage'), canvas: $('canvas'), screen: $('[data-screen]'),
      time: $('[data-time]'), placed: $('[data-placed]'), paid: $('[data-paid]'),
      peek: $('[data-peek]'), mute: $('[data-mute]'),
    };
    const ctx = el.canvas.getContext('2d');
    const hit = document.createElement('canvas').getContext('2d');
    let alive = true, frame = 0, clock = 0, endTimer = 0;
    let dpr = 1, w = 0, h = 0, S = 0;
    const board = { x: 0, y: 0 }, tray = { x: 0, y: 0, w: 0, h: 0 };
    let art = null;

    const g = {
      state: 'title', wrapper: progress().wrapper % WRAPPERS.length, n: 3,
      pieces: [], placed: 0, moves: 0, started: 0, secs: 0, peek: true,
      drag: null, wonAt: 0, bits: [],
    };

    // ── LAYOUT ──
    // Tall screens: frame on top, pieces tray underneath. Wide screens: tray on the right.
    function layout() {
      if (!alive) return;
      const r = el.stage.getBoundingClientRect();
      const nw = Math.floor(r.width), nh = Math.floor(r.height);
      if (nw <= 0 || nh <= 0) return;
      w = nw; h = nh; dpr = Math.min(window.devicePixelRatio || 1, 3);
      let nS;
      if (h >= w * 0.9) {
        nS = Math.floor(Math.min(w, (h - GAP) / 1.55));
        board.x = Math.floor((w - nS) / 2); board.y = 0;
        Object.assign(tray, { x: 0, y: nS + GAP, w, h: h - nS - GAP });
      } else {
        nS = Math.floor(Math.min(h, (w - GAP) / 1.6));
        board.x = 0; board.y = Math.floor((h - nS) / 2);
        Object.assign(tray, { x: nS + GAP, y: 0, w: w - nS - GAP, h });
      }
      el.canvas.style.width = w + 'px'; el.canvas.style.height = h + 'px';
      el.canvas.width = Math.round(w * dpr); el.canvas.height = Math.round(h * dpr);
      if (nS !== S || !art) { S = nS; renderArt(); }
      g.pieces.forEach(clamp);
      draw();
    }

    function renderArt() {
      art = document.createElement('canvas');
      art.width = art.height = Math.max(1, Math.round(S * dpr));
      drawWrapper(art.getContext('2d'), art.width, WRAPPERS[g.wrapper], g.wrapper);
      g.pieces.forEach(renderPiece);
    }

    const cell = () => S / g.n;
    const pad = () => cell() * 0.25;
    const size = () => cell() * 1.5;

    function renderPiece(p) {
      const c = cell(), pd = pad(), sz = size();
      p.path = piecePath(p.sides, c, pd);
      const img = p.img || document.createElement('canvas');
      img.width = img.height = Math.ceil(sz * dpr);
      const x = img.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, sz, sz);
      x.save();
      x.clip(p.path);
      x.drawImage(art, pd - p.c * c, pd - p.r * c, S, S);
      x.lineWidth = 2.5; x.strokeStyle = 'rgba(0,0,0,0.35)'; x.stroke(p.path);
      x.translate(0.8, 0.8);
      x.lineWidth = 1.2; x.strokeStyle = 'rgba(255,255,255,0.35)'; x.stroke(p.path);
      x.restore();
      p.img = img;
    }

    // Piece positions are kept as fractions of the play area so they survive a resize.
    function pos(p) {
      if (p.locked) return [board.x + p.c * cell() - pad(), board.y + p.r * cell() - pad()];
      return [p.fx * w, p.fy * h];
    }
    function clamp(p) {
      if (p.locked) return;
      const sz = size(), pd = pad();
      const x = Math.max(-pd, Math.min(w - sz + pd, p.fx * w));
      const y = Math.max(-pd, Math.min(h - sz + pd, p.fy * h));
      p.fx = x / w; p.fy = y / h;
    }

    // ── GAME ──
    function newPuzzle(n) {
      g.n = n;
      const H = [], V = [];
      for (let r = 0; r < n; r++) {
        H.push([]); V.push([]);
        for (let c = 0; c < n; c++) { H[r].push(Math.random() < 0.5 ? 1 : -1); V[r].push(Math.random() < 0.5 ? 1 : -1); }
      }
      const pieces = [];
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          pieces.push({
            r, c, locked: false, fx: 0, fy: 0, flash: 0,
            sides: [r ? -H[r - 1][c] : 0, c < n - 1 ? V[r][c] : 0, r < n - 1 ? H[r][c] : 0, c ? -V[r][c - 1] : 0],
          });
        }
      }
      // Shuffle the stacking order, then scatter across the tray
      for (let i = pieces.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pieces[i], pieces[j]] = [pieces[j], pieces[i]]; }
      g.pieces = pieces;
      scatter();
      g.placed = 0; g.moves = 0; g.started = 0; g.secs = 0; g.drag = null; g.bits = [];
    }

    function scatter() {
      const sz = size(), pd = pad();
      g.pieces.forEach(p => {
        if (p.locked) return;
        const x = tray.x - pd + Math.random() * Math.max(0, tray.w - sz + 2 * pd);
        const y = tray.y - pd + Math.random() * Math.max(0, tray.h - sz + 2 * pd);
        p.fx = x / w; p.fy = y / h;
        clamp(p);
      });
    }

    async function start(n) {
      sound.init();
      clearTimeout(endTimer);
      el.screen.hidden = true;
      g.state = 'play';
      await waitForFonts();
      if (!alive) return;
      layout();
      newPuzzle(n);
      renderArt();
      hud();
      draw();
      clearInterval(clock);
      clock = setInterval(tick, 500);
    }

    function tick() {
      if (g.state !== 'play' || !g.started) return;
      g.secs = (performance.now() - g.started) / 1000;
      hud();
    }

    function hud() {
      el.time.textContent = fmtTime(g.secs);
      el.placed.textContent = g.placed + '/' + g.n * g.n;
      el.paid.textContent = '$' + (hourly() * g.secs / 3600).toFixed(2);
    }

    function win() {
      g.state = 'won';
      g.secs = (performance.now() - g.started) / 1000;
      g.wonAt = performance.now();
      clearInterval(clock);
      hud();
      sound.fart(); buzz([40, 30, 60, 30, 90]);
      // Poo confetti blasting out of the wrapper
      if (!still) {
        const cx = board.x + S / 2, cy = board.y + S / 2;
        for (let i = 0; i < 36; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 4 + Math.random() * 9;
          g.bits.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
            e: ['💩', '💨', '🧻'][i % 3], s: 22 + Math.random() * 18 });
        }
      }
      loop();
      endTimer = setTimeout(endScreen, still ? 600 : 2200);
    }

    function endScreen() {
      if (!alive) return;
      g.state = 'over';
      const p = progress();
      const key = String(g.n);
      const record = !p.best[key] || g.secs < p.best[key];
      if (record) p.best[key] = Math.round(g.secs);
      p.wrapper = g.wrapper;
      save(PROGRESS_KEY, p);
      const W = WRAPPERS[g.wrapper];
      el.screen.innerHTML = `
        <canvas class="wu-done-art" data-art></canvas>
        <div class="wu-title">Wiped Clean!</div>
        <div class="wu-sub">${W.name} · ${g.n}×${g.n}</div>
        <div class="wu-box wu-grid">
          <div><div class="wu-lbl">Time</div><div class="wu-val">${fmtTime(g.secs)}</div></div>
          <div><div class="wu-lbl">Moves</div><div class="wu-val">${g.moves}</div></div>
          <div><div class="wu-lbl">Paid to play</div><div class="wu-val green">$${(hourly() * g.secs / 3600).toFixed(2)}</div></div>
          <div><div class="wu-lbl">Best ${g.n}×${g.n}</div><div class="wu-val" style="color:${record ? '#f5c842' : '#a08060'}">${record ? 'NEW BEST!' : fmtTime(p.best[key])}</div></div>
        </div>
        <button type="button" class="wu-btn" data-rip>💨 Let it rip again</button>
        <button type="button" class="wu-btn ghost" data-next>▶ Next wrapper</button>
        <button type="button" class="wu-link" data-title>Change size or wrapper</button>
        <button type="button" class="wu-link" data-exit style="margin-top:6px">Back to the bog timer</button>`;
      el.screen.hidden = false;
      const thumb = el.screen.querySelector('[data-art]');
      thumb.width = thumb.height = 300;
      thumb.getContext('2d').drawImage(art, 0, 0, 300, 300);
      const on = (sel, fn) => { el.screen.querySelector(sel).onclick = fn; };
      on('[data-rip]', () => {
        sound.init(); sound.fart(); buzz([40, 30, 60]);
        thumb.classList.remove('rip'); void thumb.offsetWidth; thumb.classList.add('rip');
      });
      on('[data-next]', () => { g.wrapper = (g.wrapper + 1) % WRAPPERS.length; start(g.n); });
      on('[data-title]', titleScreen);
      on('[data-exit]', () => opts.onExit && opts.onExit());
      if (!still) thumb.classList.add('rip');
    }

    async function titleScreen() {
      g.state = 'title';
      clearInterval(clock); clearTimeout(endTimer);
      const p = progress();
      el.screen.innerHTML = `
        <div class="wu-hero">🧩</div>
        <div class="wu-title">Wrap Up</div>
        <div class="wu-sub">Piece the wrapper back together.<br>It lets one rip when you finish</div>
        <div class="wu-box">
          <div class="wu-lbl">Pick a wrapper</div>
          <div class="wu-wraps">
            ${WRAPPERS.map((W, i) => `<button type="button" class="wu-wrap" data-w="${i}" aria-pressed="${i === g.wrapper}">
              <canvas width="120" height="120"></canvas><span>${W.name}</span></button>`).join('')}
          </div>
        </div>
        <div class="wu-sizes">
          ${SIZES.map(s => `<button type="button" class="wu-size" data-n="${s.n}">
            <div class="wu-size-n">${s.n}×${s.n}</div>
            <div class="wu-size-t"><b>${s.name}</b><span>${s.n * s.n} pieces${p.best[s.n] ? ' · best ' + fmtTime(p.best[s.n]) : ''}</span></div>
          </button>`).join('')}
        </div>
        <button type="button" class="wu-link" data-exit>Back to the bog timer</button>`;
      el.screen.hidden = false;
      el.screen.querySelectorAll('[data-w]').forEach(b => {
        b.onclick = () => {
          g.wrapper = +b.dataset.w;
          el.screen.querySelectorAll('[data-w]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        };
      });
      el.screen.querySelectorAll('[data-n]').forEach(b => { b.onclick = () => start(+b.dataset.n); });
      el.screen.querySelector('[data-exit]').onclick = () => opts.onExit && opts.onExit();
      await waitForFonts();
      if (!alive || g.state !== 'title') return;
      el.screen.querySelectorAll('.wu-wrap canvas').forEach((c, i) => drawWrapper(c.getContext('2d'), 120, WRAPPERS[i], i));
    }

    // ── DRAWING ──
    function draw() {
      if (!w || !art) return;
      const now = performance.now();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Frame and tray
      ctx.fillStyle = '#130e05';
      ctx.fillRect(board.x, board.y, S, S);
      if (g.peek && g.state === 'play') { ctx.globalAlpha = 0.16; ctx.drawImage(art, board.x, board.y, S, S); ctx.globalAlpha = 1; }
      ctx.strokeStyle = 'rgba(245,200,66,0.35)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(board.x - 0.75, board.y - 0.75, S + 1.5, S + 1.5);
      ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(245,200,66,0.15)';
      ctx.strokeRect(tray.x + 1, tray.y + 1, tray.w - 2, tray.h - 2);
      ctx.setLineDash([]);

      if (g.state === 'won' || g.state === 'over') {
        drawWin(now);
        return;
      }

      const sz = size();
      const order = g.pieces.filter(p => p.locked).concat(g.pieces.filter(p => !p.locked && p !== (g.drag && g.drag.p)));
      if (g.drag) order.push(g.drag.p);
      let busy = false;
      for (const p of order) {
        const [x, y] = pos(p);
        ctx.save();
        if (!p.locked) {
          const lifted = g.drag && g.drag.p === p;
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = (lifted ? 16 : 6) * dpr;
          ctx.shadowOffsetY = (lifted ? 8 : 3) * dpr;
          if (lifted) { ctx.translate(x + sz / 2, y + sz / 2); ctx.scale(1.05, 1.05); ctx.translate(-x - sz / 2, -y - sz / 2); }
        }
        ctx.drawImage(p.img, x, y, sz, sz);
        ctx.restore();
        const f = 1 - (now - p.flash) / 450;
        if (f > 0) {
          busy = true;
          ctx.save();
          ctx.translate(x, y);
          ctx.strokeStyle = `rgba(245,200,66,${f})`; ctx.lineWidth = 3;
          ctx.stroke(p.path);
          ctx.restore();
        }
      }
      if (busy) loop();
    }

    function drawWin(now) {
      const t = (now - g.wonAt) / 1000;
      // The finished wrapper squishes like it's letting one go
      const k = still ? 0 : Math.sin(t * 20) * Math.exp(-t * 2.4);
      const fade = Math.min(1, t / 0.25);
      ctx.save();
      ctx.translate(board.x + S / 2, board.y + S);
      ctx.rotate(k * 0.04);
      ctx.scale(1 + k * 0.08, 1 - k * 0.1);
      ctx.translate(-S / 2, -S);
      ctx.shadowColor = `rgba(245,200,66,${0.5 * fade})`; ctx.shadowBlur = 30 * dpr;
      ctx.drawImage(art, 0, 0, S, S);
      ctx.restore();

      let busy = t < 2.5;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const b of g.bits) {
        b.x += b.vx; b.y += b.vy; b.vy += 0.32; b.vx *= 0.99; b.rot += b.vr;
        if (b.y < h + 40) busy = true;
        ctx.save();
        ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        ctx.font = `${b.s}px serif`;
        ctx.fillText(b.e, 0, 0);
        ctx.restore();
      }
      if (busy && g.state === 'won') loop();
    }

    function loop() {
      if (frame || !alive) return;
      frame = requestAnimationFrame(() => { frame = 0; draw(); });
    }

    // ── INPUT ──
    // Pointer events cover mouse, touch and pen, so one set of handlers works on phones and desktop.
    function local(e) {
      const r = el.canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    function pieceAt(x, y) {
      const sz = size();
      const loose = g.pieces.filter(p => !p.locked);
      for (let i = loose.length - 1; i >= 0; i--) {
        const p = loose[i], [px, py] = pos(p);
        if (x < px || y < py || x > px + sz || y > py + sz) continue;
        if (hit.isPointInPath(p.path, x - px, y - py)) return p;
      }
      return null;
    }
    function onDown(e) {
      if (g.state !== 'play' || g.drag) return;
      const [x, y] = local(e);
      const p = pieceAt(x, y);
      if (!p) return;
      e.preventDefault();
      sound.init();
      if (!g.started) g.started = performance.now();
      const [px, py] = pos(p);
      g.drag = { p, id: e.pointerId, dx: x - px, dy: y - py };
      // Bring it to the top of the pile
      g.pieces.splice(g.pieces.indexOf(p), 1);
      g.pieces.push(p);
      try { el.canvas.setPointerCapture(e.pointerId); } catch (err) {}
      loop();
    }
    function onMove(e) {
      if (!g.drag || e.pointerId !== g.drag.id) return;
      e.preventDefault();
      const [x, y] = local(e);
      const p = g.drag.p;
      p.fx = (x - g.drag.dx) / w; p.fy = (y - g.drag.dy) / h;
      clamp(p);
      loop();
    }
    function onUp(e) {
      if (!g.drag || e.pointerId !== g.drag.id) return;
      const p = g.drag.p;
      g.drag = null;
      g.moves++;
      const [x, y] = pos(p);
      const tx = board.x + p.c * cell() - pad(), ty = board.y + p.r * cell() - pad();
      if (Math.hypot(x - tx, y - ty) < cell() * 0.3) {
        p.locked = true; p.flash = performance.now();
        g.placed++;
        sound.snap(); buzz(12);
        hud();
        if (g.placed === g.n * g.n) { win(); return; }
      }
      loop();
    }
    function onCancel(e) {
      if (g.drag && e.pointerId === g.drag.id) { g.drag = null; loop(); }
    }
    function onKey(e) { if (e.key === 'Escape' && opts.onExit) opts.onExit(); }
    function onVisible() {
      // Don't count time spent in another app
      if (document.visibilityState === 'hidden' && g.state === 'play' && g.started) g.pausedAt = performance.now();
      if (document.visibilityState === 'visible' && g.pausedAt) { g.started += performance.now() - g.pausedAt; g.pausedAt = 0; }
    }

    function renderMute() { el.mute.textContent = sound.muted ? '🔇' : '🔊'; el.mute.setAttribute('aria-pressed', String(!sound.muted)); }
    el.mute.onclick = () => { sound.muted = !sound.muted; save(MUTE_KEY, sound.muted); sound.init(); renderMute(); };
    el.peek.onclick = () => { g.peek = !g.peek; el.peek.setAttribute('aria-pressed', String(g.peek)); loop(); };

    el.canvas.style.touchAction = 'none';
    el.canvas.addEventListener('pointerdown', onDown);
    el.canvas.addEventListener('pointermove', onMove);
    el.canvas.addEventListener('pointerup', onUp);
    el.canvas.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisible);
    const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
    if (ro) ro.observe(el.stage); else window.addEventListener('resize', layout);

    renderMute();
    titleScreen();

    return {
      destroy() {
        alive = false;
        // Let the phone power the audio down; the next tap on Play wakes it
        if (sound.ac && sound.ac.state === 'running') sound.ac.suspend().catch(() => {});
        if (frame) cancelAnimationFrame(frame);
        clearInterval(clock); clearTimeout(endTimer);
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisible);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', layout);
        root.innerHTML = '';
      },
      _test: { g, board: () => ({ ...board, S, cell: cell(), pad: pad() }), pos },
    };
  }

  window.WrapUp = { mount, WRAPPERS };
})();
