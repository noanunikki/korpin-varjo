'use strict';
// =====================================================================
//  KARTTA "POHJANRANTA": maasto (korkeuskartta), järvi, tiet, metsä ja asutukset
//  Asutukset ovat tasanteita korkeudella 0, jolloin rakennuskoodi toimii sellaisenaan.
// =====================================================================
const MAPD = {
  city: { x: -150, z: 100 }, fort: { x: 60, z: -190 }, village: { x: 190, z: 115 }, farm: { x: 0, z: 0 },
  camp: { x: -170, z: -150 }, ruins: { x: 140, z: -85 }, start: { x: 0, z: 62 },
};
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hash2(ix, iz, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed), c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
const fbm = (x, z) => vnoise(x * 0.006, z * 0.006, 1) * 0.55 + vnoise(x * 0.013, z * 0.013, 2) * 0.3 + vnoise(x * 0.03, z * 0.03, 3) * 0.15;
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

const Terrain = {
  ready: false, N: 264, cell: 2.5, x0: -330, z0: -330, hs: null, water: -0.3,
  // tasaiset alueet (korkeus tasan 0)
  flat: [
    { t: 'r', x: MAPD.city.x, z: MAPD.city.z, hw: 114, hd: 114, bl: 55 },
    { t: 'r', x: MAPD.fort.x, z: MAPD.fort.z, hw: 52, hd: 48, bl: 40, dw: 0.55 },
    { t: 'r', x: MAPD.village.x, z: MAPD.village.z, hw: 64, hd: 52, bl: 40, dw: 0.5 },
    { t: 'c', x: MAPD.farm.x, z: MAPD.farm.z, r: 50, bl: 40, dw: 0.22 },
    { t: 'c', x: MAPD.camp.x, z: MAPD.camp.z, r: 34, bl: 35, dw: 0.65 },
  ],
  roads: [
    [[0, 0], [-20, 50], [-70, 120], [-130, 185], [-150, 215]],
    [[0, 0], [60, 40], [130, 85], [170, 115]],
    [[0, 0], [20, -60], [50, -110], [60, -135]],
    [[60, -135], [-40, -140], [-120, -150], [-170, -150]],
    [[190, 60], [150, -40], [100, -100], [60, -135]],
    [[0, 0], [0, 62], [0, 110]],
  ],
  lakes: [{ x: 222, z: 30, rx: 62, rz: 46 }],
  flatMask(x, z) {
    let m = 0;
    for (const f of this.flat) {
      let d;
      if (f.t === 'r') d = Math.hypot(Math.max(Math.abs(x - f.x) - f.hw, 0), Math.max(Math.abs(z - f.z) - f.hd, 0));
      else d = Math.max(0, Math.hypot(x - f.x, z - f.z) - f.r);
      m = Math.max(m, 1 - sstep(0, f.bl, d));
    }
    return m;
  },
  roadMask(x, z) {
    let best = 1e9;
    for (const r of this.roads) for (let i = 0; i < r.length - 1; i++) best = Math.min(best, segDist(x, z, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]));
    return best;
  },
  raw(x, z) {
    const n = fbm(x, z);
    let hill = Math.max(0, n - 0.38) * 80;
    const r = Math.hypot(x, z); hill += sstep(235, 312, r) * 110;
    let m = this.flatMask(x, z);
    const rd = this.roadMask(x, z); m = Math.max(m, 1 - sstep(0, 26, Math.max(0, rd - 4.5)));
    for (const l of this.lakes) {
      const d = Math.hypot((x - l.x) / l.rx, (z - l.z) / l.rz);
      hill *= sstep(0.95, 1.9, d);
    }
    let h = hill * (1 - m);
    for (const l of this.lakes) {
      const d = Math.hypot((x - l.x) / l.rx, (z - l.z) / l.rz);
      const carve = 1 - sstep(0.55, 1.12, d);
      h = lerp(h, -1.45, carve * (1 - m));
    }
    return h;
  },
  build() {
    const N = this.N, n1 = N + 1; this.hs = new Float32Array(n1 * n1);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) this.hs[j * n1 + i] = this.raw(this.x0 + i * this.cell, this.z0 + j * this.cell);
    this.ready = true;
  },
  h(x, z) {
    const N = this.N, n1 = N + 1, hs = this.hs;
    let gx = (x - this.x0) / this.cell, gz = (z - this.z0) / this.cell;
    gx = clamp(gx, 0, N - 0.0001); gz = clamp(gz, 0, N - 0.0001);
    const i = gx | 0, j = gz | 0, fx = gx - i, fz = gz - j;
    const h00 = hs[j * n1 + i], h10 = hs[j * n1 + i + 1], h01 = hs[(j + 1) * n1 + i], h11 = hs[(j + 1) * n1 + i + 1];
    if (fz >= fx) return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
    return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
  },
  slope(x, z) { const d = 1.2; return Math.hypot(this.h(x + d, z) - this.h(x - d, z), this.h(x, z + d) - this.h(x, z - d)) / (2 * d); },
  kind(x, z) {
    if (this.h(x, z) < this.water - 0.05) return 'water';
    const c = MAPD.city; if (Math.abs(x - c.x) < 108 && Math.abs(z - c.z) < 108) return 'stone';
    return this.roadMask(x, z) < 5 ? 'stone' : 'grass';
  },
  color(x, z, h) {
    const sl = this.slope(x, z), nz = vnoise(x * 0.09, z * 0.09, 9), nz2 = vnoise(x * 0.4, z * 0.4, 11);
    let c = [lerp(0.30, 0.38, nz), lerp(0.45, 0.55, nz), lerp(0.2, 0.26, nz)];
    if (h > 14) { const t = sstep(14, 40, h); c = [lerp(c[0], 0.42, t), lerp(c[1], 0.45, t), lerp(c[2], 0.3, t)]; }
    if (h < this.water + 0.7) { const t = sstep(this.water + 0.7, this.water - 0.2, h); c = [lerp(c[0], 0.72, t), lerp(c[1], 0.66, t), lerp(c[2], 0.46, t)]; }
    if (h < this.water - 0.2) { const t = sstep(this.water - 0.2, this.water - 1.2, h); c = [lerp(c[0], 0.42, t), lerp(c[1], 0.4, t), lerp(c[2], 0.34, t)]; }
    const rk = sstep(0.42, 0.78, sl); c = [lerp(c[0], 0.5, rk), lerp(c[1], 0.5, rk), lerp(c[2], 0.52, rk)];
    if (h > 46) { const t = sstep(46, 62, h); c = [lerp(c[0], 0.95, t), lerp(c[1], 0.96, t), lerp(c[2], 0.98, t)]; }
    // tiet ja asutusten maa: multa
    const rd = this.roadMask(x, z), road = 1 - sstep(2.5, 6, rd);
    let dirt = road * 0.75;
    for (const f of this.flat) {
      if (f === this.flat[0]) continue;
      let d; if (f.t === 'r') d = Math.hypot(Math.max(Math.abs(x - f.x) - f.hw, 0), Math.max(Math.abs(z - f.z) - f.hd, 0)); else d = Math.max(0, Math.hypot(x - f.x, z - f.z) - f.r);
      dirt = Math.max(dirt, (1 - sstep(0, 6, d)) * (f.dw || 0.5));
    }
    if (h < this.water + 0.3) dirt *= 0.2;
    c = [lerp(c[0], 0.5, dirt), lerp(c[1], 0.4, dirt), lerp(c[2], 0.28, dirt)];
    const b = 0.94 + nz2 * 0.12; return [c[0] * b, c[1] * b, c[2] * b];
  },
  mesh() {
    const N = this.N, n1 = N + 1, pos = new Float32Array(n1 * n1 * 3), col = new Float32Array(n1 * n1 * 3), idx = new Uint32Array(N * N * 6);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const k = (j * n1 + i), x = this.x0 + i * this.cell, z = this.z0 + j * this.cell, h = this.hs[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const c = this.color(x, z, h); col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
    }
    let p = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * n1 + i, b = (j + 1) * n1 + i, c = (j + 1) * n1 + i + 1, e = j * n1 + i + 1;
      idx[p++] = a; idx[p++] = b; idx[p++] = c; idx[p++] = a; idx[p++] = c; idx[p++] = e;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.receiveShadow = true; return m;
  },
};

