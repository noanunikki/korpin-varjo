'use strict';
// =====================================================================
//  MAAILMA: törmäysmoottori, geometria-erät, kaupungin generointi, navigointi
// =====================================================================
const PITCH = 56, BLOCK = 46, EPS = 0.001;

const World = {
  colliders: [], grid: new Map(), CELL: 8, stamp: 0,
  batches: {}, blockB: {}, mapRects: [], hays: [], feathers: [], spawns: [], ropes: [],
  perches: [], extra: [], zones: {},
};

// ---------- Geometria-erä (yksi piirtokutsu / materiaali) ----------
class Batch {
  constructor(tex, ts) { this.tex = tex; this.ts = ts || 4; this.p = []; this.n = []; this.uv = []; this.c = []; this.idx = []; this.vc = 0; }
  quad(v, n, uvs, cols) {
    const b = this.vc;
    for (let i = 0; i < 4; i++) {
      this.p.push(v[i][0], v[i][1], v[i][2]); this.n.push(n[0], n[1], n[2]);
      this.uv.push(uvs[i][0], uvs[i][1]); this.c.push(cols[i][0], cols[i][1], cols[i][2]);
    }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3); this.vc += 4;
  }
  box(x0, y0, z0, x1, y1, z1, col, uo = 0, vo = 0) {
    col = col || [1, 1, 1];
    const s = 1 / this.ts;
    const sh = (y) => 0.66 + 0.34 * Math.min(1, Math.max(0, y / 5));
    const C = (y) => { const k = sh(y); return [col[0] * k, col[1] * k, col[2] * k]; };
    const a = C(y0), b = C(y1), t = [col[0], col[1], col[2]];
    this.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [[z1 * s + uo, y0 * s + vo], [z0 * s + uo, y0 * s + vo], [z0 * s + uo, y1 * s + vo], [z1 * s + uo, y1 * s + vo]], [a, a, b, b]);
    this.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [[z0 * s + uo, y0 * s + vo], [z1 * s + uo, y0 * s + vo], [z1 * s + uo, y1 * s + vo], [z0 * s + uo, y1 * s + vo]], [a, a, b, b]);
    this.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[x0 * s, z1 * s], [x1 * s, z1 * s], [x1 * s, z0 * s], [x0 * s, z0 * s]], [t, t, t, t]);
    this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [[x0 * s + uo, y0 * s + vo], [x1 * s + uo, y0 * s + vo], [x1 * s + uo, y1 * s + vo], [x0 * s + uo, y1 * s + vo]], [a, a, b, b]);
    this.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [[x1 * s + uo, y0 * s + vo], [x0 * s + uo, y0 * s + vo], [x0 * s + uo, y1 * s + vo], [x1 * s + uo, y1 * s + vo]], [a, a, b, b]);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(this.idx), 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: this.tex, vertexColors: true }));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
}

// ---------- Törmäysmoottori ----------
World.off = { x: 0, z: 0 };
function groundH(x, z) { return Terrain.ready ? Terrain.h(x, z) : 0; }
function addCol(x0, y0, z0, x1, y1, z1, props) {
  const ox = World.off.x, oz = World.off.z; x0 += ox; x1 += ox; z0 += oz; z1 += oz;
  const c = Object.assign({ x0, y0, z0, x1, y1, z1, _q: 0 }, props || {});
  World.colliders.push(c);
  const C = World.CELL;
  for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++)
    for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) {
      const k = (i + 256) * 1024 + (j + 256);
      let a = World.grid.get(k); if (!a) { a = []; World.grid.set(k, a); }
      a.push(c);
    }
  return c;
}
function query(x0, z0, x1, z1) {
  const C = World.CELL, out = []; const st = ++World.stamp;
  for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++)
    for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) {
      const a = World.grid.get((i + 256) * 1024 + (j + 256)); if (!a) continue;
      for (let k = 0; k < a.length; k++) { const c = a[k]; if (c._q !== st) { c._q = st; out.push(c); } }
    }
  return out;
}
function freeAt(e, x, y, z, h) {
  const r = e.r; h = h || e.h;
  if (Terrain.ready && y < Terrain.h(x, z) - 0.3) return false;
  const list = query(x - r, z - r, x + r, z + r);
  for (const c of list) {
    if (c.oneWay) continue;
    if (x + r <= c.x0 + EPS || x - r >= c.x1 - EPS || z + r <= c.z0 + EPS || z - r >= c.z1 - EPS || y + h <= c.y0 + EPS || y >= c.y1 - EPS) continue;
    return false;
  }
  return true;
}
function stepAxis(e, axis, d) {
  if (d === 0) return;
  const p = e.pos; const prevBottom = p.y;
  if (axis === 0) p.x += d; else if (axis === 2) p.z += d; else p.y += d;
  const r = e.r, h = e.h;
  const list = query(p.x - r - 0.02, p.z - r - 0.02, p.x + r + 0.02, p.z + r + 0.02);
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (p.x + r <= c.x0 + EPS || p.x - r >= c.x1 - EPS || p.z + r <= c.z0 + EPS || p.z - r >= c.z1 - EPS || p.y + h <= c.y0 + EPS || p.y >= c.y1 - EPS) continue;
    if (c.oneWay) { if (axis !== 1 || d >= 0 || prevBottom < c.y1 - 0.04) continue; }
    if (axis === 1) {
      if (d < 0) { e.landImpact = Math.max(e.landImpact || 0, -e.vel.y); p.y = c.y1 + EPS; e.onGround = true; e.groundBox = c; e.vel.y = 0; }
      else { p.y = c.y0 - h - EPS; e.hitHead = true; if (e.vel.y > 0) e.vel.y = 0; }
    } else {
      if (e.stepH > 0 && !c.oneWay && c.y1 - p.y <= e.stepH && c.y1 - p.y > 0 && freeAt(e, p.x, c.y1 + EPS, p.z)) { p.y = c.y1 + EPS; continue; }
      if (axis === 0) {
        if (d > 0) { p.x = c.x0 - r - EPS; e.hitX = { c, nx: -1, nz: 0 }; } else { p.x = c.x1 + r + EPS; e.hitX = { c, nx: 1, nz: 0 }; }
        e.vel.x = 0;
      } else {
        if (d > 0) { p.z = c.z0 - r - EPS; e.hitZ = { c, nx: 0, nz: -1 }; } else { p.z = c.z1 + r + EPS; e.hitZ = { c, nx: 0, nz: 1 }; }
        e.vel.z = 0;
      }
    }
  }
  if (axis === 1) {
    const gh = groundH(p.x, p.z);
    if (p.y < gh) {
      e.landImpact = Math.max(e.landImpact || 0, -e.vel.y);
      p.y = gh; e.onGround = true; e.groundBox = GROUND; e.vel.y = 0;
    }
  } else if (Terrain.ready) {
    // liian jyrkkä nousu = maasto on seinä
    const gh = Terrain.h(p.x, p.z);
    if (gh - p.y > 0.55) {
      if (axis === 0) { p.x -= d; e.vel.x = 0; } else { p.z -= d; e.vel.z = 0; }
      e.hitTerrain = true;
    }
  }
}
const GROUND = { x0: -1e4, x1: 1e4, z0: -1e4, z1: 1e4, y0: -10, y1: 0, ground: true };
function moveEntity(e, dt) {
  e.onGround = false; e.hitX = null; e.hitZ = null; e.hitHead = false; e.groundBox = null; e.landImpact = 0;
  const sp = Math.max(Math.abs(e.vel.x), Math.abs(e.vel.y), Math.abs(e.vel.z));
  const steps = Math.max(1, Math.ceil(sp * dt / 0.3));
  const sdt = dt / steps;
  for (let s = 0; s < steps; s++) {
    stepAxis(e, 0, e.vel.x * sdt); stepAxis(e, 2, e.vel.z * sdt); stepAxis(e, 1, e.vel.y * sdt);
  }
  // rinnettä alas: pysy kiinni maassa
  if (!e.onGround && e.stepH > 0 && e.vel.y <= 0.01 && Terrain.ready) {
    const gh = Terrain.h(e.pos.x, e.pos.z);
    if (e.pos.y - gh < 0.6 && e.pos.y >= gh - 0.01) { e.pos.y = gh; e.onGround = true; e.groundBox = GROUND; e.vel.y = 0; }
  }
}

