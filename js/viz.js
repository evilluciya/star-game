/* viz.js — SVG visualizations for sections I–IX. Text lives in the pictures, not under them. */
import * as E from './engine.js?v=202611170128';

const NS = 'http://www.w3.org/2000/svg';
const RED = '#d3122a', RED2 = '#ff3349', PAPER = '#f2efe8', MUTE = '#8d8a84', LINE = 'rgba(242,239,232,.16)', INK = '#050505';

function svg(vb, inner) { return `<svg viewBox="${vb}" xmlns="${NS}" role="img">${inner}</svg>`; }
const t = (x, y, s, cls = '', attrs = '') => `<text x="${x}" y="${y}" class="${cls}" ${attrs}>${s}</text>`;

/** alchemical glyph as SVG path (geometry of the source symbols, 0..100 box) */
export function glyph(el, cx, cy, size, color = PAPER, w = 7) {
  const k = size / 100, x0 = cx - size / 2, y0 = cy - size / 2, P = (x, y) => `${(x0 + x * k).toFixed(1)},${(y0 + y * k).toFixed(1)}`;
  const sw = (w * k).toFixed(2), st = `fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
  if (el === 'a') return `<g ${st}><circle cx="${cx}" cy="${cy}" r="${34 * k}"/><path d="M${P(16, 50)}L${P(84, 50)}"/></g>`;
  if (el === 'l') return `<g ${st}><path d="M${P(30, 14)}A${20 * k} ${20 * k} 0 0 0 ${P(70, 14)}"/><circle cx="${x0 + 50 * k}" cy="${y0 + 46 * k}" r="${20 * k}"/><path d="M${P(50, 66)}L${P(50, 92)}M${P(34, 80)}L${P(66, 80)}"/></g>`;
  return `<g ${st}><path d="M${P(50, 16)}L${P(78, 60)}L${P(22, 60)}Z M${P(50, 60)}L${P(50, 92)}M${P(34, 78)}L${P(66, 78)}"/></g>`;
}

/** piece notation drawn with symbols only: big outer glyph, then the inner glyph in brackets.
 *  nota(c)            -> inline <svg class="nt"> for HTML text (takes the text colour)
 *  nota(c, {x,y,h,color}) -> nested <svg> centred at x,y inside another SVG */
// one line, both signs the same size: X(Y); same layout as scene.drawNota
const NT_VB = '16 30 70 40';
function notaBody(c, color) {
  return glyph(E.outerOf(c), 30, 50, 36, color, 9)
    + `<path d="M47 35Q42 50 47 65M77 35Q82 50 77 65" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>`
    + glyph(E.innerOf(c), 62, 50, 36, color, 9);
}
export function nota(c, at = null) {
  if (at) {
    const w = at.h * 70 / 40;
    return `<svg x="${(at.x - w / 2).toFixed(1)}" y="${(at.y - at.h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${at.h}" viewBox="${NT_VB}" overflow="visible">${notaBody(c, at.color || PAPER)}</svg>`;
  }
  return `<svg class="nt" viewBox="${NT_VB}" role="img" aria-label="${E.longName(c)}">${notaBody(c, 'currentColor')}</svg>`;
}
// the game's sign (label.svg): heptagram in a double ring, drawn in the current text colour
export const LABEL = `<svg class="lbl" viewBox="0 0 1000 1000" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="34"><path d="M821.412 821.412L45.455 500l775.957-321.412L500 954.545 178.588 178.588 954.545 500 178.588 821.412h642.824L178.588 178.588M178.588 821.412l642.824-642.824"/><circle cx="500" cy="500" r="461"/><circle cx="500" cy="500" r="480"/></g></svg>`;
/** HTML for a data-tip attribute (quotes escaped) */
export const attr = (html) => html.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
/** whole phase cycle, symbols only */
export const cycleHTML = () => [0, 1, 2, 3, 4, 5, 6, 7, 8].map((c) => nota(c)).join(' → ');

/* tooltips: any element with data-tip */
const tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip);
const showTip = (e) => {
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (!el) { tip.classList.remove('show'); return; }
  tip.innerHTML = el.getAttribute('data-tip'); tip.classList.add('show');
  const x = Math.max(8, Math.min(e.clientX + 14, innerWidth - 300)), y = e.clientY + 16;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
};
document.addEventListener('pointermove', showTip);
document.addEventListener('pointerdown', showTip);  // phones: a tap shows the tip
addEventListener('scroll', () => tip.classList.remove('show'), { passive: true });

/* ---------------- I. Tree ---------------- */
export function tree(root, onBoard) {
  const H = 72, top = 30, W = 1000;
  let rows = '';
  const grade = { 1: ['Посвящённый'], 4: ['Адепт'], 5: ['Мастер Храма /', 'Госпожа Земли'] };
  for (let b = 7; b >= 1; b--) {
    const y = top + (7 - b) * H, B = E.BOARDS[b], mira = b === E.MIRA;
    let mini = '';
    for (let r = 1; r <= 6; r++) for (let c = 1; c <= 3; c++)
      mini += `<rect x="${100 + (r - 1) * 9}" y="${y + 14 + (c - 1) * 9}" width="9" height="9" fill="${E.squareColor(r, c) === 'black' ? '#111' : '#e9e6df'}"/>`;
    rows += `<g class="hot" data-board="${b}" data-tip="Нажмите — показать доску ${B.name} в 3D">
      <rect x="0" y="${y}" width="${W}" height="${H - 6}" fill="transparent"/>
      <circle cx="40" cy="${y + 28}" r="${mira ? 11 : 8}" fill="${mira ? RED : INK}" stroke="${mira ? RED : PAPER}" stroke-width="1.5" class="hl"/>
      ${mini}<rect class="hl" x="99" y="${y + 13}" width="56" height="29" fill="none" stroke="${mira ? RED : LINE}"/>
      ${t(180, y + 38, `${b} · ${B.name}`, 'sc', `font-size="32" ${mira ? `fill="${RED2}"` : ''}`)}
      ${t(470, y + 26, B.latin.toUpperCase(), 'mono mute', 'font-size="13" letter-spacing="3"')}
      ${t(470, y + 46, 'сфера ' + B.sphereOf, '', 'font-size="20"')}
      ${grade[b] ? `<path d="M700 ${y + 28}h30" stroke="${RED}" stroke-width="2"/>` + grade[b].map((s, k, a) =>
        t(742, y + 35 + (k - (a.length - 1) / 2) * 24, s, 'sc', `font-size="21" fill="${RED2}"`)).join('') : ''}
    </g>`;
  }
  const spineTop = top + 28, spineBot = top + 6 * H + 28;
  const abyssY = top + 3 * H - 3; // the gap between the Rigel (5) row and the Mira (4) row
  const html = svg(`0 0 ${W} ${top + 7 * H + 10}`, `
    <defs><linearGradient id="cg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${PAPER}" stop-opacity=".8"/><stop offset="1" stop-color="${PAPER}" stop-opacity=".08"/></linearGradient></defs>
    <rect x="38" y="${spineTop}" width="4" height="${spineBot - spineTop}" fill="url(#cg)"/>
    ${t(8, spineBot + 40, 'каузальное', 'mono mute', 'font-size="12"')}${t(8, spineTop - 12, 'акаузальное', 'mono mute', 'font-size="12"')}
    <path d="M60 ${abyssY}H990" stroke="${RED}" stroke-dasharray="6 6" stroke-width="1.5"/>
    ${t(990, abyssY + 17, 'Бездна: Солнце → Марс', 'mono', `font-size="13" text-anchor="end" fill="${RED2}"`)}
    ${rows}`);
  root.innerHTML = html;
  root.querySelectorAll('[data-board]').forEach((g) => g.addEventListener('click', () => onBoard && onBoard(+g.dataset.board)));
}

/* ---------------- II. Wheel of phases + reach chart ---------------- */
const JUNG = ['Чувствующий экстраверт', 'Интуитивный экстраверт', 'Мыслительный экстраверт', 'Чувствующий интроверт',
  'Интуитивный интроверт', 'Мыслительный интроверт', 'Мастер Храма / Госпожа', 'Гранд Мастер / Гранд Госпожа', 'Homo Galactica'];
const MOVE_RULE = { salt: 'шаг по диагонали на клетку того же цвета или ±1 доска (тот же цвет)', mercury: 'любая клетка своей доски или ±1–2 доски', sulphur: 'любая свободная клетка любой доски' };

export function wheel(root, onSelect) {
  let sel = 0;
  const cx = 230, cy = 230, R = 160;
  function draw() {
    let g = '';
    // group arcs
    ['a', 'l', 'w'].forEach((el, gi) => {
      const a0 = (-90 + gi * 120 - 17) * Math.PI / 180, a1 = (-90 + gi * 120 + 97) * Math.PI / 180, RR = R + 44;
      const on = E.outerOf(sel) === el;
      g += `<path d="M${cx + RR * Math.cos(a0)} ${cy + RR * Math.sin(a0)} A${RR} ${RR} 0 0 1 ${cx + RR * Math.cos(a1)} ${cy + RR * Math.sin(a1)}" fill="none" stroke="${on ? RED : LINE}" stroke-width="${on ? 3 : 2}"/>`;
      const am = (-90 + gi * 120 + 40) * Math.PI / 180;
      g += t(cx + (RR + 22) * Math.cos(am), cy + (RR + 22) * Math.sin(am) + 5, E.ELEMENTS[el].name, 'sc', `font-size="19" text-anchor="middle" ${on ? `fill="${RED2}"` : ''}`);
    });
    for (let i = 0; i < 9; i++) {
      const a = (-90 + i * 40) * Math.PI / 180, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      const a2 = (-90 + (i + 1) * 40 - 12) * Math.PI / 180, a1 = (-90 + i * 40 + 12) * Math.PI / 180;
      g += `<path d="M${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)} A${R} ${R} 0 0 1 ${cx + R * Math.cos(a2)} ${cy + R * Math.sin(a2)}" fill="none" stroke="${MUTE}" stroke-width="1" marker-end="url(#arr)"/>`;
      const on = i === sel;
      g += `<g class="hot" data-i="${i}" data-tip="${attr(nota(i) + ' ' + E.longName(i))}"><circle cx="${x}" cy="${y}" r="28" fill="${on ? RED : INK}" stroke="${on ? RED : PAPER}" stroke-width="1.5"/>
        ${nota(i, { x, y, h: 26, color: on ? '#fff' : PAPER })}</g>`;
    }
    const lvl = ['эго', 'самость', 'за пределами индивидуации'][Math.floor(sel / 3)], fn = ['Чувство', 'Интуиция', 'Мышление'][sel % 3];
    g += nota(sel, { x: cx, y: cy - 22, h: 60, color: PAPER });
    g += t(cx, cy + 34, E.longName(sel), 'sc', 'font-size="18" text-anchor="middle"');
    g += t(cx, cy + 56, `${fn} · ${lvl}`, 'mono mute', 'font-size="11" text-anchor="middle"');
    root.innerHTML = svg('-30 -30 520 520', `<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${MUTE}"/></marker></defs>${g}`)
      + `<p class="viz-note">Нажмите фазу. После ${nota(8)} цикл начинается снова с ${nota(0)}.</p>`;
    root.querySelectorAll('[data-i]').forEach((n) => n.addEventListener('click', () => { sel = +n.dataset.i; draw(); onSelect && onSelect(sel); }));
  }
  draw();
  return { select(i) { sel = i; draw(); } };
}