// ---------- Apuja asutusten generointiin ----------
function withOffset(ox, oz, fn) {
  const m = { mr: World.mapRects.length, sp: World.spawns.length, tr: World.trees.length };
  World.off = { x: ox, z: oz }; fn(); World.off = { x: 0, z: 0 };
  for (let i = m.mr; i < World.mapRects.length; i++) { const r = World.mapRects[i]; r[0] += ox; r[2] += ox; r[1] += oz; r[3] += oz; }
  for (let i = m.sp; i < World.spawns.length; i++) { const s = World.spawns[i]; s.x += ox; s.z += oz; if (s.route) s.route = s.route.map(p => [p[0] + ox, p[1] + oz]); }
  for (let i = m.tr; i < World.trees.length; i++) { const t = World.trees[i]; t[0] += ox; t[1] += oz; }
  for (const k in World.blockB) for (const b of World.blockB[k]) if (!b._abs) {
    b.x0 += ox; b.x1 += ox; b.z0 += oz; b.z1 += oz;
    if (b.upper) { b.upper.x0 += ox; b.upper.x1 += ox; b.upper.z0 += oz; b.upper.z1 += oz; }
    b._abs = true;
  }
}
const NOEDGE = () => ({ n: false, s: false, w: false, e: false });
function stoneSeg(x0, z0, x1, z1, h) {
  vb('stone', x0, 0, z0, x1, h, z1, [.95, .93, .9], rng() * 4);
  addCol(x0, 0, z0, x1, h, z1, { bld: true, wall: true });
  World.mapRects.push([x0, z0, x1, z1, h]);
}
function woodBox(x0, y0, z0, x1, y1, z1, col, solid) {
  vb('wood', x0, y0, z0, x1, y1, z1, col || [.6, .45, .32], rng() * 3);
  if (solid !== false) addCol(x0, y0, z0, x1, y1, z1, { prop: true });
}

