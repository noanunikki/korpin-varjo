'use strict';
// =====================================================================
//  PELAAJA: parkour (kiipeily, seinäjuoksu, mantle, loikat), taistelu, kamera
// =====================================================================
const G = 26, JUMP = 8.4;
const Input = { keys: {}, pressed: {}, ml: false, mr: false, mlp: false, mrp: false, dx: 0, dy: 0 };
const K = (c) => !!Input.keys[c];

const Cam = {
  yaw: 0, pitch: 0.28, dist: 5.2, curDist: 5.2, roll: 0, fov: 62, camera: null, lastInput: 0,
  update(dt, P) {
    const cam = this.camera;
    // automaattinen seuranta: kamera kääntyy juoksusuunnan taakse kun et käännä sitä itse
    if (performance.now() - this.lastInput > 1200 && P.state === 'ground' && K('KeyW') && !K('KeyS') && P.rollT <= 0 && Math.hypot(P.vel.x, P.vel.z) > 5.5) {
      this.yaw += angDiff(this.yaw, P.face + Math.PI) * Math.min(1, 1.1 * dt);
    }
    const crouchOff = P.crouch ? 1.05 : 1.5;
    const piv = new V3(P.pos.x, P.pos.y + crouchOff, P.pos.z);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    piv.x += rx * 0.45; piv.z += rz * 0.45;
    let want = 5.0;
    if (P.state === 'climb') want = 5.8;
    else if (P.state === 'wallrun') want = 5.6;
    else if (P.dive || P.freefall) want = 8.5;
    else if (P.state === 'ground' && P.sprint && Math.hypot(P.vel.x, P.vel.z) > 6) want = 5.6;
    else if (P.attackT > 0 || P.blocking) want = 4.4;
    if (P.state === 'hidden') want = 4.0;
    const cp = Math.cos(this.pitch);
    const dir = new V3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const d = rayDist(piv.x, piv.y, piv.z, dir.x, dir.y, dir.z, want + 0.4, true);
    const cd = Math.max(0.6, Math.min(want, d - 0.4));
    if (cd < this.curDist) this.curDist = cd; else this.curDist = damp(this.curDist, cd, 3, dt);
    cam.position.set(piv.x + dir.x * this.curDist, piv.y + dir.y * this.curDist, piv.z + dir.z * this.curDist);
    if (cam.position.y < 0.25) cam.position.y = 0.25;
    cam.lookAt(piv.x, piv.y + 0.1, piv.z);
    let tr = 0;
    if (P.state === 'wallrun' && P.wr) tr = P.wr.side * -0.12;
    if (P.groundBox && P.groundBox.rope && P.state === 'ground') tr = Math.sin(performance.now() / 400) * 0.03;
    this.roll = damp(this.roll, tr, 6, dt);
    cam.rotateZ(this.roll);
    let tf = 62;
    if (P.state === 'ground' && P.sprint && Math.hypot(P.vel.x, P.vel.z) > 6) tf = 70;
    if (P.dive || P.freefall) tf = 78;
    if (P.state === 'wallrun') tf = 72;
    this.fov = damp(this.fov, tf, 4, dt);
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  },
};