// säde vs. AABB -> lähin osumaetäisyys
function rayDist(ox, oy, oz, dx, dy, dz, maxD, forCam) {
  const ex = ox + dx * maxD, ez = oz + dz * maxD;
  const list = query(Math.min(ox, ex) - 0.1, Math.min(oz, ez) - 0.1, Math.max(ox, ex) + 0.1, Math.max(oz, ez) + 0.1);
  let best = maxD;
  for (const c of list) {
    if (forCam) { if (c.rope) continue; }
    else if (c.oneWay || c.noLOS) continue;
    let t0 = 0, t1 = best, ok = true;
    const o = [ox, oy, oz], d = [dx, dy, dz], mn = [c.x0, c.y0, c.z0], mx = [c.x1, c.y1, c.z1];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < mn[a] || o[a] > mx[a]) { ok = false; break; } }
      else {
        let ta = (mn[a] - o[a]) / d[a], tb = (mx[a] - o[a]) / d[a];
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
        if (t0 > t1) { ok = false; break; }
      }
    }
    if (ok && t0 < best) best = t0;
  }
  if (Terrain.ready) {
    // maasto: kävele sädettä pitkin ja hae leikkauskohta
    const steps = Math.ceil(best / 1.2);
    for (let i = 1; i <= steps; i++) {
      const t = Math.min(best, i * 1.2);
      if (oy + dy * t < Terrain.h(ox + dx * t, oz + dz * t)) {
        let lo = Math.max(0, t - 1.2), hi = t;
        for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (oy + dy * m < Terrain.h(ox + dx * m, oz + dz * m)) hi = m; else lo = m; }
        if (hi < best) best = hi; break;
      }
    }
  } else if (dy < 0 && oy > 0) { const t = -oy / dy; if (t < best) best = t; }
  return best;
}
function los(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az; const d = Math.hypot(dx, dy, dz);
  if (d < 0.05) return true;
  return rayDist(ax, ay, az, dx / d, dy / d, dz / d, d) >= d - 0.1;
}

// ---------- Navigointiruudukko + A* ----------
const Nav = {
  cs: 2.5, n: 264, ox: -330, oz: -330, blocked: null,
  build() {
    const n = this.n; this.blocked = new Uint8Array(n * n);
    this.gs = new Float32Array(n * n); this.came = new Int32Array(n * n); this.seen = new Uint32Array(n * n); this.closed = new Uint32Array(n * n); this.stamp = 0;
    // maasto: vesi ja jyrkät rinteet estävät
    if (Terrain.ready) {
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const cx = this.ox + (i + 0.5) * this.cs, cz = this.oz + (j + 0.5) * this.cs;
        const h = Terrain.h(cx, cz);
        if (h < Terrain.water - 0.25 || Math.hypot(cx, cz) > 305) { this.blocked[j * n + i] = 1; continue; }
        const dx = Terrain.h(cx + 1.2, cz) - Terrain.h(cx - 1.2, cz), dz = Terrain.h(cx, cz + 1.2) - Terrain.h(cx, cz - 1.2);
        if (Math.hypot(dx, dz) / 2.4 > 0.62) this.blocked[j * n + i] = 1;
      }
    }
    for (const c of World.colliders) {
      const gh = groundH((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2);
      if (c.oneWay || c.y0 > gh + 1.0 || c.y1 < gh + 0.6 || c.noNav) continue;
      const i0 = Math.floor((c.x0 - 0.45 - this.ox) / this.cs), i1 = Math.floor((c.x1 + 0.45 - this.ox) / this.cs);
      const j0 = Math.floor((c.z0 - 0.45 - this.oz) / this.cs), j1 = Math.floor((c.z1 + 0.45 - this.oz) / this.cs);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (i < 0 || j < 0 || i >= n || j >= n) continue;
        const cx = this.ox + (i + 0.5) * this.cs, cz = this.oz + (j + 0.5) * this.cs;
        if (cx > c.x0 - 0.45 && cx < c.x1 + 0.45 && cz > c.z0 - 0.45 && cz < c.z1 + 0.45) this.blocked[j * n + i] = 1;
      }
    }
    for (let i = 0; i < n; i++) for (const j of [0, 1, n - 1, n - 2]) { this.blocked[j * n + i] = 1; this.blocked[i * n + j] = 1; }
  },
  isFree(i, j) { return i >= 0 && j >= 0 && i < this.n && j < this.n && !this.blocked[j * this.n + i]; },
  cell(x, z) { return [Math.floor((x - this.ox) / this.cs), Math.floor((z - this.oz) / this.cs)]; },
  center(i, j) { return [this.ox + (i + 0.5) * this.cs, this.oz + (j + 0.5) * this.cs]; },
  nearest(i, j, maxR) {
    if (this.isFree(i, j)) return [i, j];
    for (let r = 1; r <= maxR; r++)
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        if (this.isFree(i + di, j + dj)) return [i + di, j + dj];
      }
    return null;
  },
  find(sx, sz, tx, tz) {
    let [si, sj] = this.cell(sx, sz), [ti, tj] = this.cell(tx, tz);
    const s = this.nearest(si, sj, 4), t = this.nearest(ti, tj, 10);
    if (!s || !t) return null;
    si = s[0]; sj = s[1]; ti = t[0]; tj = t[1];
    const n = this.n, st = ++this.stamp;
    const hI = [], hF = [];
    const push = (i, f) => { hI.push(i); hF.push(f); let k = hI.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (hF[p] <= hF[k]) break; [hI[p], hI[k]] = [hI[k], hI[p]]; [hF[p], hF[k]] = [hF[k], hF[p]]; k = p; } };
    const pop = () => { const top = hI[0]; const li = hI.pop(), lf = hF.pop(); if (hI.length) { hI[0] = li; hF[0] = lf; let k = 0; for (; ;) { let l = k * 2 + 1, r = l + 1, m = k; if (l < hI.length && hF[l] < hF[m]) m = l; if (r < hI.length && hF[r] < hF[m]) m = r; if (m === k) break; [hI[m], hI[k]] = [hI[k], hI[m]]; [hF[m], hF[k]] = [hF[k], hF[m]]; k = m; } } return top; };
    const start = sj * n + si, goal = tj * n + ti;
    this.gs[start] = 0; this.came[start] = -1; this.seen[start] = st; push(start, 0);
    const closed = this.closed;
    const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1];
    let exp = 0, found = false;
    while (hI.length && exp < 16000) {
      const cur = pop(); if (closed[cur] === st) continue; closed[cur] = st; exp++;
      if (cur === goal) { found = true; break; }
      const ci = cur % n, cj = (cur / n) | 0;
      for (let k = 0; k < 8; k++) {
        const ni = ci + DX[k], nj = cj + DZ[k];
        if (!this.isFree(ni, nj)) continue;
        if (k >= 4 && (!this.isFree(ci + DX[k], cj) || !this.isFree(ci, cj + DZ[k]))) continue;
        const nid = nj * n + ni; if (closed[nid] === st) continue;
        const g = this.gs[cur] + (k < 4 ? 1 : 1.414);
        if (this.seen[nid] !== st || g < this.gs[nid]) {
          this.seen[nid] = st; this.gs[nid] = g; this.came[nid] = cur;
          const hx = Math.abs(ni - ti), hz = Math.abs(nj - tj);
          push(nid, g + 1.5 * ((hx + hz) + (1.414 - 2) * Math.min(hx, hz)));
        }
      }
    }
    if (!found) return null;
    const path = []; let c = goal;
    while (c !== -1 && c !== undefined) { const [x, z] = this.center(c % n, (c / n) | 0); path.push({ x, z }); c = this.came[c]; }
    path.reverse(); path.shift();
    return path;
  },
};

