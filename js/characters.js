'use strict';
// =====================================================================
//  HAHMOT: proseduraalinen humanoidimalli ja animaatiot
// =====================================================================
const _mats = {};
function mat(c) { return _mats[c] || (_mats[c] = new THREE.MeshLambertMaterial({ color: c })); }
function bx(parent, w, h, d, color, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z); m.castShadow = shadow; parent.add(m); return m;
}

// style: 'raven' (pelaaja), 'guard', 'archer', 'captain'
function makeHumanoid(style) {
  const S = {
    raven: { coat: 0x2b3340, pants: 0x1f242c, skin: 0x8a6a52, hood: 0x181d26, accent: 0x8c2e2e, trim: 0xb4934a, boots: 0x2a211b },
    guard: { coat: 0x6b4a3a, pants: 0x3c3a3a, skin: 0xc09474, hood: 0x8c8f96, accent: 0xa02828, trim: 0x8d8d90, boots: 0x2a211b },
    archer: { coat: 0x4a5a40, pants: 0x3a3630, skin: 0xc09474, hood: 0x6a5a40, accent: 0x7a6a30, trim: 0x8d8d90, boots: 0x2a211b },
    captain: { coat: 0x5a1f28, pants: 0x2f2d2d, skin: 0xc09474, hood: 0xa9a9b2, accent: 0xd0a63a, trim: 0xd0a63a, boots: 0x201a16 },
    noble: { coat: 0x4a2c5a, pants: 0x2a2630, skin: 0xc09474, hood: 0xb08a3a, accent: 0xd0a63a, trim: 0xd0a63a, boots: 0x201a16 },
    bishop: { coat: 0xe6e0d0, pants: 0xb8b0a0, skin: 0xc09474, hood: 0xd0a63a, accent: 0x8c2e2e, trim: 0xd0a63a, boots: 0x6a5a40 },
    marshal: { coat: 0x2a2e36, pants: 0x1c1e24, skin: 0xc09474, hood: 0x7a7f88, accent: 0x8c2e2e, trim: 0xb4b8c0, boots: 0x15171b },
  }[style];
  const root = new THREE.Group();
  const tilt = new THREE.Group(); tilt.position.y = 0.9; root.add(tilt);
  const inner = new THREE.Group(); inner.position.y = -0.9; tilt.add(inner);
  const body = new THREE.Group(); body.position.y = 0.85; inner.add(body);
  const torso = bx(body, 0.46, 0.62, 0.27, S.coat, 0, 0.32, 0);
  bx(body, 0.48, 0.1, 0.29, S.accent, 0, 0.04, 0);            // vyö
  bx(body, 0.1, 0.12, 0.3, S.trim, 0, 0.04, 0);                 // solki
  bx(body, 0.52, 0.12, 0.3, S.coat, 0, 0.6, 0);                 // hartiat
  const head = new THREE.Group(); head.position.set(0, 0.74, 0); body.add(head);
  if (style === 'raven') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat(S.hood)); hood.position.set(0, 0.14, -0.01); hood.scale.set(1, 1.05, 1.1); hood.castShadow = true; head.add(hood);
    const peak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 7), mat(S.hood)); peak.position.set(0, 0.3, -0.12); peak.rotation.x = -0.95; head.add(peak);
    bx(head, 0.17, 0.12, 0.05, 0x050608, 0, 0.12, 0.13, false);
    bx(head, 0.035, 0.025, 0.02, 0xffffff, -0.045, 0.125, 0.16, false);
    bx(head, 0.035, 0.025, 0.02, 0xffffff, 0.045, 0.125, 0.16, false);
  } else {
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat(S.skin)); hd.position.set(0, 0.13, 0); hd.castShadow = true; head.add(hd);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.155, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(S.hood)); helm.position.set(0, 0.15, 0); helm.castShadow = true; head.add(helm);
    bx(head, 0.34, 0.025, 0.34, S.hood, 0, 0.16, 0, false);
    if (style === 'captain' || style === 'marshal') { bx(head, 0.03, 0.2, 0.2, 0xb03030, 0, 0.3, -0.02, false); }
  }
  // kädet
  const mkArm = (sx) => {
    const g = new THREE.Group(); g.position.set(sx * 0.31, 0.58, 0); body.add(g);
    bx(g, 0.13, 0.55, 0.13, S.coat, 0, -0.26, 0);
    bx(g, 0.14, 0.18, 0.14, style === 'raven' ? 0x6b5436 : S.trim, 0, -0.45, 0);
    bx(g, 0.1, 0.1, 0.1, S.skin, 0, -0.58, 0);
    return g;
  };
  const armL = mkArm(1), armR = mkArm(-1);
  // jalat
  const mkLeg = (sx) => {
    const g = new THREE.Group(); g.position.set(sx * 0.12, 0.85, 0); inner.add(g);
    bx(g, 0.18, 0.78, 0.2, S.pants, 0, -0.39, 0);
    bx(g, 0.2, 0.22, 0.26, S.boots, 0, -0.74, 0.03);
    return g;
  };
  const legL = mkLeg(1), legR = mkLeg(-1);
  // viitta / tabardi
  const cape = new THREE.Group(); cape.position.set(0, 0.62, -0.15); body.add(cape);
  if (style === 'raven') {
    const cm = bx(cape, 0.5, 0.95, 0.04, 0x141920, 0, -0.45, -0.02);
    bx(cape, 0.34, 0.5, 0.04, 0x141920, 0, -0.85, -0.02);
  } else {
    bx(cape, 0.34, 0.7, 0.03, S.accent, 0, -0.35, 0.0);
    bx(body, 0.34, 0.6, 0.03, S.accent, 0, 0.12, 0.15);
  }
  // ase
  const sword = new THREE.Group(); sword.position.set(0, -0.58, 0.05); armR.add(sword);
  bx(sword, 0.04, 0.05, 0.04, 0x6a5030, 0, 0, 0, false);
  bx(sword, 0.16, 0.025, 0.04, S.trim, 0, -0.04, 0, false);
  bx(sword, 0.045, 0.78, 0.012, 0xcfd3d8, 0, -0.44, 0, false);
  sword.rotation.x = -Math.PI / 2; // osoittaa eteenpäin kun käsi alhaalla -> käytetään poseRigissä
  // jousipyssy jousiampujalle
  let bow = null;
  if (style === 'archer') {
    bow = new THREE.Group(); bow.position.set(0, -0.55, 0.05); armL.add(bow);
    bx(bow, 0.05, 0.9, 0.05, 0x6a4a2a, 0, 0, 0.1, false); bx(bow, 0.4, 0.05, 0.05, 0x6a4a2a, 0, 0.1, 0.1, false);
    sword.visible = false;
  }
  // selkäsuoja (vain Korppi): käyrä selkälaukku
  let pads = null;
  if (style === 'raven') {
    bx(body, 0.26, 0.3, 0.1, 0x5a4026, 0, 0.3, -0.19);
    pads = new THREE.Group(); body.add(pads);
    bx(pads, 0.22, 0.1, 0.32, 0x6a6e76, 0.33, 0.68, 0); bx(pads, 0.22, 0.1, 0.32, 0x6a6e76, -0.33, 0.68, 0);
    bx(pads, 0.5, 0.06, 0.3, 0x6a6e76, 0, 0.62, 0.0);
    pads.visible = false;
  }
  return {
    root, tilt, inner, body, head, armL, armR, legL, legR, cape, sword, bow, torso, style, pads,
    cur: {}, phase: 0, climbPh: 0, t: 0,
    S,
  };
}