// ---------- Linnoitus ----------
function genFort() {
  _rng = mulberry32(555);
  const list = World.blockB['fort'] = [];
  const HW = 40, HD = 36, T = 3, H = 11;
  stoneSeg(-HW, -HD, HW, -HD + T, H);
  stoneSeg(-HW, HD - T, -4, HD, H); stoneSeg(4, HD - T, HW, HD, H);
  stoneSeg(-HW, -HD + T, -HW + T, HD - T, H); stoneSeg(HW - T, -HD + T, HW, HD - T, H);
  for (const [x, z] of [[-HW, -HD], [HW - 8, -HD], [-HW, HD - 8], [HW - 8, HD - 8]]) stoneSeg(x, z, x + 8, z + 8, 16);
  stoneSeg(-12, HD - 6, -4, HD, 15); stoneSeg(4, HD - 6, 12, HD, 15);
  vb('stone', -4, 9.5, HD - 5, 4, 11, HD, [.9, .88, .84]); addCol(-4, 9.5, HD - 5, 4, 11, HD, { bld: true });
  const keep = makeLeapTower(-5, -30, 5, -19, 30, 's', 'linnan torni');
  GM.fortKeep = { x: keep.cx + World.off.x, y: keep.yT, z: keep.cz + World.off.z };
  makeBuilding(-36, -12, -20, 4, 8, NOEDGE(), list); makeBuilding(20, -12, 36, 4, 9, NOEDGE(), list);
  makeBuilding(-36, 14, -22, 30, 6, NOEDGE(), list, { noProps: true }); makeBuilding(22, 14, 36, 30, 7, NOEDGE(), list, { noProps: true });
  vb('stone', 10, 0, 16, 12.4, 1.0, 18.4, [.85, .85, .8]); addCol(10, 0, 16, 12.4, 1.0, 18.4, { prop: true });
  for (let i = 0; i < 6; i++) { if (rng() < .5) makeCrate(rand(-16, 16), 0, rand(8, 24)); else makeBarrel(rand(-16, 16), 0, rand(8, 24)); }
  makeHay(-14, 20, 3.4, 3.0);
  // liput
  for (const x of [-8, 8]) { vb('wood', x - .1, 0, HD - 1.6, x + .1, 8, HD - 1.4, [.4, .3, .2]); vb('cloth', x + .1, 5, HD - 1.55, x + 2.1, 7.6, HD - 1.5, [.15, .15, .2]); }
}