export function reachChart(root) {
  let combo = 3, from = 1;
  function draw() {
    const per = E.reach(combo, from), max = 18, W = 520, rowH = 44;
    let g = '';
    for (let b = 7; b >= 1; b--) {
      const y = (7 - b) * rowH + 40, w = per[b] / max * (W - 170), on = per[b] > 0;
      g += t(0, y + 22, E.BOARDS[b].name, 'sc', `font-size="19" ${b === from ? `fill="${RED2}"` : ''}`);
      g += `<rect x="120" y="${y + 6}" width="${W - 170}" height="22" fill="none" stroke="${LINE}"/>`;
      if (on) g += `<rect x="120" y="${y + 6}" width="${w}" height="22" fill="${b === from ? PAPER : RED}"><animate attributeName="width" from="0" to="${w}" dur=".5s" fill="freeze"/></rect>`;
      g += t(W - 42, y + 23, on ? per[b] : '—', 'mono', `font-size="14" ${on ? '' : 'class="mute"'}`);  // right of the bar frame
      if (b === from) g += t(W - 8, y + 23, '●', 'mono', `font-size="12" fill="${RED2}"`);
    }
    const total = per.reduce((a, x) => a + x, 0);
    const word = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'клетка' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'клетки' : 'клеток');
    g += nota(combo, { x: 19, y: 14, h: 24, color: PAPER }) + t(46, 22, `с доски ${E.BOARDS[from].name}: ${total} ${word(total)}`, 'sc', 'font-size="22"');
    root.innerHTML = svg(`0 0 ${W} ${7 * rowH + 50}`, g) +
      `<p class="viz-note">${E.longName(combo)}: ${MOVE_RULE[E.movementType(combo)]}. Доски пустые, фишка в центре.</p>
       <div class="viz-controls">Откуда: <input type="range" min="1" max="7" value="${from}" id="reachFrom"> <b>${E.BOARDS[from].name}</b></div>`;
    root.querySelector('#reachFrom').addEventListener('input', (e) => { from = +e.target.value; draw(); });
  }
  draw();
  return { setCombo(c) { combo = c; draw(); } };
}

