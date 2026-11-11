'use strict';
// =====================================================================
//  VARTIJAT: partiointi, näkökenttä, jahti, etsintä, taistelu, jousiampujat
// =====================================================================
const Guards = {
  list: [], corpses: [], bolts: [], scene: null, icons: {},
  init(scene) {
    this.scene = scene;
    this.icons.q = iconTexture('?', '#ffd54a');
    this.icons.e = iconTexture('!', '#ff4a3a');
    this.icons.mark = diamondTexture('#ff5a4a');
    this.icons.markT = diamondTexture('#ffcf3a');
    this.boltGeo = new THREE.BoxGeometry(0.05, 0.05, 0.7);
    this.boltMat = new THREE.MeshBasicMaterial({ color: 0xffb060 });
  },
  spawn(sp) {
    const g = new Guard(sp, this.scene);
    this.list.push(g); return g;
  },
  attackers() { return this.list.filter(g => !g.dead && g.windup > 0).length; },
  alertAt(pos, radius, src) {
    for (const g of this.list) {
      if (g.dead || g === src || g.state === 'alert') continue;
      if (Math.hypot(g.pos.x - pos.x, g.pos.z - pos.z) < radius) g.forceAlert(Player.pos);
    }
  },
  anyAlert() { return this.list.some(g => !g.dead && g.state === 'alert'); },
  anySuspicious() { return this.list.some(g => !g.dead && (g.state === 'curious' || g.state === 'search')); },
  nearestEnemy(r) {
    let b = null, bd = r;
    for (const g of this.list) { if (g.dead) continue; const d = Math.hypot(g.pos.x - Player.pos.x, g.pos.z - Player.pos.z); if (d < bd) { bd = d; b = g; } }
    return b;
  },
  fireBolt(from, to) {
    const m = new THREE.Mesh(this.boltGeo, this.boltMat);
    m.position.copy(from);
    const dir = new V3().subVectors(to, from).normalize();
    m.lookAt(from.clone().add(dir)); this.scene.add(m);
    this.bolts.push({ m, pos: from.clone(), vel: dir.multiplyScalar(38), t: 0 });
    Sfx.bolt();
  },
  pathBudget: 1,
  update(dt) {
    this.pathBudget = 1;
    for (const g of this.list) g.update(dt);
    // separaatio
    for (let i = 0; i < this.list.length; i++) for (let j = i + 1; j < this.list.length; j++) {
      const a = this.list[i], b = this.list[j]; if (a.dead || b.dead) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.9 && d > 0.001 && Math.abs(a.pos.y - b.pos.y) < 1.5) {
        const p = (0.9 - d) * 0.5, nx = dx / d, nz = dz / d;
        if (freeAt(a, a.pos.x - nx * p, a.pos.y, a.pos.z - nz * p)) { a.pos.x -= nx * p; a.pos.z -= nz * p; }
        if (freeAt(b, b.pos.x + nx * p, b.pos.y, b.pos.z + nz * p)) { b.pos.x += nx * p; b.pos.z += nz * p; }
      }
    }
    // nuolet
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t += dt;
      const np = b.pos.clone().addScaledVector(b.vel, dt);
      let kill = b.t > 2.5 || !los(b.pos.x, b.pos.y, b.pos.z, np.x, np.y, np.z);
      if (!kill && Player.state !== 'hidden' && Player.state !== 'dead') {
        const dx = np.x - Player.pos.x, dz = np.z - Player.pos.z, dy = np.y - (Player.pos.y + 0.9);
        if (dx * dx + dz * dz < 0.5 * 0.5 && Math.abs(dy) < 1.0) { Player.takeDamage(12, b.pos); kill = true; }
      }
      b.pos.copy(np); b.m.position.copy(np);
      if (kill) { this.scene.remove(b.m); this.bolts.splice(i, 1); }
    }
  },
  reset() {
    for (const g of this.list) if (!g.dead) g.reset();
    for (const b of this.bolts) this.scene.remove(b.m);
    this.bolts.length = 0;
  },
};