// ---------- Kaupungin generointi ----------
const WALL_COLS = [[1, 1, 1], [1, .86, .7], [.95, .8, .68], [.86, .92, .86], [1, .85, .8], [.82, .84, .92], [.95, .93, .8]];
const ROOF_COLS = [[1, 1, 1], [.78, .8, .9], [.9, .95, .75], [.95, .82, .7], [.7, .72, .78]];
const WOOD_DARK = [0.62, 0.5, 0.42];

function vb(name, x0, y0, z0, x1, y1, z1, col, uo, vo) { const ox = World.off.x, oz = World.off.z; World.batches[name].box(x0 + ox, y0, z0 + oz, x1 + ox, y1, z1 + oz, col, uo || 0, vo || 0); }

function makeCrate(x, y, z, s) {
  s = s || 0.9;
  vb('wood', x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, tint(0xb08a5a, 0.3), rng() * 3, rng() * 3);
  addCol(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, { prop: true });
}
function makeBarrel(x, y, z) {
  vb('wood', x - .4, y, z - .4, x + .4, y + .95, z + .4, tint(0x8a6238, 0.3), rng() * 3, rng() * 3);
  vb('stone', x - .42, y + .2, z - .42, x + .42, y + .27, z + .42, [.3, .3, .32]);
  vb('stone', x - .42, y + .68, z - .42, x + .42, y + .75, z + .42, [.3, .3, .32]);
  addCol(x - .4, y, z - .4, x + .4, y + .95, z + .4, { prop: true });
}
function makeHay(cx, cz, w, d, rot) {
  // heinäkärry: ei kiivettävä, pehmeä lasku
  const hw = w / 2, hd = d / 2;
  vb('wood', cx - hw - .1, 0.0, cz - hd - .1, cx + hw + .1, 0.55, cz + hd + .1, [.8, .65, .5]);
  vb('hay', cx - hw, 0.55, cz - hd, cx + hw, 1.55, cz + hd, tint(0xffffff, 0.15), rng() * 2, rng() * 2);
  vb('hay', cx - hw + .45, 1.55, cz - hd + .45, cx + hw - .45, 2.0, cz + hd - .45, tint(0xffffff, 0.15), rng() * 2, rng() * 2);
  // pyörät
  vb('wood', cx - hw - .2, 0, cz - hd * .6, cx - hw - .05, 0.9, cz - hd * .6 + .35, [.45, .35, .28]);
  vb('wood', cx + hw + .05, 0, cz - hd * .6, cx + hw + .2, 0.9, cz - hd * .6 + .35, [.45, .35, .28]);
  const c = addCol(cx - hw - .1, 0, cz - hd - .1, cx + hw + .1, 1.7, cz + hd + .1, { hay: true, noClimb: true, noLOS: false, cx: cx + World.off.x, cz: cz + World.off.z, prop: true });
  World.hays.push(c);
  return c;
}
function makeRope(x0, x1, z0, z1, y) {
  // köysi / lankku jonka päällä voi tasapainoilla
  const alongX = (x1 - x0) > (z1 - z0);
  const th = 0.09;
  if (alongX) vb('wood', x0, y - th, (z0 + z1) / 2 - th / 2, x1, y, (z0 + z1) / 2 + th / 2, [.55, .45, .35]);
  else vb('wood', (x0 + x1) / 2 - th / 2, y - th, z0, (x0 + x1) / 2 + th / 2, y, z1, [.55, .45, .35]);
  const hw = 0.18;
  const c = alongX ? addCol(x0, y - 0.1, (z0 + z1) / 2 - hw, x1, y, (z0 + z1) / 2 + hw, { oneWay: true, rope: true, noLOS: true })
    : addCol((x0 + x1) / 2 - hw, y - 0.1, z0, (x0 + x1) / 2 + hw, y, z1, { oneWay: true, rope: true, noLOS: true });
  World.ropes.push(c);
  // pyykkiä
  const n = Math.floor((alongX ? x1 - x0 : z1 - z0) / 2.5);
  for (let i = 1; i < n; i++) if (rng() < 0.5) {
    const t = (i + rng() * .5) * 2.5, ch = rand(.7, 1.1);
    const col = pick([[.9, .3, .3], [.3, .5, .9], [.95, .9, .8], [.4, .7, .4], [.9, .7, .2]]);
    if (alongX) vb('cloth', x0 + t, y - ch - .1, (z0 + z1) / 2 - .01, x0 + t + .9, y - .1, (z0 + z1) / 2 + .01, col);
    else vb('cloth', (x0 + x1) / 2 - .01, y - ch - .1, z0 + t, (x0 + x1) / 2 + .01, y - .1, z0 + t + .9, col);
  }
  return c;
}
function makeBeam(x0, y, z0, x1, z1, wd) { // kapea lankku (yksisuuntainen taso)
  vb('wood', x0, y - 0.16, z0, x1, y, z1, [.6, .45, .32], rng());
  return addCol(x0, y - 0.16, z0, x1, y, z1, { oneWay: true, noLOS: true });
}

