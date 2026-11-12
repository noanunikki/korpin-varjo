'use strict';
// =====================================================================
//  PELI: näkymä, syötteet, kahdeksan tehtävän kampanja, HUD, minikartta, pääsilmukka
// =====================================================================
const Game = {
  started: false, paused: true, ended: false, locked: false, lockWorked: false,
  stats: { kills: 0, leaps: 0, detected: 0, time: 0, race: 0 },
  eagle: false, synced: false, syncedPerches: {}, mi: -1, missions: [], targets: {},
  checkpoint: new V3(0, 0, 112), checkpointFace: Math.PI, lastGround: new V3(0, 0, 112), lastGroundT: 0,
  shake: 0, hurtFlash: 0, invuln: false, lockTarget: null, wanted: false,
  featherCount: 0, hintT: 0, civs: [], objPos: new V3(), beam: null, currentTarget: null,
  hitStop: 0, timeScale: 1, slowT: 0, slowScale: 1, tension: 0, menu: false,
  race: { rings: [], meshes: [], i: 0, t: 0, running: false, limit: 170, par: 120 },

  toast(msg, kind, color) {
    const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = msg;
    if (color) el.style.color = color;
    const box = document.getElementById('toasts'); box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { el.style.transition = 'opacity .6s'; el.style.opacity = 0; setTimeout(() => el.remove(), 650); }, 2800);
  },
  nearestEnemy(r) { return Guards.nearestEnemy(r); },
  onAlert(g) { },
  slowmo(real, scale) { this.slowT = real; this.slowScale = scale; },
  get mission() { return this.missions[this.mi]; },

  // ---------- Tehtävät ----------
  startMission(i) {
    this.mi = i; const m = this.mission;
    if (!m) return;
    this.currentTarget = null;
    if (m.type === 'sync' && this.syncedPerches[m.perch]) { this.toast('Synkronointipiste on jo avattu', 'good'); this.advance(true); return; }
    if (m.type === 'kill') {
      const t = this.targets[m.target];
      if (!t || t.dead) { this.advance(true); return; }
      this.currentTarget = t;
    }
    document.getElementById('objt').textContent = `Tehtävä ${i + 1} / ${this.missions.length}`;
    this.setObjective(m.title, m.desc);
    if (m.type === 'race') this.buildRace();
    this.updateBeam(true);
  },
  advance(silent) {
    if (!silent) { Sfx.pickup(); this.toast('Tehtävä suoritettu: +150 kokemusta, +100 hopeaa', 'good'); Loot.addXp(150); Loot.silver += 100; }
    if (this.lastGroundT > 0) { this.checkpoint.copy(this.lastGround); }
    this.clearRace();
    if (this.mi + 1 >= this.missions.length) { this.win(); return; }
    this.startMission(this.mi + 1);
  },
  updateBeam(force) {
    const m = this.mission; if (!m) return;
    let x = 0, z = 0;
    if (m.type === 'sync') { const p = World.perches.find(p => p.name === m.perch); x = p.x; z = p.z; }
    else if (m.type === 'kill') { const t = this.targets[m.target]; x = t.pos.x; z = t.pos.z; }
    else if (m.type === 'race') { const r = this.race.rings[this.race.i]; if (r) { x = r.x; z = r.z; } else { x = this.objPos.x; z = this.objPos.z; } }
    else if (m.type === 'escape') { x = World.zones.safe.x; z = World.zones.safe.z; }
    else if (m.type === 'goto') { x = m.x; z = m.z; }
    this.setBeam(x, z, m.color);
  },
  setObjective(t, d) { document.getElementById('objm').textContent = t; this.objd = d; document.getElementById('objd').textContent = d || ''; },
  setBeam(x, z, color) {
    if (!this.beam) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 160, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      this.beam = m; scene.add(m);
    }
    this.beam.material.color.setHex(color); this.beam.position.set(x, 80, z); this.objPos.set(x, 0, z);
  },
  onTargetKilled(g, witnessed) {
    this.toast(`${g.targetName} eliminoitu`, 'good'); Sfx.sync();
    if (witnessed) Guards.alertAt(g.pos, 30, g);
    const m = this.mission;
    if (m && m.type === 'kill' && this.targets[m.target] === g) setTimeout(() => { if (this.mission === m) this.advance(); }, 900);
  },
  sync(per) {
    this.syncedPerches[per.name] = true; this.synced = true; Sfx.sync();
    const off = { s: [0, 12], n: [0, -12], e: [12, 0], w: [-12, 0] }[per.dir] || [0, 12];
    this.checkpoint.set(per.cx + off[0], 0, per.cz + off[1]);
    FX.burst(Player.pos.x, Player.pos.y + 1, Player.pos.z, 40, 5, [0.4, 0.9, 1], 0.28, 1.2, -1, 2, 0.5);
    this.toast(`Synkronointi valmis: ${per.name}`, 'good');
    const m = this.mission;
    if (m && m.type === 'sync' && m.perch === per.name) this.advance();
  },

  // ---------- Katokisa ----------
  buildRace() {
    const R = this.race; this.clearRace(); R.rings = []; R.i = 0; R.t = 0; R.running = false;
    const cands = [];
    for (const k in World.blockB) for (const b of World.blockB[k]) if (b.h >= 9 && !b.guardRoof && !b.tower && b.x1 - b.x0 >= 7 && b.z1 - b.z0 >= 7) cands.push(b);
    let cx = Player.pos.x, cz = Player.pos.z; const used = [];
    for (let n = 0; n < 7; n++) {
      let best = null, bs = 1e9;
      for (const b of cands) {
        if (used.includes(b)) continue;
        const bx = (b.x0 + b.x1) / 2, bz = (b.z0 + b.z1) / 2, d = Math.hypot(bx - cx, bz - cz);
        if (d < 14 || d > (n === 0 ? 95 : 48)) continue;
        // pidä suunta: älä palaa edellisten renkaiden luo
        let pen = 0; for (const r of R.rings) pen += Math.max(0, 30 - Math.hypot(bx - r.x, bz - r.z));
        const s = Math.abs(d - 26) + pen;
        if (s < bs) { bs = s; best = b; }
      }
      if (!best) break;
      used.push(best);
      const corners = [[best.x0 + 1.4, best.z0 + 1.4], [best.x1 - 1.4, best.z0 + 1.4], [best.x0 + 1.4, best.z1 - 1.4], [best.x1 - 1.4, best.z1 - 1.4]];
      corners.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz));
      const c = corners[0];
      R.rings.push({ x: c[0], y: best.h + 1.5, z: c[1], roof: best.h });
      cx = c[0]; cz = c[1];
    }
    R.rings.forEach((r, i) => {
      const nxt = R.rings[i + 1] || r, prv = R.rings[i - 1] || { x: Player.pos.x, z: Player.pos.z };
      const dir = Math.atan2(nxt.x - prv.x, nxt.z - prv.z);
      const m = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.14, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.55, fog: false }));
      m.position.set(r.x, r.y, r.z); m.rotation.y = dir; scene.add(m); R.meshes.push(m);
    });
    this.updateRaceVisuals();
  },
  clearRace() { for (const m of this.race.meshes) scene.remove(m); this.race.meshes = []; this.race.rings = []; },
  updateRaceVisuals() {
    const R = this.race;
    R.meshes.forEach((m, i) => {
      m.visible = i >= R.i;
      m.material.color.setHex(i === R.i ? 0x4ff0ff : 0xffd54a); m.material.opacity = i === R.i ? 0.95 : 0.4;
      m.scale.setScalar(i === R.i ? 1.15 : 0.85);
    });
  },
  updateRace(dt) {
    const R = this.race, P = Player; if (!R.rings.length) return;
    if (R.running) R.t += dt;
    const r = R.rings[R.i];
    const mesh = R.meshes[R.i]; if (mesh) { mesh.rotation.z += dt * 1.5; }
    if (P.state !== 'dead' && P.state !== 'hidden' && Math.hypot(P.pos.x - r.x, P.pos.z - r.z) < 2.6 && Math.abs((P.pos.y + 1) - r.y) < 2.8) {
      Sfx.pickup(); FX.burst(r.x, r.y, r.z, 24, 4, [0.4, 0.95, 1], 0.25, 0.8, 0, 0, 0.5);
      if (R.i === 0) { R.running = true; R.t = 0; this.toast(`Aika käynnissä: ${R.limit} s`, 'warn'); }
      R.i++;
      if (R.i >= R.rings.length) {
        const t = R.t; this.stats.race = t; Loot.addXp(100);
        this.toast(t < R.par ? `Nopea aika: ${t.toFixed(1)} s!` : `Kisa läpi: ${t.toFixed(1)} s`, 'good');
        this.advance(); return;
      }
      this.updateRaceVisuals(); this.updateBeam();
    }
    if (R.running && R.t > R.limit) {
      this.toast('Aika loppui — yritä uudelleen', 'warn'); R.i = 0; R.t = 0; R.running = false; this.updateRaceVisuals(); this.updateBeam();
    }
  },

  onDeath() {
    document.getElementById('fade').style.opacity = 1;
    this.toast('Synkronointi menetetty', 'warn');
  },
  respawn() {
    Player.reset(this.checkpoint, this.checkpointFace);
    Guards.reset();
    this.invuln = true; setTimeout(() => this.invuln = false, 2500);
    document.getElementById('fade').style.opacity = 0;
  },
  win() {
    this.ended = true; this.paused = true;
    if (document.exitPointerLock) document.exitPointerLock();
    const t = Math.round(this.stats.time), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    const full = this.stats.detected === 0;
    document.getElementById('endsub').textContent = full ? 'TÄYSI SYNKRONOINTI – KUKAAN EI HUOMANNUT SINUA' : 'KOLME KOHDETTA ON KUOLLUT — KAUPUNKI ON VAPAA';
    document.getElementById('endstats').innerHTML =
      `<div class="stat">Aika: <b>${mm}:${ss}</b></div><div class="stat">Vartijat kaatuneet: <b>${this.stats.kills}</b></div>` +
      `<div class="stat">Havaituksi tulit: <b>${this.stats.detected}</b> kertaa</div><div class="stat">Uskon loikat: <b>${this.stats.leaps}</b></div>` +
      `<div class="stat">Katokisa: <b>${this.stats.race ? this.stats.race.toFixed(1) + ' s' : '–'}</b></div>` +
      `<div class="stat">Korpin sulat: <b>${this.featherCount} / ${World.feathers.length}</b></div>` +
      `<div class="stat">Arkut avattu: <b>${Loot.opened} / ${Loot.chests.length}</b></div><div class="stat">Taso: <b>${Loot.level}</b> · Voimataso: <b>${Loot.charPower()}</b></div>`;
    document.getElementById('end').style.display = 'flex';
  },
};

