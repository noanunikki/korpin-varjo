'use strict';
// =====================================================================
//  PELI: näkymä, syötteet, tehtävät, HUD, minikartta, pääsilmukka
// =====================================================================
const Game = {
  started: false, paused: true, ended: false, locked: false, lockWorked: false,
  stats: { kills: 0, leaps: 0, detected: 0, time: 0 },
  eagle: false, synced: false, stage: 0, checkpoint: new V3(0, 0, 112), checkpointFace: Math.PI,
  shake: 0, hurtFlash: 0, invuln: false, lockTarget: null, wanted: false, wantedT: 0, escapeT: 0,
  featherCount: 0, hintT: 0, civs: [], captain: null, objPos: new V3(), beam: null,

  toast(msg, kind) {
    const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = msg;
    const box = document.getElementById('toasts'); box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { el.style.transition = 'opacity .6s'; el.style.opacity = 0; setTimeout(() => el.remove(), 650); }, 2600);
  },
  nearestEnemy(r) { return Guards.nearestEnemy(r); },
  onAlert(g) { },
  onTargetKilled() {
    this.stage = 2; Guards.alertAt(this.captain.pos, 34, this.captain);
    this.setObjective('Pakene', 'Pääse piilopaikalle portin vieressä ja hukkaa vartijat.');
    this.setBeam(World.zones.safe.x, World.zones.safe.z, 0x4fe08a);
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
  setObjective(t, d) { document.getElementById('objm').textContent = t; this.objd = d; document.getElementById('objd').textContent = d || ''; },
  setBeam(x, z, color) {
    if (!this.beam) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 160, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      this.beam = m; Game.scene.add(m);
    }
    this.beam.material.color.setHex(color); this.beam.position.set(x, 80, z); this.objPos.set(x, 0, z);
  },
  sync(per) {
    this.synced = true; this.stage = 1; Sfx.sync();
    this.toast('Synkronointi valmis', 'good');
    this.checkpoint.set(per.cx, 0, per.cz + 12); this.checkpointFace = Math.PI;
    this.setObjective('Salamurhaa kapteeni Aldric', 'Hän on torilla julistuslavalla. Hiivi, kiipeä katoille tai tule ylhäältä.');
    this.captain.mark.visible = true;
    this.setBeam(this.captain.pos.x, this.captain.pos.z, 0xffcf3a);
  },
  win() {
    this.ended = true; this.paused = true;
    if (document.exitPointerLock) document.exitPointerLock();
    const t = Math.round(this.stats.time), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    const full = this.stats.detected === 0;
    document.getElementById('endsub').textContent = full ? 'TÄYSI SYNKRONOINTI – KUKAAN EI HUOMANNUT SINUA' : 'KAPTEENI ALDRIC ON KUOLLUT';
    document.getElementById('endstats').innerHTML =
      `<div class="stat">Aika: <b>${mm}:${ss}</b></div><div class="stat">Vartijat kaatuneet: <b>${this.stats.kills}</b></div>` +
      `<div class="stat">Havaituksi tulit: <b>${this.stats.detected}</b> kertaa</div><div class="stat">Uskon loikat: <b>${this.stats.leaps}</b></div>` +
      `<div class="stat">Korpin sulat: <b>${this.featherCount} / ${World.feathers.length}</b></div>`;
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
  scene = new THREE.Scene(); Game.scene = scene;
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
  // taivas
  const sg = new THREE.SphereGeometry(900, 24, 16);
  const cols = [], pos = sg.attributes.position, top = new THREE.Color(0x3f78c8), hor = new THREE.Color(0xd2e0ec);
  for (let i = 0; i < pos.count; i++) {
    const t = clamp(pos.getY(i) / 900, 0, 1), c = hor.clone().lerp(top, Math.pow(t, 0.55)); cols.push(c.r, c.g, c.b);
  }
  sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  skyDome = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(skyDome);
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(28, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff4c8, fog: false }));
  sunDisc.position.copy(sunDir).multiplyScalar(820); skyDome.add(sunDisc);
  // pilviä
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
  genCity();
  buildWorldMeshes(scene);
  // sulat
  const gm = new THREE.MeshBasicMaterial({ color: 0x66e0ff }), geo = new THREE.OctahedronGeometry(0.25);
  World.feathers.forEach(f => {
    const m = new THREE.Mesh(geo, gm); m.scale.set(0.5, 1.6, 0.15); m.position.set(f.x, f.y, f.z); scene.add(m); featherMeshes.push(m);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 20), new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    m.add(halo); halo.scale.set(2, 0.62, 6);
  });
  // minikartta
  buildMinimapBase();
}