/* ---------------- III. Setup ---------------- */
export function setup(root) {
  const g0 = new E.Game();
  const cs = 26, bw = cs * 3, gap = 22;
  let g = '';
  for (let b = 1; b <= 7; b++) {
    const x = (b - 1) * (bw + gap), y = 34;
    g += t(x + bw / 2, 16, E.BOARDS[b].name, 'sc', `font-size="16" text-anchor="middle" ${b === E.MIRA ? `fill="${RED2}"` : ''}`);
    for (let r = 1; r <= 6; r++) for (let c = 1; c <= 3; c++) {
      const X = x + (c - 1) * cs, Y = y + (r - 1) * cs;
      g += `<rect x="${X}" y="${Y}" width="${cs}" height="${cs}" fill="${E.squareColor(r, c) === 'black' ? '#111' : '#e9e6df'}"/>`;
      const p = g0.pieceAt(b, r, c);
      if (p) {
        const fill = p.color === 'white' ? '#fff' : '#000', ink = p.color === 'white' ? '#000' : '#fff';
        g += `<g data-tip="${attr(`${p.color === 'white' ? 'Белая' : 'Чёрная'} ${nota(p.combo)} ${E.longName(p.combo)}`)}"><circle cx="${X + cs / 2}" cy="${Y + cs / 2}" r="${cs / 2 - 2}" fill="${fill}" stroke="${RED}" stroke-width="1"/>
          ${nota(p.combo, { x: X + cs / 2, y: Y + cs / 2, h: 12, color: ink })}</g>`;
      }
    }
    g += `<rect x="${x}" y="${y}" width="${bw}" height="${cs * 6}" fill="none" stroke="${b === E.MIRA ? RED : LINE}" stroke-width="${b === E.MIRA ? 2 : 1}"/>`;
    const cnt = g0.pieces.filter((p) => p.board === b).length;
    g += t(x + bw / 2, y + cs * 6 + 20, cnt ? `${cnt / 2} + ${cnt / 2}` : 'пусто', 'mono mute', 'font-size="11" text-anchor="middle"');
  }
  root.innerHTML = svg(`-4 0 ${7 * (bw + gap)} ${34 + cs * 6 + 30}`, g) +
    `<p class="viz-note">Наведите на фишку или нажмите её. Соль — Сириус и Арктур, Ртуть — Антарес и Ригель, Сера — Денеб и Наос.</p>`;
}