// ---------- Alustus ----------
let renderer, scene, camera, sun, skyDome, clock;
const sunDir = new V3(0.55, 0.75, 0.38).normalize();
const featherMeshes = [];

function setupScene() {
  const canvas = document.getElementById('c');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfdce8);
  scene.fog = new THREE.Fog(0xcfdce8, 110, 520);
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);
  Cam.camera = camera;
  scene.add(new THREE.HemisphereLight(0xbcd4f2, 0x7a6a55, 0.8));
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));
  sun = new THREE.DirectionalLight(0xfff0d8, 1.0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62; sc.near = 1; sc.far = 320;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.35;
  scene.add(sun); scene.add(sun.target);
  const sg = new THREE.SphereGeometry(900, 24, 16);
  const cols = [], pos = sg.attributes.position, top = new THREE.Color(0x3f78c8), hor = new THREE.Color(0xd2e0ec);
  for (let i = 0; i < pos.count; i++) { const t = clamp(pos.getY(i) / 900, 0, 1), c = hor.clone().lerp(top, Math.pow(t, 0.55)); cols.push(c.r, c.g, c.b); }
  sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  skyDome = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(skyDome);
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(28, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff4c8, fog: false }));
  sunDisc.position.copy(sunDir).multiplyScalar(820); skyDome.add(sunDisc);
  const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: false, depthWrite: false });
  for (let i = 0; i < 18; i++) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(200 + Math.random() * 220, 60 + Math.random() * 60), cm);
    const a = Math.random() * Math.PI * 2, r = 500 + Math.random() * 250;
    c.position.set(Math.cos(a) * r, 220 + Math.random() * 160, Math.sin(a) * r); c.lookAt(0, 0, 0); skyDome.add(c);
  }
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  });
}

