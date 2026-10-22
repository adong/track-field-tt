/* TT Track & Field: the game. The title (1 or 2 players, who, EASY or NORMAL), the event cards, the sports day (all
   four events) or one event, the tries, the countdown, the touch pads and keys, the HUD, the brother who paces you,
   the high five, the medal podium with the winner's signature move, best marks, and window.game for tests.
   The rules live in js/sim.js (TF.sim), the stadium in js/scene.js (TF.scene). */
(function () {
  'use strict';
  const TF = window.TF, S = TF.sim, SC = TF.scene, sfx = TF.sfx, Snd = Kit.sound;
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ttTrackField.' + k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ttTrackField.' + k, String(v)); } catch (e) { /* storage blocked */ } },
  };
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const SIZE = { tommy: 0.78, froggy: 0.8, foxy: 0.86 }; // Tommy is 5: he's drawn smaller (the rules don't care)
  const size = (id) => SIZE[id] || 0.9;
  const BUDZ = -1.15; // the brother runs on the line just behind your lane (never between you and the camera)
  const MEDAL = { gold: '🥇', silver: '🥈', bronze: '🥉' };
  const PLACE = ['', '1ST', '2ND', '3RD', '4TH'];
  const JAV_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><line x1="6" y1="42" x2="38" y2="10" stroke="#14121f" stroke-width="4" stroke-linecap="round"/><polygon points="45,3 33,8 40,15" fill="#9aa3b0" stroke="#14121f" stroke-width="2" stroke-linejoin="round"/><line x1="17" y1="31" x2="23" y2="25" stroke="#ff3d7f" stroke-width="7"/></svg>';
  const EVTXT = {
    meet: ['🏅', 'SPORTS DAY', 'All 4 events. Win the most medals!'],
    sprint: ['🏃', '100 M SPRINT', 'Tap fast and dash to the finish!'],
    longjump: ['🦘', 'LONG JUMP', 'Run, jump at the board, land in the sand!'],
    javelin: [JAV_SVG, 'JAVELIN', 'Run and throw it far!'],
    hurdles: ['🚧', '60 M HURDLES', 'Run and hop over the hurdles!'],
  };

  let thumbs = {}, PICK = [];
  const G = {
    state: 'loading', prev: null, n: 1, slots: [{ id: 'teddy', level: 'easy' }, { id: 'tommy', level: 'easy' }],
    ath: [], meet: null, E: null, W: null, held: false, autoPause: true, timer: 0, intro: 0, seed: (Math.random() * 1e9) >>> 0,
    evCounter: 0, pace: -1, five: 0, bots: null, botAcc: 0, cel: [], props: [], lastHint: -9, same: [0, 0], lastFoot: ['', ''], clockT: 0, shout: {},
  };
  const B = { entry: null, A: null, state: 'away', t: 0, treatN: 0, tossed: false, flying: null, treats: [], x: 0, z: BUDZ, y: 0, ball: null, spot: null };

  // ---------------------------------------------------------------- little helpers
  function show(id, on) { $(id).classList.toggle('hidden', !on); }
  function toast(text, cls) {
    const d = document.createElement('div');
    d.className = 'toast' + (cls ? ' ' + cls : '');
    d.textContent = text;
    const box = $('toasts');
    while (box.children.length > 2) box.firstChild.remove();
    box.appendChild(d);
    d.addEventListener('animationend', () => d.remove());
  }
  function pop(text, x, y, z, cls) {
    const p = SC.project(x, y, z);
    if (!p.on) return;
    const d = document.createElement('div');
    d.className = 'pop' + (cls ? ' ' + cls : '');
    d.textContent = text;
    d.style.left = Math.max(60, Math.min(window.innerWidth - 60, p.x)) + 'px';
    d.style.top = Math.max(60, Math.min(window.innerHeight - 40, p.y)) + 'px';
    document.body.appendChild(d);
    d.addEventListener('animationend', () => d.remove());
  }
  function clearPops() { document.querySelectorAll('.pop').forEach((d) => d.remove()); }
  function banner(b1, b2, cls) {
    $('banner').innerHTML = `<div class="b1${cls ? ' ' + cls : ''}"></div>` + (b2 ? '<div class="b2"></div>' : '');
    $('banner').querySelector('.b1').textContent = b1;
    if (b2) $('banner').querySelector('.b2').textContent = b2;
    show('banner', true);
  }
  const humans = () => G.ath.filter((a) => a.human >= 0);
  const laneOf = (p) => G.ath.findIndex((a) => a.human === p);
  const fmt = (ev, v) => (v == null ? 'NO MARK' : S.fmt(ev, v));
  const ev = () => G.E && G.E.ev;
  const inEvent = () => G.state === 'intro' || G.state === 'play' || G.state === 'after';

  // ---------------------------------------------------------------- boot
  function boot() {
    SC.init($('game'));
    PICK = Kit.roster.list.filter((e) => !e.cpu);
    thumbs = Kit.portraits(Kit.roster.list);
    G.n = store.get('players', '1') === '2' ? 2 : 1;
    const p1 = Kit.roster.get(store.get('p1', 'teddy')) ? store.get('p1', 'teddy') : 'teddy';
    const p2 = Kit.roster.get(store.get('p2', 'tommy')) ? store.get('p2', 'tommy') : 'tommy';
    G.slots = [p1, p2].map((id) => ({ id, level: store.get('level.' + id, 'easy') === 'normal' ? 'normal' : 'easy' }));
    buildLogo();
    wireUI();
    Kit.lang.onChange(() => { SC.relabel(); buildSlots(); buildEventCards(); });
    resize();
    window.addEventListener('resize', resize);
    document.body.classList.toggle('keys', !window.matchMedia('(hover: none) and (pointer: coarse)').matches);
    toTitle();
    show('loading', false);
    requestAnimationFrame(loop);
  }
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return;
    SC.fit(w, h);
    if (G.state === 'results' || G.state === 'over') SC.podiumView(false, podShift());
  }
  const podShift = () => (window.innerHeight <= 560 && window.innerWidth / window.innerHeight > 1.3 ? 'side' : 'bottom');

  function buildLogo() {
    const t = window.TF_TITLE || 'TT Track & Field';
    const i = t.indexOf(' ');
    const l1 = i > 0 ? t.slice(0, i) : t, l2 = i > 0 ? t.slice(i + 1) : '';
    const tt = (s) => s.toUpperCase().replace(/&/g, '&amp;').replace(/TT/g, '<em>T</em><em>T</em>');
    $('logo').innerHTML = `<span class="l1">${tt(l1)}</span>` + (l2 ? `<span class="l2">${tt(l2)}</span>` : '');
  }

  // the player slots on the title: a face with arrows to change athlete, and EASY / NORMAL
  function buildSlots() {
    const box = $('slots');
    box.innerHTML = '';
    for (let i = 0; i < G.n; i++) {
      const sl = G.slots[i], c = Kit.roster.get(sl.id);
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.id = sl.id;
      el.innerHTML = `<div class="who">${G.n > 1 ? 'PLAYER ' + (i + 1) : 'ATHLETE'}</div>
        <div class="face"><button class="arrow" data-d="-1" aria-label="Previous athlete">◀</button><img alt="${c.name}" src="${thumbs[c.id] || ''}"><button class="arrow" data-d="1" aria-label="Next athlete">▶</button></div>
        <div class="nm">${c.name}</div>
        <div class="seg" role="group" aria-label="How hard"><button data-level="easy" aria-pressed="${sl.level === 'easy'}">🐣 EASY</button><button data-level="normal" aria-pressed="${sl.level === 'normal'}">🔥 NORMAL</button></div>`;
      el.querySelectorAll('.arrow').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); Snd.init(); sfx('click'); cycle(i, +b.dataset.d); }));
      el.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); Snd.init(); sfx('click'); setLevel(i, b.dataset.level); }));
      box.appendChild(el);
    }
  }
  function cycle(i, d) {
    const ids = PICK.map((e) => e.id);
    const k = (ids.indexOf(G.slots[i].id) + d + ids.length) % ids.length;
    G.slots[i] = { id: ids[k], level: store.get('level.' + ids[k], 'easy') === 'normal' ? 'normal' : 'easy' };
    store.set('p' + (i + 1), ids[k]);
    buildSlots();
    if (G.state === 'title') stageTitle();
    buddyReset();
  }
  function setLevel(i, level) {
    G.slots[i].level = level;
    store.set('level.' + G.slots[i].id, level);
    buildSlots();
    buildEventCards();
  }
  function setPlayers(n) {
    G.n = n;
    store.set('players', n);
    document.querySelectorAll('#playersSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === n)));
    buildSlots();
    if (G.state === 'title') stageTitle();
    buddyReset();
  }

  function buildEventCards() {
    const lv = G.slots[0].level;
    const card = (id) => {
      const [ic, nm, ds] = EVTXT[id];
      let bs = '';
      if (id !== 'meet') {
        const b = getBest(id, lv);
        if (b) bs = `${lv === 'easy' ? '🐣' : '🔥'} BEST ${S.fmt(S.EV[id], b.v)}`;
      } else {
        const w = +store.get('wins.' + G.slots[0].id, 0);
        if (w) bs = `🏆 × ${w}`;
      }
      return `<button class="evc${id === 'meet' ? ' meet' : ''}" data-ev="${id}"><span class="ic">${ic}</span>${id === 'meet' ? '<span class="txt">' : ''}<span class="nm">${nm}</span><span class="ds">${ds}</span><span class="bs">${bs}</span>${id === 'meet' ? '</span>' : ''}</button>`;
    };
    $('evCards').innerHTML = ['meet', 'sprint', 'longjump', 'javelin', 'hurdles'].map(card).join('');
    $('evCards').querySelectorAll('.evc').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); Snd.init(); sfx('click'); startMeet(b.dataset.ev); }));
  }

  function wireUI() {
    const tap = (id, f) => $(id).addEventListener('click', (e) => { e.stopPropagation(); Snd.init(); sfx('click'); f(); });
    tap('playBtn', () => showEvents());
    tap('backBtn', () => toTitle());
    tap('resumeBtn', () => resume());
    tap('quitBtn', () => toTitle());
    tap('pauseBtn', () => pause());
    tap('nextBtn', () => nextEvent());
    tap('againBtn', () => startMeet(G.meet ? G.meet.kind : 'meet'));
    tap('menuBtn', () => showEvents());
    $('muteBtn').addEventListener('click', (e) => { e.stopPropagation(); Snd.init(); toggleMute(); });
    $('buddyBtn').addEventListener('pointerdown', (e) => e.stopPropagation());
    $('buddyBtn').addEventListener('click', (e) => { e.stopPropagation(); Snd.init(); markTouch(e); callBuddy(); });
    document.querySelectorAll('#playersSeg button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); Snd.init(); sfx('click'); setPlayers(+b.dataset.n); b.blur(); }));
    $('muteBtn').textContent = Snd.isMuted() ? '🔇' : '🔊';
    Snd.onMute((m) => { $('muteBtn').textContent = m ? '🔇' : '🔊'; });
    // the pads: feet on pointerdown (fast taps), jump / throw held while the finger is down
    document.querySelectorAll('.foot').forEach((b) => b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); Snd.init(); markTouch(e);
      press(+b.dataset.p, b.dataset.f);
      b.classList.add('hit');
      setTimeout(() => b.classList.remove('hit'), 80);
    }));
    document.querySelectorAll('.act').forEach((b) => {
      const p = +b.dataset.p;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation(); Snd.init(); markTouch(e);
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
        b.classList.add('hit');
        press(p, 'A+');
      });
      const up = () => { if (b.classList.contains('hit')) { b.classList.remove('hit'); press(p, 'A-'); } };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
    });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', () => Snd.init());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (G.autoPause && inEvent()) pause();
        Snd.suspend();
      } else Snd.resume();
    });
    window.addEventListener('blur', () => { for (let p = 0; p < 2; p++) if (G.actDown && G.actDown[p]) { G.actDown[p] = false; press(p, 'A-'); } });
    setPlayers(G.n);
    buildEventCards();
  }
  function markTouch(e) { if (e && e.pointerType === 'touch') document.body.classList.remove('keys'); }
  function toggleMute() { Snd.toggleMute(); }

  // ---------------------------------------------------------------- screens
  function setScreen(id) {
    for (const s of ['title', 'events', 'pause', 'card']) show(s, s === id);
    const hud = G.state === 'intro' || G.state === 'play' || G.state === 'after' || G.state === 'results' || G.state === 'over';
    show('hud', hud);
    $('hud').classList.toggle('res', G.state === 'results' || G.state === 'over');
    if (!(G.state === 'intro' || G.state === 'play' || G.state === 'after')) { show('banner', false); show('gauge0', false); show('gauge1', false); }
  }

  function stageAthletes(list) {
    const same = G.ath.length === list.length && G.ath.every((a, i) => a.id === list[i].id && a.A);
    if (!same) {
      for (const a of G.ath) SC.removeAthlete(a.A);
      for (const a of list) a.A = SC.makeAthlete(a.entry, size(a.id), a.color);
    } else list.forEach((a, i) => { a.A = G.ath[i].A; });
    G.ath = list;
    for (const a of G.ath) SC.carryJavelin(a.A, false);
  }
  function roster() {
    const list = [];
    for (let p = 0; p < G.n; p++) {
      const sl = G.slots[p], e = Kit.roster.get(sl.id);
      list.push({ id: sl.id, entry: e, cpu: false, level: sl.level, human: p, color: e.tag || (p ? '#ff3d7f' : '#18d4ff') });
    }
    if (G.n === 1) for (const id of ['foxy', 'froggy']) { const e = Kit.roster.get(id); list.push({ id, entry: e, cpu: true, level: G.slots[0].level, human: -1, color: e.tag }); }
    return list;
  }

  function toTitle() {
    clearPodium();
    G.state = 'title';
    G.meet = null;
    G.E = null;
    G.W = null;
    setScreen('title');
    SC.setEvent('sprint');
    stageTitle();
    SC.titleView(true);
    buddyHome();
    Snd.music('title');
  }
  function stageTitle() { stageAthletes(roster()); }
  function showEvents() {
    clearPodium();
    G.state = 'events';
    G.E = null;
    G.W = null;
    buildEventCards();
    setScreen('events');
    SC.setEvent('sprint');
    stageTitle();
    SC.titleView(true);
    buddyHome();
    Snd.music('title');
  }

  // ---------------------------------------------------------------- the meet, an event, a try
  function startMeet(kind) {
    clearPodium();
    const list = roster();
    stageAthletes(list);
    G.meet = { kind, list: kind === 'meet' ? S.EVENTS.map((e) => e.id) : [kind], idx: 0, medals: G.ath.map(() => []) };
    G.seed = (G.seed * 1103515245 + 12345) >>> 0;
    Snd.music('play');
    startEvent(0);
  }
  function startEvent(i) {
    clearPodium();
    G.meet.idx = i;
    const e = S.EV[G.meet.list[i]];
    G.evCounter++;
    G.E = { ev: e, tryN: 0, vals: G.ath.map(() => []) };
    SC.setEvent(e.id);
    $('evName').textContent = e.name;
    $('pads').classList.toggle('noact', e.id === 'sprint');
    $('pads').className = (G.n === 2 ? 'two' : 'one') + (e.id === 'sprint' ? ' noact' : '');
    document.querySelectorAll('.actl').forEach((s) => { s.textContent = e.kind === 'throw' ? 'THROW' : 'JUMP'; });
    setKeyLabels();
    buildChips();
    startTry();
  }
  function setKeyLabels() {
    const one = G.n === 1;
    $('k0L').textContent = one ? '←' : 'A';
    $('k0R').textContent = one ? '→' : 'D';
    $('k0A').textContent = one ? 'SPACE' : 'W';
    $('k1L').textContent = '←';
    $('k1R').textContent = '→';
    $('k1A').textContent = '↑';
  }
  function startTry() {
    const E = G.E, e = E.ev;
    const lanes = G.ath.map((a) => ({ who: a.id, cpu: a.cpu, level: a.level, paced: a.human === 0 && G.n === 1 && G.pace === G.evCounter }));
    G.W = S.world(e.id, lanes, { seed: (G.seed + G.evCounter * 7919) >>> 0, tryN: E.tryN });
    E.seen = G.ath.map(() => ({ fin: false, knock: 0, state: 'ready', dust: 0, hopShout: -1, jumpShout: false }));
    G.lastHint = -9;
    G.same = [0, 0];
    G.lastT = -99;
    G.state = 'intro';
    G.intro = E.tryN === 0 ? 1.8 : 0.6;
    clearPops();
    setScreen(null);
    for (const a of G.ath) SC.carryJavelin(a.A, e.kind === 'throw');
    if (e.kind !== 'race') SC.resetHurdles();
    SC.follow(1.5, { zc: G.n === 2 ? -1.15 : -2.3, snap: true });
    if (B.state === 'here' && G.n === 1) { B.x = 0.6; B.y = 0; }
    if (E.tryN === 0) banner(e.name, howTo(e));
    else banner(`TRY ${E.tryN + 1} OF ${e.tries}`, '');
    $('evSub').textContent = G.meet.list.length > 1 ? `EVENT ${G.meet.idx + 1} OF ${G.meet.list.length}` : e.tries > 1 ? `TRY ${E.tryN + 1} OF ${e.tries}` : '';
    if (G.meet.list.length > 1 && e.tries > 1) $('evSub').textContent = `EVENT ${G.meet.idx + 1} OF ${G.meet.list.length} · TRY ${E.tryN + 1} OF ${e.tries}`;
    $('clock').textContent = e.kind === 'race' ? '0.00' : '';
    updateChips(true);
  }
  function howTo(e) {
    const allNormal = humans().every((a) => a.level === 'normal');
    if (e.kind === 'race') return e.hurdles ? 'TAP FAST, AND JUMP OVER EVERY HURDLE!' : allNormal ? 'LEFT, RIGHT, LEFT, RIGHT! FAST!' : 'TAP FAST TO RUN!';
    if (e.kind === 'jump') return allNormal ? 'HOLD JUMP AT THE BOARD, LET GO AT THE GOLD!' : 'TAP FAST, THEN JUMP AT THE WHITE BOARD!';
    return allNormal ? 'HOLD THROW AT THE LINE, LET GO AT THE GOLD!' : 'TAP FAST, THEN THROW AT THE WHITE LINE!';
  }
  function beginTry() {
    G.state = 'play';
    show('banner', false);
  }

  // the countdown and every moment worth a sound, a pop or a flag
  function watch() {
    const W = G.W, e = W.ev, E = G.E;
    const t0 = G.lastT, t1 = W.t;
    G.lastT = t1;
    const crossed = (x) => t0 < x && t1 >= x;
    if (t0 < -S.COUNT + 0.01 && t1 >= -S.COUNT) { banner(e.kind === 'race' ? 'ON YOUR MARKS' : 'READY', ''); sfx('beep'); }
    if (crossed(-1.2)) { banner('SET', ''); sfx('beep'); }
    if (crossed(0)) { banner('GO!', '', 'go'); sfx(e.kind === 'race' ? 'gun' : 'whistle'); SC.cheer(0.6); }
    if (crossed(0.9)) show('banner', false);
    W.lanes.forEach((a, i) => {
      const s = E.seen[i], at = G.ath[i], A = at.A, z = SC.laneZ(i);
      // tips for a stuck kid
      if (at.human >= 0 && a.state === 'ready' && t1 > 2.2 && G.lastHint < 0) { G.lastHint = t1; toast(document.body.classList.contains('keys') ? (G.n === 1 ? 'TAP ← → FAST TO RUN!' : 'TAP YOUR TWO KEYS FAST TO RUN!') : 'TAP THE FEET FAST TO RUN!', 'hint'); }
      if (a.state !== s.state) {
        if (a.state === 'air' && at.human >= 0) sfx('hop');
        if (a.state === 'fly') sfx('leap');
        if (a.state === 'thrown') sfx('throw');
        s.state = a.state;
      }
      if (a.knocked.length > s.knock) {
        for (let k = s.knock; k < a.knocked.length; k++) SC.knock(i, a.knocked[k]);
        s.knock = a.knocked.length;
        sfx('clatter');
        if (at.human >= 0) pop('OOPS!', a.x, 2.2, z, 'bad');
      }
      if (a.fin && !s.fin) {
        s.fin = true;
        if (e.kind === 'race') {
          const before = W.lanes.filter((b) => b !== a && b.fin && b.finish != null && b.finish < a.finish).length;
          const place = before + 1;
          if (place === 1) { SC.breakTape(); sfx('tape'); SC.cheer(1.5); sfx('cheer', at.human >= 0); }
          pop(`${PLACE[Math.min(4, place)]}! ${a.finish.toFixed(2)}`, a.x, 2.4, z, place === 1 ? 'gold' : '');
          if (at.human >= 0 && place === 1) sfx('fanfare');
        } else {
          const color = at.color;
          if (a.mark == null) {
            sfx('foul');
            pop(a.why === 'early' ? 'TOO EARLY!' : 'FOUL!', e.kind === 'throw' ? e.line : a.x, 2.4, z, 'bad');
            if (at.human >= 0) toast(a.why === 'early' ? 'TOO EARLY! RUN CLOSER TO THE LINE.' : e.kind === 'throw' ? 'FOUL! YOU STEPPED OVER THE LINE.' : 'FOUL! YOU STEPPED OVER THE BOARD.', 'bad');
            if (a.jav && a.jav.state === 'stuck') { SC.flyJavelin(A, a.jav); SC.dropJavelin(A); }
          } else if (e.kind === 'jump') {
            SC.fx.sand(a.x, z);
            sfx('sand');
            SC.markFlag(a.x + S.REACH, z, color, a.mark.toFixed(2));
            pop(S.fmt(e, a.mark), a.x, 2.0, z, at.human >= 0 ? 'gold' : '');
            if (at.human >= 0) SC.cheer(1);
          } else {
            sfx('stick');
            SC.flyJavelin(A, a.jav);
            SC.dropJavelin(A);
            SC.markFlag(a.jav.x, z, color, a.mark.toFixed(2));
            pop(S.fmt(e, a.mark), a.jav.x, 2.0, z, at.human >= 0 ? 'gold' : '');
            if (at.human >= 0) SC.cheer(1);
          }
        }
        updateChips();
      }
      // the brother pacing you shouts when it's time
      if (at.human === 0 && B.state === 'here' && G.pace === G.evCounter && a.state === 'run') {
        if (e.hurdles) {
          const k = a.hurdle, hx = e.hurdles[k];
          if (hx != null && s.hopShout < k && hx - a.x <= a.v * 0.9) { s.hopShout = k; toast(`${B.entry.name} SAYS: JUMP!`, 'buddy'); }
        } else if (e.kind !== 'race' && !s.jumpShout && e.line - a.x <= S.PACE.window) {
          s.jumpShout = true;
          toast(`${B.entry.name} SAYS: ${e.kind === 'throw' ? 'THROW' : 'JUMP'} NOW!`, 'buddy');
        }
      }
    });
  }

  function endTry() {
    const E = G.E, e = E.ev;
    S.results(G.W).forEach((r, i) => E.vals[i].push(r.value));
    if (E.tryN + 1 < e.tries) { E.tryN++; startTry(); } else finishEvent();
  }

  // ---------------------------------------------------------------- results: the podium and the card
  function finishEvent() {
    const E = G.E, e = E.ev;
    const best = G.ath.map((a, i) => S.best(e, E.vals[i]));
    const places = S.places(e, best);
    const medals = places.map(S.medal);
    medals.forEach((m, i) => G.meet.medals[i].push(m));
    E.best = best;
    E.places = places;
    // best marks, per event and level
    let newBest = false;
    for (const a of humans()) {
      const i = G.ath.indexOf(a), v = best[i];
      if (v == null) continue;
      const old = getBest(e.id, a.level);
      if (!old || (e.kind === 'race' ? v < old.v : v > old.v)) { setBest(e.id, a.level, v, a.entry.name); newBest = true; }
    }
    if (G.pace === G.evCounter && B.state === 'here') { B.state = 'bye'; B.t = 0; }
    G.state = 'results';
    setScreen('card');
    stagePodium(places);
    const order = G.ath.map((a, i) => i).sort((p, q) => (places[p] || 9) - (places[q] || 9) || p - q);
    const rows = order.map((i) => {
      const a = G.ath[i], pl = places[i];
      const tries = e.tries > 1 ? E.vals[i].map((v) => (v == null ? '✗' : v.toFixed(2))).join(' · ') : e.hurdles ? (E.vals[i].length && G.W.lanes[i].hits ? `💥 ${G.W.lanes[i].hits}` : '') : '';
      return `<tr class="${a.human >= 0 ? 'me' : ''}"><td class="pl">${pl ? MEDAL[S.medal(pl)] || PLACE[pl] : '–'}</td><td><div class="who"><img src="${thumbs[a.id] || ''}" alt="">${a.entry.name}</div></td><td class="val">${fmt(e, best[i])}</td>${e.tries > 1 || e.hurdles ? `<td class="tries">${tries}</td>` : ''}</tr>`;
    });
    $('cardTitle').textContent = e.name;
    $('cardSub').textContent = resultLine(places);
    $('cardTable').innerHTML = rows.join('');
    $('newBest').classList.toggle('on', newBest);
    $('cardBest').innerHTML = bestLines(e);
    const more = G.meet.list.length > 1;
    $('nextBtn').classList.toggle('gone', !more);
    $('nextBtn').textContent = more && G.meet.idx + 1 >= G.meet.list.length ? '🏆 MEDAL TABLE' : '▶ NEXT EVENT';
    $('againBtn').classList.toggle('gone', more);
    $('menuBtn').classList.toggle('gone', more);
    updateChips(true);
  }
  function resultLine(places) {
    if (G.n === 1) {
      const pl = places[laneOf(0)];
      return pl === 1 ? 'GOLD MEDAL! YOU WON!' : pl === 2 ? 'SILVER MEDAL! SO CLOSE!' : pl === 3 ? 'BRONZE MEDAL! WELL DONE!' : 'NO MEDAL THIS TIME. TRY AGAIN!';
    }
    const [i0, i1] = [laneOf(0), laneOf(1)];
    if (places[i0] === places[i1]) return places[i0] ? 'A TIE! GOLD FOR BOTH!' : 'NO MARKS! TRY AGAIN!';
    const w = (places[i0] || 9) < (places[i1] || 9) ? G.ath[i0] : G.ath[i1];
    return `${w.entry.name} WINS!`;
  }
  function bestLines(e) {
    const lv = [...new Set(humans().map((a) => a.level))];
    return lv.map((l) => {
      const b = getBest(e.id, l);
      return b ? `<span>${l === 'easy' ? '🐣' : '🔥'} BEST: ${S.fmt(e, b.v)} · ${b.who}</span>` : '';
    }).join(' &nbsp; ');
  }
  function getBest(id, level) { try { const v = JSON.parse(store.get(`best.${id}.${level}`, 'null')); return v && typeof v.v === 'number' ? v : null; } catch (e) { return null; } }
  function setBest(id, level, v, who) { store.set(`best.${id}.${level}`, JSON.stringify({ v, who })); }

  function nextEvent() {
    if (G.meet.idx + 1 < G.meet.list.length) startEvent(G.meet.idx + 1);
    else meetEnd();
  }
  function meetEnd() {
    const tbl = S.table(G.ath.map((a, i) => ({ who: a.id, medals: G.meet.medals[i] })));
    const places = G.ath.map(() => null);
    let rank = 0;
    tbl.forEach((c, k) => { if (k === 0 || c.pts !== tbl[k - 1].pts || c.gold !== tbl[k - 1].gold || c.silver !== tbl[k - 1].silver) rank = k + 1; places[c.i] = c.pts > 0 ? rank : null; });
    const champs = tbl.filter((c) => c.win).map((c) => G.ath[c.i]);
    for (const a of champs) if (a.human >= 0) store.set('wins.' + a.id, +store.get('wins.' + a.id, 0) + 1);
    G.state = 'over';
    setScreen('card');
    stagePodium(places);
    $('cardTitle').textContent = 'SPORTS DAY RESULTS';
    const names = champs.map((a) => a.entry.name);
    $('cardSub').textContent = !names.length ? 'NO MEDALS TODAY. TRY AGAIN!' : names.length > 1 ? `${names.join(' AND ')} SHARE THE CUP!` : champs[0].human >= 0 ? `${names[0]} IS THE CHAMPION!` : `${names[0]} WINS THE DAY! TRY AGAIN!`;
    $('cardTable').innerHTML = '<thead><tr><th></th><th></th><th>🥇</th><th>🥈</th><th>🥉</th><th>POINTS</th></tr></thead>' + tbl.map((c, k) => {
      const a = G.ath[c.i];
      return `<tr class="${a.human >= 0 ? 'me' : ''}"><td class="pl">${c.win ? '🏆' : k + 1}</td><td><div class="who"><img src="${thumbs[a.id] || ''}" alt="">${a.entry.name}</div></td><td>${c.gold}</td><td>${c.silver}</td><td>${c.bronze}</td><td class="val">${c.pts}</td></tr>`;
    }).join('');
    $('newBest').classList.remove('on');
    $('cardBest').innerHTML = humans().map((a) => `<span>🏆 ${a.entry.name}: ${+store.get('wins.' + a.id, 0)}</span>`).join(' &nbsp; ');
    $('nextBtn').classList.add('gone');
    $('againBtn').classList.remove('gone');
    $('menuBtn').classList.remove('gone');
    Snd.music('over');
  }

  // everybody on the podium (or beside it), the winners do their signature move, confetti
  function stagePodium(places) {
    clearPodium();
    clearPops();
    SC.podiumView(true, podShift());
    const count = {}, seen = {};
    places.forEach((p) => { const k = p && p <= 3 ? p : 4; count[k] = (count[k] || 0) + 1; });
    G.podium = places.map((p, i) => {
      const k = p && p <= 3 ? p : 4;
      const n = seen[k] = (seen[k] || 0) + 1;
      const pos = SC.podiumSpot(k);
      pos.x += (n - 1 - (count[k] - 1) / 2) * (k === 4 ? 1.1 : 0.75);
      if (k === 4) pos.z += 0.6;
      const a = G.ath[i];
      if (p && p <= 3) {
        const s = SC.emojiSprite(MEDAL[S.medal(p)], 0.42 / a.A.scale);
        a.A.holder.add(s);
        s.position.set(0.3, 1.2, 0);
        G.props.push(s);
      }
      return { pos, win: p === 1 };
    });
    G.cel = G.podium.map((p, i) => (p.win ? { entry: G.ath[i].entry, t: 0, k: 0 } : null));
    for (const a of G.ath) SC.carryJavelin(a.A, false);
    if (places.some((p) => p === 1)) {
      const s = SC.podiumSpot(1);
      SC.fx.confetti(s.x, 4.5, s.z, 160);
      sfx('fanfare');
      sfx('cheer', true);
      SC.cheer(2.5);
      const p0 = places[laneOf(0)];
      if (p0) setTimeout(() => sfx('medal', p0), 700);
    }
    if (B.A && B.state !== 'away') { B.x = SC.POD.x + 3.6; B.z = SC.POD.z + 1.2; B.y = 0; }
  }
  function clearPodium() {
    for (const s of G.props) SC.removeObj(s);
    G.props = [];
    G.podium = null;
    G.cel = [];
    if (B.ball) { SC.removeObj(B.ball); B.ball = null; }
  }

  // ---------------------------------------------------------------- the brother: call him any time (1 player)
  const buddyEntry = () => Kit.roster.get(Kit.roster.buddyFor(G.slots[0].id)) || Kit.roster.get('tommy');
  function buddyReset() {
    const e = buddyEntry();
    $('buddyFace').src = thumbs[e.id] || '';
    $('buddyName').textContent = e.name;
    $('buddyBtn').classList.toggle('five', G.n === 2);
    $('buddyBtn').title = G.n === 2 ? 'High five (T)' : 'Call your brother (T)';
    $('buddySub').textContent = G.n === 2 ? 'HIGH FIVE!' : 'TAP ME!';
    if (B.A && (G.n === 2 || B.entry !== e)) { SC.removeAthlete(B.A); B.A = null; B.state = 'away'; G.pace = -1; }
  }
  function buddyHome() { if (B.A && B.state !== 'away') { B.x = 1.6; B.z = BUDZ; B.y = 0; } }
  function anchor() {
    const i = laneOf(0), a = G.ath[i];
    if (G.state === 'results' || G.state === 'over') return { x: SC.POD.x + 3.6, z: SC.POD.z + 1.2 };
    const x = a && a.A ? a.A.holder.position.x : 0;
    return { x: x + 1.4, z: BUDZ };
  }
  function callBuddy() {
    if (G.n === 2) return highFive();
    if (G.state === 'paused' || G.state === 'loading') return;
    const e = buddyEntry();
    if (!B.A || B.entry !== e) {
      if (B.A) SC.removeAthlete(B.A);
      B.entry = e;
      B.A = SC.makeAthlete(e, e.buddyScale || 0.8, e.tag || '#ffd27a');
      B.state = 'away';
    }
    if (B.state === 'away' || B.state === 'bye') {
      const p = anchor();
      B.x = p.x; B.z = p.z; B.y = 0;
      B.A.holder.visible = true;
      SC.fx.poof(B.x, 0, B.z);
      sfx('poof');
      toast(`${e.name} IS HERE!`, 'buddy');
    }
    B.state = 'hello';
    B.t = 0;
    B.tossed = false;
    B.treatN++;
    $('buddyBtn').classList.add('here');
  }
  function tossTreat() {
    const [emoji, name] = TREATS[(B.treatN - 1) % TREATS.length];
    const s = SC.emojiSprite(emoji, 0.55);
    const from = new THREE.Vector3(B.x, 1.3, B.z);
    const i = laneOf(0), a = G.ath[i];
    const to = a && a.A ? a.A.holder.position.clone().add(new THREE.Vector3(0.5, 0.3, 0.5)) : from.clone();
    to.y = Math.max(0.3, to.y + 0.3);
    B.flying = { s, from, to, t: 0, emoji, name };
    sfx('swish');
  }
  // the helper: after his signature move and the treat, he paces you on the next event
  function help() {
    const e = B.entry;
    G.pace = inEvent() ? G.evCounter : G.evCounter + 1;
    if (inEvent() && G.W && !G.W.done) {
      const lane = laneOf(0);
      S.input(G.W, lane, 'P', G.state === 'intro' ? -S.COUNT : S.now(G.W));
    }
    toast(`${e.name} SAYS: I'LL PACE YOU! RUN WITH ME!`, 'buddy');
    sfx('powerup');
  }
  function buddyUpdate(dt) {
    const f = B.flying;
    if (f) {
      f.t += dt / 0.75;
      const u = Math.min(1, f.t);
      f.s.position.lerpVectors(f.from, f.to, u);
      f.s.position.y += Math.sin(u * Math.PI) * 1.4;
      f.s.material.rotation = u * 6;
      if (u >= 1) {
        sfx('treat');
        toast(`${f.emoji} ${f.name} FROM ${B.entry.name}!`, 'buddy');
        f.s.material.rotation = 0;
        B.treats.push({ s: f.s, t: 0 });
        B.flying = null;
      }
    }
    for (let i = B.treats.length - 1; i >= 0; i--) {
      const tr = B.treats[i];
      tr.t += dt;
      if (tr.t > 2.5) { SC.removeObj(tr.s); B.treats.splice(i, 1); }
    }
    if (!B.A || B.state === 'away') return;
    B.t += dt;
    let mode = 'stand', speed = 0, turn = 0;
    if (B.state === 'hello') {
      mode = Kit.roster.signature(B.entry, 'hello');
      turn = -Math.PI / 2;
      if (B.t > 0.9 && !B.tossed) { B.tossed = true; tossTreat(); }
      if (B.t > 1.9) { B.state = 'here'; B.t = 0; help(); }
    } else if (B.state === 'bye') {
      mode = Kit.roster.signature(B.entry, 'goodbye');
      turn = -Math.PI / 2;
      if (mode === 'jumpshot') {
        B.y = Math.max(0, Math.sin(Math.min(1, B.t / 0.8) * Math.PI)) * 0.6;
        if (!B.ball && B.t > 0.35) B.ball = SC.emojiSprite('🏀', 0.35);
        if (B.ball) { const u = B.t - 0.35; B.ball.position.set(B.x + u * 1.6, 1.9 + u * 3.2 - u * u * 3.5, B.z); }
      }
      if (B.t > 1.4) {
        if (B.ball) { SC.removeObj(B.ball); B.ball = null; }
        SC.fx.poof(B.x, 0, B.z);
        sfx('poof');
        B.state = 'away';
        B.y = 0;
        B.A.holder.visible = false;
        $('buddyBtn').classList.remove('here');
      }
    } else if (inEvent() && G.W && G.pace === G.evCounter) {
      // pacing: a step ahead of you, never too far, he waits if you slow down
      const i = laneOf(0), a = G.W.lanes[i], e = G.W.ev;
      if (G.W.t < 0 || a.state === 'ready') { B.x += (0.6 - B.x) * Math.min(1, dt * 3); mode = 'stand'; }
      else if (e.kind !== 'race' && B.x >= e.line - 1.6) { mode = 'give'; B.x = Math.min(B.x, e.line - 1.6); }
      else if (a.fin && e.kind === 'race') { speed = 0; mode = 'wave'; }
      else {
        const hx = a.x;
        speed = Math.max(4.5, Math.min(11, (a.v || 0) + 1));
        B.x = Math.max(hx - 0.5, Math.min(hx + 3.2, B.x + speed * dt));
        if (e.kind !== 'race') B.x = Math.min(B.x, e.line - 1.6);
        mode = 'run';
      }
    } else {
      mode = Math.sin(B.t * 0.9) > 0.85 ? Kit.roster.signature(B.entry, 'hello') : 'stand';
      turn = -Math.PI / 2;
    }
    SC.animAthlete(B.A, { x: B.x, y: B.y, z: B.z, mode, speed, turn }, dt);
  }

  // 2 players: T (or the 🙌 button) is a high five
  function highFive() {
    if (G.state === 'paused' || G.state === 'loading' || G.five > 0) return;
    G.five = 0.9;
    sfx('five');
    toast('🙌 HIGH FIVE!', 'buddy');
    const hs = humans().filter((a) => a.A);
    if (hs.length === 2) {
      const p = hs[0].A.holder.position, q = hs[1].A.holder.position;
      SC.fx.clap((p.x + q.x) / 2, Math.max(p.y, q.y) + 1.7, (p.z + q.z) / 2);
    }
  }

  // ---------------------------------------------------------------- input
  const KEYS1 = { a: ['L', 0], arrowleft: ['L', 0], d: ['R', 0], arrowright: ['R', 0], ' ': ['A', 0], arrowup: ['A', 0], w: ['A', 0], s: ['A', 0], arrowdown: ['A', 0] };
  const KEYS2 = { a: ['L', 0], d: ['R', 0], w: ['A', 0], s: ['A', 0], arrowleft: ['L', 1], arrowright: ['R', 1], arrowup: ['A', 1], arrowdown: ['A', 1] };
  G.actDown = [false, false];
  function press(p, key) {
    if (key === 'A+') G.actDown[p] = true;
    if (key === 'A-') { if (!G.actDown[p]) return; G.actDown[p] = false; }
    if (G.state !== 'play' || !G.W) return;
    const lane = laneOf(p);
    if (lane < 0) return;
    S.input(G.W, lane, key, S.now(G.W));
    if (key === 'L' || key === 'R') {
      const a = G.W.lanes[lane];
      const same = G.lastFoot[p] === key;
      G.lastFoot[p] = key;
      sfx(same && a.level === 'normal' ? 'weak' : 'step', key);
      G.same[p] = same ? G.same[p] + 1 : 0;
      if (a.level === 'normal' && G.same[p] >= 4 && G.W.t - G.lastHint > 4) { G.lastHint = G.W.t; toast('LEFT, RIGHT, LEFT, RIGHT!', 'hint'); }
    }
  }
  function onKey(e) {
    const k = e.key.toLowerCase();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    Snd.init();
    if (!e.repeat) document.body.classList.add('keys');
    if (k === 'm') { toggleMute(); return; }
    if (k === 'p' || k === 'escape') {
      if (G.state === 'paused') resume();
      else if (inEvent()) pause();
      else if (G.state === 'events' && k === 'escape') toTitle();
      return;
    }
    if (G.state === 'paused') { if (k === 'enter') resume(); return; }
    if (k === 't') { if (!e.repeat) callBuddy(); return; }
    if (G.state === 'title') {
      if (k === 'enter') { e.preventDefault(); sfx('click'); showEvents(); }
      else if (G.n === 1 && (k === 'arrowleft' || k === 'arrowright')) cycle(0, k === 'arrowleft' ? -1 : 1);
      else if (G.n === 2 && (k === 'a' || k === 'd')) cycle(0, k === 'a' ? -1 : 1);
      else if (G.n === 2 && (k === 'arrowleft' || k === 'arrowright')) cycle(1, k === 'arrowleft' ? -1 : 1);
      else if (k === 'e') setLevel(0, G.slots[0].level === 'easy' ? 'normal' : 'easy');
      else if (k === '1' || k === '2') setPlayers(+k);
      return;
    }
    if (G.state === 'events') {
      const ids = ['meet', 'sprint', 'longjump', 'javelin', 'hurdles'];
      if (k === 'enter') { e.preventDefault(); startMeet('meet'); } else if (/^[1-5]$/.test(k)) startMeet(ids[+k - 1]);
      return;
    }
    if (G.state === 'results' || G.state === 'over') {
      if (k === 'enter' || k === ' ') { e.preventDefault(); if (!$('nextBtn').classList.contains('gone')) nextEvent(); else startMeet(G.meet.kind); }
      return;
    }
    const m = (G.n === 1 ? KEYS1 : KEYS2)[k];
    if (m && inEvent()) {
      e.preventDefault();
      if (e.repeat) return;
      if (m[0] === 'A') press(m[1], 'A+'); else press(m[1], m[0]);
    }
  }
  function onKeyUp(e) {
    const m = (G.n === 1 ? KEYS1 : KEYS2)[e.key.toLowerCase()];
    if (m && m[0] === 'A') press(m[1], 'A-');
  }

  function pause() {
    if (!inEvent()) return;
    G.prev = G.state;
    G.state = 'paused';
    setScreen('pause');
    Snd.music('pause');
  }
  function resume() {
    if (G.state !== 'paused') return;
    G.state = G.prev || 'play';
    setScreen(null);
    Snd.music('play');
  }

  // ---------------------------------------------------------------- the frame
  function poseOf(e, a, W) {
    switch (a.state) {
      case 'ready': return W.t < -1.2 ? { mode: 'guard', crouch: 1, lean: -0.45 } : { mode: 'guard', crouch: 0.45, lean: -0.8 };
      case 'run': return { mode: a.stumble > 0.12 ? 'fall' : 'run', speed: a.v };
      case 'air': return { mode: 'jump', lean: -0.35 };
      case 'aim': return { mode: 'guard', crouch: 0.5, lean: -0.25 };
      case 'fly': return { mode: 'jump', lean: -0.15 };
      case 'landed': return { mode: a.mark ? 'fall' : 'stand', crouch: a.mark ? 0.9 : 0 };
      case 'thrown': return { mode: a.v > 0.6 ? 'straight' : 'stand', lean: -0.2 };
      case 'foul': return { mode: 'stand' };
      default: return { mode: a.v > 1.2 ? 'run' : 'wave', speed: a.v };
    }
  }
  function drawAthletes(dt) {
    const e = ev();
    G.ath.forEach((at, i) => {
      const A = at.A;
      let st;
      if ((G.state === 'results' || G.state === 'over') && G.podium) {
        const p = G.podium[i];
        st = { x: p.pos.x, y: p.pos.y, z: p.pos.z, mode: 'stand', turn: -Math.PI / 2 };
        const c = G.cel[i];
        if (c) {
          c.t += dt;
          const modes = c.entry.signature || ['wave'];
          const m = modes[Math.floor(c.t / 1.8) % modes.length];
          st.mode = m;
          if (m === 'jumpshot' || m === 'jump') {
            const u = (c.t % 1.8) / 1.8;
            st.y += Math.max(0, Math.sin(Math.min(1, u / 0.5) * Math.PI)) * 0.55;
            if (m === 'jumpshot' && u < 0.05 && !c.ball) {
              c.ball = SC.emojiSprite('🏀', 0.4);
              c.bt = 0;
              G.props.push(c.ball);
            }
          }
          if (c.ball) {
            c.bt += dt;
            c.ball.position.set(st.x + c.bt * 1.4, st.y + 2.0 + c.bt * 3 - c.bt * c.bt * 4, st.z);
            if (c.bt > 1.2) { SC.removeObj(c.ball); c.ball = null; }
          }
        } else if (G.podium[i].pos.y > 0) st.mode = 'wave';
      } else if (inEvent()) {
        if (!G.W) return;
        const a = G.W.lanes[i];
        st = Object.assign({ x: a.x, y: a.y, z: SC.laneZ(i) }, poseOf(e, a, G.W));
        st.carry = e.kind === 'throw' && (a.state === 'ready' || a.state === 'run' || a.state === 'aim');
        if (a.jav && a.jav.state === 'fly') {
          SC.flyJavelin(A, a.jav);
          const s = G.E.seen[i];
          s.trail = (s.trail || 0) - dt;
          if (s.trail <= 0) { s.trail = 0.03; SC.fx.trail(a.jav.x, a.jav.y, SC.laneZ(i)); }
        }
        if (a.state === 'run' && a.v > 5 && G.state !== 'paused') {
          const s = G.E.seen[i];
          s.dust = (s.dust || 0) - dt;
          if (s.dust <= 0) { s.dust = 0.14; SC.fx.dust(a.x, SC.laneZ(i)); }
        }
      } else {
        st = { x: -0.8, z: SC.laneZ(i), mode: 'run', speed: 1.2 }; // warming up at the start line
      }
      if (G.five > 0 && at.human >= 0) {
        const running = inEvent() && G.W && G.W.lanes[i].state === 'run';
        st.mode = 'give';
        if (!running && !G.podium) st.turn = at.human === 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      if (e && e.kind === 'throw' && inEvent() && !st.carry && G.W && !G.W.lanes[i].jav) SC.carryJavelin(A, false);
      SC.animAthlete(A, st, dt);
    });
  }

  function camera() {
    if (!inEvent() || !G.W) return;
    const W = G.W, e = W.ev;
    const xs = [];
    let wide = 0, y = 0.9;
    for (const at of humans()) {
      const i = G.ath.indexOf(at), a = W.lanes[i];
      if (a.jav) { xs.push(a.jav.x + (a.jav.state === 'fly' ? 2 : -2)); wide = 6; y = Math.max(y, a.jav.y * 0.75); } else xs.push(a.x);
    }
    const lo = Math.min(...xs), hi = Math.max(...xs);
    SC.follow(Math.max(1.5, (lo + hi) / 2), { spread: hi - lo, zc: G.n === 2 ? -1.15 : -2.3, wide, y });
  }

  function updateFive(dt) { if (G.five > 0) G.five = Math.max(0, G.five - dt); }

  function buildChips() {
    $('chips').innerHTML = G.ath.map((a, i) => `<div class="chip" style="--c:${a.color}"><img src="${thumbs[a.id] || ''}" alt=""><span class="nm">${a.entry.name}</span><span class="val" id="cv${i}"></span><span class="md" id="cm${i}"></span></div>`).join('');
    G.chipTxt = [];
  }
  function updateChips(force) {
    if (!G.E) return;
    const e = G.E.ev;
    G.ath.forEach((a, i) => {
      let v = '';
      if (e.kind === 'race') { const l = G.W && G.W.lanes[i]; v = l && l.finish != null ? l.finish.toFixed(2) : ''; }
      else {
        const vals = G.E.vals[i].slice();
        const l = G.W && G.W.lanes[i];
        if (l && l.fin && G.state !== 'results') vals.push(l.mark);
        const b = S.best(e, vals);
        v = b != null ? S.fmt(e, b) : vals.length ? 'FOUL' : '';
      }
      const md = G.meet ? G.meet.medals[i].filter(Boolean).map((m) => MEDAL[m]).join('') : '';
      const key = v + '|' + md;
      if (!force && G.chipTxt[i] === key) return;
      G.chipTxt[i] = key;
      const cv = $('cv' + i), cm = $('cm' + i);
      if (cv) cv.textContent = v;
      if (cm) cm.textContent = md;
    });
  }
  function hud() {
    if (!inEvent() || !G.W) return;
    const W = G.W, e = W.ev;
    if (e.kind === 'race') {
      const hs = humans().map((a) => W.lanes[G.ath.indexOf(a)]);
      const allDone = hs.every((a) => a.fin);
      const tt = allDone ? Math.max(...hs.map((a) => a.finish)) : Math.max(0, W.t);
      const s = tt.toFixed(2);
      if ($('clock').textContent !== s) $('clock').textContent = s;
    }
    for (let p = 0; p < G.n; p++) {
      const i = laneOf(p), a = W.lanes[i];
      if (!a) continue;
      $('speed' + p).style.transform = `scaleX(${Math.min(1, a.v / S.VMAX).toFixed(3)})`;
      const L = S.LEVEL[a.level];
      let now = false;
      if (a.state === 'run' && e.kind !== 'race') { const d = e.line - a.x; now = d >= 0 && d <= (a.paced ? S.PACE.window : L.window); }
      else if (a.state === 'run' && e.hurdles) {
        const hx = e.hurdles[a.hurdle];
        if (hx != null) { const air = L.air + (a.paced ? S.PACE.air : 0), ideal = a.v * air * 0.5; now = Math.abs(hx - a.x - ideal) <= Math.max(0.35, a.v * air * 0.3); }
      } else if (a.state === 'aim') now = a.angle >= 40 && a.angle <= 50;
      const btn = document.querySelector('.a' + p);
      if (btn.classList.contains('now') !== now) btn.classList.toggle('now', now);
      // the angle dial over your head while you hold (NORMAL)
      const g = $('gauge' + p);
      if (a.state === 'aim') {
        if (!g.firstChild) g.innerHTML = gaugeSvg();
        const pr = SC.project(a.x + 0.9, 1.1, SC.laneZ(i) + 0.6);
        g.style.left = pr.x + 'px';
        g.style.top = pr.y + 'px';
        const r = (a.angle * Math.PI) / 180;
        const nd = g.querySelector('.nd');
        nd.setAttribute('x2', (10 + 52 * Math.cos(r)).toFixed(1));
        nd.setAttribute('y2', (60 - 52 * Math.sin(r)).toFixed(1));
        g.querySelector('.deg').textContent = Math.round(a.angle) + '°';
        if (g.classList.contains('hidden')) show('gauge' + p, true);
      } else if (!g.classList.contains('hidden')) show('gauge' + p, false);
    }
    updateChips();
  }
  function gaugeSvg() {
    const pt = (d, r = 50) => { const a = (d * Math.PI) / 180; return `${(10 + r * Math.cos(a)).toFixed(1)} ${(60 - r * Math.sin(a)).toFixed(1)}`; };
    return `<svg viewBox="0 0 120 70"><path d="M ${pt(0)} A 50 50 0 0 0 ${pt(90)}" fill="none" stroke="#14121f" stroke-width="12" stroke-linecap="round"/>` +
      `<path d="M ${pt(0)} A 50 50 0 0 0 ${pt(90)}" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M ${pt(40)} A 50 50 0 0 0 ${pt(50)}" fill="none" stroke="#ffd400" stroke-width="9"/>` +
      `<line class="nd" x1="10" y1="60" x2="60" y2="60" stroke="#ff3d7f" stroke-width="5" stroke-linecap="round"/><circle cx="10" cy="60" r="6" fill="#14121f"/></svg><div class="deg" data-no-lang>10°</div>`;
  }

  function tick(dt) {
    if (G.state === 'paused') { SC.update(0); return; }
    if (G.state === 'intro') { G.intro -= dt; if (G.intro <= 0) beginTry(); }
    if ((G.state === 'play' || G.state === 'after') && G.W) {
      if (G.bots) runBots(dt); else S.advance(G.W, dt);
      watch();
      if (G.state === 'play' && G.W.done) { G.state = 'after'; G.timer = G.W.ev.kind === 'race' ? 2.4 : 1.9; }
      else if (G.state === 'after') { G.timer -= dt; if (G.timer <= 0) endTry(); }
    }
    updateFive(dt);
    drawAthletes(dt);
    buddyUpdate(dt);
    camera();
    hud();
    SC.update(dt);
  }
  // tests: scripted athletes (TF.checks bots) drive the human lanes step by step
  function runBots(dt) {
    G.botAcc += dt;
    while (G.botAcc >= S.DT - 1e-12) {
      G.botAcc -= S.DT;
      G.bots.forEach((b, p) => { if (b) TF.checks.drive(G.W, laneOf(p), b, (i, key, t) => S.input(G.W, i, key, t)); });
      S.advance(G.W, S.DT);
    }
  }

  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    if (!G.held) tick(dt);
    SC.render();
  }

  // ---------------------------------------------------------------- the check in the page: the rules (js/checks.js),
  // plus the real game loop at 30, 60 and 144 fps giving === results, plus every event's scene built and drawn
  function check(opts = {}) {
    const rep = TF.checks.run(opts);
    const keep = { n: G.n, slots: JSON.parse(JSON.stringify(G.slots)), held: G.held };
    const loop = [];
    try {
      G.held = true;
      G.bots = null;
      G.five = 0;
      for (const id of ['sprint', 'longjump', 'javelin', 'hurdles']) {
        for (const level of ['easy', 'normal']) {
          const got = [];
          let want = null;
          for (const fps of [30, 60, 144]) {
            G.n = 1;
            G.slots[0] = { id: 'tommy', level };
            G.seed = 99;
            G.evCounter = 100;
            G.pace = -1;
            startMeet(id);
            G.W.fail = opts.fail || null;
            if (!want) {
              const lanes = G.W.lanes.map((a) => ({ who: a.who, cpu: a.cpu, level: a.level, paced: a.paced }));
              const rec = TF.checks.play(id, lanes, [TF.checks.bot({ rate: level === 'easy' ? 5 : 9 }), null, null], { seed: G.W.seed, tryN: 0, fail: opts.fail || null });
              want = { res: JSON.stringify(rec.res), script: rec.script };
            }
            for (const [i, key, t] of want.script) S.input(G.W, i, key, t);
            G.state = 'play';
            show('banner', false);
            for (let k = 0; k < 60 * fps && !G.W.done; k++) tick(1 / fps);
            got.push(JSON.stringify(S.results(G.W)));
          }
          loop.push({ id, level, ok: got.every((g) => g === want.res), got: got.map((g) => g.slice(0, 120)) });
        }
      }
    } catch (e) { loop.push({ ok: false, err: String(e && e.stack || e) }); }
    rep.loop = loop;
    rep.loopOk = loop.every((l) => l.ok);
    rep.ok = rep.ok && rep.loopOk;
    G.n = keep.n;
    G.slots = keep.slots;
    G.held = keep.held;
    buildSlots();
    toTitle();
    return rep;
  }

  // ---------------------------------------------------------------- testing hooks
  // The Browser pane throttles requestAnimationFrame while hidden, so tests drive time themselves:
  //   game.hold(true); game.start({ event: 'sprint', players: [{ id: 'tommy', level: 'easy' }] }); game.bot(0, { rate: 5 }); game.step(20)
  window.game = {
    get autoPause() { return G.autoPause; },
    set autoPause(v) { G.autoPause = !!v; },
    hold(on) { G.held = on !== false; },
    step(sec) {
      const n = Math.max(1, Math.round((sec || 1 / 60) * 60));
      for (let i = 0; i < n; i++) tick(1 / 60);
      SC.render();
      return this.info();
    },
    stepFps(sec, fps) { const n = Math.round(sec * fps); for (let i = 0; i < n; i++) tick(1 / fps); SC.render(); return this.info(); },
    // opts: { event: 'meet' | 'sprint' | 'longjump' | 'javelin' | 'hurdles', players: [{ id, level }], seed }
    start(opts = {}) {
      Snd.init();
      if (opts.players) {
        setPlayers(opts.players.length);
        opts.players.forEach((p, i) => { G.slots[i] = { id: p.id || G.slots[i].id, level: p.level || 'easy' }; });
        buildSlots();
        buddyReset();
      }
      if (opts.seed != null) G.seed = opts.seed >>> 0;
      G.bots = null;
      startMeet(opts.event || 'meet');
      return this.info();
    },
    // a scripted athlete for player p (see js/checks.js bot()): { rate, feet, press, ang, hop, noPress }
    bot(p, o) { G.bots = G.bots || []; G.bots[p] = o ? TF.checks.bot(o) : null; G.botAcc = 0; },
    press(p, key) { press(p, key); },
    title() { toTitle(); },
    events() { showEvents(); },
    next() { nextEvent(); },
    again() { startMeet(G.meet ? G.meet.kind : 'meet'); },
    buddy() { callBuddy(); },
    five() { highFive(); },
    pause() { pause(); },
    resume() { resume(); },
    check(opts) { return check(opts); },
    get state() { return G.state; },
    get W() { return G.W; },
    info() {
      const W = G.W;
      return {
        state: G.state, event: G.E && G.E.ev.id, tryN: G.E && G.E.tryN, t: W && +W.t.toFixed(3), pace: G.pace === G.evCounter, buddy: B.state,
        lanes: W ? W.lanes.map((a) => ({ who: a.who, x: +a.x.toFixed(2), v: +a.v.toFixed(2), state: a.state, value: S.result(W.ev, a), paced: a.paced })) : [],
        medals: G.meet && G.meet.medals,
      };
    },
  };
  boot();
})();