/* ---------------- IV. Goal + Mira clock ---------------- */
export function goal(root) {
  let strict = true;
  function draw() {
    const cs = 64, tg = E.makeTargets(strict ? 'strict' : 'classic');
    let g = '';
    for (let r = 1; r <= 6; r++) for (let c = 1; c <= 3; c++) {
      const X = (c - 1) * cs, Y = (r - 1) * cs + 30;
      g += `<rect x="${X}" y="${Y}" width="${cs}" height="${cs}" fill="${E.squareColor(r, c) === 'black' ? '#111' : '#e9e6df'}"/>`;
    }
    for (const color of ['white', 'black']) for (const [r, c, cb] of tg[color]) {
      const X = (c - 1) * cs + cs / 2, Y = (r - 1) * cs + 30 + cs / 2, fill = color === 'white' ? '#fff' : '#000', ink = color === 'white' ? '#000' : '#fff';
      g += `<circle cx="${X}" cy="${Y}" r="${cs / 2 - 6}" fill="${fill}" stroke="${RED}" stroke-width="2"/>`;
      g += cb === null ? t(X, Y + 7, color === 'white' ? 'Б' : 'Ч', 'sc', `font-size="22" text-anchor="middle" fill="${ink}"`)
        : nota(cb, { x: X, y: Y, h: 26, color: ink });
    }
    g += `<rect x="0" y="30" width="${cs * 3}" height="${cs * 6}" fill="none" stroke="${RED}" stroke-width="2"/>`;
    g += t(cs * 1.5, 18, 'Мира · цели', 'sc', `font-size="20" text-anchor="middle" fill="${RED2}"`);
    g += `<path d="M${cs * 3 + 10} ${30 + cs}h18" stroke="${PAPER}"/>${t(cs * 3 + 34, 30 + cs + 5, 'цель белых', 'mono', 'font-size="12"')}`;
    g += `<path d="M${cs * 3 + 10} ${30 + cs * 5}h18" stroke="${PAPER}"/>${t(cs * 3 + 34, 30 + cs * 5 + 5, 'цель чёрных', 'mono', 'font-size="12"')}`;
    root.innerHTML = svg(`-4 0 ${cs * 3 + 130} ${cs * 6 + 40}`, g) +
      `<div class="viz-controls"><label class="toggle"><input type="checkbox" ${strict ? 'checked' : ''} id="goalStrict"><span></span>вариант «точные фишки»: важна и фаза</label></div>`;
    root.querySelector('#goalStrict').addEventListener('change', (e) => { strict = e.target.checked; draw(); });
  }
  draw();
}