// ---------- Kalastajakylä ----------
function genVillage() {
  _rng = mulberry32(321);
  const list = World.blockB['village'] = [];
  const cols = [-48, -27, -6, 15, 36], rows = [-18, 2, 22, 42];
  for (let ci = 0; ci < cols.length; ci++) for (let ri = 0; ri < rows.length; ri++) {
    if (ci === 2 && ri === 1) continue;
    if (rng() < 0.15) continue;
    const cx = cols[ci] + rand(-3, 3), cz = rows[ri] + rand(-3, 3), w = rand(7, 10), d = rand(7, 10), h = pick([5, 6, 7, 8]);
    makeBuilding(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, h, NOEDGE(), list);
  }
  const hall = makeBuilding(-13, -46, 13, -35, 9.5, NOEDGE(), list, { noProps: true }); hall.guardRoof = true;
  GM.hall = { x: World.off.x, z: World.off.z - 40.5, h: 9.5 };
  vb('stone', -1.6, 0, -1.6, 1.6, 0.9, 1.6, [.85, .85, .8]); addCol(-1.6, 0, -1.6, 1.6, 0.9, 1.6, { prop: true });
  const tw = makeLeapTower(44, -4, 51, 3, 20, 'w', 'vartiotorni');
  // laiturit
  for (const x of [-22, -4, 18]) { makeBeam(x - 1.2, 0.35, -52, x + 1.2, -72, 2.4); for (let z = -54; z > -72; z -= 4) { vb('wood', x - 1.1, -1.2, z - .1, x - .9, 0.2, z + .1, [.35, .27, .2]); vb('wood', x + .9, -1.2, z - .1, x + 1.1, 0.2, z + .1, [.35, .27, .2]); } }
  // veneet
  for (const [bx, bz] of [[-14, -62], [8, -66]]) { woodBox(bx - 1.2, -0.7, bz - 2.4, bx + 1.2, 0.3, bz + 2.4, [.55, .4, .28], false); }
  for (const [hx, hz] of [[-30, 28], [20, 8], [4, 48]]) makeHay(hx, hz, 3.4, 3.0);
  for (let i = 0; i < 14; i++) { const x = rand(-55, 55), z = rand(-30, 48); if (World.colliders.some(c => c.bld && x + World.off.x > c.x0 - 2 && x + World.off.x < c.x1 + 2 && z + World.off.z > c.z0 - 2 && z + World.off.z < c.z1 + 2)) continue; if (rng() < .5) makeBarrel(x, 0, z); else makeCrate(x, 0, z); }
  GM.village = { x: World.off.x, z: World.off.z };
}

// ---------- Tuulimylly ja maatila ----------
function genFarm() {
  _rng = mulberry32(88);
  const list = World.blockB['farm'] = [];
  const mill = makeLeapTower(-3.5, -12, 3.5, -5, 18, 's', 'tuulimylly');
  GM.mill = { x: mill.cx + World.off.x, y: 11.5, z: -5 + 0.9 + World.off.z };
  makeBuilding(10, -10, 22, 0, 6.5, NOEDGE(), list, { noProps: true });
  makeBuilding(-32, -8, -18, 10, 8.5, NOEDGE(), list, { noProps: true });
  for (const [hx, hz] of [[-26, 18], [-20, 24], [14, 14], [26, 12]]) makeHay(hx, hz, 3.4, 3.0);
  // aidat (matalia, hypättäviä)
  const wallSeg = (a, b, c, d) => { vb('stone', a, 0, b, c, 1.1, d, [.9, .88, .8], rng() * 3); addCol(a, 0, b, c, 1.1, d, { prop: true }); };
  wallSeg(-36, 14, 4, 14.5); wallSeg(-36, 30, 4, 30.5); wallSeg(-36, 14, -35.5, 30.5); wallSeg(3.5, 14, 4, 30.5);
  for (let i = 0; i < 8; i++) { if (rng() < .5) makeCrate(rand(-30, 16), 0, rand(-18, -14)); else makeBarrel(rand(-30, 16), 0, rand(-4, 14)); }
  // pellot (pelkkää ilmettä)
  for (let k = 0; k < 6; k++) vb('hay', 28, 0, -30 + k * 5.5, 44, 0.35, -26 + k * 5.5, [.75, .85, .5]);
  GM.farm = { x: World.off.x, z: World.off.z };
}

