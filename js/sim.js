/* TT Track & Field: the rules, with no drawing. Four events (100 m sprint, long jump, javelin, hurdles), the runners'
   speed from tapping, the CPU friends, fouls, how each mark is measured, places, medals and the meet's medal table.
   It runs the same in the page and in node (tools/check.js).

   Fair at any frame rate: every try runs in fixed 1/120 s steps. A tap or a press is stamped with the time it happened
   and goes in a queue; each step first takes the inputs that happened before it ends, then moves everyone. The page
   only says how much time went by, so 30 fps and 144 fps play exactly the same steps with exactly the same inputs.
   Flights (a long jump, a javelin) follow the exact curve, and landings are worked out, not stepped into. */
(function () {
  'use strict';
  const TF = (window.TF = window.TF || {});

  const DT = 1 / 120;
  const COUNT = 2.4;          // ON YOUR MARKS at -2.4 s, SET at -1.2 s, GO at 0
  const GRAV = 9.8;
  const VMAX = 11.5;          // nobody runs faster than this (m/s)
  const DECAY = 1.6;          // stop tapping and you slow down (per second)
  const DECAY_AIR = 0.4;      // a hurdle hop keeps most of your speed
  const LAG = 0.3;            // your legs catch up with your taps over about a third of a second (no jerky speed)
  const SPRING = 0.85;        // a long jump takes off with 85 % of your run-up speed
  const REACH = 0.3;          // a long jumper's feet land a little ahead of the body
  const HAND = 1.6;           // the javelin leaves the hand this high, for everyone (small kids aren't punished)
  const HURDLE_H = 0.6;
  const WALK = 2.5, WALK_AFTER = 25; // a race never gets stuck: after 25 s a runner who stopped tapping walks home

  const EVENTS = [
    { id: 'sprint', n: 1, kind: 'race', dist: 100, icon: '🏃', name: '100 M SPRINT' },
    { id: 'longjump', n: 2, kind: 'jump', board: 24, pit: 11, tries: 3, icon: '🦘', name: 'LONG JUMP' },
    { id: 'javelin', n: 3, kind: 'throw', line: 18, tries: 3, icon: '🎯', name: 'JAVELIN' },
    { id: 'hurdles', n: 4, kind: 'race', dist: 60, hurdles: [12, 21, 30, 39, 48], icon: '🚧', name: '60 M HURDLES' },
  ];
  const EV = {};
  EVENTS.forEach((e) => { EV[e.id] = e; e.tries = e.tries || 1; e.line = e.line || e.board || 0; });

  // 🐣 EASY (Tommy, 5): every tap counts the same, long floaty hops, no fouls (you jump or throw at the line by
  // yourself), and a press near the line gives a big jump. 🔥 NORMAL (Teddy, 8): left, right, left, right (the same
  // foot twice is a weak step), tight hurdle timing, hold to pick your angle, and step over the line = FOUL.
  const LEVEL = {
    easy: { boost: 2.4, same: 1, air: 0.75, hop: 1.0, clip: 0, keep: 0.72, aim: false, jumpAng: 42, throwAng: 40, autoJump: 25, autoThrow: 30, window: 1.5 },
    normal: { boost: 1.4, same: 0.45, air: 0.5, hop: 0.85, clip: 0.12, keep: 0.45, aim: true, rate: 45, minAng: 10, maxAng: 70, over: 0.6, window: 1.2 },
  };
  // the brother pacing you: chase him and every tap counts more, he never lets you stop, and on NORMAL the angle rises slower
  const PACE = { boost: 1.3, floor: 4, rate: 32, window: 2.2, air: 0.1 };
  // the CPU friends' top speeds (m/s); each try wobbles them a little (seeded, so a replay is the same)
  const CPU = { easy: { foxy: 6.4, froggy: 5.7 }, normal: { foxy: 8.0, froggy: 7.3 } };

  const round2 = (v) => Math.round(v * 100) / 100;
  const rad = (d) => (d * Math.PI) / 180;

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- a try: everyone in their lane at once
  // lanes: [{ who, cpu, level, paced }]. opts: { seed, tryN, fail }
  function world(evId, lanes, opts = {}) {
    const ev = EV[evId];
    const W = { ev, n: 0, t: -COUNT, acc: 0, queue: [], seq: 0, done: false, doneT: null, tryN: opts.tryN || 0, seed: (opts.seed >>> 0) || 1, fail: opts.fail || null, trace: opts.trace ? [] : null };
    W.lanes = lanes.map((l, i) => {
      const a = {
        i, who: l.who, cpu: !!l.cpu, level: l.level === 'normal' ? 'normal' : 'easy', paced: !!l.paced,
        x: 0, v: 0, drive: 0, y: 0, foot: '', taps: 0, lastTap: -9, state: 'ready', holding: false,
        airT: 0, airDur: 0, hopH: 0, angle: 0, plantX: 0, plantV: 0, flyT: 0, land: 0, vx: 0, vy: 0, auto: false,
        hurdle: 0, hits: 0, knocked: [], stumble: 0, finish: null, mark: null, why: '', fin: false, jav: null,
      };
      if (a.cpu) a.plan = plan(W, a);
      return a;
    });
    return W;
  }

  function plan(W, a) {
    const ev = W.ev, lv = a.level;
    const r = rng(W.seed * 7919 + W.tryN * 104729 + (a.i + 1) * 1299709 + ev.n * 15485863);
    const base = (CPU[lv][a.who] || CPU[lv].foxy) * (ev.hurdles ? 0.96 : 1);
    const p = { top: base * (1 + (r() - 0.5) * 0.06), react: 0.12 + r() * 0.1, tau: 0.95, air: 0.62, hop: 0.85 };
    if (ev.hurdles) p.clips = ev.hurdles.map(() => r() < (lv === 'easy' ? 0.25 : 0.12));
    if (ev.kind !== 'race') {
      const foul = lv === 'normal' && r() < 0.12;
      p.off = foul ? -0.3 : ev.kind === 'jump' ? 0.05 + r() * 0.45 : 0.1 + r() * 0.7;
      p.ang = lv === 'normal' ? 34 + r() * 10 : 30 + r() * 10;
    }
    return p;
  }

  const now = (W) => W.t + W.acc;

  // key: 'L' / 'R' (a foot), 'A+' / 'A-' (jump or throw: press, let go), 'P' (your brother starts pacing you)
  function input(W, lane, key, t) {
    W.queue.push({ t: t == null ? now(W) : t, lane, key, s: W.seq++ });
    W.queue.sort((p, q) => p.t - q.t || p.s - q.s);
  }

  function advance(W, dt) {
    if (W.fail === 'fps') { step(W, dt); return; } // the broken variant: one step per frame, inputs at frame edges
    W.acc += dt;
    while (W.acc >= DT - 1e-12) { W.acc -= DT; step(W, DT); }
    if (W.acc < 0) W.acc = 0;
  }

  function step(W, h) {
    const t0 = W.t, t1 = t0 + h;
    while (W.queue.length && W.queue[0].t < t1 - 1e-9) apply(W, W.queue.shift(), t0);
    for (const a of W.lanes) move(W, a, t0, h);
    W.n++;
    W.t = W.fail === 'fps' ? t1 : -COUNT + W.n * DT;
    if (!W.done && W.lanes.every((a) => a.fin)) { W.done = true; W.doneT = W.t; }
    if (W.trace && W.n % 30 === 0) W.trace.push(W.lanes.map((a) => a.x.toFixed(9) + '/' + a.v.toFixed(9)).join(' '));
  }

  function apply(W, e, t) {
    const a = W.lanes[e.lane];
    if (!a || a.cpu) return;
    const L = LEVEL[a.level], ev = W.ev;
    if (e.key === 'P') { a.paced = true; return; }
    if (e.key === 'A-') { a.holding = false; if (a.state === 'aim') launch(W, a); return; }
    if (t < 0) return; // no false starts: nothing counts before GO
    if (e.key === 'L' || e.key === 'R') {
      if (a.state !== 'ready' && a.state !== 'run') return;
      a.state = 'run';
      let b = L.boost * (a.foot === e.key ? L.same : 1) * (a.paced ? PACE.boost : 1);
      if (W.fail === 'unfair' && a.i === 1) b *= 1.05;
      a.drive = Math.min(VMAX, a.drive + b);
      a.foot = e.key;
      a.taps++;
      a.lastTap = t;
    } else if (e.key === 'A+') {
      a.holding = true;
      if (a.state !== 'run') return;
      if (ev.hurdles) hop(a, L.air + (a.paced ? PACE.air : 0), L.hop);
      else if (ev.kind !== 'race') plant(W, a, false);
    }
  }

  function hop(a, air, h) { a.state = 'air'; a.airT = 0; a.airDur = air; a.hopH = h; }

  function foul(a, why) { a.state = 'foul'; a.mark = null; a.why = why; a.fin = true; }

  // feet down for a jump or a throw, where you are now (auto: at the line by yourself, EASY)
  function plant(W, a, auto) {
    const ev = W.ev, L = LEVEL[a.level];
    if (a.x > ev.line + 1e-9) return foul(a, 'over');
    a.plantX = a.x;
    a.plantV = a.v;
    a.auto = auto;
    if (a.cpu) a.angle = a.plan.ang;
    else if (L.aim) { a.state = 'aim'; a.angle = L.minAng; return; }
    else a.angle = ev.kind === 'jump' ? (auto ? L.autoJump : L.jumpAng) : (auto ? L.autoThrow : L.throwAng);
    launch(W, a);
  }

  function launch(W, a) {
    const ev = W.ev, th = rad(a.angle);
    if (ev.kind === 'jump') {
      a.state = 'fly';
      a.x = a.plantX;
      a.vx = a.plantV * SPRING * Math.cos(th);
      a.vy = a.plantV * SPRING * Math.sin(th);
      a.flyT = 0;
      a.land = (2 * a.vy) / GRAV;
    } else {
      const s = a.plantV * 1.4 + 8;
      a.state = 'thrown';
      const j = (a.jav = { x0: a.plantX + 0.3, x: a.plantX + 0.3, y: HAND, vx: s * Math.cos(th), vy: s * Math.sin(th), t: 0, state: 'fly' });
      j.land = (j.vy + Math.sqrt(j.vy * j.vy + 2 * GRAV * HAND)) / GRAV;
    }
  }

  function move(W, a, t, h) {
    const ev = W.ev, L = LEVEL[a.level];
    const x0 = a.x;
    if (a.stumble > 0) a.stumble = Math.max(0, a.stumble - h);
    switch (a.state) {
      case 'ready':
        if (a.cpu && t >= a.plan.react) a.state = 'run';
        break;
      case 'run':
        if (a.cpu) a.v += (a.plan.top - a.v) * (1 - Math.exp(-h / a.plan.tau));
        else {
          a.drive *= Math.exp(-DECAY * h);
          if (a.paced && a.drive < PACE.floor) a.drive = PACE.floor;
          if (ev.kind === 'race' && t > WALK_AFTER && a.drive < WALK) a.drive = WALK;
          a.v += (a.drive - a.v) * (1 - Math.exp(-h / LAG));
        }
        a.x += a.v * h;
        break;
      case 'air': {
        if (a.cpu) a.v *= Math.exp(-DECAY_AIR * h);
        else {
          a.drive *= Math.exp(-DECAY_AIR * h);
          a.v += (a.drive - a.v) * (1 - Math.exp(-h / LAG));
        }
        a.x += a.v * h;
        a.airT += h;
        const u = Math.min(1, a.airT / a.airDur);
        a.y = 4 * a.hopH * u * (1 - u);
        break;
      }
      case 'aim':
        a.v *= Math.exp(-8 * h);
        a.angle += (a.paced ? PACE.rate : L.rate) * h;
        if (a.angle >= L.maxAng) { a.angle = L.maxAng; launch(W, a); }
        break;
      case 'fly': {
        a.flyT = Math.min(a.land, a.flyT + h);
        a.x = a.plantX + a.vx * a.flyT;
        a.y = a.vy * a.flyT - 0.5 * GRAV * a.flyT * a.flyT;
        if (a.flyT >= a.land) {
          a.y = 0;
          a.state = 'landed';
          const from = W.fail === 'measure' ? a.plantX : ev.line;
          const m = round2(a.x + REACH - from);
          if (m > 0) a.mark = m; else { a.mark = null; a.why = 'early'; }
          a.fin = true;
          a.v = 0;
        }
        break;
      }
      default: // thrown, landed, foul, done: slow to a stop
        a.v *= Math.exp(-3 * h);
        a.x += a.v * h;
        if (ev.kind === 'throw' && a.state === 'thrown') a.x = Math.min(a.x, ev.line - 0.05);
    }
    if (a.jav && a.jav.state === 'fly') {
      const j = a.jav;
      j.t = Math.min(j.land, j.t + h);
      j.x = j.x0 + j.vx * j.t;
      j.y = HAND + j.vy * j.t - 0.5 * GRAV * j.t * j.t;
      if (j.t >= j.land) {
        j.y = 0;
        j.state = 'stuck';
        const from = W.fail === 'measure' ? a.plantX : ev.line;
        const m = round2(j.x - from);
        if (m > 0) a.mark = m; else { a.mark = null; a.why = 'early'; }
        a.fin = true;
      }
    }

    if (ev.kind === 'race') {
      if (a.cpu && ev.hurdles && a.state === 'run' && a.hurdle < ev.hurdles.length) {
        const p = a.plan, lead = p.clips[a.hurdle] ? a.v * 0.02 : a.v * p.air * 0.5;
        if (a.x >= ev.hurdles[a.hurdle] - lead) hop(a, p.air, p.hop);
      }
      if (a.state === 'air' && a.airT >= a.airDur) { a.state = 'run'; a.y = 0; }
      if (ev.hurdles) {
        while (a.hurdle < ev.hurdles.length && a.x >= ev.hurdles[a.hurdle]) {
          const u = a.state === 'air' ? a.airT / a.airDur : -1;
          const clip = a.cpu ? 0.12 : L.clip;
          if (!(u >= 0 && u >= clip && u <= 1 - clip)) {
            const keep = a.cpu ? 0.75 : Math.max(L.keep, a.paced ? 0.72 : 0);
            a.v *= keep;
            a.drive *= keep;
            a.hits++;
            a.knocked.push(a.hurdle);
            a.stumble = 0.35;
            if (a.state === 'air') { a.state = 'run'; a.y = 0; }
          }
          a.hurdle++;
        }
      }
      if (!a.fin && a.x >= ev.dist) {
        const f = (ev.dist - x0) / Math.max(1e-9, a.x - x0);
        a.finish = round2(t + f * h);
        a.fin = true;
        a.state = 'done';
        a.y = 0;
      }
    } else if (a.state === 'run') {
      if (a.cpu) {
        if (a.x >= ev.line - a.plan.off) {
          if (a.plan.off < 0) foul(a, 'over');
          else plant(W, a, false);
        }
      } else if (!L.aim && a.x >= ev.line) {
        a.x = ev.line;
        plant(W, a, true);
      } else if (L.aim && a.x > ev.line + L.over) foul(a, 'over');
    }
  }

  // ---------------------------------------------------------------- results, places, medals
  const result = (ev, a) => (ev.kind === 'race' ? a.finish : a.mark);
  const results = (W) => W.lanes.map((a) => ({ who: a.who, cpu: a.cpu, value: result(W.ev, a), why: a.why, hits: a.hits, knocked: a.knocked.slice(), auto: a.auto, angle: round2(a.angle) }));

  // best of several tries (null = a foul or no mark)
  function best(ev, vals) {
    const ok = vals.filter((v) => v != null);
    if (!ok.length) return null;
    return ev.kind === 'race' ? Math.min(...ok) : Math.max(...ok);
  }
  // 1 = first. Equal results share a place. No mark = no place (and no medal).
  function places(ev, vals) {
    const better = (p, q) => (ev.kind === 'race' ? p < q : p > q);
    return vals.map((v) => (v == null ? null : 1 + vals.filter((w) => w != null && better(w, v)).length));
  }
  const MEDALS = [null, 'gold', 'silver', 'bronze'];
  const POINTS = { gold: 3, silver: 2, bronze: 1 };
  const medal = (place) => (place && place <= 3 ? MEDALS[place] : null);

  // the medal table: rows [{ who, medals: ['gold', null, ...] }] -> totals, ordered; the winner has the most points,
  // then the most golds, then silvers (equal on all three = a shared win)
  function table(rows) {
    const t = rows.map((r, i) => {
      const c = { i, who: r.who, gold: 0, silver: 0, bronze: 0, pts: 0 };
      for (const m of r.medals) if (m) { c[m]++; c.pts += POINTS[m]; }
      return c;
    });
    const key = (c) => [c.pts, c.gold, c.silver];
    const cmp = (p, q) => { const a = key(p), b = key(q); for (let k = 0; k < 3; k++) if (a[k] !== b[k]) return b[k] - a[k]; return 0; };
    const order = t.slice().sort((p, q) => cmp(p, q) || p.i - q.i);
    const top = order[0];
    order.forEach((c) => { c.win = cmp(c, top) === 0 && c.pts > 0; });
    return order;
  }

  const fmt = (ev, v) => (v == null ? null : ev.kind === 'race' ? v.toFixed(2) + ' S' : v.toFixed(2) + ' M');

  TF.sim = { DT, COUNT, GRAV, VMAX, REACH, SPRING, HAND, HURDLE_H, EVENTS, EV, LEVEL, PACE, CPU, rng, round2, world, input, advance, now, results, result, best, places, medal, POINTS, table, fmt };
})();