export function miraClock(root) {
  // three white pieces A, B, C on Mira; one row per piece, one column per white move
  const steps = [
    { txt: 'A приходит на Миру — это первый из трёх ходов.', s: [1, null, null] },
    { txt: 'Белые ходят другой фишкой. A стоит второй ход.', s: [2, null, null] },
    { txt: 'B приходит на Миру. A стоит третий ход — срок вышел.', s: [3, 1, null], f: [0] },
    { txt: 'Обязательно ходит A: по Мире, если ход допустим, или на другую доску. Ход по Мире даёт ещё два хода ожидания.', s: [1, 2, null], m: [0] },
    { txt: 'C приходит на Миру. Теперь срок вышел у B.', s: [2, 3, 1], f: [1] },
    { txt: 'Три фишки на Мире одновременно — столько и нужно для своего треугольника. Если они стоят на своих клетках, партия выиграна.', s: [3, 1, 2], m: [1], win: true },
  ];
  let k = 0;
  function draw() {
    const cw = 64, rh = 54, x0 = 70, y0 = 40;
    let g = '';
    for (let j = 0; j < steps.length; j++) g += t(x0 + j * cw + cw / 2, 24, `ход ${j + 1}`, 'mono mute', 'font-size="11" text-anchor="middle"');
    ['A', 'B', 'C'].forEach((name, i) => {
      g += t(20, y0 + i * rh + 34, name, 'sc', 'font-size="26"');
      for (let j = 0; j < steps.length; j++) {
        const st = steps[j], v = st.s[i], shown = j <= k, forced = st.f && st.f.includes(i), moved = st.m && st.m.includes(i);
        const X = x0 + j * cw, Y = y0 + i * rh;
        g += `<rect x="${X + 4}" y="${Y + 6}" width="${cw - 8}" height="${rh - 12}" fill="${!shown || v === null ? 'none' : forced ? RED : 'rgba(242,239,232,' + (0.12 + v * 0.2) + ')'}" stroke="${j === k ? PAPER : LINE}"/>`;
        if (shown && v !== null) g += t(X + cw / 2, Y + rh / 2 + 8, v, 'sc', `font-size="24" text-anchor="middle" ${forced ? 'fill="#fff"' : ''}`);
        if (shown && moved) g += t(X + cw - 12, Y + 20, '↻', 'mono', `font-size="13" fill="${RED2}"`);
      }
    });
    root.innerHTML = svg(`0 0 ${x0 + steps.length * cw + 10} ${y0 + 3 * rh + 10}`, g) +
      `<p class="viz-note" style="min-height:3.2em;color:var(--paper)">${steps[k].txt}</p>
       <div class="viz-controls"><button class="chip" id="clkPrev">◀</button><button class="chip" id="clkNext">▶</button><span class="mute">красным — фишка обязана сдвинуться; ↻ — сдвинулась по Мире</span></div>`;
    root.querySelector('#clkPrev').onclick = () => { k = Math.max(0, k - 1); draw(); };
    root.querySelector('#clkNext').onclick = () => { k = Math.min(steps.length - 1, k + 1); draw(); };
  }
  draw();
}

