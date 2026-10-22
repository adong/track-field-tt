/* TT Track & Field: the headless check of the rules (TF.checks.run). It needs only js/sim.js, so it runs in the page
   (game.check()) and in node (node tools/check.js).

   What it proves, for all four events on both levels:
   - fps: the same taps and presses give exactly the same result (===, and the same positions along the way) at
     24, 30, 50, 60, 90, 120, 144 and 240 fps and with a jittery frame rate, with and without the pacing brother;
   - fair lanes: two athletes with the same inputs get the same result whatever lane they're in and whoever they are
     (Tommy is drawn smaller, but scores the same);
   - effort: tapping faster always scores better (a lower time, a longer jump or throw);
   - measuring: a jump is measured from the board and a throw from the line, not from where you took off;
   - fouls: over the line on NORMAL is a foul with no mark; EASY never fouls; a no-mark gets no place and no medal;
   - medals: places, shared places on a tie, the medal table and its winner;
   - hurdles: knocking them over costs time, and less on EASY;
   - pacing: your brother pacing you always helps, called before or during the try;
   - kids can win: on EASY, 5 taps a second beats Foxy and Froggy in the sprint, and NORMAL friends are faster;
   - the CPU friends are the same for the same seed and vary between seeds.
   run({ fail: 'fps' | 'unfair' | 'measure' }) breaks the rules on purpose (frame-rate steps, a faster lane 2,
   measuring from the take-off) and the check must FAIL. */
