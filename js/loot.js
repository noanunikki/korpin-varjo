'use strict';
// =====================================================================
//  VARUSTEET: esineet, harvinaisuudet, inventaario, arkut, pudotukset, taso ja taidot
// =====================================================================
const RAR = [
  { id: 0, name: 'Tavallinen', col: '#b9b9b9', hex: 0xb9b9b9, mult: 1.0, w: 60, emis: 0x000000 },
  { id: 1, name: 'Hieno', col: '#5ccf6a', hex: 0x5ccf6a, mult: 1.15, w: 28, emis: 0x123d18 },
  { id: 2, name: 'Harvinainen', col: '#4aa3ff', hex: 0x4aa3ff, mult: 1.32, w: 9, emis: 0x0f3560 },
  { id: 3, name: 'Eeppinen', col: '#b46bff', hex: 0xb46bff, mult: 1.55, w: 2.5, emis: 0x3a1a60 },
  { id: 4, name: 'Legendaarinen', col: '#ffb43a', hex: 0xffb43a, mult: 1.85, w: 0.6, emis: 0x6e4a10 },
];
const WBASE = {
  sword: { n: 'miekka', t: 'Miekka', dmg: 40, dur: 0.38, reach: 2.6, arc: 1.2, crit: 0.05, stag: 1.0, icon: '⚔' },
  axe: { n: 'kirves', t: 'Kirves', dmg: 56, dur: 0.55, reach: 2.4, arc: 1.45, crit: 0.06, stag: 1.7, icon: '🪓' },
  spear: { n: 'keihäs', t: 'Keihäs', dmg: 36, dur: 0.42, reach: 3.5, arc: 0.75, crit: 0.08, stag: 1.0, icon: '🔱' },
  dagger: { n: 'tikari', t: 'Tikari', dmg: 24, dur: 0.24, reach: 2.0, arc: 1.1, crit: 0.18, stag: 0.6, icon: '🗡' },
};
const ABASE = {
  light: { n: 'kaapu', t: 'Kevyt panssari', def: 5, color: 0x2b3340, icon: '🧥' },
  medium: { n: 'nahkahaarniska', t: 'Keskiraskas panssari', def: 11, color: 0x4a3a2c, icon: '🦺' },
  heavy: { n: 'rautahaarniska', t: 'Raskas panssari', def: 19, color: 0x585c64, icon: '🛡' },
};
const CBASE = [{ n: 'sulka', icon: '🪶' }, { n: 'hammas', icon: '🦷' }, { n: 'riimukivi', icon: '💎' }, { n: 'rengas', icon: '💍' }];