/* ---------------- V. Capture ---------------- */
export function capture(root) {
  let protectMira = false;
  function draw() {
    const W = 760, cx = 380, cy = 70;
    let g = `<circle cx="${cx}" cy="${cy}" r="40" fill="${RED}"/>${nota(8, { x: cx, y: cy, h: 38, color: '#fff' })}`;
    g += t(cx, cy - 52, 'Сера (Сера) на Наосе', 'sc', 'font-size="20" text-anchor="middle"');
    const xs = [70, 190, 310, 450, 570, 690];
    [1, 2, 3, 4, 5, 6].forEach((b, i) => {
      const x = xs[i], y = 300, ok = !(b === E.MIRA && protectMira);
      g += `<path d="M${cx} ${cy + 40} C ${cx} ${cy + 160}, ${x} ${y - 140}, ${x} ${y - 30}" fill="none" stroke="${ok ? RED : MUTE}" stroke-width="${ok ? 2 : 1}" ${ok ? '' : 'stroke-dasharray="5 6"'}>${ok ? `<animate attributeName="stroke-dasharray" from="0 600" to="600 0" dur="1.2s" begin="${i * 0.1}s" fill="freeze"/>` : ''}</path>`;
      g += `<rect x="${x - 46}" y="${y - 28}" width="92" height="56" fill="${INK}" stroke="${ok ? PAPER : LINE}"/>${t(x, y + 6, E.BOARDS[b].name, 'sc', `font-size="18" text-anchor="middle" ${ok ? '' : 'class="mute"'}`)}`;
      g += t(x, y + 46, ok ? 'можно' : 'нельзя', 'mono', `font-size="11" text-anchor="middle" ${ok ? `fill="${RED2}"` : 'class="mute"'}`);
    });
    g += `<g transform="translate(${W - 60},${cy})"><rect x="-46" y="-28" width="92" height="56" fill="${INK}" stroke="${LINE}"/>${t(0, 6, 'Наос', 'sc', 'font-size="18" text-anchor="middle" class="mute"')}<path d="M-30 -18L30 18M30 -18L-30 18" stroke="${RED}" stroke-width="2"/>${t(0, 46, 'нельзя', 'mono mute', 'font-size="11" text-anchor="middle"')}</g>`;
    g += `<g transform="translate(70,${cy})">${t(0, -8, 'после захвата', 'mono mute', 'font-size="11" text-anchor="middle"')}${nota(8, { x: -30, y: 9, h: 20, color: PAPER })}${t(0, 15, '→', 'mono', 'font-size="16" text-anchor="middle"')}${nota(0, { x: 30, y: 9, h: 20, color: PAPER })}${t(0, 32, 'остаётся на Наосе', 'mono mute', 'font-size="11" text-anchor="middle"')}</g>`;
    root.innerHTML = svg(`0 0 ${W} 370`, g) +
      `<div class="viz-controls"><label class="toggle"><input type="checkbox" id="capVar" ${protectMira ? 'checked' : ''}><span></span>вариация: Наос не бьёт на Мире («лёгкий режим»)</label></div>`;
    root.querySelector('#capVar').addEventListener('change', (e) => { protectMira = e.target.checked; draw(); });
  }
  draw();
}

/* ---------------- VI. Jung 3×3 ---------------- */
export function jung(root) {
  const cw = 230, rh = 96, x0 = 196, y0 = 60;
  let g = '';
  ['Чувство', 'Интуиция', 'Мышление'].forEach((f, j) => {
    g += t(x0 + j * cw + cw / 2, 26, f, 'sc', 'font-size="22" text-anchor="middle"');
    const mx = x0 + j * cw + cw / 2;
    g += t(mx - 13, 47, '(', 'mono mute', 'font-size="14" text-anchor="middle"') + glyph(E.ORDER[j], mx, 42, 16, MUTE, 9) + t(mx + 13, 47, ')', 'mono mute', 'font-size="14" text-anchor="middle"');
  });
  [['эго'], ['самость'], ['за пределами', 'индивидуации']].forEach((lv, i) => {
    const cy = y0 + i * rh + rh / 2;
    g += glyph(E.ORDER[i], 30, cy, 34, PAPER, 7);
    lv.forEach((s, k) => { g += t(56, cy + 6 + (k - (lv.length - 1) / 2) * 20, s, 'sc', 'font-size="17"'); });
    for (let j = 0; j < 3; j++) {
      const c = i * 3 + j, X = x0 + j * cw, Y = y0 + i * rh, a = 0.1 + i * 0.32;
      g += `<rect x="${X + 3}" y="${Y + 3}" width="${cw - 6}" height="${rh - 6}" fill="rgba(211,18,42,${a})" stroke="${LINE}"/>`;
      g += nota(c, { x: X + 30, y: Y + 20, h: 22, color: PAPER });
      const words = JUNG[c].split(' ');
      const l1 = words.slice(0, Math.ceil(words.length / 2)).join(' '), l2 = words.slice(Math.ceil(words.length / 2)).join(' ');
      g += t(X + cw / 2, Y + 54, l1, 'sc', 'font-size="19" text-anchor="middle"') + t(X + cw / 2, Y + 76, l2, 'sc', 'font-size="19" text-anchor="middle"');
    }
  });
  root.innerHTML = svg(`0 0 ${x0 + 3 * cw + 6} ${y0 + 3 * rh + 6}`, g) +
    `<p class="viz-note">Типа «Ощущение» нет: он слишком близок к «Чувству». Нижний ряд описывает развитие дальше юнговской индивидуации.</p>`;
}

