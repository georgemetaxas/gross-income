// ══ TURDLE ══
// Newspaper-style word search where every word is toilet talk. Easy is the
// school-yard stuff (poo, wee, bum), hard is the stuff your GP says (colonoscopy).
// Loaded only when someone opens it.
//
// window.Turdle.mount(el, { hourly: () => number, onExit: () => void })
// draws the game into el and returns { destroy() }.
(function () {
  // Every word gets a one-liner, shown when it's found and on the win screen.
  // No word may sit inside another in the same level (POO in POOP), or it'd be found twice.
  const EASY = [
    ['POO', 'the main event'], ['WEE', 'the opening act'], ['BUM', 'where it all happens'],
    ['LOO', 'posh for dunny'], ['BOG', 'your office for the next ten minutes'], ['FART', "a bum's way of saying hello"],
    ['TURD', 'a solid effort'], ['PLOP', 'the sound of success'], ['FLUSH', 'goodbye, old friend'],
    ['POTTY', 'where it all began'], ['DUNNY', 'Aussie for the throne room'], ['WIPE', 'front to back, please'],
    ['STINK', 'light a match'], ['THRONE', "you're on it right now"], ['TOILET', 'the porcelain god'],
    ['SQUAT', 'how nature intended'],
  ];
  const MEDIUM = [
    ['PLUNGER', "the bog's defibrillator"], ['BIDET', 'a fountain for your bum'], ['URINAL', 'stand and deliver'],
    ['CISTERN', 'the tank behind you'], ['SEWAGE', 'where it all ends up'], ['SKIDMARK', 'undie evidence'],
    ['PRUNES', "nature's laxative"], ['FIBRE', 'keeps things moving'], ['STOOL', 'doctor speak for poo'],
    ['BLOATED', 'a fart in waiting'], ['GASSY', 'chilli last night?'], ['SPLASHBACK', 'the bounce nobody wants'],
    ['DUMP', 'best taken on company time'], ['LOOROLL', 'never, ever run out'], ['PORCELAIN', "the throne's finest"],
  ];
  const HARD = [
    ['COLONOSCOPY', 'a camera tour of your back passage'], ['HAEMORRHOID', "a grape you didn't ask for"],
    ['DIARRHOEA', 'code brown'], ['CONSTIPATION', 'the great backlog'], ['PERISTALSIS', "your gut's slow-mo Mexican wave"],
    ['FLATULENCE', 'a fart in a lab coat'], ['SPHINCTER', 'the bouncer on the back door'], ['RECTUM', 'last stop before the bowl'],
    ['LAXATIVE', 'an eviction notice'], ['DEFECATE', "doctor for 'drop the kids off'"], ['ENEMA', 'the reverse flush'],
    ['DYSENTERY', 'you have died of...'], ['INTESTINE', 'seven-odd metres of plumbing'], ['PROCTOLOGIST', 'a bum doctor, literally'],
    ['FAECES', 'poo with a degree'], ['GASTRO', 'the bug that empties both ends'], ['DINGLEBERRY', 'clinging on for dear life'],
  ];
  // [row step, col step]: across, down, diagonal down, diagonal up, then the four backwards ones
  const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
  // Add a level by adding a line. dirs = how many of DIRS words can run in,
  // decoy = how often the filler letters are borrowed from the hidden words (makes it harder),
  // par = seconds for 3 stars (2 stars inside double).
  const LEVELS = [
    { name: 'Number One', size: 8, count: 6, dirs: 2, decoy: 0.15, par: 75, words: EASY, sub: 'Across and down · toilet talk' },
    { name: 'Number Two', size: 10, count: 8, dirs: 4, decoy: 0.35, par: 150, words: MEDIUM, sub: 'Diagonals join in · bathroom basics' },
    { name: 'Code Brown', size: 12, count: 8, dirs: 8, decoy: 0.55, par: 270, words: HARD, sub: 'Every way, even backwards · GP words' },
  ];
  const HINT_SECS = 15;
  const INKS = ['245,200,66', '76,175,110', '79,163,247', '255,122,168', '224,123,0', '160,120,230', '93,205,190', '230,82,91'];
  const PROGRESS_KEY = 'gi.turdle.v1';
  const MUTE_KEY = 'gi.turdle.muted';
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

  // ── PUZZLE ──
  // Longest words go in first. Filler letters can't spell a hidden word a second time.
  function makePuzzle(L) {
    const N = L.size, dirs = DIRS.slice(0, L.dirs);
    const pick = shuffle(L.words.slice()).slice(0, L.count).sort((a, b) => b[0].length - a[0].length);
    const letters = pick.map(w => w[0]).join('');
    const count = (grid, w) => {
      let n = 0;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of DIRS) {
        let k = 0;
        while (k < w.length) {
          const rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr >= N || cc < 0 || cc >= N || grid[rr][cc] !== w[k]) break;
          k++;
        }
        if (k === w.length) n++;
      }
      return n;
    };
    for (let attempt = 0; attempt < 80; attempt++) {
      const grid = Array.from({ length: N }, () => Array(N).fill(null));
      const placed = [];
      const ok = pick.every(([w, blurb]) => {
        for (let t = 0; t < 300; t++) {
          const [dr, dc] = dirs[rnd(dirs.length)];
          const r = rnd(N), c = rnd(N), er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
          if (er < 0 || er >= N || ec < 0 || ec >= N) continue;
          let fits = true;
          for (let k = 0; k < w.length && fits; k++) { const ch = grid[r + dr * k][c + dc * k]; fits = ch === null || ch === w[k]; }
          if (!fits) continue;
          for (let k = 0; k < w.length; k++) grid[r + dr * k][c + dc * k] = w[k];
          placed.push({ w, blurb, r, c, er, ec, found: -1 });
          return true;
        }
        return false;
      });
      if (!ok) continue;
      for (let fill = 0; fill < 6; fill++) {
        const g = grid.map(row => row.map(ch => ch || (Math.random() < L.decoy ? letters[rnd(letters.length)] : String.fromCharCode(65 + rnd(26)))));
        if (placed.every(p => count(g, p.w) === 1)) {
          // Word list shows in A–Z order, like the paper
          return { grid: g, words: placed.sort((a, b) => a.w.localeCompare(b.w)) };
        }
      }
    }
    return null;
  }

  const CSS = `
  .td { position: relative; display: flex; flex-direction: column; height: 100%;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; color: var(--cream, #f5ead6); }
  .td-hud { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; padding: 10px 14px;
    background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 16px; }
  .td-stat { flex: 1; min-width: 0; }
  .td-lbl { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; color: var(--muted, #a08060); text-transform: uppercase; }
  .td-val { font-family: 'Bebas Neue', sans-serif; font-size: 24px; line-height: 1.05; letter-spacing: 1px; }
  .td-val.green { color: var(--green, #4caf6e); }
  .td-mute { background: none; border: 1px solid rgba(245,200,66,0.2); border-radius: 50%; width: 36px; height: 36px;
    font-size: 16px; cursor: pointer; flex-shrink: 0; }
  .td-stage { flex: 1; min-height: 0; position: relative; display: flex; align-items: flex-start; justify-content: center; }
  .td-paper { background: #f5ead6; border-radius: 10px; padding: 6px 6px 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
  .td-mast { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; color: #2a1d0c;
    border-bottom: 2px solid #2a1d0c; margin: 0 2px 4px; padding-bottom: 2px; }
  .td-mast b { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 18px; letter-spacing: 2px; }
  .td-mast span { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.7; white-space: nowrap; }
  .td-paper canvas { display: block; touch-action: none; }
  .td-toast { position: absolute; left: 50%; top: 0; transform: translateX(-50%); pointer-events: none; max-width: 94%;
    background: #1a1208; border: 1.5px solid #f5c842; color: var(--cream, #f5ead6); border-radius: 14px; padding: 7px 14px;
    font-size: 13px; line-height: 1.3; text-align: center; box-shadow: 0 6px 20px rgba(0,0,0,0.5); }
  .td-toast b { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 19px; letter-spacing: 1.5px; color: #f5c842; margin-right: 6px; }
  .td-toast[hidden] { display: none; }
  .td-words { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px 6px; padding: 10px 0 6px; flex-shrink: 0; }
  .td-chip { font-family: 'DM Mono', monospace; font-weight: 500; font-size: 12px; letter-spacing: 1px; padding: 4px 9px; border-radius: 9px;
    background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.3); }
  .td-chip.found { text-decoration: line-through; text-decoration-thickness: 2px; color: #1a1208; border-color: transparent; }
  .td-bar { display: flex; gap: 8px; flex-shrink: 0; }
  .td-hint { flex: 1; background: transparent; color: var(--gold, #f5c842); border: 1.5px solid rgba(245,200,66,0.5); border-radius: 12px;
    font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; padding: 9px; cursor: pointer; }
  .td-hint:disabled { opacity: 0.35; cursor: default; }
  .td-screen { position: absolute; inset: 0; z-index: 2; background: var(--bg, #1a1208); overflow-y: auto;
    display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 4px; }
  .td-screen > :first-child { margin-top: auto; }
  .td-screen > :last-child { margin-bottom: auto; }
  .td-screen[hidden] { display: none; }
  .td-hero { font-size: 72px; line-height: 1; filter: drop-shadow(0 0 24px rgba(245,200,66,0.45)); }
  .td-title { font-family: 'Bebas Neue', sans-serif; font-size: 68px; line-height: 0.95; color: var(--gold, #f5c842); margin-top: 6px; }
  .td-sub { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin: 8px 0 14px; }
  .td-box { width: 100%; background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 20px;
    padding: 12px 14px; text-align: left; margin-bottom: 12px; }
  .td-instr-text { font-size: 14px; line-height: 1.5; margin: 0 0 4px; }
  .td-levels { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-bottom: 4px; }
  .td-level { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer;
    background: var(--surface, #231a0a); border: 1.5px solid rgba(245,200,66,0.45); border-radius: 16px; padding: 10px 14px; color: inherit; }
  .td-level:disabled { opacity: 0.4; cursor: default; border-color: rgba(224,123,0,0.25); }
  .td-level-n { font-family: 'Bebas Neue', sans-serif; font-size: 34px; color: var(--gold, #f5c842); width: 26px; text-align: center; }
  .td-level-t { flex: 1; min-width: 0; }
  .td-level-t b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 21px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; }
  .td-level-t span { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted, #a08060); }
  .td-stars { font-size: 14px; letter-spacing: 0; white-space: nowrap; }
  .td-play { flex-shrink: 0; min-width: 64px; text-align: center; background: var(--gold, #f5c842); color: #1a1208; border-radius: 10px;
    padding: 8px 12px; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; line-height: 1; white-space: nowrap; }
  .td-play.locked { background: none; color: var(--muted, #a08060); border: 1px solid rgba(224,123,0,0.35); letter-spacing: 0; font-size: 15px; }
  .td-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
  .td-grid .td-val { font-size: 32px; }
  .td-learned { display: flex; flex-direction: column; gap: 6px; }
  .td-learned div { font-size: 13px; line-height: 1.35; }
  .td-learned b { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: 18px; letter-spacing: 1.5px; color: var(--gold, #f5c842); margin-right: 6px; }
  .td-bigstars { font-size: 40px; letter-spacing: 6px; margin: 2px 0 10px; }
  .td-btn { width: 100%; border: none; border-radius: 16px; background: var(--gold, #f5c842); color: #1a1208;
    font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 3px; padding: 14px; cursor: pointer; margin-top: 4px; }
  .td-btn.ghost { background: transparent; color: var(--gold, #f5c842); border: 1.5px solid rgba(245,200,66,0.6); margin-top: 10px; }
  .td-link { background: none; border: none; color: var(--muted, #a08060); font-family: 'DM Mono', monospace; font-size: 11px;
    letter-spacing: 1px; margin-top: 14px; cursor: pointer; text-decoration: underline; }
  `;

  function injectCss() {
    if (document.getElementById('td-style')) return;
    const s = document.createElement('style');
    s.id = 'td-style';
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
    tick() { this.tone(900, 900, 0.02, 'sine', 0.03); },
    nope() { this.tone(180, 120, 0.15, 'square', 0.04); },
    plop() { this.tone(320, 140, 0.12, 'sine', 0.12); },
    fart() { this.tone(95, 45, 0.5, 'sawtooth', 0.1, 28); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.18, 'triangle', 0.08), i * 120)); },
  };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  function mount(root, opts) {
    injectCss();
    const hourly = opts.hourly || (() => 0);
    root.innerHTML = `
      <div class="td">
        <div class="td-hud">
          <div class="td-stat"><div class="td-lbl">Found</div><div class="td-val" data-found>0/0</div></div>
          <div class="td-stat"><div class="td-lbl">Time</div><div class="td-val" data-time>0:00</div></div>
          <div class="td-stat"><div class="td-lbl">Paid to play</div><div class="td-val green" data-paid>$0.00</div></div>
          <button type="button" class="td-mute" data-mute aria-label="Sound"></button>
        </div>
        <div class="td-stage">
          <div class="td-paper">
            <div class="td-mast"><b>The Daily Dump</b><span data-mast></span></div>
            <canvas></canvas>
          </div>
          <div class="td-toast" hidden></div>
        </div>
        <div class="td-words" data-words></div>
        <div class="td-bar"><button type="button" class="td-hint" data-hint>💨 Sniff out a hint (+${HINT_SECS}s)</button></div>
        <div class="td-screen" data-screen></div>
      </div>`;
    const $ = sel => root.querySelector(sel);
    const el = {
      stage: $('.td-stage'), paper: $('.td-paper'), canvas: $('canvas'), toast: $('.td-toast'), screen: $('[data-screen]'),
      found: $('[data-found]'), time: $('[data-time]'), paid: $('[data-paid]'), mute: $('[data-mute]'),
      words: $('[data-words]'), hint: $('[data-hint]'), mast: $('[data-mast]'),
    };
    const ctx = el.canvas.getContext('2d');

    let T = 30, S = 0, dpr = 1;
    const g = {
      state: 'title', lv: 0, L: LEVELS[0], grid: [], words: [], secs: 0, penalty: 0, hints: 0,
      sel: null, tapStart: null, hintCell: null, hintUntil: 0, flash: null,
    };
    let alive = true, timer = 0, last = 0, toastTimer = 0, frame = null;

    // ── LAYOUT ──
    function layout() {
      if (!g.grid.length) return;
      const r = el.stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const N = g.L.size;
      // Room for the paper's padding and masthead
      T = Math.max(18, Math.floor(Math.min(r.width - 14, r.height - 44) / N));
      S = T * N;
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      el.canvas.width = S * dpr; el.canvas.height = S * dpr;
      el.canvas.style.width = S + 'px'; el.canvas.style.height = S + 'px';
      draw();
    }

    // ── DRAW ──
    const centre = (r, c) => [(c + 0.5) * T, (r + 0.5) * T];
    function stroke(r0, c0, r1, c1, fill) {
      const [x0, y0] = centre(r0, c0), [x1, y1] = centre(r1, c1);
      ctx.strokeStyle = fill; ctx.lineWidth = T * 0.78; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + 0.01, y1); ctx.stroke();
    }
    function draw() {
      frame = null;
      if (!alive || !g.grid.length) return;
      const N = g.L.size, now = performance.now();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, S, S);
      g.words.forEach(p => { if (p.found >= 0) stroke(p.r, p.c, p.er, p.ec, `rgba(${INKS[p.found % INKS.length]},0.55)`); });
      if (g.flash && now < g.flash.until) {
        const f = g.flash, a = 0.5 * (f.until - now) / 400;
        stroke(f.r0, f.c0, f.r1, f.c1, `rgba(230,82,91,${a.toFixed(2)})`);
      }
      if (g.sel) stroke(g.sel.r0, g.sel.c0, g.sel.r1, g.sel.c1, 'rgba(224,123,0,0.45)');
      const ring = (r, c, color) => {
        const [x, y] = centre(r, c);
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, T * 0.08);
        ctx.beginPath(); ctx.arc(x, y, T * 0.4, 0, Math.PI * 2); ctx.stroke();
      };
      if (g.tapStart) ring(g.tapStart[0], g.tapStart[1], '#e07b00');
      if (g.hintCell && now < g.hintUntil) {
        const pulse = still ? 1 : 0.6 + 0.4 * Math.sin(now / 120);
        ring(g.hintCell[0], g.hintCell[1], `rgba(76,175,110,${pulse.toFixed(2)})`);
      }
      ctx.fillStyle = '#2a1d0c';
      ctx.font = `500 ${Math.round(T * 0.56)}px 'DM Mono', monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const [x, y] = centre(r, c);
        ctx.fillText(g.grid[r][c], x, y + T * 0.03);
      }
      // Keep animating while the hint pulses or a miss fades
      if ((g.hintCell && now < g.hintUntil) || (g.flash && now < g.flash.until)) frame = requestAnimationFrame(draw);
    }
    const redraw = () => { if (!frame) frame = requestAnimationFrame(draw); };

    function renderHud() {
      const found = g.words.filter(p => p.found >= 0).length;
      el.found.textContent = found + '/' + g.words.length;
      el.time.textContent = clock(g.secs + g.penalty);
      el.paid.textContent = '$' + (hourly() * g.secs / 3600).toFixed(2);
    }
    function renderWords() {
      el.words.innerHTML = g.words.map(p => p.found >= 0
        ? `<span class="td-chip found" style="background:rgba(${INKS[p.found % INKS.length]},0.85)">${p.w}</span>`
        : `<span class="td-chip">${p.w}</span>`).join('');
    }
    function renderMute() { el.mute.textContent = sound.muted ? '🔇' : '🔊'; }

    function toast(html, ms) {
      clearTimeout(toastTimer);
      el.toast.innerHTML = html;
      el.toast.hidden = false;
      toastTimer = setTimeout(() => { el.toast.hidden = true; }, ms || 2600);
    }

    // ── GAME ──
    function startLevel(i) {
      sound.init();
      g.lv = i; g.L = LEVELS[i];
      const puzzle = makePuzzle(g.L);
      if (!puzzle) return;
      g.grid = puzzle.grid; g.words = puzzle.words;
      g.secs = 0; g.penalty = 0; g.hints = 0; g.sel = null; g.tapStart = null; g.hintCell = null; g.flash = null;
      el.mast.textContent = 'Puzzles · Lvl ' + (i + 1) + ' · ' + g.L.name;
      el.hint.disabled = false;
      el.toast.hidden = true;
      el.screen.hidden = true;
      g.state = 'play';
      renderWords();
      renderHud();
      layout();
      last = performance.now();
      clearInterval(timer);
      timer = setInterval(tickClock, 250);
    }

    function tickClock() {
      const now = performance.now();
      // A locked phone or a long pause doesn't count as time spent searching
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      if (g.state === 'play' && document.visibilityState === 'visible') g.secs += dt;
      renderHud();
    }

    // Letters along the line from (r0,c0) to (r1,c1)
    function lineText(s) {
      const n = Math.max(Math.abs(s.r1 - s.r0), Math.abs(s.c1 - s.c0));
      const dr = Math.sign(s.r1 - s.r0), dc = Math.sign(s.c1 - s.c0);
      let out = '';
      for (let k = 0; k <= n; k++) out += g.grid[s.r0 + dr * k][s.c0 + dc * k];
      return out;
    }

    function check(s) {
      if (s.r0 === s.r1 && s.c0 === s.c1) return;
      const text = lineText(s), back = text.split('').reverse().join('');
      const hit = g.words.find(p => p.found < 0 && (p.w === text || p.w === back));
      if (!hit) {
        if (text.length >= 3) {
          sound.nope();
          g.flash = { ...s, until: performance.now() + 400 };
          redraw();
        }
        return;
      }
      hit.found = g.words.filter(p => p.found >= 0).length;
      if (g.hintCell && g.hintCell[0] === hit.r && g.hintCell[1] === hit.c) g.hintCell = null;
      sound.plop(); buzz(25);
      toast(`<b>${hit.w}</b>${hit.blurb}`);
      renderWords();
      renderHud();
      redraw();
      if (g.words.every(p => p.found >= 0)) setTimeout(() => { if (alive && g.state === 'play') win(); }, 700);
    }

    function hint() {
      if (g.state !== 'play') return;
      sound.init();
      const left = g.words.filter(p => p.found < 0);
      if (!left.length) return;
      const p = left[rnd(left.length)];
      g.hintCell = [p.r, p.c];
      g.hintUntil = performance.now() + 4000;
      g.penalty += HINT_SECS; g.hints++;
      sound.fart();
      toast(`<b>💨</b>${p.w} starts at the green ring`, 2200);
      renderHud();
      redraw();
    }

    // ── SCREENS ──
    const progress = () => load(PROGRESS_KEY, { unlocked: 0, stars: [], best: [] });
    const starsFor = (L, secs) => secs <= L.par ? 3 : secs <= L.par * 2 ? 2 : 1;
    const starStr = n => '⭐'.repeat(n) + '<span style="opacity:0.25">' + '⭐'.repeat(3 - n) + '</span>';

    function titleScreen() {
      g.state = 'title';
      clearInterval(timer);
      const p = progress();
      const open = i => preview || i <= p.unlocked;
      el.screen.innerHTML = `
        <div class="td-hero">📰</div>
        <div class="td-title">Turdle</div>
        <div class="td-sub">The Daily Dump word search</div>
        <div class="td-levels">
          ${LEVELS.map((L, i) => `<button type="button" class="td-level" data-lv="${i}" ${open(i) ? '' : 'disabled'}>
            <div class="td-level-n">${i + 1}</div>
            <div class="td-level-t"><b>${L.name}</b><span>${open(i) ? L.sub + (p.best[i] ? ' · best ' + clock(p.best[i]) : '') : '🔒 Finish level ' + i + ' first'}</span></div>
            <div class="td-stars">${p.stars[i] ? starStr(p.stars[i]) : ''}</div>
            ${open(i) ? '<div class="td-play">Play ▶</div>' : '<div class="td-play locked" aria-label="Locked">🔒</div>'}
          </button>`).join('')}
        </div>
        <div class="td-box" style="margin-top:8px">
          <div class="td-lbl" style="margin-bottom:6px">Instructions</div>
          <div class="td-instr-text">Drag across the letters to circle a word, or tap its first letter then its last. Find every word on the list to wipe the page clean.</div>
          <div class="td-instr-text">Level 1 words run across and down. Level 2 adds diagonals. Level 3 goes every which way, even backwards.</div>
          <div class="td-instr-text">Stuck? 💨 Sniff out a hint, but it adds ${HINT_SECS} seconds. Finish under par for 3 stars.</div>
        </div>`;
      el.screen.hidden = false;
      el.screen.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => startLevel(+b.dataset.lv); });
    }

    function win() {
      g.state = 'over';
      clearInterval(timer);
      const total = Math.round(g.secs + g.penalty);
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
      el.screen.innerHTML = `
        <div class="td-hero">🧻</div>
        <div class="td-title">Wiped Clean!</div>
        <div class="td-sub">Level ${g.lv + 1} · ${g.L.name}</div>
        <div class="td-bigstars">${starStr(stars)}</div>
        <div class="td-box td-grid">
          <div><div class="td-lbl">Time</div><div class="td-val">${clock(total)}</div></div>
          <div><div class="td-lbl">Paid to play</div><div class="td-val green">${paid}</div></div>
          <div><div class="td-lbl">Hints</div><div class="td-val">${g.hints ? g.hints + ' · +' + g.hints * HINT_SECS + 's' : 'None'}</div></div>
          <div><div class="td-lbl">Level record?</div><div class="td-val" style="color:${record ? '#f5c842' : '#a08060'}">${record ? 'YES!' : 'Nah · ' + clock(p.best[g.lv])}</div></div>
        </div>
        <div class="td-box">
          <div class="td-lbl" style="margin-bottom:8px">Today's words</div>
          <div class="td-learned">${g.words.map(w => `<div><b>${w.w}</b>${w.blurb}</div>`).join('')}</div>
        </div>
        ${more ? '<button type="button" class="td-btn" data-next>▶ Next level</button>' : ''}
        <button type="button" class="td-btn ${more ? 'ghost' : ''}" data-again>↺ New puzzle</button>
        <button type="button" class="td-link" data-levels>All levels</button>
        <button type="button" class="td-link" data-exit style="margin-top:6px">Back to the bog timer</button>`;
      el.screen.hidden = false;
      el.screen.scrollTop = 0;
      const on = (sel, fn) => { const b = el.screen.querySelector(sel); if (b) b.onclick = fn; };
      if (more) on('[data-next]', () => startLevel(g.lv + 1));
      on('[data-again]', () => startLevel(g.lv));
      on('[data-levels]', titleScreen);
      on('[data-exit]', () => opts.onExit && opts.onExit());
    }

    // ── INPUT ──
    // Drag snaps to the nearest of the 8 directions. A tap without dragging marks
    // a start letter, and a second tap in line with it circles everything between.
    let down = null;
    function cellAt(e) {
      const r = el.canvas.getBoundingClientRect();
      const c = Math.floor((e.clientX - r.left) / T), rr = Math.floor((e.clientY - r.top) / T);
      const N = g.L.size;
      return rr >= 0 && rr < N && c >= 0 && c < N ? [rr, c] : null;
    }
    function snap(r0, c0, e) {
      const rect = el.canvas.getBoundingClientRect();
      const [x0, y0] = centre(r0, c0);
      const dx = e.clientX - rect.left - x0, dy = e.clientY - rect.top - y0;
      const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
      const dc = Math.round(Math.cos(a * Math.PI / 4)), dr = Math.round(Math.sin(a * Math.PI / 4));
      let n = Math.round(Math.max(Math.abs(dx), Math.abs(dy)) / T);
      const N = g.L.size;
      while (n > 0 && (r0 + dr * n < 0 || r0 + dr * n >= N || c0 + dc * n < 0 || c0 + dc * n >= N)) n--;
      return { r0, c0, r1: r0 + dr * n, c1: c0 + dc * n };
    }
    function onDown(e) {
      if (g.state !== 'play') return;
      const cell = cellAt(e);
      if (!cell) return;
      sound.init();
      down = { cell, moved: false };
      g.sel = { r0: cell[0], c0: cell[1], r1: cell[0], c1: cell[1] };
      try { el.canvas.setPointerCapture(e.pointerId); } catch (err) {}
      redraw();
    }
    function onMove(e) {
      if (!down) return;
      const s = snap(down.cell[0], down.cell[1], e);
      if (s.r1 !== g.sel.r1 || s.c1 !== g.sel.c1) {
        g.sel = s;
        down.moved = true;
        sound.tick();
        redraw();
      }
    }
    function onUp() {
      if (!down) return;
      const d = down, s = g.sel;
      down = null; g.sel = null;
      if (d.moved && (s.r0 !== s.r1 || s.c0 !== s.c1)) { g.tapStart = null; check(s); redraw(); return; }
      const [r, c] = d.cell, t = g.tapStart;
      if (t && (t[0] !== r || t[1] !== c)) {
        const dr = r - t[0], dc = c - t[1];
        if (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) {
          g.tapStart = null;
          check({ r0: t[0], c0: t[1], r1: r, c1: c });
          redraw();
          return;
        }
      }
      g.tapStart = t && t[0] === r && t[1] === c ? null : [r, c];
      redraw();
    }
    function onKey(e) { if (e.key === 'Escape' && opts.onExit) opts.onExit(); }
    function onVisible() { last = performance.now(); }

    el.mute.onclick = () => { sound.muted = !sound.muted; save(MUTE_KEY, sound.muted); sound.init(); renderMute(); };
    el.hint.onclick = hint;
    el.canvas.addEventListener('pointerdown', onDown);
    el.canvas.addEventListener('pointermove', onMove);
    el.canvas.addEventListener('pointerup', onUp);
    el.canvas.addEventListener('pointercancel', () => { down = null; g.sel = null; redraw(); });
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
        if (frame) cancelAnimationFrame(frame);
        clearInterval(timer);
        clearTimeout(toastTimer);
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisible);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', layout);
        root.innerHTML = '';
      },
      _test: { g, check, start: startLevel },
    };
  }

  window.Turdle = { mount, LEVELS, makePuzzle };
})();
