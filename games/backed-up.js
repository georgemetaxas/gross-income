// ══ BACKED UP ══
// You're Dazza the plumber. The dunny is about to flush and the pipes are all over the shop.
// Tap a pipe to twist it and line up a run from the dunny (top) to the drain (bottom)
// before the sludge gets there. Leave a gap and she blows: poo (and a bit of wee) all over the screen.
// Loaded only when someone opens it.
//
// window.BackedUp.mount(el, { hourly: () => number, onExit: () => void })
// draws the game into el and returns { destroy() }.
(function () {
  // Add a job by adding a line. head = seconds before the flush, tile = seconds the sludge
  // takes per pipe, roots = dead squares, rusty = seized pipes that won't twist.
  const LEVELS = [
    { name: 'Blocked Dunny', cols: 5, rows: 6, head: 9, tile: 1.7, roots: 0, rusty: 0, sub: '5×6 · nice and slow' },
    { name: 'Share House', cols: 5, rows: 7, head: 8, tile: 1.5, roots: 0, rusty: 0, sub: '5×7 · five blokes, one loo' },
    { name: 'Tree Roots', cols: 6, rows: 7, head: 8, tile: 1.4, roots: 5, rusty: 0, sub: '6×7 · roots in the line' },
    { name: 'Rusty Reno', cols: 6, rows: 8, head: 7, tile: 1.3, roots: 3, rusty: 3, sub: '6×8 · seized pipes' },
    { name: 'Half-Time Rush', cols: 6, rows: 8, head: 6, tile: 1.1, roots: 5, rusty: 3, sub: '6×8 · the whole pub at once' },
    { name: 'Curry Night', cols: 7, rows: 8, head: 6, tile: 1.0, roots: 7, rusty: 4, sub: '7×8 · God help us' },
  ];
  const FAST = 6; // how much quicker the sludge runs once you hit Flush it
  const PROGRESS_KEY = 'gi.backedup.v1';
  const MUTE_KEY = 'gi.backedup.muted';
  const OUT = '#3F230C', DARK = '#1A1208', MUCK = '#8A4F22', WEE = '#F7D842';
  // Sides: 0 north, 1 east, 2 south, 3 west
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  // Dazza's one-liners
  const SAY = {
    start: ["Twist 'em into line before she flushes.", "Dunny to drain. Don't muck about.", "Righto. Tap a pipe to twist it."],
    roots: ['Tree roots. Go round them.', "Roots in the line. Classic."],
    rusty: ["Green ones are seized. Work round 'em.", 'Rusty pipes won\'t budge, mate.'],
    flow: ['Here she comes!', "She's away!", 'Incoming!'],
    danger: ['Twist that one, quick!', 'That one! THAT ONE!', 'Mate. MATE. The pipe!'],
    linked: ["She's connected. Flush it!", 'Beauty. Send it!'],
    fast: ['Sending it!', 'Hold your nose!'],
    seized: ['Seized solid, that one.', "Won't budge. Go round."],
    win: ["Beauty. I'll send the invoice.", 'Too easy.', "She's flowing like a dream."],
  };
  const BURSTS = [
    "That's a hazmat job now.",
    "Don't. Touch. Anything.",
    'The carpet was new, too.',
    "You're wearing most of it.",
    "I'd open a window. All of them.",
  ];
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Branch previews unlock every job so they can all be tested
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
  // Dazza, clean and after a burst. Drawn in the same cartoon style as the arcade tiles.
  const DAZZA = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 0 232 256" aria-hidden="true"><rect x="67" y="196" width="22" height="42" rx="9" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="74" cy="242" rx="22" ry="9" fill="#4CAF6E" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="74" cy="238" rx="15" ry="7" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><rect x="111" y="196" width="22" height="42" rx="9" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="126" cy="242" rx="22" ry="9" fill="#4CAF6E" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="126" cy="238" rx="15" ry="7" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M30 132 L22 46" stroke="#3F230C" stroke-width="15" stroke-linecap="round"/><path d="M30 132 L22 46" stroke="#D9A066" stroke-width="7" stroke-linecap="round"/><path d="M-6 44 Q-4 10 22 10 Q48 10 50 44 Q22 54 -6 44 Z" fill="#E5484D" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="10" cy="24" rx="7" ry="3" fill="#fff" opacity=".5" transform="rotate(-30 10 24)"/><path d="M172 150 L188 196" stroke="#3F230C" stroke-width="20" stroke-linecap="round"/><path d="M172 150 L188 196" stroke="#C9D8E2" stroke-width="10" stroke-linecap="round"/><path d="M176 208 A18 18 0 1 0 204 204 L192 208 L190 198 Z" fill="#C9D8E2" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M54 138 Q30 140 30 118" fill="none" stroke="#3F230C" stroke-width="30" stroke-linecap="round"/><path d="M54 138 Q30 140 30 118" fill="none" stroke="#E9B48A" stroke-width="19" stroke-linecap="round"/><path d="M146 138 Q168 142 172 158" fill="none" stroke="#3F230C" stroke-width="30" stroke-linecap="round"/><path d="M146 138 Q168 142 172 158" fill="none" stroke="#E9B48A" stroke-width="19" stroke-linecap="round"/><path d="M52 176 L148 176 L150 212 L106 212 L100 198 L94 212 L50 212 Z" fill="#2F5D8C" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="100" cy="182" rx="44" ry="16" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="100" cy="186" r="3" fill="#3F230C"/><path d="M46 150 Q40 108 76 104 L124 104 Q160 108 154 150 Q156 182 100 180 Q44 182 46 150 Z" fill="#F58A1F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><rect x="48" y="140" width="104" height="11" fill="#E8EEF2" stroke="#3F230C" stroke-width="3"/><rect x="62" y="107" width="11" height="34" fill="#E8EEF2" stroke="#3F230C" stroke-width="3"/><rect x="127" y="107" width="11" height="34" fill="#E8EEF2" stroke="#3F230C" stroke-width="3"/><path d="M86 104 L100 126 L114 104" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="54" cy="74" r="10" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="146" cy="74" r="10" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M56 70 Q56 110 100 112 Q144 110 144 70 Q144 30 100 30 Q56 30 56 70 Z" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="72" cy="90" rx="9" ry="5" fill="#F08A7A" opacity=".55"/><ellipse cx="128" cy="90" rx="9" ry="5" fill="#F08A7A" opacity=".55"/><ellipse cx="81.0" cy="66" rx="15" ry="17" fill="#fff" stroke="#3F230C" stroke-width="4"/><circle cx="84.0" cy="64.3" r="7.5" fill="#1A1208"/><circle cx="86.62" cy="61.3" r="2.4" fill="#fff"/><ellipse cx="119.0" cy="66" rx="15" ry="17" fill="#fff" stroke="#3F230C" stroke-width="4"/><circle cx="122.0" cy="64.3" r="7.5" fill="#1A1208"/><circle cx="124.62" cy="61.3" r="2.4" fill="#fff"/><path d="M82 96 Q100 122 118 96 Z" fill="#1A1208" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M88 99 L112 99 L110 104 Q100 108 90 104 Z" fill="#fff"/><path d="M100 88 Q84 78 68 92 Q72 104 100 96 Q128 104 132 92 Q116 78 100 88 Z" fill="#7A451D" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="100" cy="82" rx="13" ry="10" fill="#EE9C82" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="96" cy="78" rx="4" ry="2.5" fill="#fff" opacity=".6"/><path d="M52 52 Q54 12 100 12 Q146 12 148 52 Q100 40 52 52 Z" fill="#F5C842" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M140 44 Q176 40 184 56 Q160 62 142 56 Z" fill="#F5C842" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M100 18 Q106 24 103 30 L110 30 Q114 38 108 40 L92 40 Q86 38 90 30 L97 30 Q100 24 100 18Z" fill="#8A4F22" stroke="#3F230C" stroke-width="3"/></svg>';
  const DAZZA_MUCKY = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 0 232 256" aria-hidden="true"><rect x="67" y="196" width="22" height="42" rx="9" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="74" cy="242" rx="22" ry="9" fill="#4CAF6E" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="74" cy="238" rx="15" ry="7" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><rect x="111" y="196" width="22" height="42" rx="9" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="126" cy="242" rx="22" ry="9" fill="#4CAF6E" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="126" cy="238" rx="15" ry="7" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M30 132 L22 46" stroke="#3F230C" stroke-width="15" stroke-linecap="round"/><path d="M30 132 L22 46" stroke="#D9A066" stroke-width="7" stroke-linecap="round"/><path d="M-6 44 Q-4 10 22 10 Q48 10 50 44 Q22 54 -6 44 Z" fill="#E5484D" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="10" cy="24" rx="7" ry="3" fill="#fff" opacity=".5" transform="rotate(-30 10 24)"/><path d="M172 150 L188 196" stroke="#3F230C" stroke-width="20" stroke-linecap="round"/><path d="M172 150 L188 196" stroke="#C9D8E2" stroke-width="10" stroke-linecap="round"/><path d="M176 208 A18 18 0 1 0 204 204 L192 208 L190 198 Z" fill="#C9D8E2" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M54 138 Q30 140 30 118" fill="none" stroke="#3F230C" stroke-width="30" stroke-linecap="round"/><path d="M54 138 Q30 140 30 118" fill="none" stroke="#E9B48A" stroke-width="19" stroke-linecap="round"/><path d="M146 138 Q168 142 172 158" fill="none" stroke="#3F230C" stroke-width="30" stroke-linecap="round"/><path d="M146 138 Q168 142 172 158" fill="none" stroke="#E9B48A" stroke-width="19" stroke-linecap="round"/><path d="M52 176 L148 176 L150 212 L106 212 L100 198 L94 212 L50 212 Z" fill="#2F5D8C" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="100" cy="182" rx="44" ry="16" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="100" cy="186" r="3" fill="#3F230C"/><path d="M46 150 Q40 108 76 104 L124 104 Q160 108 154 150 Q156 182 100 180 Q44 182 46 150 Z" fill="#F58A1F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><rect x="48" y="140" width="104" height="11" fill="#E8EEF2" stroke="#3F230C" stroke-width="3"/><rect x="62" y="107" width="11" height="34" fill="#E8EEF2" stroke="#3F230C" stroke-width="3"/><rect x="127" y="107" width="11" height="34" fill="#E8EEF2" stroke="#3F230C" stroke-width="3"/><path d="M86 104 L100 126 L114 104" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="54" cy="74" r="10" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="146" cy="74" r="10" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M56 70 Q56 110 100 112 Q144 110 144 70 Q144 30 100 30 Q56 30 56 70 Z" fill="#EDB98F" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="72" cy="90" rx="9" ry="5" fill="#F08A7A" opacity=".55"/><ellipse cx="128" cy="90" rx="9" ry="5" fill="#F08A7A" opacity=".55"/><ellipse cx="81.0" cy="66" rx="15" ry="17" fill="#fff" stroke="#3F230C" stroke-width="4"/><circle cx="83.25" cy="67.7" r="7.5" fill="#1A1208"/><circle cx="85.87" cy="64.7" r="2.4" fill="#fff"/><path d="M66.0 66 A15 17 0 0 1 96.0 66 Z" fill="#D99A72" stroke="#3F230C" stroke-width="4"/><ellipse cx="119.0" cy="66" rx="15" ry="17" fill="#fff" stroke="#3F230C" stroke-width="4"/><circle cx="121.25" cy="67.7" r="7.5" fill="#1A1208"/><circle cx="123.87" cy="64.7" r="2.4" fill="#fff"/><path d="M104.0 66 A15 17 0 0 1 134.0 66 Z" fill="#D99A72" stroke="#3F230C" stroke-width="4"/><path d="M84 104 Q92 98 100 104 Q108 110 116 104" fill="none" stroke="#1A1208" stroke-width="5" stroke-linecap="round"/><path d="M100 88 Q84 78 68 92 Q72 104 100 96 Q128 104 132 92 Q116 78 100 88 Z" fill="#7A451D" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="100" cy="82" rx="13" ry="10" fill="#EE9C82" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="96" cy="78" rx="4" ry="2.5" fill="#fff" opacity=".6"/><path d="M52 52 Q54 12 100 12 Q146 12 148 52 Q100 40 52 52 Z" fill="#F5C842" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M140 44 Q176 40 184 56 Q160 62 142 56 Z" fill="#F5C842" stroke="#3F230C" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M100 18 Q106 24 103 30 L110 30 Q114 38 108 40 L92 40 Q86 38 90 30 L97 30 Q100 24 100 18Z" fill="#8A4F22" stroke="#3F230C" stroke-width="3"/><rect x="66.7" y="40.0" width="3.6" height="21.1" rx="1.8" fill="#8A4F22" stroke="#3F230C" stroke-width="4"/><rect x="73.1" y="40.0" width="3.1" height="22.3" rx="1.6" fill="#8A4F22" stroke="#3F230C" stroke-width="4"/><path d="M90.1 35.1 Q90.8 40.0 86.1 42.3 Q81.3 44.7 81.3 50.4 Q81.3 56.1 77.0 52.6 Q72.7 49.0 67.6 51.1 Q62.6 53.2 63.9 47.9 Q65.3 42.6 62.9 39.3 Q60.6 36.1 64.7 35.0 Q68.8 34.0 70.1 27.9 Q71.4 21.8 74.4 27.1 Q77.5 32.3 83.4 31.2 Q89.3 30.2 90.1 35.1Z" fill="#8A4F22" stroke="#3F230C" stroke-width="4" stroke-linejoin="round"/><ellipse cx="70.1" cy="35.5" rx="3.6" ry="1.3" fill="#fff" opacity=".4" transform="rotate(-25 70.1 35.5)"/><circle cx="78.4" cy="60.8" r="2.0" fill="#8A4F22" stroke="#3F230C" stroke-width="2.8"/><circle cx="76.0" cy="19.6" r="1.9" fill="#8A4F22" stroke="#3F230C" stroke-width="2.8"/><circle cx="89.1" cy="58.0" r="1.2" fill="#8A4F22" stroke="#3F230C" stroke-width="2.8"/><circle cx="99.2" cy="40.3" r="1.3" fill="#8A4F22" stroke="#3F230C" stroke-width="2.8"/><rect x="130.9" y="134.0" width="4.9" height="29.7" rx="2.4" fill="#8A4F22" stroke="#3F230C" stroke-width="4"/><rect x="126.5" y="134.0" width="4.3" height="29.0" rx="2.2" fill="#8A4F22" stroke="#3F230C" stroke-width="4"/><path d="M146.7 129.0 Q149.8 134.0 143.5 136.9 Q137.2 139.9 136.7 146.0 Q136.3 152.1 131.5 147.6 Q126.7 143.1 121.8 145.0 Q116.9 146.8 117.4 141.9 Q118.0 136.9 113.5 132.7 Q109.0 128.4 115.0 127.2 Q121.0 125.9 123.1 120.4 Q125.3 115.0 128.9 119.6 Q132.5 124.2 138.1 124.1 Q143.7 123.9 146.7 129.0Z" fill="#8A4F22" stroke="#3F230C" stroke-width="4" stroke-linejoin="round"/><ellipse cx="123.2" cy="128.4" rx="4.5" ry="1.6" fill="#fff" opacity=".4" transform="rotate(-25 123.2 128.4)"/><circle cx="99.3" cy="124.0" r="1.6" fill="#8A4F22" stroke="#3F230C" stroke-width="2.8"/><circle cx="137.6" cy="106.1" r="2.4" fill="#8A4F22" stroke="#3F230C" stroke-width="2.8"/><circle cx="115.3" cy="155.3" r="2.3" fill="#8A4F22" stroke="#3F230C" stroke-width="2.8"/><circle cx="137.2" cy="108.0" r="1.4" fill="#8A4F22" stroke="#3F230C" stroke-width="2.8"/><rect x="63.6" y="160.0" width="3.7" height="15.8" rx="1.9" fill="#8A4F22" stroke="#3F230C" stroke-width="4"/><path d="M80.5 157.1 Q81.8 160.0 78.3 161.5 Q74.7 163.0 75.0 167.4 Q75.4 171.9 72.3 168.6 Q69.2 165.3 65.5 167.4 Q61.7 169.5 63.0 165.6 Q64.3 161.7 61.9 159.3 Q59.6 156.9 62.8 156.1 Q65.9 155.3 67.2 152.3 Q68.5 149.3 70.5 151.9 Q72.5 154.5 75.8 154.3 Q79.2 154.1 80.5 157.1Z" fill="#8A4F22" stroke="#3F230C" stroke-width="4" stroke-linejoin="round"/><ellipse cx="67.0" cy="156.5" rx="2.8" ry="1.0" fill="#fff" opacity=".4" transform="rotate(-25 67.0 156.5)"/><circle cx="81.5" cy="171.3" r="1.3" fill="#8A4F22" stroke="#3F230C" stroke-width="2.8"/><circle cx="86.9" cy="154.2" r="1.1" fill="#8A4F22" stroke="#3F230C" stroke-width="2.8"/><circle cx="85.1" cy="157.7" r="1.5" fill="#8A4F22" stroke="#3F230C" stroke-width="2.8"/><circle cx="66.1" cy="175.2" r="0.9" fill="#8A4F22" stroke="#3F230C" stroke-width="2.8"/><rect x="116.0" y="58.0" width="2.2" height="12.8" rx="1.1" fill="#F7D842" stroke="#3F230C" stroke-width="3"/><path d="M125.5 56.0 Q126.7 58.0 124.1 59.1 Q121.5 60.3 121.4 62.7 Q121.2 65.1 119.3 63.9 Q117.3 62.8 115.2 63.2 Q113.1 63.6 113.5 61.4 Q113.8 59.2 111.2 57.2 Q108.6 55.2 112.1 55.2 Q115.5 55.1 116.1 52.2 Q116.7 49.2 118.3 51.6 Q119.9 53.9 122.1 53.9 Q124.3 53.9 125.5 56.0Z" fill="#F7D842" stroke="#3F230C" stroke-width="3" stroke-linejoin="round"/><ellipse cx="115.9" cy="55.5" rx="2.0" ry="0.7" fill="#fff" opacity=".4" transform="rotate(-25 115.9 55.5)"/><circle cx="116.3" cy="47.1" r="0.7" fill="#F7D842" stroke="#3F230C" stroke-width="2.09"/><circle cx="127.4" cy="65.9" r="1.1" fill="#F7D842" stroke="#3F230C" stroke-width="2.09"/><circle cx="106.9" cy="50.9" r="0.8" fill="#F7D842" stroke="#3F230C" stroke-width="2.09"/><circle cx="117.7" cy="47.1" r="0.7" fill="#F7D842" stroke="#3F230C" stroke-width="2.09"/></svg>';

  const CSS = `
  .bu { position: relative; display: flex; flex-direction: column; height: 100%;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; color: var(--cream, #f5ead6); }
  .bu-hud { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; padding: 10px 14px;
    background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 16px; }
  .bu-stat { flex: 1; min-width: 0; }
  .bu-lbl { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; color: var(--muted, #a08060); text-transform: uppercase; }
  .bu-val { font-family: 'Bebas Neue', sans-serif; font-size: 24px; line-height: 1.05; letter-spacing: 1px; }
  .bu-val.green { color: var(--green, #4caf6e); }
  .bu-mute { background: none; border: 1px solid rgba(245,200,66,0.2); border-radius: 50%; width: 36px; height: 36px;
    font-size: 16px; cursor: pointer; flex-shrink: 0; }
  .bu-press { display: flex; align-items: center; gap: 8px; margin: 0 2px 6px; flex-shrink: 0; }
  .bu-press-bar { flex: 1; height: 12px; border-radius: 6px; background: #120c05; border: 1px solid rgba(224,123,0,0.25); overflow: hidden; }
  .bu-press-fill { height: 100%; width: 0; border-radius: 6px; background: var(--amber, #e07b00); }
  .bu-press-fill.hot { background: #e5484d; }
  .bu-stage { flex: 1; min-height: 0; position: relative; display: flex; align-items: center; justify-content: center; }
  .bu-stage canvas { display: block; touch-action: none; }
  .bu-stage.shake { animation: buShake 0.5s; }
  @keyframes buShake { 0%,100% { transform: none; } 15% { transform: translate(-9px,4px) rotate(-1deg); } 30% { transform: translate(8px,-5px) rotate(1deg); }
    45% { transform: translate(-6px,3px); } 60% { transform: translate(5px,-2px); } 80% { transform: translate(-2px,1px); } }
  .bu-bar { display: flex; align-items: flex-end; gap: 6px; flex-shrink: 0; padding-top: 6px; min-height: 76px; }
  .bu-daz { width: 62px; flex-shrink: 0; margin-bottom: -4px; transform-origin: 50% 100%; }
  .bu-daz svg { display: block; width: 100%; height: auto; overflow: visible; }
  .bu-daz.talk { animation: buTalk 0.45s; }
  @keyframes buTalk { 0% { transform: scale(1,1); } 30% { transform: scale(1.12,0.86); } 60% { transform: scale(0.92,1.1); } 100% { transform: scale(1,1); } }
  .bu-say { flex: 1; min-width: 0; align-self: center; position: relative; background: #fff; color: #1a1208; border: 3px solid ${OUT};
    border-radius: 14px; padding: 8px 10px; font-size: 13px; font-weight: 700; line-height: 1.25; }
  .bu-say::before { content: ''; position: absolute; left: -11px; bottom: 10px; border: 6px solid transparent; border-right-color: ${OUT}; border-left-width: 0; border-right-width: 9px; }
  .bu-say::after { content: ''; position: absolute; left: -6px; bottom: 11px; border: 5px solid transparent; border-right-color: #fff; border-left-width: 0; border-right-width: 7px; }
  .bu-flush { flex-shrink: 0; align-self: center; border: none; border-radius: 12px; background: var(--gold, #f5c842); color: #1a1208; cursor: pointer;
    font-family: 'Bebas Neue', sans-serif; font-size: 21px; letter-spacing: 2px; line-height: 1; padding: 14px 14px; }
  .bu-flush:disabled { opacity: 0.45; cursor: default; }
  .bu-flush.ready { animation: buReady 0.7s infinite alternate; }
  @keyframes buReady { from { box-shadow: 0 0 0 0 rgba(245,200,66,0.7); } to { box-shadow: 0 0 0 9px rgba(245,200,66,0); transform: scale(1.05); } }
  .bu-screen { position: absolute; inset: 0; z-index: 2; background: var(--bg, #1a1208); overflow-y: auto;
    display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 4px; }
  .bu-screen > :first-child { margin-top: auto; }
  .bu-screen > :last-child { margin-bottom: auto; }
  .bu-screen[hidden] { display: none; }
  .bu-hero { position: relative; width: 150px; flex-shrink: 0; }
  .bu-hero svg { display: block; width: 100%; height: auto; overflow: visible; filter: drop-shadow(0 0 22px rgba(245,200,66,0.35)); }
  .bu-hero.small { width: 104px; }
  .bu-hero.bob svg { animation: buBob 1.6s ease-in-out infinite; transform-origin: 50% 100%; }
  @keyframes buBob { 0%,100% { transform: scale(1,1); } 50% { transform: scale(1.04,0.96); } }
  .bu-hero-say { position: absolute; left: 78%; top: 2px; white-space: nowrap; background: #fff; color: #1a1208; border: 3px solid ${OUT};
    border-radius: 14px; padding: 6px 10px; font-size: 13px; font-weight: 700; transform: rotate(4deg); }
  .bu-title { font-family: 'Bebas Neue', sans-serif; font-size: 64px; line-height: 0.95; color: var(--gold, #f5c842); margin-top: 6px;
    -webkit-text-stroke: 6px ${OUT}; paint-order: stroke fill; letter-spacing: 2px; }
  .bu-sub { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin: 8px 0 14px; }
  .bu-box { width: 100%; background: var(--surface, #231a0a); border: 1px solid rgba(224,123,0,0.25); border-radius: 20px;
    padding: 12px 14px; text-align: left; margin-bottom: 12px; }
  .bu-instr-text { font-size: 14px; line-height: 1.5; margin: 0 0 4px; }
  .bu-levels { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-bottom: 4px; }
  .bu-level { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer;
    background: var(--surface, #231a0a); border: 1.5px solid rgba(245,200,66,0.45); border-radius: 16px; padding: 10px 14px; color: inherit; }
  .bu-level:disabled { opacity: 0.4; cursor: default; border-color: rgba(224,123,0,0.25); }
  .bu-level-n { font-family: 'Bebas Neue', sans-serif; font-size: 34px; color: var(--gold, #f5c842); width: 26px; text-align: center; }
  .bu-level-t { flex: 1; min-width: 0; }
  .bu-level-t b { display: block; font-family: 'Bebas Neue', sans-serif; font-size: 21px; font-weight: 400; letter-spacing: 1px; line-height: 1.1; }
  .bu-level-t span { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted, #a08060); }
  .bu-stars { font-size: 14px; letter-spacing: 0; white-space: nowrap; }
  .bu-play { flex-shrink: 0; min-width: 64px; text-align: center; background: var(--gold, #f5c842); color: #1a1208; border-radius: 10px;
    padding: 8px 12px; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px; line-height: 1; white-space: nowrap; }
  .bu-play.locked { background: none; color: var(--muted, #a08060); border: 1px solid rgba(224,123,0,0.35); letter-spacing: 0; font-size: 15px; }
  .bu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
  .bu-grid .bu-val { font-size: 32px; }
  .bu-inv-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 5px 0;
    border-bottom: 1px dashed rgba(160,128,96,0.35); font-size: 14px; }
  .bu-inv-row b { font-family: 'Bebas Neue', sans-serif; font-size: 22px; font-weight: 400; letter-spacing: 1px; }
  .bu-inv-row.total { border-bottom: none; padding-top: 9px; }
  .bu-inv-row.total b { font-size: 34px; color: var(--green, #4caf6e); }
  .bu-bigstars { font-size: 40px; letter-spacing: 6px; margin: 2px 0 10px; }
  .bu-quip { font-size: 15px; line-height: 1.4; margin: -4px 0 14px; opacity: 0.9; }
  .bu-btn { width: 100%; border: none; border-radius: 12px; background: var(--gold, #f5c842); color: #1a1208;
    font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 3px; padding: 14px; cursor: pointer; margin-top: 4px; }
  .bu-btn.ghost { background: transparent; color: var(--gold, #f5c842); border: 1.5px solid rgba(245,200,66,0.6); margin-top: 20px; }
  .bu-link { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent;
    color: var(--cream, #f5ead6); border: none; border-radius: 12px; font-family: 'Bebas Neue', sans-serif;
    font-size: 19px; letter-spacing: 2px; padding: 12px 14px; margin-top: 20px; cursor: pointer; }
  .bu-link svg { color: var(--gold, #f5c842); flex: 0 0 auto; margin-top: -2px; }
  /* The mess: sits over everything, taps go straight through, a swipe wipes it off */
  .bu-mess { position: absolute; inset: 0; z-index: 5; pointer-events: none; overflow: hidden; border-radius: 12px; }
  .bu-splat { position: absolute; transform: translate(-50%,-50%); transition: opacity 0.3s, transform 0.3s; }
  .bu-splat svg { position: relative; display: block; overflow: visible; animation: buSplat 0.32s cubic-bezier(.2,1.6,.4,1) both; }
  @keyframes buSplat { from { transform: scale(0.1); } to { transform: scale(1); } }
  .bu-drip { position: absolute; top: 50%; border: 3px solid ${OUT}; border-radius: 99px; height: 0; animation: buDrip 2.6s 0.25s cubic-bezier(.3,.6,.4,1) forwards; }
  @keyframes buDrip { to { height: var(--h); } }
  .bu-splat.wiped { opacity: 0; transform: translate(-50%,-50%) scale(1.25) rotate(8deg); }
  .bu-boom { position: absolute; left: 50%; top: 40%; font-family: 'Bebas Neue', sans-serif; font-size: min(22vw, 96px); line-height: 1; white-space: nowrap;
    color: var(--gold, #f5c842); -webkit-text-stroke: 10px ${OUT}; paint-order: stroke fill; letter-spacing: 2px;
    transform: translate(-50%,-50%) rotate(-7deg); animation: buBoom 1.7s cubic-bezier(.2,1.5,.4,1) forwards; }
  @keyframes buBoom { 0% { transform: translate(-50%,-50%) rotate(-7deg) scale(0.1); opacity: 0; } 18% { transform: translate(-50%,-50%) rotate(-7deg) scale(1.1); opacity: 1; }
    30% { transform: translate(-50%,-50%) rotate(-7deg) scale(1); } 80% { opacity: 1; } 100% { transform: translate(-50%,-50%) rotate(-7deg) scale(1.05); opacity: 0; } }
  .bu-wipe { position: absolute; left: 0; right: 0; bottom: 6px; text-align: center; font-family: 'DM Mono', monospace; font-size: 10px;
    letter-spacing: 1.5px; text-transform: uppercase; color: var(--cream, #f5ead6); text-shadow: 0 1px 4px #000; opacity: 0.85; }
  @media (prefers-reduced-motion: reduce) {
    .bu-splat svg, .bu-daz.talk, .bu-hero.bob svg, .bu-flush.ready, .bu-stage.shake { animation: none; }
    .bu-drip { animation: none; height: var(--h); }
    .bu-boom { animation: buBoomStill 1.7s forwards; }
    @keyframes buBoomStill { 0%, 80% { opacity: 1; } 100% { opacity: 0; } }
  }
  `;

  function injectCss() {
    if (document.getElementById('bu-style')) return;
    const s = document.createElement('style');
    s.id = 'bu-style';
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
    twist() { this.tone(620, 420, 0.06, 'square', 0.03); },
    clunk() { this.tone(140, 90, 0.12, 'square', 0.06); },
    flush() { this.tone(500, 90, 0.7, 'sawtooth', 0.07, 14); },
    glug() { this.tone(180, 260, 0.09, 'sine', 0.07); },
    alarm() { this.tone(880, 660, 0.12, 'square', 0.035); },
    burst() { this.tone(220, 30, 0.9, 'sawtooth', 0.16, 26); setTimeout(() => this.tone(90, 40, 0.5, 'square', 0.1, 9), 120); },
    wipe() { this.tone(900, 1500, 0.09, 'sine', 0.03); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.18, 'triangle', 0.08), i * 120)); },
  };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  // ── PIPES ──
  // A tile is { type: 'I' straight | 'L' bend | 'X' crossover | 'R' roots, rot 0-3, locked, routes: [{a, b}] }.
  // routes are the runs the sludge has taken through it (a crossover can be used twice).
  function opens(t, side) {
    if (t.type === 'X') return true;
    if (t.type === 'I') return side % 2 === t.rot % 2;
    if (t.type === 'L') return side === t.rot || side === (t.rot + 1) % 4;
    return false;
  }
  // Where sludge that comes in on `side` leaves, or -1 if it can't get in
  function exitOf(t, side) {
    if (!opens(t, side)) return -1;
    if (t.type === 'L') return side === t.rot ? (t.rot + 1) % 4 : t.rot;
    if (t.routes.some(r => r.a % 2 === side % 2)) return -1; // that run is already full
    if (t.type !== 'X' && t.routes.length) return -1;
    return (side + 2) % 4;
  }
  function canEnter(t, side) {
    if (!t || t.type === 'R') return false;
    if (t.type !== 'X' && t.routes.length) return false;
    return exitOf(t, side) >= 0;
  }

  // Lays one guaranteed run from a top square to a bottom square, fills the rest with
  // random pipe, then twists everything that isn't seized.
  function generate(L) {
    const { cols, rows } = L, n = cols * rows;
    const minLen = rows + Math.floor(cols * 0.8), maxLen = Math.min(Math.floor(n * 0.6), minLen + 5);
    let path = null;
    for (let tries = 0; tries < 300 && !path; tries++) {
      const src = rnd(cols), drain = rnd(cols);
      const seen = new Uint8Array(n), cur = [src];
      seen[src] = 1;
      let budget = 3000;
      const target = (rows - 1) * cols + drain;
      (function walk() {
        const i = cur[cur.length - 1];
        if (i === target) return cur.length >= minLen;
        if (cur.length >= maxLen || budget-- <= 0) return false;
        const r = Math.floor(i / cols), c = i % cols;
        const dirs = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
        for (const d of dirs) {
          const rr = r + DY[d], cc = c + DX[d];
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
          const j = rr * cols + cc;
          if (seen[j]) continue;
          seen[j] = 1; cur.push(j);
          if (walk()) return true;
          cur.pop(); seen[j] = 0;
        }
        return false;
      })() && (path = cur.slice());
    }
    if (!path) { // straight down the first column: can't fail
      path = [];
      for (let r = 0; r < rows; r++) path.push(r * cols);
    }
    const tiles = new Array(n).fill(null);
    const dirTo = (a, b) => b === a - cols ? 0 : b === a + 1 ? 1 : b === a + cols ? 2 : 3;
    path.forEach((i, k) => {
      const a = k === 0 ? 0 : (dirTo(path[k - 1], i) + 2) % 4;
      const b = k === path.length - 1 ? 2 : dirTo(i, path[k + 1]);
      if (b === (a + 2) % 4) tiles[i] = { type: Math.random() < 0.12 ? 'X' : 'I', rot: a % 2, locked: false, routes: [], ang: 0, onPath: true };
      else tiles[i] = { type: 'L', rot: (a + 1) % 4 === b ? a : b, locked: false, routes: [], ang: 0, onPath: true };
    });
    const free = [];
    for (let i = 0; i < n; i++) if (!tiles[i]) free.push(i);
    free.sort(() => Math.random() - 0.5);
    for (let k = 0; k < L.roots && free.length; k++) tiles[free.pop()] = { type: 'R', rot: 0, locked: true, routes: [], ang: 0 };
    free.forEach(i => {
      const x = Math.random();
      tiles[i] = { type: x < 0.36 ? 'I' : x < 0.86 ? 'L' : 'X', rot: rnd(4), locked: false, routes: [], ang: 0 };
    });
    // Seized pipes: some on the run (left the right way round) and the same number off it
    const onRun = path.slice(1, -1).filter(i => tiles[i].type !== 'X').sort(() => Math.random() - 0.5);
    for (let k = 0; k < L.rusty && k < onRun.length; k++) tiles[onRun[k]].locked = true;
    const offRun = free.filter(i => tiles[i].type !== 'X');
    for (let k = 0; k < L.rusty && k < offRun.length; k++) tiles[offRun[k]].locked = true;
    tiles.forEach(t => { if (!t.locked) t.rot = rnd(4); });
    return { tiles, src: path[0], drain: path[path.length - 1] - (rows - 1) * cols, len: path.length };
  }

  // A splat as SVG: a lumpy blob with a shine, a few flecks, and sometimes a face
  function splatSvg(r, fill, face) {
    const n = 11, pts = [];
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 2 * i / n, rr = r * (i % 2 ? 0.62 : 1.25) * (0.85 + Math.random() * 0.3);
      pts.push([rr * Math.cos(a), rr * Math.sin(a)]);
    }
    const mid = i => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
    const f = v => v.toFixed(1);
    let d = `M${f(mid(n - 1)[0])} ${f(mid(n - 1)[1])}`;
    for (let i = 0; i < n; i++) d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f(mid(i)[0])} ${f(mid(i)[1])}`;
    let s = `<path d="${d}Z" fill="${fill}" stroke="${OUT}" stroke-width="${r > 20 ? 5 : 3.5}" stroke-linejoin="round"/>`;
    s += `<ellipse cx="${f(-r * 0.3)}" cy="${f(-r * 0.35)}" rx="${f(r * 0.28)}" ry="${f(r * 0.1)}" fill="#fff" opacity=".4" transform="rotate(-25 ${f(-r * 0.3)} ${f(-r * 0.35)})"/>`;
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * 6.28, rr = r * (1.5 + Math.random() * 0.5);
      s += `<circle cx="${f(rr * Math.cos(a))}" cy="${f(rr * Math.sin(a))}" r="${f(r * (0.08 + Math.random() * 0.08))}" fill="${fill}" stroke="${OUT}" stroke-width="3"/>`;
    }
    if (face) {
      const ex = r * 0.26, er = r * 0.2;
      [-ex, ex].forEach(x => {
        s += `<ellipse cx="${f(x)}" cy="0" rx="${f(er)}" ry="${f(er * 1.15)}" fill="#fff" stroke="${OUT}" stroke-width="3"/><circle cx="${f(x + er * 0.2)}" cy="${f(er * 0.15)}" r="${f(er * 0.5)}" fill="${DARK}"/>`;
      });
      s += `<path d="M${f(-r * 0.2)} ${f(r * 0.4)} Q0 ${f(r * 0.62)} ${f(r * 0.2)} ${f(r * 0.4)}" fill="none" stroke="${DARK}" stroke-width="4" stroke-linecap="round"/>`;
    }
    const box = r * 2.2;
    return `<svg width="${f(box * 2)}" height="${f(box * 2)}" viewBox="${f(-box)} ${f(-box)} ${f(box * 2)} ${f(box * 2)}" aria-hidden="true">${s}</svg>`;
  }

  function mount(root, opts) {
    injectCss();
    const hourly = opts.hourly || (() => 0);
    root.innerHTML = `
      <div class="bu">
        <div class="bu-hud">
          <div class="bu-stat"><div class="bu-lbl">Job</div><div class="bu-val" data-job>1</div></div>
          <div class="bu-stat"><div class="bu-lbl">Pipes</div><div class="bu-val" data-pipes>0</div></div>
          <div class="bu-stat"><div class="bu-lbl">Paid to play</div><div class="bu-val green" data-paid>$0.00</div></div>
          <button type="button" class="bu-mute" data-mute aria-label="Sound"></button>
        </div>
        <div class="bu-press"><div class="bu-lbl" data-presslbl>Pressure</div><div class="bu-press-bar"><div class="bu-press-fill" data-press></div></div></div>
        <div class="bu-stage"><canvas></canvas></div>
        <div class="bu-bar">
          <div class="bu-daz" data-daz>${DAZZA}</div>
          <div class="bu-say" data-say aria-live="polite"></div>
          <button type="button" class="bu-flush" data-flush>Flush it</button>
        </div>
        <div class="bu-screen" data-screen></div>
        <div class="bu-mess" data-mess></div>
      </div>`;
    const $ = sel => root.querySelector(sel);
    const el = {
      wrap: $('.bu'), stage: $('.bu-stage'), canvas: $('canvas'), screen: $('[data-screen]'), mess: $('[data-mess]'),
      job: $('[data-job]'), pipes: $('[data-pipes]'), paid: $('[data-paid]'), mute: $('[data-mute]'),
      press: $('[data-press]'), pressLbl: $('[data-presslbl]'), daz: $('[data-daz]'), say: $('[data-say]'), flush: $('[data-flush]'),
    };
    const ctx = el.canvas.getContext('2d');

    let T = 48, W = 0, H = 0, dpr = 1, topH = 0;
    const g = {
      state: 'title', lv: 0, L: LEVELS[0], tiles: null, src: 0, drain: 0, len: 0,
      phase: 'build', t: 0, secs: 0, head: null, fast: false, count: 0, burst: null, bulge: 0,
      bad: -1, linked: false, warned: -1, down: 0, parts: [],
    };
    let alive = true, frame = null, last = 0, endTimer = 0, hud = {}, sayTimer = 0;

    // ── LAYOUT ──
    function layout() {
      if (!g.tiles) return;
      const r = el.stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const { cols, rows } = g.L;
      // Room above for the dunny and below for the drain
      T = Math.max(24, Math.min(64, Math.floor(Math.min((r.width - 4) / cols, r.height / (rows + 1.9)))));
      topH = Math.round(T * 1.15);
      W = T * cols; H = topH + T * rows + Math.round(T * 0.75);
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      el.canvas.width = W * dpr; el.canvas.height = H * dpr;
      el.canvas.style.width = W + 'px'; el.canvas.style.height = H + 'px';
      draw();
    }
    const cx = i => (i % g.L.cols) * T + T / 2;
    const cy = i => topH + Math.floor(i / g.L.cols) * T + T / 2;
    const neighbour = (i, side) => {
      const c = (i % g.L.cols) + DX[side], r = Math.floor(i / g.L.cols) + DY[side];
      return c < 0 || c >= g.L.cols || r < 0 || r >= g.L.rows ? -1 : r * g.L.cols + c;
    };

    // ── DRAW ──
    function rrect(x, y, w, h, rad) {
      ctx.beginPath();
      ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
    }
    // Googly eyes looking towards (lx, ly)
    function eyesAt(x, y, gap, rx, ry, lx, ly) {
      [-gap / 2, gap / 2].forEach(o => {
        ctx.beginPath(); ctx.ellipse(x + o, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.lineWidth = Math.max(1.5, rx * 0.3); ctx.strokeStyle = OUT; ctx.stroke();
        ctx.beginPath(); ctx.arc(x + o + lx * rx * 0.4, y + ly * ry * 0.4, rx * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = DARK; ctx.fill();
        ctx.beginPath(); ctx.arc(x + o + lx * rx * 0.4 + rx * 0.18, y + ly * ry * 0.4 - rx * 0.2, rx * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
      });
    }
    // The pipe shape of a tile, in its own frame (centre 0,0, not yet twisted)
    function tracePipe(t) {
      const h = T / 2;
      ctx.beginPath();
      if (t.type === 'L') { ctx.moveTo(0, -h); ctx.quadraticCurveTo(0, 0, h, 0); }
      else { ctx.moveTo(0, -h); ctx.lineTo(0, h); if (t.type === 'X') { ctx.moveTo(-h, 0); ctx.lineTo(h, 0); } }
    }
    function collars(t) {
      const sides = t.type === 'X' ? [0, 1, 2, 3] : t.type === 'I' ? [0, 2] : [0, 1];
      ctx.fillStyle = t.locked ? '#9DB8A2' : '#F0B070'; ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.5, T * 0.06);
      sides.forEach(s => {
        const d = T / 2 - T * 0.11, long = T * 0.56, thin = T * 0.15;
        const w = s % 2 ? thin : long, h = s % 2 ? long : thin;
        rrect(DX[s] * d - w / 2, DY[s] * d - h / 2, w, h, T * 0.04);
        ctx.fill(); ctx.stroke();
      });
    }
    // Sludge along one run of a tile, as far as p (0 to 1). Returns where its front is.
    function sludge(i, a, b, p) {
      const x = cx(i), y = cy(i), h = T / 2;
      const ax = x + DX[a] * h, ay = y + DY[a] * h, bx = x + DX[b] * h, by = y + DY[b] * h;
      let ex, ey;
      ctx.beginPath(); ctx.moveTo(ax, ay);
      if (b === (a + 2) % 4) { ex = ax + (bx - ax) * p; ey = ay + (by - ay) * p; ctx.lineTo(ex, ey); }
      else { // the first p of the bend
        const qx = ax + (x - ax) * p, qy = ay + (y - ay) * p, rx = x + (bx - x) * p, ry = y + (by - y) * p;
        ex = qx + (rx - qx) * p; ey = qy + (ry - qy) * p;
        ctx.quadraticCurveTo(qx, qy, ex, ey);
      }
      ctx.lineCap = 'butt'; ctx.strokeStyle = '#5E3413'; ctx.lineWidth = T * 0.24; ctx.stroke();
      return [ex, ey];
    }
    function drawTile(i) {
      const t = g.tiles[i], x = cx(i), y = cy(i);
      rrect(x - T / 2 + 1.5, y - T / 2 + 1.5, T - 3, T - 3, T * 0.16);
      ctx.fillStyle = t.type === 'R' ? '#1c2413' : t.locked ? '#1d2620' : '#2a1e10'; ctx.fill();
      ctx.strokeStyle = 'rgba(245,200,66,0.08)'; ctx.lineWidth = 1; ctx.stroke();
      if (t.type === 'R') { // tree roots
        ctx.lineCap = 'round';
        [[-0.34, -0.3, 0.1, -0.05, 0.3, 0.32], [0.32, -0.34, 0.05, 0, -0.3, 0.3], [-0.36, 0.05, 0, 0.12, 0.36, -0.02]].forEach(q => {
          ctx.beginPath(); ctx.moveTo(x + q[0] * T, y + q[1] * T); ctx.quadraticCurveTo(x + q[2] * T, y + q[3] * T, x + q[4] * T, y + q[5] * T);
          ctx.strokeStyle = OUT; ctx.lineWidth = T * 0.2; ctx.stroke();
          ctx.strokeStyle = '#8a6a3c'; ctx.lineWidth = T * 0.11; ctx.stroke();
        });
        ctx.fillStyle = '#4caf6e'; ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.5, T * 0.04);
        ctx.beginPath(); ctx.ellipse(x + T * 0.2, y - T * 0.26, T * 0.1, T * 0.05, -0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        return;
      }
      ctx.save();
      ctx.translate(x, y);
      if (i === g.bulgeAt) ctx.scale(1 + g.bulge * 0.22, 1 + g.bulge * 0.22);
      ctx.rotate((t.rot * 90 + t.ang) * Math.PI / 180);
      ctx.lineCap = 'butt';
      tracePipe(t); ctx.strokeStyle = OUT; ctx.lineWidth = T * 0.5; ctx.stroke();
      tracePipe(t); ctx.strokeStyle = t.locked ? '#6F9479' : '#DE8F4A'; ctx.lineWidth = T * 0.34; ctx.stroke();
      ctx.restore();
      t.routes.forEach(r => { sludge(i, r.a, r.b, r === g.headRoute ? Math.min(1, g.head.p) : 1); });
      ctx.save();
      ctx.translate(x, y);
      if (i === g.bulgeAt) ctx.scale(1 + g.bulge * 0.22, 1 + g.bulge * 0.22);
      ctx.rotate((t.rot * 90 + t.ang) * Math.PI / 180);
      ctx.save(); ctx.translate(-T * 0.09, 0);
      ctx.beginPath();
      if (t.type === 'L') { ctx.moveTo(0, -T / 2); ctx.quadraticCurveTo(0, T * 0.09, T / 2, T * 0.09); ctx.translate(0, 0); }
      else { ctx.moveTo(0, -T / 2); ctx.lineTo(0, T / 2); }
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = T * 0.05; ctx.stroke();
      ctx.restore();
      collars(t);
      if (t.locked) { // rust spots and a bolt
        ctx.fillStyle = '#4c6b55';
        [[0.02, -0.2], [-0.04, 0.16]].forEach(p => { ctx.beginPath(); ctx.arc(p[0] * T, p[1] * T, T * 0.035, 0, Math.PI * 2); ctx.fill(); });
      }
      ctx.restore();
    }
    function drawDunny(now) {
      const x = cx(g.src), base = topH - T * 0.08;
      const wob = g.state === 'play' && g.phase === 'build' && !still ? Math.sin(now / 38) * g.t / g.L.head * T * 0.05 : 0;
      ctx.save(); ctx.translate(x + wob, base);
      const s = T / 54;
      ctx.scale(s, s);
      ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 4.5; ctx.fillStyle = '#EAF1F5';
      rrect(-19, -56, 38, 27, 6); ctx.fill(); ctx.stroke(); // cistern
      ctx.beginPath(); ctx.moveTo(-27, -29); ctx.lineTo(27, -29); ctx.quadraticCurveTo(27, -5, 11, -1);
      ctx.lineTo(11, 4); ctx.lineTo(-11, 4); ctx.lineTo(-11, -1); ctx.quadraticCurveTo(-27, -5, -27, -29); ctx.closePath();
      ctx.fill(); ctx.stroke(); // bowl
      ctx.beginPath(); ctx.ellipse(0, -24, 19, 4.5, 0, 0, Math.PI * 2); ctx.fillStyle = DARK; ctx.fill();
      const scared = g.phase === 'build' && g.t / g.L.head > 0.6;
      eyesAt(0, -43, 17, scared ? 6.5 : 5.5, scared ? 8 : 6.5, 0, 0.6);
      ctx.restore();
    }
    function drawDrain() {
      const x = cx((g.L.rows - 1) * g.L.cols + g.drain), y = topH + g.L.rows * T + T * 0.34;
      ctx.lineWidth = Math.max(2, T * 0.08); ctx.strokeStyle = OUT;
      ctx.beginPath(); ctx.ellipse(x, y, T * 0.46, T * 0.24, 0, 0, Math.PI * 2); ctx.fillStyle = '#6B7880'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y + T * 0.02, T * 0.32, T * 0.14, 0, 0, Math.PI * 2); ctx.fillStyle = DARK; ctx.fill();
      if (g.down > 0) { // sludge going down the plughole
        ctx.beginPath(); ctx.ellipse(x, y + T * 0.02, T * 0.3 * g.down, T * 0.12 * g.down, 0, 0, Math.PI * 2); ctx.fillStyle = MUCK; ctx.fill();
      } else {
        ctx.strokeStyle = '#6B7880'; ctx.lineWidth = Math.max(1.5, T * 0.05);
        ctx.beginPath(); ctx.moveTo(x - T * 0.26, y + T * 0.02); ctx.lineTo(x + T * 0.26, y + T * 0.02);
        ctx.moveTo(x - T * 0.1, y - T * 0.1); ctx.lineTo(x - T * 0.1, y + T * 0.14);
        ctx.moveTo(x + T * 0.1, y - T * 0.1); ctx.lineTo(x + T * 0.1, y + T * 0.14); ctx.stroke();
      }
    }
    // Where the next gap is: a point on the edge of the tile the sludge is about to leave
    function gapPoint() {
      if (g.head) return [cx(g.head.cell) + DX[g.head.out] * T / 2, cy(g.head.cell) + DY[g.head.out] * T / 2];
      return [cx(g.src), topH];
    }
    function draw(now) {
      if (!alive || !g.tiles) return;
      now = now || performance.now();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      rrect(0, topH - 3, W, g.L.rows * T + 6, T * 0.2); ctx.fillStyle = '#120c05'; ctx.fill();
      drawDrain();
      // stub from the dunny into the first pipe
      ctx.fillStyle = '#DE8F4A'; ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(2, T * 0.08);
      ctx.fillRect(cx(g.src) - T * 0.17, topH - T * 0.1, T * 0.34, T * 0.12);
      for (let i = 0; i < g.tiles.length; i++) if (i !== g.bulgeAt) drawTile(i);
      if (g.bulgeAt >= 0) drawTile(g.bulgeAt);
      drawDunny(now);
      // The pipe that's about to cop it: red ring, worried face, a bead of sweat
      if (g.state === 'play' && g.bad !== -1) {
        const pulse = still ? 1 : 1 + Math.sin(now / 90) * 0.08;
        let x, y;
        if (g.bad >= 0) { x = cx(g.bad); y = cy(g.bad); } else { [x, y] = gapPoint(); }
        ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
        ctx.setLineDash([T * 0.14, T * 0.1]); ctx.strokeStyle = '#E5484D'; ctx.lineWidth = Math.max(2, T * 0.07);
        ctx.beginPath(); ctx.arc(0, 0, T * (g.bad >= 0 ? 0.56 : 0.3), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        if (g.bad >= 0 && g.tiles[g.bad].type !== 'R') {
          eyesAt(0, -T * 0.04, T * 0.24, T * 0.085, T * 0.1, 0, 0);
          ctx.beginPath(); ctx.moveTo(-T * 0.07, T * 0.17); ctx.quadraticCurveTo(0, T * 0.09, T * 0.07, T * 0.17);
          ctx.strokeStyle = DARK; ctx.lineWidth = Math.max(1.5, T * 0.045); ctx.lineCap = 'round'; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(T * 0.3, -T * 0.36); ctx.quadraticCurveTo(T * 0.38, -T * 0.22, T * 0.3, -T * 0.18);
          ctx.quadraticCurveTo(T * 0.22, -T * 0.22, T * 0.3, -T * 0.36);
          ctx.fillStyle = '#8FD3FF'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1, T * 0.03); ctx.stroke();
        }
        ctx.restore();
      }
      // The sludge itself: a blob with a face at the front of the flow
      if (g.head && g.state !== 'lost') {
        const r = g.headRoute, p = Math.min(1, g.head.p), h = T / 2, i = g.head.cell;
        const x = cx(i), y = cy(i), ax = x + DX[r.a] * h, ay = y + DY[r.a] * h, bx = x + DX[r.b] * h, by = y + DY[r.b] * h;
        let ex, ey;
        if (r.b === (r.a + 2) % 4) { ex = ax + (bx - ax) * p; ey = ay + (by - ay) * p; }
        else { const qx = ax + (x - ax) * p, qy = ay + (y - ay) * p, sx = x + (bx - x) * p, sy = y + (by - y) * p; ex = qx + (sx - qx) * p; ey = qy + (sy - qy) * p; }
        const lx = p < 0.5 ? -DX[r.a] : DX[r.b], ly = p < 0.5 ? -DY[r.a] : DY[r.b];
        const squish = still ? 0 : Math.sin(now / 70) * 0.08;
        ctx.save(); ctx.translate(ex, ey); ctx.scale(1 + squish, 1 - squish);
        ctx.beginPath(); ctx.arc(0, 0, T * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = MUCK; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(2, T * 0.08); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-T * 0.12, -T * 0.16, T * 0.08, T * 0.035, -0.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
        eyesAt(0, -T * 0.04, T * 0.25, T * 0.1, T * 0.12, lx, ly);
        ctx.beginPath(); ctx.ellipse(0, T * 0.15, T * 0.08, T * (g.bad !== -1 ? 0.03 : 0.06), 0, 0, Math.PI * 2); ctx.fillStyle = DARK; ctx.fill();
        ctx.restore();
      }
      // Bits flying out of a burst
      g.parts.forEach(q => {
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        ctx.fillStyle = q.wee ? WEE : MUCK; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.5, q.r * 0.3); ctx.stroke();
      });
    }

    function renderHud() {
      const job = String(g.lv + 1), pipes = String(g.count), paid = '$' + (hourly() * g.secs / 3600).toFixed(2);
      if (hud.job !== job) el.job.textContent = hud.job = job;
      if (hud.pipes !== pipes) el.pipes.textContent = hud.pipes = pipes;
      if (hud.paid !== paid) el.paid.textContent = hud.paid = paid;
      const pr = g.phase === 'build' ? Math.min(1, g.t / g.L.head) : 1;
      el.press.style.width = (pr * 100).toFixed(1) + '%';
      const hot = pr > 0.7;
      if (hud.hot !== hot) { el.press.classList.toggle('hot', hot); hud.hot = hot; }
      const lbl = g.phase === 'build' ? 'Flush in ' + Math.max(0, Math.ceil(g.L.head - g.t)) : g.fast ? 'Flushing' : 'Flowing';
      if (hud.lbl !== lbl) el.pressLbl.textContent = hud.lbl = lbl;
      const ready = g.state === 'play' && g.linked && !g.fast;
      if (hud.ready !== ready) { el.flush.classList.toggle('ready', ready); hud.ready = ready; }
      const off = g.state !== 'play' || g.fast;
      if (hud.off !== off) { el.flush.disabled = hud.off = off; }
    }
    function renderMute() { el.mute.textContent = sound.muted ? '🔇' : '🔊'; }
    function say(key, hold) {
      el.say.textContent = SAY[key] ? pick(SAY[key]) : key;
      el.daz.classList.remove('talk'); void el.daz.offsetWidth; el.daz.classList.add('talk');
      clearTimeout(sayTimer);
      if (!hold) sayTimer = 0;
    }

    // ── GAME ──
    // Follows the pipes from the front of the sludge as they sit right now.
    // Sets g.linked (the run reaches the drain) and g.bad (the square where it would burst:
    // -1 none, -2 off the edge, otherwise a tile) but only when that's the very next square.
    function look() {
      const used = new Map();
      const taken = (i, side) => {
        const t = g.tiles[i];
        if (t.type === 'X') return t.routes.some(r => r.a % 2 === side % 2) || (used.get(i) || []).includes(side % 2);
        return t.routes.length > 0 || used.has(i);
      };
      let cell, side, first = true;
      g.bad = -1; g.linked = false;
      if (g.head) { cell = neighbour(g.head.cell, g.head.out); side = (g.head.out + 2) % 4; if (g.head.cell === drainCell() && g.head.out === 2) { g.linked = true; return; } }
      else { cell = g.src; side = 0; }
      for (let guard = 0; guard < 200; guard++) {
        const t = cell >= 0 ? g.tiles[cell] : null;
        if (!t || t.type === 'R' || !opens(t, side) || taken(cell, side)) { if (first) g.bad = cell >= 0 ? cell : -2; return; }
        first = false;
        const out = t.type === 'L' ? (side === t.rot ? (t.rot + 1) % 4 : t.rot) : (side + 2) % 4;
        used.set(cell, (used.get(cell) || []).concat(side % 2));
        if (cell === drainCell() && out === 2) { g.linked = true; return; }
        cell = neighbour(cell, out); side = (out + 2) % 4;
      }
    }
    const drainCell = () => (g.L.rows - 1) * g.L.cols + g.drain;

    function startLevel(i) {
      sound.init();
      clearTimeout(endTimer);
      clearMess();
      g.lv = i; g.L = LEVELS[i];
      const made = generate(g.L);
      g.tiles = made.tiles; g.src = made.src; g.drain = made.drain; g.len = made.len;
      g.phase = 'build'; g.t = 0; g.secs = 0; g.head = null; g.headRoute = null; g.fast = false; g.count = 0;
      g.burst = null; g.bulge = 0; g.bulgeAt = -1; g.warned = -1; g.down = 0; g.parts = [];
      // A job that starts already connected is no job at all
      look();
      for (let k = 0; g.linked && k < 8; k++) {
        const loose = g.tiles.filter(t => t.onPath && !t.locked && t.type !== 'X');
        if (!loose.length) break;
        pick(loose).rot = rnd(4);
        look();
      }
      el.screen.hidden = true;
      el.stage.classList.remove('shake');
      el.daz.innerHTML = DAZZA;
      g.state = 'play';
      hud = {};
      renderHud();
      layout();
      say(g.L.rusty && i === 3 ? 'rusty' : g.L.roots && i === 2 ? 'roots' : 'start');
      startLoop();
    }

    function enter(cell, side, carry) {
      const t = cell >= 0 ? g.tiles[cell] : null;
      if (!canEnter(t, side)) return false;
      const out = exitOf(t, side);
      t.ang = 0;
      g.headRoute = { a: side, b: out };
      t.routes.push(g.headRoute);
      g.head = { cell, out, p: carry || 0 };
      g.count++;
      sound.glug();
      return true;
    }

    function startFlow() {
      g.phase = 'flow';
      sound.flush(); buzz(40);
      if (!enter(g.src, 0, 0)) { burstAt(cx(g.src), topH, -1); return; }
      say('flow');
      look();
    }

    function advance() {
      const h = g.head, carry = h.p - 1;
      if (h.cell === drainCell() && h.out === 2) { win(); return; }
      const next = neighbour(h.cell, h.out);
      if (!enter(next, (h.out + 2) % 4, carry)) {
        h.p = 1;
        burstAt(cx(h.cell) + DX[h.out] * T / 2, cy(h.cell) + DY[h.out] * T / 2, h.cell);
        return;
      }
      look();
    }

    function tick(dt) {
      // Twisting pipes ease into place
      g.tiles.forEach(t => { if (t.ang) { t.ang += dt * 620; if (t.ang > 0) t.ang = 0; } });
      if (g.state === 'play') {
        g.secs += dt;
        if (g.phase === 'build') {
          g.t += dt;
          if (g.t >= g.L.head) startFlow();
        } else {
          g.head.p += dt / g.L.tile * (g.fast ? FAST : 1);
          while (g.state === 'play' && g.head.p >= 1) advance();
        }
        if (g.state === 'play') {
          // Dazza shouts once the sludge is halfway to a gap
          const key = g.head ? g.head.cell : -5;
          if (g.bad !== -1 && g.warned !== key && (g.head ? g.head.p > 0.35 : g.t / g.L.head > 0.6)) {
            g.warned = key; say('danger'); sound.alarm();
          }
        }
      } else if (g.state === 'burst') {
        g.burst.t += dt;
        g.bulge = Math.min(1, g.burst.t / 0.45) * (1 + Math.sin(g.burst.t * 60) * 0.12);
        if (g.burst.t >= 0.45 && !g.burst.done) explode();
      } else if (g.state === 'won' && g.down < 1) {
        g.down = Math.min(1, g.down + dt * 2.5);
      }
      if (g.parts.length) {
        g.parts.forEach(q => { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 900 * dt; q.life -= dt; });
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
      const busy = g.state === 'play' || g.state === 'burst' || g.parts.length || (g.state === 'won' && g.down < 1) || g.tiles.some(t => t.ang);
      if (busy) frame = requestAnimationFrame(loop);
    }
    function startLoop() {
      last = performance.now();
      if (!frame) frame = requestAnimationFrame(loop);
    }

    function twist(i) {
      const t = g.tiles[i];
      if (!t || t.type === 'R') return;
      if (t.routes.length) return; // full of sludge, too late
      if (t.locked) { sound.clunk(); buzz(20); t.ang = -14; say('seized'); startLoop(); return; }
      t.rot = (t.rot + 1) % 4;
      t.ang = still ? 0 : -90;
      sound.twist();
      const was = g.linked;
      look();
      if (g.linked && !was && !g.fast) say('linked');
      startLoop();
    }

    function flushNow() {
      if (g.state !== 'play' || g.fast) return;
      sound.init();
      g.fast = true;
      say('fast');
      if (g.phase === 'build') g.t = g.L.head; // skip the wait
    }

    // ── KABLOOEY ──
    function burstAt(x, y, cell) {
      g.state = 'burst';
      g.burst = { x, y, t: 0, done: false };
      g.bulgeAt = cell;
      g.bad = -1;
    }
    function explode() {
      g.burst.done = true;
      g.bulge = 0; g.bulgeAt = -1;
      g.state = 'lost';
      sound.burst(); buzz([80, 40, 160, 40, 80]);
      if (!still) {
        el.stage.classList.add('shake');
        for (let k = 0; k < 26; k++) {
          const a = Math.random() * Math.PI * 2, v = 160 + Math.random() * 420;
          g.parts.push({ x: g.burst.x, y: g.burst.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 180, r: T * (0.06 + Math.random() * 0.12), wee: k % 5 === 0, life: 0.9 });
        }
      }
      el.daz.innerHTML = DAZZA_MUCKY;
      say(pick(BURSTS));
      makeMess();
      endTimer = setTimeout(() => { if (alive) loseScreen(); }, 1500);
    }
    // Splats across the whole game: mostly poo, a bit of wee, one of them looking at you
    function makeMess() {
      const box = el.wrap.getBoundingClientRect(), stage = el.canvas.getBoundingClientRect();
      const bx = stage.left - box.left + g.burst.x, by = stage.top - box.top + g.burst.y;
      let html = '';
      const add = (x, y, r, wee, face, delay) => {
        const fill = wee ? WEE : MUCK;
        let drips = '';
        const nd = wee ? 1 + rnd(2) : 2 + rnd(3);
        for (let k = 0; k < nd; k++) {
          const w = r * (0.24 + Math.random() * 0.16), dx = (Math.random() - 0.5) * r * 1.1;
          drips += `<div class="bu-drip" style="left:calc(50% + ${dx.toFixed(0)}px);width:${w.toFixed(0)}px;margin-left:${(-w / 2).toFixed(0)}px;background:${fill};--h:${(r * (1.3 + Math.random() * 1.6)).toFixed(0)}px;animation-delay:${(delay + 0.2 + Math.random() * 0.3).toFixed(2)}s"></div>`;
        }
        html += `<div class="bu-splat" data-r="${r.toFixed(0)}" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px">${drips}${splatSvg(r, fill, face).replace('<svg ', `<svg style="animation-delay:${delay.toFixed(2)}s" `)}</div>`;
      };
      const spots = Math.max(7, Math.round(box.width * box.height / 26000));
      add(bx, by, Math.min(box.width * 0.2, 80), false, false, 0);
      for (let k = 0; k < spots; k++) {
        const far = k / spots;
        add(12 + Math.random() * (box.width - 24), 12 + Math.random() * (box.height * 0.8), 18 + Math.random() * 38, false, k === 1, 0.04 + far * 0.25);
      }
      for (let k = 0; k < 3; k++) add(16 + Math.random() * (box.width - 32), 16 + Math.random() * (box.height * 0.8), 11 + Math.random() * 10, true, false, 0.1 + k * 0.08);
      html += '<div class="bu-boom">KABLOOEY!</div><div class="bu-wipe" hidden>Swipe to wipe it off</div>';
      el.mess.innerHTML = html;
    }
    function clearMess() { el.mess.innerHTML = ''; }
    // A finger dragged across the screen wipes off whatever it passes over
    function onWipe(e) {
      if (!el.mess.firstChild) return;
      if (e.type === 'pointermove' && e.pointerType === 'mouse' && !e.buttons) return;
      const box = el.wrap.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
      let hit = false;
      el.mess.querySelectorAll('.bu-splat:not(.wiped)').forEach(s => {
        const r = +s.dataset.r + 26;
        if (Math.hypot(parseFloat(s.style.left) - x, parseFloat(s.style.top) - y) < r) { s.classList.add('wiped'); hit = true; setTimeout(() => s.remove(), 320); }
      });
      if (hit) {
        sound.wipe();
        if (!el.mess.querySelector('.bu-splat:not(.wiped)')) setTimeout(() => { if (alive && !el.mess.querySelector('.bu-splat:not(.wiped)')) clearMess(); }, 340);
      }
    }

    // ── SCREENS ──
    const progress = () => load(PROGRESS_KEY, { unlocked: 0, stars: [], best: [] });
    // Three stars means flushing it early, not waiting for it to trickle through
    const starsFor = secs => secs <= g.L.head + g.len * g.L.tile * 0.6 ? 3 : secs <= g.L.head + g.len * g.L.tile * 0.95 ? 2 : 1;
    const starStr = n => '⭐'.repeat(n) + '<span style="opacity:0.25">' + '⭐'.repeat(3 - n) + '</span>';
    const endButtons = (again, ghost) => `
        <button type="button" class="bu-btn${ghost ? ' ghost' : ''}" data-again>${again}</button>
        <button type="button" class="bu-link" data-levels>${GRID_ICON}All jobs</button>
        <button type="button" class="bu-link" data-exit>${BACK_ICON}Back to the bog timer</button>`;
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
      clearMess();
      if (frame) { cancelAnimationFrame(frame); frame = null; }
      const p = progress();
      const open = i => preview || i <= p.unlocked;
      el.screen.innerHTML = `
        <div class="bu-hero bob">${DAZZA}<div class="bu-hero-say">She'll be right!</div></div>
        <div class="bu-title">Backed Up</div>
        <div class="bu-sub">Twist the pipes before she blows</div>
        <div class="bu-levels">
          ${LEVELS.map((L, i) => `<button type="button" class="bu-level" data-lv="${i}" ${open(i) ? '' : 'disabled'}>
            <div class="bu-level-n">${i + 1}</div>
            <div class="bu-level-t"><b>${L.name}</b><span>${open(i) ? L.sub + (p.best[i] ? ' · best ' + clock(p.best[i]) : '') : '🔒 Finish job ' + i + ' first'}</span></div>
            <div class="bu-stars">${p.stars[i] ? starStr(p.stars[i]) : ''}</div>
            ${open(i) ? `<div class="bu-play">Play ${PLAY_ICON}</div>` : '<div class="bu-play locked" aria-label="Locked">🔒</div>'}
          </button>`).join('')}
        </div>
        <div class="bu-box" style="margin-top:8px">
          <div class="bu-lbl" style="margin-bottom:6px">Instructions</div>
          <div class="bu-instr-text">Tap a pipe to twist it. Line up a run from the dunny at the top to the drain at the bottom.</div>
          <div class="bu-instr-text">When the pressure bar fills, she flushes and the sludge starts moving. Keep twisting ahead of it. Pipes with sludge in them are stuck.</div>
          <div class="bu-instr-text">All connected? Hit Flush it to send it through fast for more stars. Leave a gap and it goes everywhere.</div>
        </div>`;
      el.screen.hidden = false;
      el.screen.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => startLevel(+b.dataset.lv); });
    }

    function win() {
      g.state = 'won';
      g.head.p = 1;
      const total = Math.max(1, Math.round(g.secs));
      const stars = starsFor(g.secs);
      const p = progress();
      p.stars[g.lv] = Math.max(p.stars[g.lv] || 0, stars);
      const record = !p.best[g.lv] || total < p.best[g.lv];
      if (record) p.best[g.lv] = total;
      p.unlocked = Math.max(p.unlocked, Math.min(g.lv + 1, LEVELS.length - 1));
      save(PROGRESS_KEY, p);
      sound.win(); buzz([30, 60, 30]);
      say('win');
      const more = g.lv + 1 < LEVELS.length;
      const paid = '$' + (hourly() * g.secs / 3600).toFixed(2);
      endTimer = setTimeout(() => {
        if (!alive) return;
        el.screen.innerHTML = `
          <div class="bu-hero small bob">${DAZZA}</div>
          <div class="bu-title">Job Done!</div>
          <div class="bu-sub">Job ${g.lv + 1} · ${g.L.name}</div>
          <div class="bu-bigstars">${starStr(stars)}</div>
          <div class="bu-box">
            <div class="bu-lbl" style="margin-bottom:4px">Tax invoice · Dazza's Drains</div>
            <div class="bu-inv-row"><span>Pipes flushed</span><b>${g.count}</b></div>
            <div class="bu-inv-row"><span>Time on the tools</span><b>${clock(total)}${record ? ' · record' : ''}</b></div>
            <div class="bu-inv-row"><span>Mess made</span><b>None</b></div>
            <div class="bu-inv-row total"><span>Paid to play</span><b>${paid}</b></div>
          </div>
          ${more ? `<button type="button" class="bu-btn" data-next>${PLAY_ICON} Next job</button>` : ''}
          ${endButtons(more ? '↺ Do it again' : '↺ Play again', more)}`;
        wireEnd(on => { if (more) on('[data-next]', () => startLevel(g.lv + 1)); });
      }, 1100);
    }

    function loseScreen() {
      const paid = '$' + (hourly() * g.secs / 3600).toFixed(2);
      el.screen.innerHTML = `
        <div class="bu-hero small">${DAZZA_MUCKY}</div>
        <div class="bu-title">No Fix, No Fee</div>
        <div class="bu-sub">Job ${g.lv + 1} · ${g.L.name}</div>
        <div class="bu-quip">${el.say.textContent}</div>
        <div class="bu-box bu-grid">
          <div><div class="bu-lbl">Pipes flushed</div><div class="bu-val">${g.count}</div></div>
          <div><div class="bu-lbl">Paid to play</div><div class="bu-val green">${paid}</div></div>
          <div><div class="bu-lbl">Time</div><div class="bu-val">${clock(g.secs)}</div></div>
          <div><div class="bu-lbl">Dazza's fee</div><div class="bu-val">$0.00</div></div>
        </div>
        ${endButtons('↺ Have another crack')}`;
      wireEnd();
      const hint = el.mess.querySelector('.bu-wipe');
      if (hint) hint.hidden = false;
    }

    // ── INPUT ──
    function cellAt(e) {
      const r = el.canvas.getBoundingClientRect();
      const c = Math.floor((e.clientX - r.left) / T), rr = Math.floor((e.clientY - r.top - topH) / T);
      return rr >= 0 && rr < g.L.rows && c >= 0 && c < g.L.cols ? rr * g.L.cols + c : -1;
    }
    function onDown(e) {
      if (g.state !== 'play') return;
      const i = cellAt(e);
      if (i < 0) return;
      e.preventDefault();
      sound.init();
      twist(i);
    }
    function onKey(e) {
      if (e.key === 'Escape' && opts.onExit) opts.onExit();
      else if (e.key === ' ' && g.state === 'play') { e.preventDefault(); flushNow(); }
    }
    // Phone locked or app switched mid-job: stop, then wait for a tap so nobody comes back to a burst pipe
    function onVisible() {
      if (g.state !== 'play') return;
      if (document.visibilityState === 'hidden') { if (frame) cancelAnimationFrame(frame); frame = null; return; }
      if (window.GIPause) window.GIPause(root, () => { if (alive) startLoop(); }); else startLoop();
    }

    el.mute.onclick = () => { sound.muted = !sound.muted; save(MUTE_KEY, sound.muted); sound.init(); renderMute(); };
    el.flush.onclick = flushNow;
    el.canvas.addEventListener('pointerdown', onDown);
    el.canvas.addEventListener('contextmenu', e => e.preventDefault());
    el.wrap.addEventListener('pointerdown', onWipe);
    el.wrap.addEventListener('pointermove', onWipe);
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
        clearTimeout(endTimer);
        clearTimeout(sayTimer);
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisible);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', layout);
        root.innerHTML = '';
      },
      _test: { g, twist, start: startLevel, flush: flushNow, look },
    };
  }

  window.BackedUp = { mount, LEVELS, _gen: generate, _opens: opens };
})();