class Guard {
  constructor(sp, scene) {
    this.type = sp.type || 'sword'; this.roof = !!sp.roof; this.isTarget = this.type === 'captain' || !!sp.target;
    this.targetName = sp.target || (this.type === 'captain' ? 'Kapteeni Aldric' : null);
    this.home = new V3(sp.x, sp.y || 0, sp.z); this.homeFace = sp.face !== undefined ? sp.face : rand(0, 6);
    this.pos = this.home.clone(); this.vel = new V3(); this.r = 0.32; this.h = 1.8;
    this.route = sp.route || null; this.ri = 0; this.wait = sp.wait || 2; this.waitT = 0; this.speedMul = sp.speed || 1;
    this.rig = makeHumanoid(sp.style || (this.type === 'archer' ? 'archer' : (this.isTarget ? 'captain' : 'guard')));
    this.rig.alwaysSword = false;
    scene.add(this.rig.root);
    this.maxHp = this.isTarget ? (sp.hp || 180) : (this.type === 'archer' ? 60 : 100);
    // kuvakkeet
    const sm = new THREE.SpriteMaterial({ map: Guards.icons.q, transparent: true });
    this.icon = new THREE.Sprite(sm); this.icon.scale.set(0.7, 0.7, 1); this.icon.visible = false; scene.add(this.icon);
    const mm = new THREE.SpriteMaterial({ map: this.isTarget ? Guards.icons.markT : Guards.icons.mark, transparent: true, depthTest: false });
    this.mark = new THREE.Sprite(mm); this.mark.scale.set(this.isTarget ? 1.0 : 0.6, this.isTarget ? 1.0 : 0.6, 1); this.mark.renderOrder = 999; this.mark.visible = false; scene.add(this.mark);
    this.reset();
  }
  reset() {
    if (this.dead) { this.rig.root.visible = true; }
    this.hp = this.maxHp; this.pos.copy(this.home); this.vel.set(0, 0, 0); this.face = this.homeFace;
    this.state = 'patrol'; this.sus = 0; this.dead = false; this.deadT = 0; this.deadOff = 0; this.stateT = 0; this.loseT = 0; this.ri = 0; this.waitT = 0;
    this.atkCd = 0; this.windup = 0; this.stagger = 0; this.aimT = 0; this.path = null; this.pathT = Math.random() * 0.8; this.pathFail = false;
    this.lastSeen = new V3(); this.hasLast = false; this.corpseT = Math.random(); this.alertShown = false; this.searchPhase = 0;
    this.rig.cur = {}; this.rig.tilt.rotation.set(0, 0, 0); this.canSee = false;
    if (this.dead) Guards.corpses = Guards.corpses.filter(c => c !== this);
  }
  canAssassinate() { return !this.dead && (this.state !== 'alert' || this.stagger > 0 || this.type === 'archer' && this.aimT > 0); }

  die(silent) {
    if (this.dead) return;
    this.dead = true; this.state = 'dead'; this.deadT = 0; this.icon.visible = false; this.mark.visible = false; this.windup = 0;
    this.discovered = false; Guards.corpses.push(this);
    Game.stats.kills++;
    FX.burst(this.pos.x, this.pos.y + 1, this.pos.z, 14, 2.2, [0.7, 0.64, 0.55], 0.4, 0.7, 2, 1, 1.2);
    if (this.isTarget) Game.onTargetKilled(this, this.killWitnessed !== false);
  }
  assassinate(aerial) {
    // silmin nähden tapetut herättävät hälytyksen
    const hadWitness = Guards.list.some(o => {
      if (o === this || o.dead) return false;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d = Math.hypot(dx, dz);
      return d < 16 && Math.abs(angDiff(o.face, Math.atan2(dx, dz))) < 1.0 && los(o.pos.x, o.pos.y + 1.6, o.pos.z, this.pos.x, this.pos.y + 1.4, this.pos.z);
    });
    Sfx.kill(); this.killWitnessed = hadWitness; Game.slowmo(0.45, 0.28); Game.hitStop = Math.max(Game.hitStop, 0.08);
    this.die(true);
    if (hadWitness) { for (const o of Guards.list) if (!o.dead && o.state !== 'alert') { const d = Math.hypot(this.pos.x - o.pos.x, this.pos.z - o.pos.z); if (d < 16 && o.canWitness(this)) o.sus = Math.max(o.sus, 0.8); } }
    if (!this.isTarget) Game.toast(aerial ? 'Ilmasalamurha' : 'Hiljainen salamurha', 'good');
  }
  canWitness(g) { return los(this.pos.x, this.pos.y + 1.6, this.pos.z, g.pos.x, g.pos.y + 1.4, g.pos.z); }