const Player = {
  pos: new V3(0, 0, 112), vel: new V3(), r: 0.32, h: 1.8, face: Math.PI, state: 'ground',
  hp: 100, maxHp: 100, onGround: false, stepH: 0, hitX: null, hitZ: null, groundBox: null, landImpact: 0,
  sprint: false, crouch: false, blocking: false, attackT: 0, attackCd: 0, combo: 0, comboT: 0, hitDone: false,
  coyoteT: 0, jumpBuf: 0, airSpeed: 4.4, fallPeak: 0, dive: false, freefall: false,
  cn: null, cbox: null, hang: false, boost: 0, jumpWall: null,
  mantle: null, wr: null, kill: null, hay: null, hideT: 0,
  hurtT: 0, regenT: 0, deadT: 0, vis: { off: 0 }, vaultT: 0, stepAcc: 0, dead: false, noise: 0,
  rollT: 0, slideT: 0, slideDir: 0, runUp: 0, varJump: false,
  rig: null,

  init(scene) {
    this.rig = makeHumanoid('raven');
    this.rig.alwaysSword = false;
    scene.add(this.rig.root);
  },

  reset(pos, face) {
    this.pos.copy(pos); this.vel.set(0, 0, 0); this.face = face || 0; this.state = 'ground'; this.hp = this.maxHp;
    this.crouch = false; this.h = 1.8; this.dive = false; this.freefall = false; this.dead = false; this.hurtT = 0;
    this.attackT = 0; this.blocking = false; this.rig.root.visible = true; this.rig.cur = {}; this.vis.off = 0; this.hay = null;
    this.rig.tilt.rotation.set(0, 0, 0);
    this.rollT = 0; this.slideT = 0; this.runUp = 0; this.varJump = false;
  },

  nearPerch() {
    for (const p of World.perches) {
      const dx = this.pos.x - p.x, dz = this.pos.z - p.z;
      if (dx * dx + dz * dz < p.r * p.r && Math.abs(this.pos.y - p.y) < 1.5) return p;
    }
    return null;
  },

  // ---- päivitys ----
  update(dt) {
    const I = Input;
    this.sprint = K('ShiftLeft') || K('ShiftRight');
    const mx = (K('KeyD') ? 1 : 0) - (K('KeyA') ? 1 : 0), mz = (K('KeyW') ? 1 : 0) - (K('KeyS') ? 1 : 0);
    const cy = Cam.yaw;
    const wx = -Math.sin(cy) * mz + Math.cos(cy) * mx, wz = -Math.cos(cy) * mz - Math.sin(cy) * mx;
    const len = Math.hypot(wx, wz);
    const d = { x: len > 0 ? wx / len : 0, z: len > 0 ? wz / len : 0, m: Math.min(1, len), mz };
    if (I.pressed.Space) this.jumpBuf = 0.14; else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    this.vis.off = damp(this.vis.off, 0, 14, dt);
    this.vaultT = Math.max(0, this.vaultT - dt);
    this.rollT = Math.max(0, this.rollT - dt);
    this.noise = Math.max(0, this.noise - dt * 3);

    if (this.state !== 'dead') {
      this.regenT -= dt;
      if (this.regenT <= 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 8 * dt);
    }

    switch (this.state) {
      case 'ground': this.stGround(dt, d); break;
      case 'air': this.stAir(dt, d); break;
      case 'climb': this.stClimb(dt, d); break;
      case 'mantle': this.stMantle(dt, d); break;
      case 'wallrun': this.stWallrun(dt, d); break;
      case 'hidden': this.stHidden(dt, d); break;
      case 'kill': this.stKill(dt, d); break;
      case 'dead': this.stDead(dt); break;
    }
    if (this.state === 'ground' || this.state === 'air') this.combat(dt);
    this.updateModel(dt);
  },

  // ---- Maa ----
  stGround(dt, d) {
    const wantCrouch = K('KeyC') || K('ControlLeft');
    const hs0 = Math.hypot(this.vel.x, this.vel.z);
    // liuku: C kovassa vauhdissa
    if ((Input.pressed.KeyC || Input.pressed.ControlLeft) && hs0 > 5.5 && this.onGround && this.rollT <= 0) { this.slideT = 0.85; this.slideDir = Math.atan2(this.vel.x, this.vel.z); Sfx.land(8); }
    this.slideT = Math.max(0, this.slideT - dt);
    if (this.rollT > 0) { d = { x: Math.sin(this.face), z: Math.cos(this.face), m: 1 }; this.jumpBuf = 0; }
    if (wantCrouch && !this.crouch) { this.crouch = true; this.h = 1.3; }
    else if (!wantCrouch && this.crouch && this.slideT <= 0 && freeAt(this, this.pos.x, this.pos.y, this.pos.z, 1.8)) { this.crouch = false; this.h = 1.8; }
    // vauhdin kasvu: juoksu kiihtyy portaattomasti
    if (this.sprint && d.m > 0.3 && this.onGround) this.runUp = Math.min(1, this.runUp + dt * 2.4);
    else if (!(this.sprint && d.m > 0.3)) this.runUp = Math.max(0, this.runUp - dt * 4);
    const bal = this.groundBox && this.groundBox.rope;
    let sp = this.crouch ? 2.0 : (this.sprint ? 5.8 + 3.0 * this.runUp : 4.4);
    if (this.rollT > 0) sp = 7;
    if (bal) sp = Math.min(sp, 3.4);
    if (this.blocking) sp *= 0.5;
    if (this.attackT > 0) sp *= 0.45;
    let k = d.m > 0.05 ? 10 : 16;
    if (this.slideT > 0) { k = 1.6; d = { x: Math.sin(this.slideDir), z: Math.cos(this.slideDir), m: 1 }; sp = 2.0; }
    if (this.rollT > 0) k = 14;
    this.vel.x = damp(this.vel.x, d.x * sp * d.m, k, dt);
    this.vel.z = damp(this.vel.z, d.z * sp * d.m, k, dt);
    if (d.m > 0.1 && !(this.attackT > 0) && this.slideT <= 0 && this.rollT <= 0) this.face += angDiff(this.face, Math.atan2(d.x, d.z)) * Math.min(1, 16 * dt);
    if (this.slideT > 0) this.face += angDiff(this.face, this.slideDir) * Math.min(1, 12 * dt);
    if (this.blocking && Game.lockTarget) this.face += angDiff(this.face, Game.lockTarget) * Math.min(1, 10 * dt);

    let jumped = false;
    if (this.jumpBuf > 0 && (this.onGround || this.coyoteT > 0) && (!this.crouch || this.slideT > 0)) {
      this.jumpBuf = 0; this.coyoteT = 0; jumped = true; this.slideT = 0;
      if (this.crouch && freeAt(this, this.pos.x, this.pos.y, this.pos.z, 1.8)) { this.crouch = false; this.h = 1.8; }
      this.varJump = true;
      this.vel.y = JUMP; this.airSpeed = Math.max(4.4, Math.hypot(this.vel.x, this.vel.z) * 1.05);
      if (this.sprint && this.runUp > 0.5) { this.vel.x *= 1.06; this.vel.z *= 1.06; }
      this.state = 'air'; this.fallPeak = this.pos.y; this.onGround = false; this.dive = false; Sfx.jump();
      const pz = this.nearPerch();
      if (pz) {
        this.dive = true; this.vel.x = Math.sin(this.face) * 5.5; this.vel.z = Math.cos(this.face) * 5.5; this.vel.y = 3.5; this.airSpeed = 5.5;
        Game.toast('Uskon loikka!');
      }
    } else this.vel.y -= G * dt;
    this.stepH = (this.onGround && !jumped) ? 0.5 : 0;
    const pv = this.vel.clone();
    moveEntity(this, dt);
    if (jumped) return;

    if (!this.onGround) {
      this.coyoteT = Math.max(0, this.coyoteT - dt);
      if (this.coyoteT <= 0 || this.vel.y > 0) { this.state = 'air'; this.fallPeak = this.pos.y; this.airSpeed = Math.max(4.4, Math.hypot(pv.x, pv.z)); }
      if (this.coyoteT <= 0 && this.state === 'ground') { this.state = 'air'; this.fallPeak = this.pos.y; }
    } else this.coyoteT = 0.12;
    if (this.state === 'air' && this.onGround === false && this.coyoteT === 0.12) this.coyoteT = 0.1;

    // askelääni
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hs > 0.8) {
      this.stepAcc += hs * dt;
      if (this.stepAcc > (this.sprint ? 2.6 : 1.8)) { this.stepAcc = 0; if (!this.crouch) Sfx.step(); }
      this.noise = Math.max(this.noise, this.crouch ? 0 : (this.sprint ? 1 : 0.4));
    }
    // esteet: hyppy / kiipeäminen (vapaa juoksu = Shift)
    if (this.sprint && d.m > 0.3 && this.onGround) {
      const hits = [this.hitX, this.hitZ].filter(Boolean);
      for (const h of hits) {
        if (h.c.oneWay) continue;
        const into = -(d.x * h.nx + d.z * h.nz);
        if (into < 0.45) continue;
        const hh = h.c.y1 - this.pos.y;
        if (hh > 0.5 && hh <= 1.5 && freeAt(this, this.pos.x - h.nx * 0.5, h.c.y1 + EPS, this.pos.z - h.nz * 0.5, 1.8)) {
          this.pos.x -= h.nx * 0.55; this.pos.z -= h.nz * 0.55; this.pos.y = h.c.y1 + EPS;
          this.vis.off = -hh; this.vaultT = 0.3; this.vel.x = d.x * 7; this.vel.z = d.z * 7; Sfx.jump();
          break;
        }
        if (hh > 1.5 && !h.c.noClimb && !h.c.hay) { this.attach(h, false); this.boost = K('Space') ? 0.5 : 0; break; }
      }
    }
    this.prevGround = this.onGround;
  },

  land(pv) {
    const imp = this.landImpact || -pv.y;
    const fallH = this.fallPeak - this.pos.y;
    const gb = this.groundBox;
    const wasDive = this.dive || this.freefall;
    this.dive = false; this.freefall = false;
    this.state = 'ground'; this.coyoteT = 0.12;
    if (gb && gb.hay) {
      if (fallH > 5) {
        Sfx.land(8);
        if (fallH > 12) { Game.stats.leaps++; Game.toast('Uskon loikka onnistui!', 'good'); Sfx.pickup(); }
        this.enterHide(gb); return;
      }
      Sfx.land(imp * 0.5); return;
    }
    // pudotusrullaus: pidä liikesuuntaa laskeutuessa -> ei vahinkoa, vauhti säilyy
    if (fallH > 4.5 && fallH <= 18 && (K('KeyW') || K('KeyA') || K('KeyS') || K('KeyD'))) {
      const hv = Math.hypot(pv.x, pv.z);
      if (hv > 1.5) this.face = Math.atan2(pv.x, pv.z);
      this.rollT = 0.55; this.vel.set(0, 0, 0); this.crouch = false; this.h = 1.8;
      Sfx.land(imp * 0.6); Game.shake = 0.08; this.noise = 1;
      return;
    }
    if (fallH > 9) {
      const dmg = (fallH - 9) * 9;
      Sfx.land(imp);
      if (fallH > 22) { this.takeDamage(999, null, true); return; }
      this.takeDamage(dmg, null, true);
      this.vel.x *= 0.2; this.vel.z *= 0.2;
    } else if (imp > 6) { Sfx.land(imp); if (imp > 11) { this.vel.x *= 0.5; this.vel.z *= 0.5; } }
    this.noise = 1;
  },

  // ---- Ilma ----
  stAir(dt, d) {
    this.fallPeak = Math.max(this.fallPeak, this.pos.y);
    if (d.m > 0.1) {
      const t = this.airSpeed * (this.dive ? 0.5 : 1) * d.m;
      this.vel.x = damp(this.vel.x, d.x * t, 2.6, dt); this.vel.z = damp(this.vel.z, d.z * t, 2.6, dt);
    }
    // seinäapu: ponnistuksen jälkeen työnnä seinää kohti jotta ote tarttuu
    if (this.jumpWall) {
      this.jumpWall.t -= dt;
      if (this.jumpWall.t <= 0 || !this.sprint) this.jumpWall = null;
      else { this.vel.x = -this.jumpWall.n.x * 1.8; this.vel.z = -this.jumpWall.n.z * 1.8; }
    }
    this.vel.y = Math.max(-52, this.vel.y - G * dt);
    // muuttuva hypyn korkeus: pikainen painallus = matala hyppy
    if (this.varJump) { if (this.vel.y <= 0) this.varJump = false; else if (!K('Space')) this.vel.y -= G * 1.5 * dt; }
    // loikan apu: ohjaa kohti lähintä heinäkärryä
    if (this.dive && this.vel.y < 0) {
      let best = null, bd = 18;
      for (const h of World.hays) { const dx = h.cx - this.pos.x, dz = h.cz - this.pos.z, dd = Math.hypot(dx, dz); if (dd < bd && this.pos.y > h.y1 + 2) { bd = dd; best = h; } }
      if (best) {
        const tf = Math.max(0.3, (-this.vel.y + Math.sqrt(this.vel.y * this.vel.y + 2 * G * (this.pos.y - best.y1))) / G);
        const wvx = (best.cx - this.pos.x) / tf, wvz = (best.cz - this.pos.z) / tf;
        this.vel.x = damp(this.vel.x, wvx, 1.8, dt); this.vel.z = damp(this.vel.z, wvz, 1.8, dt);
      }
    }
    if (!this.dive && this.fallPeak - this.pos.y > 7 && this.vel.y < -12) this.freefall = true;
    const pv = this.vel.clone();
    this.stepH = 0;
    moveEntity(this, dt);
    if (this.onGround) { this.land(pv); return; }
    if (this.jumpBuf > 0 && this.coyoteT > 0 && this.vel.y <= 1) { this.jumpBuf = 0; this.coyoteT = 0; this.vel.y = JUMP; Sfx.jump(); }
    this.coyoteT = Math.max(0, this.coyoteT - dt);
    if ((this.sprint || K('Space')) && !this.dive) this.airWall(pv, d);
  },

  airWall(pv, d) {
    const hits = [this.hitX, this.hitZ].filter(Boolean);
    for (const h of hits) {
      const c = h.c;
      if (c.oneWay || c.noClimb || c.hay) continue;
      const impN = -(pv.x * h.nx + pv.z * h.nz);
      const tx = -h.nz, tz = h.nx, tang = pv.x * tx + pv.z * tz;
      const hh = c.y1 - this.pos.y;
      if (hh < 0.5) continue;
      if (Math.abs(tang) > 4.5 && Math.abs(tang) > impN && hh > 2.4 && this.pos.y > 0.9) { this.startWallrun(h, Math.sign(tang)); return; }
      if (impN > 1.2 || (d.m > 0.2 && -(d.x * h.nx + d.z * h.nz) > 0.3)) {
        if (hh <= 1.6) { if (this.startMantle(c, { x: h.nx, z: h.nz })) return; continue; }
        if (hh <= 3.4) { const ny = c.y1 - 1.88; if (freeAt(this, this.pos.x, ny, this.pos.z, 1.8)) this.pos.y = ny; this.attach(h, true); return; }
        this.attach(h, false); return;
      }
    }
  },

  // ---- Kiipeily ----
  attach(h, hang) {
    const c = h.c;
    this.state = 'climb'; this.cn = { x: h.nx, z: h.nz }; this.cbox = c; this.vel.set(0, 0, 0); this.dive = false; this.freefall = false;
    this.face = Math.atan2(-h.nx, -h.nz); this.hang = hang; this.jumpWall = null;
    if (this.crouch) { this.crouch = false; this.h = 1.8; }
    if (h.nx > 0) this.pos.x = c.x1 + this.r + EPS; else if (h.nx < 0) this.pos.x = c.x0 - this.r - EPS;
    if (h.nz > 0) this.pos.z = c.z1 + this.r + EPS; else if (h.nz < 0) this.pos.z = c.z0 - this.r - EPS;
    Sfx.step();
  },

  findWall(n) {
    const p = this.pos, r = this.r, g = 0.09;
    let x0 = p.x - r, x1 = p.x + r, z0 = p.z - r, z1 = p.z + r;
    if (n.x > 0) x0 -= g; else if (n.x < 0) x1 += g;
    if (n.z > 0) z0 -= g; else if (n.z < 0) z1 += g;
    let best = null, bo = 0;
    for (const c of query(x0, z0, x1, z1)) {
      if (c.oneWay || c.noClimb || c.hay) continue;
      if (x1 <= c.x0 || x0 >= c.x1 || z1 <= c.z0 || z0 >= c.z1) continue;
      if (c.y1 < p.y + 0.6 || c.y0 > p.y + 1.4) continue;
      if (n.x > 0 && Math.abs((p.x - r) - c.x1) > g + 0.02) continue;
      if (n.x < 0 && Math.abs((p.x + r) - c.x0) > g + 0.02) continue;
      if (n.z > 0 && Math.abs((p.z - r) - c.z1) > g + 0.02) continue;
      if (n.z < 0 && Math.abs((p.z + r) - c.z0) > g + 0.02) continue;
      const ov = n.x !== 0 ? Math.min(z1, c.z1) - Math.max(z0, c.z0) : Math.min(x1, c.x1) - Math.max(x0, c.x0);
      if (ov > bo) { bo = ov; best = c; }
    }
    return bo > 0.08 ? best : null;
  },

  stClimb(dt, d) {
    const n = this.cn;
    const rxv = n.z, rzv = -n.x;
    const fwd = -(d.x * n.x + d.z * n.z), lat = d.x * rxv + d.z * rzv;
    let up = d.m > 0.15 ? clamp(fwd * 1.5, -1, 1) : 0, lt = d.m > 0.15 ? clamp(lat * 1.5, -1, 1) : 0;
    if (Math.abs(up) < 0.25) up = 0;
    if (Math.abs(lt) < 0.25) lt = 0;
    const c = this.cbox, maxFeet = c.y1 - 1.88;
    const atTop = this.pos.y >= maxFeet - 0.03;
    this.hang = atTop;
    let us = up > 0 ? 3.8 : 3.0;
    if (this.boost > 0) { us = 7.5 * (this.boost / 0.5) + 3.8; this.boost -= dt; if (up <= 0) up = 1; }
    // loikat
    if (K('KeyC') || K('ControlLeft')) { this.state = 'air'; this.vel.set(n.x * 0.8, 0, n.z * 0.8); this.fallPeak = this.pos.y; return; }
    if (this.jumpBuf > 0) {
      this.jumpBuf = 0;
      if (atTop && up > 0) { if (this.startMantle(c, n)) return; }
      if (up > 0.4 && !atTop) { // ylöspäin-loikka
        this.state = 'air'; this.vel.set(0, 9.4, 0); this.jumpWall = { n, t: 0.7 }; this.airSpeed = 4.4; this.fallPeak = this.pos.y; Sfx.jump(); return;
      }
      this.state = 'air'; this.vel.set(n.x * 6.5, 7.6, n.z * 6.5); this.airSpeed = 6.5; this.fallPeak = this.pos.y;
      this.face = Math.atan2(n.x, n.z); Sfx.jump(); return;
    }
    if (atTop && up > 0) { if (this.startMantle(c, n)) return; }
    this.vel.x = rxv * lt * 3.2; this.vel.z = rzv * lt * 3.2; this.vel.y = (atTop && up > 0) ? 0 : up * us;
    this.stepH = 0;
    moveEntity(this, dt);
    this.cs = Math.abs(lt) * 0.8 + Math.abs(up);
    if (this.onGround && up < 0) { this.state = 'ground'; this.vel.set(0, 0, 0); return; }
    if (this.onGround && up >= 0 && this.pos.y <= 0.01) { this.state = 'ground'; return; }
    if (this.pos.y > maxFeet) this.pos.y = maxFeet;
    // sisänurkka
    if (lt !== 0) {
      const w = { x: rxv * Math.sign(lt), z: rzv * Math.sign(lt) };
      const hit = [this.hitX, this.hitZ].filter(Boolean).find(h => !h.c.oneWay && !h.c.noClimb && !h.c.hay && (h.nx * w.x + h.nz * w.z) < -0.5);
      if (hit) { this.cn = { x: hit.nx, z: hit.nz }; this.cbox = hit.c; this.face = Math.atan2(-hit.nx, -hit.nz); return; }
    }
    const wall = this.findWall(n);
    if (wall) { this.cbox = wall; return; }
    // ulkonurkka
    if (lt !== 0) {
      const cb = this.cbox, s = Math.sign(lt), w = { x: rxv * s, z: rzv * s };
      const p = this.pos, np = new V3(p.x, p.y, p.z), off = this.r + 0.03;
      if (w.x > 0) np.x = cb.x1 + off; else if (w.x < 0) np.x = cb.x0 - off;
      if (w.z > 0) np.z = cb.z1 + off; else if (w.z < 0) np.z = cb.z0 - off;
      if (n.x > 0) np.x = cb.x1 - 0.2; else if (n.x < 0) np.x = cb.x0 + 0.2;
      if (n.z > 0) np.z = cb.z1 - 0.2; else if (n.z < 0) np.z = cb.z0 + 0.2;
      if (freeAt(this, np.x, np.y, np.z, 1.8)) {
        p.copy(np); this.cn = { x: w.x, z: w.z }; this.face = Math.atan2(-w.x, -w.z); this.vel.set(0, 0, 0);
        return;
      }
    }
    // ei seinää: irtoa
    this.state = 'air'; this.vel.set(n.x * 0.5, 0, n.z * 0.5); this.fallPeak = this.pos.y;
  },

  startMantle(c, n) {
    const p = this.pos;
    for (const o of [0.6, 0.45, 0.35]) {
      const tx = p.x - n.x * (this.r + o), tz = p.z - n.z * (this.r + o);
      if (freeAt(this, tx, c.y1 + EPS, tz, 1.8)) {
        this.mantle = { t: 0, dur: 0.62, fx: p.x, fy: p.y, fz: p.z, tx, ty: c.y1 + EPS, tz, nx: n.x, nz: n.z };
        this.state = 'mantle'; this.vel.set(0, 0, 0); this.dive = false;
        return true;
      }
    }
    return false;
  },
  stMantle(dt, d) {
    const m = this.mantle; m.t += dt;
    const u = Math.min(1, m.t / m.dur), p = this.pos;
    const a = Math.min(1, u / 0.55), b = Math.max(0, (u - 0.5) / 0.5);
    const ea = 1 - Math.pow(1 - a, 3), eb = b * b * (3 - 2 * b);
    p.y = lerp(m.fy, m.ty, ea);
    p.x = lerp(lerp(m.fx, m.fx + (m.tx - m.fx) * 0.15, ea), m.tx, eb);
    p.z = lerp(lerp(m.fz, m.fz + (m.tz - m.fz) * 0.15, ea), m.tz, eb);
    this.face = Math.atan2(-m.nx, -m.nz);
    if (u >= 1) {
      this.state = 'ground'; this.coyoteT = 0.12;
      if (K('KeyW') && this.sprint) { this.vel.x = -m.nx * 5; this.vel.z = -m.nz * 5; } else this.vel.set(0, 0, 0);
    }
  },

  // ---- Seinäjuoksu ----
  startWallrun(h, sgn) {
    this.state = 'wallrun';
    const dx = -h.nz * sgn, dz = h.nx * sgn;
    const cross = dz * (-h.nx) - dx * (-h.nz);
    this.wr = { nx: h.nx, nz: h.nz, c: h.c, t: 0, sx: dx, sz: dz, side: cross > 0 ? 1 : -1 };
    this.face = Math.atan2(dx, dz); this.dive = false;
    Sfx.step();
  },
  stWallrun(dt, d) {
    const w = this.wr; w.t += dt;
    const sp = 7.4;
    this.vel.x = w.sx * sp - w.nx * 1.2; this.vel.z = w.sz * sp - w.nz * 1.2;
    this.vel.y = 2.2 - w.t * 4;
    if (this.jumpBuf > 0) {
      this.jumpBuf = 0; this.state = 'air'; this.vel.set(w.nx * 4.5 + w.sx * 5.5, 8.6, w.nz * 4.5 + w.sz * 5.5); this.airSpeed = 7; this.fallPeak = this.pos.y; Sfx.jump(); return;
    }
    this.stepH = 0;
    const pv = this.vel.clone();
    moveEntity(this, dt);
    if (this.onGround) { this.land(pv); return; }
    const hh = w.c.y1 - this.pos.y;
    if (hh < 2.4 && hh > 1.3) { const ny = w.c.y1 - 1.88; if (freeAt(this, this.pos.x, ny, this.pos.z, 1.8)) { this.pos.y = ny; this.attach({ c: w.c, nx: w.nx, nz: w.nz }, true); return; } }
    const wall = this.findWall({ x: w.nx, z: w.nz });
    if (!wall || w.t > 1.5 || !this.sprint || Math.hypot(this.vel.x, this.vel.z) < 2) {
      this.state = 'air'; this.airSpeed = 6; this.fallPeak = this.pos.y;
      this.vel.x = w.sx * 5; this.vel.z = w.sz * 5;
    }
  },

  // ---- Heinäkasa ----
  enterHide(hay) {
    this.state = 'hidden'; this.hay = hay; this.hideT = 0; this.vel.set(0, 0, 0);
    this.pos.set(hay.cx, hay.y1 - 1.0, hay.cz); this.rig.root.visible = false; this.crouch = false; this.h = 1.8;
    Game.toast('Piilossa heinäkasassa');
  },
  exitHide() {
    const h = this.hay; this.state = 'ground'; this.pos.set(h.cx, h.y1 + 0.02, h.cz); this.rig.root.visible = true; this.vel.set(0, 0, 0);
  },
  stHidden(dt, d) {
    this.hideT += dt;
    if (this.hideT > 0.5 && (d.m > 0.1 || Input.pressed.Space || Input.pressed.KeyE)) this.exitHide();
  },

  // ---- Salamurha ----
  tryAssassinate() {
    let best = null, bd = 1e9;
    const air = this.state === 'air' && this.vel.y < -1;
    for (const g of Guards.list) {
      if (g.dead) continue;
      const dx = g.pos.x - this.pos.x, dz = g.pos.z - this.pos.z, dy = this.pos.y - g.pos.y;
      const dh = Math.hypot(dx, dz);
      if (air) { if (dh < 2.4 && dy > 0.6 && dy < 10 && dh < bd) { best = g; bd = dh; } }
      else if (this.state === 'ground' || this.state === 'climb') {
        if (dh < 2.4 && Math.abs(dy) < 1.5 && g.canAssassinate() && dh < bd) { best = g; bd = dh; }
      }
    }
    if (!best) return false;
    const g = best;
    const dirx = this.pos.x - g.pos.x, dirz = this.pos.z - g.pos.z, dl = Math.hypot(dirx, dirz) || 1;
    const aerial = air;
    this.kill = {
      g, t: 0, dur: aerial ? 0.35 : 0.5, aerial, fx: this.pos.x, fy: this.pos.y, fz: this.pos.z,
      tx: g.pos.x + dirx / dl * 0.85, tz: g.pos.z + dirz / dl * 0.85, ty: g.pos.y, done: false
    };
    this.state = 'kill'; this.vel.set(0, 0, 0); this.face = Math.atan2(-dirx, -dirz); this.dive = false; this.freefall = false;
    return true;
  },
  stKill(dt) {
    const k = this.kill; k.t += dt; const u = Math.min(1, k.t / k.dur);
    const e = 1 - Math.pow(1 - u, 2);
    this.pos.x = lerp(k.fx, k.tx, e); this.pos.z = lerp(k.fz, k.tz, e);
    this.pos.y = k.aerial ? lerp(k.fy, k.ty, e) : lerp(k.fy, k.ty, e);
    if (u > 0.5 && !k.done) { k.done = true; k.g.assassinate(k.aerial); }
    if (u >= 1) { this.state = k.aerial ? 'air' : 'ground'; this.vel.set(0, k.aerial ? 5 : 0, 0); this.fallPeak = this.pos.y; this.coyoteT = 0.1; }
  },

  // ---- Taistelu ----
  combat(dt) {
    this.blocking = Input.mr && this.state === 'ground' && !this.crouch;
    if (Input.mlp && this.attackCd <= 0 && this.state === 'ground' && !this.blocking) {
      this.attackT = 0.38; this.attackCd = 0.46; this.hitDone = false; this.combo = (this.combo % 3) + 1; this.comboT = 1.2;
      let tg = Game.nearestEnemy(3.5);
      if (tg) { this.face = Math.atan2(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z); this.vel.x = Math.sin(this.face) * 3; this.vel.z = Math.cos(this.face) * 3; }
      Sfx.swing();
    }
    if (this.attackT > 0) {
      this.attackT -= dt;
      if (!this.hitDone && this.attackT < 0.24) {
        this.hitDone = true;
        let any = false;
        for (const g of Guards.list) {
          if (g.dead) continue;
          const dx = g.pos.x - this.pos.x, dz = g.pos.z - this.pos.z, dh = Math.hypot(dx, dz);
          if (dh > 2.6 || Math.abs(g.pos.y - this.pos.y) > 1.6) continue;
          if (Math.abs(angDiff(this.face, Math.atan2(dx, dz))) > 1.2) continue;
          const dmg = g.stagger > 0 ? 999 : (this.combo === 3 ? 70 : 40);
          g.hurt(dmg, this.pos); any = true;
        }
        if (any) { Sfx.hit(); Game.shake = 0.15; }
      }
    }
  },

  takeDamage(n, from, ignoreBlock) {
    if (this.state === 'dead' || this.state === 'hidden' || Game.invuln) return;
    if (!ignoreBlock && this.blocking && from) {
      const a = Math.atan2(from.x - this.pos.x, from.z - this.pos.z);
      if (Math.abs(angDiff(this.face, a)) < 1.3) { n *= 0.1; Sfx.clang(); }
    }
    this.hp -= n; this.hurtT = 0.3; this.regenT = 6; Sfx.hurt(); Game.hurtFlash = 1;
    if (this.state === 'climb' && n > 12) { this.state = 'air'; this.vel.set(this.cn.x * 2, 0, this.cn.z * 2); this.fallPeak = this.pos.y; }
    if (this.hp <= 0) this.die();
  },
  die() {
    this.state = 'dead'; this.deadT = 0; this.dead = true; this.hp = 0; this.vel.set(0, 0, 0); this.attackT = 0; this.blocking = false;
    Game.onDeath();
  },
  stDead(dt) {
    this.deadT += dt;
    this.vel.x = 0; this.vel.z = 0;
    if (!this.onGround) { this.vel.y -= G * dt; this.stepH = 0; moveEntity(this, dt); }
    if (this.deadT > 3.0) Game.respawn();
  },

  // ---- Malli ----
  updateModel(dt) {
    const rig = this.rig;
    if (!rig.root.visible && this.state !== 'hidden') rig.root.visible = true;
    const hs = Math.hypot(this.vel.x, this.vel.z), sp = clamp(hs / 8.4, 0, 1);
    const m = { mode: 'idle', sp };
    switch (this.state) {
      case 'ground':
        if (this.rollT > 0) m.mode = 'vault';
        else if (this.attackT > 0) { m.mode = 'attack'; m.at = 1 - this.attackT / 0.38; m.combo = this.combo; }
        else if (this.blocking) m.mode = 'block';
        else if (this.vaultT > 0) m.mode = 'vault';
        else if (this.groundBox && this.groundBox.rope) { m.mode = 'balance'; m.sp = clamp(hs / 3.4, 0, 1); }
        else if (this.crouch) { m.mode = 'crouch'; m.sp = clamp(hs / 2, 0, 1); }
        else if (hs > 0.6) { m.mode = hs > 6 ? 'run' : 'walk'; }
        break;
      case 'air': m.mode = this.dive ? 'dive' : (this.freefall ? 'fall' : 'air'); break;
      case 'climb': m.mode = this.hang ? 'hang' : 'climb'; m.cs = this.cs || 0; if (this.hang && (this.cs || 0) > 0.3 && Math.abs(this.vel.x) + Math.abs(this.vel.z) > 0.2) { m.mode = 'climb'; } break;
      case 'mantle': m.mode = 'mantle'; m.u = this.mantle.t / this.mantle.dur; break;
      case 'wallrun': m.mode = 'wallrun'; m.side = this.wr.side; break;
      case 'kill': m.mode = 'kill'; break;
      case 'dead': m.mode = 'dead'; break;
    }
    rig.root.position.set(this.pos.x, this.pos.y + this.vis.off, this.pos.z);
    rig.root.rotation.y = this.face;
    poseRig(rig, m, dt);
    if (this.rollT > 0) rig.tilt.rotation.x = (1 - this.rollT / 0.55) * Math.PI * 2;
    else if (this.slideT > 0) rig.tilt.rotation.x = -0.55 * Math.min(1, this.slideT * 6);
    if (this.hurtT > 0) rig.root.rotation.z = Math.sin(performance.now() / 20) * 0.05; else rig.root.rotation.z = 0;
  },
};