/* ---------------- VII. Tarot ---------------- */
export function tarot(root) {
  const rh = 58, x0 = 0, head = 74;
  // column headers: what each column means
  const hd = (x, s, anchor = 'start') => t(x, 62, s, 'mono', `font-size="12" letter-spacing="2" fill="${RED2}" text-anchor="${anchor}"`);
  let g = hd(x0, 'СФЕРА') + hd(180, 'АЛХИМИЧЕСКИЙ ПРОЦЕСС') + hd(720, 'ДЕРЕВО')
    + t(563, 16, 'АТУ ТАРО ПО ЭЛЕМЕНТАМ', 'mono', `font-size="12" letter-spacing="2" fill="${RED2}" text-anchor="middle"`);
  E.ORDER.forEach((el, i) => {
    const X = 470 + i * 70 + 23;
    g += glyph(el, X, 36, 18, PAPER, 9) + t(X, 62, E.ELEMENTS[el].name, 'mono mute', 'font-size="12" text-anchor="middle"');
  });
  g += `<path d="M0 ${head - 4}H900" stroke="${RED}"/>`;
  for (let b = 1; b <= 7; b++) {
    const B = E.BOARDS[b], y = head + (b - 1) * rh;
    g += `<path d="M0 ${y + rh - 4}H900" stroke="${LINE}"/>`;
    g += t(x0, y + 34, B.planet, 'sc', 'font-size="22"');
    g += t(180, y + 34, B.process, '', 'font-size="21"');
    B.atu.forEach((n, i) => {
      const X = 470 + i * 70;
      g += `<g data-tip="Ату ${n} — ${E.ELEMENTS[E.ORDER[i]].name}"><rect x="${X}" y="${y + 4}" width="46" height="46" fill="${INK}" stroke="${i === 2 ? RED : PAPER}" stroke-width="1.2"/>${t(X + 23, y + 34, n, 'sc', 'font-size="22" text-anchor="middle"')}</g>`;
    });
    g += t(720, y + 34, B.tree, '', 'font-size="20" font-style="italic"');
  }
  root.innerHTML = svg(`0 0 900 ${head + 7 * rh}`, g);
}

/* ---------------- VIII. Aeons ---------------- */
export function aeons(root) {
  const W = 1000, minY = -3800, maxY = 3300, X = (y) => 40 + (y - minY) / (maxY - minY) * (W - 80);
  let g = `<path d="M40 150H${W - 40}" stroke="${PAPER}" stroke-width="1"/>`;
  for (let y = -3000; y <= 3000; y += 1000) g += `<path d="M${X(y)} 144V156" stroke="${MUTE}"/>${t(X(y), 176, y < 0 ? `${-y} до н.э.` : y === 0 ? '0' : `${y}`, 'mono mute', 'font-size="11" text-anchor="middle"')}`;
  const civ = [['Шумерская', -2298], ['Эллинистическая', 378], ['Западная', 2390]];
  civ.forEach(([n, end], i) => {
    const x1 = X(end), x0 = X(end - 1500), y = 70 + (i % 2) * 34;
    g += `<defs><linearGradient id="ag${i}" x1="0" x2="1"><stop offset="0" stop-color="${PAPER}" stop-opacity="0"/><stop offset="1" stop-color="${PAPER}" stop-opacity=".85"/></linearGradient></defs>`;
    g += `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="16" fill="url(#ag${i})"/>${t(x1 - 6, y - 6, n, 'sc', 'font-size="19" text-anchor="end"')}`;
    g += `<path d="M${x1} ${y + 16}V150" stroke="${PAPER}" stroke-dasharray="2 3"/>${t(x1, 196, end < 0 ? `${-end} до н.э.` : end, 'mono', 'font-size="12" text-anchor="middle"')}`;
  });
  // the Western civilisation could last to 3090: dashed continuation in the same row, note under it
  g += `<rect x="${X(2390)}" y="70" width="${X(3090) - X(2390)}" height="16" fill="none" stroke="${RED}" stroke-dasharray="4 4"/>`
    + t(X(2390) + 6, 104, 'до 3090 —', 'mono', `font-size="11" fill="${RED2}"`) + t(X(2390) + 6, 118, 'если kcu поднять выше', 'mono', `font-size="11" fill="${RED2}"`);
  // "now": a short mark on the axis only, so it crosses no bar or label
  g += `<path d="M${X(2026)} 134V160" stroke="${RED}" stroke-width="2"/>${t(X(2026), 128, 'сейчас', 'mono', `font-size="11" text-anchor="middle" fill="${RED2}"`)}`;
  let chips = '';
  for (let b = 1; b <= 7; b++) chips += `<g transform="translate(${40 + (b - 1) * 134},236)"><rect width="126" height="54" fill="${INK}" stroke="${b === 6 ? RED : LINE}"/>${t(63, 22, E.BOARDS[b].name, 'sc', 'font-size="16" text-anchor="middle"')}${t(63, 42, E.BOARDS[b].aeon, 'mono', `font-size="10" text-anchor="middle" ${b === 6 ? `fill="${RED2}"` : 'class="mute"'}`)}</g>`;
  root.innerHTML = svg(`0 0 ${W} 300`, g + chips) +
    `<p class="viz-note">Высшая цивилизация длится примерно 1200–1500 лет. Наступающий «Новый Эон» — Денеб.</p>`;
}