// Pose-moodit. m: { mode, sp, side, u, at }
function poseRig(rig, m, dt) {
  rig.t += dt;
  const T = { lx: 0, rx: 0, alx: 0, arx: 0, alz: 0.06, arz: -0.06, lean: 0, roll: 0, by: 0.85, twist: 0, pitch: 0, tz: 0, cape: 0.12, head: 0, sword: false };
  const sp = m.sp || 0;
  let k = 18;
  switch (m.mode) {
    case 'idle': {
      const b = Math.sin(rig.t * 2) * 0.03;
      T.alz = 0.1 + b; T.arz = -0.1 - b; T.by = 0.85 + b * 0.2; T.head = Math.sin(rig.t * 0.7) * 0.08;
      break;
    }
    case 'walk': case 'run': {
      rig.phase += dt * (5 + sp * 9);
      const ph = rig.phase, amp = 0.4 + 0.75 * sp;
      T.lx = Math.sin(ph) * amp; T.rx = -Math.sin(ph) * amp;
      T.alx = -Math.sin(ph) * amp * 0.9; T.arx = Math.sin(ph) * amp * 0.9;
      T.lean = 0.05 + 0.3 * sp; T.by = 0.85 - Math.abs(Math.cos(ph)) * 0.04 * (0.4 + sp);
      T.cape = 0.15 + sp * 0.55; T.alz = 0.08; T.arz = -0.08;
      if (m.armed) { T.arx = -0.9; T.alx = -0.2; }
      break;
    }
    case 'crouch': {
      rig.phase += dt * (3 + sp * 6);
      const ph = rig.phase;
      T.by = 0.85 - 0.3; T.lean = 0.5; T.lx = -0.5 + Math.sin(ph) * 0.35 * sp; T.rx = -0.4 - Math.sin(ph) * 0.35 * sp;
      T.alx = -0.3; T.arx = -0.3; T.head = -0.3; T.cape = 0.3;
      break;
    }
    case 'balance': {
      rig.phase += dt * (3 + sp * 5);
      const ph = rig.phase;
      T.lx = Math.sin(ph) * 0.4 * sp; T.rx = -Math.sin(ph) * 0.4 * sp;
      T.alz = 1.15 + Math.sin(rig.t * 3) * 0.12; T.arz = -1.15 - Math.sin(rig.t * 3.3) * 0.12;
      T.roll = Math.sin(rig.t * 2.5) * 0.08; T.lean = 0.08;
      break;
    }
    case 'air': {
      T.lx = -0.8; T.rx = 0.5; T.alx = -1.1; T.arx = -0.5; T.alz = 0.5; T.arz = -0.7; T.lean = 0.12; T.cape = 0.7; k = 12;
      break;
    }
    case 'fall': {
      T.lx = -0.3; T.rx = 0.3; T.alx = -2.6; T.arx = -2.6; T.alz = 0.5; T.arz = -0.5; T.lean = 0.1; T.cape = 1.1; k = 10;
      break;
    }
    case 'dive': {
      T.alz = 1.55; T.arz = -1.55; T.alx = 0; T.arx = 0; T.lx = 0.15; T.rx = 0.15; T.pitch = 1.35; T.cape = 0.2; T.head = -0.5; k = 8;
      break;
    }
    case 'climb': {
      rig.climbPh += dt * (m.cs || 0) * 4.2;
      const ph = rig.climbPh;
      T.alx = -2.7 + Math.sin(ph) * 0.5; T.arx = -2.7 - Math.sin(ph) * 0.5;
      T.alz = 0.25; T.arz = -0.25;
      T.lx = -0.9 + Math.cos(ph) * 0.55; T.rx = -0.9 - Math.cos(ph) * 0.55;
      T.lean = 0.12; T.cape = 0.02; T.head = -0.5;
      break;
    }
    case 'hang': {
      T.alx = -3.0 + Math.sin(rig.t * 2) * 0.05; T.arx = -3.0; T.alz = 0.18; T.arz = -0.18;
      T.lx = 0.15; T.rx = -0.1 + Math.sin(rig.t * 1.5) * 0.08; T.lean = 0.02; T.cape = 0.0; T.head = -0.4;
      break;
    }
    case 'mantle': {
      const u = m.u || 0;
      T.alx = -2.6 * (1 - u) - 0.3; T.arx = -2.6 * (1 - u) - 0.3; T.lx = -1.3 * (1 - u * 0.6); T.rx = -0.5; T.lean = 0.2 + 0.5 * u; T.by = 0.85 - 0.12 * u;
      break;
    }
    case 'vault': {
      T.alx = -1.7; T.arx = -1.7; T.lx = -1.3; T.rx = -1.3; T.lean = 0.5; T.by = 0.85 - 0.15; k = 22;
      break;
    }
    case 'wallrun': {
      rig.phase += dt * 15;
      const ph = rig.phase;
      T.lx = Math.sin(ph) * 1.0; T.rx = -Math.sin(ph) * 1.0; T.alx = -Math.sin(ph) * 0.9; T.arx = Math.sin(ph) * 0.9;
      T.roll = (m.side || 0) * 0.55; T.lean = 0.15; T.alz = 0.4; T.arz = -0.4;
      break;
    }
    case 'attack': {
      const u = clamp(m.at || 0, 0, 1);
      const e = u < 0.4 ? u / 0.4 : 1;
      T.arx = lerp(-2.6, 0.2, e); T.alx = -0.4; T.twist = lerp(0.7, -0.5, e) * (m.combo % 2 ? -1 : 1); T.lean = 0.25; T.sword = true;
      T.lx = -0.3; T.rx = 0.3; k = 30;
      break;
    }
    case 'block': {
      T.arx = -1.55; T.arz = -0.35; T.alx = -1.2; T.alz = 0.3; T.lean = -0.05; T.sword = true; T.lx = -0.3; T.rx = 0.3; T.by = 0.85 - 0.04;
      break;
    }
    case 'windup': {
      T.arx = -2.9; T.alx = -0.2; T.lean = -0.25; T.sword = true; k = 24;
      break;
    }
    case 'kill': {
      T.arx = -1.75; T.alx = -0.2; T.lean = 0.5; T.lx = -0.5; T.rx = 0.4; T.sword = false; k = 28;
      break;
    }
    case 'stagger': {
      T.lean = -0.5; T.alx = -1.2; T.arx = -1.2; T.alz = 1.0; T.arz = -1.0; T.head = 0.4; k = 22;
      break;
    }
    case 'aim': {
      T.alx = -1.55; T.arx = -1.2; T.alz = 0; T.arz = -0.1; T.lean = 0.05; T.sword = false;
      break;
    }
    case 'dead': {
      T.pitch = -1.5; T.alz = 0.9; T.arz = -0.9; T.by = 0.5; k = 6;
      break;
    }
    case 'search': {
      T.head = Math.sin(rig.t * 1.5) * 0.7; T.twist = Math.sin(rig.t * 1.5) * 0.4; T.alz = 0.1; T.arz = -0.1; T.sword = true; T.arx = -0.6;
      break;
    }
  }
  const c = rig.cur;
  for (const key in T) if (key !== 'sword') c[key] = c[key] === undefined ? T[key] : damp(c[key], T[key], k, dt);
  rig.legL.rotation.x = c.lx; rig.legR.rotation.x = c.rx;
  rig.legL.position.y = rig.legR.position.y = Math.min(0.85, c.by + 0.0);
  rig.armL.rotation.x = c.alx; rig.armL.rotation.z = c.alz; rig.armR.rotation.x = c.arx; rig.armR.rotation.z = c.arz;
  rig.body.position.y = c.by; rig.body.rotation.x = c.lean; rig.body.rotation.z = c.roll * 0.5; rig.body.rotation.y = c.twist;
  rig.head.rotation.x = c.head;
  rig.tilt.rotation.x = c.pitch; rig.tilt.rotation.z = c.roll * 0.5 + 0;
  rig.cape.rotation.x = c.cape + Math.sin(rig.t * 6) * 0.03;
  if (rig.sword) rig.sword.visible = (T.sword || rig.alwaysSword) && !(rig.style === 'archer');
}

