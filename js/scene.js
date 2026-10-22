/* TT Track & Field: the stadium in Three.js. A red track with four lanes running along +x, the crowd in the stands
   behind, the infield grass in front (the camera's side). Each event shows its own things: the finish line (100 m or
   60 m), the hurdles, the long-jump boards and sand pits, the javelin line and its field. Plus the athletes (Kit
   people, side-on), the javelins, landing flags, the medal podium, confetti and the camera that follows the race. */
(function () {
  'use strict';
  const T = THREE, gfx = Kit.gfx, TF = window.TF, S = TF.sim;
  const { std, mesh, makeCanvas, toTexture } = gfx;
  const LANE = 2.3, NL = 4;
  const laneZ = (i) => -i * LANE;
  const TRACK = { x0: -25, x1: 135, z0: LANE / 2 + 0.5, z1: -(NL - 0.5) * LANE - 0.5 };
  const POD = { x: -14, z: 6 };

  let renderer, scene, camera, sun, crowd = null;
  const groups = {};
  const hurdles = []; // [lane][k] = { g, fall }
  const fx = [];
  const marks = [];
  const cam = { x: 0, y: 5, z: 12, lx: 4, ly: 0.9, lz: -2.3, tx: 0, zc: -2.3, mode: 'track', spread: 0, aspect: 1.6, snap: true };
  let cheer = 0, clock = 0, finishSign = null;

  // ---------------------------------------------------------------- textures
  function stripes(w, h, a, b, n, vertical) {
    const [c, g] = makeCanvas(w, h);
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? a : b;
      if (vertical) g.fillRect((i * w) / n, 0, w / n + 1, h); else g.fillRect(0, (i * h) / n, w, h / n + 1);
    }
    return c;
  }
  function grain(w, h, base, dots, n) {
    const [c, g] = makeCanvas(w, h);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      g.fillStyle = dots[i % dots.length];
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    return c;
  }
  function label(text, o = {}) {
    const w = o.w || 256, h = o.h || 128;
    const [c, g] = makeCanvas(w, h);
    if (o.bg) { g.fillStyle = o.bg; gfx.roundRect(g, 4, 4, w - 8, h - 8, o.r == null ? 18 : o.r); g.fill(); if (o.stroke) { g.lineWidth = 8; g.strokeStyle = o.stroke; g.stroke(); } }
    g.font = `${o.size || 72}px ${o.font || gfx.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = o.color || '#fff';
    g.fillText(text, w / 2, h / 2 + (o.dy || 4));
    return toTexture(c);
  }
  const plane = (w, h, mat) => new T.Mesh(new T.PlaneGeometry(w, h), mat);
  function flat(w, d, mat, x, y, z, parent) { const m = plane(w, d, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; parent.add(m); return m; }
  function sign(text, x, z, parent, o = {}) {
    const g = new T.Group();
    const post = std('#ffffff');
    mesh(new T.BoxGeometry(0.08, o.h || 1.1, 0.08), post, 0, (o.h || 1.1) / 2, 0, g);
    const m = plane(o.w || 1.0, (o.w || 1.0) / 2, new T.MeshBasicMaterial({ map: label(text, { bg: o.bg || '#ffffff', color: o.color || '#14121f', stroke: '#14121f', size: o.size || 80 }) }));
    m.position.set(0, (o.h || 1.1) + 0.25, 0.05);
    g.add(m);
    g.position.set(x, 0, z);
    parent.add(g);
    return g;
  }

  // ---------------------------------------------------------------- build
  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    const [sky, sg] = makeCanvas(4, 256);
    const grd = sg.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#4aa8ff');
    grd.addColorStop(0.6, '#a9dcff');
    grd.addColorStop(1, '#e8f6ff');
    sg.fillStyle = grd;
    sg.fillRect(0, 0, 4, 256);
    scene.background = toTexture(sky);
    scene.fog = new T.Fog('#cfeaff', 70, 190);
    camera = new T.PerspectiveCamera(40, 1, 0.1, 500);
    scene.add(new T.HemisphereLight('#eaf6ff', '#4a7a3a', 0.75));
    sun = new T.DirectionalLight('#fff4dc', 1.05);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -18; sc.right = 18; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 80;
    sun.shadow.bias = -0.0008;
    scene.add(sun, sun.target);
    buildGround();
    buildStands();
    buildEvents();
    buildPodium();
  }

  function buildGround() {
    const g = new T.Group();
    scene.add(g);
    const grassTex = toTexture(stripes(256, 256, '#5cbf4a', '#53b343', 8, true), [60, 30]);
    flat(700, 340, std('#ffffff', { map: grassTex, roughness: 0.95 }), 50, 0, -20, g);
    const trackTex = toTexture(grain(256, 256, '#d9573c', ['#c94a32', '#e86a4c', '#b8432e'], 2600), [40, 3]);
    const tw = TRACK.x1 - TRACK.x0, td = TRACK.z0 - TRACK.z1;
    flat(tw, td, std('#ffffff', { map: trackTex, roughness: 0.9 }), (TRACK.x0 + TRACK.x1) / 2, 0.01, (TRACK.z0 + TRACK.z1) / 2, g);
    const white = std('#ffffff', { roughness: 0.6 });
    for (let i = 0; i <= NL; i++) mesh(new T.BoxGeometry(tw, 0.006, 0.07), white, (TRACK.x0 + TRACK.x1) / 2, 0.016, LANE / 2 - i * LANE, g, false).receiveShadow = true;
    // the kerbs
    const kerb = std('#f4f4f4', { roughness: 0.7 });
    mesh(new T.BoxGeometry(tw, 0.08, 0.18), kerb, (TRACK.x0 + TRACK.x1) / 2, 0.04, TRACK.z0, g);
    mesh(new T.BoxGeometry(tw, 0.08, 0.18), kerb, (TRACK.x0 + TRACK.x1) / 2, 0.04, TRACK.z1, g);
    // start line and lane numbers
    mesh(new T.BoxGeometry(0.1, 0.008, NL * LANE), white, 0, 0.018, -(NL - 1) * LANE / 2, g, false);
    for (let i = 0; i < NL; i++) {
      const m = flat(1.1, 1.1, new T.MeshBasicMaterial({ map: label(String(i + 1), { size: 110, w: 128, h: 128 }), transparent: true }), -1.4, 0.02, laneZ(i), g);
      m.rotation.z = Math.PI / 2;
    }
    // the distance boards along the far edge, every 10 m
    for (let d = 10; d <= 100; d += 10) sign(String(d), d, TRACK.z1 - 0.7, g, { w: 0.9, size: 84 });
  }

  function buildStands() {
    const g = new T.Group();
    scene.add(g);
    const len = 190, cx = 50;
    const conc = std('#c9ced8', { roughness: 0.9 }), seat = std('#3d6ad6', { roughness: 0.8 });
    // the ad boards in front of the stands: bright panels (no words)
    const [c, ctx] = makeCanvas(512, 64);
    const cols = ['#ffd400', '#ff3d7f', '#18d4ff', '#7ed957', '#ff8a1f', '#9b6bff'];
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(i * 64, 0, 64, 64);
      ctx.fillStyle = '#ffffff';
      ctx.font = `40px ${gfx.EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(['🏅', '⭐', '🏃', '🎉'][i % 4], i * 64 + 32, 34);
    }
    const ads = plane(len, 1.0, new T.MeshBasicMaterial({ map: toTexture(c, [len / 8, 1]) }));
    ads.position.set(cx, 0.5, TRACK.z1 - 1.6);
    g.add(ads);
    const ROWS = 6;
    for (let k = 0; k < ROWS; k++) {
      mesh(new T.BoxGeometry(len, 0.9 + k * 0.9, 2.2), conc, cx, (0.9 + k * 0.9) / 2, TRACK.z1 - 3.2 - k * 2.2, g, false).receiveShadow = true;
      mesh(new T.BoxGeometry(len, 0.12, 0.5), seat, cx, 0.95 + k * 0.9, TRACK.z1 - 3.0 - k * 2.2, g, false);
    }
    // a roof over the top rows
    mesh(new T.BoxGeometry(len, 0.3, 9), std('#ffffff', { roughness: 0.6 }), cx, ROWS * 0.9 + 4.2, TRACK.z1 - 3.2 - (ROWS - 2) * 2.2, g, false);
    for (let x = cx - len / 2 + 5; x <= cx + len / 2; x += 20) mesh(new T.BoxGeometry(0.3, 4.4, 0.3), std('#dfe3ea'), x, ROWS * 0.9 + 2, TRACK.z1 - 2.6 - (ROWS - 2) * 2.2 + 4, g, false);
    // the crowd: little blocky fans, instanced
    const spots = [];
    for (let k = 0; k < ROWS; k++) for (let x = cx - len / 2 + 1; x < cx + len / 2 - 1; x += 0.95) if (Math.random() < 0.62) spots.push([x + (Math.random() - 0.5) * 0.3, 0.9 + k * 0.9, TRACK.z1 - 3.4 - k * 2.2, Math.random() * 6.28]);
    const n = spots.length;
    const body = new T.InstancedMesh(new T.BoxGeometry(0.5, 0.62, 0.34), std('#ffffff', { roughness: 0.8 }), n);
    const head = new T.InstancedMesh(new T.BoxGeometry(0.34, 0.34, 0.34), std('#ffffff', { roughness: 0.8 }), n);
    const shirt = ['#ff3d7f', '#ffd400', '#18d4ff', '#7ed957', '#ff8a1f', '#9b6bff', '#ffffff', '#3d6ad6', '#ff4b5c'];
    const skin = ['#f2c9a0', '#e0a878', '#c68a5a', '#8d5a3a', '#f7d9bf'];
    const col = new T.Color();
    spots.forEach((s, i) => {
      body.setColorAt(i, col.set(shirt[(Math.random() * shirt.length) | 0]));
      head.setColorAt(i, col.set(skin[(Math.random() * skin.length) | 0]));
    });
    g.add(body, head);
    crowd = { body, head, spots, m: new T.Matrix4(), q: new T.Quaternion(), v: new T.Vector3(), one: new T.Vector3(1, 1, 1) };
    poseCrowd(0);
  }
  function poseCrowd(amp) {
    const c = crowd;
    c.spots.forEach(([x, y, z, ph], i) => {
      const up = amp * Math.max(0, Math.sin(clock * 9 + ph)) * 0.35;
      c.m.compose(c.v.set(x, y + 0.31 + up, z), c.q, c.one);
      c.body.setMatrixAt(i, c.m);
      c.m.compose(c.v.set(x, y + 0.8 + up, z), c.q, c.one);
      c.head.setMatrixAt(i, c.m);
    });
    c.body.instanceMatrix.needsUpdate = true;
    c.head.instanceMatrix.needsUpdate = true;
  }

  function buildEvents() {
    const white = std('#ffffff', { roughness: 0.6 });
    // finish line: a chequered strip and an arch with a sign facing the camera
    const fin = (groups.finish = new T.Group());
    const chk = toTexture((() => { const [c, g] = makeCanvas(64, 512); for (let y = 0; y < 16; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#14121f' : '#ffffff'; g.fillRect(x * 32, y * 32, 32, 32); } return c; })());
    const strip = flat(0.5, NL * LANE, new T.MeshBasicMaterial({ map: chk }), 0, 0.02, -(NL - 1) * LANE / 2, fin);
    strip.rotation.z = 0;
    const postM = std('#ffd400', { roughness: 0.5 });
    mesh(new T.BoxGeometry(0.22, 3.4, 0.22), postM, 0, 1.7, TRACK.z0 + 0.4, fin);
    mesh(new T.BoxGeometry(0.22, 3.4, 0.22), postM, 0, 1.7, TRACK.z1 - 0.4, fin);
    mesh(new T.BoxGeometry(0.18, 0.3, TRACK.z0 - TRACK.z1 + 0.8), postM, 0, 3.3, (TRACK.z0 + TRACK.z1) / 2, fin);
    finishSign = new T.Mesh(new T.PlaneGeometry(3.2, 0.8), new T.MeshBasicMaterial({ transparent: true }));
    finishSign.position.set(0, 3.95, TRACK.z1 - 0.3);
    fin.add(finishSign);
    // a tape across the finish
    groups.tape = mesh(new T.BoxGeometry(0.04, 0.05, NL * LANE), std('#ff3d7f'), 0, 1.15, -(NL - 1) * LANE / 2, fin, false);
    scene.add(fin);

    // hurdles: 5 in every lane (60 m race)
    const hg = (groups.hurdles = new T.Group());
    const barTex = toTexture(stripes(128, 16, '#14121f', '#ffffff', 8, true));
    const barM = std('#ffffff', { map: barTex, roughness: 0.5 }), legM = std('#e8e8e8', { roughness: 0.5 });
    const H = S.HURDLE_H;
    for (let l = 0; l < NL; l++) {
      hurdles[l] = [];
      for (const hx of S.EV.hurdles.hurdles) {
        const g = new T.Group();
        g.position.set(hx, 0, laneZ(l));
        const inner = new T.Group();
        g.add(inner);
        for (const sz of [-0.75, 0.75]) {
          mesh(new T.BoxGeometry(0.05, H, 0.05), legM, 0, H / 2, sz, inner);
          mesh(new T.BoxGeometry(0.6, 0.04, 0.06), legM, -0.3, 0.02, sz, inner);
        }
        mesh(new T.BoxGeometry(0.03, 0.12, 1.56), barM, 0, H - 0.06, 0, inner);
        hg.add(g);
        hurdles[l].push({ g: inner, fall: 0, down: false });
      }
    }
    scene.add(hg);

    // long jump: a take-off board and a sand pit in every lane, and distance boards along the near side
    const lj = (groups.longjump = new T.Group());
    const B = S.EV.longjump.board, P = S.EV.longjump.pit;
    const sand = std('#f0d9a0', { roughness: 1 }), wood = std('#b07a46', { roughness: 0.8 });
    for (let l = 0; l < NL; l++) {
      const z = laneZ(l);
      mesh(new T.BoxGeometry(0.2, 0.025, 1.2), white, B - 0.1, 0.02, z, lj, false).receiveShadow = true;
      mesh(new T.BoxGeometry(0.1, 0.026, 1.2), std('#ff8a1f'), B + 0.05, 0.02, z, lj, false);
      mesh(new T.BoxGeometry(P, 0.06, 1.9), sand, B + 1 + P / 2, 0.03, z, lj, false).receiveShadow = true;
      for (const dz of [-1, 1]) mesh(new T.BoxGeometry(P + 0.2, 0.1, 0.1), wood, B + 1 + P / 2, 0.05, z + dz, lj, false);
    }
    for (let d = 2; d <= 10; d++) sign(String(d), B + d, TRACK.z0 + 0.9, lj, { w: 0.7, h: 0.5, size: 90, bg: '#fff3a0' });
    scene.add(lj);

    // javelin: the throwing line, grass beyond it, and a line every 10 m with its number
    const jv = (groups.javelin = new T.Group());
    const L = S.EV.javelin.line;
    const grass = std('#ffffff', { map: toTexture(stripes(256, 256, '#62c64f', '#57b846', 8, true), [16, 2]), roughness: 0.95 });
    flat(80, TRACK.z0 - TRACK.z1 + 0.3, grass, L + 40.1, 0.022, (TRACK.z0 + TRACK.z1) / 2, jv);
    mesh(new T.BoxGeometry(0.12, 0.01, NL * LANE + 0.6), white, L, 0.028, -(NL - 1) * LANE / 2, jv, false);
    for (let d = 10; d <= 70; d += 10) {
      mesh(new T.BoxGeometry(0.08, 0.01, NL * LANE + 0.6), white, L + d, 0.028, -(NL - 1) * LANE / 2, jv, false);
      sign(String(d), L + d, TRACK.z0 + 0.9, jv, { w: 0.9, h: 0.6, size: 84, bg: '#fff3a0' });
    }
    scene.add(jv);
    relabel();
  }

  function buildPodium() {
    const g = (groups.podium = new T.Group());
    g.position.set(POD.x, 0, POD.z);
    const spec = [[1, 0, 1.25, '#ffd400'], [2, -1.75, 0.85, '#dfe6ee'], [3, 1.75, 0.55, '#f0a060']];
    for (const [n, x, h, col] of spec) {
      mesh(new T.BoxGeometry(1.7, h, 1.5), std(col, { roughness: 0.5 }), x, h / 2, 0, g);
      const num = plane(0.9, 0.9 * Math.min(1, h / 0.9), new T.MeshBasicMaterial({ map: label(String(n), { size: 110, color: '#14121f', w: 128, h: 128 }), transparent: true }));
      num.position.set(x, h / 2, 0.76);
      g.add(num);
    }
    mesh(new T.BoxGeometry(6.2, 0.08, 2.4), std('#3d6ad6'), 0, 0.04, 0, g, false).receiveShadow = true;
    scene.add(g);
  }
  // where an athlete stands on the podium for place 1, 2 or 3
  function podiumSpot(place) {
    const [x, h] = place === 1 ? [0, 1.25] : place === 2 ? [-1.75, 0.85] : place === 3 ? [1.75, 0.55] : [3.6, 0];
    return new T.Vector3(POD.x + x, h, POD.z);
  }

  // canvas words (redrawn when the language changes)
  function relabel() {
    if (finishSign) {
      finishSign.material.map = label(Kit.lang.t('FINISH'), { w: 512, h: 128, bg: '#ff3d7f', stroke: '#14121f', size: 70 });
      finishSign.material.needsUpdate = true;
    }
  }

  // show what this event needs
  function setEvent(evId) {
    const ev = S.EV[evId];
    groups.finish.visible = ev.kind === 'race';
    if (ev.kind === 'race') groups.finish.position.x = ev.dist;
    groups.tape.visible = true;
    groups.hurdles.visible = !!ev.hurdles;
    groups.longjump.visible = ev.kind === 'jump';
    groups.javelin.visible = ev.kind === 'throw';
    resetHurdles();
    clearMarks();
  }
  function resetHurdles() { for (const lane of hurdles) for (const h of lane) { h.fall = 0; h.down = false; h.g.rotation.z = 0; } }
  function knock(lane, k) { const h = hurdles[lane] && hurdles[lane][k]; if (h) h.down = true; }
  function breakTape() { groups.tape.visible = false; }

  // ---------------------------------------------------------------- athletes
  function makeAthlete(entry, scale, tagColor, opts = {}) {
    const holder = new T.Group();
    const p = Kit.people.build(entry.look);
    p.root.rotation.y = -Math.PI / 2;
    p.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    holder.add(p.root);
    holder.scale.setScalar(scale);
    scene.add(holder);
    const A = { entry, holder, p, scale, mode: 'stand', phase: Math.random() * 6, lean: 0, tag: null, jav: null, item: null, flip: 0 };
    if (opts.tag !== false) {
      A.tag = gfx.nameTag(entry.name, tagColor || entry.tag || '#ffd400');
      A.tag.position.set(0, 2.45, 0);
      A.tag.scale.multiplyScalar(0.95 / scale);
      holder.add(A.tag);
    }
    return A;
  }
  function removeAthlete(A) {
    if (!A) return;
    scene.remove(A.holder);
    if (A.jav) scene.remove(A.jav);
    if (A.item) A.holder.remove(A.item);
  }
  function makeJavelin() {
    const g = new T.Group();
    const shaft = mesh(new T.CylinderGeometry(0.045, 0.045, 2.5, 8), std('#ffd400', { roughness: 0.4 }), 0, 0, 0, g);
    shaft.rotation.z = Math.PI / 2;
    const tip = mesh(new T.ConeGeometry(0.06, 0.36, 8), std('#c9d1dc', { metalness: 0.6, roughness: 0.3 }), 1.42, 0, 0, g);
    tip.rotation.z = -Math.PI / 2;
    const grip = mesh(new T.CylinderGeometry(0.06, 0.06, 0.36, 8), std('#ff3d7f'), 0.1, 0, 0, g);
    grip.rotation.z = Math.PI / 2;
    scene.add(g);
    return g;
  }
  const tmp = new T.Vector3();
  // A: the drawn athlete; st: { x, y, z, mode, speed (m/s), lean, carry }
  function animAthlete(A, st, dt) {
    A.holder.position.set(st.x, st.y || 0, st.z);
    const k = 1 - Math.exp(-18 * dt);
    const mode = st.mode || 'stand';
    A.phase += dt * (mode === 'run' ? 1.2 + (st.speed || 0) * 1.25 : mode === 'walk' ? 6 : 6);
    Kit.people.pose(A.p, A.phase, mode, k);
    const lean = st.lean == null ? (mode === 'run' ? -0.12 - Math.min(1, (st.speed || 0) / 11) * 0.22 : 0) : st.lean;
    A.p.rig.rotation.x += (lean - A.p.rig.rotation.x) * k;
    A.p.rig.position.y = 0.55 + (st.crouch || 0) * -0.25;
    if (st.carry && mode !== 'straight') {
      A.p.armR.rotation.x = 2.7;
      A.p.armR.rotation.z = -0.2;
    }
    A.holder.rotation.y = st.turn || 0;
    if (A.jav && st.carry) {
      A.holder.updateMatrixWorld(true);
      Kit.people.handWorld(A.p, 1, tmp);
      A.jav.position.copy(tmp);
      A.jav.rotation.set(0, 0, 0.3);
      A.jav.scale.setScalar(A.scale / 0.9);
    }
  }
  function carryJavelin(A, on) {
    if (on && !A.jav) A.jav = makeJavelin();
    if (!on && A.jav) { scene.remove(A.jav); A.jav = null; }
  }
  // a javelin in flight (from the sim): position and point it along its path
  function flyJavelin(A, j) {
    if (!A.jav) A.jav = makeJavelin();
    const vy = j.vy - S.GRAV * j.t;
    A.jav.position.set(j.x, Math.max(0.05, j.y), A.holder.position.z);
    A.jav.rotation.set(0, 0, Math.atan2(vy, j.vx));
  }
  // let go of the javelin mesh (it stays stuck in the ground as a marker)
  function dropJavelin(A) {
    const m = A.jav;
    A.jav = null;
    if (m) {
      const r = Math.max(-1.1, Math.min(-0.35, m.rotation.z));
      m.rotation.z = r;
      m.position.x -= Math.cos(r) * 1.0;
      m.position.y = -Math.sin(r) * 1.0;
      marks.push(m);
    }
  }

  // a little flag where a jump or a throw landed, with the distance
  function markFlag(x, z, color, text) {
    const g = new T.Group();
    mesh(new T.CylinderGeometry(0.025, 0.025, 1.2, 6), std('#ffffff'), 0, 0.6, 0, g);
    const f = mesh(new T.BoxGeometry(0.42, 0.28, 0.02), std(color), 0.22, 1.05, 0, g);
    f.castShadow = false;
    if (text) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: label(text, { bg: '#14121f', color: '#ffd400', size: 64, w: 256, h: 96 }), depthWrite: false }));
      s.scale.set(1.1, 0.41, 1);
      s.position.set(0, 1.6, 0);
      g.add(s);
    }
    g.position.set(x, 0, z + 0.65);
    scene.add(g);
    marks.push(g);
    return g;
  }
  function clearMarks() { for (const m of marks) scene.remove(m); marks.length = 0; }

  // a sprite with an emoji (treats, medals, the basketball)
  function emojiSprite(e, size = 0.6) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture(e), depthWrite: false }));
    s.scale.set(size, size, 1);
    scene.add(s);
    return s;
  }
  function removeObj(o) { if (o) { if (o.parent) o.parent.remove(o); } }

  // ---------------------------------------------------------------- effects
  function spawn(n, f) {
    for (let i = 0; i < n; i++) {
      const o = f(i);
      const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.dotTexture(), color: o.color, transparent: true, depthWrite: false }));
      s.position.copy(o.p);
      s.scale.setScalar(o.size);
      scene.add(s);
      fx.push({ s, v: o.v, life: o.life, t: 0, g: o.g == null ? 6 : o.g, grow: o.grow || 0, size: o.size, spin: o.spin || 0 });
    }
  }
  const CONF = ['#ffd400', '#ff3d7f', '#18d4ff', '#7ed957', '#ff8a1f', '#9b6bff', '#ffffff'];
  const fxApi = {
    confetti(x, y, z, n = 120) {
      spawn(n, () => ({ p: new T.Vector3(x + (Math.random() - 0.5) * 2, y, z + (Math.random() - 0.5) * 2), v: new T.Vector3((Math.random() - 0.5) * 7, 4 + Math.random() * 6, (Math.random() - 0.5) * 7), color: CONF[(Math.random() * CONF.length) | 0], size: 0.16, life: 2.6 + Math.random(), g: 4.5 }));
    },
    poof(x, y, z) {
      spawn(14, () => ({ p: new T.Vector3(x + (Math.random() - 0.5) * 0.6, y + 0.6 + Math.random(), z + (Math.random() - 0.5) * 0.6), v: new T.Vector3((Math.random() - 0.5) * 2.5, Math.random() * 1.5, (Math.random() - 0.5) * 2.5), color: '#ffffff', size: 0.45, life: 0.6, g: 0, grow: 1.6 }));
    },
    sand(x, z) {
      spawn(22, () => ({ p: new T.Vector3(x, 0.15, z + (Math.random() - 0.5) * 0.8), v: new T.Vector3((Math.random() - 0.3) * 3, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 2), color: '#e8c98a', size: 0.18, life: 0.9, g: 9 }));
    },
    dust(x, z) {
      spawn(3, () => ({ p: new T.Vector3(x - 0.2, 0.08, z + (Math.random() - 0.5) * 0.4), v: new T.Vector3(-0.8 - Math.random(), 0.4 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6), color: '#e8a58f', size: 0.16, life: 0.45, g: 1, grow: 0.8 }));
    },
    trail(x, y, z) {
      spawn(1, () => ({ p: new T.Vector3(x, y, z), v: new T.Vector3(0, 0, 0), color: '#fff3a0', size: 0.32, life: 0.55, g: 0, grow: -0.6 }));
    },
    clap(x, y, z) {
      spawn(16, (i) => ({ p: new T.Vector3(x, y, z), v: new T.Vector3(Math.cos(i / 2.5) * 3, Math.sin(i / 2.5) * 3, 0.5), color: '#ffd400', size: 0.18, life: 0.5, g: 0 }));
    },
  };

  // ---------------------------------------------------------------- camera
  function fit(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    cam.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  // follow the action: x is what to look at; spread is how far apart the athletes we must keep in view are
  function follow(x, opts = {}) {
    cam.mode = 'track';
    cam.tx = x;
    cam.spread = opts.spread || 0;
    cam.zc = opts.zc == null ? -2.3 : opts.zc;
    cam.wide = opts.wide || 0;
    cam.ly = opts.y || 0.9;
    if (opts.snap) cam.snap = true;
  }
  function podiumView(snap, shift) { cam.mode = 'podium'; cam.shift = shift || 0; if (snap) cam.snap = true; }
  function titleView(snap) { cam.mode = 'title'; if (snap) cam.snap = true; }
  const want = { p: new T.Vector3(), l: new T.Vector3() };
  function aim(dt) {
    const a = cam.aspect, tanH = Math.tan((camera.fov * Math.PI) / 360);
    if (cam.mode === 'podium') {
      // the podium in the top half (the card sits below), or on the left of a short wide screen (the card on the right)
      const side = cam.shift === 'side';
      const hh = side ? 3.3 : Math.max(3.9, 4.4 / a);
      const d = hh / tanH, ly = side ? 1.7 : -0.1, sx = side ? hh * a * 0.5 : 0;
      want.p.set(POD.x + sx, ly + 1.2 + d * 0.06, POD.z + d);
      want.l.set(POD.x + sx, ly, POD.z);
    } else if (cam.mode === 'title') {
      const sw = Math.sin(clock * 0.15) * 1.5;
      want.p.set(7 + sw, 2.6, 7.5);
      want.l.set(-1.5 + sw * 0.5, 1.3, -3.2);
    } else {
      // keep about 13 m of track in view (8.5 m on a phone held upright), more when the athletes are spread out
      const need = Math.max(a < 1 ? 8.5 : 13, cam.spread + 7) + cam.wide;
      const d = Math.max(12, need / (2 * tanH * a));
      const lead = need * 0.16;
      const up = Math.max(0, (cam.ly || 0.9) - 0.9);
      want.p.set(cam.tx - 1.5, 3 + d * 0.22 + up * 0.7, cam.zc + d);
      want.l.set(cam.tx + lead, 0.9 + up * 0.8, cam.zc);
    }
    const k = cam.snap ? 1 : 1 - Math.exp(-4 * dt);
    cam.snap = false;
    camera.position.lerp(want.p, k);
    if (!aim.look) aim.look = want.l.clone();
    aim.look.lerp(want.l, k);
    camera.lookAt(aim.look);
    sun.position.set(aim.look.x + 12, 24, aim.look.z + 14);
    sun.target.position.copy(aim.look);
  }

  // world -> screen pixels (for the angle dial and the pop-up numbers)
  function project(x, y, z) {
    tmp.set(x, y, z).project(camera);
    const r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((tmp.x + 1) / 2) * r.width, y: r.top + ((1 - tmp.y) / 2) * r.height, on: tmp.z < 1 };
  }

  function update(dt) {
    clock += dt;
    for (const lane of hurdles) for (const h of lane) if (h.down && h.fall < 1) { h.fall = Math.min(1, h.fall + dt * 4); h.g.rotation.z = -1.45 * (1 - (1 - h.fall) * (1 - h.fall)); }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += dt;
      f.v.y -= f.g * dt;
      f.v.multiplyScalar(f.g > 4 ? 1 - 1.2 * dt : 1);
      f.s.position.addScaledVector(f.v, dt);
      if (f.grow) f.s.scale.setScalar(f.size * (1 + f.grow * f.t / f.life));
      f.s.material.opacity = Math.min(1, 2.5 * (1 - f.t / f.life));
      if (f.t >= f.life || f.s.position.y < -0.2) { scene.remove(f.s); f.s.material.dispose(); fx.splice(i, 1); }
    }
    if (cheer > 0) { cheer = Math.max(0, cheer - dt); poseCrowd(Math.min(1, cheer)); } else if (Math.floor(clock * 4) !== Math.floor((clock - dt) * 4)) poseCrowd(0.12);
    aim(dt);
  }
  function render() { renderer.render(scene, camera); }

  TF.scene = {
    LANE, laneZ, NL, TRACK, POD, init, fit, render, update, setEvent, resetHurdles, knock, breakTape, relabel, makeAthlete, removeAthlete, animAthlete,
    carryJavelin, flyJavelin, dropJavelin, markFlag, clearMarks, emojiSprite, removeObj, podiumSpot, follow, podiumView, titleView, project,
    cheer(t) { cheer = Math.max(cheer, t); }, fx: fxApi,
    get camera() { return camera; }, get scene() { return scene; },
  };
})();