// ---------- Rosvoleiri ----------
function genCamp() {
  _rng = mulberry32(404);
  const list = World.blockB['camp'] = [];
  for (const [x, z, r] of [[-12, -8, 0], [8, -12, 0.5], [14, 6, 0], [-14, 10, 0.5], [0, 16, 0], [-4, -18, 0]]) {
    const col = pick([[.8, .4, .3], [.5, .55, .7], [.75, .7, .5]]);
    vb('cloth', x - 1.8, 0, z - 1.6, x + 1.8, 2.3, z + 1.6, col); addCol(x - 1.8, 0, z - 1.6, x + 1.8, 2.3, z + 1.6, { prop: true });
  }
  vb('flat', -0.6, 0, -0.6, 0.6, 0.3, 0.6, [1, .55, .15]); vb('stone', -1.2, 0, -1.2, 1.2, 0.25, 1.2, [.5, .5, .5]);
  // vartiotorni
  woodBox(-22, 0, -22, -17, 9, -17, [.55, .42, .3]);
  makeBeam(-22, 9, -17.5, -17, -13.5, 2); // jatke
  for (let i = 0; i < 6; i++) makeCrate(rand(-10, 10), 0, rand(-4, 4));
  makeHay(18, -16, 3.4, 3.0);
  // paaluaita
  for (let a = 0; a < 20; a++) { const ang = a / 20 * Math.PI * 2; if (a % 5 === 0) continue; const x = Math.cos(ang) * 28, z = Math.sin(ang) * 28; vb('wood', x - .35, 0, z - .35, x + .35, 3.2, z + .35, [.45, .33, .22]); addCol(x - .35, 0, z - .35, x + .35, 3.2, z + .35, { prop: true }); }
  GM.camp = { x: World.off.x, z: World.off.z };
}

// ---------- Rauniot (rinteellä, koordinaatit absoluuttiset) ----------
function genRuins() {
  _rng = mulberry32(606);
  const cx = MAPD.ruins.x, cz = MAPD.ruins.z; World.off = { x: 0, z: 0 };
  const base = Terrain.h(cx, cz);
  for (let a = 0; a < 9; a++) {
    const ang = a / 9 * Math.PI * 2, x = cx + Math.cos(ang) * 11, z = cz + Math.sin(ang) * 11;
    if (a === 3) continue;
    const g = Terrain.h(x, z), hh = (g - base) + rand(2, 5.5);
    const x0 = x - 2.6, x1 = x + 2.6, z0 = z - 1.0, z1 = z + 1.0;
    const lo = Math.min(Terrain.h(x0, z0), Terrain.h(x1, z1), g) - 1.5, top = base + Math.max(hh, 1.5);
    vb('stone', x0, lo, z0, x1, top, z1, [.85, .85, .8], rng() * 3); addCol(x0, lo, z0, x1, top, z1, { bld: true });
  }
  const tl = base - 1.5, th = base + 9;
  vb('stone', cx - 2.5, tl, cz - 2.5, cx + 2.5, th, cz + 2.5, [.9, .9, .85]); addCol(cx - 2.5, tl, cz - 2.5, cx + 2.5, th, cz + 2.5, { bld: true });
  GM.ruins = { x: cx, y: base, z: cz, top: th };
}

