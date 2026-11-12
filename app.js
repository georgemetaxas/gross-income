  // The Poop Pool code further down this file declares `pool`; until it has run,
  // nobody is signed in (a plain read before then throws)
  function poolUser() { try { return pool.user; } catch (e) { return null; } }

  // ── CLICKS ──
  // Buttons name what they do in data-click ("fn" or "fn:arg", several split by spaces)
  // instead of inline onclick, which the Content-Security-Policy blocks.
  function hideParent(arg, el) { el.parentNode.hidden = true; }
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-click]');
    if (!el || el.disabled) return;
    for (const call of el.dataset.click.split(' ')) {
      const [fn, arg] = call.split(':');
      if (fn === 'hideParent') hideParent(arg, el);
      else if (typeof window[fn] === 'function') arg === undefined ? window[fn]() : window[fn](arg, el);
    }
  });
  document.addEventListener('submit', (e) => {
    const fn = e.target.dataset && e.target.dataset.submit;
    if (!fn) return;
    e.preventDefault();
    window[fn]();
  });

  // ── STATE ──
  let timerInterval = null;
  let seconds = 0;
  let running = false;
  let currentPeriod = 'year';
  let waveT = 0;
  let savedSalary = 0;
  let savedPeriod = 'year';
  let segmentStartSeconds = 0;
  let segmentStartedAt = null;
  let segmentStartMs = 0;

  // ── STORAGE ──
  // Everything stays on this device. Storage can be blocked (private mode),
  // so every read/write is guarded and the app still works without it.
  const SESSIONS_KEY = 'gi.sessions.v1';
  const SALARY_KEY = 'gi.salary.v1';
  // A bog in progress, so it survives the phone closing the app in the background
  const RUNNING_KEY = 'gi.running.v1';
  const MIN_SESSION_SECS = 5;

  function readJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function loadSessions() {
    const s = readJSON(SESSIONS_KEY, []);
    return Array.isArray(s) ? s : [];
  }

  // ── TABS ──
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentPeriod = tab.dataset.period;
    });
  });

  // ── SALARY INPUT FORMATTING ──
  const salaryInput = document.getElementById('salaryInput');
  salaryInput.addEventListener('input', (e) => {
    e.target.style.borderColor = '';
    const raw = e.target.value.replace(/[^\d]/g, '');
    const cursor = e.target.selectionStart;
    const prevLen = e.target.value.length;
    if (raw === '') { e.target.value = ''; return; }
    const formatted = Number(raw).toLocaleString('en-US');
    e.target.value = formatted;
    const diff = formatted.length - prevLen;
    e.target.setSelectionRange(cursor + diff, cursor + diff);
  });

  function getSalaryRaw() {
    return parseFloat(salaryInput.value.replace(/,/g, '')) || 0;
  }

  // Uses the saved period: tapping a period tab in the sheet shouldn't change a running bog
  // until they save.
  function getHourlyRate() {
    const raw = savedSalary;
    if (savedPeriod === 'year') return raw / 52 / 40;
    if (savedPeriod === 'month') return raw * 12 / 52 / 40;
    return raw;
  }

  // ── SALARY SAVE / COLLAPSE ──
  function saveSalary() {
    const raw = getSalaryRaw();
    if (raw <= 0) {
      salaryInput.style.borderColor = 'red';
      salaryInput.focus();
      return;
    }
    savedSalary = raw;
    savedPeriod = currentPeriod;
    writeJSON(SALARY_KEY, { amount: raw, period: currentPeriod });

    document.body.classList.add('has-salary');
    closeSettings();

    refreshAll();
    revealLifetime();
  }

  function openSalaryForm() {
    salaryInput.focus();
  }

  // ── SETTINGS SHEET ──
  function openSettings() {
    closeHomeSheet(true);
    document.getElementById('saveBtn').textContent = 'Save & Flush 💩';
    document.body.classList.add('sheet-open');
    document.getElementById('salaryCard').scrollTop = 0;
    // Desktop only: on a phone the keyboard would cover the rest of the sheet
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) salaryInput.focus();
    if (window.renderProfile) window.renderProfile(true);
  }

  function closeSettings() {
    if (!document.body.classList.contains('sheet-open')) return;
    document.body.classList.remove('sheet-open');
    // Closing without saving keeps the old salary and period
    salaryInput.value = savedSalary.toLocaleString('en-US');
    salaryInput.style.borderColor = '';
    currentPeriod = savedPeriod;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.period === savedPeriod));
    document.getElementById('settingsBtn').focus();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettings();
  });

  // ── MONEY FORMAT ──
  function fmt(n) {
    if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + (n/1000).toFixed(1) + 'k';
    if (n >= 10) return '$' + n.toFixed(2);
    return '$' + n.toFixed(4);
  }

  function fmtExact(n) { return '$' + n.toFixed(2); }

  // ── TIMER ──
  // Counted from the clock, not from ticks: phones pause timers when the
  // screen locks or the app goes to the background, so ticks undercount.
  function updateTimer() {
    const now = segmentStartSeconds + Math.floor((Date.now() - segmentStartMs) / 1000);
    if (now === seconds) return;
    seconds = now;
    renderTimer();
  }

  function renderTimer() {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    document.getElementById('timerDisplay').textContent = `${m}:${s}`;
    document.getElementById('miniTimerTime').textContent = `${m}:${s}`;
    refreshAll();
  }

  function startTimer() {
    if (running) return;
    if (savedSalary <= 0) {
      openSalaryForm();
      salaryInput.focus();
      return;
    }
    beginTimer(seconds, Date.now());
    startMotion();
  }

  function beginTimer(fromSeconds, startMs, hiddenAtSecs) {
    running = true;
    segmentStartSeconds = fromSeconds;
    segmentStartMs = startMs;
    segmentStartedAt = new Date(segmentStartMs).toISOString();
    saveRunning(hiddenAtSecs);
    timerInterval = setInterval(updateTimer, 250);
    document.getElementById('timerDot').classList.add('live');
    document.getElementById('miniTimerDot').classList.add('live');
    document.body.classList.add('bog-running');
    document.getElementById('dashEarned').classList.add('ticking');
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'block';
  }

  function saveRunning(hiddenAtSecs) {
    writeJSON(RUNNING_KEY, running ? { from: segmentStartSeconds, startMs: segmentStartMs, hiddenAtSecs } : null);
  }

  // atSeconds: end the bog at an earlier point, e.g. when they left the app
  function stopTimer(atSeconds) {
    if (!running) return;
    updateTimer();
    if (atSeconds != null && atSeconds < seconds) { seconds = atSeconds; renderTimer(); }
    running = false;
    saveRunning();
    hideThrone();
    clearInterval(timerInterval);
    document.getElementById('timerDot').classList.remove('live');
    document.getElementById('miniTimerDot').classList.remove('live');
    document.body.classList.remove('bog-running');
    document.getElementById('dashEarned').classList.remove('ticking');
    document.getElementById('startBtn').style.display = 'block';
    document.getElementById('stopBtn').style.display = 'none';
    const logged = seconds - segmentStartSeconds >= MIN_SESSION_SECS;
    logSession(seconds - segmentStartSeconds);
    if (logged && !document.body.classList.contains('game-open')) flushToStats(document.getElementById('dashEarned').textContent);
    showFunFact();
  }

  function resetTimer() {
    stopTimer();
    seconds = 0;
    document.getElementById('timerDisplay').textContent = '00:00';
    document.getElementById('miniTimerTime').textContent = '00:00';
    document.getElementById('funFact').classList.remove('visible');
    refreshAll();
  }

  // ── THRONE CHECK ──
  // Catches bogs left running. The web only sees motion while the app is open
  // on screen, so we also ask when they come back after being away a while.
  const AWAY_PROMPT_SECS = 180;
  let hiddenAtSecs = null;
  let throneEndSecs = null;
  let motionQuietUntil = 0;
  let steps = [];
  let lastStep = 0;
  let motionOn = false;

  function askThrone(text, endSecs) {
    throneEndSecs = endSecs;
    document.getElementById('throneText').innerHTML = text;
    document.getElementById('throneFinish').textContent = endSecs == null ? 'Finish up' : 'Finish at ' + fmtClock(endSecs);
    document.getElementById('throneCheck').hidden = false;
  }

  function hideThrone() { document.getElementById('throneCheck').hidden = true; }

  function throneFinish() {
    stopTimer(throneEndSecs);
    if (document.body.classList.contains('game-open')) closeGame();
  }

  function throneStay() {
    hideThrone();
    motionQuietUntil = Date.now() + 5 * 60000;
  }

  function fmtClock(secs) {
    return String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
  }

  document.addEventListener('visibilitychange', () => {
    if (!running) return;
    updateTimer();
    // Saved too: the phone may close the app while it's in the background
    if (document.visibilityState === 'hidden') { hiddenAtSecs = seconds; saveRunning(hiddenAtSecs); return; }
    saveRunning();
    if (hiddenAtSecs != null && seconds - hiddenAtSecs >= AWAY_PROMPT_SECS) {
      askThrone(`<b>You left ${fmtDuration(seconds - hiddenAtSecs)} ago.</b> Did you get off the throne?`, hiddenAtSecs);
    }
    hiddenAtSecs = null;
  });

  // Called from the Start tap: iPhones only allow the motion permission prompt from a tap.
  function startMotion() {
    if (motionOn || typeof DeviceMotionEvent === 'undefined') return;
    const listen = () => { motionOn = true; window.addEventListener('devicemotion', onMotion); };
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().then(r => { if (r === 'granted') listen(); }).catch(() => {});
    } else listen();
  }

  // Walking shows up as a steady run of sharp jolts; sitting and scrolling doesn't.
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!running || !a || a.x == null) return;
    // Swiping and tilting during a game isn't walking off
    if (document.body.classList.contains('game-open')) { steps = []; return; }
    const now = Date.now();
    const jolt = Math.abs(Math.hypot(a.x, a.y, a.z) - 9.81);
    if (jolt < 3 || now - lastStep < 300) return;
    lastStep = now;
    steps = steps.filter(t => now - t < 8000);
    steps.push(now);
    if (steps.length < 10 || now < motionQuietUntil) return;
    if (seconds - segmentStartSeconds < 60 || !document.getElementById('throneCheck').hidden) return;
    steps = [];
    askThrone('<b>Looks like you\'re on the move.</b> Did you get off the throne?', null);
  }

  // ── LIFETIME REVEAL ──
  let revealTimeout = null;
  let revealFrame = null;
  let revealing = false;

  function revealLifetime() {
    const card = document.getElementById('lifetimeCard');
    const vals = ['ltWeekly','ltMonthly','ltYearly','ltCareer'];
    const lbls = document.querySelectorAll('#portfolioPart .lt-lbl');

    // Cancel any reveal still in flight so a quick re-save restarts cleanly
    clearTimeout(revealTimeout);
    cancelAnimationFrame(revealFrame);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealing = false;
      vals.forEach(id => document.getElementById(id).classList.remove('skeleton'));
      lbls.forEach(el => el.classList.remove('skeleton'));
      card.style.display = 'block';
      card.classList.add('revealed');
      refreshAll();
      return;
    }

    revealing = true;

    // Show card with skeleton state
    vals.forEach(id => document.getElementById(id).classList.add('skeleton'));
    lbls.forEach(el => el.classList.add('skeleton'));
    card.style.display = 'block';

    // Fade + slide in
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('revealed')));

    // After skeleton shimmer, count up values
    revealTimeout = setTimeout(() => {
      vals.forEach(id => document.getElementById(id).classList.remove('skeleton'));
      lbls.forEach(el => el.classList.remove('skeleton'));

      const hourly = getHourlyRate();
      const daily  = hourly * 8;
      const yearly = daily * 250;

      const targets = {
        ltWeekly:  daily * 5,
        ltMonthly: daily * 21,
        ltYearly:  yearly,
        ltCareer:  yearly * 40,
      };

      const DURATION = 1200;
      const START = performance.now();

      function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

      function tick(now) {
        const t = Math.min((now - START) / DURATION, 1);
        const e = easeOut(t);
        Object.entries(targets).forEach(([id, target]) => {
          document.getElementById(id).textContent = fmt(target * e);
        });
        if (t < 1) revealFrame = requestAnimationFrame(tick);
        else revealing = false;
      }

      revealFrame = requestAnimationFrame(tick);
    }, 900);
  }

  // Each time Bog Stats opens, the portfolio counts up again as the rows unroll
  function countUpLifetime() {
    if (revealing || savedSalary <= 0 || reducedMotion()) return;
    const daily = getHourlyRate() * 8;
    const targets = { ltWeekly: daily * 5, ltMonthly: daily * 21, ltYearly: daily * 250, ltCareer: daily * 250 * 40 };
    const els = Object.keys(targets).map(id => [document.getElementById(id), targets[id]]);
    els.forEach(([el]) => { el.textContent = fmt(0); });
    revealing = true;
    cancelAnimationFrame(revealFrame);
    const START = performance.now() + 350, DURATION = 1100;
    function tick(now) {
      const t = Math.max(0, Math.min((now - START) / DURATION, 1));
      const e = 1 - Math.pow(1 - t, 3);
      els.forEach(([el, target]) => { el.textContent = fmt(target * e); });
      if (t < 1 && homeSheet === 'stats') revealFrame = requestAnimationFrame(tick);
      else { revealing = false; refreshAll(); }
    }
    revealFrame = requestAnimationFrame(tick);
  }

  // ── REFRESH ALL ──
  function refreshAll() {
    const hourly = getHourlyRate();
    const earned = hourly * (seconds / 3600);
    const perMin = hourly / 60;
    const daily = hourly * 8;
    const yearly = daily * 250;

    document.getElementById('dashEarned').textContent = fmtExact(earned);
    document.getElementById('miniTimerEarned').textContent = fmtExact(earned);
    document.getElementById('ratePerMin').textContent = perMin >= 10 ? fmt(perMin) : fmtExact(perMin);
    // $10.00+ or 100+ minutes no longer fit side by side at 64px
    const dashLen = document.getElementById('dashEarned').textContent.length + document.getElementById('timerDisplay').textContent.length;
    document.getElementById('dashHeader').classList.toggle('long', dashLen > 10);
    // $1000.00+ (or 1000+ minutes) ran into the timer, so one more step down
    document.getElementById('dashHeader').classList.toggle('xlong', dashLen > 12);

    // Don't stomp on the skeleton / count-up while the reveal is running
    if (revealing) return;
    document.getElementById('ltWeekly').textContent = fmt(daily * 5);
    document.getElementById('ltMonthly').textContent = fmt(daily * 21);
    document.getElementById('ltYearly').textContent = fmt(yearly);
    document.getElementById('ltCareer').textContent = fmt(yearly * 40);
  }

  // ── MAIN WAVE ANIMATION ──
  // Sized only on resize: resetting canvas.width every frame reallocates it and
  // forces a layout read, which was the app's main per-frame cost.
  const waveCanvas = document.getElementById('waveCanvas');
  const waveCtx = waveCanvas.getContext('2d');
  const WAVE_H = 130;
  function sizeWave() {
    waveCanvas.width = waveCanvas.offsetWidth;
    waveCanvas.height = WAVE_H;
  }
  window.addEventListener('resize', sizeWave);
  sizeWave();

  function drawMainWave() {
    const W = waveCanvas.width;
    const H = WAVE_H;
    if (W === 0) return;
    const ctx = waveCtx;
    ctx.clearRect(0, 0, W, H);

    const waves = [
      { amp: 20, freq: 0.016, speed: running ? 0.045 : 0.015, color: 'rgba(245,200,66,0.45)', offset: 0 },
      { amp: 14, freq: 0.024, speed: running ? 0.065 : 0.02,  color: 'rgba(224,123,0,0.35)',   offset: 2.1 },
      { amp: 25, freq: 0.011, speed: running ? 0.028 : 0.01,  color: 'rgba(200,169,110,0.22)', offset: 4.3 },
    ];

    waves.forEach(w => {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 2) {
        const y = H * 0.52
          + Math.sin(x * w.freq + waveT * w.speed + w.offset) * w.amp
          + Math.sin(x * w.freq * 1.8 + waveT * w.speed * 0.55) * (w.amp * 0.35);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, w.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fill();
    });
  }

  // ── ANIMATION LOOP ──
  // Paused while the dashboard is scrolled out of view or a game covers it. Reduced motion
  // gets one still frame. Drawn at 30fps and moved by the clock, so 120Hz phones don't
  // run it twice as fast or burn twice the battery.
  const wave = (function () {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let onScreen = true;
    let frame = null;
    let last = 0;
    function loop(now) {
      frame = null;
      if (still || !onScreen || document.body.classList.contains('game-open')) return;
      frame = requestAnimationFrame(loop);
      if (now - last < 32) return;
      // waveT counts 60ths of a second, which the wave speeds were tuned for
      waveT += Math.min(now - last, 100) * 0.06;
      last = now;
      drawMainWave();
    }
    function resume() {
      if (frame === null) { drawMainWave(); frame = requestAnimationFrame(loop); }
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        onScreen = e.isIntersecting;
        if (onScreen) resume();
      }).observe(waveCanvas);
    }
    window.addEventListener('resize', () => { if (frame === null) drawMainWave(); });
    resume();
    return { resume };
  })();

  refreshAll();


  // ── FUN FACTS ──
  const facts = [
    (min, earned) => `In <span>${min} minutes</span> you earned <span>${fmtExact(earned)}</span>. The average person spends <span>~8 min/day</span> on the throne at work.`,
    (min, earned) => `That's <span>${fmtExact(earned)}</span> for your most natural talent. Multiply by 250 working days and it's serious money.`,
    (min, earned) => `<span>${fmtExact(earned)}</span> richer. Your bathroom break just outperformed most meetings.`,
    (min, earned) => `You made <span>${fmtExact(earned)}</span>. Over a 40-year career, the toilet is basically a second income stream.`,
    (min, earned) => `A <span>${min}-min</span> bog = <span>${fmtExact(earned)}</span>. Nobody said passive income had to be glamorous. 💸`,
  ];

  function showFunFact() {
    const hourly = getHourlyRate();
    const earned = hourly * (seconds / 3600);
    const min = Math.max(1, Math.round(seconds / 60));
    const fact = facts[Math.floor(Math.random() * facts.length)](min, earned);
    const el = document.getElementById('funFact');
    el.innerHTML = '💡 ' + fact;
    el.classList.add('visible');
  }

  // ── BOG HISTORY ──
  function fmtDuration(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${secs}s`;
  }

  function logSession(secs) {
    if (secs < MIN_SESSION_SECS) return;
    const sessions = loadSessions();
    sessions.push({
      start: segmentStartedAt,
      secs,
      earned: Math.round(getHourlyRate() * (secs / 3600) * 100) / 100,
    });
    writeJSON(SESSIONS_KEY, sessions);
    renderHistory();
    if (window.poolOnSession) window.poolOnSession();
  }

  function renderHistory() {
    const sessions = loadSessions();
    const part = document.getElementById('historyPart');

    const totalSecs = sessions.reduce((t, s) => t + s.secs, 0);
    const totalEarned = sessions.reduce((t, s) => t + s.earned, 0);
    const longest = sessions.length ? Math.max(...sessions.map(s => s.secs)) : 0;

    document.getElementById('histTime').textContent = fmtDuration(totalSecs);
    document.getElementById('histEarned').textContent = totalEarned >= 1000 ? fmt(totalEarned) : fmtExact(totalEarned);
    document.getElementById('histCount').textContent = sessions.length;
    document.getElementById('histLongest').textContent = fmtDuration(longest);

    const list = document.getElementById('historyList');
    list.innerHTML = sessions.length ? '' :
      '<div class="history-row"><span>No bogs logged yet. Hit Start a Bog.</span></div>';
    sessions.slice(-5).reverse().forEach(s => {
      const when = new Date(s.start).toLocaleString('en-AU', {
        weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
      });
      const row = document.createElement('div');
      row.className = 'history-row';
      row.innerHTML = `<span>${when}</span><span class="row-info">${fmtDuration(s.secs)} · <b>${fmtExact(s.earned)}</b></span>` +
        `<button type="button" class="hist-del" data-start="${s.start}" aria-label="Delete this bog"><svg class="x-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
      list.appendChild(row);
    });
    if (sessions.length) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'hist-clear';
      clear.textContent = 'Clear all history';
      list.appendChild(clear);
    }

    renderStatsTile(sessions, totalSecs, totalEarned);

    part.hidden = false;
    const card = document.getElementById('lifetimeCard');
    if (card.style.display === 'none') {
      card.style.display = 'block';
      card.classList.add('revealed');
    }
  }

  // Bog Stats tile: total time, a line of totals and the last 7 bogs as little bars
  function renderStatsTile(sessions, totalSecs, totalEarned) {
    const tile = document.getElementById('statsTile');
    document.getElementById('tileStatsBig').textContent = fmtDuration(totalSecs);
    document.getElementById('tileStatsSub').textContent = sessions.length
      ? `${sessions.length} ${sessions.length === 1 ? 'bog' : 'bogs'} · ${fmtExact(totalEarned)} earned`
      : 'No bogs yet';
    const last = sessions.slice(-7);
    const max = Math.max(1, ...last.map(x => x.secs));
    document.getElementById('tileBars').innerHTML =
      last.map(x => `<i style="height:${Math.max(4, Math.round(x.secs / max * 30))}px"></i>`).join('');
    fitStatsTile();
  }

  // Keep the time and the bars apart on any width. Side by side, the time can shrink
  // to 30px; past that the bars move under the time (all 7 kept) and the time goes
  // back to full size, shrinking only if it's wider than the whole tile.
  function fitStatsTile() {
    const big = document.getElementById('tileStatsBig');
    const row = big.parentElement;
    if (!big.offsetParent) return; // hidden, nothing to measure
    const tooWide = () => big.scrollWidth > big.clientWidth;
    const fit = min => {
      let size = 38;
      big.style.fontSize = '';
      while (tooWide() && size > min) big.style.fontSize = (--size) + 'px';
      return !tooWide();
    };
    row.classList.remove('stacked');
    if (fit(30)) return;
    row.classList.add('stacked');
    fit(14);
  }
  window.addEventListener('resize', fitStatsTile);
  if (document.fonts) document.fonts.ready.then(fitStatsTile);

  // ── HOME SHEETS (Bog Stats, Poop Pool) ──
  // A tile strains, then its sheet "backs one out" from the bottom. Swipe the top
  // down, tap outside or press Esc to close.
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const homeSheets = { stats: 'lifetimeCard', pool: 'poolCard' };
  let homeSheet = null;
  // Pending open/close steps. A new tap cancels them, so quick taps can't leave
  // a sheet marked open but hidden (which made its tile stop working).
  let hsTimers = [];
  const hsLater = (fn, ms) => hsTimers.push(setTimeout(fn, ms));
  function hsCancel() { hsTimers.forEach(clearTimeout); hsTimers = []; }

  function openHomeSheet(name, tile) {
    if (homeSheet === name) return;
    if (homeSheet) closeHomeSheet(true);
    hsCancel();
    document.body.classList.remove('hs-open', 'hs-closing', 'hs-stats', 'hs-pool');
    closeSettings();
    homeSheet = name;
    const go = () => {
      const el = document.getElementById(homeSheets[name]);
      document.body.classList.add('hs-open', 'hs-' + name);
      document.body.classList.remove('hs-closing');
      el.style.transform = '';
      el.scrollTop = 0;
      el.classList.remove('hs-out');
      el.classList.add('hs-in', 'hs-fresh');
      hsLater(() => el.classList.remove('hs-in', 'hs-fresh'), 1200);
      if (name === 'stats') countUpLifetime();
    };
    if (tile && !reducedMotion()) {
      tile.classList.remove('strain');
      void tile.offsetWidth;
      tile.classList.add('strain');
      hsLater(go, 240);
    } else go();
  }

  function closeHomeSheet(now) {
    if (!homeSheet) return;
    const name = homeSheet;
    const el = document.getElementById(homeSheets[name]);
    homeSheet = null;
    hsCancel();
    const done = () => {
      document.body.classList.remove('hs-open', 'hs-closing', 'hs-' + name);
      el.classList.remove('hs-out', 'hs-in', 'hs-fresh');
      el.style.transform = '';
      // Closing the pool sheet on the code screen is the way out for a typo'd email:
      // next open shows the email box again, filled in, ready to fix and resend.
      if (name === 'pool' && pool.view && pool.view.name === 'sent') {
        pool.view = Object.assign({}, pool.view.from || { name: 'pitch' }, { email: pool.view.email });
        renderPool();
      }
    };
    // Closed before it finished opening: just reset
    if (now === true || !document.body.classList.contains('hs-' + name)) return done();
    document.body.classList.add('hs-closing');
    el.classList.remove('hs-in');
    el.classList.add('hs-out');
    hsLater(done, 230);
  }

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeHomeSheet(); });

  // Drag the sheet's top bar down to close it
  document.querySelectorAll('.wrapper').forEach(w => w.addEventListener('pointerdown', e => {
    const head = e.target.closest('.hs-head');
    if (!head || e.target.closest('button, select, input') || !homeSheet) return;
    const el = document.getElementById(homeSheets[homeSheet]);
    const y0 = e.clientY;
    let dy = 0;
    head.setPointerCapture(e.pointerId);
    const move = ev => { dy = Math.max(0, ev.clientY - y0); el.style.transform = `translateY(${dy}px)`; };
    const up = () => {
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', up);
      head.removeEventListener('pointercancel', up);
      if (dy > 90) return closeHomeSheet();
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(0.2, 1.3, 0.4, 1)' });
      el.style.transform = '';
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
    head.addEventListener('pointercancel', up);
  }));

  // Flush swirl: on Finish Up, the bog's earnings spin down the drain into the Bog Stats tile
  function flushToStats(amount) {
    const tile = document.getElementById('statsTile');
    const bank = () => {
      tile.classList.remove('gulp');
      void tile.offsetWidth;
      tile.classList.add('gulp');
      const tag = document.createElement('span');
      tag.className = 'tile-bank';
      tag.textContent = '+' + amount;
      tile.appendChild(tag);
      setTimeout(() => tag.remove(), 1500);
    };
    const from = document.getElementById('dashEarned').getBoundingClientRect();
    const to = tile.getBoundingClientRect();
    const onScreen = to.top < innerHeight && to.bottom > 0 && from.bottom > 0;
    if (reducedMotion() || !onScreen || !document.body.animate) return bank();
    const chip = document.createElement('div');
    chip.className = 'flush-chip';
    chip.textContent = amount;
    document.body.appendChild(chip);
    const c = chip.getBoundingClientRect();
    chip.style.left = (from.left + from.width / 2 - c.width / 2) + 'px';
    chip.style.top = (from.top + from.height / 2 - c.height / 2) + 'px';
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    // A few points around a shrinking circle fake the swirl down the drain
    chip.animate([
      { transform: 'translate(0, 0) rotate(0) scale(1)' },
      { transform: `translate(${dx * 0.3 + 60}px, ${dy * 0.25}px) rotate(180deg) scale(0.85)`, offset: 0.3 },
      { transform: `translate(${dx * 0.65 - 40}px, ${dy * 0.6}px) rotate(400deg) scale(0.55)`, offset: 0.62 },
      { transform: `translate(${dx * 0.9 + 15}px, ${dy * 0.9}px) rotate(600deg) scale(0.3)`, offset: 0.85 },
      { transform: `translate(${dx}px, ${dy}px) rotate(720deg) scale(0.1)`, opacity: 0.3 },
    ], { duration: 750, easing: 'cubic-bezier(0.45, 0, 0.8, 0.4)' }).finished
      .then(() => { chip.remove(); bank(); }, () => chip.remove());
  }

  // The tagline's letter spacing stretches it to exactly the wordmark's width
  (function fitTagline() {
    const t = document.getElementById('tagline');
    const fit = () => {
      t.style.letterSpacing = '0px';
      const ls = Math.max(0, (t.previousElementSibling.offsetWidth - t.offsetWidth) / t.textContent.length);
      t.style.letterSpacing = ls + 'px';
      t.style.marginRight = -ls + 'px'; // the last letter's spacing hangs off the end
    };
    fit();
    if (document.fonts) document.fonts.ready.then(fit);
  })();

  // ── DELETE BOGS ──
  function deleteSessions(starts) {
    writeJSON(SESSIONS_KEY, loadSessions().filter(s => !starts.includes(s.start)));
    renderHistory();
    if (window.poolOnDelete) window.poolOnDelete(starts);
  }

  let armTimer = null;
  document.getElementById('historyList').addEventListener('click', e => {
    const btn = e.target.closest('.hist-del, .hist-clear');
    if (!btn) return;
    if (!btn.classList.contains('armed')) {
      document.querySelectorAll('#historyList .armed').forEach(disarm);
      btn.classList.add('armed');
      btn.dataset.label = btn.innerHTML;
      btn.textContent = btn.classList.contains('hist-clear') ? 'Tap again to delete all' : 'DELETE?';
      clearTimeout(armTimer);
      armTimer = setTimeout(() => disarm(btn), 3000);
      return;
    }
    clearTimeout(armTimer);
    deleteSessions(btn.classList.contains('hist-clear')
      ? loadSessions().map(s => s.start)
      : [btn.dataset.start]);
  });

  function disarm(btn) {
    btn.classList.remove('armed');
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }

  // ── BOG ARCADE ──
  // Each game lives in its own file under games/ and only loads when someone opens it.
  // A game file sets window[global] = { mount(el, { hourly, onExit }) } and
  // mount returns { destroy() }. Add a game by adding a line here.
  // The card is always shown; a running bog timer keeps going underneath, shrunk to a bar at the top.
  // held: true keeps a finished game in the code but off the arcade until its monthly drop.
  // dropped: 'YYYY-MM-DD' on a released monthly game pins it first with a NEW badge for 30 days.
  // A mystery "Drops 1 Dec" placeholder tile (not playable) goes first while the next drop is
  // counting down and no NEW game is showing; otherwise it sits last.
  // Tile art is icons/games/<id>.svg (cartoon, same style as the logo; masters in Figma).
  // icon (emoji) is only used as a fallback label, e.g. on /stats.
  const GAMES = [
    { id: 'dung-run', name: 'Dung Run', icon: '🚽', file: 'games/dung-run.js', global: 'DungRun',
      bg: 'linear-gradient(145deg,#2a6f8f,#123447)' },
    { id: 'turd-snake', name: 'Turd Snake', icon: '💩', file: 'games/turd-snake.js', global: 'TurdSnake',
      bg: 'linear-gradient(145deg,#4caf6e,#1f5a34)' },
    { id: 'stool-swap', name: 'Stool Swap', icon: '🌽', file: 'games/stool-swap.js', global: 'StoolSwap',
      bg: 'linear-gradient(145deg,#f5c842,#e07b00)' },
    { id: 'fling-bonus', name: 'Fling Bonus', icon: '🐒', file: 'games/fling-bonus.js', global: 'FlingBonus', held: true,
      bg: 'linear-gradient(145deg,#e07b00,#7a3a00)' },
    { id: 'wrap-up', name: 'Wrap Up', icon: '🧩', file: 'games/wrap-up.js', global: 'WrapUp',
      bg: 'linear-gradient(145deg,#ff7aa8,#24306b)' },
    { id: 'turdle', name: 'Turdle', icon: '📰', file: 'games/turdle.js', global: 'Turdle',
      bg: 'linear-gradient(145deg,#f5ead6,#a0652f)' },
    { id: 'turd-invaders', name: 'Turd Invaders', icon: '🛸', file: 'games/turd-invaders.js', global: 'TurdInvaders',
      bg: 'linear-gradient(145deg,#3a2a6b,#0e0a05)' },
    { id: 'step-in-it', name: 'Step In It', icon: '👟', file: 'games/step-in-it.js', global: 'StepInIt', held: true,
      bg: 'linear-gradient(145deg,#7a9a3a,#2e4f1c)' },
    { id: 'mah-dung', name: 'Mah-Dung', icon: '🀄', file: 'games/mah-dung.js', global: 'MahDung', held: true,
      bg: 'linear-gradient(145deg,#2f8f86,#123f3b)' },
    // Locked in as the June 2027 drop
    { id: 'backed-up', name: 'Backed Up', icon: '🪠', file: 'games/backed-up.js', global: 'BackedUp', held: true,
      bg: 'linear-gradient(145deg,#3f8fd0,#17375c)' },
  ];
  // Branch previews (and localhost) show held games too, so they can be played before their drop
  const ARCADE = GAMES.filter(gm => !gm.held || /\.gross-income\.pages\.dev$|^localhost$/.test(location.hostname));
  // Next monthly game drop (Sydney date). The tile reads "Drops 1 Dec"; once the date
  // passes it falls back to "Dropping soon" until this is moved to the next drop.
  const NEXT_DROP = '2026-12-01T00:00:00+11:00';
  function dropLabel() {
    const t = Date.parse(NEXT_DROP);
    if (!(Date.now() < t)) return 'Dropping soon';
    return 'Drops ' + new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' }).replace(' ', '\u00a0'); // keep "1 Dec" on one line
  }
  // Games call this when you come back to the app mid-play: a "Paused" cover that
  // carries on when tapped (or on any key). Calling it again just swaps the callback.
  window.GIPause = function (root, onResume) {
    let el = root.querySelector('.gi-paused');
    if (!el) {
      el = document.createElement('div');
      el.className = 'gi-paused';
      el.setAttribute('role', 'button');
      el.innerHTML = '<b>Paused 🧻</b><span>Tap to carry on</span>';
      root.appendChild(el);
    }
    const go = e => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      el.remove();
      window.removeEventListener('keydown', key, true);
      onResume();
    };
    const key = e => { if (e.key !== 'Escape') go(e); };
    el.onpointerdown = go;
    window.removeEventListener('keydown', el._key, true);
    el._key = key;
    window.addEventListener('keydown', key, true);
  };
  let game = null;
  let gameOpenId = 0; // bumps on every open and close, so a slow load can't mount a game that was already closed
  const gameScripts = {};

  // ── GAME STATS ──
  // Anonymous counts so we can see which games get played: one 'open' row when a
  // game opens, and a 'time' row with seconds played when it closes or the app is
  // hidden. No user id, device id or score. Only the live site sends (?trackgames
  // forces it for testing). Table + game_popularity view: supabase/schema.sql
  const TRACK_GAMES = location.hostname === 'grossincome.com.au' || new URLSearchParams(location.search).has('trackgames');
  let playing = null; // { id, since }
  function trackGame(row) {
    if (!TRACK_GAMES) return;
    try {
      fetch(SUPABASE_URL + '/rest/v1/game_events', {
        method: 'POST', keepalive: true,
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      }).catch(() => {});
    } catch (e) {}
  }
  function trackPlayTime() {
    if (!playing) return;
    const secs = Math.min(Math.round((Date.now() - playing.since) / 1000), 3 * 3600);
    if (secs >= 2) trackGame({ game: playing.id, kind: 'time', secs });
    playing.since = Date.now();
  }
  document.addEventListener('visibilitychange', () => {
    if (!playing) return;
    if (document.visibilityState === 'hidden') trackPlayTime();
    else playing.since = Date.now();
  });

  // ── GOLDEN THRONE (arcade subscription) ──
  // A monthly or yearly subscription opens every game; Turd Snake stays free as a taster.
  // On the web it's bought through Stripe Payment Links, and the stripe-webhook
  // function keeps the entitlements row up to date. Setup: supabase/README.md.
  const FREE_GAMES = ['turd-snake'];
  // Payment Links redirect to grossincome.com.au/?unlocked=1. Yearly is listed first and picked by default.
  // TEST MODE links (redirect to this branch's preview). Swap for live links before 4 Jan.
  const PLANS = {
    yearly: { label: 'Yearly', price: 'A$24.99', per: 'year', note: 'A$2.08 a month · save 30%', link: 'https://buy.stripe.com/bJebJ3eDA7no72M2Va0ZW01' },
    monthly: { label: 'Monthly', price: 'A$2.99', per: 'month', note: 'Cancel anytime', link: 'https://buy.stripe.com/5kQ9AV2US8rs72M3Ze0ZW02' },
  };
  // Stripe customer portal login link (Settings → Billing → Customer portal): cancel, switch plan, new card
  const PORTAL_LINK = 'https://billing.stripe.com/p/login/eVq4gBdzwgXYcn6anC0ZW00';
  // A renewal can land a little after the period ends, so don't lock anyone out the moment it does
  const RENEW_GRACE_MS = 2 * 24 * 60 * 60 * 1000;
  // Accounts made before this keep the arcade free forever (founder SQL runs on the day).
  const FOUNDER_CUTOFF = '2026-11-02T00:00:00+11:00'; // Monday 2 Nov, midnight Sydney time
  // Free play for everyone until this date. Off on the live site until then;
  // previews, localhost and ?paywall show it now.
  const PAYWALL_FROM = '2027-01-04T00:00:00+11:00'; // Monday 4 Jan, midnight Sydney time
  const UNLOCK_KEY = 'gi.unlock.v1';
  // The locked game someone tapped before signing in, so login brings them back to it
  const PENDING_UNLOCK_KEY = 'gi.pendingUnlock';
  const qs = new URLSearchParams(location.search);
  if (qs.has('paywall')) writeJSON('gi.paywallPreview', true);
  // Branch previews only: ?nopaywall opens the whole arcade for testing (?paywall turns it back on).
  // Never on the live site or gross-income.pages.dev, so it can't be used to skip paying.
  const testHost = /\.gross-income\.pages\.dev$|^localhost$/.test(location.hostname);
  if (testHost && qs.has('nopaywall')) writeJSON('gi.paywallPreview', 'off');
  if (testHost) {
    const tag = document.createElement('div');
    tag.className = 'test-build';
    tag.textContent = 'TEST BUILD · NOT THE LIVE APP';
    document.body.prepend(tag);
    document.body.classList.add('is-test-build');
  }

  function paywallOn() {
    if (testHost && readJSON('gi.paywallPreview', null) === 'off') return false;
    return /\.pages\.dev$|^localhost$/.test(location.hostname) || readJSON('gi.paywallPreview', false) === true
      || (PAYWALL_FROM !== null && Date.now() >= Date.parse(PAYWALL_FROM));
  }
  function activeUnlock(u) { return !!u && (!u.expires || Date.parse(u.expires) + RENEW_GRACE_MS > Date.now()); }
  function unlocked() { return activeUnlock(readJSON(UNLOCK_KEY, null)); }
  // A Stripe subscription that will charge again (cancelled ones show as 'canceling')
  function subRenews() {
    const u = readJSON(UNLOCK_KEY, null);
    return !!u && u.source === 'stripe' && ['active', 'trialing', 'past_due'].includes(u.status) && activeUnlock(u);
  }
  let paywallPlan = 'yearly';
  function gameLocked(gm) { return paywallOn() && !unlocked() && !FREE_GAMES.includes(gm.id); }

  // Tile order: new drops first, then the last game played, then the rest shuffled once a
  // day (same order all day, new one overnight). The free game always sits in the first 3 tiles.
  // Mystery tile first while a drop is counting down and nothing is NEW (see soonFirst).
  const LAST_GAME_KEY = 'gi.arcade.last';
  const isNew = gm => gm.dropped && Date.now() - Date.parse(gm.dropped) < 30 * 864e5;
  function arcadeOrder() {
    const fresh = ARCADE.filter(isNew).sort((a, b) => b.dropped.localeCompare(a.dropped));
    const last = ARCADE.find(gm => gm.id === readJSON(LAST_GAME_KEY, null) && !fresh.includes(gm));
    const rest = ARCADE.filter(gm => !fresh.includes(gm) && gm !== last);
    // Seeded shuffle: the seed is today's Sydney date, e.g. 20261101
    let seed = +new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }).replace(/-/g, '');
    const rand = () => { // mulberry32
      let t = seed = (seed + 0x6D2B79F5) | 0;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const list = [...fresh, ...(last ? [last] : []), ...rest];
    const maxFree = soonFirst() ? 1 : 2; // the mystery tile takes a slot when it's first
    FREE_GAMES.forEach(id => {
      const i = list.findIndex(gm => gm.id === id);
      if (i > maxFree) list.splice(maxFree, 0, ...list.splice(i, 1));
    });
    return list;
  }

  const soonFirst = () => Date.now() < Date.parse(NEXT_DROP) && !ARCADE.some(isNew);

  const gameArt = id => `<img class="arcade-art" src="icons/games/${id}.svg" alt="" width="64" height="64" decoding="async">`;

  function renderArcade() {
    const soon = `
      <div class="arcade-tile arcade-soon" role="img" aria-label="New game: ${dropLabel()}">
        <span class="arcade-icon" aria-hidden="true">${gameArt('soon')}</span>
        <span class="arcade-name" aria-hidden="true">${dropLabel()}</span>
      </div>`;
    const tiles = arcadeOrder().map(gm => `
      <button type="button" class="arcade-tile" data-click="openGame:${gm.id}">
        <span class="arcade-icon" style="background:${gm.bg}" aria-hidden="true">${gameArt(gm.id)}${gameLocked(gm) ? '<span class="arcade-lock">🔒</span>' : isNew(gm) ? '<span class="arcade-new">NEW</span>' : ''}</span>
        <span class="arcade-name">${gm.name}</span>
      </button>`).join('');
    document.getElementById('arcadeTiles').innerHTML = soonFirst() ? soon + tiles : tiles + soon;
    renderFounderBar();
  }

  // Before the cut-off: people who sign in now become Founding Flushers and keep the arcade free.
  // After it, until the paywall: everyone gets free play, so just say when that ends.
  let founderBarClosed = false;
  function renderFounderBar() {
    const bar = document.getElementById('founderBar');
    const now = Date.now();
    const day = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', timeZone: 'Australia/Sydney' });
    const founderSoon = now < Date.parse(FOUNDER_CUTOFF);
    const freePlay = !founderSoon && PAYWALL_FROM !== null && now < Date.parse(PAYWALL_FROM);
    const signedIn = poolUser();
    bar.hidden = founderBarClosed || unlocked() || !((founderSoon && !signedIn) || freePlay);
    document.getElementById('founderBarBtn').hidden = !founderSoon;
    if (!bar.hidden) document.getElementById('founderBarText').innerHTML = founderSoon
      ? `<b>👑 You're a Founding Flusher!</b> Sign in to Poop Pool before ${day(FOUNDER_CUTOFF)} to keep the arcade free, forever.`
      : `<b>🎮 Free play!</b> Every Bog Arcade game is free for everyone until ${day(PAYWALL_FROM)}.`;
  }
  document.getElementById('founderBarBtn').onclick = () => openHomeSheet('pool');
  document.getElementById('founderBarX').onclick = () => { founderBarClosed = true; renderFounderBar(); };
  renderArcade();

  function paywallHtml(gm) {
    const user = poolUser();
    // Free games first so the taster is the first thing people see
    const free = x => FREE_GAMES.includes(x.id);
    // Every game they get, up front: the tapped one ringed in gold, then next month's mystery drop
    const grid = [...ARCADE.filter(free), ...ARCADE.filter(x => !free(x))].map(x => `
      <li class="${x.id === gm.id ? 'on' : ''}"><span class="arcade-icon" style="background:${x.bg}" aria-hidden="true">${gameArt(x.id)}</span>
        <span class="arcade-name">${x.name}</span>${free(x) ? '<span class="free-badge">FREE</span>' : ''}</li>`).join('')
      + `<li class="arcade-soon"><span class="arcade-icon" aria-hidden="true">${gameArt('soon')}</span><span class="arcade-name">${dropLabel()}</span></li>`;
    const plans = Object.entries(PLANS).map(([id, p]) => `
      <button type="button" class="paywall-plan${id === paywallPlan ? ' on' : ''}" data-pay="plan" data-plan="${id}" aria-pressed="${id === paywallPlan}">
        ${id === 'yearly' ? '<span class="paywall-best">FIBRE-RICH SAVINGS</span>' : ''}
        <b>${p.label}</b><span class="paywall-price">${p.price}<small>/${p.per}</small></span><span class="paywall-note">${p.note}</span>
      </button>`).join('');
    const pick = PLANS[paywallPlan];
    const action = user
      ? `<div class="paywall-plans">${plans}</div>
         <button class="btn btn-start" data-pay="buy">👑 Get it for ${pick.price}/${pick.per}</button>
         <p class="paywall-small">Renews every ${pick.per} until you cancel. Cancel anytime in Profile &amp; Crap.</p>
         <p class="paywall-small">Already paid? <button data-pay="check">Check again</button></p>`
      : `<button class="btn btn-start" data-pay="signin" data-game="${gm.id}">Sign in to unlock</button>
         <p class="paywall-small">Your unlock is saved to your Poop Pool login, so it follows you to any phone.</p>`;
    return `<div class="paywall" data-game="${gm.id}">
      <div class="paywall-kicker">GOLDEN THRONE</div>
      <h2>Unlock the Bog Arcade</h2>
      <p>Every game below, plus a new one every month.</p>
      <ul class="paywall-grid">${grid}</ul>
      ${action}
      <div class="paywall-msg" id="paywallMsg"></div>
      <p class="paywall-small"><a href="privacy">Privacy &amp; terms</a></p>
    </div>`;
  }

  document.getElementById('gameRoot').addEventListener('click', async (e) => {
    const el = e.target.closest('[data-pay]');
    if (!el) return;
    const msg = document.getElementById('paywallMsg');
    if (el.dataset.pay === 'signin') {
      writeJSON(PENDING_UNLOCK_KEY, { id: el.dataset.game, at: Date.now() });
      closeGame();
      setTimeout(() => {
        openHomeSheet('pool');
        const email = document.getElementById('poolEmail');
        if (email) email.focus({ preventScroll: true });
      }, 50);
    } else if (el.dataset.pay === 'plan') {
      paywallPlan = el.dataset.plan;
      const gm = GAMES.find(x => x.id === el.closest('.paywall').dataset.game);
      if (gm) document.getElementById('gameRoot').innerHTML = paywallHtml(gm);
    } else if (el.dataset.pay === 'buy') {
      const link = PLANS[paywallPlan].link;
      if (!link) { msg.textContent = "Payments aren't switched on yet. Hang tight."; return; }
      // Stripe sends people back to ?unlocked=1 (set on the Payment Link)
      location.href = link + '?client_reference_id=' + encodeURIComponent(pool.user.id)
        + (pool.user.email ? '&prefilled_email=' + encodeURIComponent(pool.user.email) : '');
    } else if (el.dataset.pay === 'check') {
      el.disabled = true;
      msg.textContent = '';
      const ok = window.loadUnlock && await window.loadUnlock();
      el.disabled = false;
      if (ok) closeGame();
      else msg.textContent = "No unlock on this login yet. Paid with a different email? Sign in with that one.";
    }
  });

  function loadGame(gm) {
    if (window[gm.global]) return Promise.resolve();
    if (!gameScripts[gm.id]) {
      gameScripts[gm.id] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = gm.file;
        s.onload = resolve;
        s.onerror = () => { delete gameScripts[gm.id]; reject(); };
        document.body.appendChild(s);
      });
    }
    return gameScripts[gm.id];
  }

  async function openGame(id) {
    const gm = GAMES.find(x => x.id === id) || GAMES[0];
    if (game || !document.getElementById('gameLayer').hidden) return;
    const openId = ++gameOpenId;
    const root = document.getElementById('gameRoot');
    document.getElementById('gameLayer').hidden = false;
    document.body.classList.add('game-open');
    history.pushState({ game: true }, '');
    const locked = gameLocked(gm);
    trackGame({ game: gm.id, kind: 'open', locked });
    writeJSON(LAST_GAME_KEY, gm.id);
    if (locked) { root.innerHTML = paywallHtml(gm); return; }
    root.innerHTML = '<div class="game-loading">Unblocking the pipes…</div>';
    try { await loadGame(gm); } catch (e) {
      if (openId !== gameOpenId) return;
      root.innerHTML = `<div class="game-loading">${gm.name} didn't load. Check your signal and try again.</div>`;
      return;
    }
    if (openId !== gameOpenId || document.getElementById('gameLayer').hidden) return;
    // Only pays while a bog is running, so "Paid to play" is $0 off the bog
    game = window[gm.global].mount(root, { hourly: () => running ? getHourlyRate() : 0, onExit: closeGame });
    playing = { id: gm.id, since: Date.now() };
  }

  function hideGame() {
    gameOpenId++;
    trackPlayTime();
    playing = null;
    const paused = document.querySelector('#gameRoot .gi-paused');
    if (paused) window.removeEventListener('keydown', paused._key, true);
    if (game) { game.destroy(); game = null; }
    document.getElementById('gameRoot').innerHTML = '';
    document.getElementById('gameLayer').hidden = true;
    document.body.classList.remove('game-open');
    wave.resume();
    renderArcade(); // last-played game moves up front
    document.getElementById('arcadeTiles').scrollLeft = 0;
  }

  // Closing goes through history so the phone's back gesture closes the game too
  function closeGame() {
    if (history.state && history.state.game) history.back();
    else hideGame();
  }
  window.addEventListener('popstate', () => {
    if (!document.getElementById('gameLayer').hidden) hideGame();
  });

  function finishFromGame() {
    closeGame();
    stopTimer();
  }

  // Playing without a bog running: start one from the game bar. No salary yet → back to the setup form.
  function startFromGame() {
    if (savedSalary > 0) return startTimer();
    closeGame();
    setTimeout(startTimer, 50);
  }

  // ── RESTORE SAVED STATE ──
  (function restore() {
    // Branch previews start with a test salary so testing skips the setup step.
    // Live (grossincome.com.au) and the main pages.dev site are untouched.
    if (location.hostname.endsWith('.gross-income.pages.dev') && !readJSON(SALARY_KEY, null)) {
      writeJSON(SALARY_KEY, { amount: 80000, period: 'year' });
    }
    const saved = readJSON(SALARY_KEY, null);
    if (saved && saved.amount > 0 && ['year', 'month', 'hour'].includes(saved.period)) {
      currentPeriod = saved.period;
      document.querySelectorAll('.tab').forEach(t =>
        t.classList.toggle('active', t.dataset.period === saved.period));
      salaryInput.value = Number(saved.amount).toLocaleString('en-US');
      saveSalary();
    }
    renderHistory();

    // Pick up a bog the phone closed the app on, and check they're still on the throne
    const bog = readJSON(RUNNING_KEY, null);
    if (bog && savedSalary > 0 && bog.startMs > 0 && bog.startMs <= Date.now()) {
      beginTimer(bog.from || 0, bog.startMs);
      updateTimer();
      if (bog.hiddenAtSecs != null && seconds - bog.hiddenAtSecs >= AWAY_PROMPT_SECS) {
        askThrone(`<b>You left ${fmtDuration(seconds - bog.hiddenAtSecs)} ago.</b> Did you get off the throne?`, bog.hiddenAtSecs);
      }
    } else if (bog) writeJSON(RUNNING_KEY, null);
  })();

  // ══ POOP POOL ══
  // Friends-only leaderboards backed by Supabase.
  // Schema and privacy rules: supabase/schema.sql
  const SUPABASE_URL = 'https://pngsoygqbvhlfkzdghtr.supabase.co';
  // Publishable key: meant to ship in browser code. Access is enforced by row level security.
  const SUPABASE_KEY = 'sb_publishable_VfI274ud8nqxAFZvKzquwQ_qChku-Bu';
  const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  // Hash of that exact file, so a tampered CDN copy is refused instead of run.
  // Update it with the version: curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A
  const SUPABASE_JS_SRI = 'sha384-0w2KAL2YHP6wKOkUDzkCDGgVvfmHnj02DHeQ6XcHOgTfFsGyonKOpShMH1x6nk9o';
  // Cloudflare Turnstile: a mostly invisible "are you a human" check before we send a
  // login email, so bots can't use the form to spam inboxes. Supabase checks the token
  // (Authentication → Attack Protection → CAPTCHA). Empty turns it off.
  const TURNSTILE_SITEKEY = '0x4AAAAAAFpIQmGxMsFWpT3S';
  const TURNSTILE_JS = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

  const POOL_INVITE_KEY = 'gi.pendingInvite';
  const POOL_CURRENT_KEY = 'gi.currentPool';
  const POOL_EMOJIS = ['💩', '🦍', '🧻', '🐻', '🦄', '🐢', '🚽', '🐸', '🦆', '👑'];
  const RANK_TITLES = ['GOLDEN THRONE', 'SILVER SEAT', 'BRONZE BOWL'];

  // Last known profile, pools and boards, so the pool draws instantly on the next
  // visit while fresh numbers load. Cleared on sign out.
  const POOL_CACHE_KEY = 'gi.poolCache.v1';
  const POOL_SYNCED_KEY = 'gi.poolSynced.v1';
  // Bogs deleted locally that still need removing from Supabase (survives being offline or signed out)
  const POOL_DELETED_KEY = 'gi.poolDeleted.v1';

  const pool = {
    sb: null, user: null, profile: null, pools: [], board: [], boards: {},
    period: 'week', view: null, msg: '', busy: false, stale: false, shown: null,
  };
  let sbReadyResolve;
  const sbReady = new Promise(r => { sbReadyResolve = r; });
  const poolCard = document.getElementById('poolCard');

  // Loads Turnstile when the email box gets focus, but only runs the check when
  // "Email me a login code" is tapped. Most people never see it; if Cloudflare wants
  // a tap, #captchaBox shows the checkbox and hides again once it's passed.
  const captcha = {
    id: null, token: null, running: false, waiters: [], loading: null, failed: false,
    box: document.getElementById('captchaBox'),
    prime() {
      if (!TURNSTILE_SITEKEY || this.loading) return this.loading;
      this.loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = TURNSTILE_JS; s.async = true; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      }).then(() => {
        const done = t => {
          this.running = false;
          this.box.classList.remove('show');
          this.waiters.splice(0).forEach(w => w(t));
        };
        this.id = window.turnstile.render(this.box, {
          sitekey: TURNSTILE_SITEKEY, action: 'login',
          appearance: 'interaction-only', execution: 'execute', 'refresh-expired': 'manual',
          'before-interactive-callback': () => this.box.classList.add('show'),
          'after-interactive-callback': () => this.box.classList.remove('show'),
          callback: t => { this.token = t; done(t); },
          'error-callback': () => { done(); return true; },
          'expired-callback': () => { this.token = null; },
          'timeout-callback': () => done(),
        });
      }).catch(() => { this.failed = true; this.waiters.splice(0).forEach(w => w()); });
      return this.loading;
    },
    // A token, or undefined if the check couldn't run (Supabase then decides).
    async get() {
      if (!TURNSTILE_SITEKEY) return;
      await this.prime();
      if (this.failed) return;
      if (this.token) return this.token;
      return new Promise(resolve => {
        this.waiters.push(resolve);
        setTimeout(resolve, 60000);
        if (!this.running) { this.running = true; window.turnstile.execute(this.box); }
      });
    },
    // Tokens only work once: clear it so the next email gets a fresh check.
    used() {
      this.token = null;
      this.box.classList.remove('show');
      if (this.id != null) window.turnstile.reset(this.id);
    },
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function errText(e) { return (e && (e.message || e.error_description)) || 'Something blocked the pipes. Try again.'; }

  function inviteLink(code) { return location.origin + location.pathname + '?pool=' + code; }

  function periodStart(period) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
    else if (period === 'month') d.setDate(1);
    else return null;
    return d.toISOString();
  }

  function currentPool() {
    const id = readJSON(POOL_CURRENT_KEY, null);
    return pool.pools.find(p => p.id === id) || pool.pools[0] || null;
  }

  function boardKey() {
    const p = currentPool();
    return p ? p.id + ':' + pool.period : null;
  }

  function saveCache() {
    writeJSON(POOL_CACHE_KEY, pool.user ? {
      user: { id: pool.user.id, email: pool.user.email },
      profile: pool.profile, pools: pool.pools, boards: pool.boards,
    } : null);
  }

  // ── DATA ──
  async function syncSessions() {
    if (!pool.user || !pool.profile) return;
    const deleted = readJSON(POOL_DELETED_KEY, []);
    if (deleted.length) {
      const { error } = await pool.sb.from('sessions').delete().eq('user_id', pool.user.id).in('local_id', deleted);
      if (error) console.warn('Poop Pool delete failed', error);
      else writeJSON(POOL_DELETED_KEY, []);
    }
    const rows = loadSessions()
      .filter(s => s.start && s.secs >= MIN_SESSION_SECS)
      .map(s => ({
        user_id: pool.user.id,
        local_id: s.start,
        started_at: s.start,
        secs: Math.min(s.secs, 86400),
        earned: pool.profile.share_money ? s.earned : null,
      }));
    if (rows.length === 0) return;
    // Skip the upload when nothing changed since the last one
    const sig = pool.user.id + ':' + rows.length + ':' + (pool.profile.share_money ? 1 : 0);
    if (readJSON(POOL_SYNCED_KEY, null) === sig) return;
    const { error } = await pool.sb.from('sessions').upsert(rows, { onConflict: 'user_id,local_id' });
    if (error) console.warn('Poop Pool sync failed', error);
    else writeJSON(POOL_SYNCED_KEY, sig);
  }

  async function loadBoard() {
    const p = currentPool();
    if (!p) { pool.board = []; return; }
    const key = p.id + ':' + pool.period;
    const { data, error } = await pool.sb.rpc('pool_leaderboard', { p_pool: p.id, p_since: periodStart(pool.period) });
    if (error) throw error;
    pool.boards[key] = data || [];
    pool.board = pool.boards[key];
    saveCache();
  }

  // Draw the board straight away from what we already have, then swap in fresh numbers.
  async function showBoard() {
    const k = boardKey();
    pool.stale = !(k && pool.boards[k]);
    if (!pool.stale) pool.board = pool.boards[k];
    renderPool();
    try { await loadBoard(); }
    catch (e) { pool.stale = false; renderPool(); throw e; }
    pool.stale = false;
  }

  // Login and boot can both ask for a refresh at once; share one instead of
  // running every query twice.
  let poolRefresh = null;
  function refreshPool() {
    if (!poolRefresh) poolRefresh = loadPool().finally(() => { poolRefresh = null; });
    return poolRefresh;
  }

  // Golden Throne: is there an entitlements row for this login? Cached on the
  // device so the arcade doesn't flash locked while Supabase loads.
  async function loadUnlock() {
    if (!pool.user) return unlocked();
    const { data, error } = await pool.sb.from('entitlements')
      .select('source, plan, status, expires_at').eq('user_id', pool.user.id).eq('product', 'golden_throne').maybeSingle();
    if (error) return unlocked(); // offline, or the table isn't set up yet: keep what we had
    // Kept even once a subscription lapses, so Profile & Crap can say when it ended
    writeJSON(UNLOCK_KEY, data ? { user: pool.user.id, source: data.source, plan: data.plan, status: data.status, expires: data.expires_at } : null);
    renderArcade();
    renderProfile();
    return unlocked();
  }
  window.loadUnlock = loadUnlock;

  // Signed in from a locked game's paywall: reopen that game, which now shows
  // the pay button (or just plays, for Founding Flushers and past buyers)
  function resumeUnlock() {
    const p = readJSON(PENDING_UNLOCK_KEY, null);
    if (!p || !pool.user) return;
    writeJSON(PENDING_UNLOCK_KEY, null);
    if (Date.now() - p.at > 30 * 60 * 1000) return;
    if (readJSON(POOL_INVITE_KEY, null)) return; // let them deal with the invite first
    openGame(p.id);
  }

  async function loadPool() {
    const { data: { session } } = await pool.sb.auth.getSession();
    pool.user = session ? session.user : null;
    const code = readJSON(POOL_INVITE_KEY, null);
    renderArcade();
    const unlockCheck = pool.user ? loadUnlock().catch(() => {}) : null;

    if (!pool.user) {
      pool.profile = null; pool.pools = []; pool.boards = {};
      saveCache();
      pool.view = code ? await inviteView(code) : { name: 'pitch' };
      return renderPool();
    }

    const [{ data: profile, error: profileError }, { data: pools, error }] = await Promise.all([
      pool.sb.from('profiles').select('*').eq('id', pool.user.id).maybeSingle(),
      pool.sb.from('pools').select('id,name,invite_code,owner_id').order('created_at'),
    ]);
    if (profileError) throw profileError;
    if (error) throw error;
    pool.profile = profile;
    pool.pools = pools || [];
    saveCache();
    if (!profile) { pool.view = { name: 'profile', emoji: '💩' }; return renderPool(); }
    // New sign-ups pick a throne name first, then land back here
    unlockCheck.then(resumeUnlock);

    await syncSessions();

    if (code) { pool.view = await inviteView(code); return renderPool(); }
    if (pool.pools.length === 0) { pool.view = { name: 'create' }; return renderPool(); }

    await loadBoard();
    pool.view = { name: 'board' };
    pool.stale = false;
    renderPool();
  }

  async function inviteView(code) {
    const { data } = await pool.sb.rpc('pool_preview', { p_code: code });
    const preview = data && data[0];
    if (!preview) { writeJSON(POOL_INVITE_KEY, null); return { name: 'pitch', note: 'That invite link has been flushed. Ask your mate for a fresh one.' }; }
    return { name: 'invite', preview, code };
  }

  // Plunging in: a plunger pumps over the sheet for at least a second while the
  // login code is checked, so it's seen even when Supabase answers instantly.
  let plungeEl = null;
  function plungeIn() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { stop() {}, async done() {} };
    const el = document.createElement('div');
    el.className = 'plunge-in';
    el.innerHTML = `<svg viewBox="0 0 34 60" aria-hidden="true">
        <rect x="14" y="0" width="6" height="40" rx="3" fill="#B5793A"/>
        <path d="M2,56 Q2,36 17,36 Q32,36 32,56 Z" fill="#C0392B"/>
      </svg><span>Plunging you in…</span>`;
    plungeEl = el;
    if (document.activeElement) document.activeElement.blur(); // drop the keyboard
    poolCard.scrollTop = 0;
    poolCard.appendChild(el);
    const minTime = new Promise(r => setTimeout(r, 1000));
    const stop = () => { if (plungeEl === el) plungeEl = null; el.remove(); };
    return {
      stop,
      async done() {
        await minTime;
        el.classList.add('out');
        setTimeout(stop, 200);
      },
    };
  }

  // ── RENDER ──
  const POOL_SHEET_HEAD = `<div class="hs-head">
      <div class="sheet-title">👑 Poop Pool</div>
      <button type="button" class="sheet-close" data-click="closeHomeSheet" aria-label="Close"><svg class="x-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <svg class="plunger" id="plunger" viewBox="0 0 34 60" aria-hidden="true">
      <rect x="14" y="0" width="6" height="40" rx="3" fill="#B5793A"/>
      <path d="M2,56 Q2,36 17,36 Q32,36 32,56 Z" fill="#C0392B"/>
    </svg>`;

  // Home tile: your rank when you're on a board, otherwise a big "join" card
  function renderPoolTile() {
    const tile = document.getElementById('poolTile');
    const v = pool.view || { name: 'loading' };
    const set = (big, sub) => {
      document.getElementById('tilePoolBig').textContent = big;
      document.getElementById('tilePoolSub').textContent = sub;
    };
    tile.classList.toggle('join', !pool.user);
    if (!pool.user) {
      return set(v.name === 'invite' ? "You're invited" : 'Join the Royal Flush',
        'Race your mates for the Golden Throne.');
    }
    const p = currentPool();
    if (v.name === 'board' && p && pool.board) {
      const i = pool.board.findIndex(r => r.is_me);
      const when = { week: 'This week', month: 'This month', all: 'All time' }[pool.period] || '';
      return set(i < 0 ? '—' : '#' + (i + 1), `${when} · ${p.name}`);
    }
    if (v.name === 'create') return set('Start one', 'Make a pool and invite your mates.');
    set('…', 'Warming up the seat');
  }

  function renderPool() {
    const v = pool.view || { name: 'loading' };
    const html = {
      loading: () => `<span class="section-label">👑 Poop Pool</span><p class="pool-sub">Warming up the seat…</p>`,
      pitch: viewPitch, sent: viewSent, invite: viewInvite, profile: viewProfile,
      create: viewCreate, board: viewBoard,
    }[v.name](v);
    poolCard.innerHTML = POOL_SHEET_HEAD + html + `<div class="pool-msg">${esc(pool.msg)}</div>`;
    if (plungeEl) poolCard.appendChild(plungeEl); // stays on top while login re-renders under it
    poolCard.hidden = false;
    poolCard.classList.toggle('stale', pool.stale);
    if (pool.sloshTab) {
      pool.sloshTab = false;
      const t = poolCard.querySelector('.pool-tab.active');
      if (t) t.classList.add('slosh');
    }
    renderPoolTile();
    if (v.name !== pool.shown) {
      pool.shown = v.name;
      poolCard.classList.remove('pool-enter');
      void poolCard.offsetWidth; // restart the fade
      poolCard.classList.add('pool-enter');
    }
    renderProfile();
  }

  // ── PROFILE SHEET (opened from the top-right button) ──
  const PERSON_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';

  function renderProfile(fresh) {
    if (fresh === true) { pool.sheetEdit = false; pool.msg = ''; }
    const me = pool.user && pool.profile;
    document.getElementById('settingsBtn').innerHTML = me
      ? `<span class="profile-emoji">${esc(pool.profile.emoji || '💩')}</span>` : PERSON_SVG;
    if (!document.body.classList.contains('sheet-open')) return;

    const head = document.getElementById('profileHead');
    const panel = document.getElementById('profilePanel');
    if (!pool.user) {
      head.innerHTML = `<div class="profile-id"><div class="profile-av">${PERSON_SVG}</div>
        <div class="profile-who"><b>Not signed in</b><span>Sign in to race your mates in a Poop Pool</span></div>
        <button class="pool-link" data-act="sheet-signin">Sign in</button></div>`;
      panel.innerHTML = '';
      return;
    }
    if (!pool.profile) {
      head.innerHTML = `<div class="profile-id"><div class="profile-av">💩</div>
        <div class="profile-who"><b>${esc(pool.user.email || '')}</b><span>Pick a throne name to finish signing up</span></div>
        <button class="pool-link" data-act="sheet-setup">Set up</button></div>`;
      panel.innerHTML = signOutHtml();
      return;
    }

    const p = pool.profile;
    head.innerHTML = pool.sheetEdit ? `
      <span class="section-label">Your Throne Name</span>
      <input class="pool-input js-name" maxlength="24" placeholder="Display name" value="${esc(p.display_name || '')}">
      <div class="emoji-row">${POOL_EMOJIS.map(e =>
        `<button type="button" class="emoji-opt ${e === p.emoji ? 'on' : ''}" data-act="emoji" data-emoji="${e}">${e}</button>`).join('')}</div>
      <div class="pool-btns">
        <button class="btn btn-ghost" data-act="sheet-cancel">Cancel</button>
        <button class="btn btn-start" data-act="save-profile" data-busy="Saving…">Save</button>
      </div>
      <div class="pool-msg">${esc(pool.msg)}</div>` : `
      <div class="profile-id"><div class="profile-av">${esc(p.emoji || '💩')}</div>
        <div class="profile-who"><b>${esc(p.display_name)}</b><span>${esc(pool.user.email || '')}</span></div>
        <button class="btn btn-ghost btn-icon btn-inline" data-act="sheet-edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>Edit</button></div>`;

    const cur = currentPool();
    const owner = cur && cur.owner_id === pool.user.id;
    const pools = pool.pools.map(x => x.id === (cur && cur.id)
      ? `<div class="sheet-pool on"><b>${esc(x.name)}</b><span class="pool-sub">CODE ${esc(x.invite_code)}</span></div>`
      : `<button class="sheet-pool" data-act="switch-pool" data-id="${x.id}"><b>${esc(x.name)}</b><span class="pool-sub" style="color:var(--muted)">SWITCH</span></button>`).join('');
    const unlock = readJSON(UNLOCK_KEY, null);
    const day = d => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' });
    const manage = PORTAL_LINK && unlock && unlock.plan
      ? `<div class="pool-btns"><button class="btn btn-ghost btn-icon" data-act="manage-sub"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>Manage subscription</button></div>` : '';
    const throne = !unlock
      ? `<p class="pool-text">Every Bog Arcade game for ${PLANS.monthly.price} a month or ${PLANS.yearly.price} a year. Open a locked game in the Bog Arcade to sign up.</p>`
      : !unlock.expires
      ? `<p class="pool-text">👑 Unlocked${unlock.source === 'founder' ? ' · <b>Founding Flusher</b>' : ''}. Every Bog Arcade game is yours${unlock.source === 'founder' ? ', forever' : ''}.</p>`
      : !activeUnlock(unlock)
      ? `<p class="pool-text">Your Golden Throne ended on ${day(unlock.expires)}. Open a locked game in the Bog Arcade to come back.</p>${manage}`
      : `<p class="pool-text">👑 Golden Throne · <b>${unlock.plan === 'yearly' ? 'Yearly' : 'Monthly'}</b>. ${unlock.status === 'canceling' ? 'Ends' : 'Renews'} ${day(unlock.expires)}.</p>${manage}`;
    panel.innerHTML = `
      ${unlock || paywallOn() ? `<div class="sheet-section"><span class="section-label">Golden Throne</span>${throne}</div>` : ''}
      <div class="sheet-section">
        <span class="section-label">Privacy</span>
        <label class="switch-row">
          <span>Share minutes only<small>Your pools see your bog time, not your $. Dollars per minute gives away your pay.</small></span>
          <input type="checkbox" id="shareMinutes" ${p.share_money ? '' : 'checked'}><i class="switch" aria-hidden="true"></i>
        </label>
      </div>
      <div class="sheet-section">
        <span class="section-label">👑 Your Poop Pools</span>
        ${pools || '<p class="pool-text">You\'re not in a pool yet.</p>'}
        ${cur ? `<div class="pool-btns"><button class="btn btn-start" data-act="invite">+ Invite mates</button></div>
        <div class="pool-btns">
          ${owner ? '<button class="btn btn-ghost" data-act="new-code" data-busy="Flushing…">New invite code</button>' : ''}
          <button class="btn btn-stop" data-act="leave" data-busy="Leaving…">Leave pool</button>
        </div>` : ''}
        <div class="pool-btns"><button class="btn btn-ghost btn-icon" data-act="sheet-new-pool"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Start a new pool</button></div>
      </div>
      ${signOutHtml()}`;
  }
  window.renderProfile = renderProfile;

  function signOutHtml() {
    // Delete my account asks once more before it goes (pool.confirmDelete)
    // A renewing subscription has to be cancelled first, or Stripe keeps charging a
    // deleted account (and Manage subscription can't find it any more)
    const renewing = subRenews();
    const del = !pool.user || pool.sheetEdit ? '' : pool.confirmDelete && renewing ? `
      <p class="pool-text" style="margin-top:14px">Your Golden Throne still renews. Cancel it in billing first, so you don't get charged after your account is gone.</p>
      <div class="pool-btns">
        <button class="btn btn-ghost" data-act="delete-cancel">Keep it</button>
        <button class="btn btn-ghost" data-act="manage-sub" data-busy="Opening…">Open billing</button>
      </div>` : pool.confirmDelete ? `
      <p class="pool-text" style="margin-top:14px">This deletes your throne name, the bogs you've uploaded${readJSON(UNLOCK_KEY, null) ? ', your pool spots and your Golden Throne unlock' : ' and your pool spots'}. Pools you run pass to a mate. Your Bog Log and salary stay on this phone. It can't be undone.</p>
      <div class="pool-btns">
        <button class="btn btn-ghost" data-act="delete-cancel">Keep it</button>
        <button class="btn btn-stop" data-act="delete-account" data-busy="Deleting…">Delete everything</button>
      </div>` : `
      <div class="pool-btns"><button class="btn btn-ghost" data-act="delete-ask" style="color:var(--muted);border-color:transparent">Delete my account</button></div>`;
    return `<div class="sheet-section">
      <div class="pool-btns" style="margin-top:0"><button class="btn btn-ghost" data-act="signout" data-busy="Signing out…">Sign out</button></div>
      ${del}
      ${pool.sheetEdit ? '' : `<div class="pool-msg">${esc(pool.msg)}</div>`}
    </div>`;
  }

  // Close the sheet and take them to the pool card
  function toPoolCard() {
    closeSettings();
    openHomeSheet('pool');
  }

  function viewPitch(v) {
    return `
      <span class="section-label">👑 Poop Pool</span>
      <div class="pool-title">The Royal Flush</div>
      <p class="pool-text">${esc(v.note || 'Race your mates for the Golden Throne. Private, invite-only leaderboards for bog time.')}</p>
      <input class="pool-input" id="poolEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com" value="${esc(v.email || '')}">
      <div class="pool-btns"><button class="btn btn-start" data-act="login">Email me a login code</button></div>
      <p class="pool-sub" style="margin-top:10px">No passwords. Your salary never leaves your phone.</p>`;
  }

  function viewSent(v) {
    return `
      <span class="section-label">👑 Poop Pool</span>
      <div class="pool-title">Check your inbox</div>
      <p class="pool-text" id="poolSentText">${sentText(v)}</p>
      <div class="input-row code-row">
        <input id="poolCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" aria-label="Login code">
        ${navigator.clipboard && navigator.clipboard.readText ? '<button type="button" class="code-paste" data-act="paste-code">Paste</button>' : ''}
      </div>
      <div class="pool-btns"><button class="btn btn-start" data-act="verify" data-busy="Checking…">Let me in</button></div>`;
  }

  function sentText(v) {
    return v.sending
      ? `Sending a login code to <b>${esc(v.email)}</b>…`
      : `We emailed a login code to <b>${esc(v.email)}</b>. Type it in here to get on the board. Not there? Check your spam.`;
  }

  // "Share minutes only" is one setting on the profile, so it covers every pool you're in.
  // On the join/create cards it only changes the screen until you tap Join or Create.
  function minutesOn(v) { return v.minutes != null ? v.minutes : !(pool.profile && pool.profile.share_money); }

  function minutesSwitch(on, sub) {
    return `<label class="switch-row pool-switch">
        <span>Share minutes only<small>${sub}</small></span>
        <input type="checkbox" class="js-minutes" ${on ? 'checked' : ''}><i class="switch" aria-hidden="true"></i>
      </label>`;
  }

  function moneyLine(v) {
    if (!pool.user) return '◐ $ earned on the bog, only if you opt in';
    return minutesOn(v) ? '✗ Your $ earned. Share minutes only is on.' : '✓ Your $ earned on the bog';
  }

  function moneyColor(v) { return pool.user && minutesOn(v) ? 'var(--muted)' : 'var(--amber)'; }

  function viewInvite(v) {
    const p = v.preview;
    const minutes = minutesOn(v);
    const action = pool.user
      ? `${minutesSwitch(minutes, 'Your pools see your bog time, not your $. Applies to all your pools. Change it anytime in Profile &amp; Crap.')}
         <div class="pool-btns"><button class="btn btn-start" data-act="join" data-busy="Joining…">Join the pool</button></div>`
      : `<input class="pool-input" id="poolEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com" value="${esc(v.email || '')}">
         <div class="pool-btns"><button class="btn btn-start" data-act="login">Email me a login code to join</button></div>`;
    return `
      <span class="section-label">💩 Poop Pool Invite</span>
      <p class="pool-sub" style="margin-top:14px">${esc(p.owner_name.toUpperCase())} INVITED YOU TO</p>
      <div class="pool-title" style="margin-top:4px">${esc(p.name)}</div>
      <p class="pool-text">${p.member_count} ${p.member_count === 1 ? 'mate is' : 'mates are'} already logging their bog time. Think you can take the Golden Throne?</p>
      <ul class="pool-list">
        <li>✓ Your bog time and session count</li>
        <li>✓ Your rank (and crown, if you earn it)</li>
        <li class="js-money-line" style="color:${moneyColor(v)}">${moneyLine(v)}</li>
        <li style="color:var(--muted)">✗ Your salary. It never leaves your phone.</li>
      </ul>
      ${action}
      <div class="pool-foot"><button class="pool-link" data-act="decline">No thanks</button></div>`;
  }

  function viewProfile(v) {
    const p = pool.profile || {};
    const emoji = v.emoji || p.emoji || '💩';
    return `
      <span class="section-label">👑 Poop Pool · Your Throne Name</span>
      <input class="pool-input js-name" maxlength="24" placeholder="Display name" value="${esc(p.display_name || '')}">
      <div class="emoji-row">${POOL_EMOJIS.map(e =>
        `<button type="button" class="emoji-opt ${e === emoji ? 'on' : ''}" data-act="emoji" data-emoji="${e}">${e}</button>`).join('')}</div>
      ${minutesSwitch(minutesOn(v), 'Your pools see your bog time, not your $. Dollars per minute gives away your pay.')}
      <div class="pool-btns"><button class="btn btn-start" data-act="save-profile" data-busy="Saving…">Save</button></div>`;
  }

  function viewCreate(v) {
    return `
      <span class="section-label">👑 Poop Pool</span>
      <div class="pool-title">Start a Poop Pool</div>
      <p class="pool-text">Name it, then send the invite link to your mates.</p>
      <input class="pool-input" id="poolNewName" maxlength="40" placeholder="e.g. Office Throne Room" value="${esc(v.newName || '')}">
      ${minutesSwitch(minutesOn(v), 'Your pools see your bog time, not your $. Applies to all your pools.')}
      <div class="pool-btns">
        ${pool.pools.length ? '<button class="btn btn-ghost" data-act="cancel">Cancel</button>' : ''}
        <button class="btn btn-start" data-act="create-pool" data-busy="Creating…">Create pool</button>
      </div>
      ${pool.pools.length ? '' : '<p class="pool-sub" style="margin-top:12px">Got an invite? Just open the link your mate sent.</p>'}`;
  }

  function fmtVal(r) { return fmtDuration(r.total_secs); }

  function subLine(r, rank, last) {
    const bits = [`${r.session_count} SESH`];
    if (r.earned != null) bits.push(fmtExact(Number(r.earned)));
    if (r.flagged_count > 0) bits.push('🚩 SUSPICIOUS LOG');
    if (last) return `<span class="low">💤 CONSTIPATED · ${bits.join(' · ')}</span>`;
    return `<span>${bits.join(' · ')}</span>`;
  }

  function nudge(board) {
    const i = board.findIndex(r => r.is_me);
    if (i < 0) return '';
    const me = board[i];
    if (me.total_secs === 0) return '🚽 Log a bog to get on the board.';
    if (i === 0) return '👑 You hold the Golden Throne. Defend it.';
    const gap = Math.max(1, Math.ceil((board[i - 1].total_secs - me.total_secs) / 60));
    const prize = i <= 2 ? `the ${RANK_TITLES[i - 1].toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}` : `${board[i - 1].display_name}'s spot`;
    return `🏁 You're ${gap} min off ${esc(prize)}. Get back on the throne.`;
  }

  function viewBoard() {
    const p = currentPool();
    const b = pool.board;
    const tabs = [['week', 'This Week'], ['month', 'This Month'], ['all', 'All Time']]
      .map(([k, l]) => `<button class="pool-tab ${pool.period === k ? 'active' : ''}" data-act="period" data-period="${k}">${l}</button>`).join('');
    const picker = pool.pools.length > 1
      ? `<select class="pool-select" id="poolPicker">${pool.pools.map(x =>
          `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`
      : '';

    const top = b.slice(0, 3);
    const order = [1, 0, 2].filter(i => top[i]); // 2nd, 1st, 3rd
    const podium = order.map(i => {
      const r = top[i];
      return `<div class="podium-col p${i + 1}">
        ${i === 0 ? '<div style="font-size:20px">👑</div>' : ''}
        <div class="podium-av">${esc(r.emoji)}</div>
        <div class="podium-name">${esc(r.display_name)}${r.is_me ? ' (you)' : ''}</div>
        <div class="podium-val">${fmtVal(r)}</div>
        ${r.earned != null ? `<div class="pool-sub">${fmtExact(Number(r.earned))}</div>` : ''}
        ${r.flagged_count > 0 ? '<div class="pool-sub">🚩 SUS</div>' : ''}
        <div class="pillar"><b>${i + 1}</b><span>${RANK_TITLES[i]}</span></div>
      </div>`;
    }).join('');

    const rest = b.slice(3).map((r, j) => {
      const rank = j + 4;
      const last = rank === b.length && b.length > 3;
      return `<div class="pool-row ${r.is_me ? 'me' : ''}">
        <div class="pool-rank">${rank}</div><div class="pool-av">${esc(r.emoji)}</div>
        <div class="pool-who"><b>${esc(r.display_name)}${r.is_me ? ' (you)' : ''}</b>${subLine(r, rank, last)}</div>
        <div class="pool-val">${fmtVal(r)}</div></div>`;
    }).join('');

    const n = nudge(b);
    return `
      <div class="pool-head"><span class="section-label">👑 Poop Pool</span>${picker}</div>
      <div class="pool-title">${esc(p.name)}</div>
      <div class="pool-sub">THE ROYAL FLUSH · ${b.length} ${b.length === 1 ? 'MATE' : 'MATES'}</div>
      <div class="pool-tabs">${tabs}</div>
      ${b.length < 2 ? '<p class="pool-text">It\'s lonely on the throne. Invite your mates to start the race.</p>' : ''}
      <div class="podium">${podium}</div>
      ${rest ? `<div class="pool-rest">${rest}</div>` : ''}
      ${n ? `<div class="pool-nudge">${n}</div>` : ''}
      <div class="pool-btns"><button class="btn btn-start" data-act="invite">+ Invite mates</button></div>
      <div class="pool-btns">
        <button class="btn btn-ghost btn-icon" data-act="new-pool"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>New pool</button>
        <button class="btn btn-ghost btn-icon" data-act="settings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Settings</button>
      </div>`;
  }

  // ── ACTIONS ──
  const actions = {
    async login() {
      const email = (document.getElementById('poolEmail').value || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('That email looks blocked up.');
      // Move to the code screen straight away; sending the email takes a few seconds.
      const from = pool.view;
      pool.view = { name: 'sent', email, sending: true, from };
      renderPool();
      // On phones, don't pop the keyboard: it covers the screen and they're off to Mail first.
      // Desktop keeps the focus so the code can be typed or pasted straight in.
      if (matchMedia('(hover: hover) and (pointer: fine)').matches) document.getElementById('poolCode').focus();
      else if (document.activeElement) document.activeElement.blur();
      const captchaToken = await captcha.get();
      const { error } = await pool.sb.auth.signInWithOtp({
        email, options: { emailRedirectTo: location.origin + location.pathname, captchaToken },
      });
      captcha.used();
      if (error) {
        pool.view = Object.assign({}, from, { email }); renderPool();
        if (/captcha/i.test(error.message || '')) throw new Error('We couldn\'t check you\'re a human. Give it a sec and try again.');
        throw error;
      }
      pool.view.sending = false;
      // Update the line in place so a code already being typed isn't wiped
      const t = document.getElementById('poolSentText');
      if (t) t.innerHTML = sentText(pool.view);
      return 'done';
    },
    // A typed code works inside the home screen app. A link in the email would
    // open in Safari, which on iPhone doesn't share its login with the app.
    // Long-press paste is fiddly on a numeric keyboard, so offer a button
    async 'paste-code'(el) {
      el.disabled = false;
      const input = document.getElementById('poolCode');
      let text = '';
      try { text = await navigator.clipboard.readText(); } catch (e) {}
      const code = (text.match(/\b\d{6}\b/) || [''])[0];
      if (!code) { input.placeholder = 'Copy the code first'; input.focus(); return 'done'; }
      input.value = code;
      // After this tap finishes, so the six digits can log straight in
      setTimeout(() => input.dispatchEvent(new Event('input', { bubbles: true })), 0);
      return 'done';
    },
    async verify() {
      const token = (document.getElementById('poolCode').value || '').replace(/\D/g, '');
      if (token.length < 6) throw new Error('That code looks a few digits short.');
      const plunge = plungeIn();
      try {
        const { error } = await pool.sb.auth.verifyOtp({ email: pool.view.email, token, type: 'email' });
        if (error) throw new Error('That code didn\'t flush. Check it, or ask for a new one.');
        await refreshPool();
      } catch (e) { plunge.stop(); throw e; }
      await plunge.done(); return 'done';
    },
    async decline() { writeJSON(POOL_INVITE_KEY, null); await refreshPool(); return 'done'; },
    async join(el, root) {
      await saveShareMoney(!root.querySelector('.js-minutes').checked);
      const { data: pid, error } = await pool.sb.rpc('join_pool', { p_code: pool.view.code });
      if (error) throw error;
      writeJSON(POOL_INVITE_KEY, null);
      if (pid) writeJSON(POOL_CURRENT_KEY, pid);
      await refreshPool(); return 'done';
    },
    async emoji(el, root) {
      root.querySelectorAll('.emoji-opt').forEach(b => b.classList.toggle('on', b === el));
      return 'done';
    },
    async 'save-profile'(el, root) {
      const name = root.querySelector('.js-name').value.trim();
      if (!name) throw new Error('Pick a throne name first.');
      const on = root.querySelector('.emoji-opt.on');
      const minutes = root.querySelector('.js-minutes');
      const row = {
        id: pool.user.id, display_name: name.slice(0, 24),
        emoji: on ? on.dataset.emoji : '💩',
        share_money: minutes ? !minutes.checked : !!(pool.profile && pool.profile.share_money),
      };
      const { error } = await pool.sb.from('profiles').upsert(row);
      if (error) throw error;
      pool.profile = row;
      pool.sheetEdit = false;
      await refreshPool(); return 'done';
    },
    async 'create-pool'(el, root) {
      const name = document.getElementById('poolNewName').value.trim();
      if (!name) throw new Error('Give your pool a name.');
      await saveShareMoney(!root.querySelector('.js-minutes').checked);
      const { data, error } = await pool.sb.rpc('create_pool', { p_name: name });
      if (error) throw error;
      writeJSON(POOL_CURRENT_KEY, data.id);
      await refreshPool(); return 'done';
    },
    async period(el) { pool.period = el.dataset.period; pool.sloshTab = true; await showBoard(); },
    async invite() {
      const p = currentPool();
      const url = inviteLink(p.invite_code);
      // The link goes inside the text: iOS's share sheet "Copy" (and some apps) keep
      // only `text` and drop a separate `url`.
      const text = `Think you spend less time on the bog than me? Join ${p.name} on Gross Income 💩\n${url}`;
      if (navigator.share) {
        try { await navigator.share({ title: 'Poop Pool invite', text }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(url); pool.msg = 'Invite link copied. Paste it to your mates.'; }
      catch (e) { pool.msg = 'Send your mates this link: ' + url; }
    },
    async 'new-pool'() { pool.view = { name: 'create' }; },
    async settings() { openSettings(); return 'done'; },
    async cancel() { pool.view = { name: 'board' }; await showBoard(); },
    async 'sheet-edit'() { pool.sheetEdit = true; },
    async 'sheet-cancel'() { pool.sheetEdit = false; },
    async 'sheet-signin'() {
      toPoolCard();
      const email = document.getElementById('poolEmail');
      if (email) email.focus({ preventScroll: true });
      return 'done';
    },
    async 'sheet-setup'() { toPoolCard(); return 'done'; },
    async 'sheet-new-pool'() { pool.view = { name: 'create' }; renderPool(); toPoolCard(); return 'done'; },
    async 'switch-pool'(el) { writeJSON(POOL_CURRENT_KEY, el.dataset.id); await showBoard(); },
    async 'new-code'() {
      const p = currentPool();
      const { data, error } = await pool.sb.rpc('regenerate_invite_code', { p_pool: p.id });
      if (error) throw error;
      p.invite_code = data;
      pool.msg = 'Old invite links are flushed. New code: ' + data;
    },
    async leave() {
      const p = currentPool();
      const { error } = await pool.sb.from('pool_members').delete().eq('pool_id', p.id).eq('user_id', pool.user.id);
      if (error) throw error;
      writeJSON(POOL_CURRENT_KEY, null);
      await refreshPool(); return 'done';
    },
    async 'manage-sub'(el) {
      // Straight into this person's Stripe billing page. Apple Pay / Google Pay can save a
      // different email on the Stripe customer, so the portal's email login may not reach them.
      const { data, error } = await pool.sb.functions.invoke('billing-portal');
      setTimeout(() => { el.disabled = false; }, 3000); // usable again if they come back
      if (!error && data && data.url) { location.href = data.url; return 'done'; }
      // Fallback: Stripe's email login
      location.href = PORTAL_LINK + (pool.user.email ? '?prefilled_email=' + encodeURIComponent(pool.user.email) : '');
      return 'done';
    },
    async 'delete-ask'() { pool.confirmDelete = true; renderProfile(); return 'done'; },
    async 'delete-cancel'() { pool.confirmDelete = false; renderProfile(); return 'done'; },
    async 'delete-account'() {
      if (subRenews()) return 'done';
      const { error } = await pool.sb.rpc('delete_my_account');
      if (error) throw error;
      // The login is gone on the server, so only clear it here
      await pool.sb.auth.signOut({ scope: 'local' }).catch(() => {});
      pool.confirmDelete = false;
      writeJSON(POOL_CURRENT_KEY, null);
      writeJSON(POOL_DELETED_KEY, []);
      return actions.signout(true);
    },
    async signout(gone) {
      if (gone !== true) await pool.sb.auth.signOut();
      pool.profile = null; pool.pools = []; pool.sheetEdit = false; pool.confirmDelete = false;
      writeJSON(POOL_SYNCED_KEY, null);
      writeJSON(UNLOCK_KEY, null);
      await refreshPool(); return 'done';
    },
  };

  // Turning on "share minutes only" re-uploads every bog with earned blanked out, so
  // the $ is gone from Supabase, not just hidden on screen.
  async function saveShareMoney(share_money) {
    if (pool.profile && !!pool.profile.share_money === share_money) return;
    const { error } = await pool.sb.from('profiles').update({ share_money }).eq('id', pool.user.id);
    if (error) throw error;
    pool.profile = Object.assign({}, pool.profile, { share_money });
    pool.boards = {};
    saveCache();
    await syncSessions();
  }

  async function setShareMinutes(box) {
    const share_money = !box.checked;
    box.disabled = true;
    pool.msg = '';
    try {
      if (!(await sbReady)) throw new Error('Poop Pool is offline right now.');
      await saveShareMoney(share_money);
      pool.msg = share_money ? 'Your pools can now see your $ earned.' : 'Your $ is hidden. Pools only see your minutes.';
      if (pool.view && pool.view.name === 'board') await showBoard();
      renderPool();
    } catch (err) {
      box.checked = !box.checked;
      box.disabled = false;
      const m = document.querySelector('#profilePanel .pool-msg');
      if (m) m.textContent = errText(err);
    }
  }

  // Taps that only change the screen, so they work before Supabase has loaded
  const LOCAL_ACTS = new Set(['emoji', 'settings', 'delete-ask', 'delete-cancel', 'sheet-edit', 'sheet-cancel', 'sheet-signin', 'sheet-setup', 'sheet-new-pool']);

  async function onPoolClick(e) {
    const root = e.currentTarget;
    const el = e.target.closest('[data-act]');
    if (!el || pool.busy) return;
    pool.busy = true;
    el.disabled = true;
    const label = el.dataset.busy ? el.textContent : null;
    if (label !== null) el.textContent = el.dataset.busy;
    pool.msg = '';
    try {
      // A tap on the saved board can land before Supabase has loaded
      if (!LOCAL_ACTS.has(el.dataset.act) && !pool.sb && !(await sbReady)) throw new Error('Poop Pool is offline right now.');
      if (poolRefresh) await poolRefresh.catch(() => {});
      const r = await actions[el.dataset.act](el, root);
      if (r !== 'done') renderPool();
    } catch (err) {
      pool.msg = errText(err);
      root.querySelectorAll('.pool-msg').forEach(m => { m.textContent = pool.msg; });
      el.disabled = false;
      if (label !== null) el.textContent = label;
    } finally {
      pool.busy = false;
    }
  }
  ['poolCard', 'profileHead', 'profilePanel'].forEach(id =>
    document.getElementById(id).addEventListener('click', onPoolClick));
  document.getElementById('profilePanel').addEventListener('change', (e) => {
    if (e.target.id === 'shareMinutes') setShareMinutes(e.target);
  });

  // The join/create switch is remembered on the view (so a re-render keeps it) and
  // flips the "$ earned" line on the invite straight away.
  poolCard.addEventListener('change', (e) => {
    if (!e.target.classList.contains('js-minutes') || !pool.view) return;
    pool.view.minutes = e.target.checked;
    const line = poolCard.querySelector('.js-money-line');
    if (line) { line.textContent = moneyLine(pool.view); line.style.color = moneyColor(pool.view); }
  });
  poolCard.addEventListener('input', (e) => {
    if (e.target.id === 'poolNewName' && pool.view) pool.view.newName = e.target.value;
  });

  // Six digits in (typed, pasted or iOS autofill) logs straight in
  poolCard.addEventListener('input', (e) => {
    if (e.target.id !== 'poolCode' || e.target.value.replace(/\D/g, '').length !== 6) return;
    const btn = poolCard.querySelector('[data-act="verify"]');
    if (btn && !btn.disabled) btn.click();
  });

  // Keep the code box visible above the phone keyboard
  poolCard.addEventListener('focusin', (e) => {
    if (e.target.id === 'poolEmail') captcha.prime();
    // Only scroll when the keyboard actually covers it, so a second tap (to paste) lands where it was aimed
    if (e.target.id === 'poolCode') setTimeout(() => {
      const r = e.target.getBoundingClientRect();
      const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      if (r.top < 0 || r.bottom > h - 12) e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 300);
  });

  poolCard.addEventListener('change', async (e) => {
    if (e.target.id !== 'poolPicker' || pool.busy) return;
    writeJSON(POOL_CURRENT_KEY, e.target.value);
    pool.busy = true;
    try {
      if (!(await sbReady)) throw new Error('Poop Pool is offline right now.');
      await showBoard(); renderPool(); } catch (err) { pool.msg = errText(err); renderPool(); }
    finally { pool.busy = false; }
  });

  window.poolOnSession = async () => {
    if (!pool.sb || !pool.user) return;
    try {
      await syncSessions();
      if (pool.view && pool.view.name === 'board') { await loadBoard(); renderPool(); }
    } catch (e) { console.warn('Poop Pool refresh failed', e); }
  };

  // Plunger pop: pull the board down from the top to refresh it
  (function plungerPull() {
    let y0 = null, pull = 0;
    poolCard.addEventListener('touchstart', e => {
      y0 = poolCard.scrollTop <= 0 && pool.view && pool.view.name === 'board' && pool.user && !pool.busy
        ? e.touches[0].clientY : null;
      pull = 0;
    }, { passive: true });
    poolCard.addEventListener('touchmove', e => {
      if (y0 === null) return;
      const dy = e.touches[0].clientY - y0;
      if (dy <= 0) { pull = 0; return; }
      e.preventDefault(); // we're pulling, not scrolling
      pull = Math.min(dy * 0.45, 90);
      const pl = document.getElementById('plunger');
      pl.style.opacity = Math.min(1, pull / 50);
      pl.style.transform = `translateY(${pull - 40}px) scale(${1 + pull / 300}, ${1 - pull / 400})`;
    }, { passive: false });
    poolCard.addEventListener('touchend', async () => {
      if (y0 === null) return;
      y0 = null;
      const pl = document.getElementById('plunger');
      pl.style.transform = '';
      pl.style.opacity = '';
      if (pull < 60) return;
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        pl.style.setProperty('--pull', (pull - 40) + 'px');
        pl.classList.add('popping');
        [[-46, -20], [46, -24], [-30, 20], [34, 18]].forEach(([dx, dy]) => {
          const p = document.createElement('span');
          p.className = 'puff';
          p.style.setProperty('--dx', dx + 'px');
          p.style.setProperty('--dy', dy + 'px');
          poolCard.appendChild(p);
          setTimeout(() => p.remove(), 600);
        });
      }
      // Let the pop finish before the board re-renders over it
      poolCard.classList.add('stale');
      const popped = new Promise(r => setTimeout(r, 520));
      try { await syncSessions(); await loadBoard(); } catch (e) { pool.msg = errText(e); }
      await popped;
      renderPool();
    });
  })();

  window.poolOnDelete = starts => {
    writeJSON(POOL_DELETED_KEY, [...new Set([...readJSON(POOL_DELETED_KEY, []), ...starts])]);
    window.poolOnSession();
  };

  // ── BOOT ──
  (function bootPool() {
    const q = new URLSearchParams(location.search);
    if (q.has('pool')) {
      writeJSON(POOL_INVITE_KEY, q.get('pool').toUpperCase().slice(0, 12));
      q.delete('pool');
      const qs = q.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    }

    // Show the last board we saw right away instead of "Warming up the seat…"
    const cache = readJSON(POOL_CACHE_KEY, null);
    if (cache && cache.user && cache.profile && !readJSON(POOL_INVITE_KEY, null)) {
      pool.user = cache.user;
      pool.profile = cache.profile;
      pool.pools = cache.pools || [];
      pool.boards = cache.boards || {};
      const k = boardKey();
      if (k && pool.boards[k]) { pool.board = pool.boards[k]; pool.view = { name: 'board' }; }
      else if (pool.pools.length === 0) pool.view = { name: 'create' };
    }
    renderPool();
    renderFounderBar(); // signed in from the cache: no need to nag
    if (readJSON(POOL_INVITE_KEY, null)) openHomeSheet('pool');

    const s = document.createElement('script');
    s.src = SUPABASE_JS;
    s.integrity = SUPABASE_JS_SRI;
    s.crossOrigin = 'anonymous';
    s.onload = async () => {
      pool.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      sbReadyResolve(true);
      // Only re-render when the signed-in person actually changes (e.g. arriving from a
      // magic link). Deferred because awaiting Supabase calls inside this callback deadlocks.
      pool.sb.auth.onAuthStateChange((event, session) => {
        const id = session ? session.user.id : null;
        if (id === (pool.user ? pool.user.id : null)) return;
        setTimeout(() => refreshPool().catch(e => { pool.msg = errText(e); renderPool(); }), 0);
      });
      // Login emails link back here with ?token_hash=… (not to supabase.co), which
      // keeps the link on our own domain and out of spam folders.
      const q2 = new URLSearchParams(location.search);
      const tokenHash = q2.get('token_hash');
      if (tokenHash) {
        const type = q2.get('type') || 'email';
        ['token_hash', 'type'].forEach(k => q2.delete(k));
        const qs = q2.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
        const { error } = await pool.sb.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) pool.msg = 'That login link has expired. Ask for a new one.';
      }
      try { await refreshPool(); } catch (e) { pool.msg = errText(e); renderPool(); }
      // Back from Stripe Checkout. The webhook can take a few seconds to land.
      if (new URLSearchParams(location.search).has('unlocked')) {
        const q3 = new URLSearchParams(location.search);
        q3.delete('unlocked');
        const qs3 = q3.toString();
        history.replaceState(null, '', location.pathname + (qs3 ? '?' + qs3 : '') + location.hash);
        for (let i = 0; i < 8; i++) {
          if (await loadUnlock().catch(() => false)) { document.getElementById('unlockBar').hidden = false; break; }
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    };
    s.onerror = () => { sbReadyResolve(false); pool.msg = 'Poop Pool is offline right now.'; renderPool(); };
    // Signed in, or arriving from an invite or login link: load Supabase straight away.
    // Otherwise it waits until the page has settled, so first paint doesn't pay for it.
    const loadSb = () => { if (!s.isConnected) document.body.appendChild(s); };
    if (pool.user || readJSON(POOL_INVITE_KEY, null) || q.has('token_hash')) loadSb();
    else {
      const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1500));
      const later = () => idle(loadSb, { timeout: 3000 });
      if (document.readyState === 'complete') later(); else window.addEventListener('load', later, { once: true });
      // A tap on the pool card (e.g. the email box) shouldn't wait for idle time
      poolCard.addEventListener('pointerdown', loadSb, { once: true });
    }
  })();

  // ── HOME SCREEN APP ──
  // sw.js always fetches the page fresh when online, so opening the app gets the
  // latest version. A home screen app can sit open in the background for days,
  // so when it comes back we check whether a newer version has been deployed.
  (function () {
    const bar = document.getElementById('appBar');
    const text = document.getElementById('appBarText');
    const btn = document.getElementById('appBarBtn');
    const INSTALL_HINT_KEY = 'gi.installHintDismissed';
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIOSSafari = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    const safariVersion = +((ua.match(/Version\/(\d+)/) || [])[1] || 0);
    const isIOS26 = safariVersion >= 26;
    let barKind = null;
    let installPrompt = null;
    // Dismissing the install hint snoozes it for two weeks. ?installhint shows it now.
    const HINT_SNOOZE_MS = 14 * 24 * 3600 * 1000;
    if (new URLSearchParams(location.search).has('installhint')) writeJSON(INSTALL_HINT_KEY, null);
    function hintSnoozed() {
      const t = readJSON(INSTALL_HINT_KEY, null);
      return t === 'installed' || (typeof t === 'number' && Date.now() - t < HINT_SNOOZE_MS);
    }

    function showBar(kind, html, btnLabel) {
      barKind = kind;
      document.getElementById('appBarIcon').hidden = kind !== 'install';
      bar.classList.toggle('is-install', kind === 'install');
      bar.classList.toggle('is-update', kind === 'update');
      text.innerHTML = html;
      btn.hidden = !btnLabel;
      btn.textContent = btnLabel || '';
      bar.hidden = false;
    }
    function hideBar() { bar.hidden = true; barKind = null; }

    document.getElementById('appBarX').addEventListener('click', () => {
      if (barKind === 'install') writeJSON(INSTALL_HINT_KEY, Date.now());
      hideBar();
    });
    btn.addEventListener('click', async () => {
      if (barKind === 'update') { location.reload(); return; }
      if (barKind === 'install' && installPrompt) {
        installPrompt.prompt();
        await installPrompt.userChoice.catch(() => {});
        installPrompt = null;
        hideBar();
      }
    });

    const guide = document.getElementById('a2hs');
    guide.classList.toggle('ios26', isIOS26);
    text.addEventListener('click', (e) => {
      if (e.target.id === 'a2hsOpen') guide.hidden = false;
    });
    guide.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) guide.hidden = true;
    });

    // Install hint: only after the first salary save, so first visits stay clean.
    const INSTALL_TITLE = '<span class="app-bar-title">Put Gross Income on your home screen for easy on the bog access!</span>';
    function maybeShowInstallHint() {
      if (standalone || barKind || hintSnoozed()) return;
      if (!document.body.classList.contains('has-salary')) return;
      if (installPrompt) {
        showBar('install', INSTALL_TITLE + 'Tap Install to add it.', 'Install');
      } else if (isIOSSafari) {
        showBar('install', INSTALL_TITLE + (isIOS26
          ? 'Tap the menu button in the address bar, then Share, then <b>Add to Home Screen</b>.'
          : 'Tap Share (or ⋯ then Share), then <b>Add to Home Screen</b>.') +
          '<button type="button" class="app-bar-btn" id="a2hsOpen">Show me how</button>');
      }
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      installPrompt = e;
      maybeShowInstallHint();
    });
    window.addEventListener('appinstalled', () => {
      writeJSON(INSTALL_HINT_KEY, 'installed');
      if (barKind === 'install') hideBar();
    });
    new MutationObserver(maybeShowInstallHint).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    setTimeout(maybeShowInstallHint, 1500);

    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').catch(() => {});

    // New version check. Cloudflare Pages sends no ETag or Last-Modified for HTML, so
    // fingerprint the page's <style> plus app.js, for the copy we're running and for a
    // fresh copy from the server. The running app.js is read back from the browser cache
    // right after load (a deploy landing in that second just shows the bar one open late).
    async function fingerprint(doc, fresh) {
      const css = [...doc.querySelectorAll('style')].map(el => el.textContent).join('\n');
      const js = await fetch('app.js', { cache: fresh ? 'no-store' : 'default' }).then(r => r.ok ? r.text() : '');
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(css + '\n' + js));
      return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let loadedVersion = null;
    async function pageVersion() {
      const res = await fetch(location.pathname, { cache: 'no-store' });
      if (!res.ok) return null;
      return fingerprint(new DOMParser().parseFromString(await res.text(), 'text/html'), true);
    }
    if (crypto.subtle) fingerprint(document, false).then(v => { loadedVersion = v; }).catch(() => {});

    async function checkForUpdate() {
      try {
        const v = await pageVersion();
        // Never interrupt a bog in progress: an unsaved timer is lost on reload.
        if (!v || !loadedVersion || v === loadedVersion || running || seconds > 0) return;
        showBar('update', '<b>Fresh drop.</b> A new version of Gross Income is ready.', 'Refresh');
      } catch (e) {}
    }
    // ?freshdrop shows the bar now, to preview it
    if (new URLSearchParams(location.search).has('freshdrop')) {
      showBar('update', '<b>Fresh drop.</b> A new version of Gross Income is ready.', 'Refresh');
    }
    // Once soon after opening, in case a slow network meant the saved copy was shown
    setTimeout(checkForUpdate, 6000);
    let lastCheck = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 60000) return;
      lastCheck = Date.now();
      checkForUpdate();
    });
  })();