function setupWorld() {
  makeTextures();
  buildMap(scene);
  FX.init(scene);
  const gm = new THREE.MeshBasicMaterial({ color: 0x66e0ff }), geo = new THREE.OctahedronGeometry(0.25);
  World.feathers.forEach(f => {
    const m = new THREE.Mesh(geo, gm); m.scale.set(0.5, 1.6, 0.15); m.position.set(f.x, f.y, f.z); scene.add(m); featherMeshes.push(m);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 20), new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    m.add(halo); halo.scale.set(2, 0.62, 6);
  });
  document.getElementById('ftotal').textContent = World.feathers.length;
  buildMinimapBase();
}

function setupActors() {
  Player.init(scene);
  Guards.init(scene);
  const st = new V3(MAPD.start.x, groundH(MAPD.start.x, MAPD.start.z), MAPD.start.z);
  Player.reset(st, Math.PI); Game.checkpoint.copy(st); Game.lastGround.copy(st);
  Loot.init(); Loot.spawnChests();
  const S = (o) => Guards.spawn(o);
  const T = Game.targets, C = MAPD.city, F = MAPD.fort, V = MAPD.village, A = MAPD.farm, K = MAPD.camp;
  const c = (o, x, z) => [x + o.x, z + o.z];
  const rt = (o, pts) => pts.map(p => [p[0] + o.x, p[1] + o.z]);
  // --- kohteet ---
  T.captain = S({ type: 'captain', x: C.x, y: 0.9, z: C.z - 17.2, face: 0 });
  T.corvane = S({ type: 'sword', style: 'bishop', target: 'Piispa Corvane', hp: 140, x: C.x + 62, z: C.z - 26.5, face: 0 });
  T.maren = S({ type: 'sword', style: 'noble', target: 'Verokuvernööri Maren', hp: 120, roof: true, x: GM.hall.x, y: GM.hall.h, z: GM.hall.z, face: 0 });
  const kp = GM.fortKeep;
  T.hesk = S({ type: 'sword', style: 'marshal', target: 'Sotamarsalkka Hesk', hp: 220, roof: true, x: kp.x - 2.0, y: kp.y, z: kp.z - 1.5, face: 0 });
  // --- kaupungin torin vartijat ---
  S({ x: C.x - 3.5, z: C.z - 11.5, face: 0 }); S({ x: C.x + 3.5, z: C.z - 11.5, face: 0 });
  S({ x: C.x - 12, z: C.z - 4, route: rt(C, [[-12, -4], [12, -4], [12, 8], [-12, 8]]), wait: 2 });
  S({ x: C.x + 12, z: C.z + 8, route: rt(C, [[12, 8], [-12, 8], [-12, -4], [12, -4]]), wait: 2 });
  S({ type: 'archer', x: C.x + 14, z: C.z + 12, face: 3.5 });
  // --- kaupungin kadut ---
  S({ x: C.x - 28, z: C.z - 28, route: rt(C, [[-28, -28], [28, -28], [28, 28], [-28, 28]]), wait: 1.5 });
  S({ x: C.x + 28, z: C.z + 28, route: rt(C, [[28, 28], [-28, 28], [-28, -28], [28, -28]]), wait: 1.5 });
  S({ x: C.x - 60, z: C.z + 87, route: rt(C, [[-60, 87], [60, 87]]), wait: 3 });
  S({ x: C.x + 60, z: C.z - 87, route: rt(C, [[60, -87], [-60, -87]]), wait: 3 });
  S({ x: C.x + 28, z: C.z - 80, route: rt(C, [[28, -80], [28, -36]]), wait: 3 });
  S({ x: C.x - 28, z: C.z + 36, route: rt(C, [[-28, 36], [-28, 80]]), wait: 3 });
  S({ x: C.x + 34, z: C.z - 25, route: rt(C, [[34, -25], [54, -25]]), wait: 3 });
  S({ type: 'archer', x: C.x - 31, z: C.z - 31, face: 0.8 }); S({ type: 'archer', x: C.x + 31, z: C.z + 25, face: 3.9 });
  S({ x: C.x + 87, z: C.z + 40, route: rt(C, [[87, 40], [87, -40]]), wait: 3 });
  S({ x: C.x - 87, z: C.z - 20, route: rt(C, [[-87, -20], [-87, 50]]), wait: 3 });
  // --- piispan henkivartijat ---
  S({ x: C.x + 58, z: C.z - 26, face: 0.4 }); S({ x: C.x + 66, z: C.z - 26, face: -0.4 }); S({ x: C.x + 62, z: C.z - 23.5, face: Math.PI });
  S({ type: 'archer', x: C.x + 70, z: C.z - 30, face: 3.6 });
  // --- linnoitus ---
  S({ x: F.x - 30, z: F.z + 28, route: rt(F, [[-30, 28], [30, 28], [30, -8], [-30, -8]]), wait: 2 });
  S({ x: F.x + 30, z: F.z - 8, route: rt(F, [[30, -8], [-30, -8], [-30, 28], [30, 28]]), wait: 2 });
  S({ x: F.x - 6, z: F.z + 33, face: 0 }); S({ x: F.x + 6, z: F.z + 33, face: 0 });
  S({ roof: true, x: kp.x + 2.0, y: kp.y, z: kp.z + 1.8, face: 0 });
  S({ type: 'archer', roof: true, x: kp.x - 4.2, y: 30, z: kp.z, face: 0 }); S({ type: 'archer', roof: true, x: kp.x + 4.2, y: 30, z: kp.z, face: 0 });
  S({ type: 'archer', roof: true, x: F.x - 20, y: 11, z: F.z - 34.5, face: 0 }); S({ type: 'archer', roof: true, x: F.x + 20, y: 11, z: F.z - 34.5, face: 0 });
  S({ type: 'archer', roof: true, x: F.x - 36, y: 16, z: F.z + 32, face: 3.14 });
  // --- kalastajakylä ---
  S({ x: V.x - 45, z: V.z + 32, route: rt(V, [[-45, 32], [40, 32]]), wait: 3 });
  S({ x: V.x - 40, z: V.z + 10, route: rt(V, [[-40, 10], [-10, 10], [-10, -20], [-40, -20]]), wait: 2 });
  S({ x: V.x - 8, z: V.z - 32, face: 0 }); S({ x: V.x + 8, z: V.z - 32, face: 0 });
  S({ roof: true, x: GM.hall.x - 7, y: GM.hall.h, z: GM.hall.z, face: 0 }); S({ roof: true, x: GM.hall.x + 7, y: GM.hall.h, z: GM.hall.z, face: 0 });
  S({ type: 'archer', x: V.x + 30, z: V.z + 20, face: 0.6 });
  // --- tuulimylly ---
  S({ x: A.x - 18, z: A.z - 20, route: rt(A, [[-18, -20], [24, -20], [24, 26], [-18, 26]]), wait: 3 });
  // --- tienvarsipartiot ---
  S({ x: -80, z: 130, route: [[-80, 130], [-30, 70]], wait: 4 }); S({ x: 90, z: 60, route: [[90, 60], [140, 95]], wait: 4 }); S({ x: 30, z: -80, route: [[30, -80], [50, -120]], wait: 4 });
  // --- rosvoleiri ---
  for (const [x, z, f] of [[-6, -4, 0.5], [6, 4, 3.5], [-10, 12, 1.5], [14, -2, 2.5], [0, -14, 0], [-16, -14, 0.8]]) S({ x: K.x + x, z: K.z + z, face: f, style: 'archer' });
  S({ type: 'archer', roof: true, x: K.x - 19.5, y: 9, z: K.z - 19.5, face: 0.8 });
  S({ x: K.x + 4, z: K.z - 4, route: rt(K, [[4, -4], [-8, 14], [14, 14]]), wait: 2, style: 'archer' });
  for (const s of World.spawns) Guards.spawn(s);

  // siviilit
  const addCiv = (ax, az, bx, bz) => { const cv = { m: makeCivilian(), a: [ax, az], b: [bx, bz], t: Math.random(), dir: Math.random() < .5 ? 1 : -1, speed: 1.0 + Math.random() * 0.6 }; cv.len = Math.hypot(bx - ax, bz - az); scene.add(cv.m); Game.civs.push(cv); };
  for (let i = 0; i < 12; i++) {
    const L = (i % 2 ? 28 : -28) + rand2(-3, 3);
    if (i % 4 < 2) addCiv(C.x + L, C.z - 80, C.x + L, C.z + 80); else addCiv(C.x - 80, C.z + L, C.x + 80, C.z + L);
  }
  for (let i = 0; i < 6; i++) addCiv(V.x - 50 + i * 3, V.z - 20 + rand2(-4, 4), V.x + 40, V.z - 20 + rand2(-4, 8));
  for (let i = 0; i < 3; i++) addCiv(A.x - 20, A.z + 28 + i * 2, A.x + 25, A.z + 28 + i * 2);
  for (const [x, z] of [[-6, 6], [5, 7], [-12, 2], [12, 3], [-4, 11], [4, -9], [-13, -11], [13, -11]]) {
    const m = makeCivilian(); m.position.set(C.x + x, 0, C.z + z); m.rotation.y = Math.random() * 6; scene.add(m); Game.civs.push({ m, still: true });
  }
  // kampanja
  Game.missions = [
    { type: 'sync', perch: 'tuulimylly', color: 0x4fd1c5, title: 'Kiipeä tuulimyllyn huipulle', desc: 'Seuraa sinistä valopylvästä. Pidä Shift pohjassa ja juokse seinää päin. Synkronoi huipulla (E).' },
    { type: 'goto', x: C.x, z: C.z + 114, r: 9, color: 0x4fd1c5, title: 'Matka Hallavuoren kaupunkiin', desc: 'Seuraa tietä lounaaseen. Kaupunki on kukkuloiden takana. Voit myös oikoa maastossa.' },
    { type: 'race', color: 0x4ff0ff, title: 'Katokisa: Korpin polku', desc: 'Harjoittele: lennä renkaiden läpi kattojen yli. Ensimmäinen rengas käynnistää kellon.' },
    { type: 'kill', target: 'captain', color: 0xffcf3a, title: 'Salamurhaa kapteeni Aldric', desc: 'Hän puhuu kaupungin torilla julistuslavalla. Hiivi, kiipeä katoille tai tule ylhäältä.' },
    { type: 'sync', perch: 'kellotorni', color: 0x4fd1c5, title: 'Synkronoi kaupungin kellotorni', desc: 'Kellotorni on kaupungin länsilaidalla. Kiipeä ja loikkaa lankulta heinään.' },
    { type: 'kill', target: 'corvane', color: 0xffcf3a, title: 'Salamurhaa piispa Corvane', desc: 'Hän siunaa kansaa katedraalin edustalla. Henkivartijoita on neljä, yksi on jousiampuja.' },
    { type: 'kill', target: 'maren', color: 0xffcf3a, title: 'Salamurhaa verokuvernööri Maren', desc: 'Hän tapaa salaa kalastajakylän pitkätalon katolla kaakossa. Matkaa on yli 300 metriä.' },
    { type: 'kill', target: 'hesk', color: 0xff8a3a, title: 'Salamurhaa sotamarsalkka Hesk', desc: 'Hän vartioi Korpilinnan tornin huipulta pohjoisessa. Jousiampujat muureilla. Kiipeä torniin.' },
    { type: 'escape', color: 0x4fe08a, title: 'Pakene tuulimyllylle', desc: 'Palaa maatilalle kartan keskelle ja hukkaa vartijat. Heinäkärryt auttavat.' },
  ];
  Game.startMission(0);
}
function rand2(a, b) { return a + Math.random() * (b - a); }