function setupActors() {
  Player.init(scene);
  Guards.init(scene);
  Player.reset(new V3(0, 0, 112), Math.PI);
  const S = (o) => Guards.spawn(o);
  // kapteeni lavalla
  Game.captain = S({ type: 'captain', x: 0, y: 0.9, z: -17.2, face: 0 });
  S({ x: -3.5, z: -11.5, face: 0 }); S({ x: 3.5, z: -11.5, face: 0 });
  S({ x: -12, z: -4, route: [[-12, -4], [12, -4], [12, 8], [-12, 8]], wait: 2 });
  S({ x: 12, z: 8, route: [[12, 8], [-12, 8], [-12, -4], [12, -4]], wait: 2 });
  S({ type: 'archer', x: 14, z: 12, face: 3.5 });
  // kadut
  S({ x: -28, z: -28, route: [[-28, -28], [28, -28], [28, 28], [-28, 28]], wait: 1.5 });
  S({ x: 28, z: 28, route: [[28, 28], [-28, 28], [-28, -28], [28, -28]], wait: 1.5 });
  S({ x: -60, z: 87, route: [[-60, 87], [60, 87]], wait: 3 });
  S({ x: 60, z: -87, route: [[60, -87], [-60, -87]], wait: 3 });
  S({ x: 28, z: -80, route: [[28, -80], [28, -36]], wait: 3 });
  S({ x: -28, z: 36, route: [[-28, 36], [-28, 80]], wait: 3 });
  S({ x: 32, z: -28, route: [[32, -28], [74, -28]], wait: 3 });
  S({ type: 'archer', x: -31, z: -31, face: 0.8 });
  S({ type: 'archer', x: 31, z: 25, face: 3.9 });
  S({ x: 87, z: 40, route: [[87, 40], [87, -40]], wait: 3 });
  // kattovartijat
  for (const s of World.spawns) Guards.spawn(s);

  // siviilit
  const lines = [];
  for (const L of [-28, 28]) { lines.push([[L + rand2(-3, 3), -80], [L + rand2(-3, 3), 80]]); lines.push([[-80, L + rand2(-3, 3)], [80, L + rand2(-3, 3)]]); }
  for (let i = 0; i < 16; i++) {
    const l = lines[i % lines.length];
    const c = { m: makeCivilian(), a: l[0], b: l[1], t: Math.random(), dir: Math.random() < .5 ? 1 : -1, speed: 1.0 + Math.random() * 0.6 };
    c.len = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]); scene.add(c.m); Game.civs.push(c);
  }
  for (const [x, z] of [[-6, 6], [5, 7], [-12, 2], [12, 3], [-4, 11], [4, -9], [-13, -11], [13, -11]]) {
    const m = makeCivilian(); m.position.set(x, 0, z); m.rotation.y = Math.random() * 6; scene.add(m); Game.civs.push({ m, still: true });
  }
  Game.setObjective('Kiipeä katedraalin torniin', 'Seuraa sinistä valopylvästä. Pidä Shift pohjassa ja juokse seinää päin.');
  Game.setBeam(45, -32, 0x4fd1c5);
}
function rand2(a, b) { return a + Math.random() * (b - a); }