// Siviili: kevyt malli
function makeCivilian() {
  const g = new THREE.Group();
  const col = pick([0x8a6a4a, 0x5a6a8a, 0x7a4a4a, 0x6a8a5a, 0x9a8a5a, 0x7a5a8a, 0xa07a5a]);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 1.25, 7), mat(col)); body.position.y = 0.7; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), mat(0xc09474)); head.position.y = 1.5; head.castShadow = true; g.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.2, 7), mat(pick([0x5a3a2a, 0x3a3a4a, 0x7a2a2a]))); hat.position.y = 1.68; g.add(hat);
  return g;
}

// Aseen malli tyypin ja harvinaisuuden mukaan (rig.sword = ryhmä kädessä, terä osoittaa paikalliseen -y suuntaan)
function setWeaponModel(rig, type, R) {
  const g = rig.sword;
  while (g.children.length) g.remove(g.children[0]);
  if (!type) return;
  const metal = new THREE.MeshLambertMaterial({ color: 0xcfd3d8, emissive: R ? R.emis : 0 });
  const wood = mat(0x6a4a2a), gold = mat(0xb08a3a);
  const add = (w, h, d, m, x, y, z) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); g.add(me); return me; };
  if (type === 'sword') { add(0.04, 0.12, 0.04, wood, 0, 0, 0); add(0.18, 0.025, 0.05, gold, 0, -0.07, 0); add(0.045, 0.8, 0.012, metal, 0, -0.48, 0); }
  else if (type === 'axe') { add(0.04, 0.95, 0.04, wood, 0, -0.45, 0); add(0.035, 0.24, 0.32, metal, 0, -0.82, 0.15); add(0.035, 0.1, 0.12, metal, 0, -0.82, -0.12); }
  else if (type === 'spear') { add(0.035, 1.9, 0.035, wood, 0, -0.6, 0); add(0.07, 0.3, 0.02, metal, 0, -1.7, 0); add(0.12, 0.03, 0.03, gold, 0, -1.52, 0); }
  else if (type === 'dagger') { add(0.04, 0.1, 0.04, wood, 0, 0, 0); add(0.12, 0.02, 0.04, gold, 0, -0.06, 0); add(0.04, 0.3, 0.012, metal, 0, -0.22, 0); }
}