function makeBuilding(x0, z0, x1, z1, h, edges, list, opt) {
  opt = opt || {};
  const wc = pick(WALL_COLS), rc = pick(ROOF_COLS), uo = rng() * 4;
  vb('wall', x0, 0, z0, x1, h - 0.4, z1, wc, uo);
  vb('roof', x0 - 0.12, h - 0.4, z0 - 0.12, x1 + 0.12, h, z1 + 0.12, rc, rng() * 2, rng() * 2);
  vb('stone', x0 - 0.08, 0, z0 - 0.08, x1 + 0.08, 2.0, z1 + 0.08, [.9, .88, .84], rng() * 3);
  for (let y = 4; y < h - 1; y += 4) vb('wood', x0 - 0.05, y - 0.1, z0 - 0.05, x1 + 0.05, y + 0.1, z1 + 0.05, [.55, .42, .32]);
  const col = addCol(x0, 0, z0, x1, h, z1, { bld: true });
  const b = { x0, z0, x1, z1, h, edges, col };
  list.push(b); World.mapRects.push([x0, z0, x1, z1, h]);
  const W = x1 - x0, D = z1 - z0;
  // ovi
  const sides = ['n', 's', 'w', 'e'];
  const ds = pick(sides);
  if (ds === 'n' || ds === 's') {
    const dx = rand(x0 + 2, x1 - 2), zz = ds === 'n' ? z0 : z1;
    vb('wood', dx - .75, 0, ds === 'n' ? zz - .15 : zz, dx + .75, 2.4, ds === 'n' ? zz : zz + .15, [.45, .32, .22]);
  } else {
    const dz = rand(z0 + 2, z1 - 2), xx = ds === 'w' ? x0 : x1;
    vb('wood', ds === 'w' ? xx - .15 : xx, 0, dz - .75, ds === 'w' ? xx : xx + .15, 2.4, dz + .75, [.45, .32, .22]);
  }
  // parveke kadun puolelle
  if (!opt.noProps) {
    for (const s of ['n', 's', 'w', 'e']) {
      if (!edges[s] || rng() > 0.55 || h < 8) continue;
      const by = pick([4.1, 6.1, 8.1].filter(v => v < h - 1.5));
      if (!by) continue;
      if (s === 'n' || s === 's') {
        const bx = rand(x0 + 2.4, x1 - 2.4), zz0 = s === 'n' ? z0 - 1.3 : z1, zz1 = s === 'n' ? z0 : z1 + 1.3;
        vb('wood', bx - 1.6, by - .18, zz0, bx + 1.6, by, zz1, [.6, .45, .32]);
        addCol(bx - 1.6, by - .18, zz0, bx + 1.6, by, zz1, { oneWay: true, noLOS: true });
        const fz = s === 'n' ? zz0 : zz1 - .06;
        vb('wood', bx - 1.6, by, fz, bx + 1.6, by + .9, fz + .06, [.5, .38, .28]);
        vb('wood', bx - 1.6, by - 1, s === 'n' ? zz1 - .2 : zz0, bx - 1.35, by - .18, s === 'n' ? zz1 : zz0 + .2, [.4, .3, .22]);
        vb('wood', bx + 1.35, by - 1, s === 'n' ? zz1 - .2 : zz0, bx + 1.6, by - .18, s === 'n' ? zz1 : zz0 + .2, [.4, .3, .22]);
      } else {
        const bz = rand(z0 + 2.4, z1 - 2.4), xx0 = s === 'w' ? x0 - 1.3 : x1, xx1 = s === 'w' ? x0 : x1 + 1.3;
        vb('wood', xx0, by - .18, bz - 1.6, xx1, by, bz + 1.6, [.6, .45, .32]);
        addCol(xx0, by - .18, bz - 1.6, xx1, by, bz + 1.6, { oneWay: true, noLOS: true });
        const fx = s === 'w' ? xx0 : xx1 - .06;
        vb('wood', fx, by, bz - 1.6, fx + .06, by + .9, bz + 1.6, [.5, .38, .28]);
        vb('wood', s === 'w' ? xx1 - .2 : xx0, by - 1, bz - 1.6, s === 'w' ? xx1 : xx0 + .2, by - .18, bz - 1.35, [.4, .3, .22]);
        vb('wood', s === 'w' ? xx1 - .2 : xx0, by - 1, bz + 1.35, s === 'w' ? xx1 : xx0 + .2, by - .18, bz + 1.6, [.4, .3, .22]);
      }
    }
    // piippu
    if (rng() < 0.5 && W > 6 && D > 6) {
      const px = rand(x0 + 1.5, x1 - 2.7), pz = rand(z0 + 1.5, z1 - 2.7);
      vb('stone', px, h, pz, px + 1.2, h + 2.6, pz + 1.2, [.8, .6, .5]);
      addCol(px, h, pz, px + 1.2, h + 2.6, pz + 1.2, { prop: true });
    }
    // kattokoppi
    if (rng() < 0.3 && W > 9 && D > 9) {
      const px = rand(x0 + 1.5, x1 - 5.5), pz = rand(z0 + 1.5, z1 - 5.5);
      vb('wall', px, h, pz, px + 4, h + 2.6, pz + 3.6, [.9, .8, .7]);
      vb('roof', px - .15, h + 2.6, pz - .15, px + 4.15, h + 2.95, pz + 3.75, rc);
      addCol(px, h, pz, px + 4, h + 2.95, pz + 3.6, { prop: true });
    }
    // laatikoita / tynnyreitä katolla
    if (rng() < 0.4) {
      const px = rand(x0 + 2, x1 - 2), pz = rand(z0 + 2, z1 - 2);
      makeCrate(px, h, pz); if (rng() < .6) makeCrate(px + 1, h, pz + .2, .8); if (rng() < .5) makeBarrel(px - .9, h, pz + .3);
      if (rng() < .3) makeCrate(px + .3, h + .9, pz + .1, .7);
    }
    // ylempi kerros (porrastettu)
    if (h >= 12 && W > 10 && D > 10 && rng() < 0.45) {
      const ih = rand(2.2, 3.2), uh = rand(4, 6);
      const ux0 = x0 + ih + rand(0, 1), uz0 = z0 + ih + rand(0, 1), ux1 = x1 - ih - rand(0, 1), uz1 = z1 - ih - rand(0, 1);
      vb('wall', ux0, h, uz0, ux1, h + uh - .4, uz1, wc, uo);
      vb('roof', ux0 - .12, h + uh - .4, uz0 - .12, ux1 + .12, h + uh, uz1 + .12, rc);
      addCol(ux0, h, uz0, ux1, h + uh, uz1, { bld: true });
      b.upper = { x0: ux0, z0: uz0, x1: ux1, z1: uz1, h: h + uh };
    }
  }
  return b;
}