  hurt(dmg, src) {
    if (this.dead) return;
    this.hp -= dmg; this.stagger = 0.5; this.windup = 0; Sfx.hit();
    FX.sparks(this.pos.x, this.pos.y + 1.2, this.pos.z, 9); Game.hitStop = Math.max(Game.hitStop, dmg > 60 ? 0.11 : 0.06);
    this.vel.x = (this.pos.x - src.x) * 3; this.vel.z = (this.pos.z - src.z) * 3;
    if (this.hp <= 0) { this.killWitnessed = true; this.die(false); if (!this.isTarget) Game.toast('Vartija kaatui', 'good'); Game.slowmo(0.35, 0.3); Game.hitStop = Math.max(Game.hitStop, 0.14); return; }
    if (this.state !== 'alert') this.forceAlert(src, true);
  }
  forceAlert(pos, shout) {
    if (this.dead) return;
    const was = this.state === 'alert';
    this.state = 'alert'; this.sus = 1; this.loseT = 0; this.stateT = 0; this.lastSeen.copy(pos); this.hasLast = true; this.path = null; this.pathT = 0;
    if (!was) { Sfx.alert(); Game.onAlert(this); if (shout) Guards.alertAt(this.pos, 18, this); }
  }

  perceive(dt) {
    const P = Player; let seen = false, dist = 99;
    this.canSee = false;
    if (P.state !== 'hidden' && P.state !== 'dead') {
      const ex = this.pos.x, ey = this.pos.y + 1.6, ez = this.pos.z, px = P.pos.x, py = P.pos.y + 1.0, pz = P.pos.z;
      const dx = px - ex, dz = pz - ez; dist = Math.hypot(dx, py - ey, dz);
      const hs = Math.hypot(P.vel.x, P.vel.z);
      let range = 24 * (P.crouch ? 0.5 : (hs > 5 ? 1.15 : (hs > 0.5 ? 0.9 : 0.7)));
      if (this.type === 'archer') range *= 1.1;
      const ang = Math.abs(angDiff(this.face, Math.atan2(dx, dz)));
      const fov = this.state === 'alert' ? 2.2 : 1.0;
      if (dist < range && (ang < fov || dist < 2.5) && los(ex, ey, ez, px, py, pz)) {
        seen = true; this.canSee = true;
        const rate = 1.2 + (1 - dist / range) * 4.0;
        this.sus = Math.min(1, this.sus + rate * dt * (P.crouch ? 0.75 : 1));
        this.lastSeen.copy(P.pos); this.hasLast = true;
        if (this.state !== 'alert') this.face += angDiff(this.face, Math.atan2(dx, dz)) * Math.min(1, 3 * dt);
      } else if (P.noise > 0.8 && dist < 7 && this.state !== 'alert') {
        this.sus = Math.min(0.9, this.sus + 0.5 * dt); this.lastSeen.copy(P.pos); this.hasLast = true;
      }
    }
    if (!seen && this.state !== 'alert') this.sus = Math.max(0, this.sus - 0.22 * dt);
    if (this.sus >= 1 && this.state !== 'alert') this.forceAlert(P.pos, true);
    else if (this.sus > 0.35 && (this.state === 'patrol')) { this.state = 'curious'; this.stateT = 0; }
    // ruumiit
    this.corpseT -= dt;
    if (this.corpseT <= 0 && this.state !== 'alert') {
      this.corpseT = 0.5;
      for (const c of Guards.corpses) {
        if (c.discovered || c === this) continue;
        const dx = c.pos.x - this.pos.x, dz = c.pos.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 13 && Math.abs(angDiff(this.face, Math.atan2(dx, dz))) < 1.2 && los(this.pos.x, this.pos.y + 1.6, this.pos.z, c.pos.x, c.pos.y + 0.5, c.pos.z)) {
          c.discovered = true; this.state = 'search'; this.searchPhase = 0; this.stateT = 0; this.lastSeen.copy(c.pos); this.hasLast = true; this.sus = Math.max(this.sus, 0.5);
          Game.toast('Vartija löysi ruumiin', 'warn'); break;
        }
      }
    }
    return seen;
  }

  steer(gx, gz, speed, dt) {
    const dx = gx - this.pos.x, dz = gz - this.pos.z, d = Math.hypot(dx, dz) || 1;
    this.vel.x = damp(this.vel.x, dx / d * speed, 8, dt); this.vel.z = damp(this.vel.z, dz / d * speed, 8, dt);
    this.face += angDiff(this.face, Math.atan2(dx, dz)) * Math.min(1, 9 * dt);
  }
  stop(dt) { this.vel.x = damp(this.vel.x, 0, 10, dt); this.vel.z = damp(this.vel.z, 0, 10, dt); }
  moveTo(tx, tz, speed, dt) {
    const dd = Math.hypot(tx - this.pos.x, tz - this.pos.z);
    let gx = tx, gz = tz;
    if (!this.roof && dd > 3) {
      this.pathT -= dt;
      if ((this.pathT <= 0 || !this.pathGoal || Math.hypot(this.pathGoal[0] - tx, this.pathGoal[1] - tz) > 3) && Guards.pathBudget > 0) {
        Guards.pathBudget--;
        this.path = Nav.find(this.pos.x, this.pos.z, tx, tz); this.pathT = 0.8; this.pathGoal = [tx, tz]; this.pathFail = !this.path;
      }
      if (this.path && this.path.length) {
        while (this.path.length > 1 && Math.hypot(this.path[0].x - this.pos.x, this.path[0].z - this.pos.z) < 1.1) this.path.shift();
        gx = this.path[0].x; gz = this.path[0].z;
      }
    } else if (dd <= 3) { this.path = null; this.pathFail = false; }
    this.steer(gx, gz, speed, dt);
    return dd;
  }

  update(dt) {
    if (this.dead) { this.deadT += dt; this.updateModel(dt); return; }
    const P = Player;
    this.atkCd -= dt; this.stagger -= dt; this.stateT += dt;
    const seen = this.perceive(dt);
    const sm = this.speedMul;
    const dxp = P.pos.x - this.pos.x, dzp = P.pos.z - this.pos.z, dp = Math.hypot(dxp, dzp);
    this.fighting = false;
    if (this.stagger > 0) { this.stop(dt); }
    else switch (this.state) {
      case 'patrol': {
        if (this.route) {
          const t = this.route[this.ri];
          if (this.waitT > 0) { this.waitT -= dt; this.stop(dt); this.face += Math.sin(performance.now() / 900 + this.home.x) * 0.01; }
          else {
            const d = this.moveTo(t[0], t[1], 1.7 * sm, dt);
            if (d < 0.7) { this.ri = (this.ri + 1) % this.route.length; this.waitT = this.wait * (0.6 + Math.random() * 0.8); }
          }
        } else {
          const dh = Math.hypot(this.home.x - this.pos.x, this.home.z - this.pos.z);
          if (dh > 1.2) this.moveTo(this.home.x, this.home.z, 1.8, dt);
          else { this.stop(dt); this.face += angDiff(this.face, this.homeFace + Math.sin(performance.now() / 2500 + this.home.x) * 0.9) * Math.min(1, 1.5 * dt); }
        }
        break;
      }
      case 'curious': {
        if (this.sus < 0.05 && this.stateT > 2) { this.state = 'patrol'; break; }
        if (this.stateT < 1.0) this.stop(dt);
        else if (this.hasLast) {
          const d = this.moveTo(this.lastSeen.x, this.lastSeen.z, 2.6, dt);
          if (d < 1.5) { this.state = 'search'; this.searchPhase = 1; this.stateT = 0; }
        } else this.state = 'patrol';
        break;
      }
      case 'search': {
        if (this.searchPhase === 0 && this.hasLast) {
          const d = this.moveTo(this.lastSeen.x, this.lastSeen.z, 3.2, dt);
          if (d < 1.5) { this.searchPhase = 1; this.stateT = 0; }
        } else {
          this.stop(dt);
          this.face += Math.sin(this.stateT * 1.4) * 0.03;
          if (this.stateT > 6) { this.state = 'patrol'; this.sus = 0; }
        }
        break;
      }
      case 'alert': {
        if (P.state === 'dead') { this.state = 'patrol'; this.sus = 0; break; }
        if (seen) this.loseT = 0;
        else {
          let inc = 1;
          if (P.pos.y - this.pos.y > 3.5 && this.pathFail) inc = 2.5;
          this.loseT += dt * inc;
        }
        if (this.loseT > 7) { this.state = 'search'; this.searchPhase = 0; this.stateT = 0; this.sus = 0.4; Game.toast('Vartijat etsivät sinua', 'warn'); break; }
        if (this.type === 'archer') {
          const tp = new V3(P.pos.x, P.pos.y + 1.1, P.pos.z);
          if (seen && dp < 28 && dp > 5) {
            this.stop(dt); this.face += angDiff(this.face, Math.atan2(dxp, dzp)) * Math.min(1, 10 * dt);
            this.aimT += dt; this.fighting = true;
            if (this.aimT > 1.0 && this.atkCd <= 0) { Guards.fireBolt(new V3(this.pos.x, this.pos.y + 1.4, this.pos.z), tp); this.atkCd = 2.2; this.aimT = 0.2; }
          } else if (dp <= 5) { this.fightMelee(dt, dp); }
          else { this.aimT = 0; this.moveTo(P.pos.x, P.pos.z, 4.5 * sm, dt); }
        } else {
          if (dp < 2.1 && Math.abs(P.pos.y - this.pos.y) < 1.6) this.fightMelee(dt, dp);
          else {
            this.windup = 0;
            const tx = seen ? P.pos.x : this.lastSeen.x, tz = seen ? P.pos.z : this.lastSeen.z;
            this.moveTo(tx, tz, (this.isTarget ? 6.4 : 6.0) * sm, dt);
          }
        }
        break;
      }
    }
    // fysiikka
    this.vel.y -= G * dt; this.stepH = 0.45;
    moveEntity(this, dt);
    this.updateIcons();
    this.updateModel(dt);
  }

  fightMelee(dt, dp) {
    const P = Player; this.fighting = true;
    this.face += angDiff(this.face, Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z)) * Math.min(1, 12 * dt);
    if (dp > 1.7) { this.steer(P.pos.x, P.pos.z, 2.5, dt); } else this.stop(dt);
    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) {
        this.windup = 0; this.atkCd = this.isTarget ? 0.9 : 1.3;
        if (dp < 2.5) {
          const blocked = P.blocking && Math.abs(angDiff(P.face, Math.atan2(this.pos.x - P.pos.x, this.pos.z - P.pos.z))) < 1.3;
          if (blocked) { this.stagger = 1.1; Sfx.clang(); FX.sparks(P.pos.x + Math.sin(P.face) * 0.8, P.pos.y + 1.2, P.pos.z + Math.cos(P.face) * 0.8, 14); Game.hitStop = Math.max(Game.hitStop, 0.1); Game.shake = 0.12; Game.toast('Torjunta! Isku nyt', 'good'); P.takeDamage(0, this.pos); }
          else { P.takeDamage(this.isTarget ? 20 : 14, this.pos); Sfx.hit(); Game.shake = 0.2; }
        }
      }
    } else if (this.atkCd <= 0 && Guards.attackers() < 2) {
      this.windup = this.isTarget ? 0.45 : 0.6; Sfx.swing();
    }
  }

  updateIcons() {
    const show = !this.dead && (this.state === 'curious' || this.state === 'alert' || (this.state === 'search' && this.searchPhase === 0)) || this.sus > 0.3;
    this.icon.visible = show;
    if (show) {
      const al = this.state === 'alert';
      this.icon.material.map = al ? Guards.icons.e : Guards.icons.q; this.icon.material.needsUpdate = true;
      this.icon.position.set(this.pos.x, this.pos.y + 2.4, this.pos.z);
      const s = al ? 0.8 : 0.6 + this.sus * 0.3; this.icon.scale.set(s, s, 1);
    }
    this.mark.visible = !this.dead && (Game.eagle || (this.isTarget && Game.currentTarget === this && Game.synced));
    if (this.mark.visible) { this.mark.position.set(this.pos.x, this.pos.y + 2.9, this.pos.z); this.mark.material.opacity = 1; }
  }

  updateModel(dt) {
    const rig = this.rig, hs = Math.hypot(this.vel.x, this.vel.z);
    let m = { mode: 'idle', sp: clamp(hs / 6, 0, 1) };
    if (this.dead) m.mode = 'dead';
    else if (this.stagger > 0) m.mode = 'stagger';
    else if (this.windup > 0) m.mode = 'windup';
    else if (this.type === 'archer' && this.state === 'alert' && this.aimT > 0) m.mode = 'aim';
    else if (this.state === 'search' && this.searchPhase === 1) m.mode = 'search';
    else if (hs > 0.4) { m.mode = hs > 4 ? 'run' : 'walk'; m.armed = this.state === 'alert'; if (this.state === 'alert') rig.alwaysSword = true; }
    if (this.state !== 'alert') rig.alwaysSword = false;
    if (this.dead) { this.deadOff = damp(this.deadOff, 0.72, 5, dt); }
    rig.root.position.set(this.pos.x, this.pos.y - this.deadOff, this.pos.z);
    rig.root.rotation.y = this.face;
    poseRig(rig, m, dt);
  }
}