// ---------- Metsä ----------
function scatterTrees() {
  _rng = mulberry32(2024);
  const out = []; let tries = 0;
  while (out.length < 1500 && tries++ < 40000) {
    const x = (rng() * 2 - 1) * 300, z = (rng() * 2 - 1) * 300;
    if (Math.hypot(x, z) > 296) continue;
    if (Terrain.flatMask(x, z) > 0.03) continue;
    if (Terrain.roadMask(x, z) < 11) continue;
    const h = Terrain.h(x, z); if (h < Terrain.water + 0.5 || h > 46) continue;
    if (vnoise(x * 0.018, z * 0.018, 7) < 0.34 && rng() > 0.1) continue;
    if (Terrain.slope(x, z) > 0.55) continue;
    if (Math.hypot(x - MAPD.ruins.x, z - MAPD.ruins.z) < 18) continue;
    if (out.some(t => (t.x - x) * (t.x - x) + (t.z - z) * (t.z - z) < 9)) continue;
    out.push({ x, z, h, s: rand(0.85, 1.7), decid: rng() < 0.3 });
  }
  for (const t of out) addCol(t.x - 0.4, t.h - 1.5, t.z - 0.4, t.x + 0.4, t.h + 5, t.z + 0.4, { tree: true, noClimb: true, prop: true });
  return out;
}