function makeYard(lot) {
  const { x0, x1, z0, z1 } = lot;
  const hgt = 1.3;
  const wallSeg = (a, b, c, d) => { vb('stone', a, 0, b, c, hgt, d, [.9, .88, .8], rng() * 3); addCol(a, 0, b, c, hgt, d, { prop: true }); };
  const t = 0.5;
  wallSeg(x0, z0, x1, z0 + t); wallSeg(x0, z1 - t, x1, z1);
  wallSeg(x0, z0 + t, x0 + t, z1 - t);
  const gap = (z1 - z0) / 2;
  wallSeg(x1 - t, z0 + t, x1, z0 + gap - 2); wallSeg(x1 - t, z0 + gap + 2, x1, z1 - t);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  vb('stone', cx - .8, 0, cz - .8, cx + .8, 1.0, cz + .8, [.85, .85, .8]); addCol(cx - .8, 0, cz - .8, cx + .8, 1.0, cz + .8, { prop: true });
  for (let i = 0; i < 4; i++) makeCrate(rand(x0 + 2, x1 - 3), 0, rand(z0 + 2, z1 - 2), rand(.7, 1));
  World.trees.push([x0 + 3, z0 + 3], [x1 - 4, z1 - 3], [x0 + 3.5, z1 - 4]);
}

function makeLot(lot, list, state) {
  const r = rng();
  if (r < 0.1 && !lot.noYard) { makeYard(lot); return; }
  const W = lot.x1 - lot.x0, D = lot.z1 - lot.z0, e = lot.edges;
  const parts = [];
  if (rng() < 0.75) {
    const gap = rand(2, 3);
    if (W >= D) {
      const s = rand(0.4, 0.6) * (W - gap);
      parts.push([lot.x0, lot.z0, lot.x0 + s, lot.z1, { w: e.w, n: e.n, s: e.s, e: false }]);
      parts.push([lot.x0 + s + gap, lot.z0, lot.x1, lot.z1, { w: false, n: e.n, s: e.s, e: e.e }]);
    } else {
      const s = rand(0.4, 0.6) * (D - gap);
      parts.push([lot.x0, lot.z0, lot.x1, lot.z0 + s, { w: e.w, n: e.n, s: false, e: e.e }]);
      parts.push([lot.x0, lot.z0 + s + gap, lot.x1, lot.z1, { w: e.w, n: false, s: e.s, e: e.e }]);
    }
  } else parts.push([lot.x0, lot.z0, lot.x1, lot.z1, e]);
  for (const p of parts) {
    let h = pick([8, 9, 10, 11, 12, 13, 14]) + rand(-.5, .5);
    if (rng() < 0.2) h = rand(16, 22);
    const big = (p[2] - p[0]) >= 9 && (p[3] - p[1]) >= 9;
    const gr = big && h >= 12 && state.roofGuards < 5 && rng() < 0.45;
    const b = makeBuilding(p[0], p[1], p[2], p[3], h, p[4], list, { noProps: gr });
    if (gr) {
      state.roofGuards++;
      const m = 2.6;
      World.spawns.push({
        type: 'sword', roof: true, x: p[0] + m, y: h, z: p[1] + m,
        route: [[p[0] + m, p[1] + m], [p[2] - m, p[1] + m], [p[2] - m, p[3] - m], [p[0] + m, p[3] - m]], wait: 2.5
      });
      b.guardRoof = true;
    }
  }
}

// kellotorni jolta voi ottaa uskon loikan heinäkärryyn
function makeLeapTower(x0, z0, x1, z1, hBase, dir, name) {
  vb('stone', x0, 0, z0, x1, hBase, z1, [1, 1, 1], rng() * 3);
  vb('stone', x0 - .15, 0, z0 - .15, x1 + .15, 2.5, z1 + .15, [.85, .85, .85]);
  for (let y = 9; y < hBase - 2; y += 9) vb('stone', x0 - .2, y, z0 - .2, x1 + .2, y + .4, z1 + .2, [.75, .75, .75]);
  addCol(x0, 0, z0, x1, hBase, z1, { bld: true, tower: true });
  World.mapRects.push([x0, z0, x1, z1, hBase]);
  // kapeita ikkunoita
  for (let y = 6; y < hBase - 4; y += 7) {
    vb('flat', (x0 + x1) / 2 - .3, y, z1, (x0 + x1) / 2 + .3, y + 1.6, z1 + .05, [.06, .06, .08]);
    vb('flat', (x0 + x1) / 2 - .3, y, z0 - .05, (x0 + x1) / 2 + .3, y + 1.6, z0, [.06, .06, .08]);
    vb('flat', x1, y, (z0 + z1) / 2 - .3, x1 + .05, y + 1.6, (z0 + z1) / 2 + .3, [.06, .06, .08]);
    vb('flat', x0 - .05, y, (z0 + z1) / 2 - .3, x0, y + 1.6, (z0 + z1) / 2 + .3, [.06, .06, .08]);
  }
  const m = 1.6, bh = 6;
  const bx0 = x0 + m, bx1 = x1 - m, bz0 = z0 + m, bz1 = z1 - m, yT = hBase + bh;
  vb('stone', bx0, hBase, bz0, bx1, yT - .4, bz1, [.95, .93, .9], rng() * 3);
  vb('roof', bx0 - .2, yT - .4, bz0 - .2, bx1 + .2, yT, bz1 + .2, [.55, .58, .65]);
  addCol(bx0, hBase, bz0, bx1, yT, bz1, { bld: true });
  World.mapRects.push([bx0, bz0, bx1, bz1, yT]);
  const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
  // kellohuoneen aukot
  for (const f of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const px = f[0] === 0 ? cx : (f[0] > 0 ? bx1 : bx0), pz = f[1] === 0 ? cz : (f[1] > 0 ? bz1 : bz0);
    if (f[0] === 0) vb('flat', px - .8, hBase + 1.2, pz + (f[1] > 0 ? 0 : -.05), px + .8, hBase + 4.4, pz + (f[1] > 0 ? .05 : 0), [.05, .05, .07]);
    else vb('flat', px + (f[0] > 0 ? 0 : -.05), hBase + 1.2, pz - .8, px + (f[0] > 0 ? .05 : 0), hBase + 4.4, pz + .8, [.05, .05, .07]);
  }
  // huippu: kärki
  vb('stone', cx - .45, yT, cz - .45, cx + .45, yT + 4.2, cz + .45, [.8, .8, .8]);
  vb('stone', cx - .3, yT + 4.2, cz - .3, cx + .3, yT + 5.6, cz + .3, [.8, .8, .8]);
  vb('flat', cx - .08, yT + 5.6, cz - .08, cx + .08, yT + 7.2, cz + .08, [.75, .6, .2]);
  addCol(cx - .45, yT, cz - .45, cx + .45, yT + 4.2, cz + .45, { prop: true });
  // lankku
  const L = 5.4, hw = 0.5; let bxa, bxb, bza, bzb, ex, ez;
  if (dir === 's') { bxa = cx - hw; bxb = cx + hw; bza = bz1; bzb = bz1 + L; ex = cx; ez = bzb - 0.8; }
  else if (dir === 'n') { bxa = cx - hw; bxb = cx + hw; bza = bz0 - L; bzb = bz0; ex = cx; ez = bza + 0.8; }
  else if (dir === 'e') { bxa = bx1; bxb = bx1 + L; bza = cz - hw; bzb = cz + hw; ex = bxb - 0.8; ez = cz; }
  else { bxa = bx0 - L; bxb = bx0; bza = cz - hw; bzb = cz + hw; ex = bxa + 0.8; ez = cz; }
  vb('wood', bxa, yT - .2, bza, bxb, yT, bzb, [.6, .45, .32]);
  addCol(bxa, yT - .2, bza, bxb, yT, bzb, { oneWay: true, noLOS: true });
  // lippu lankun päässä
  vb('wood', ex - .05, yT, ez - .05, ex + .05, yT + 2.2, ez + .05, [.4, .3, .2]);
  vb('cloth', ex + .05, yT + 1.4, ez - .02, ex + 1.2, yT + 2.1, ez + .02, [.8, .2, .2]);
  // heinäkärry alla
  const hx = ex + (dir === 'e' ? -0.0 : 0), hz = ez;
  makeHay(hx, hz, dir === 'e' || dir === 'w' ? 4.2 : 3.4, dir === 'e' || dir === 'w' ? 3.4 : 4.2);
  World.perches.push({ name, x: ex + World.off.x, y: yT, z: ez + World.off.z, r: 1.6, cx: cx + World.off.x, cz: cz + World.off.z, yT, dir });
  return { cx, cz, yT };
}