const PERKS = {
  crit: { n: 'Terävä', f: v => `+${v} % kriittinen isku`, r: [4, 10] },
  stag: { n: 'Murskaava', f: v => `+${v} % horjutus`, r: [20, 45] },
  haste: { n: 'Nopea', f: v => `−${v} % iskuaika`, r: [6, 14] },
  lifesteal: { n: 'Verenhimo', f: v => `Tapossa ${v} % elämää takaisin`, r: [3, 7] },
  finisher: { n: 'Raskas isku', f: v => `+${v} % vahinko kolmannella iskulla`, r: [20, 40] },
  sight: { n: 'Kissan askel', f: v => `−${v} % vartijoiden näkökenttä`, r: [8, 18] },
  fall: { n: 'Pehmeä lasku', f: v => `−${v} % putoamisvahinko`, r: [15, 35] },
  climb: { n: 'Ketterä', f: v => `+${v} % kiipeämisnopeus`, r: [8, 18] },
  hp: { n: 'Kestävä', f: v => `+${v} elämäpistettä`, r: [10, 25] },
  jump: { n: 'Tuulenkevyt', f: v => `+${v} % hypyn korkeus`, r: [3, 7] },
  xp: { n: 'Viisaus', f: v => `+${v} % kokemus`, r: [8, 18] },
  loot: { n: 'Onnenkoru', f: v => `+${v} % parempi saalis`, r: [10, 25] },
  noise: { n: 'Hiljaisuus', f: v => `−${v} % askelten melu`, r: [20, 45] },
};
const PERK_POOL = {
  weapon: ['crit', 'stag', 'haste', 'lifesteal', 'finisher'],
  armor: ['sight', 'fall', 'climb', 'hp', 'jump'],
  charm: ['sight', 'fall', 'climb', 'hp', 'jump', 'crit', 'xp', 'loot', 'noise', 'lifesteal'],
};
const SKILLS = [
  { id: 'fall', br: 'Korppi', n: 'Kevyt jalka', max: 3, d: r => `−${r * 25} % putoamisvahinko` },
  { id: 'climb', br: 'Korppi', n: 'Kiipeilijä', max: 3, d: r => `+${r * 10} % kiipeämisnopeus` },
  { id: 'jump', br: 'Korppi', n: 'Loikkaaja', max: 2, d: r => `+${r * 5} % hypyn korkeus` },
  { id: 'sight', br: 'Korppi', n: 'Varjossa', max: 3, d: r => `−${r * 10} % vartijoiden näkökenttä` },
  { id: 'dmg', br: 'Soturi', n: 'Vahva käsi', max: 3, d: r => `+${r * 8} % vahinko` },
  { id: 'parry', br: 'Soturi', n: 'Torjuntamestari', max: 2, d: r => `Torjuttu isku ei satu${r > 1 ? ' · +30 % horjutus' : ''}` },
  { id: 'hp', br: 'Soturi', n: 'Elinvoima', max: 3, d: r => `+${r * 15} elämäpistettä` },
  { id: 'heal', br: 'Soturi', n: 'Verenjano', max: 2, d: r => `Tapossa ${r * 5} % elämää takaisin` },
  { id: 'quiet', br: 'Salamurhaaja', n: 'Hiljaiset askeleet', max: 2, d: r => `−${r * 30} % askelten melu` },
  { id: 'ass', br: 'Salamurhaaja', n: 'Pitkä terä', max: 2, d: r => `+${r * 0.5} m salamurhaetäisyys` },
  { id: 'hunter', br: 'Salamurhaaja', n: 'Saalistaja', max: 2, d: r => `+${r * 10} % kokemus ja parempi saalis` },
];