// ---------- Minikartta ----------
const MM = { S: 2, off: null, W: 660, X0: -330 };
function buildMinimapBase() {
  const S = MM.S, W = MM.W, N = W * S;
  // maasto 1 px/m, skaalataan
  const lo = document.createElement('canvas'); lo.width = lo.height = W; const lg = lo.getContext('2d');
  const img = lg.createImageData(W, W);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const x = MM.X0 + i + 0.5, z = MM.X0 + j + 0.5, h = Terrain.h(x, z), k = (j * W + i) * 4;
    let r, g, b;
    if (h < Terrain.water - 0.05) { r = 52; g = 92; b = 122; }
    else {
      const sl = Terrain.h(x + 2, z) - Terrain.h(x - 2, z), shade = clamp(1 + sl * 0.035, 0.7, 1.3);
      const t = clamp(h / 45, 0, 1);
      r = (58 + t * 90) * shade; g = (82 + t * 62) * shade; b = (50 + t * 70) * shade;
    }
    img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
  }
  lg.putImageData(img, 0, 0);
  const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.drawImage(lo, 0, 0, N, N);
  const rects = World.mapRects.slice().sort((a, b) => a[4] - b[4]);
  for (const r of rects) {
    const t = clamp(r[4] / 30, 0, 1), v = Math.floor(115 + t * 100);
    g.fillStyle = `rgb(${v},${v - 8},${v - 24})`;
    g.fillRect((r[0] - MM.X0) * S, (r[1] - MM.X0) * S, (r[2] - r[0]) * S, (r[3] - r[1]) * S);
  }
  // tiet
  g.strokeStyle = 'rgba(190,160,110,.7)'; g.lineWidth = 3 * S;
  for (const rd of Terrain.roads) { g.beginPath(); rd.forEach((p, i) => { const x = (p[0] - MM.X0) * S, y = (p[1] - MM.X0) * S; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
  MM.off = c;
}
function drawMinimap() {
  const cv = document.getElementById('minimap'), g = cv.getContext('2d'), S = MM.S, P = Player;
  g.clearRect(0, 0, 200, 200);
  g.save(); g.beginPath(); g.arc(100, 100, 99, 0, 7); g.clip();
  g.fillStyle = '#1b1f28'; g.fillRect(0, 0, 200, 200);
  g.translate(100, 100); g.rotate(Cam.yaw);
  g.drawImage(MM.off, (MM.X0 - P.pos.x) * S, (MM.X0 - P.pos.z) * S);
  const toM = (x, z) => [(x - P.pos.x) * S, (z - P.pos.z) * S];
  g.fillStyle = '#ffd54a';
  for (const c of Loot.chests) if (!c.open && (Game.synced && Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 40)) { const [x, z] = toM(c.x, c.z); g.fillRect(x - 3, z - 2, 6, 4); }
  g.fillStyle = '#66e0ff';
  for (const f of World.feathers) if (!f.got) { const d = Math.hypot(f.x - P.pos.x, f.z - P.pos.z); if (d < 28 || Game.synced && d < 50) { const [x, z] = toM(f.x, f.z); g.fillRect(x - 2, z - 2, 4, 4); } }
  for (const gd of Guards.list) {
    if (gd.dead) continue;
    const d = Math.hypot(gd.pos.x - P.pos.x, gd.pos.z - P.pos.z);
    const al = gd.state === 'alert';
    if (!(al || (Game.synced && d < 45) || Game.eagle)) continue;
    const [x, z] = toM(gd.pos.x, gd.pos.z);
    g.fillStyle = gd.isTarget ? '#ffcf3a' : (al ? '#ff3a2a' : (gd.state === 'curious' ? '#ffd54a' : '#d85a4a'));
    g.beginPath(); g.arc(x, z, gd.isTarget ? 5 : 3.2, 0, 7); g.fill();
    if (!al) {
      g.strokeStyle = 'rgba(255,200,80,.35)'; g.beginPath(); g.moveTo(x, z);
      g.arc(x, z, 18, Math.PI / 2 - gd.face - 0.8, Math.PI / 2 - gd.face + 0.8); g.closePath(); g.stroke();
    }
  }
  let [ox, oz] = toM(Game.objPos.x, Game.objPos.z);
  const od = Math.hypot(ox, oz); if (od > 88) { ox *= 88 / od; oz *= 88 / od; }
  const mc = Game.mission ? '#' + Game.mission.color.toString(16).padStart(6, '0') : '#4fd1c5';
  g.save(); g.translate(ox, oz); g.rotate(Math.PI / 4); g.fillStyle = mc; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.fillRect(-5, -5, 10, 10); g.strokeRect(-5, -5, 10, 10); g.restore();
  g.restore();
  g.save(); g.translate(100, 100); g.rotate(Math.PI - Player.face + Cam.yaw);
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
}

// ---------- Koko kartta (N): pikamatka synkronoituihin torneihin ----------
const FullMap = {
  open: false, px: 720,
  toggle() { this.open ? this.close() : this.show(); },
  show() {
    if (!Game.started || Game.ended || Player.state === 'dead') return;
    this.open = true; Game.menu = true; Input.keys = {};
    if (document.exitPointerLock) document.exitPointerLock();
    document.getElementById('fullmap').style.display = 'flex'; this.render();
  },
  close() { this.open = false; Game.menu = false; document.getElementById('fullmap').style.display = 'none'; Game.tryLock(); },
  w2c(x, z) { return [(x - MM.X0) / MM.W * this.px, (z - MM.X0) / MM.W * this.px]; },
  render() {
    const cv = document.getElementById('fmcanvas'); cv.width = cv.height = this.px; const g = cv.getContext('2d');
    g.drawImage(MM.off, 0, 0, this.px, this.px);
    g.font = '13px Cinzel, Georgia, serif'; g.textAlign = 'center';
    const lab = (x, z, t, col) => { const [cx, cy] = this.w2c(x, z); g.fillStyle = 'rgba(0,0,0,.7)'; g.fillText(t, cx + 1, cy + 1); g.fillStyle = col || '#f0e6c8'; g.fillText(t, cx, cy); };
    lab(MAPD.city.x, MAPD.city.z - 70, 'HALLAVUORI'); lab(MAPD.fort.x, MAPD.fort.z - 52, 'KORPILINNA'); lab(MAPD.village.x, MAPD.village.z + 66, 'KALASTAJAKYLÄ');
    lab(MAPD.farm.x, MAPD.farm.z + 56, 'TUULIMYLLY'); lab(MAPD.camp.x, MAPD.camp.z + 42, 'ROSVOLEIRI', '#ff9a8a'); lab(MAPD.ruins.x, MAPD.ruins.z + 22, 'RAUNIOT', '#cfd6ff'); lab(222, 30, 'JÄRVI', '#bfe0ff');
    this.pts = [];
    for (const p of World.perches) {
      const [cx, cy] = this.w2c(p.x, p.z), on = Game.syncedPerches[p.name];
      g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4); g.fillStyle = on ? '#4fd1c5' : '#555'; g.strokeStyle = '#000'; g.lineWidth = 2; g.fillRect(-7, -7, 14, 14); g.strokeRect(-7, -7, 14, 14); g.restore();
      g.fillStyle = on ? '#bff' : '#999'; g.fillText(p.name, cx, cy - 12); this.pts.push({ cx, cy, p, on });
    }
    const [ox, oz] = this.w2c(Game.objPos.x, Game.objPos.z), mc = Game.mission ? '#' + Game.mission.color.toString(16).padStart(6, '0') : '#fff';
    g.fillStyle = mc; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(ox, oz, 7, 0, 7); g.fill(); g.stroke();
    const [px, pz] = this.w2c(Player.pos.x, Player.pos.z);
    g.save(); g.translate(px, pz); g.rotate(-Player.face + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke(); g.restore();
  },
  click(e) {
    const cv = document.getElementById('fmcanvas'), r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * this.px, y = (e.clientY - r.top) / r.height * this.px;
    for (const q of this.pts || []) if (Math.hypot(q.cx - x, q.cy - y) < 16) {
      if (!q.on) { Game.toast('Synkronoi torni ensin', 'warn'); return; }
      if (Guards.anyAlert()) { Game.toast('Pikamatka ei onnistu hälytyksen aikana', 'warn'); return; }
      const off = { s: [0, 12], n: [0, -12], e: [12, 0], w: [-12, 0] }[q.p.dir] || [0, 12];
      const tx = q.p.cx + off[0], tz = q.p.cz + off[1];
      this.close(); Player.reset(new V3(tx, groundH(tx, tz), tz), Math.PI); Game.checkpoint.set(tx, groundH(tx, tz), tz);
      Game.toast(`Pikamatka: ${q.p.name}`, 'good'); Sfx.sync(); return;
    }
  },
};

// ---------- Syötteet ----------
function setupInput() {
  const canvas = document.getElementById('c');
  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    Input.keys[e.code] = true; Input.pressed[e.code] = true;
    if (e.code === 'KeyH') document.getElementById('help').classList.toggle('show');
    if (e.code === 'KeyN' && Game.started && !Game.paused && !Inv.open) FullMap.toggle();
    else if (e.code === 'Escape' && FullMap.open) FullMap.close();
    if ((e.code === 'Tab' || e.code === 'KeyI') && Game.started && !Game.paused && !FullMap.open) Inv.toggle();
    else if (e.code === 'Escape' && Inv.open) Inv.close();
    if (e.code === 'KeyR' && Game.started && !Game.paused && !Game.menu && Player.state !== 'dead') Loot.swapWeapon();
    if (e.code === 'KeyM') { Sfx.musicOn = !Sfx.musicOn; Game.toast(Sfx.musicOn ? 'Musiikki päällä' : 'Musiikki pois'); }
    if (e.code === 'KeyP' && Game.started && !Game.ended) Game.togglePause();
  });
  window.addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => { Input.keys = {}; });
  window.addEventListener('mousedown', (e) => {
    if (!Game.started || Game.paused) return;
    if (e.button === 0) { Input.ml = true; Input.mlp = true; } if (e.button === 2) { Input.mr = true; Input.mrp = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) Input.ml = false; if (e.button === 2) Input.mr = false; });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => {
    if (Game.paused || !Game.started) return;
    if (Game.locked) { Cam.lastInput = performance.now(); Cam.yaw -= e.movementX * 0.0023; Cam.pitch = clamp(Cam.pitch + e.movementY * 0.0023, -0.55, 1.3); }
    else if (e.buttons & 4) { Cam.yaw -= e.movementX * 0.004; Cam.pitch = clamp(Cam.pitch + e.movementY * 0.004, -0.55, 1.3); }
  });
  document.addEventListener('pointerlockchange', () => {
    Game.locked = document.pointerLockElement === canvas;
    if (Game.locked) Game.lockWorked = true;
    else if (Game.lockWorked && Game.started && !Game.ended && !Game.paused && !Game.menu) Game.setPause(true);
  });
  Inv.init();
  document.getElementById('fmcanvas').addEventListener('click', (e) => FullMap.click(e));
  document.getElementById('fmclose').addEventListener('click', () => FullMap.close());
  document.getElementById('start').addEventListener('click', () => Game.start());
  document.getElementById('pause').addEventListener('click', () => Game.setPause(false));
}
Game.start = function () {
  if (this.started) return;
  try { Sfx.init(); if (Sfx.ctx && Sfx.ctx.resume) Sfx.ctx.resume(); Sfx.musicStart(); } catch (e) { }
  this.started = true; this.paused = false;
  document.getElementById('start').style.display = 'none';
  this.tryLock(); this.hintT = 12;
};
Game.tryLock = function () {
  try { const p = document.getElementById('c').requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { }
};
Game.setPause = function (p) {
  if (this.ended) return;
  this.paused = p;
  document.getElementById('pause').style.display = p ? 'flex' : 'none';
  if (p) { if (document.exitPointerLock) document.exitPointerLock(); Input.keys = {}; } else { this.tryLock(); }
};
Game.togglePause = function () { this.setPause(!this.paused); };

// ---------- Vuorovaikutus ----------
function hayNear(P) {
  for (const h of World.hays) {
    const dx = Math.max(h.x0 - P.pos.x, 0, P.pos.x - h.x1), dz = Math.max(h.z0 - P.pos.z, 0, P.pos.z - h.z1);
    if (Math.hypot(dx, dz) < 1.4 && P.pos.y < h.y1 + 0.3) return h;
  }
  return null;
}
function interact() {
  const P = Player;
  if (P.state === 'dead' || P.state === 'hidden' || P.state === 'kill' || P.state === 'mantle') return;
  if (P.tryAssassinate()) return;
  const per = P.nearPerch();
  if (per && !Game.syncedPerches[per.name]) { Game.sync(per); return; }
  const ch = Loot.nearChest(P); if (ch && (P.state === 'ground' || P.state === 'climb')) { Loot.openChest(ch); return; }
  if (P.state === 'ground') { const h = hayNear(P); if (h) { P.enterHide(h); return; } }
}

function computePrompt() {
  const P = Player; let txt = '';
  if (P.state === 'hidden') txt = 'Liiku tai paina E poistuaksesi';
  else if (P.state !== 'dead') {
    const per = P.nearPerch();
    if (per && !Game.syncedPerches[per.name]) txt = '[E] Synkronoi';
    else if (per) txt = '[Välilyönti] Uskon loikka';
    if (!txt) {
      const air = P.state === 'air' && P.vel.y < -1;
      for (const g of Guards.list) {
        if (g.dead) continue;
        const dh = Math.hypot(g.pos.x - P.pos.x, g.pos.z - P.pos.z), dy = P.pos.y - g.pos.y;
        if (air && dh < P.stats.ass && dy > 0.6 && dy < 10) { txt = g.isTarget ? '[E] Ilmasalamurha: kohde' : '[E] Ilmasalamurha'; break; }
        if (!air && (P.state === 'ground' || P.state === 'climb') && dh < P.stats.ass && Math.abs(dy) < 1.5 && g.canAssassinate()) { txt = g.isTarget ? '[E] Eliminoi kohde' : '[E] Salamurha'; break; }
      }
    }
    if (!txt && (P.state === 'ground' || P.state === 'climb')) { const ch = Loot.nearChest(P); if (ch) txt = '[E] Avaa arkku'; }
    if (!txt && P.state === 'ground' && hayNear(P)) txt = '[E] Piiloudu heinäkasaan';
  }
  const el = document.getElementById('prompt');
  if (txt) { el.textContent = txt; el.style.display = 'block'; } else el.style.display = 'none';
}

function hintText() {
  const P = Player, m = Game.mission;
  if (Game.hintT > 0) return 'WASD liiku · Shift (pidä) = vapaa juoksu · Välilyönti = hyppy · C = liuku · H = kaikki ohjaimet';
  if (P.state === 'climb') return P.hang ? 'Reunalla: W = nouse ylös · Välilyönti + taakse = loikka pois · C = pudota' : 'W = kiipeä · A/D = sivulle · Välilyönti = loikka · C = irrota';
  if (P.state === 'wallrun') return 'Seinäjuoksu! Välilyönti = potkaise irti';
  if (P.state === 'air' && (P.sprint || K('Space'))) return 'Pidä Shift tai Välilyönti: tartut reunoihin ja seiniin · osu maahan liikkuen = rullaus';
  if (P.slideT > 0) return 'Liuku! Välilyönti = hyppy liu’usta';
  if (P.groundBox && P.groundBox.rope && P.state === 'ground') return 'Tasapainoile köydellä — Välilyönti = hyppää';
  if (m && m.type === 'race') {
    const R = Game.race;
    if (!R.running) return 'Kisa alkaa ensimmäisestä renkaasta';
    return `Rengas ${R.i + 1} / ${R.rings.length} · aikaa jäljellä ${Math.max(0, R.limit - R.t).toFixed(0)} s`;
  }
  return '';
}

function updateHUD(dt) {
  const P = Player;
  document.getElementById('hpbar').style.width = clamp(P.hp / P.maxHp * 100, 0, 100) + '%';
  document.getElementById('fcount').textContent = Game.featherCount;
  const st = document.getElementById('status');
  const al = Guards.anyAlert(), su = Guards.anySuspicious() || Guards.list.some(g => !g.dead && g.sus > 0.35);
  st.className = al ? 's2' : (su ? 's1' : 's0');
  st.textContent = al ? 'Etsintä' : (su ? 'Epäilyttävä' : (P.state === 'hidden' ? 'Piilossa' : 'Näkymätön'));
  if (al && !Game.wanted) { Game.stats.detected++; Game.toast('Sinut on havaittu!', 'warn'); }
  if (!al && Game.wanted) Game.toast('Hukkasit vartijat', 'good');
  Game.wanted = al;
  const dist = Math.round(Math.hypot(Game.objPos.x - P.pos.x, Game.objPos.z - P.pos.z));
  document.getElementById('objd').textContent = (Game.objd || '') + (dist > 2 ? `  [${dist} m]` : '');
  computePrompt();
  document.getElementById('hint').textContent = hintText();
  Game.hurtFlash = Math.max(0, Game.hurtFlash - dt * 2.5);
  const low = P.hp < 30 ? 0.25 + Math.sin(performance.now() / 180) * 0.1 : 0;
  document.getElementById('vig').style.opacity = Math.max(Game.hurtFlash, low);
  document.getElementById('eagle').style.opacity = Game.eagle ? 1 : 0;
  const spd = Math.hypot(P.vel.x, P.vel.y, P.vel.z);
  document.getElementById('speed').style.opacity = clamp((spd - 12) / 20, 0, 0.7);
  // varusteet
  const wp = Loot.find(Loot.equip.w1);
  const gn = document.getElementById('gearname');
  gn.textContent = wp ? `${Loot.icon(wp)} ${wp.name}${wp.upg ? ' +' + wp.upg : ''}` : '✊ Nyrkit'; gn.style.color = wp ? RAR[wp.rar].col : '#e9dfc9';
  const w2 = Loot.find(Loot.equip.w2);
  document.getElementById('gearsub').textContent = w2 ? `R: ${w2.name}` : '';
  document.getElementById('lvlnum').textContent = Loot.level; document.getElementById('pownum').textContent = Loot.charPower();
  document.getElementById('xpfill').style.width = (Loot.level >= 20 ? 100 : Loot.xp / Loot.need(Loot.level) * 100) + '%';
  document.getElementById('silv').textContent = Loot.silver; document.getElementById('iron').textContent = Loot.iron;
  document.getElementById('spbadge').style.display = Loot.sp > 0 ? 'block' : 'none';
  drawMinimap();
}

// ---------- Päivitys ----------
Game.update = function (dt) {
  const P = Player;
  this.stats.time += dt; this.hintT = Math.max(0, this.hintT - dt);
  const ar = 2.2 * dt;
  if (K('ArrowLeft') || K('ArrowRight') || K('ArrowUp') || K('ArrowDown')) Cam.lastInput = performance.now();
  if (K('ArrowLeft')) Cam.yaw += ar; if (K('ArrowRight')) Cam.yaw -= ar;
  if (K('ArrowUp')) Cam.pitch = clamp(Cam.pitch - ar * 0.7, -0.55, 1.3); if (K('ArrowDown')) Cam.pitch = clamp(Cam.pitch + ar * 0.7, -0.55, 1.3);
  this.eagle = K('KeyQ') && P.state !== 'dead';
  if (Input.pressed.KeyE) interact();
  Player.update(dt);
  Guards.update(dt);
  FX.update(dt);
  Loot.update(dt);
  // viimeisin turvallinen maapiste (tallennuspiste)
  this.lastGroundT -= dt;
  if (P.state === 'ground' && P.onGround && P.pos.y < 1.5 && !Guards.anyAlert() && this.lastGroundT <= 0) { this.lastGround.copy(P.pos); this.lastGroundT = 1.0; }
  if (this.lastGroundT < 0) this.lastGroundT = 0.0001;
  this.lockTarget = null;
  if (P.blocking) { const t = Guards.nearestEnemy(4); if (t && t.state === 'alert') this.lockTarget = Math.atan2(t.pos.x - P.pos.x, t.pos.z - P.pos.z); }
  for (const c of this.civs) {
    if (c.still) continue;
    c.t += c.dir * c.speed * dt / c.len;
    if (c.t > 1) { c.t = 1; c.dir = -1; } if (c.t < 0) { c.t = 0; c.dir = 1; }
    const x = lerp(c.a[0], c.b[0], c.t), z = lerp(c.a[1], c.b[1], c.t);
    c.m.position.set(x, Math.abs(Math.sin(performance.now() / 160 + c.len)) * 0.05, z);
    c.m.rotation.y = Math.atan2(c.b[0] - c.a[0], c.b[1] - c.a[1]) + (c.dir < 0 ? Math.PI : 0);
  }
  const t = performance.now() / 1000;
  World.feathers.forEach((f, i) => {
    const m = featherMeshes[i]; if (f.got) { m.visible = false; return; }
    m.rotation.y = t * 2 + i; m.position.y = f.y + Math.sin(t * 2 + i) * 0.15;
    if (Math.hypot(f.x - P.pos.x, f.z - P.pos.z) < 1.3 && Math.abs(f.y - (P.pos.y + 1)) < 1.6 && P.state !== 'dead' && P.state !== 'hidden') {
      f.got = true; this.featherCount++; Loot.addXp(20); Sfx.pickup(); FX.burst(f.x, f.y, f.z, 22, 3.5, [0.4, 0.9, 1], 0.2, 0.8, 0, 1, 0.3);
      this.toast(`Korpin sulka ${this.featherCount}/${World.feathers.length}`, 'good');
    }
  });
  // tehtävä-logiikka
  const m = this.mission;
  if (m) {
    if (m.type === 'race') this.updateRace(dt);
    else if (m.type === 'goto') { if (Math.hypot(P.pos.x - m.x, P.pos.z - m.z) < m.r && P.state !== 'dead') this.advance(); }
    else if (m.type === 'kill') { const tg = this.targets[m.target]; if (tg && !tg.dead) { this.objPos.set(tg.pos.x, 0, tg.pos.z); this.beam.position.set(tg.pos.x, 80, tg.pos.z); } }
    else if (m.type === 'escape' && P.state !== 'dead') {
      const z = World.zones.safe, inZ = Math.hypot(P.pos.x - z.x, P.pos.z - z.z) < z.r && P.pos.y < 3;
      if (inZ && !Guards.anyAlert()) { this.escapeT = (this.escapeT || 0) + dt; if (this.escapeT > 1.5) { this.win(); } }
      else this.escapeT = 0;
    }
  }
  if (GM.blades) GM.blades.rotation.z += dt * 0.35;
  // kamera
  Cam.update(dt, P);
  if (this.shake > 0) { camera.position.x += (Math.random() - .5) * this.shake; camera.position.y += (Math.random() - .5) * this.shake; this.shake = Math.max(0, this.shake - dt); }
  sun.target.position.set(P.pos.x, P.pos.y, P.pos.z);
  sun.position.set(P.pos.x + sunDir.x * 130, P.pos.y + sunDir.y * 130, P.pos.z + sunDir.z * 130);
  skyDome.position.copy(camera.position);
  if (this.beam) this.beam.material.opacity = (this.eagle ? 0.7 : 0.3) + Math.sin(t * 3) * 0.05;
  // äänet
  const spd = Math.hypot(P.vel.x, P.vel.y, P.vel.z);
  Sfx.setWind(P.pos.y, spd);
  const tgt = Guards.anyAlert() ? 1 : (Guards.anySuspicious() ? 0.4 : 0);
  this.tension = damp(this.tension, tgt, 1.5, dt);
  Sfx.musicTick(dt, this.tension);
  updateHUD(dt);
};

// ---------- Pääsilmukka ----------
function frame() {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, clock.getDelta());
  if (Game.slowT > 0) { Game.slowT -= rdt; Game.timeScale = Game.slowScale; } else Game.timeScale = damp(Game.timeScale, 1, 9, rdt);
  if (Game.started && !Game.paused && !Game.menu) {
    if (Game.hitStop > 0) Game.hitStop -= rdt;
    else { try { Game.update(rdt * Game.timeScale); } catch (e) { showErr(e); } }
  } else if (!Game.started) {
    const t = performance.now() / 6000;
    camera.position.set(Math.cos(t) * 40 + 45, 55, Math.sin(t) * 40 - 30); camera.lookAt(45, 20, -40);
    skyDome.position.copy(camera.position);
  }
  renderer.render(scene, camera);
  Input.pressed = {}; Input.mlp = false; Input.mrp = false;
}
function showErr(e) {
  const el = document.getElementById('err'); el.style.display = 'block'; el.textContent = 'Virhe: ' + (e && e.stack || e); console.error(e);
}

window.addEventListener('error', (e) => showErr(e.error || e.message));
try {
  clock = new THREE.Clock();
  setupScene();
  setupWorld();
  setupActors();
  setupInput();
  window.__game = { Game, Player, Guards, World, Cam, Nav, FX, Loot, Inv, FullMap, Terrain, GM, scene, camera, Input, renderer };
  frame();
} catch (e) { showErr(e); }