function makeCathedral() {
  const S = [.92, .9, .86];
  // laiva
  vb('stone', 38, 0, -64, 76, 17 - .4, -50, S, 0.7);
  vb('roof', 37.8, 16.6, -64.2, 76.2, 17, -49.8, [.5, .53, .6]);
  addCol(38, 0, -64, 76, 17, -50, { bld: true });
  World.mapRects.push([38, -64, 76, -50, 17]);
  // poikilaiva
  vb('stone', 52, 0, -74, 62, 15 - .4, -42, S, 0.3);
  vb('roof', 51.8, 14.6, -74.2, 62.2, 15, -41.8, [.5, .53, .6]);
  addCol(52, 0, -74, 62, 15, -42, { bld: true });
  World.mapRects.push([52, -74, 62, -42, 15]);
  // tukipilarit
  for (const x of [41, 47, 66, 72]) {
    vb('stone', x, 0, -65.1, x + 1.2, 12, -64, S); addCol(x, 0, -65.1, x + 1.2, 12, -64, { bld: true });
    vb('stone', x, 0, -50, x + 1.2, 12, -48.9, S); addCol(x, 0, -50, x + 1.2, 12, -48.9, { bld: true });
  }
  // korkeat ikkunat
  for (let x = 42.5; x < 75; x += 5.5) {
    if ((x > 50 && x < 64)) continue;
    vb('flat', x, 5, -50, x + 1.3, 12, -49.95, [.18, .15, .35]);
    vb('flat', x, 5, -64.05, x + 1.3, 12, -64, [.18, .15, .35]);
  }
  // ruusuikkuna tornin puolella
  vb('flat', 62, 7, -61, 62.05, 12, -55, [.35, .15, .3]);
  // torni
  makeLeapTower(40, -44, 49, -35, 38, 's', 'katedraali');
  // pieni kappeli / talot ympärille
  const list = World.blockB['1,-1'] = [];
  makeBuilding(33, -79, 50, -66, 11, { w: true, n: true, s: false, e: false }, list);
  makeBuilding(64, -79, 79, -66, 13, { w: false, n: true, s: false, e: true }, list);
  makeBuilding(66, -48, 79, -33, 10, { w: false, n: false, s: true, e: true }, list);
  makeBuilding(52, -46, 64, -33, 8, { w: false, n: false, s: true, e: false }, list);
  makeBuilding(33, -62, 38, -46, 9, { w: true, n: false, s: false, e: false }, list, { noProps: false });
  // aita / tori kirkon edessä: kaivo
  vb('stone', 56, 0, -34, 58, 1.0, -32, [.85, .85, .8]);
}

function makeMarket() {
  const list = World.blockB['0,0'] = [];
  // Julistuslava pohjoispuolella
  vb('wood', -6, 0, -19, 6, 0.9, -13, [.7, .55, .4]); addCol(-6, 0, -19, 6, 0.9, -13, { prop: true });
  for (const x of [-4.5, 4.5]) { vb('wood', x - .2, .9, -16.2, x + .2, 6.2, -15.8, [.45, .33, .22]); addCol(x - .2, .9, -16.2, x + .2, 6.2, -15.8, { prop: true }); }
  makeBeam(-5.2, 6.2, -16.4, 5.2, -15.6);
  vb('cloth', -4.3, 3.2, -16.0, -.5, 6.0, -15.95, [.7, .12, .12]); vb('cloth', .5, 3.2, -16.0, 4.3, 6.0, -15.95, [.7, .12, .12]);
  // portaat
  for (let i = 0; i < 3; i++) { vb('wood', -1.5, 0, -13 + i * .9, 1.5, .3 * (3 - i), -12.1 + i * .9, [.6, .45, .32]); }
  // suihkulähde
  vb('stone', -2.0, 0, -2.0, 2.0, 1.0, 2.0, [.95, .95, .92], 0.4);
  addCol(-2.0, 0, -2.0, 2.0, 1.0, 2.0, { prop: true, noNav: false });
  vb('stone', -.35, 1.0, -.35, .35, 3.0, .35, [.9, .9, .9]); addCol(-.35, 1.0, -.35, .35, 3.0, .35, { prop: true });
  World.fountain = { x: 0, z: 0 };
  // kojut
  const stalls = [[-17, -8], [-17, 1], [-17, 10], [17, -8], [17, 1], [17, 10], [-9, 15], [9, 15], [-9, -7], [9, -7]];
  stalls.forEach((s, i) => {
    const [sx, sz] = s;
    const cc = pick([[1, .45, .4], [.45, .6, 1], [.55, .9, .55], [1, .8, .35], [.9, .55, .9]]);
    vb('wood', sx - 1.3, 0, sz - .6, sx + 1.3, 1.0, sz + .6, [.65, .5, .36]); addCol(sx - 1.3, 0, sz - .6, sx + 1.3, 1.0, sz + .6, { prop: true });
    for (const px of [-1.5, 1.5]) for (const pz of [-1.1, 1.1]) vb('wood', sx + px - .06, 0, sz + pz - .06, sx + px + .06, 2.7, sz + pz + .06, [.45, .33, .22]);
    vb('cloth', sx - 1.8, 2.62, sz - 1.4, sx + 1.8, 2.78, sz + 1.4, cc);
    addCol(sx - 1.8, 2.62, sz - 1.4, sx + 1.8, 2.78, sz + 1.4, { oneWay: true, noLOS: true });
    // tavaraa
    for (let k = 0; k < 3; k++) vb('flat', sx - 1 + k * .8, 1.0, sz - .3, sx - .6 + k * .8, 1.3, sz + .3, pick([[.8, .2, .2], [.9, .7, .2], [.3, .6, .3], [.7, .5, .3]]));
  });
  // heinäkärryt
  makeHay(-20, -17, 3.4, 4.2); makeHay(20, -17, 3.4, 4.2); makeHay(0, 19.5, 4.2, 3.4);
  // laatikoita ja tynnyreitä
  for (let i = 0; i < 12; i++) {
    const a = rng() * Math.PI * 2, rr = rand(8, 20); const px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
    if (Math.abs(px) < 7 && pz < -12) continue;
    if (stalls.some(s => Math.abs(s[0] - px) < 3 && Math.abs(s[1] - pz) < 2.5)) continue;
    if (rng() < .5) { makeCrate(px, 0, pz); if (rng() < .5) makeCrate(px + .9, 0, pz + .1, .8); } else makeBarrel(px, 0, pz);
  }
  // liput
  for (const [fx, fz] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) {
    vb('wood', fx - .1, 0, fz - .1, fx + .1, 8, fz + .1, [.4, .3, .2]); addCol(fx - .1, 0, fz - .1, fx + .1, 8, fz + .1, { prop: true });
    vb('cloth', fx + .1, 5, fz - .02, fx + 2.2, 7.6, fz + .02, [.75, .15, .15]);
  }
  World.zones.market = { x: 0, z: 0 };
}

