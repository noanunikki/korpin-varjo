'use strict';
// =====================================================================
//  KÄYTTÖLIITTYMÄ: inventaario, varusteet, taitopuu
// =====================================================================
const Inv = {
  open: false, tab: 'gear', sel: null,
  toggle() { this.open ? this.close() : this.show(); },
  show() {
    if (!Game.started || Game.ended || Player.state === 'dead') return;
    this.open = true; Game.menu = true; Input.keys = {};
    if (document.exitPointerLock) document.exitPointerLock();
    document.getElementById('inv').style.display = 'flex'; this.render();
  },
  close() {
    this.open = false; Game.menu = false;
    document.getElementById('inv').style.display = 'none'; Game.tryLock();
  },
  statRows(it, cmp) {
    const rows = [];
    const d = (a, b, f, inv) => {
      if (!cmp || b === undefined) return '';
      const x = a - b; if (Math.abs(x) < 0.005) return '';
      const good = inv ? x < 0 : x > 0;
      return ` <span class="${good ? 'up' : 'dn'}">${good ? '▲' : '▼'} ${f(Math.abs(x))}</span>`;
    };
    const m = 1 + 0.08 * it.upg;
    if (it.slot === 'weapon') {
      const c = cmp && cmp.slot === 'weapon' ? cmp : null, cm = c ? 1 + 0.08 * c.upg : 1;
      rows.push(['Vahinko', (it.dmg * m).toFixed(0) + d(it.dmg * m, c && c.dmg * cm, v => v.toFixed(0))]);
      rows.push(['Iskuaika', it.dur.toFixed(2) + ' s' + d(it.dur, c && c.dur, v => v.toFixed(2), true)]);
      rows.push(['Ulottuvuus', it.reach.toFixed(1) + ' m' + d(it.reach, c && c.reach, v => v.toFixed(1))]);
      rows.push(['Kriittinen', (it.crit * 100).toFixed(0) + ' %' + d(it.crit, c && c.crit, v => (v * 100).toFixed(0) + ' %')]);
      rows.push(['Horjutus', '×' + it.stag.toFixed(1)]);
    } else if (it.slot === 'armor') {
      const c = cmp && cmp.slot === 'armor' ? cmp : null, cm = c ? 1 + 0.08 * c.upg : 1;
      rows.push(['Puolustus', (it.def * m).toFixed(0) + d(it.def * m, c && c.def * cm, v => v.toFixed(0))]);
      if (it.weight === 'heavy') rows.push(['Haitta', 'Näkyvämpi, hitaampi kiipeämään']);
      if (it.weight === 'light') rows.push(['Etu', 'Hiljaisemmat askeleet']);
    }
    return rows;
  },
  itemCard(it) {
    if (!it) return '<div class="empty">Valitse esine</div>';
    const R = RAR[it.rar], eq = Loot.slotOf(it);
    const other = eq ? null : Loot.find(it.slot === 'weapon' ? Loot.equip.w1 : Loot.equip[it.slot]);
    let h = `<div class="icard" style="border-color:${R.col}"><div class="rar" style="color:${R.col}">${R.name} · ${Loot.typeName(it)}</div>`;
    h += `<div class="iname" style="color:${R.col}">${Loot.icon(it)} ${it.name}${it.upg ? ` <b>+${it.upg}</b>` : ''}</div>`;
    h += `<div class="ipow">Voima <b>${Loot.power(it)}</b>${eq ? ' · <i>varusteena</i>' : ''}</div><div class="rows">`;
    for (const [k, v] of this.statRows(it, other)) h += `<div><span>${k}</span><span>${v}</span></div>`;
    h += '</div>';
    if (it.perks.length) { h += '<div class="perks">'; for (const p of it.perks) h += `<div>✦ <b>${PERKS[p.id].n}</b>: ${PERKS[p.id].f(p.v)}</div>`; h += '</div>'; }
    h += '<div class="btns">';
    if (it.slot === 'weapon') {
      h += `<button data-a="eq" data-k="w1" data-id="${it.id}">Pääase</button><button data-a="eq" data-k="w2" data-id="${it.id}">Toinen ase</button>`;
    } else h += `<button data-a="eq" data-k="${it.slot}" data-id="${it.id}">Varusta</button>`;
    if (eq) h += `<button data-a="un" data-k="${eq}">Riisu</button>`;
    if (it.upg < 5) { const c = Loot.upCost(it), can = Loot.silver >= c.silver && Loot.iron >= c.iron; h += `<button class="${can ? '' : 'dis'}" data-a="up" data-id="${it.id}">Paranna (${c.silver} ⛁ + ${c.iron} rautaa)</button>`; }
    if (!eq) h += `<button data-a="sell" data-id="${it.id}">Myy ${Loot.value(it)} ⛁</button>`;
    h += '</div></div>';
    return h;
  },
  slotBox(label, key) {
    const it = Loot.find(Loot.equip[key]);
    const bd = it ? RAR[it.rar].col : '#555';
    return `<div class="slot ${this.sel === (it && it.id) ? 'sel' : ''}" style="border-color:${bd}" data-a="sel" data-id="${it ? it.id : ''}"><div class="sl">${label}</div>` +
      (it ? `<div class="si">${Loot.icon(it)}</div><div class="sn" style="color:${bd}">${it.name}</div>` : '<div class="sn dim">Tyhjä</div>') + '</div>';
  },
  render() {
    const body = document.getElementById('invbody'); if (!body) return;
    document.querySelectorAll('#inv .invtabs [data-tab]').forEach(el => el.classList.toggle('on', el.dataset.tab === this.tab));
    if (this.sel && !Loot.find(this.sel)) this.sel = null;
    if (this.tab === 'skills') { body.innerHTML = this.skillsHtml(); return; }
    const S = Loot.stats;
    let h = '<div class="gear">';
    // vasen: hahmo
    h += `<div class="col chr"><div class="lvl">Taso <b>${Loot.level}</b></div><div class="xpbar"><i style="width:${Loot.level >= 20 ? 100 : Loot.xp / Loot.need(Loot.level) * 100}%"></i></div>`;
    h += `<div class="xpt">${Loot.level >= 20 ? 'Huipputaso' : `${Loot.xp} / ${Loot.need(Loot.level)} kokemusta`}</div>`;
    h += `<div class="pw">Voimataso <b>${Loot.charPower()}</b></div>`;
    h += '<div class="slots">' + this.slotBox('Pääase', 'w1') + this.slotBox('Toinen ase (R)', 'w2') + this.slotBox('Panssari', 'armor') + this.slotBox('Talismaani', 'charm') + '</div>';
    h += '<div class="rows st">';
    const rows = [['Vahinko', S.dmg.toFixed(0)], ['Iskuaika', S.dur.toFixed(2) + ' s'], ['Kriittinen', (S.crit * 100).toFixed(0) + ' %'], ['Puolustus', S.def.toFixed(0)], ['Elämä', Math.round(Player.maxHp)],
    ['Putoamisvahinko', (S.fall * 100).toFixed(0) + ' %'], ['Näkyvyys', (S.sight * 100).toFixed(0) + ' %'], ['Kiipeäminen', (S.climb * 100).toFixed(0) + ' %']];
    for (const [k, v] of rows) h += `<div><span>${k}</span><span>${v}</span></div>`;
    h += `</div><div class="cur"><span>⛁ Hopea <b>${Loot.silver}</b></span><span>Rauta <b>${Loot.iron}</b></span></div></div>`;
    // keski: ruudukko
    h += `<div class="col mid"><div class="gtitle">Reppu <i>${Loot.inv.filter(i => !Loot.slotOf(i)).length} / ${Loot.cap}</i></div><div class="grid">`;
    const sorted = Loot.inv.filter(i => !Loot.slotOf(i)).sort((a, b) => b.rar - a.rar || Loot.power(b) - Loot.power(a));
    for (let i = 0; i < Loot.cap; i++) {
      const it = sorted[i];
      if (!it) { h += '<div class="cell empty"></div>'; continue; }
      const R = RAR[it.rar];
      h += `<div class="cell ${this.sel === it.id ? 'sel' : ''}" style="border-color:${R.col};box-shadow:inset 0 0 10px ${R.col}33" data-a="sel" data-id="${it.id}" data-dbl="1" title="${it.name}"><span class="ci">${Loot.icon(it)}</span><span class="cp">${Loot.power(it)}</span></div>`;
    }
    h += '</div><div class="hintl">Kaksoisklikkaa esinettä varustaaksesi · Tab sulkee</div></div>';
    // oikea: yksityiskohdat
    h += `<div class="col det">${this.itemCard(Loot.find(this.sel))}</div></div>`;
    body.innerHTML = h;
  },
  skillsHtml() {
    let h = `<div class="skills"><div class="sphead">Taitopisteet: <b>${Loot.sp}</b> <i>Taso ${Loot.level}</i></div><div class="sbr">`;
    for (const br of ['Korppi', 'Soturi', 'Salamurhaaja']) {
      h += `<div class="sbc"><div class="sbt">${br}</div>`;
      for (const s of SKILLS.filter(k => k.br === br)) {
        const r = Loot.skills[s.id] || 0;
        h += `<div class="sk ${r > 0 ? 'has' : ''}"><div class="skn">${s.n}</div><div class="skd">${r > 0 ? s.d(r) : s.d(1)}${r > 0 && r < s.max ? `<br><i>Seuraava: ${s.d(r + 1)}</i>` : ''}</div>`;
        h += '<div class="pips">' + Array.from({ length: s.max }, (_, i) => `<b class="${i < r ? 'on' : ''}"></b>`).join('') + '</div>';
        h += `<button class="${r >= s.max || Loot.sp <= 0 ? 'dis' : ''}" data-a="skill" data-id="${s.id}">${r >= s.max ? 'Täysi' : 'Opi (1 piste)'}</button></div>`;
      }
      h += '</div>';
    }
    return h + '</div></div>';
  },
  click(e) {
    const t = e.target.closest('[data-a]'); if (!t) return;
    const a = t.dataset.a, id = +t.dataset.id;
    if (a === 'sel') { this.sel = id || null; }
    else if (a === 'eq') { Loot.equipItem(id, t.dataset.k); }
    else if (a === 'un') { Loot.unequip(t.dataset.k); }
    else if (a === 'up') { Loot.upgrade(id); }
    else if (a === 'sell') { if (Loot.sell(id)) this.sel = null; }
    else if (a === 'skill') { Loot.buySkill(t.dataset.id); }
    this.render();
  },
  dbl(e) {
    const t = e.target.closest('[data-dbl]'); if (!t) return;
    const it = Loot.find(+t.dataset.id); if (!it) return;
    Loot.equipItem(it.id, it.slot === 'weapon' ? 'w1' : it.slot); this.sel = it.id; this.render();
  },
  init() {
    const root = document.getElementById('inv');
    root.addEventListener('click', (e) => {
      const tb = e.target.closest('[data-tab]'); if (tb) { this.tab = tb.dataset.tab; this.render(); return; }
      if (e.target.closest('.closebtn')) { this.close(); return; }
      this.click(e);
    });
    root.addEventListener('dblclick', (e) => this.dbl(e));
  },
};