// ---------- Kartan rakennus ----------
const GM = { feathers: [], chestSpots: [], trees: [], zonesList: [] };
function buildMap(scene) {
  initBatches();
  Terrain.build();
  withOffset(MAPD.city.x, MAPD.city.z, () => genCityBody(9091));
  withOffset(MAPD.fort.x, MAPD.fort.z, genFort);
  withOffset(MAPD.village.x, MAPD.village.z, genVillage);
  withOffset(MAPD.farm.x, MAPD.farm.z, genFarm);
  withOffset(MAPD.camp.x, MAPD.camp.z, genCamp);
  genRuins();
  GM.trees = scatterTrees();
  World.zones.safe = { x: MAPD.farm.x - 23, z: MAPD.farm.z + 20, r: 4 };
  makeHay(MAPD.farm.x - 27, MAPD.farm.z + 22, 3.4, 3.0);
  // sulat
  const F = GM.feathers;
  for (const p of World.perches) F.push([p.cx, p.yT + 0.9, p.cz + 1.6]);
  const tall = []; for (const k in World.blockB) for (const b of World.blockB[k]) if (b.h >= 12 && !b.guardRoof && !b.tower) tall.push(b);
  tall.sort((a, b) => b.h - a.h);
  for (let i = 0; i < Math.min(5, tall.length); i++) { const b = tall[i]; F.push([b.x0 + 1.6, b.h + 0.9, b.z0 + 1.6]); }
  F.push([MAPD.ruins.x, GM.ruins.top + 0.9, MAPD.ruins.z + 0]);
  // huiput
  const peaks = [];
  for (let x = -250; x <= 250; x += 8) for (let z = -250; z <= 250; z += 8) {
    const h = Terrain.h(x, z); if (h < 24 || Terrain.slope(x, z) > 0.5) continue;
    let isMax = true; for (const [dx, dz] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) if (Terrain.h(x + dx, z + dz) > h) { isMax = false; break; }
    if (isMax) peaks.push([x, z, h]);
  }
  peaks.sort((a, b) => b[2] - a[2]); const used = [];
  for (const p of peaks) { if (used.length >= 3) break; if (used.some(u => Math.hypot(u[0] - p[0], u[1] - p[1]) < 90)) continue; used.push(p); F.push([p[0], p[2] + 1.2, p[1]]); }
  for (const f of F) World.feathers.push({ x: f[0], y: f[1], z: f[2], got: false });
  // arkkupaikat erikoiskohteissa
  GM.chestSpots.push({ x: MAPD.ruins.x + 3, y: GM.ruins.y, z: MAPD.ruins.z + 3.5, tier: 2, id: 'rauniot' });
  GM.chestSpots.push({ x: MAPD.camp.x + 4, y: 0, z: MAPD.camp.z + 4, tier: 2, id: 'leiri' });
  Nav.build();
  // ---- näkyvät osat ----
  for (const k in World.batches) scene.add(World.batches[k].build());
  scene.add(Terrain.mesh());
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshPhongMaterial({ color: 0x3d7fa8, transparent: true, opacity: 0.82, shininess: 90, depthWrite: false }));
  wm.rotation.x = -Math.PI / 2; wm.position.y = Terrain.water; scene.add(wm);
  // kaupungin ja linnan mukulakivet
  const cobble = (cx, cz, w, d) => {
    const t = Tex.ground.clone(); t.needsUpdate = true; t.repeat.set(w / 4, d / 4);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: t }));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.03, cz); m.receiveShadow = true; scene.add(m);
  };
  cobble(MAPD.city.x, MAPD.city.z, 204, 204); cobble(MAPD.fort.x, MAPD.fort.z, 76, 66);
  // suihkulähteen vesi
  const fm = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.12, 24), new THREE.MeshPhongMaterial({ color: 0x4d88b8, transparent: true, opacity: .85, shininess: 90 }));
  fm.position.set(MAPD.city.x, 0.98, MAPD.city.z); scene.add(fm);
  // puut
  const all = GM.trees.map(t => ({ x: t.x, z: t.z, h: t.h, s: t.s, decid: t.decid }));
  for (const t of World.trees) all.push({ x: t[0], z: t[1], h: groundH(t[0], t[1]), s: rand2(0.8, 1.4), decid: Math.random() < 0.5 });
  const pines = all.filter(t => !t.decid), decs = all.filter(t => t.decid);
  const trunkG = new THREE.CylinderGeometry(0.25, 0.35, 3, 6); trunkG.translate(0, 1.5, 0);
  const leafG = new THREE.ConeGeometry(2.0, 6.5, 7); leafG.translate(0, 5.5, 0);
  const leafD = new THREE.IcosahedronGeometry(2.3, 0); leafD.translate(0, 4.6, 0);
  const mk = (geo, mt, arr) => {
    const im = new THREE.InstancedMesh(geo, mt, Math.max(1, arr.length));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    arr.forEach((t, i) => { p.set(t.x, t.h - 0.1, t.z); s.set(t.s, t.s, t.s); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 2.4) % 6.28); m.compose(p, q, s); im.setMatrixAt(i, m); });
    im.count = arr.length; im.castShadow = true; scene.add(im);
  };
  const trunkM = new THREE.MeshLambertMaterial({ color: 0x5a4028 });
  mk(trunkG, trunkM, pines); mk(leafG, new THREE.MeshLambertMaterial({ color: 0x2f5a2d }), pines);
  mk(trunkG, trunkM, decs); mk(leafD, new THREE.MeshLambertMaterial({ color: 0x5e7f35, flatShading: true }), decs);
  // tuulimyllyn lavat
  const bl = new THREE.Group(); bl.position.set(GM.mill.x, GM.mill.y, GM.mill.z);
  const bm = mat(0x7a5a3a), cm = mat(0xe8dcc0);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; bl.add(arm);
    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9.2, 0.2), bm); spar.position.y = 4.6; spar.castShadow = true; arm.add(spar);
    const sail = new THREE.Mesh(new THREE.BoxGeometry(1.8, 6.6, 0.08), cm); sail.position.set(1.1, 5.4, 0.08); sail.castShadow = true; arm.add(sail);
  }
  scene.add(bl); GM.blades = bl;
  // etäiset vuoret
  const mm = new THREE.MeshLambertMaterial({ color: 0x7d8da0, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + Math.random() * 0.2, r = 470 + Math.random() * 140, h = 90 + Math.random() * 150;
    const c = new THREE.Mesh(new THREE.ConeGeometry(70 + Math.random() * 60, h, 6), mm);
    c.position.set(Math.cos(a) * r, h / 2 - 6, Math.sin(a) * r); scene.add(c);
  }
  const far = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshLambertMaterial({ color: 0x4d6a3a }));
  far.rotation.x = -Math.PI / 2; far.position.y = -4; scene.add(far);
}