function genBlock(gx, gz, state) {
  const cx = gx * PITCH, cz = gz * PITCH;
  const bx0 = cx - BLOCK / 2, bx1 = cx + BLOCK / 2, bz0 = cz - BLOCK / 2, bz1 = cz + BLOCK / 2;
  const list = World.blockB[gx + ',' + gz] = [];
  const alley = 3, split = rand(0.42, 0.58);
  const wA = (BLOCK - alley) * split, wB = BLOCK - alley - wA;
  const cols = [[bx0, wA], [bx0 + wA + alley, wB]];
  let li = 0;
  for (let ci = 0; ci < 2; ci++) {
    const split2 = rand(0.4, 0.6);
    const dA = (BLOCK - alley) * split2, dB = BLOCK - alley - dA;
    const rows = [[bz0, dA], [bz0 + dA + alley, dB]];
    for (let ri = 0; ri < 2; ri++) {
      const lot = {
        x0: cols[ci][0], x1: cols[ci][0] + cols[ci][1], z0: rows[ri][0], z1: rows[ri][0] + rows[ri][1], li: li++,
        edges: { w: ci === 0, e: ci === 1, n: ri === 0, s: ri === 1 }
      };
      if (gx === -1 && gz === 1 && ci === 0 && ri === 1) {
        // toinen kellotorni
        const zc = (lot.z0 + lot.z1) / 2;
        makeLeapTower(lot.x0, zc - 4, lot.x0 + 8, zc + 4, 28, 'w', 'kellotorni');
        list.push({ x0: lot.x0, z0: zc - 4, x1: lot.x0 + 8, z1: zc + 4, h: 28, edges: { w: true, n: false, s: false, e: false } });
        // loput kiinteistöstä: pieni talo
        makeBuilding(lot.x0 + 11, lot.z0, lot.x1, lot.z1, 9, { w: false, n: false, s: true, e: ci === 1 }, list);
        continue;
      }
      makeLot(lot, list, state);
    }
  }
}

function connectStreets() {
  // köysisillat katujen yli
  let cnt = 0;
  for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) {
    const A = World.blockB[gx + ',' + gz];
    if (!A) continue;
    // itä-länsi
    const B = World.blockB[(gx + 1) + ',' + gz];
    if (B) {
      let n = 0;
      for (const a of A) for (const b of B) {
        if (n >= 3 || !a.edges.e || !b.edges.w) continue;
        const lo = Math.max(a.z0, b.z0) + 1.5, hi = Math.min(a.z1, b.z1) - 1.5;
        const mh = Math.min(a.h, b.h);
        if (hi - lo < 0 || mh < 8 || rng() > 0.6) continue;
        const z = rand(lo, hi);
        const c = makeRope(a.x1, b.x0, z - .1, z + .1, mh - 1.4); n++; cnt++;
        // tukitapit
        vb('wood', a.x1, mh - 1.55, z - .15, a.x1 + .35, mh - 1.2, z + .15, [.4, .3, .22]);
        vb('wood', b.x0 - .35, mh - 1.55, z - .15, b.x0, mh - 1.2, z + .15, [.4, .3, .22]);
      }
    }
    const C = World.blockB[gx + ',' + (gz + 1)];
    if (C) {
      let n = 0;
      for (const a of A) for (const b of C) {
        if (n >= 3 || !a.edges.s || !b.edges.n) continue;
        const lo = Math.max(a.x0, b.x0) + 1.5, hi = Math.min(a.x1, b.x1) - 1.5;
        const mh = Math.min(a.h, b.h);
        if (hi - lo < 0 || mh < 8 || rng() > 0.6) continue;
        const x = rand(lo, hi);
        makeRope(x - .1, x + .1, a.z1, b.z0, mh - 1.4); n++; cnt++;
        vb('wood', x - .15, mh - 1.55, a.z1, x + .15, mh - 1.2, a.z1 + .35, [.4, .3, .22]);
        vb('wood', x - .15, mh - 1.55, b.z0 - .35, x + .15, mh - 1.2, b.z0, [.4, .3, .22]);
      }
    }
  }
  return cnt;
}

function makeCityWalls() {
  const H = 13, T = 4, L = 100;
  const seg = (x0, z0, x1, z1, h) => {
    vb('stone', x0, 0, z0, x1, h, z1, [.95, .93, .9], rng() * 4);
    addCol(x0, 0, z0, x1, h, z1, { bld: true, wall: true });
    World.mapRects.push([x0, z0, x1, z1, h]);
  };
  seg(-L, -L, L, -L + T, H);       // pohjoinen
  seg(-L, L - T, -4, L, H);        // etelä vasen
  seg(4, L - T, L, L, H);          // etelä oikea
  seg(L - T, -L + T, L, L - T, H); // itä
  seg(-L, -L + T, -L + T, L - T, H); // länsi
  // tornit
  for (const [x, z] of [[-L, -L], [L - 10, -L], [-L, L - 10], [L - 10, L - 10]]) seg(x, z, x + 10, z + 10, 19);
  seg(-12, L - 8, -4, L, 18); seg(4, L - 8, 12, L, 18);
  seg(-5, -L, 5, -L + 7, 17); seg(L - 7, -5, L, 5, 17); seg(-L, -5, -L + 7, 5, 17);
  // portin holvi (vain visuaalinen)
  vb('stone', -4, 11, L - 6, 4, 13, L, [.9, .88, .84]);
  addCol(-4, 11, L - 6, 4, 13, L, { bld: true });
  // lyhdyt
  vb('flat', -3.6, 8, L - .4, -3.2, 9, L, [1, .7, .2]); vb('flat', 3.2, 8, L - .4, 3.6, 9, L, [1, .7, .2]);
}