// ---------- Minikartta ----------
const MM = { S: 2, off: null };
function buildMinimapBase() {
  const S = MM.S, N = 230 * S;
  const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#2a2f3a'; g.fillRect(0, 0, N, N);
  g.fillStyle = '#33394a'; g.fillRect((-100 + 115) * S, (-100 + 115) * S, 200 * S, 200 * S);
  const rects = World.mapRects.slice().sort((a, b) => a[4] - b[4]);
  for (const r of rects) {
    const t = clamp(r[4] / 30, 0, 1), v = Math.floor(95 + t * 110);
    g.fillStyle = `rgb(${v},${v - 8},${v - 24})`;
    g.fillRect((r[0] + 115) * S, (r[1] + 115) * S, (r[2] - r[0]) * S, (r[3] - r[1]) * S);
  }
  g.fillStyle = '#6d8f9e'; g.beginPath(); g.arc(115 * S, 115 * S, 2.2 * S, 0, 7); g.fill();
  MM.off = c;
}
function drawMinimap() {
  const cv = document.getElementById('minimap'), g = cv.getContext('2d'), S = MM.S, P = Player;
  g.clearRect(0, 0, 200, 200);
  g.save(); g.beginPath(); g.arc(100, 100, 99, 0, 7); g.clip();
  g.fillStyle = '#1b1f28'; g.fillRect(0, 0, 200, 200);
  g.translate(100, 100); g.rotate(Cam.yaw);
  g.drawImage(MM.off, (-115 - P.pos.x) * S, (-115 - P.pos.z) * S);
  const toM = (x, z) => [(x - P.pos.x) * S, (z - P.pos.z) * S];
  // sulat
  g.fillStyle = '#66e0ff';
  for (const f of World.feathers) if (!f.got) { const d = Math.hypot(f.x - P.pos.x, f.z - P.pos.z); if (d < 28 || Game.synced && d < 50) { const [x, z] = toM(f.x, f.z); g.fillRect(x - 2, z - 2, 4, 4); } }
  // vartijat
  for (const gd of Guards.list) {
    if (gd.dead) continue;
    const d = Math.hypot(gd.pos.x - P.pos.x, gd.pos.z - P.pos.z);
    const al = gd.state === 'alert';
    if (!(al || (Game.synced && d < 45) || Game.eagle)) continue;
    const [x, z] = toM(gd.pos.x, gd.pos.z);
    g.fillStyle = gd.isTarget ? '#ffcf3a' : (al ? '#ff3a2a' : (gd.state === 'curious' ? '#ffd54a' : '#d85a4a'));
    g.beginPath(); g.arc(x, z, gd.isTarget ? 5 : 3.2, 0, 7); g.fill();
    if (!al && gd.state !== 'dead') {
      g.strokeStyle = 'rgba(255,200,80,.35)'; g.beginPath(); g.moveTo(x, z);
      g.arc(x, z, 18, Math.PI / 2 - gd.face - 0.8, Math.PI / 2 - gd.face + 0.8); g.closePath(); g.stroke();
    }
  }
  // tavoite
  let [ox, oz] = toM(Game.objPos.x, Game.objPos.z);
  const od = Math.hypot(ox, oz); if (od > 88) { ox *= 88 / od; oz *= 88 / od; }
  g.save(); g.translate(ox, oz); g.rotate(Math.PI / 4); g.fillStyle = Game.stage === 1 ? '#ffcf3a' : (Game.stage === 2 ? '#4fe08a' : '#4fd1c5'); g.strokeStyle = '#000'; g.lineWidth = 1.5; g.fillRect(-5, -5, 10, 10); g.strokeRect(-5, -5, 10, 10); g.restore();
  g.restore();
  // pelaaja
  g.save(); g.translate(100, 100); g.rotate(Math.PI - Player.face + Cam.yaw);
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
}