(function () {
  'use strict';
  const TF = window.TF, S = TF.sim;
  const LEVELS = ['easy', 'normal'];

  // A scripted athlete: taps `rate` times a second (left, right... or the same foot), hops before each hurdle, and
  // near the line presses (holding for `ang` degrees on NORMAL). It decides between steps and stamps exact times,
  // so what it did can be replayed at any frame rate.
  function bot(o = {}) {
    return { rate: o.rate || 8, feet: o.feet || 'alt', start: o.start == null ? 0.05 : o.start, press: o.press == null ? 0.15 : o.press, ang: o.ang || 45, hop: o.hop !== false, noPress: !!o.noPress, k: 0, pressed: false, hopped: -1 };
  }
  function drive(W, i, b, put) {
    const a = W.lanes[i], ev = W.ev, L = S.LEVEL[a.level], tEnd = W.t + S.DT;
    if (a.state === 'ready' || a.state === 'run') {
      for (let tt = b.start + b.k / b.rate; tt < tEnd; tt = b.start + b.k / b.rate) {
        put(i, b.feet === 'same' ? 'L' : b.k % 2 ? 'R' : 'L', Math.max(tt, W.t));
        b.k++;
      }
    }
    if (a.state !== 'run') return;
    if (ev.hurdles) {
      const nx = ev.hurdles[a.hurdle], air = L.air + (a.paced ? S.PACE.air : 0);
      if (b.hop && nx != null && b.hopped < a.hurdle && nx - a.x <= a.v * air * 0.5) {
        b.hopped = a.hurdle;
        put(i, 'A+', W.t);
        put(i, 'A-', W.t + 0.08);
      }
    } else if (ev.kind !== 'race' && !b.noPress && !b.pressed && a.x >= ev.line - b.press) {
      b.pressed = true;
      const hold = L.aim ? (b.ang - L.minAng) / (a.paced ? S.PACE.rate : L.rate) : 0.1;
      put(i, 'A+', W.t);
      put(i, 'A-', W.t + hold);
    }
  }

  // play a try with bots at the fixed step, recording every input
  function play(evId, lanes, bots, opts = {}) {
    const W = S.world(evId, lanes, Object.assign({ trace: true }, opts));
    const script = [];
    const put = (i, key, t) => { S.input(W, i, key, t); script.push([i, key, t]); };
    let paced = opts.paceAt == null;
    for (let guard = 0; !W.done && guard < 120 * 120; guard++) {
      bots.forEach((b, i) => b && drive(W, i, b, put));
      if (!paced && W.t + S.DT > opts.paceAt) { paced = true; put(0, 'P', opts.paceAt); }
      S.advance(W, S.DT);
    }
    return { W, script, res: S.results(W) };
  }
  // replay recorded inputs with any frame times
  function replay(evId, lanes, script, opts, frame) {
    const W = S.world(evId, lanes, Object.assign({ trace: true }, opts));
    for (const [i, key, t] of script) S.input(W, i, key, t);
    for (let k = 0; !W.done && k < 200000; k++) S.advance(W, frame(k));
    return { W, res: S.results(W) };
  }
  const human = (who, level, paced) => ({ who, level, paced: !!paced });
  const cpu = (who, level) => ({ who, level, cpu: true });
  const val = (r) => r.res[0].value;
  const fast = (level) => (level === 'easy' ? 5 : 9);

  function run(opts = {}) {
    const fail = opts.fail || null;
    const o = { fail, seed: opts.seed || 7 };
    const out = [];
    const check = (name, ok, detail) => out.push({ name, ok: !!ok, detail });

    // ---- fps: the same inputs, the same result at any frame rate
    {
      const FPS = [24, 30, 50, 60, 90, 120, 144, 240];
      let runs = 0, bad = 0, first = '';
      for (const ev of S.EVENTS) for (const level of LEVELS) for (const pace of ['no', 'start', 'mid']) {
        const lanes = [human('teddy', level, pace === 'start'), human('tommy', level), cpu('foxy', level), cpu('froggy', level)];
        const bots = [bot({ rate: fast(level) }), bot({ rate: fast(level) - 1.5, ang: 38, press: 0.6 }), null, null];
        const base = play(ev.id, lanes, bots, Object.assign({}, o, pace === 'mid' ? { paceAt: 1.7 } : {}));
        const want = JSON.stringify(base.res);
        const frames = FPS.map((f) => () => 1 / f);
        const r = S.rng(1234 + ev.n);
        frames.push(() => 1 / 240 + r() * (1 / 20 - 1 / 240));
        for (const fr of frames) {
          const got = replay(ev.id, lanes, base.script, o, fr);
          runs++;
          const n = Math.min(base.W.trace.length, got.W.trace.length);
          const same = JSON.stringify(got.res) === want && base.W.trace.slice(0, n).join('|') === got.W.trace.slice(0, n).join('|');
          if (!same) { bad++; if (!first) first = `${ev.id} ${level} pace:${pace}: ${want} vs ${JSON.stringify(got.res)}`; }
        }
      }
      check('fps', bad === 0, `${runs} replays at 24-240 fps and jittery frames, ${bad} differ${first ? ' (first: ' + first.slice(0, 220) + ')' : ''}`);
    }

    // ---- fair lanes: same inputs, same result, whoever and wherever you are
    {
      let n = 0, bad = 0, first = '';
      for (const ev of S.EVENTS) for (const level of LEVELS) {
        const r = play(ev.id, [human('teddy', level), human('tommy', level)], [bot({ rate: fast(level) }), bot({ rate: fast(level) })], o);
        const s = play(ev.id, [human('tommy', level), human('teddy', level)], [bot({ rate: fast(level) }), bot({ rate: fast(level) })], o);
        const lane0 = play(ev.id, [human('tommy', level), cpu('foxy', level), cpu('froggy', level)], [bot({ rate: fast(level) }), null, null], o);
        const lane2 = play(ev.id, [cpu('foxy', level), cpu('froggy', level), human('tommy', level)], [null, null, bot({ rate: fast(level) })], o);
        const vals = [r.res[0].value, r.res[1].value, s.res[0].value, s.res[1].value, lane0.res[0].value, lane2.res[2].value];
        n++;
        const pl = S.places(ev, [r.res[0].value, r.res[1].value]);
        if (!vals.every((v) => v === vals[0]) || vals[0] == null || pl[0] !== 1 || pl[1] !== 1) { bad++; if (!first) first = `${ev.id} ${level}: ${vals.join(', ')}`; }
      }
      check('fair lanes', bad === 0, `${n} events x levels: lane 1 = lane 2 = lane 3, Teddy = Tommy, same inputs share gold; ${bad} unfair${first ? ' (' + first + ')' : ''}`);
    }

    // ---- effort: tap faster, score better
    {
      const RATES = { easy: [2, 3, 4, 5, 6], normal: [4, 6, 8, 10, 12] };
      let bad = 0;
      const rows = [];
      for (const ev of S.EVENTS) for (const level of LEVELS) {
        const v = RATES[level].map((rate) => val(play(ev.id, [human('teddy', level)], [bot({ rate })], o)));
        const ok = v.every((x, k) => x != null && (k === 0 || (ev.kind === 'race' ? x < v[k - 1] : x > v[k - 1])));
        if (!ok) bad++;
        rows.push(`${ev.id}/${level}: ${v.join(' ')}`);
      }
      check('effort', bad === 0, `faster tapping always scores better; ${rows.join('; ')}`);
    }

    // ---- measuring: from the board / the line, never from the take-off
    {
      let bad = 0;
      const rows = [];
      for (const ev of S.EVENTS.filter((e) => e.kind !== 'race')) for (const level of LEVELS) for (const press of [0.1, 0.5, 1.2]) {
        const r = play(ev.id, [human('teddy', level)], [bot({ rate: fast(level), press, ang: 41 })], o);
        const a = r.W.lanes[0], th = (a.angle * Math.PI) / 180;
        let want;
        if (ev.kind === 'jump') want = a.plantX + ((a.plantV * S.SPRING) ** 2 * Math.sin(2 * th)) / S.GRAV + S.REACH - ev.line;
        else {
          const s = a.plantV * 1.4 + 8, vx = s * Math.cos(th), vy = s * Math.sin(th);
          want = a.plantX + 0.3 + (vx * (vy + Math.sqrt(vy * vy + 2 * S.GRAV * S.HAND))) / S.GRAV - ev.line;
        }
        want = S.round2(want);
        const ok = a.mark != null && Math.abs(a.mark - want) < 0.011 && a.plantX <= ev.line;
        if (!ok) bad++;
        rows.push(`${ev.id}/${level} took off ${(ev.line - a.plantX).toFixed(2)} m early: ${a.mark} (${want})`);
      }
      check('measuring', bad === 0, rows.join('; '));
    }

    // ---- fouls and no marks
    {
      const f1 = play('longjump', [human('teddy', 'normal')], [bot({ rate: 9, noPress: true })], o).res[0];
      const f2 = play('javelin', [human('teddy', 'normal')], [bot({ rate: 9, press: -0.3 })], o).res[0];
      const e1 = play('longjump', [human('tommy', 'easy')], [bot({ rate: 4, noPress: true })], o).res[0];
      const e2 = play('javelin', [human('tommy', 'easy')], [bot({ rate: 4, noPress: true })], o).res[0];
      const pl = S.places(S.EV.longjump, [5.2, null, 4.1]);
      const ok = f1.value == null && f1.why === 'over' && f2.value == null && f2.why === 'over' && e1.value > 0 && e1.auto && e2.value > 0 && e2.auto &&
        pl[0] === 1 && pl[1] == null && pl[2] === 2 && S.medal(pl[1]) == null;
      check('fouls', ok, `NORMAL ran past the board: ${f1.value} (${f1.why}); threw past the line: ${f2.value} (${f2.why}); EASY never pressed: jump ${e1.value} m, throw ${e2.value} m (by itself at the line); a no-mark gets no place`);
    }

    // ---- places, medals, the medal table
    {
      const p1 = S.places(S.EV.sprint, [12.1, 11.9, 12.1]), p2 = S.places(S.EV.javelin, [30.5, 31.2, 29]);
      const t = S.table([{ who: 'teddy', medals: ['gold', 'silver', 'silver', 'gold'] }, { who: 'foxy', medals: ['silver', 'gold', 'gold', 'bronze'] }, { who: 'froggy', medals: ['bronze', 'bronze', 'bronze', 'silver'] }]);
      const tie = S.table([{ who: 'teddy', medals: ['gold', 'silver'] }, { who: 'tommy', medals: ['silver', 'gold'] }]);
      const gs = S.table([{ who: 'teddy', medals: ['gold', 'bronze', 'bronze', 'bronze'] }, { who: 'tommy', medals: ['silver', 'silver', 'silver', null] }]);
      const ok = p1.join() === '2,1,2' && p2.join() === '2,1,3' && S.medal(1) === 'gold' && S.medal(3) === 'bronze' && S.medal(4) == null &&
        t[0].who === 'teddy' && t[0].pts === 10 && t[1].who === 'foxy' && t[0].win && !t[1].win && tie[0].win && tie[1].win && gs[0].who === 'teddy' && gs[0].win && !gs[1].win;
      check('medals', ok, `sprint 12.1/11.9/12.1 -> places ${p1}; javelin 30.5/31.2/29 -> ${p2}; table winner ${t[0].who} ${t[0].pts} pts (ties share, golds break a points tie)`);
    }

    // ---- hurdles: a knock costs time, less on EASY
    {
      const res = {};
      for (const level of LEVELS) {
        const clean = play('hurdles', [human('teddy', level)], [bot({ rate: fast(level) })], o).res[0];
        const knock = play('hurdles', [human('teddy', level)], [bot({ rate: fast(level), hop: false })], o).res[0];
        res[level] = { clean, knock, cost: knock.value / clean.value };
      }
      const ok = LEVELS.every((l) => res[l].clean.hits === 0 && res[l].knock.hits === 5 && res[l].knock.value > res[l].clean.value) && res.easy.cost < res.normal.cost;
      check('hurdles', ok, LEVELS.map((l) => `${l}: clean ${res[l].clean.value} s, knocking all 5 ${res[l].knock.value} s`).join('; '));
    }

    // ---- pacing helps
    {
      let bad = 0;
      const rows = [];
      for (const ev of S.EVENTS) for (const level of LEVELS) {
        const b = () => [bot({ rate: level === 'easy' ? 3 : 6 })];
        const plain = val(play(ev.id, [human('tommy', level)], b(), o));
        const paced = val(play(ev.id, [human('tommy', level, true)], b(), o));
        const mid = val(play(ev.id, [human('tommy', level)], b(), Object.assign({}, o, { paceAt: 1.0 })));
        const better = (x, y) => x != null && (y == null || (ev.kind === 'race' ? x < y : x > y));
        if (!better(paced, plain) || !better(mid, plain)) bad++;
        rows.push(`${ev.id}/${level}: ${plain} -> ${paced} (called at 1 s: ${mid})`);
      }
      check('pacing', bad === 0, rows.join('; '));
    }

    // ---- kids can win; NORMAL friends are faster
    {
      let wins = 0, n = 0, easyCpu = 0, normCpu = 0, nWins = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const r = play('sprint', [human('tommy', 'easy'), cpu('foxy', 'easy'), cpu('froggy', 'easy')], [bot({ rate: 5 }), null, null], Object.assign({}, o, { seed }));
        const pl = S.places(S.EV.sprint, r.res.map((x) => x.value));
        n++;
        if (pl[0] === 1) wins++;
        easyCpu += r.res[1].value + r.res[2].value;
        const q = play('sprint', [human('teddy', 'normal'), cpu('foxy', 'normal'), cpu('froggy', 'normal')], [bot({ rate: 11 }), null, null], Object.assign({}, o, { seed }));
        normCpu += q.res[1].value + q.res[2].value;
        if (S.places(S.EV.sprint, q.res.map((x) => x.value))[0] === 1) nWins++;
      }
      check('kids can win', wins >= 27 && nWins >= 24 && normCpu < easyCpu, `EASY at 5 taps/s won the sprint ${wins}/${n}; NORMAL at 11 taps/s won ${nWins}/${n}; friends' average sprint EASY ${(easyCpu / 2 / n).toFixed(2)} s, NORMAL ${(normCpu / 2 / n).toFixed(2)} s`);
    }

    // ---- CPU friends: seeded
    {
      const go = (seed) => play('longjump', [cpu('foxy', 'normal'), cpu('froggy', 'normal')], [null, null], Object.assign({}, o, { seed })).res.map((x) => x.value).join('/');
      const same = go(3) === go(3);
      const many = new Set([1, 2, 3, 4, 5].map(go)).size;
      check('cpu seeded', same && many >= 3, `same seed same jumps (${go(3)}); 5 seeds gave ${many} different results`);
    }

    return { ok: out.every((c) => c.ok), fail, checks: out };
  }

  TF.checks = { run, play, replay, bot };
})();