function makeSafeHouse() {
  const x0 = -26, x1 = -16, z0 = 83, z1 = 93;
  const list = World.blockB['safe'] = [];
  makeBuilding(x0, z0, x1, z1, 6.5, { w: false, n: false, s: false, e: false }, list, { noProps: true });
  vb('flat', -22, 0, z0 - .12, -20, 2.5, z0 - .02, [.1, .45, .25]);
  vb('wood', x0 + 1, 6.5, z0 + 1, x0 + 1.15, 9.5, z0 + 1.15, [.4, .3, .2]);
  vb('cloth', x0 + 1.15, 8.2, z0 + 1, x0 + 3, 9.4, z0 + 1.03, [.1, .5, .3]);
  World.zones.safe = { x: -21, z: 80.5, r: 3.2 };
  makeHay(-12, 86, 3.4, 4.2);
}

World.trees = [];
function initBatches() {
  const B = World.batches;
  B.wall = new Batch(Tex.wall, 4); B.stone = new Batch(Tex.stone, 4); B.roof = new Batch(Tex.roof, 4);
  B.wood = new Batch(Tex.wood, 2); B.cloth = new Batch(Tex.cloth, 2); B.hay = new Batch(Tex.hay, 2); B.flat = new Batch(Tex.flat, 4);
}
// Kaupunki generoidaan kerran omiin koordinaatteihinsa; World.off siirtää sen paikoilleen.
function genCityBody(seed) {
  _rng = mulberry32(seed || 777);
  const state = { roofGuards: 0 };
  const ox = World.off.x, oz = World.off.z;
  makeCityWalls();
  makeMarket();
  makeCathedral();
  for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) {
    if ((gx === 0 && gz === 0) || (gx === 1 && gz === -1)) continue;
    genBlock(gx, gz, state);
  }
  connectStreets();
  // katutarvikkeita
  for (let i = 0; i < 26; i++) {
    const line = pick([-28, 28, 0]); const horiz = rng() < 0.5;
    const t = rand(-85, 85);
    const x = horiz ? t : line + rand(-3.5, 3.5), z = horiz ? line + rand(-3.5, 3.5) : t;
    if (Math.abs(x) < 24 && Math.abs(z) < 24) continue;
    const f = World.colliders.some(c => c.bld && x + ox > c.x0 - 1.5 && x + ox < c.x1 + 1.5 && z + oz > c.z0 - 1.5 && z + oz < c.z1 + 1.5);
    if (f) continue;
    if (rng() < 0.4) { makeCrate(x, 0, z); makeCrate(x + .95, 0, z + .1, .8); if (rng() < .5) makeCrate(x + .3, .9, z, .7); }
    else if (rng() < 0.6) makeBarrel(x, 0, z);
    else makeHay(x, z, 3.2, 2.6);
  }
  // heinäkärryjä korkeiden rakennusten juurelle
  const tall = [];
  for (const k in World.blockB) for (const b of World.blockB[k]) if (!b._abs && b.h >= 16 && !b.guardRoof) tall.push(b);
  for (let i = 0; i < Math.min(4, tall.length); i++) {
    const b = tall[i];
    for (const s of ['n', 's', 'e', 'w']) if (b.edges[s]) {
      let hx, hz;
      if (s === 'n') { hx = (b.x0 + b.x1) / 2; hz = b.z0 - 3.2; } else if (s === 's') { hx = (b.x0 + b.x1) / 2; hz = b.z1 + 3.2; }
      else if (s === 'w') { hx = b.x0 - 3.2; hz = (b.z0 + b.z1) / 2; } else { hx = b.x1 + 3.2; hz = (b.z0 + b.z1) / 2; }
      makeHay(hx, hz, 3.4, 3.0); break;
    }
  }
}

// ---------- Näkyvän maailman rakennus ----------
function buildWorldMeshes(scene) {
  for (const k in World.batches) scene.add(World.batches[k].build());
  // maa
  const gm = new THREE.MeshLambertMaterial({ map: Tex.ground });
  Tex.ground.repeat.set(52, 52);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(210, 210), gm);
  g.rotation.x = -Math.PI / 2; g.position.y = 0; g.receiveShadow = true; scene.add(g);
  const gr = new THREE.MeshLambertMaterial({ map: Tex.grass });
  Tex.grass.repeat.set(120, 120);
  const out = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), gr);
  out.rotation.x = -Math.PI / 2; out.position.y = -0.06; out.receiveShadow = true; scene.add(out);
  // tie portilta ulos
  const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 120), new THREE.MeshLambertMaterial({ color: 0x9a8666 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, 160); road.receiveShadow = true; scene.add(road);
  // suihkulähteen vesi + kaarevat osat
  const fm = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.12, 24), new THREE.MeshPhongMaterial({ color: 0x4d88b8, transparent: true, opacity: .85, shininess: 90 }));
  fm.position.set(0, 0.98, 0); scene.add(fm);
  // puut
  const outer = [];
  for (let i = 0; i < 90; i++) {
    const a = rng() * Math.PI * 2, r = rand(115, 340);
    outer.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  for (let z = 108; z < 190; z += 9) { outer.push([-8 + rand(-1, 1), z]); outer.push([8 + rand(-1, 1), z]); }
  const all = World.trees.concat(outer);
  const trunkG = new THREE.CylinderGeometry(0.25, 0.35, 3, 6); trunkG.translate(0, 1.5, 0);
  const leafG = new THREE.ConeGeometry(2.0, 6, 7); leafG.translate(0, 5.5, 0);
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshLambertMaterial({ color: 0x5a4028 }), all.length);
  const leaves = new THREE.InstancedMesh(leafG, new THREE.MeshLambertMaterial({ color: 0x35602f }), all.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  all.forEach((t, i) => {
    const s = 0.8 + Math.random() * 0.8; pos.set(t[0], 0, t[1]); sc.set(s, s, s);
    m.compose(pos, q, sc); trunks.setMatrixAt(i, m); leaves.setMatrixAt(i, m);
  });
  trunks.castShadow = leaves.castShadow = true; scene.add(trunks); scene.add(leaves);
  // etäiset vuoret
  const mm = new THREE.MeshLambertMaterial({ color: 0x7d8da0, flatShading: true });
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + Math.random() * 0.2, r = 520 + Math.random() * 120;
    const h = 80 + Math.random() * 140;
    const c = new THREE.Mesh(new THREE.ConeGeometry(70 + Math.random() * 60, h, 6), mm);
    c.position.set(Math.cos(a) * r, h / 2 - 5, Math.sin(a) * r); scene.add(c);
  }
}