/* ---------------- IX. Advanced board (geometry from the booklet figure) ---------------- */
export function advanced(root) {
  // [x, y, square colour] exactly as on the booklet figure (W white, B black)
  const L = {
    1: [],
    2: [[25, 85, 'W'], [50, 85, 'B'], [75, 85, 'W'], [50, 110, 'W'], [125, 85, 'W'], [150, 85, 'B'], [175, 85, 'W'], [150, 110, 'W'],
      [50, 295, 'B'], [25, 320, 'B'], [50, 320, 'W'], [75, 320, 'B'], [150, 295, 'B'], [125, 320, 'B'], [150, 320, 'W'], [175, 320, 'B']],
    3: [[100, 57, 'W'], [100, 350, 'B']],
    4: [[75, 3, 'W'], [100, 3, 'B'], [125, 3, 'W'], [100, 28, 'W'], [100, 380, 'B'], [75, 405, 'B'], [100, 405, 'W'], [125, 405, 'B']],
  };
  for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) L[1].push([75 + c * 25, 140 + r * 25, (r + c) % 2 ? 'W' : 'B']);
  let g = '';
  const stroke = { 1: LINE, 2: PAPER, 3: RED, 4: MUTE };
  for (const lv of [1, 2, 3, 4]) for (const [x, y, col] of L[lv]) {
    g += `<rect class="lv lv${lv}" x="${x}" y="${y}" width="25" height="25" fill="${col === 'W' ? '#e9e6df' : '#111'}" stroke="${stroke[lv]}" stroke-width="${lv === 1 ? 0.6 : lv === 3 ? 3 : 1.2}" data-tip="Уровень ${lv}${lv === 3 ? ' — нулевая клетка' : ''}"/>`;
  }
  const legend = [
    [1, 'Уровень 1', 'обычная доска 3 × 6'], [2, 'Уровень 2', 'четыре Т-секции по углам'],
    [3, 'Уровень 3 — «нулевой»', 'фишку заменяют случайной из запаса'], [4, 'Уровень 4', 'две Т-секции сверху и снизу'],
  ];
  let lg = '';
  legend.forEach(([lv, a, b], i) => {
    const y = 20 + i * 70;
    lg += `<g class="hot" data-lv="${lv}" transform="translate(270,${y})"><rect width="22" height="22" fill="${lv === 3 ? RED : INK}" stroke="${stroke[lv]}" stroke-width="1.5"/>${t(34, 17, a, 'sc', 'font-size="20"')}${t(34, 40, b, 'mono mute', 'font-size="11"')}</g>`;
  });
  // the ladder: levels of all boards in one line, a step on it = a step between boards in the ordinary game
  let lad = t(270, 316, 'Лестница уровней', 'sc', 'font-size="18"');
  ['С1', 'С2', 'С3', 'С4', 'А1', 'А2', 'А3', 'А4', 'Ан1'].forEach((s, i) => {
    const x = 270 + i * 46;
    lad += `<rect x="${x}" y="330" width="38" height="28" fill="${s.endsWith('3') ? RED : INK}" stroke="${PAPER}"/>${t(x + 19, 349, s, 'mono', 'font-size="12" text-anchor="middle"')}`;
    if (i < 8) lad += t(x + 42, 349, '›', 'mono mute', 'font-size="14" text-anchor="middle"');
  });
  lad += t(270, 380, 'С — Сириус, А — Арктур, Ан — Антарес; цифра — уровень', 'mono mute', 'font-size="11"');
  root.innerHTML = svg('0 0 700 440', `<g transform="translate(10,10)">${g}</g>${lg}${lad}`) +
    `<p class="viz-note">Ходы считаются по уровням: шаг на уровень — как шаг на доску в обычной игре; уровень 4 ведёт на уровень 1 следующей доски. Ртуть со 2 уровня Арктура дойдёт вниз до 4 уровня Сириуса, а с 4 уровня Арктура — до 1 или 2 уровня Антареса. У каждого цвета 45 фишек: ещё по полному набору на уровнях 2 и 4 Сириуса и Арктура (чёрные — на чёрных клетках, белые — на белых). Нулевые клетки в начале пусты.</p>`;
  root.querySelectorAll('[data-lv]').forEach((el) => {
    el.addEventListener('pointerenter', () => root.querySelectorAll('.lv').forEach((r) => (r.style.opacity = r.classList.contains('lv' + el.dataset.lv) ? 1 : 0.15)));
    el.addEventListener('pointerleave', () => root.querySelectorAll('.lv').forEach((r) => (r.style.opacity = 1)));
  });
}
