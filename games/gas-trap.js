// ══ GAS TRAP ══
// Someone's dropped a few silent ones in the dunny and the clouds are bouncing off the tiles.
// Swipe to spray a wall of air freshener across the room. Close a wall and every bit of floor
// with no cloud in it gets freshened. Freshen enough of the room to clear it. If a cloud touches
// a wall while it's still spraying, that half fizzles and you lose a can.
// Loaded only when someone opens it.
//
// window.GasTrap.mount(el, { hourly: () => number, onExit: () => void })
// draws the game into el and returns { destroy() }.
(function () {
  // Add a room by adding a line. clouds = how many, speed = cells a second, target = % to freshen,
  // cans = walls you can lose, sbd = clouds that fade in and out, big = one big slow cloud.
  const LEVELS = [
    { name: 'First Whiff', clouds: 1, speed: 3.2, target: 70, cans: 3, sub: '1 cloud · nice and easy' },
    { name: 'Two Cheeks', clouds: 2, speed: 3.6, target: 70, cans: 3, sub: '2 clouds · double trouble' },
    { name: 'Bean Feast', clouds: 3, speed: 4.0, target: 72, cans: 3, sub: '3 clouds · it was the beans' },
    { name: 'Silent But Deadly', clouds: 3, speed: 4.0, target: 75, cans: 3, sbd: 2, sub: '3 clouds · two you can barely see' },
    { name: 'The Big One', clouds: 3, speed: 4.4, target: 75, cans: 3, big: 1, sub: '4 clouds · one absolute unit' },
    { name: 'Hotbox', clouds: 5, speed: 4.8, target: 75, cans: 4, sub: '5 clouds · windows painted shut' },
  ];
  const COLS = 16;
  const GROW = 11; // cells a second each half of a wall sprays out
  // Cloud size in cells (half width), the big one is double. It bumps walls and fizzles sprays
  // at 85% of that, so the puffs squish a little against the tiles.
  const R = 0.85;
  const PROGRESS_KEY = 'gi.gastrap.v1';
  const MUTE_KEY = 'gi.gastrap.muted';
  const OUT = '#3F230C', DARK = '#1A1208', GOLD = '#F5C842';
  const GAS = ['#D4F07A', '#7DB536'], FRESH = '#F3DDEB', FRESH2 = '#EBCFE2', TILE = '#2A2410', TILE2 = '#231E0C';
  // Spritz's one-liners
  const SAY = {
    start: ['Swipe to spray a wall. Box them in!', "Pssht! Let's freshen this place up.", 'Swipe across or down to spray.'],
    sbd: ["Some of them are sneaky. Watch the faint ones.", 'Silent but deadly. Keep your eyes peeled.'],
    big: ["Oh no. That big one's been brewing all day.", 'Mind the big fella. He bounces slow.'],
    hotbox: ['Five of them. Who did this?', 'Hold your breath and get spraying.'],
    trap: ['Pssht! Lovely.', 'Freshened!', 'Smells like a meadow now.', 'Get in there!', 'Boxed him in!'],
    small: ['Tight squeeze for that one.', 'Nowhere to go now, mate.'],
    fizzle: ['Ugh. Straight through it.', 'It touched my spray!', "Wasted a can. Don't let them touch it.", 'Phwoar. That got through.'],
    last: ['Last can! Careful!', 'One can left. Make it count.'],
    busy: ['One wall at a time!', "I'm still spraying!"],
    win: ['Room freshened!', 'Smells like lavender in here.', 'You could eat off that floor. Please don\'t.'],
  };
  const GASSED = [
    "Out of cans. Someone open a window.",
    "The room wins. It always wins.",
    "That's not a smell, that's a weather system.",
    "Breathe through your mouth. No, wait, don't.",
    "Lock the door and walk away.",
  ];
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Branch previews unlock every room so they can all be tested
  const preview = /\.pages\.dev$|^localhost$|^127\./.test(location.hostname);

  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const clock = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const PLAY_ICON = '<svg width="0.8em" height="0.8em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-0.05em"><path d="M7 4.8v14.4a1.2 1.2 0 0 0 1.8 1l11.6-7.2a1.2 1.2 0 0 0 0-2L8.8 3.8A1.2 1.2 0 0 0 7 4.8z"/></svg>';
  const GRID_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>';
  const BACK_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>';
  const H_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h18"/><path d="M7 8l-4 4 4 4"/><path d="M17 8l4 4-4 4"/></svg>';
  const V_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18"/><path d="M8 7l4-4 4 4"/><path d="M8 17l4 4 4-4"/></svg>';
  // Spritz the air freshener, same cartoon style as the arcade tiles. sad = after a fizzle.
  function spritz(sad) {
    const o = `stroke="${OUT}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;
    const eye = (x, lid) => `<ellipse cx="${x}" cy="92" rx="13" ry="15" fill="#fff" stroke="${OUT}" stroke-width="4"/>`
      + `<circle cx="${x + 3}" cy="${sad ? 97 : 90}" r="6.5" fill="${DARK}"/><circle cx="${x + 5.3}" cy="${sad ? 94.4 : 87.4}" r="2.1" fill="#fff"/>`
      + (lid ? `<path d="M${x - 13} 92 A13 15 0 0 1 ${x + 13} 92 Z" fill="#C2457D" stroke="${OUT}" stroke-width="4"/>` : '');
    const mouth = sad
      ? `<path d="M86 128 Q100 118 114 128" fill="none" stroke="${DARK}" stroke-width="5" stroke-linecap="round"/>`
      : `<path d="M82 118 Q100 140 118 118 Z" fill="${DARK}" ${o}/><path d="M88 121 L112 121 L110 125 Q100 129 90 125 Z" fill="#fff"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" aria-hidden="true">`
      + `<defs><linearGradient id="gtCan" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF8FC0"/><stop offset=".55" stop-color="#E4508F"/><stop offset="1" stop-color="#B8306C"/></linearGradient>`
      + `<linearGradient id="gtCap" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#B9C6D0"/></linearGradient></defs>`
      + `<rect x="60" y="54" width="80" height="170" rx="16" fill="url(#gtCan)" ${o}/>`
      + `<rect x="72" y="26" width="56" height="34" rx="10" fill="url(#gtCap)" ${o}/>`
      + `<rect x="46" y="30" width="30" height="14" rx="6" fill="url(#gtCap)" stroke="${OUT}" stroke-width="5"/>`
      + `<rect x="70" y="66" width="9" height="140" rx="4.5" fill="#fff" opacity=".4"/>`
      + eye(84, sad) + eye(116, sad) + mouth
      + `<ellipse cx="74" cy="112" rx="8" ry="4.5" fill="#FFB3D0" opacity=".8"/><ellipse cx="126" cy="112" rx="8" ry="4.5" fill="#FFB3D0" opacity=".8"/>`
      + [0, 1, 2, 3, 4].map(k => { const a = k * 1.2566 - 1.57; return `<circle cx="${(100 + 13 * Math.cos(a)).toFixed(1)}" cy="${(178 + 13 * Math.sin(a)).toFixed(1)}" r="9" fill="#fff" stroke="${OUT}" stroke-width="3.5"/>`; }).join('')
      + `<circle cx="100" cy="178" r="7" fill="${GOLD}" stroke="${OUT}" stroke-width="3.5"/>`
      + (sad ? '' : `<path d="M40 36 l-14 -6 M40 44 l-16 2 M42 52 l-12 10" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 6"/>`)
      + `</svg>`;
  }

  const CSS = `
  .gt { position: relative; display: flex; flex-direction: column; height: 100%;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; color: var(--cream, #f5ead6); }
  .gt-hud { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; padding: 10px 14px;
    background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 16px; }
  .gt-stat { flex: 1; min-width: 0; }
  .gt-lbl { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; color: var(--muted, #a08060); text-transform: uppercase; }
  .gt-val { font-family: 'Bebas Neue', sans-serif; font-size: 24px; line-height: 1.05; letter-spacing: 1px; white-space: nowrap; }
  .gt-val.green { color: var(--green, #4caf6e); }
  .gt-mute { background: none; border: 1px solid rgba(245,200,66,0.2); border-radius: 50%; width: 36px; height: 36px;
    font-size: 16px; cursor: pointer; flex-shrink: 0; }
  .gt-fresh { display: flex; align-items: center; gap: 8px; margin: 0 2px 6px; flex-shrink: 0; }
  .gt-fresh-bar { position: relative; flex: 1; height: 12px; border-radius: 6px; background: #120c05; border: 1px solid rgba(224,123,0,0.25); overflow: hidden; }
  .gt-fresh-fill { height: 100%; width: 0; border-radius: 6px; background: #E4508F; transition: width 0.35s; }
  .gt-fresh-fill.done { background: var(--green, #4caf6e); }
  .gt-fresh-goal { position: absolute; top: -1px; bottom: -1px; width: 2px; background: var(--gold, #f5c842); }
  .gt-stage { flex: 1; min-height: 0; position: relative; display: flex; align-items: center; justify-content: center; }
  .gt-stage canvas { display: block; touch-action: none; border-radius: 10px; }
  .gt-stage.shake { animation: gtShake 0.4s; }
  @keyframes gtShake { 0%,100% { transform: none; } 20% { transform: translate(-6px,3px); } 40% { transform: translate(5px,-3px); } 60% { transform: translate(-4px,2px); } 80% { transform: translate(2px,-1px); } }
  .gt-bar { display: flex; align-items: flex-end; gap: 6px; flex-shrink: 0; padding-top: 6px; min-height: 76px; }
  .gt-spritz { width: 46px; flex-shrink: 0; margin-bottom: -2px; transform-origin: 50% 100%; }
  .gt-spritz svg { display: block; width: 100%; height: auto; overflow: visible; }
  .gt-spritz.talk { animation: gtTalk 0.45s; }
  @keyframes gtTalk { 0% { transform: scale(1,1); } 30% { transform: scale(1.12,0.86); } 60% { transform: scale(0.92,1.1); } 100% { transform: scale(1,1); } }
  .gt-say { flex: 1; min-width: 0; align-self: center; position: relative; background: #fff; color: #1a1208; border: 3px solid ${OUT};
    border-radius: 14px; padding: 8px 10px; font-size: 13px; font-weight: 700; line-height: 1.25; }
  .gt-say::before { content: ''; position: absolute; left: -11px; bottom: 10px; border: 6px solid transparent; border-right-color: ${OUT}; border-left-width: 0; border-right-width: 9px; }
  .gt-say::after { content: ''; position: absolute; left: -6px; bottom: 11px; border: 5px solid transparent; border-right-color: #fff; border-left-width: 0; border-right-width: 7px; }
  .gt-dir { flex-shrink: 0; align-self: center; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 1.5px solid rgba(245,200,66,0.6);
    border-radius: 12px; background: transparent; color: var(--gold, #f5c842); cursor: pointer; padding: 8px 10px 6px; min-width: 56px; }
  .gt-dir span { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: var(--muted, #a08060); }
  .gt-screen { position: absolute; inset: 0; z-index: 2; background: var(--bg, #1a1208); overflow-y: auto;
    display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 4px; }
  .gt-screen > :first-child { margin-top: auto; }
  .gt-screen > :last-child { margin-bottom: auto; }
  .gt-screen[hidden] { display: none; }
  .gt-hero { position: relative; flex-shrink: 0; }
  .gt-hero.bob .game-hero-art, .gt-hero.bob svg { animation: gtBob 1.6s ease-in-out infinite; transform-origin: 50% 100%; }
  .gt-hero svg { display: block; width: 88px; height: auto; margin: 0 auto; overflow: visible; filter: drop-shadow(0 0 18px rgba(228,80,143,0.35)); }
  @keyframes gtBob { 0%,100% { transform: scale(1,1); } 50% { transform: scale(1.04,0.96); } }
  .gt-title { font-family: 'Bebas Neue', sans-serif; font-size: 64px; line-height: 0.95; color: var(--gold, #f5c842); margin-top: 6px;
    -webkit-text-stroke: 6px ${OUT}; paint-order: stroke fill; letter-spacing: 2px; }
  .gt-sub { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin: 8px 0 14px; }
  .gt-box { width: 100%; background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 20px;
    padding: 12px 14px; text-align: left; margin-bottom: 12px; }
  .gt-instr-text { font-size: 14px; line-height: 1.5; margin: 0 0 4px; }
  .gt-levels { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-bottom: 4px; }
  .gt-level { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer;
    background: var(--surface, #231a0a); border: 1.5px solid rgba(245,200,66,0.45); border-radius: 16px; padding: 10px 14px; color: inherit; }
  .gt-level:disabled { opacity: 0.4; cursor: default; border-color: rgba(224,123,0,0.25); }
  .gt-level-n { font-family: 'Bebas Neue', sans-serif; font-size: 34px; color: var(--gold, #f5c842); width: 26px; text-align: center; }
  .gt-level-t { flex: 1; min-width: 0; }
  .gt-level-t b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 21px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; }
  .gt-level-t span { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted, #a08060); }
  .gt-stars { font-size: 14px; letter-spacing: 0; white-space: nowrap; }
  .gt-play { flex-shrink: 0; min-width: 64px; text-align: center; background: var(--gold, #f5c842); color: #1a1208; border-radius: 10px;
    padding: 8px 12px; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; line-height: 1; white-space: nowrap; }
  .gt-play.locked { background: none; color: var(--muted, #a08060); border: 1px solid rgba(224,123,0,0.35); letter-spacing: 0; font-size: 15px; }
  .gt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
  .gt-grid .gt-val { font-size: 32px; }
  .gt-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 5px 0;
    border-bottom: 1px dashed rgba(160,128,96,0.35); font-size: 14px; }
  .gt-row b { font-family: 'Bebas Neue', sans-serif; font-size: 22px; font-weight: 400; letter-spacing: 1px; }
  .gt-row.total { border-bottom: none; padding-top: 9px; }
  .gt-row.total b { font-size: 34px; color: var(--green, #4caf6e); }
  .gt-bigstars { font-size: 40px; letter-spacing: 6px; margin: 2px 0 10px; }
  .gt-quip { font-size: 15px; line-height: 1.4; margin: -4px 0 14px; opacity: 0.9; }
  .gt-btn { width: 100%; border: none; border-radius: 12px; background: var(--gold, #f5c842); color: #1a1208;
    font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 3px; padding: 14px; cursor: pointer; margin-top: 4px; }
  .gt-btn.ghost { background: transparent; color: var(--gold, #f5c842); border: 1.5px solid rgba(245,200,66,0.6); margin-top: 20px; }
  .gt-link { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent;
    color: var(--cream, #f5ead6); border: none; border-radius: 12px; font-family: 'Bebas Neue', sans-serif;
    font-size: 19px; letter-spacing: 2px; padding: 12px 14px; margin-top: 20px; cursor: pointer; }
  .gt-link svg { color: var(--gold, #f5c842); flex: 0 0 auto; margin-top: -2px; }
  .gt-pop { position: absolute; left: 50%; top: 42%; z-index: 1; pointer-events: none; font-family: 'Bebas Neue', sans-serif; font-size: 44px; line-height: 1;
    color: var(--gold, #f5c842); letter-spacing: 1px; white-space: nowrap;
    text-shadow: 3px 0 ${OUT}, -3px 0 ${OUT}, 0 3px ${OUT}, 0 -3px ${OUT}, 2px 2px ${OUT}, -2px -2px ${OUT}, 2px -2px ${OUT}, -2px 2px ${OUT}, 0 5px 0 ${OUT};
    transform: translate(-50%,-50%); animation: gtPop 1s ease-out forwards; }
  .gt-pop.bad { color: #9BD24A; }
  @keyframes gtPop { 0% { transform: translate(-50%,-30%) scale(0.5); opacity: 0; } 20% { transform: translate(-50%,-50%) scale(1.1); opacity: 1; }
    70% { opacity: 1; } 100% { transform: translate(-50%,-90%) scale(1); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .gt-spritz.talk, .gt-hero.bob .game-hero-art, .gt-hero.bob svg, .gt-stage.shake { animation: none; }
    .gt-pop { animation: gtPopStill 1s forwards; }
    @keyframes gtPopStill { 0%, 70% { opacity: 1; } 100% { opacity: 0; } }
  }
  `;

  function injectCss() {
    if (document.getElementById('gt-style')) return;
    const s = document.createElement('style');
    s.id = 'gt-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── SOUND ──
  // Web Audio only starts after a tap (iOS rule), so it's created on the first touch.
  const sound = {
    ac: null, noise: null, muted: load(MUTE_KEY, false),
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
    // Aerosol hiss: filtered white noise
    hiss(dur) {
      if (this.muted || !this.ac) return;
      const ac = this.ac, t = ac.currentTime;
      if (!this.noise) {
        this.noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = this.noise; src.loop = true;
      f.type = 'highpass'; f.frequency.value = 3200;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.04);
      g.gain.setValueAtTime(0.05, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(ac.destination);
      src.start(t); src.stop(t + dur + 0.02);
    },
    trap() { [784, 988, 1175].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.12, 'triangle', 0.06), i * 70)); },
    fart() { this.tone(120, 55, 0.55, 'sawtooth', 0.14, 22); },
    boing() { this.tone(260, 200, 0.05, 'sine', 0.02); },
    nope() { this.tone(200, 160, 0.08, 'square', 0.03); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.18, 'triangle', 0.08), i * 120)); },
    lose() { this.tone(160, 40, 1.1, 'sawtooth', 0.15, 16); },
  };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  // ── ROOM ──
  // The room is a grid: 1 = freshened (or the outside wall), 0 = still stinks.
  function makeRoom(cols, rows) {
    const cells = new Uint8Array(cols * rows);
    for (let c = 0; c < cols; c++) { cells[c] = 1; cells[(rows - 1) * cols + c] = 1; }
    for (let r = 0; r < rows; r++) { cells[r * cols] = 1; cells[r * cols + cols - 1] = 1; }
    return cells;
  }
  // Fill every empty cell that no cloud can reach. Returns how many cells were freshened.
  function capture(cells, cols, rows, clouds) {
    const seen = new Uint8Array(cells.length), stack = [];
    clouds.forEach(k => {
      const i = Math.floor(k.y) * cols + Math.floor(k.x);
      if (!cells[i] && !seen[i]) { seen[i] = 1; stack.push(i); }
    });
    while (stack.length) {
      const i = stack.pop(), c = i % cols;
      const next = [i - cols, i + cols, c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1];
      for (const j of next) if (j >= 0 && j < cells.length && !cells[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
    let got = 0;
    for (let i = 0; i < cells.length; i++) if (!cells[i] && !seen[i]) { cells[i] = 2; got++; }
    return got;
  }

  function mount(root, opts) {
    injectCss();
    const hourly = opts.hourly || (() => 0);
    root.innerHTML = `
      <div class="gt">
        <div class="gt-hud">
          <div class="gt-stat"><div class="gt-lbl">Room</div><div class="gt-val" data-room>1</div></div>
          <div class="gt-stat"><div class="gt-lbl">Cans</div><div class="gt-val" data-cans>3</div></div>
          <div class="gt-stat"><div class="gt-lbl">Paid to play</div><div class="gt-val green" data-paid>$0.00</div></div>
          <button type="button" class="gt-mute" data-mute aria-label="Sound"></button>
        </div>
        <div class="gt-fresh"><div class="gt-lbl" data-freshlbl>Fresh 0%</div><div class="gt-fresh-bar"><div class="gt-fresh-fill" data-fresh></div><div class="gt-fresh-goal" data-goal></div></div></div>
        <div class="gt-stage"><canvas></canvas></div>
        <div class="gt-bar">
          <div class="gt-spritz" data-spritz>${spritz()}</div>
          <div class="gt-say" data-say aria-live="polite"></div>
          <button type="button" class="gt-dir" data-dir aria-label="Spray direction"></button>
        </div>
        <div class="gt-screen" data-screen></div>
      </div>`;
    const $ = sel => root.querySelector(sel);
    const el = {
      wrap: $('.gt'), stage: $('.gt-stage'), canvas: $('canvas'), screen: $('[data-screen]'),
      room: $('[data-room]'), cans: $('[data-cans]'), paid: $('[data-paid]'), mute: $('[data-mute]'),
      fresh: $('[data-fresh]'), freshLbl: $('[data-freshlbl]'), goal: $('[data-goal]'),
      spritz: $('[data-spritz]'), say: $('[data-say]'), dir: $('[data-dir]'),
    };
    const ctx = el.canvas.getContext('2d');

    let T = 20, W = 0, H = 0, dpr = 1;
    const g = {
      state: 'title', lv: 0, L: LEVELS[0], cols: COLS, rows: 22, cells: null, clouds: [], wall: null,
      dir: 'h', cans: 3, lost: 0, secs: 0, pct: 0, inner: 1, parts: [], t: 0, sparked: new Uint8Array(0),
    };
    let alive = true, frame = null, last = 0, endTimer = 0, hud = {}, touch = null;

    // ── LAYOUT ──
    // The room keeps 16 columns; how many rows depends on the shape of the screen.
    function roomRows() {
      const r = el.stage.getBoundingClientRect();
      if (!r.width || !r.height) return 22;
      return Math.max(16, Math.min(26, Math.round(r.height / r.width * COLS)));
    }
    function layout() {
      if (!g.cells) return;
      const r = el.stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      T = Math.max(10, Math.floor(Math.min((r.width - 2) / g.cols, (r.height - 2) / g.rows)));
      W = T * g.cols; H = T * g.rows;
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      el.canvas.width = W * dpr; el.canvas.height = H * dpr;
      el.canvas.style.width = W + 'px'; el.canvas.style.height = H + 'px';
      draw(performance.now());
    }
    const filled = (c, r) => c < 0 || r < 0 || c >= g.cols || r >= g.rows || g.cells[r * g.cols + c] > 0;

    // ── DRAW ──
    // Little flowers on freshened floor, the same ones every time for the same cell
    const flowerAt = i => ((i * 2654435761) >>> 0) % 7 === 0;
    function drawRoom(now) {
      const { cols, rows, cells } = g;
      ctx.fillStyle = TILE; ctx.fillRect(0, 0, W, H);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c, x = c * T, y = r * T;
        if (cells[i]) {
          ctx.fillStyle = (r + c) % 2 ? FRESH : FRESH2; ctx.fillRect(x, y, T, T);
        } else {
          ctx.fillStyle = (r + c) % 2 ? TILE : TILE2; ctx.fillRect(x, y, T, T);
        }
      }
      // grout on the stinky floor
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 1; c < cols; c++) { ctx.moveTo(c * T + 0.5, 0); ctx.lineTo(c * T + 0.5, H); }
      for (let r = 1; r < rows; r++) { ctx.moveTo(0, r * T + 0.5); ctx.lineTo(W, r * T + 0.5); }
      ctx.stroke();
      // flowers on freshened floor (not the outer wall)
      for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
        const i = r * cols + c;
        if (cells[i] === 2 && flowerAt(i)) flower(c * T + T / 2, r * T + T / 2, T * 0.22, (i % 3) ? '#fff' : GOLD);
      }
      // a thick outline wherever fresh meets stink
      ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(2, T * 0.16); ctx.lineCap = 'round';
      ctx.beginPath();
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (cells[r * cols + c]) continue;
        const x = c * T, y = r * T;
        if (filled(c, r - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + T, y); }
        if (filled(c, r + 1)) { ctx.moveTo(x, y + T); ctx.lineTo(x + T, y + T); }
        if (filled(c - 1, r)) { ctx.moveTo(x, y); ctx.lineTo(x, y + T); }
        if (filled(c + 1, r)) { ctx.moveTo(x + T, y); ctx.lineTo(x + T, y + T); }
      }
      ctx.stroke();
    }
    function flower(x, y, s, mid) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(63,35,12,0.55)'; ctx.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        const a = k * 1.2566 - 1.57;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = mid === '#fff' ? '#E4508F' : mid;
      ctx.beginPath(); ctx.arc(x, y, s * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    // A wall still spraying: gold bar, white mist at the nozzle end
    function drawWall(now) {
      const w = g.wall;
      if (!w) return;
      w.halves.forEach(h => {
        if (h.dead || h.len <= 0) return;
        const a = h.from, b = h.from + h.sign * h.len; // cell-unit edges along the wall
        const lo = Math.min(a, b), hi = Math.max(a, b);
        let x, y, ww, hh;
        if (w.dir === 'h') { x = lo * T; y = w.r * T + T * 0.18; ww = (hi - lo) * T; hh = T * 0.64; }
        else { x = w.c * T + T * 0.18; y = lo * T; ww = T * 0.64; hh = (hi - lo) * T; }
        ctx.fillStyle = GOLD; ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(2, T * 0.12);
        ctx.beginPath(); rrect(x, y, ww, hh, T * 0.3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        if (w.dir === 'h') ctx.fillRect(x + T * 0.2, y + hh * 0.2, Math.max(0, ww - T * 0.4), hh * 0.18);
        else ctx.fillRect(x + ww * 0.2, y + T * 0.2, ww * 0.18, Math.max(0, hh - T * 0.4));
        if (!h.done) {
          // mist puffs at the tip
          const tx = w.dir === 'h' ? b * T : w.c * T + T / 2, ty = w.dir === 'h' ? w.r * T + T / 2 : b * T;
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          for (let k = 0; k < 4; k++) {
            const j = Math.sin(now / 60 + k * 2.1) * T * 0.25;
            const ox = w.dir === 'h' ? h.sign * k * T * 0.18 : j, oy = w.dir === 'h' ? j : h.sign * k * T * 0.18;
            ctx.beginPath(); ctx.arc(tx + ox, ty + oy, T * (0.32 - k * 0.05), 0, Math.PI * 2); ctx.fill();
          }
        }
      });
    }
    function rrect(x, y, w, h, rad) {
      rad = Math.min(rad, w / 2, h / 2);
      ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
    }
    // A fart cloud: puffs with one outline, googly eyes looking where it's heading, cheeky grin
    const PUFFS = [[0, -0.55, 0.62], [0.55, -0.25, 0.58], [0.5, 0.35, 0.56], [-0.05, 0.5, 0.6], [-0.55, 0.3, 0.56], [-0.6, -0.25, 0.55], [0, 0, 0.7]];
    function drawCloud(k, now) {
      const x = k.x * T, y = k.y * T, s = k.r * T * 1.15;
      const alpha = k.sbd ? 0.12 + 0.88 * Math.max(0, Math.sin(now / 900 + k.phase)) ** 2 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      const wob = still ? 0 : 0.05;
      const pr = (p, n) => s * p[2] * (1 + wob * Math.sin(now / 180 + n * 1.7 + k.phase));
      ctx.fillStyle = OUT;
      PUFFS.forEach((p, n) => { ctx.beginPath(); ctx.arc(x + p[0] * s, y + p[1] * s, pr(p, n) + Math.max(1.5, T * 0.11), 0, Math.PI * 2); ctx.fill(); });
      const grad = ctx.createLinearGradient(0, y - s, 0, y + s);
      grad.addColorStop(0, GAS[0]); grad.addColorStop(1, GAS[1]);
      ctx.fillStyle = grad;
      PUFFS.forEach((p, n) => { ctx.beginPath(); ctx.arc(x + p[0] * s, y + p[1] * s, pr(p, n), 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.ellipse(x - s * 0.35, y - s * 0.6, s * 0.22, s * 0.09, -0.4, 0, Math.PI * 2); ctx.fill();
      // eyes
      const sp = Math.hypot(k.vx, k.vy) || 1, lx = k.vx / sp, ly = k.vy / sp;
      [-1, 1].forEach(side => {
        const ex = x + side * s * 0.27, ey = y - s * 0.08, rx = s * 0.22, ry = s * 0.26;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.2, T * 0.07);
        ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const px = ex + lx * rx * 0.4, py = ey + ly * ry * 0.4;
        ctx.fillStyle = DARK; ctx.beginPath(); ctx.arc(px, py, rx * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px + rx * 0.18, py - rx * 0.2, rx * 0.16, 0, Math.PI * 2); ctx.fill();
      });
      // grin
      ctx.fillStyle = DARK; ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.2, T * 0.07);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.36, y + s * 0.24);
      ctx.quadraticCurveTo(x, y + s * 0.78, x + s * 0.4, y + s * 0.18);
      ctx.quadraticCurveTo(x, y + s * 0.38, x - s * 0.36, y + s * 0.24);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    function draw(now) {
      if (!g.cells || !W) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRoom(now);
      drawWall(now);
      g.clouds.forEach(k => drawCloud(k, now));
      g.parts.forEach(q => {
        ctx.globalAlpha = Math.max(0, Math.min(1, q.life * 2));
        if (q.kind === 'flower') flower(q.x * T, q.y * T, T * 0.2, GOLD);
        else {
          ctx.fillStyle = q.kind === 'gas' ? '#9BD24A' : '#fff';
          ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(q.x * T, q.y * T, q.r * T, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      });
    }

    function renderHud() {
      const room = String(g.lv + 1), cans = String(g.cans), paid = '$' + (hourly() * g.secs / 3600).toFixed(2);
      if (hud.room !== room) el.room.textContent = hud.room = room;
      if (hud.cans !== cans) { el.cans.textContent = hud.cans = cans; el.cans.style.color = g.cans <= 1 ? '#e5484d' : ''; }
      if (hud.paid !== paid) el.paid.textContent = hud.paid = paid;
      const pct = Math.floor(g.pct);
      if (hud.pct !== pct) {
        hud.pct = pct;
        el.freshLbl.textContent = 'Fresh ' + pct + '% / ' + g.L.target + '%';
        el.fresh.style.width = Math.min(100, pct) + '%';
        el.fresh.classList.toggle('done', pct >= g.L.target);
      }
      if (hud.goal !== g.L.target) { el.goal.style.left = g.L.target + '%'; hud.goal = g.L.target; }
    }
    function renderDir() {
      el.dir.innerHTML = (g.dir === 'h' ? H_ICON : V_ICON) + `<span>${g.dir === 'h' ? 'Across' : 'Down'}</span>`;
    }
    function renderMute() { el.mute.textContent = sound.muted ? '🔇' : '🔊'; }
    function say(key) {
      el.say.textContent = SAY[key] ? pick(SAY[key]) : key;
      el.spritz.classList.remove('talk'); void el.spritz.offsetWidth; el.spritz.classList.add('talk');
    }
    function pop(text, bad) {
      const p = document.createElement('div');
      p.className = 'gt-pop' + (bad ? ' bad' : '');
      p.textContent = text;
      el.stage.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }

    // ── GAME ──
    function freshPct() {
      let n = 0;
      for (let r = 1; r < g.rows - 1; r++) for (let c = 1; c < g.cols - 1; c++) if (g.cells[r * g.cols + c]) n++;
      return n / g.inner * 100;
    }
    function spawnClouds(L) {
      const list = [];
      const total = L.clouds + (L.big || 0);
      for (let n = 0; n < total; n++) {
        const big = n >= L.clouds;
        const r = big ? R * 2 : R;
        let x, y, tries = 0;
        do {
          x = 1 + r + Math.random() * (g.cols - 2 - 2 * r);
          y = 1 + r + Math.random() * (g.rows - 2 - 2 * r);
          tries++;
        } while (tries < 50 && list.some(k => Math.hypot(k.x - x, k.y - y) < k.r + r + 1.5));
        // Always on a diagonal so nobody gets a cloud that only bounces up and down
        const a = (Math.PI / 180) * (25 + Math.random() * 40) + rnd(4) * Math.PI / 2;
        const v = L.speed * (big ? 0.6 : 1) * (0.9 + Math.random() * 0.2);
        list.push({ x, y, r, hb: r * 0.85, vx: Math.cos(a) * v, vy: Math.sin(a) * v, sbd: n < (L.sbd || 0), phase: Math.random() * 6.28, big });
      }
      return list;
    }

    function startLevel(i) {
      sound.init();
      clearTimeout(endTimer);
      g.lv = i; g.L = LEVELS[i];
      g.cols = COLS; g.rows = roomRows();
      g.cells = makeRoom(g.cols, g.rows);
      g.inner = (g.cols - 2) * (g.rows - 2);
      g.clouds = spawnClouds(g.L);
      g.wall = null; g.cans = g.L.cans; g.lost = 0; g.secs = 0; g.pct = 0; g.parts = [];
      g.sparked = new Uint8Array(g.cells.length);
      el.screen.hidden = true;
      el.stage.classList.remove('shake');
      el.spritz.innerHTML = spritz();
      g.state = 'play';
      hud = {};
      renderHud();
      layout();
      say(g.L.sbd ? 'sbd' : g.L.big ? 'big' : g.L.clouds >= 5 ? 'hotbox' : 'start');
      startLoop();
    }

    // Start spraying from cell (c, r). Both halves grow out from the middle of that cell.
    function spray(c, r, dir) {
      if (g.state !== 'play') return;
      if (g.wall) { sound.nope(); say('busy'); return; }
      if (filled(c, r)) { sound.nope(); return; }
      const along = dir === 'h' ? c : r;
      g.wall = {
        dir, c, r, age: 0,
        halves: [
          { sign: -1, from: along + 0.5, len: 0, done: false, dead: false },
          { sign: 1, from: along + 0.5, len: 0, done: false, dead: false },
        ],
      };
      sound.hiss(0.6); buzz(10);
    }
    // The cells a half covers right now (whole cells only once they're finished)
    function halfCells(w, h, whole) {
      const out = [], a = h.from, b = h.from + h.sign * h.len;
      const lo = Math.floor(Math.min(a, b) + (whole ? 0 : 1e-6)), hi = Math.ceil(Math.max(a, b) - 1e-6);
      for (let k = lo; k < hi; k++) out.push(w.dir === 'h' ? [k, w.r] : [w.c, k]);
      return out;
    }
    function hitsHalf(k, w, h) {
      if (h.dead || h.done || h.len <= 0) return false;
      // The whole starting cell counts, because it gets filled by whichever half finishes
      const a = h.from, b = h.from + h.sign * h.len, start = Math.floor(h.from);
      const lo = Math.min(a, b, start), hi = Math.max(a, b, start + 1);
      const s = k.hb;
      if (w.dir === 'h') return k.x + s > lo && k.x - s < hi && k.y + s > w.r && k.y - s < w.r + 1;
      return k.y + s > lo && k.y - s < hi && k.x + s > w.c && k.x - s < w.c + 1;
    }
    function fizzle(w, h) {
      h.dead = true;
      g.cans--; g.lost++;
      sound.fart(); buzz([60, 30, 60]);
      const tipA = h.from + h.sign * h.len;
      for (let n = 0; n < 10; n++) {
        const t = h.from + (tipA - h.from) * Math.random();
        const x = w.dir === 'h' ? t : w.c + 0.5, y = w.dir === 'h' ? w.r + 0.5 : t;
        g.parts.push({ kind: 'gas', x, y, r: 0.2 + Math.random() * 0.25, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4 - 1, life: 0.7 + Math.random() * 0.4 });
      }
      if (!still) { el.stage.classList.remove('shake'); void el.stage.offsetWidth; el.stage.classList.add('shake'); }
      el.spritz.innerHTML = spritz(true);
      setTimeout(() => { if (alive && g.state === 'play') el.spritz.innerHTML = spritz(); }, 1400);
      if (g.cans <= 0) { lose(); return; }
      pop('Fizzled!', true);
      say(g.cans === 1 ? 'last' : 'fizzle');
    }
    function finishHalf(w, h) {
      h.done = true;
      halfCells(w, h, true).forEach(([c, r]) => { if (!filled(c, r)) g.cells[r * g.cols + c] = 1; });
      const before = g.pct;
      const got = capture(g.cells, g.cols, g.rows, g.clouds);
      g.pct = freshPct();
      if (got > 0) {
        sound.trap(); buzz(15);
        const gain = Math.round(g.pct - before);
        if (gain >= 1) pop('+' + gain + '%');
        sparkle();
        say('trap');
      } else sound.boing();
    }
    // Flowers burst out of freshly freshened floor
    function sparkle() {
      const spots = [];
      for (let i = 0; i < g.cells.length; i++) if (g.cells[i] === 2 && !g.sparked[i]) { g.sparked[i] = 1; spots.push(i); }
      for (let n = 0; n < Math.min(14, spots.length); n++) {
        const i = spots[rnd(spots.length)];
        g.parts.push({ kind: 'flower', x: (i % g.cols) + 0.5, y: Math.floor(i / g.cols) + 0.5, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2, life: 0.8 });
      }
    }

    function moveCloud(k, dt) {
      const blocked = (x, y) => {
        const c0 = Math.floor(x - k.hb), c1 = Math.floor(x + k.hb - 1e-6), r0 = Math.floor(y - k.hb), r1 = Math.floor(y + k.hb - 1e-6);
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (filled(c, r)) return true;
        return false;
      };
      const steps = Math.max(1, Math.ceil(Math.hypot(k.vx, k.vy) * dt / 0.25));
      const sdt = dt / steps;
      for (let s = 0; s < steps; s++) {
        const nx = k.x + k.vx * sdt;
        if (blocked(nx, k.y)) k.vx = -k.vx; else k.x = nx;
        const ny = k.y + k.vy * sdt;
        if (blocked(k.x, ny)) k.vy = -k.vy; else k.y = ny;
      }
    }

    function tick(dt) {
      g.t += dt;
      if (g.state === 'play') {
        g.secs += dt;
        g.clouds.forEach(k => moveCloud(k, dt));
        const w = g.wall;
        if (w) {
          w.age += dt;
          for (const h of w.halves) {
            if (h.done || h.dead) continue;
            // Grow until the next cell along is already fresh
            h.len += GROW * dt;
            const tip = h.from + h.sign * h.len;
            const k = h.sign > 0 ? Math.floor(tip - 1e-6) : Math.floor(tip);
            const startCell = Math.floor(h.from);
            const cc = w.dir === 'h' ? [k, w.r] : [w.c, k];
            if (k !== startCell && filled(cc[0], cc[1])) {
              h.len = h.sign > 0 ? k - h.from : h.from - (k + 1);
            }
            // Did a cloud get there first?
            const hit = g.clouds.find(cl => hitsHalf(cl, w, h));
            if (hit) { fizzle(w, h); if (g.state !== 'play') return; continue; }
            if (k !== startCell && filled(cc[0], cc[1])) finishHalf(w, h);
          }
          if (w.halves.every(h => h.done || h.dead)) g.wall = null;
          if (g.pct >= g.L.target) { win(); return; }
        }
      }
      if (g.parts.length) {
        g.parts.forEach(q => { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 3 * dt; q.life -= dt; });
        g.parts = g.parts.filter(q => q.life > 0);
      }
    }

    function loop(now) {
      frame = null;
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tick(dt);
      renderHud();
      draw(now);
      if (g.state === 'play' || g.parts.length) frame = requestAnimationFrame(loop);
    }
    function startLoop() {
      last = performance.now();
      if (!frame) frame = requestAnimationFrame(loop);
    }

    const starsFor = lost => Math.max(1, 3 - lost);
    const starStr = n => '⭐'.repeat(n) + '<span style="opacity:0.25">' + '⭐'.repeat(3 - n) + '</span>';
    const progress = () => {
      const p = load(PROGRESS_KEY, null) || {};
      return { unlocked: p.unlocked || 0, stars: p.stars || [], best: p.best || [] };
    };
    const endButtons = (again, ghost) => `
        <button type="button" class="gt-btn${ghost ? ' ghost' : ''}" data-again>${again}</button>
        <button type="button" class="gt-link" data-levels>${GRID_ICON}All rooms</button>
        <button type="button" class="gt-link" data-exit>${BACK_ICON}Back to the bog timer</button>`;
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
      clearTimeout(endTimer);
      if (frame) { cancelAnimationFrame(frame); frame = null; }
      const p = progress();
      const open = i => preview || i <= p.unlocked;
      el.screen.innerHTML = `
        <div class="gt-hero bob"><img class="game-hero-art" src="icons/games/gas-trap.svg" alt="" width="112" height="112"></div>
        <div class="gt-title">Gas Trap</div>
        <div class="gt-sub">Box in the farts. Freshen the room.</div>
        <div class="gt-levels">
          ${LEVELS.map((L, i) => `<button type="button" class="gt-level" data-lv="${i}" ${open(i) ? '' : 'disabled'}>
            <div class="gt-level-n">${i + 1}</div>
            <div class="gt-level-t"><b>${L.name}</b><span>${open(i) ? L.sub + (p.best[i] ? ' · best ' + clock(p.best[i]) : '') : '🔒 Clear room ' + i + ' first'}</span></div>
            <div class="gt-stars">${p.stars[i] ? starStr(p.stars[i]) : ''}</div>
            ${open(i) ? `<div class="gt-play">Play ${PLAY_ICON}</div>` : '<div class="gt-play locked" aria-label="Locked">🔒</div>'}
          </button>`).join('')}
        </div>
        <div class="gt-box" style="margin-top:8px">
          <div class="gt-lbl" style="margin-bottom:6px">Instructions</div>
          <div class="gt-instr-text">Swipe across or down the room to spray a wall of air freshener. It sprays out both ways from your finger.</div>
          <div class="gt-instr-text">When a wall closes, any floor with no fart cloud in it gets freshened. Freshen enough of the room to clear it.</div>
          <div class="gt-instr-text">If a cloud touches a wall while it's still spraying, it fizzles and you lose a can. Lose them all and you're gassed out.</div>
        </div>`;
      el.screen.hidden = false;
      el.screen.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => startLevel(+b.dataset.lv); });
    }

    function win() {
      g.state = 'won';
      g.wall = null;
      const total = Math.max(1, Math.round(g.secs));
      const stars = starsFor(g.lost);
      const p = progress();
      p.stars[g.lv] = Math.max(p.stars[g.lv] || 0, stars);
      const record = !p.best[g.lv] || total < p.best[g.lv];
      if (record) p.best[g.lv] = total;
      p.unlocked = Math.max(p.unlocked, Math.min(g.lv + 1, LEVELS.length - 1));
      save(PROGRESS_KEY, p);
      sound.win(); buzz([30, 60, 30]);
      say('win');
      sparkle();
      const more = g.lv + 1 < LEVELS.length;
      const paid = '$' + (hourly() * g.secs / 3600).toFixed(2);
      const pct = Math.floor(g.pct);
      endTimer = setTimeout(() => {
        if (!alive) return;
        el.screen.innerHTML = `
          <div class="gt-hero bob">${spritz()}</div>
          <div class="gt-title">Freshened!</div>
          <div class="gt-sub">Room ${g.lv + 1} · ${g.L.name}</div>
          <div class="gt-bigstars">${starStr(stars)}</div>
          <div class="gt-box">
            <div class="gt-lbl" style="margin-bottom:4px">Scent report</div>
            <div class="gt-row"><span>Room freshened</span><b>${pct}%</b></div>
            <div class="gt-row"><span>Clouds trapped</span><b>${g.clouds.length}</b></div>
            <div class="gt-row"><span>Cans fizzled</span><b>${g.lost}</b></div>
            <div class="gt-row"><span>Time</span><b>${clock(total)}${record ? ' · record' : ''}</b></div>
            <div class="gt-row total"><span>Paid to play</span><b>${paid}</b></div>
          </div>
          ${more ? `<button type="button" class="gt-btn" data-next>${PLAY_ICON} Next room</button>` : ''}
          ${endButtons(more ? '↺ Do it again' : '↺ Play again', more)}`;
        wireEnd(on => { if (more) on('[data-next]', () => startLevel(g.lv + 1)); });
      }, 1100);
    }

    function lose() {
      g.state = 'lost';
      g.wall = null;
      sound.lose(); buzz([80, 40, 160]);
      const quip = pick(GASSED);
      el.say.textContent = quip;
      const paid = '$' + (hourly() * g.secs / 3600).toFixed(2);
      endTimer = setTimeout(() => {
        if (!alive) return;
        el.screen.innerHTML = `
          <div class="gt-hero">${spritz(true)}</div>
          <div class="gt-title">Gassed Out</div>
          <div class="gt-sub">Room ${g.lv + 1} · ${g.L.name}</div>
          <div class="gt-quip">${quip}</div>
          <div class="gt-box gt-grid">
            <div><div class="gt-lbl">Freshened</div><div class="gt-val">${Math.floor(g.pct)}%</div></div>
            <div><div class="gt-lbl">Paid to play</div><div class="gt-val green">${paid}</div></div>
            <div><div class="gt-lbl">Time</div><div class="gt-val">${clock(g.secs)}</div></div>
            <div><div class="gt-lbl">Needed</div><div class="gt-val">${g.L.target}%</div></div>
          </div>
          ${endButtons('↺ Have another go')}`;
        wireEnd();
      }, 900);
    }

    // ── INPUT ──
    // Swipe sets the direction and sprays from where the finger went down. A plain tap sprays
    // in the direction shown on the button.
    function cellAt(x, y) {
      const r = el.canvas.getBoundingClientRect();
      return [Math.floor((x - r.left) / T), Math.floor((y - r.top) / T)];
    }
    function onDown(e) {
      if (g.state !== 'play') return;
      e.preventDefault();
      sound.init();
      touch = { id: e.pointerId, x: e.clientX, y: e.clientY, used: false };
      try { el.canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMove(e) {
      if (!touch || touch.used || e.pointerId !== touch.id) return;
      const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
      if (Math.hypot(dx, dy) < Math.max(12, T * 0.7)) return;
      touch.used = true;
      g.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      renderDir();
      const [c, r] = cellAt(touch.x, touch.y);
      spray(c, r, g.dir);
    }
    function onUp(e) {
      if (!touch || e.pointerId !== touch.id) return;
      const t = touch;
      touch = null;
      if (t.used || g.state !== 'play') return;
      const [c, r] = cellAt(t.x, t.y);
      spray(c, r, g.dir);
    }
    function flip() { g.dir = g.dir === 'h' ? 'v' : 'h'; renderDir(); }
    function onKey(e) {
      if (e.key === 'Escape' && opts.onExit) opts.onExit();
      else if (e.key === ' ' && g.state === 'play') { e.preventDefault(); flip(); }
    }
    // Phone locked or app switched mid-room: stop, then wait for a tap so nobody comes back to a fizzled can
    function onVisible() {
      if (g.state !== 'play') return;
      if (document.visibilityState === 'hidden') { if (frame) cancelAnimationFrame(frame); frame = null; return; }
      if (window.GIPause) window.GIPause(root, () => { if (alive) startLoop(); }); else startLoop();
    }

    el.mute.onclick = () => { sound.muted = !sound.muted; save(MUTE_KEY, sound.muted); sound.init(); renderMute(); };
    el.dir.onclick = flip;
    el.canvas.addEventListener('pointerdown', onDown);
    el.canvas.addEventListener('pointermove', onMove);
    el.canvas.addEventListener('pointerup', onUp);
    el.canvas.addEventListener('pointercancel', () => { touch = null; });
    el.canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisible);
    const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
    if (ro) ro.observe(el.stage); else window.addEventListener('resize', layout);

    renderMute();
    renderDir();
    titleScreen();

    return {
      destroy() {
        alive = false;
        if (sound.ac && sound.ac.state === 'running') sound.ac.suspend().catch(() => {});
        if (frame) cancelAnimationFrame(frame);
        clearTimeout(endTimer);
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisible);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', layout);
        root.innerHTML = '';
      },
      _test: { g, spray, tick, start: i => startLevel(i), capture },
    };
  }

  window.GasTrap = { mount, LEVELS, _capture: capture, _makeRoom: makeRoom };
})();