const Loot = {
  inv: [], equip: { w1: null, w2: null, armor: null, charm: null }, silver: 0, iron: 0, xp: 0, level: 1, skills: {}, cap: 36,
  chests: [], drops: [], nid: 1, opened: 0, sp: 0,

  // ---------- esineet ----------
  rollRarity(min, bonus) {
    const w = RAR.map((r, i) => i < min ? 0 : (i === 0 ? r.w * Math.max(0.15, 1 - bonus * 2) : r.w * (1 + bonus * i * 3)));
    let s = w.reduce((a, b) => a + b, 0), x = Math.random() * s;
    for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return i; }
    return Math.max(min, 0);
  },
  rollPerk(slot, used) {
    const pool = PERK_POOL[slot].filter(p => !used.includes(p));
    return pool[Math.floor(Math.random() * pool.length)];
  },
  make(slot, rar, opts) {
    opts = opts || {};
    const R = RAR[rar], r = (a, b) => a + Math.random() * (b - a);
    const it = { id: this.nid++, slot, rar, upg: 0, perks: [] };
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    if (slot === 'weapon') {
      const type = opts.type || pick(Object.keys(WBASE)), B = WBASE[type];
      it.type = type; it.dmg = B.dmg * R.mult * r(0.93, 1.07); it.dur = B.dur * r(0.97, 1.03); it.reach = B.reach; it.arc = B.arc;
      it.crit = B.crit + rar * 0.01; it.stag = B.stag;
      const leg = { sword: 'Korpin Katse', axe: 'Myrskynmurskaaja', spear: 'Tähtienpiikki', dagger: 'Hiljainen Kuiskaus' };
      it.name = rar === 0 ? pick(['Rauta', 'Teräs', 'Tammi']) + B.n : rar === 1 ? pick(['Taottu', 'Teroitettu', 'Kiiltävä']) + ' ' + B.n
        : rar === 2 ? pick(['Hallan', 'Pohjatuulen', 'Yön', 'Kotkan', 'Suden']) + ' ' + B.n : rar === 3 ? pick(['Kuun', 'Myrskyn', 'Varjojen', 'Tuhkan']) + ' ' + B.n : leg[type];
      if (opts.name) it.name = opts.name;
    } else if (slot === 'armor') {
      const wt = opts.weight || pick(['light', 'medium', 'heavy']), B = ABASE[wt];
      it.type = wt; it.weight = wt; it.def = B.def * R.mult * r(0.93, 1.07);
      const leg = { light: 'Korpin Viitta', medium: 'Metsästäjän Nahka', heavy: 'Kuninkaan Rauta' };
      it.name = rar === 0 ? pick(['Kulunut', 'Vanha']) + ' ' + B.n : rar === 1 ? pick(['Vartijan', 'Kauppiaan']) + ' ' + B.n
        : rar === 2 ? pick(['Hiipijän', 'Palkkasoturin', 'Metsästäjän']) + ' ' + B.n : rar === 3 ? pick(['Varjokaartin', 'Hallan']) + ' ' + B.n : leg[wt];
    } else {
      const B = pick(CBASE); it.type = 'charm'; it.icon = B.icon;
      it.name = rar === 4 ? 'Kuun Kyynel' : pick(['Korpin', 'Yön', 'Hallan', 'Vanhan', 'Pohjan']) + ' ' + B.n;
    }
    const np = slot === 'charm' ? Math.max(1, [0, 1, 2, 2, 3][rar]) : [0, 1, 2, 2, 3][rar];
    for (let i = 0; i < np; i++) {
      const id = this.rollPerk(slot, it.perks.map(p => p.id)); if (!id) break;
      const pr = PERKS[id].r, t = clamp(rar * 0.18 + Math.random() * 0.45, 0, 1);
      it.perks.push({ id, v: Math.round(pr[0] + (pr[1] - pr[0]) * t) });
    }
    return it;
  },
  icon(it) { if (it.slot === 'weapon') return WBASE[it.type].icon; if (it.slot === 'armor') return ABASE[it.weight].icon; return it.icon || '💍'; },
  typeName(it) { if (it.slot === 'weapon') return WBASE[it.type].t; if (it.slot === 'armor') return ABASE[it.weight].t; return 'Talismaani'; },
  power(it) {
    const m = 1 + 0.08 * it.upg;
    let p = 0;
    if (it.slot === 'weapon') p = (it.dmg * m / it.dur) * 0.55 + it.crit * 80 + it.reach * 4;
    else if (it.slot === 'armor') p = it.def * m * 3.2;
    else p = 12;
    return Math.round(p + it.perks.length * 9 + it.rar * 7);
  },
  value(it) { return Math.round(this.power(it) * 0.7 * (1 + it.upg * 0.4)); },
  upCost(it) { return { silver: Math.round(30 * (it.upg + 1) * (1 + it.rar * 0.5)), iron: 2 * (it.upg + 1) }; },
  find(id) { return this.inv.find(i => i.id === id); },
  slotOf(it) { for (const k in this.equip) if (this.equip[k] === it.id) return k; return null; },
  freeSpace() { return this.cap - this.inv.filter(i => !this.slotOf(i)).length; },
  add(it, silent) {
    if (this.freeSpace() <= 0) { Game.toast('Reppu on täynnä', 'warn'); return false; }
    this.inv.push(it);
    if (!silent) this.announce(it);
    return true;
  },
  announce(it) { Game.toast(`${RAR[it.rar].name}: ${it.name}`, 'loot', RAR[it.rar].col); if (it.rar >= 3) Sfx.sync(); else Sfx.pickup(); },

  // ---------- varustus ----------
  equipItem(id, slotKey) {
    const it = this.find(id); if (!it) return;
    if (it.slot === 'weapon') { if (slotKey !== 'w1' && slotKey !== 'w2') slotKey = 'w1'; const other = slotKey === 'w1' ? 'w2' : 'w1'; if (this.equip[other] === id) this.equip[other] = null; }
    else slotKey = it.slot;
    this.equip[slotKey] = id; this.recompute(); this.applyVisuals(); Sfx.step('roof');
  },
  unequip(slotKey) { this.equip[slotKey] = null; this.recompute(); this.applyVisuals(); },
  swapWeapon() {
    if (!this.equip.w2) { Game.toast('Ei toista asetta varusteena'); return; }
    const t = this.equip.w1; this.equip.w1 = this.equip.w2; this.equip.w2 = t;
    this.recompute(); this.applyVisuals(); const w = this.find(this.equip.w1);
    Game.toast(`Ase: ${w.name}`, 'loot', RAR[w.rar].col); Sfx.step('wood');
  },
  upgrade(id) {
    const it = this.find(id); if (!it || it.upg >= 5) return false;
    const c = this.upCost(it);
    if (this.silver < c.silver || this.iron < c.iron) { Game.toast('Ei tarpeeksi hopeaa tai rautaa', 'warn'); return false; }
    this.silver -= c.silver; this.iron -= c.iron; it.upg++; this.recompute(); Sfx.hit(); Game.toast(`${it.name} parannettu: +${it.upg}`, 'good'); return true;
  },
  sell(id) {
    const it = this.find(id); if (!it || this.slotOf(it)) return false;
    const v = this.value(it); this.silver += v; this.inv = this.inv.filter(i => i !== it); Sfx.pickup(); Game.toast(`Myyty: +${v} hopeaa`); return true;
  },

  // ---------- tilastot ----------
  recompute() {
    const S = { dmg: 14, dur: 0.38, reach: 2.2, arc: 1.2, crit: 0.03, stag: 1, def: 0, sight: 1, fall: 1, climb: 1, jump: 1, hp: 100, heal: 0, xp: 1, loot: 0, noise: 1, block: 0.1, parry: 1, ass: 2.4, finisher: 0, wtype: 'fist' };
    const w = this.find(this.equip.w1), a = this.find(this.equip.armor), c = this.find(this.equip.charm);
    if (w) { S.dmg = w.dmg * (1 + 0.08 * w.upg); S.dur = w.dur; S.reach = w.reach; S.arc = w.arc; S.crit = w.crit; S.stag = w.stag; S.wtype = w.type; }
    if (a) { S.def = a.def * (1 + 0.08 * a.upg); if (a.weight === 'heavy') { S.sight *= 1.08; S.climb *= 0.92; } if (a.weight === 'light') S.noise *= 0.9; }
    const ap = (id, v) => {
      switch (id) {
        case 'crit': S.crit += v / 100; break; case 'stag': S.stag *= 1 + v / 100; break; case 'haste': S.dur *= 1 - v / 100; break;
        case 'lifesteal': S.heal += v / 100; break; case 'finisher': S.finisher += v / 100; break; case 'sight': S.sight *= 1 - v / 100; break;
        case 'fall': S.fall *= 1 - v / 100; break; case 'climb': S.climb *= 1 + v / 100; break; case 'hp': S.hp += v; break; case 'jump': S.jump *= 1 + v / 100; break;
        case 'xp': S.xp *= 1 + v / 100; break; case 'loot': S.loot += v / 100; break; case 'noise': S.noise *= 1 - v / 100; break;
      }
    };
    for (const it of [w, a, c]) if (it) for (const p of it.perks) ap(p.id, p.v);
    const sk = (id) => this.skills[id] || 0;
    S.fall *= 1 - 0.25 * sk('fall'); S.climb *= 1 + 0.10 * sk('climb'); S.jump *= 1 + 0.05 * sk('jump'); S.sight *= 1 - 0.10 * sk('sight');
    S.dmg *= 1 + 0.08 * sk('dmg'); S.hp += 15 * sk('hp') + (this.level - 1) * 3; S.heal += 0.05 * sk('heal');
    if (sk('parry') >= 1) S.block = 0; if (sk('parry') >= 2) S.parry = 1.3;
    S.noise *= 1 - 0.30 * sk('quiet'); S.ass += 0.5 * sk('ass'); S.xp *= 1 + 0.10 * sk('hunter'); S.loot += 0.10 * sk('hunter');
    S.fall = Math.max(0.05, S.fall); S.sight = Math.max(0.4, S.sight); S.noise = Math.max(0, S.noise);
    this.stats = S; Player.stats = S;
    const mhp = Math.round(S.hp); Player.hp += mhp - Player.maxHp; Player.maxHp = mhp; Player.hp = clamp(Player.hp, 1, mhp);
  },
  charPower() {
    let p = 0; for (const k in this.equip) { const it = this.find(this.equip[k]); if (it && (k !== 'w2')) p += this.power(it); }
    return p + this.level * 6;
  },

  // ---------- kokemus ja taidot ----------
  need(l) { return 80 + l * 45; },
  addXp(n) {
    if (this.level >= 20) return;
    this.xp += Math.round(n * this.stats.xp);
    while (this.level < 20 && this.xp >= this.need(this.level)) {
      this.xp -= this.need(this.level); this.level++; this.sp++;
      Game.toast(`Taso ${this.level}! Taitopiste saatu (Tab)`, 'loot', '#ffd54a'); Sfx.sync();
      this.recompute(); Player.hp = Player.maxHp;
      FX.burst(Player.pos.x, Player.pos.y + 1, Player.pos.z, 36, 5, [1, 0.85, 0.4], 0.3, 1.2, -1, 2, 0.5);
    }
  },
  buySkill(id) {
    const s = SKILLS.find(k => k.id === id); if (!s) return false;
    const r = this.skills[id] || 0; if (r >= s.max || this.sp <= 0) return false;
    this.skills[id] = r + 1; this.sp--; this.recompute(); Sfx.pickup(); return true;
  },

  // ---------- tapot ja pudotukset ----------
  onKill(g) {
    const S = this.stats;
    this.addXp(g.isTarget ? 200 : (g.type === 'archer' ? 30 : 25));
    if (S.heal > 0) Player.hp = Math.min(Player.maxHp, Player.hp + Player.maxHp * S.heal);
    const lvlB = this.level * 0.012 + S.loot;
    if (g.isTarget) {
      const rar = Math.random() < 0.5 ? 4 : 3;
      this.spawnDrop(this.make(pickSlot(), rar), g.pos, 0);
      this.spawnDrop(this.make(pickSlot(), this.rollRarity(2, lvlB)), g.pos, 1);
      this.spawnCoin(g.pos, 80 + Math.floor(Math.random() * 60), 4);
    } else {
      if (Math.random() < 0.2 + S.loot * 0.5) this.spawnDrop(this.make(pickSlot(), this.rollRarity(0, lvlB)), g.pos, 0);
      this.spawnCoin(g.pos, 4 + Math.floor(Math.random() * 12), Math.random() < 0.25 ? 1 : 0);
    }
  },
  spawnDrop(it, pos, k) {
    const col = RAR[it.rar].hex;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: col }));
    const a = (k || 0) * 2.1 + Math.random(); m.position.set(pos.x + Math.cos(a) * 0.6, pos.y + 0.9, pos.z + Math.sin(a) * 0.6);
    scene.add(m);
    let beam = null;
    if (it.rar >= 2) {
      beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7, 6, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
      beam.position.set(m.position.x, m.position.y + 3, m.position.z); scene.add(beam);
    }
    this.drops.push({ kind: 'item', it, m, beam, t: 0, y: m.position.y, vy: 3 });
  },
  spawnCoin(pos, silver, iron) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10), new THREE.MeshBasicMaterial({ color: 0xe8d28a }));
    m.rotation.x = Math.PI / 2; m.position.set(pos.x + (Math.random() - .5), pos.y + 0.9, pos.z + (Math.random() - .5)); scene.add(m);
    this.drops.push({ kind: 'coin', silver, iron, m, t: 0, y: m.position.y, vy: 3 });
  },
  updateDrops(dt) {
    const P = Player, t = performance.now() / 1000;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.t += dt;
      d.vy -= 14 * dt; d.m.position.y += d.vy * dt;
      const floor = (d.y > 0.5 ? d.y - 0.9 : 0) + 0.35;
      if (d.m.position.y < floor + 0.0 && d.vy < 0) { d.m.position.y = floor + Math.sin(t * 3 + i) * 0.08; d.vy = 0; d.settled = true; }
      d.m.rotation.y += dt * 2.5; if (d.beam) { d.beam.position.x = d.m.position.x; d.beam.position.z = d.m.position.z; d.beam.position.y = d.m.position.y + 3; }
      if (d.settled) d.m.position.y = floor + 0.2 + Math.sin(t * 3 + i) * 0.08;
      if (d.t < 0.6 || P.state === 'dead' || P.state === 'hidden') continue;
      const dx = d.m.position.x - P.pos.x, dz = d.m.position.z - P.pos.z;
      if (dx * dx + dz * dz < 2.2 * 2.2 && Math.abs(d.m.position.y - (P.pos.y + 0.8)) < 2.4) {
        if (d.kind === 'coin') { this.silver += d.silver; this.iron += d.iron; Sfx.pickup(); Game.toast(`+${d.silver} hopeaa${d.iron ? `, +${d.iron} rautaa` : ''}`); }
        else if (!this.add(d.it)) continue;
        scene.remove(d.m); if (d.beam) scene.remove(d.beam); this.drops.splice(i, 1);
      }
    }
  },

  // ---------- arkut ----------
  chestTierCol: [0x7a5230, 0x4a6a9a, 0xc79a2a],
  spawnChests() {
    _rng = mulberry32(4242);
    const probe = { r: 0.75, h: 1.0 };
    const list = [];
    const add = (x, y, z, tier, id, force) => { list.push({ x, y, z, tier, id, force }); };
    // aloitusarkku portin ulkopuolella (varma ase)
    add(-5, 0, 106, 0, 'start', { type: 'axe', rar: 1 });
    // kattoarkut: korkeimmat rakennukset
    const bl = []; for (const k in World.blockB) for (const b of World.blockB[k]) if (!b.guardRoof && !b.tower && b.h >= 10) bl.push(b);
    bl.sort((a, b) => b.h - a.h);
    let roofN = 0;
    for (const b of bl) {
      if (roofN >= 8) break;
      const cs = [[b.x0 + 1.3, b.z0 + 1.3], [b.x1 - 1.3, b.z0 + 1.3], [b.x0 + 1.3, b.z1 - 1.3], [b.x1 - 1.3, b.z1 - 1.3]];
      for (const c of cs) if (freeAt(probe, c[0], b.h + 0.01, c[1], 1.0)) { add(c[0], b.h, c[1], roofN < 2 ? 2 : 1, 'roof' + roofN); roofN++; break; }
    }
    // tornien huiput
    for (const p of World.perches) add(p.cx - 1.5, p.yT, p.cz + (p.dir === 's' ? 1.0 : (p.dir === 'n' ? -1.0 : 0)) + (p.dir === 'w' ? 0 : 0), 2, 'top-' + p.name);
    // katutason arkut
    let n = 0, tries = 0;
    while (n < 5 && tries++ < 400) {
      const line = pick([-28, 28, 87, -87]), horiz = Math.random() < 0.5;
      const t = (Math.random() * 2 - 1) * 75;
      const x = horiz ? t : line + (Math.random() - .5) * 5, z = horiz ? line + (Math.random() - .5) * 5 : t;
      if (Math.abs(x) < 24 && Math.abs(z) < 24) continue;
      if (!freeAt(probe, x, 0, z, 1.0)) continue;
      if (list.some(c => Math.hypot(c.x - x, c.z - z) < 14)) continue;
      add(x, 0, z, 0, 'st' + n); n++;
    }
    for (const c of list) this.buildChest(c);
  },
  buildChest(c) {
    const g = new THREE.Group(); g.position.set(c.x, c.y, c.z);
    const col = this.chestTierCol[c.tier];
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.75), mat(col)); body.position.y = 0.25; body.castShadow = true; g.add(body);
    const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.5, -0.375); g.add(lidPivot);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.26, 0.77), mat(col)); lid.position.set(0, 0.13, 0.375); lid.castShadow = true; lidPivot.add(lid);
    const trim = c.tier === 2 ? 0xffe28a : 0xcdbb7a;
    for (const x of [-0.4, 0.4]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.78, 0.8), mat(trim)); b.position.set(x, 0.38, 0); g.add(b); }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.06), mat(trim)); lock.position.set(0, 0.5, 0.4); g.add(lock);
    if (c.tier >= 1) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: Loot.glowTex(), color: c.tier === 2 ? 0xffc23a : 0x4aa3ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
      sp.scale.set(3.2, 3.2, 1); sp.position.y = 0.7; g.add(sp); c.glow = sp;
    }
    scene.add(g); c.mesh = g; c.lid = lidPivot; c.open = false; c.lidT = 0;
    addCol(c.x - 0.55, c.y, c.z - 0.38, c.x + 0.55, c.y + 0.8, c.z + 0.38, { prop: true, chest: true });
    c.mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: Guards.icons.mark, color: 0xffd54a, transparent: true, depthTest: false })); c.mark.scale.set(0.5, 0.5, 1); c.mark.renderOrder = 999; c.mark.visible = false; c.mark.position.set(c.x, c.y + 1.6, c.z); scene.add(c.mark);
    this.chests.push(c);
  },
  glowTex() {
    if (this._gt) return this._gt;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); this._gt = new THREE.CanvasTexture(cv); return this._gt;
  },
  nearChest(P) {
    for (const c of this.chests) {
      if (c.open) continue;
      const dx = Math.max(c.x - 0.55 - P.pos.x, 0, P.pos.x - c.x - 0.55), dz = Math.max(c.z - 0.38 - P.pos.z, 0, P.pos.z - c.z - 0.38);
      if (Math.hypot(dx, dz) < 1.5 && Math.abs(P.pos.y - c.y) < 1.6) return c;
    }
    return null;
  },
  openChest(c) {
    c.open = true; this.opened++; Sfx.pickup(); this.addXp(30);
    const lvlB = this.level * 0.012 + this.stats.loot;
    const items = [];
    if (c.force) items.push(this.make('weapon', c.force.rar, { type: c.force.type }));
    else if (c.tier === 0) items.push(this.make(pickSlot(), this.rollRarity(0, lvlB + 0.05)));
    else if (c.tier === 1) { items.push(this.make(pickSlot(), this.rollRarity(1, lvlB + 0.1))); if (Math.random() < 0.5) items.push(this.make(pickSlot(), this.rollRarity(1, lvlB))); }
    else { items.push(this.make(pickSlot(), Math.random() < 0.4 ? 4 : this.rollRarity(2, lvlB + 0.15))); items.push(this.make(pickSlot(), this.rollRarity(2, lvlB))); }
    const silver = [[15, 40], [40, 90], [100, 200]][c.tier], iron = [[1, 3], [2, 5], [4, 8]][c.tier];
    const sv = Math.round(silver[0] + Math.random() * (silver[1] - silver[0])), ir = Math.round(iron[0] + Math.random() * (iron[1] - iron[0]));
    this.silver += sv; this.iron += ir; Game.toast(`Arkku: +${sv} hopeaa, +${ir} rautaa`);
    let best = 0;
    items.forEach((it, i) => { best = Math.max(best, it.rar); if (!this.add(it)) this.spawnDrop(it, { x: c.x, y: c.y, z: c.z }, i); });
    const col = RAR[best].hex; const r = ((col >> 16) & 255) / 255, g = ((col >> 8) & 255) / 255, b = (col & 255) / 255;
    FX.burst(c.x, c.y + 0.8, c.z, 30, 4, [r, g, b], 0.3, 1.0, 2, 3, 0.5);
    if (c.glow) c.glow.visible = false;
  },
  updateChests(dt) {
    const P = Player;
    for (const c of this.chests) {
      if (c.open && c.lidT < 1) { c.lidT = Math.min(1, c.lidT + dt * 3); c.lid.rotation.x = -c.lidT * 1.9; }
      c.mark.visible = !c.open && (Game.eagle || (Game.synced && Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 30));
      if (c.glow && !c.open) c.glow.material.opacity = 0.55 + Math.sin(performance.now() / 400 + c.x) * 0.25;
    }
  },

  // ---------- näkyvyys ----------
  applyVisuals() {
    const rig = Player.rig; if (!rig) return;
    const w = this.find(this.equip.w1);
    setWeaponModel(rig, w ? w.type : null, w ? RAR[w.rar] : RAR[0]);
    const a = this.find(this.equip.armor);
    const col = a ? ABASE[a.weight].color : 0x2b3340;
    rig.torso.material = mat(a && a.rar >= 3 ? tintColor(col, 1.25) : col);
    if (rig.pads) rig.pads.visible = !!a && a.weight !== 'light';
  },
  init() {
    const w1 = this.make('weapon', 0, { type: 'sword', name: 'Harjoitusmiekka' }); const w2 = this.make('weapon', 0, { type: 'dagger', name: 'Hiipijän tikari' });
    const ar = this.make('armor', 0, { weight: 'light', name: 'Kulunut kaapu' });
    ar.def = 4; w1.dmg = 38; w2.dmg = 22;
    this.inv.push(w1, w2, ar); this.equip.w1 = w1.id; this.equip.w2 = w2.id; this.equip.armor = ar.id;
    this.recompute(); this.applyVisuals();
  },
  update(dt) { this.updateDrops(dt); this.updateChests(dt); },
};
function pickSlot() { const r = Math.random(); return r < 0.5 ? 'weapon' : (r < 0.8 ? 'armor' : 'charm'); }
function tintColor(c, k) { const r = Math.min(255, ((c >> 16) & 255) * k), g = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k); return (r << 16) | (g << 8) | b; }