// ---------- Syötteet ----------
function setupInput() {
  const canvas = document.getElementById('c');
  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    Input.keys[e.code] = true; Input.pressed[e.code] = true;
    if (e.code === 'KeyH') document.getElementById('help').classList.toggle('show');
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
    else if (Game.lockWorked && Game.started && !Game.ended && !Game.paused) Game.setPause(true);
  });
  const go = () => { Game.start(); };
  document.getElementById('start').addEventListener('click', go);
  document.getElementById('pause').addEventListener('click', () => Game.setPause(false));
}
Game.start = function () {
  if (this.started) return;
  try { Sfx.init(); if (Sfx.ctx && Sfx.ctx.resume) Sfx.ctx.resume(); } catch (e) { }
  this.started = true; this.paused = false;
  document.getElementById('start').style.display = 'none';
  this.tryLock();
  this.hintT = 12;
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

// ---------- Päivitys ----------
function interact() {
  const P = Player;
  if (P.state === 'dead' || P.state === 'hidden' || P.state === 'kill' || P.state === 'mantle') return;
  if (P.tryAssassinate()) return;
  const per = P.nearPerch();
  if (per && !Game.synced && per.name === 'katedraali') { Game.sync(per); return; }
  if (per && !Game.synced) { Game.toast('Tämä ei ole synkronointipiste'); }
  if (P.state === 'ground') {
    for (const h of World.hays) {
      const dx = Math.max(h.x0 - P.pos.x, 0, P.pos.x - h.x1), dz = Math.max(h.z0 - P.pos.z, 0, P.pos.z - h.z1);
      if (Math.hypot(dx, dz) < 1.4 && P.pos.y < h.y1 + 0.3) { P.enterHide(h); return; }
    }
  }
}

function computePrompt() {
  const P = Player; let txt = '';
  if (P.state === 'hidden') txt = 'Liiku tai paina E poistuaksesi';
  else if (P.state === 'dead') txt = '';
  else {
    const per = P.nearPerch();
    if (per && per.name === 'katedraali' && !Game.synced) txt = '[E] Synkronoi';
    else if (per) txt = '[Välilyönti] Uskon loikka';
    if (!txt) {
      const air = P.state === 'air' && P.vel.y < -1;
      for (const g of Guards.list) {
        if (g.dead) continue;
        const dh = Math.hypot(g.pos.x - P.pos.x, g.pos.z - P.pos.z), dy = P.pos.y - g.pos.y;
        if (air && dh < 2.4 && dy > 0.6 && dy < 10) { txt = '[E] Ilmasalamurha'; break; }
        if (!air && (P.state === 'ground' || P.state === 'climb') && dh < 2.4 && Math.abs(dy) < 1.5 && g.canAssassinate()) { txt = g.isTarget ? '[E] Eliminoi kohde' : '[E] Salamurha'; break; }
      }
    }
    if (!txt && P.state === 'ground') {
      for (const h of World.hays) {
        const dx = Math.max(h.x0 - P.pos.x, 0, P.pos.x - h.x1), dz = Math.max(h.z0 - P.pos.z, 0, P.pos.z - h.z1);
        if (Math.hypot(dx, dz) < 1.4 && P.pos.y < h.y1 + 0.3) { txt = '[E] Piiloudu heinäkasaan'; break; }
      }
    }
  }
  const el = document.getElementById('prompt');
  if (txt) { el.textContent = txt; el.style.display = 'block'; } else el.style.display = 'none';
}

function hintText() {
  const P = Player;
  if (Game.hintT > 0) return 'WASD liiku · Shift (pidä) = vapaa juoksu · Välilyönti = hyppy · H = kaikki ohjaimet';
  if (P.state === 'climb') return P.hang ? 'Reunalla: W = nouse ylös · Välilyönti + taakse = loikka pois · C = pudota' : 'W = kiipeä · A/D = sivulle · Välilyönti = loikka · C = irrota';
  if (P.state === 'wallrun') return 'Seinäjuoksu! Välilyönti = potkaise irti';
  if (P.state === 'air' && (P.sprint || K('Space'))) return 'Pidä Shift tai Välilyönti: tartut reunoihin ja seiniin · osu maahan liikkuen = rullaus';
  if (P.slideT > 0) return 'Liuku! Välilyönti = hyppy liu’usta';
  if (P.groundBox && P.groundBox.rope && P.state === 'ground') return 'Tasapainoile köydellä — paina Välilyönti hypätäksesi';
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
  // tavoite
  const dist = Math.round(Math.hypot(Game.objPos.x - P.pos.x, Game.objPos.z - P.pos.z));
  document.getElementById('objd').textContent = (Game.objd || '') + (dist > 2 ? `  [${dist} m]` : '');
  computePrompt();
  const h = hintText(); document.getElementById('hint').textContent = h;
  Game.hurtFlash = Math.max(0, Game.hurtFlash - dt * 2.5);
  const low = P.hp < 30 ? 0.25 + Math.sin(performance.now() / 180) * 0.1 : 0;
  document.getElementById('vig').style.opacity = Math.max(Game.hurtFlash, low);
  document.getElementById('eagle').style.opacity = Game.eagle ? 1 : 0;
  drawMinimap();
}

Game.update = function (dt) {
  const P = Player;
  this.stats.time += dt; this.hintT = Math.max(0, this.hintT - dt);
  // kamera nuolilla
  const ar = 2.2 * dt;
  if (K('ArrowLeft') || K('ArrowRight') || K('ArrowUp') || K('ArrowDown')) Cam.lastInput = performance.now();
  if (K('ArrowLeft')) Cam.yaw += ar; if (K('ArrowRight')) Cam.yaw -= ar;
  if (K('ArrowUp')) Cam.pitch = clamp(Cam.pitch - ar * 0.7, -0.55, 1.3); if (K('ArrowDown')) Cam.pitch = clamp(Cam.pitch + ar * 0.7, -0.55, 1.3);
  this.eagle = K('KeyQ') && P.state !== 'dead';
  if (Input.pressed.KeyE) interact();
  Player.update(dt);
  Guards.update(dt);
  // lukitus lähimpään vartijaan torjuntaa varten
  this.lockTarget = null;
  if (P.blocking) { const t = Guards.nearestEnemy(4); if (t && t.state === 'alert') this.lockTarget = Math.atan2(t.pos.x - P.pos.x, t.pos.z - P.pos.z); }
  // siviilit
  for (const c of this.civs) {
    if (c.still) continue;
    c.t += c.dir * c.speed * dt / c.len;
    if (c.t > 1) { c.t = 1; c.dir = -1; } if (c.t < 0) { c.t = 0; c.dir = 1; }
    const x = lerp(c.a[0], c.b[0], c.t), z = lerp(c.a[1], c.b[1], c.t);
    c.m.position.set(x, Math.abs(Math.sin(performance.now() / 160 + c.len)) * 0.05, z);
    c.m.rotation.y = Math.atan2(c.b[0] - c.a[0], c.b[1] - c.a[1]) + (c.dir < 0 ? Math.PI : 0);
  }
  // sulat
  const t = performance.now() / 1000;
  World.feathers.forEach((f, i) => {
    const m = featherMeshes[i]; if (f.got) { m.visible = false; return; }
    m.rotation.y = t * 2 + i; m.position.y = f.y + Math.sin(t * 2 + i) * 0.15;
    if (Math.hypot(f.x - P.pos.x, f.z - P.pos.z) < 1.3 && Math.abs(f.y - (P.pos.y + 1)) < 1.6 && P.state !== 'dead' && P.state !== 'hidden') {
      f.got = true; this.featherCount++; Sfx.pickup(); this.toast(`Korpin sulka ${this.featherCount}/${World.feathers.length}`, 'good');
    }
  });
  // tehtävä: pako
  if (this.stage === 2 && P.state !== 'dead') {
    const z = World.zones.safe;
    if (Math.hypot(P.pos.x - z.x, P.pos.z - z.z) < z.r && P.pos.y < 3 && !Guards.anyAlert()) { this.escapeT += dt; if (this.escapeT > 1.5) { this.stage = 3; this.win(); } }
    else if (Math.hypot(P.pos.x - z.x, P.pos.z - z.z) < z.r && Guards.anyAlert()) { this.hintOverride = 'Hukkaa vartijat ennen kuin pääset piiloon'; }
    else this.escapeT = 0;
  }
  // kamera
  Cam.update(dt, P);
  if (this.shake > 0) { camera.position.x += (Math.random() - .5) * this.shake; camera.position.y += (Math.random() - .5) * this.shake; this.shake = Math.max(0, this.shake - dt); }
  // valot seuraavat
  sun.target.position.set(P.pos.x, P.pos.y, P.pos.z);
  sun.position.set(P.pos.x + sunDir.x * 130, P.pos.y + sunDir.y * 130, P.pos.z + sunDir.z * 130);
  skyDome.position.copy(camera.position);
  if (this.beam) { this.beam.material.opacity = (this.eagle ? 0.7 : 0.3) + Math.sin(t * 3) * 0.05; if (this.stage === 1 && this.captain && !this.captain.dead) { this.beam.position.set(this.captain.pos.x, 80, this.captain.pos.z); this.objPos.set(this.captain.pos.x, 0, this.captain.pos.z); } }
  Sfx.setWind(P.pos.y);
  updateHUD(dt);
};

// ---------- Pääsilmukka ----------
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  if (Game.started && !Game.paused) { try { Game.update(dt); } catch (e) { showErr(e); } }
  else if (!Game.started) { // pyöritä kameraa aloitusnäytöllä
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
  window.__game = { Game, Player, Guards, World, Cam, Nav, scene, camera, Input };
  frame();
} catch (e) { showErr(e); }
