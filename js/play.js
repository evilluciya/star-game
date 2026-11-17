/* play.js — full-screen 3D board: game modes, magickal working, model + synthesis. */
import * as E from './engine.js?v=202611170128';
import { Tower, drawNota } from './scene.js?v=202611170128';
import { nota, glyph, LABEL } from './viz.js?v=202611170128';

const DEV_LINK = '<p class="dev-link">Канал разработчика: <a class="tg-link" href="https://t.me/livinggad" target="_blank" rel="noopener">@LIVINGGAD</a></p>';
const sign = (el) => `<svg class="rg" viewBox="0 0 40 40">${glyph(el, 20, 20, 30, 'currentColor', 9)}</svg>`;
import { RULES_HTML, RULES_ADV_HTML } from './rules.js?v=202611170128';
import { THEORY_HTML } from './theory.js?v=202611170128';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem('sg3d-' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('sg3d-' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const coarse = matchMedia('(pointer: coarse)').matches;
const COLOR = { white: 'Белые', black: 'Чёрные' };

export const MODES = {
  solo: { icon: '◇', name: 'Соло', desc: 'Только белые фишки: занять свой треугольник за меньшее число ходов.' },
  work: { icon: LABEL, name: 'Работа', desc: 'Магическая работа: намерение, свой узор на Мире и ходы по правилам, пока узор не воплотится.' },
  model: { icon: '◈', name: 'Модель', desc: 'Свободная расстановка фишек по доскам — модель человека или ситуации. Значение каждой фишки и общий синтез.' },
  ai: { icon: '♟', name: 'Против компьютера', desc: 'Обычная партия: кто первым займёт свой треугольник на Мире.' },
  hotseat: { icon: '⚇', name: 'Вдвоём', desc: 'Два человека за одним экраном, ходят по очереди.' },
};

let hooks = {};
const play = {
  tower: null, game: null, sel: null, busy: false, tool: 'place', modelColor: 'white',
  mode: store.get('mode2', 'solo'),  // 'mode2': everyone starts in solo once after the switch of the default
  highlight: store.get('highlight', true),
  set: Object.assign({ pattern: 'classic', miraLimit: true, naosCapture: true, naosLimit: false, color: 'white', advanced: false }, store.get('settings', {})),
  work: Object.assign({ intent: '', color: 'white', pattern: [[1, 1, 1], [1, 3, 0], [2, 2, 2]], opponent: 'none', limit: true }, store.get('work', {})),
};
if (!MODES[play.mode]) play.mode = 'solo';

/* ---------------- helpers ---------------- */
function toast(msg, ms = 2400) {
  const t = $('#toast'); t.innerHTML = msg; t.hidden = false;  // messages are built here, may hold symbol SVGs
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms);
}
function openSheet(title, html, buttons = [{ label: 'Закрыть' }]) {
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = html;
  const box = $('#sheetActions'); box.innerHTML = '';
  for (const b of buttons) {
    const el = document.createElement('button'); el.className = 'btn ' + (b.cls || 'btn-ghost'); el.textContent = b.label;
    el.onclick = () => { if (b.fn && b.fn() === false) return; closeSheet(); };
    box.appendChild(el);
  }
  $('#sheet').hidden = false;
  $('#sheetBody').scrollTop = 0;
}
const closeSheet = () => ($('#sheet').hidden = true);
function segBind(sel, attr, cb) {
  $$(sel + ' button').forEach((b) => b.addEventListener('click', () => {
    $$(sel + ' button').forEach((x) => x.classList.toggle('on', x === b)); cb(b.dataset[attr]);
  }));
}
function phaseButtons(color, current) {
  const fill = color === 'white' ? '#f2efe8' : '#050505', ink = color === 'white' ? '#050505' : '#f2efe8';
  let h = '<div class="phase-grid">';
  for (let c = 0; c < 9; c++) {
    h += `<button data-combo="${c}" class="${c === current ? 'on' : ''}"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="27" fill="${fill}" stroke="#d3122a" stroke-width="2"/>${nota(c, { x: 30, y: 30, h: 26, color: ink })}</svg><span>${E.longName(c)}</span></button>`;
  }
  return h + '</div>';
}

const humanColor = () => (play.mode === 'work' ? play.work.color : play.set.color);
const aiOn = () => play.mode === 'ai' || (play.mode === 'work' && play.work.opponent !== 'none');
const aiColor = () => E.other(humanColor());
const humanTurn = () => !play.game.winner && (!aiOn() || play.game.turn === humanColor());

/* ---------------- open / close ---------------- */
export function initPlay(h) {
  hooks = h;
  $('#playClose').addEventListener('click', closePlay);
  $('#modeBtn').addEventListener('click', modeSheet);
  $('#settingsBtn').addEventListener('click', settingsForMode);
  $('#hlToggle').checked = play.highlight;
  $('#hlToggle').addEventListener('change', (e) => { play.highlight = e.target.checked; store.set('highlight', play.highlight); play.tower.setHighlight(play.highlight); });
  segBind('#layoutSeg', 'layout', (l) => { play.tower.applyLayout(l); play.tower.resetView(); });
  const jump = $('#boardJump');
  // the chosen board stays solid when the others are see-through
  const focusOn = (b) => { play.tower.setFadeFocus(b); $$('#boardJump button').forEach((x) => x.classList.toggle('on', +x.textContent === b)); };
  $('#viewReset').addEventListener('click', () => { play.tower.resetView(); focusOn(null); });
  $('#viewTop').addEventListener('click', () => play.tower.topView());
  $('#gapRange').addEventListener('input', (e) => play.tower.setGap(+e.target.value));
  $('#fadeRange').addEventListener('input', (e) => play.tower.setFade(+e.target.value));
  $('#panBtn').addEventListener('click', (e) => {
    const on = !e.currentTarget.classList.contains('on');
    e.currentTarget.classList.toggle('on', on); play.tower.setPanMode(on);
    toast(on ? 'Один палец двигает вид. Два пальца — приблизить к нужной доске.' : 'Один палец снова вращает', 2600);
  });
  for (let b = 1; b <= 7; b++) {
    const btn = document.createElement('button'); btn.textContent = b; btn.title = E.BOARDS[b].name;
    if (b === E.MIRA) btn.className = 'mira';
    btn.onclick = () => { play.tower.focusBoard(b); focusOn(b); }; jump.appendChild(btn);
  }
  window.__sg = Object.assign(window.__sg || {}, { play, onPick, newGame, openPlay, E, setMode,
    hint: () => hint(), synthSheet: () => synthSheet(), workSheet: () => workSheet(),
    // every sheet, for the visual audit (tests/audit.py)
    sheets: { intro: introSheet, rules: rulesSheet, theory: theorySheet, mode: modeSheet, settings: settingsForMode,
      work: workSheet, journal: journalSheet, save: saveSheet, synth: synthSheet, piece: (p) => pieceSheet(p) } });
}

export function openPlay(mode) {
  $('#play').hidden = false; document.body.style.overflow = 'hidden';
  const first = !play.tower;
  if (first) { play.tower = new Tower($('#playCanvas'), { interactive: true, onPick }); play.tower.setHighlight(play.highlight); }
  if (mode === 'adv') { // from the site: the advanced version, in the current mode (model has no advanced version)
    play.set = Object.assign({}, play.set, { advanced: true }); store.set('settings', play.set);
    setMode(play.mode === 'model' ? 'ai' : play.mode);
  } else if (mode === 'work') workSheet();
  else if (mode && MODES[mode]) setMode(mode);
  else if (first) newGame();
  if (first && !store.get('intro', 0) && mode !== 'work' && mode !== 'model') setTimeout(introSheet, 900);
  hooks.onOpen && hooks.onOpen();
  const tg = hooks.tg;
  if (tg && tg.BackButton) { tg.BackButton.show(); tg.BackButton.onClick(closePlay); }
}
function closePlay() {
  if (!$('#sheet').hidden) { closeSheet(); return; }
  $('#play').hidden = true; document.body.style.overflow = '';
  hooks.onClose && hooks.onClose();
  const tg = hooks.tg;
  if (tg && tg.BackButton) { tg.BackButton.hide(); tg.BackButton.offClick(closePlay); }
}

function setMode(m) { play.mode = m; store.set('mode2', m); play.tool = 'place'; newGame(); }

function modeSheet() {
  let h = '<div class="mode-cards">';
  for (const [k, m] of Object.entries(MODES)) h += `<button class="mode-card ${k === play.mode ? 'on' : ''}" data-m="${k}"><span class="mc-icon">${m.icon}</span><span><b>${m.name}</b><small>${m.desc}</small></span></button>`;
  const adv = !!play.set.advanced;
  const ver = `<div class="opt"><b>Версия игры</b><div class="seg" id="verSeg"><button data-v="0" class="${adv ? '' : 'on'}">Обычная</button><button data-v="1" class="${adv ? 'on' : ''}">Расширенная</button></div>
    <p>Расширенная: у каждой доски 4 уровня, 90 фишек, нулевые клетки со случайной заменой фишки. В «Модели» — только обычная.</p></div>`;
  openSheet('Режим', ver + h + '</div>' + DEV_LINK, [{ label: 'Закрыть' }]);
  segBind('#verSeg', 'v', (v) => {
    const on = v === '1';
    if (on === !!play.set.advanced) return;
    play.set = Object.assign({}, play.set, { advanced: on }); store.set('settings', play.set);
    closeSheet();
    if (play.mode === 'model') { toast('Модель работает только в обычной версии. Расширенная включится в других режимах.', 3600); return; }
    newGame();
    toast(on ? 'Расширенная игра: 4 уровня у каждой доски. Правила — «📖 Правила».' : 'Обычная игра', 3200);
  });
  $$('.mode-card').forEach((b) => b.addEventListener('click', () => {
    closeSheet();
    if (b.dataset.m === 'work') workSheet(); else setMode(b.dataset.m);
  }));
}

/* ---------------- game lifecycle ---------------- */
function makeGame() {
  const s = play.set, m = play.mode;
  if (m === 'model') {
    return new E.Game({ pieces: store.get('model-current', null) || E.standardSetup(), targets: { white: [], black: [] }, miraLimit: false });
  }
  const adv = !!s.advanced, setup = () => (adv ? E.advancedSetup() : E.standardSetup());
  if (m === 'work') {
    const w = play.work, me = w.color, op = E.other(me);
    const targets = { [me]: w.pattern.map((x) => [...x]), [op]: w.opponent === 'none' ? [] : E.makeTargets('classic')[op] };
    const alone = w.opponent === 'none';
    return new E.Game({ pieces: alone ? setup().filter((p) => p.color === me) : undefined, targets,
      miraLimit: w.limit, naosCaptureMira: true, turn: alone ? me : 'white', advanced: adv });
  }
  // solo: exact phases by default — otherwise three Sulphurs finish it in three moves
  const targets = E.makeTargets(m === 'solo' ? (s.soloPattern || 'strict') : s.pattern);
  if (m === 'solo') targets.black = [];
  return new E.Game({ pieces: m === 'solo' ? setup().filter((p) => p.color === 'white') : undefined, targets, miraLimit: s.miraLimit,
    naosCaptureMira: s.naosCapture, naosLimit: s.naosLimit, advanced: adv });
}

export function newGame() {
  play.game = makeGame(); play.sel = null; play.busy = false;
  const tw = play.tower;
  for (const m of tw.pieceMeshes.values()) m.parent && m.parent.remove(m);
  tw.pieceMeshes.clear();
  if (!!tw.advanced !== play.game.advanced) {
    // the advanced boards are taller: spread them further apart so the levels do not touch the board above
    const gap = play.game.advanced ? 2.8 : 1.9;
    tw.gap = gap; $('#gapRange').value = gap;
    tw.setAdvanced(play.game.advanced); tw.resetView(0);
  }
  tw.sync(play.game, { sel: null, targets: [], last: [], dropIn: true });
  $('#modeBtn').innerHTML = `${MODES[play.mode].icon} ${MODES[play.mode].name}${play.game.advanced ? ' · расш.' : ''} ▾`;
  status();
  if (aiOn() && play.game.turn === aiColor()) { play.busy = true; setTimeout(aiTurn, 1200); }
}

const lastEntries = () => play.game.log.slice(-(aiOn() ? 2 : 1));
function view(extra = {}) {
  const g = play.game, p = play.sel != null ? g.get(play.sel) : null;
  if (!p) play.hint = null;
  play.tower.sync(g, Object.assign({ sel: play.sel, targets: p ? g.legalMoves(p) : [], last: lastEntries(), hint: play.hint }, extra));
  status();
  // a null square was hit: say what came out of the Abyss
  const e = g.log[g.log.length - 1];
  if (e && e.nul && !e.told) {
    e.told = true;
    toast(`Нулевая клетка: ${nota(e.nul.gone)} ушла в Бездну, выпала ${e.nul.color === 'white' ? 'белая' : 'чёрная'} ${nota(e.nul.combo)}`, 4200);
  }
}

/** hint: the engine picks a good move for the player; the piece is lifted, the square gets a white ring */
function hint() {
  const g = play.game;
  if (play.busy || g.winner || !humanTurn()) return toast('Сейчас не ваш ход');
  const ch = E.pickMove(g, g.turn);
  if (!ch) return toast('Ходов нет');
  play.sel = ch.id; play.hint = ch.move;
  view();
  play.tower.focusBoard(ch.move.b);
  const p = g.get(ch.id);
  toast(`💡 Фишка ${nota(p.combo)} поднята. Нажмите белое кольцо на доске ${E.BOARDS[ch.move.b].name}`, 4200);
}

export function introSheet() {
  store.set('intro', 1);
  openSheet('Как играть', `<ol class="steps intro">
    <li><b>Это 7 досок</b> одна над другой. Пальцем — вращать, двумя пальцами — приблизить.</li>
    <li><b>Цель</b> — первым поставить 3 свои фишки на клетки в красных рамках на <b>Мире</b> (доска с красным краем). Белым — верх Миры, чёрным — низ.</li>
    <li><b>Ход</b>: нажмите свою фишку → красные точки покажут, куда можно → нажмите точку.</li>
    <li>На фишке первый знак — как она ходит: ${sign('a')} Соль — на соседнюю клетку или доску, ${sign('l')} Ртуть — до двух досок, ${sign('w')} Сера — куда угодно. Знак в скобках — внутренний элемент. После хода фишка меняется.</li>
    <li><b>Не знаете, что делать?</b> Жмите «💡 Подсказка» — фишка поднимется, а белое кольцо покажет, куда её поставить.</li></ol>${DEV_LINK}`,
  [{ label: 'Все правила', fn: () => { setTimeout(rulesSheet, 0); } }, { label: 'Понятно', cls: 'btn-red' }]);
}

export function rulesSheet(which) {
  // which: 'adv' / 'basic'; anything else (a click event) — the rules of the version being played
  const adv = typeof which === 'string' ? which === 'adv' : !!(play.game && play.game.advanced);
  openSheet(adv ? 'Расширенная игра' : 'Правила целиком', adv ? RULES_ADV_HTML : RULES_HTML, [
    { label: adv ? 'Обычные правила' : 'Расширенная игра', fn: () => { setTimeout(() => rulesSheet(adv ? 'basic' : 'adv'), 0); } },
    { label: 'Теория', fn: () => { setTimeout(theorySheet, 0); } }, { label: 'Закрыть', cls: 'btn-red' }]);
}

export function theorySheet() {
  openSheet('Теория и символизм', THEORY_HTML, [{ label: 'Правила', fn: () => { setTimeout(rulesSheet, 0); } }, { label: 'Закрыть', cls: 'btn-red' }]);
}

/* ---------------- picking ---------------- */
export function onPick(hit) {
  const g = play.game;
  if (play.busy || !g) return;
  if (play.mode === 'model') return modelPick(hit);
  if (g.winner || g.isDraw()) { toast('Партия окончена — «Заново» внизу'); return; }
  if (!humanTurn()) { toast('Сейчас ходит соперник'); return; }
  if (!hit) { if (play.sel != null) { play.sel = null; view(); } return; }
  const sel = play.sel != null ? g.get(play.sel) : null;
  if (sel) {
    const mv = g.legalMoves(sel).find((m) => m.b === hit.b && m.r === hit.r && m.c === hit.c);
    if (mv) { doMove(sel.id, mv); return; }
  }
  play.hint = null;
  const p = hit.piece;
  if (p && p.color === g.turn) {
    if (sel && p.id === sel.id) { play.sel = null; view(); return; }
    const moves = g.legalMoves(p);
    if (!moves.length) { toast(g.forced(g.turn).length ? 'Сначала сдвиньте фишку, у которой вышел срок на Мире' : 'У этой фишки нет ходов'); return; }
    play.sel = p.id; view();
    if (!play.highlight) toast(`${nota(p.combo)}: ходов ${moves.length}. Подсветка выключена`, 2200);
  } else if (sel) {
    toast(play.highlight ? 'Сюда нельзя: красные точки — допустимые клетки' : 'Сюда нельзя по правилам'); play.sel = null; view();
  } else toast(p ? 'Это фишка соперника' : 'Сначала нажмите свою фишку');
}

function modelPick(hit) {
  const g = play.game;
  if (!hit) { if (play.sel != null) { play.sel = null; view(); } return; }
  if (play.tool === 'place') { if (hit.piece) pieceSheet(hit.piece); else placeSheet(hit.b, hit.r, hit.c); return; }
  const sel = play.sel != null ? g.get(play.sel) : null;
  if (sel) {
    const mv = g.legalMoves(sel).find((m) => m.b === hit.b && m.r === hit.r && m.c === hit.c);
    if (mv) { doMove(sel.id, mv); return; }
  }
  if (hit.piece) {
    if (sel && hit.piece.id === sel.id) { play.sel = null; view(); return; }
    if (!g.legalMoves(hit.piece).length) { toast('У этой фишки нет ходов'); return; }
    play.sel = hit.piece.id; view();
  } else if (sel) { play.sel = null; view(); toast('Сюда нельзя по правилам'); }
}

function doMove(id, mv) {
  const g = play.game;
  if (play.mode === 'model') {
    if (!g.freeMove(id, mv)) return;
    play.sel = null; saveModel(); view({ animate: true });
    const p = g.get(id); if (p) toast(`${nota(p.combo)} на ${E.BOARDS[p.board].name}: ${E.JUNG[p.combo]}`);
    return;
  }
  if (!g.apply(id, mv)) return;
  play.sel = null;
  view({ animate: true });
  if (g.winner) return setTimeout(showEnd, 800);
  if (aiOn() && g.turn === aiColor()) { play.busy = true; setTimeout(aiTurn, 900); }
}

function aiTurn() {
  const g = play.game;
  play.busy = false;
  if (g.winner || !aiOn() || g.turn !== aiColor()) return;
  const ch = E.pickMove(g, aiColor(), Math.random, { blind: play.mode === 'work' && play.work.opponent === 'blind' });
  if (!ch) return status();
  g.apply(ch.id, ch.move);
  view({ animate: true });
  if (g.winner) return setTimeout(showEnd, 800);
  if (g.turn === aiColor()) { play.busy = true; setTimeout(aiTurn, 900); }
}

function undo() {
  const g = play.game;
  if (play.busy || !g.history.length) return toast('Отменять нечего');
  g.undo();
  if (aiOn()) while (g.turn === aiColor() && g.history.length) g.undo();
  play.sel = null;
  if (play.mode === 'model') saveModel();
  view({ animate: true });
  if (aiOn() && g.turn === aiColor()) { play.busy = true; setTimeout(aiTurn, 900); }
}

/* ---------------- status panel ---------------- */
function fmt(e) {
  if (e.skip) return `${COLOR[e.color]}: нет ходов — пропуск`;
  const cell = (s) => `${E.BOARDS[s.b].name} ${E.cellName(s.r, s.c)}`;
  const nul = e.nul ? ` · Бездна: выпала ${e.nul.color === 'white' ? 'белая' : 'чёрная'} ${nota(e.nul.combo)}` : '';
  return e.capture ? `${COLOR[e.color]}: ${cell(e.from)} ⚔ ${e.captured ? nota(e.captured.combo) : ''} на ${E.BOARDS[e.to.b].name} → ${nota(e.combo)}`
    : `${COLOR[e.color]}: ${cell(e.from)} → ${cell(e.to)} · ${nota(e.combo)}${nul}`;
}

function status() {
  const g = play.game, el = $('#playStatus'), m = play.mode;
  let html = '', actions = '';
  const p = play.sel != null ? g.get(play.sel) : null;
  if (m === 'model') {
    html += `<div class="st-turn"><span>Модель</span><span class="st-prog">фишек: ${g.pieces.length}</span></div>`;
    html += `<div class="seg seg-sm st-tool" id="toolSeg"><button data-t="place" class="${play.tool === 'place' ? 'on' : ''}">✚ Расстановка</button><button data-t="move" class="${play.tool === 'move' ? 'on' : ''}">➜ Движение</button></div>`;
    html += `<div class="st-prog" style="margin-top:6px">${play.tool === 'place' ? 'Нажмите пустую клетку — поставить фишку; фишку — узнать её значение, сменить фазу или убрать.' : 'Двигайте любые фишки по их правилам — после хода фишка переходит в следующую фазу.'}</div>`;
    actions = `<button class="chip" id="stSynth">◈ Синтез</button><button class="chip" id="stSave">Сохранить</button><button class="chip" id="stOpenM">Открыть</button><button class="chip" id="stClear">Пустые доски</button><button class="chip" id="stStd">Начальная расстановка</button><button class="chip" id="stUndo">↩</button>`;
  } else {
    const solo = m === 'solo' || (m === 'work' && play.work.opponent === 'none');
    const who = aiOn() ? (g.turn === humanColor() ? ' — вы' : ' — соперник') : '';
    let head;
    if (g.isDraw()) head = 'Ничья: ходов нет ни у кого';
    else if (g.winner) head = m === 'work' ? (g.winner === humanColor() ? 'Узор воплощён' : 'Соперник опередил') : solo ? 'Узор собран' : 'Победа: ' + COLOR[g.winner];
    else head = solo ? `${MODES[m].name} · ход ${g.log.length + 1}` : 'Ход: ' + COLOR[g.turn] + who;
    const me = humanColor(), op = E.other(me);
    let prog = `${m === 'work' ? 'узор' : 'цель'} ${g.progress(m === 'hotseat' ? 'white' : me)}/${g.targets[m === 'hotseat' ? 'white' : me].length}`;
    if (!solo && g.targets[op].length) prog += ` · ${m === 'hotseat' ? 'чёрные' : 'соперник'} ${g.progress(m === 'hotseat' ? 'black' : op)}/${g.targets[m === 'hotseat' ? 'black' : op].length}`;
    html += `<div class="st-turn"><span>${head}</span><span class="st-prog">${prog}</span></div>`;
    if (m === 'work' && play.work.intent) html += `<div class="st-intent">${LABEL} ${esc(play.work.intent.slice(0, 140))}</div>`;
    const forced = !g.winner && humanTurn() ? g.forced(g.turn) : [];
    if (forced.length) html += `<div class="st-warn">Срок вышел: сначала сдвиньте ${forced.map((q) => `${nota(q.combo)} (${E.BOARDS[q.board].name} ${E.cellName(q.row, q.col)})`).join(', ')}</div>`;
    if (!p && !g.winner && humanTurn()) html += `<div class="st-prog" style="margin-top:6px">Нажмите свою фишку, затем клетку. Сцену можно вращать и приближать.</div>`;
    if (g.log.length) html += `<div class="st-log">${g.log.slice(-2).reverse().map(fmt).join('<br>')}</div>`;
    actions = `${!g.winner && humanTurn() ? '<button class="chip chip-red" id="stHint">💡 Подсказка</button>' : ''}<button class="chip" id="stUndo">↩ Отменить</button><button class="chip" id="stNew">Заново</button>${m === 'work' ? '<button class="chip" id="stJournal">Журнал</button>' : ''}<button class="chip" id="stHelp">?</button>`;
  }
  if (p) html += `<div class="st-sel"><canvas id="selGlyph" width="92" height="92"></canvas><div><b>${E.longName(p.combo)}</b><br><span class="st-prog">${E.BOARDS[p.board].name} ${E.cellName(p.row, p.col)} · ходов: ${g.legalMoves(p).length}</span></div></div>`;
  html += `<div class="st-actions">${actions}<button class="chip" id="stRules">📖 Правила</button><button class="chip" id="stTheory">📜 Теория</button>${coarse ? '<button class="chip" id="stTools">Вид</button>' : ''}</div>`;
  el.innerHTML = html;
  // fold: the panel can shrink to its first line so it does not cover the boards
  const folded = !!store.get('stFolded', 0);
  el.classList.toggle('folded', folded);
  const fold = document.createElement('button');
  fold.className = 'st-fold'; fold.id = 'stFold'; fold.textContent = folded ? '▴' : '▾';
  fold.title = fold.ariaLabel = folded ? 'Развернуть' : 'Свернуть';
  fold.onclick = () => { store.set('stFolded', folded ? 0 : 1); status(); };
  el.prepend(fold);
  if (p && !folded) { const cv = $('#selGlyph'), c = cv.getContext('2d'); c.fillStyle = p.color === 'white' ? '#f4f1ea' : '#0e0e0e'; c.beginPath(); c.arc(46, 46, 44, 0, 7); c.fill(); c.strokeStyle = '#d3122a'; c.lineWidth = 3; c.stroke(); drawNota(c, p.combo, 46, 46, 92, p.color === 'white' ? '#0e0e0e' : '#f4f1ea'); }
  const on = (id, fn) => { const b = $('#' + id); if (b) b.onclick = fn; };
  on('stUndo', undo); on('stNew', newGame); on('stJournal', journalSheet); on('stHint', hint); on('stHelp', introSheet);
  on('stRules', rulesSheet); on('stTheory', theorySheet);
  on('stTools', () => $('.play-tools').classList.toggle('open'));
  on('stSynth', synthSheet); on('stSave', saveSheet); on('stOpenM', saveSheet);
  on('stClear', () => { play.game = new E.Game({ pieces: [], targets: { white: [], black: [] }, miraLimit: false }); saveModel(); newModelView(); });
  on('stStd', () => { play.game = new E.Game({ targets: { white: [], black: [] }, miraLimit: false }); saveModel(); newModelView(); });
  $$('#toolSeg button').forEach((b) => b.addEventListener('click', () => { play.tool = b.dataset.t; play.sel = null; view(); }));
}

function showEnd() {
  const g = play.game, m = play.mode;
  if (m === 'work') {
    const ok = g.winner === humanColor();
    addJournal(ok ? 'done' : 'fail');
    openSheet(ok ? 'Узор воплощён' : 'Соперник опередил',
      ok ? `<div class="winbox"><p class="st-intent">${LABEL} ${esc(play.work.intent)}</p><h3>Да свершится по воле моей</h3><p class="mute">Ходов: ${g.log.filter((e) => e.color === humanColor() && !e.skip).length}</p></div>`
        : `<div class="winbox"><p>Соперник первым занял свою цель. Работа записана в журнал как незавершённая.</p></div>`,
      [{ label: 'Журнал', fn: () => { setTimeout(journalSheet, 0); } }, { label: 'Новая работа', cls: 'btn-red', fn: () => { setTimeout(workSheet, 0); } }]);
    return;
  }
  const solo = m === 'solo', mine = m === 'ai' ? g.winner === play.set.color : true;
  openSheet(solo ? 'Узор собран' : mine ? 'Победа' : 'Поражение',
    `<div class="winbox"><p>${solo ? `Ходов: ${g.log.length}` : `${COLOR[g.winner]} первыми заняли свой треугольник на Мире.`}</p></div>`,
    [{ label: 'Закрыть' }, { label: 'Новая партия', cls: 'btn-red', fn: newGame }]);
}

/* ---------------- settings for the game modes ---------------- */
function settingsForMode() {
  if (play.mode === 'work') return workSheet();
  if (play.mode === 'model') return synthSheet();
  const s = play.set, ai = play.mode === 'ai', draft = { ...s };
  const solo = play.mode === 'solo', patKey = solo ? 'soloPattern' : 'pattern', patNow = solo ? (s.soloPattern || 'strict') : s.pattern;
  const opt = (id, title, desc, checked, hidden = false) => `<div class="opt" ${hidden ? 'hidden' : ''}><label class="toggle bare"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span></span><b>${title}</b></label><p>${desc}</p></div>`;
  openSheet('Настройки партии', `
    <div class="opt"><b>Цель</b><p>Белым — верхний треугольник Миры, чёрным — нижний. «Только цвет» — подойдёт любая своя фишка (быстро). «Точные фишки» — на клетках должны стоять ${nota(1)}, ${nota(0)}, ${nota(2)}: путь фишки надо рассчитать через превращения, минимум 6 ходов.</p>
      <div class="seg" id="patSeg"><button data-p="classic" class="${patNow === 'classic' ? 'on' : ''}">Только цвет</button><button data-p="strict" class="${patNow === 'strict' ? 'on' : ''}">Точные фишки</button></div></div>
    ${ai ? `<div class="opt"><b>Мой цвет</b><p>Белые ходят первыми.</p><div class="seg" id="colSeg"><button data-c="white" class="${s.color === 'white' ? 'on' : ''}">Белые</button><button data-c="black" class="${s.color === 'black' ? 'on' : ''}">Чёрные</button></div></div>` : ''}
    ${opt('optLimit', 'Три хода на Мире', 'Обычное правило: фишка стоит на Мире не больше трёх ходов (приход — первый), потом обязана сдвинуться по Мире или уйти.', s.miraLimit)}
    ${opt('optNaosLimit', `${nota(8)} на Наосе — три хода`, `Вариант при выключенном лимите Миры: ${nota(8)} на Наосе через три хода обязана сходить (станет ${nota(0)}).`, s.naosLimit, s.miraLimit)}
    ${opt('optCapture', 'Захват на Мире', `Обычное правило: ${nota(8)} с Наоса бьёт и фишки на Мире. Выключить — лёгкий вариант.`, s.naosCapture, play.mode === 'solo')}`,
  [{ label: 'Отмена' }, { label: 'Новая партия', cls: 'btn-red', fn: () => { play.set = draft; store.set('settings', draft); newGame(); } }]);
  segBind('#patSeg', 'p', (v) => (draft[patKey] = v));
  segBind('#colSeg', 'c', (v) => (draft.color = v));
  $('#optLimit').onchange = (e) => { draft.miraLimit = e.target.checked; $('#optNaosLimit').closest('.opt').hidden = draft.miraLimit; };
  $('#optNaosLimit').onchange = (e) => (draft.naosLimit = e.target.checked);
  $('#optCapture').onchange = (e) => (draft.naosCapture = e.target.checked);
}

/* ---------------- magickal working ---------------- */
function workSheet() {
  const d = JSON.parse(JSON.stringify(play.work));
  openSheet('Работа', `
    <div class="opt"><b>Намерение</b><p>Сформулируйте и запишите, чего хотите. Свяжите это с узором на Мире: как фишки идут к узору — так исполняется желание.</p>
      <textarea id="wIntent" rows="3" maxlength="400" placeholder="Моя воля — … Как мои фишки идут к цели, так исполнится моё желание.">${esc(d.intent)}</textarea></div>
    <div class="opt"><b>Цвет фишек</b><div class="seg" id="wColor"><button data-c="white" class="${d.color === 'white' ? 'on' : ''}">Белые</button><button data-c="black" class="${d.color === 'black' ? 'on' : ''}">Чёрные</button></div><p id="wColorHint"></p></div>
    <div class="opt"><b>Узор на Мире</b><p>Нажимайте клетки: цель → конкретная фаза → снять. Какой узор — не важно, важно связать его с намерением.</p><div class="pgrid" id="wGrid"></div><p class="st-warn" id="wWarn"></p></div>
    <div class="opt"><b>Соперник</b><div class="seg seg-wrap" id="wOpp"><button data-o="none" class="${d.opponent === 'none' ? 'on' : ''}">Один</button><button data-o="blind" class="${d.opponent === 'blind' ? 'on' : ''}">Не знает узор</button><button data-o="aware" class="${d.opponent === 'aware' ? 'on' : ''}">Знает и мешает</button></div>
      <p>С соперником работа труднее, но сильнее. Её ведут до конца без перерыва. У соперника своя цель — его треугольник на Мире.</p></div>
    <div class="opt"><label class="toggle bare"><input type="checkbox" id="wLimit" ${d.limit ? 'checked' : ''}><span></span><b>Три хода на Мире</b></label><p>Обычное правило. С ним на Мире одновременно стоят не больше трёх ваших фишек.</p></div>
    <p class="st-warn" id="wErr"></p>`,
  [{ label: 'Журнал', fn: () => { setTimeout(journalSheet, 0); } }, { label: 'Отмена' },
    { label: 'Начать работу', cls: 'btn-red', fn: () => {
      d.intent = $('#wIntent').value.trim();
      // say what is missing right in the sheet and scroll to that field
      const need = (msg, sel) => { $('#wErr').textContent = msg; toast(msg); const f = $(sel); if (f) { f.scrollIntoView({ block: 'center', behavior: 'smooth' }); f.classList.add('need'); setTimeout(() => f.classList.remove('need'), 1600); } return false; };
      if (!d.intent) return need('Сначала запишите намерение — поле вверху.', '#wIntent');
      if (!d.pattern.length) return need('Отметьте на Мире хотя бы одну клетку узора — нажмите клетку в сетке.', '#wGrid');
      if (d.limit && d.pattern.length > 3) return need('С лимитом Миры узор не больше 3 клеток — уберите лишние или выключите лимит.', '#wGrid');
      play.work = d; store.set('work', d); play.mode = 'work'; store.set('mode2', 'work'); newGame();
      toast(d.color === 'white' ? 'Созидательная работа начата' : 'Разрушительная работа начата');
    } }]);
  const hint = () => ($('#wColorHint').textContent = d.color === 'white' ? 'Белые — созидательная работа. Время — сумерки.' : 'Чёрные — разрушительная работа. Время — рассвет.');
  const grid = () => {
    let h = '';
    for (let r = 1; r <= 6; r++) for (let c = 1; c <= 3; c++) {
      const t = d.pattern.find((x) => x[0] === r && x[1] === c);
      h += `<button data-r="${r}" data-c="${c}" class="${E.squareColor(r, c)} ${t ? 'on' : ''}">${t ? (t[2] === null ? '●' : nota(t[2])) : ''}</button>`;
    }
    $('#wGrid').innerHTML = h;
    $$('#wGrid button').forEach((b) => b.onclick = () => {
      const r = +b.dataset.r, c = +b.dataset.c, i = d.pattern.findIndex((x) => x[0] === r && x[1] === c);
      if (i < 0) d.pattern.push([r, c, null]);
      else if (d.pattern[i][2] === null) d.pattern[i][2] = 0;
      else if (d.pattern[i][2] < 8) d.pattern[i][2]++;
      else d.pattern.splice(i, 1);
      grid();
    });
    $('#wWarn').textContent = d.limit && d.pattern.length > 3 ? 'С лимитом Миры больше трёх своих фишек на Мире не удержать: оставьте до 3 клеток или выключите лимит ниже.' : '';
  };
  hint(); grid();
  segBind('#wColor', 'c', (v) => { d.color = v; hint(); });
  segBind('#wOpp', 'o', (v) => (d.opponent = v));
  $('#wLimit').onchange = (e) => { d.limit = e.target.checked; grid(); };
}

function addJournal(result) {
  const j = store.get('journal', []), g = play.game, w = play.work;
  j.unshift({ t: Date.now(), intent: w.intent, color: w.color, cells: w.pattern.length, opponent: w.opponent, result,
    moves: g.log.filter((e) => e.color === w.color && !e.skip).length });
  store.set('journal', j.slice(0, 100));
}
function journalSheet() {
  const j = store.get('journal', []);
  const opp = { none: 'один', blind: 'соперник не знал узор', aware: 'соперник мешал' };
  const rows = j.length ? j.map((e) => `<div class="jrow"><div class="jhead"><span>${new Date(e.t).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</span><span class="${e.result === 'done' ? 'ok' : 'fail'}">${e.result === 'done' ? LABEL + ' воплощено' : '✕ не завершено'}</span></div>
      <p>${esc(e.intent)}</p><small>${e.color === 'white' ? 'белые' : 'чёрные'} · узор ${e.cells} кл. · ${opp[e.opponent] || ''} · ходов ${e.moves}</small></div>`).join('')
    : '<p class="mute">Записей пока нет. Работа попадает сюда, когда узор воплощён или соперник опередил.</p>';
  openSheet('Журнал работ', rows, [{ label: 'Очистить', fn: () => { if (j.length && confirm('Удалить все записи журнала?')) store.set('journal', []); } }, { label: 'Закрыть', cls: 'btn-red' }]);
}

/* ---------------- model ---------------- */
function saveModel() { if (play.mode === 'model') store.set('model-current', play.game.pieces); }
function newModelView() {
  play.sel = null;
  const tw = play.tower;
  for (const m of tw.pieceMeshes.values()) m.parent && m.parent.remove(m);
  tw.pieceMeshes.clear();
  tw.sync(play.game, { sel: null, targets: [], last: [], dropIn: true });
  status();
}
function meaningHtml(p) {
  const m = E.meaning(p);
  return `<table class="mtable">
    <tr><th>Фишка</th><td>${nota(p.combo)} ${m.piece}</td></tr><tr><th>Место</th><td>${m.sphere} · клетка ${E.cellName(p.row, p.col)}</td></tr>
    <tr><th>Тип</th><td>${m.type}</td></tr><tr><th>Функция</th><td>${m.func} · уровень: ${m.level}</td></tr>
    <tr><th>Ату</th><td>${m.atu}</td></tr><tr><th>Процесс</th><td>${m.process}</td></tr><tr><th>Дерево</th><td>${m.tree}</td></tr><tr><th>Эон</th><td>${m.aeon}</td></tr></table>`;
}
function placeSheet(b, r, c) {
  let color = play.modelColor;
  openSheet(`Поставить фишку · ${E.BOARDS[b].name} ${E.cellName(r, c)}`, `
    <div class="seg" id="pmColor"><button data-c="white" class="${color === 'white' ? 'on' : ''}">Светлая</button><button data-c="black" class="${color === 'black' ? 'on' : ''}">Тёмная</button></div>
    <div id="pmPhases"></div>`, [{ label: 'Отмена' }]);
  const draw = () => {
    $('#pmPhases').innerHTML = phaseButtons(color, -1);
    $$('#pmPhases [data-combo]').forEach((btn) => btn.onclick = () => {
      const p = play.game.addPiece(color, +btn.dataset.combo, b, r, c);
      closeSheet(); saveModel(); view({ dropIn: false });
      if (p) toast(`${nota(p.combo)} на ${E.BOARDS[b].name}: ${E.JUNG[p.combo]}`);
    });
  };
  segBind('#pmColor', 'c', (v) => { color = v; play.modelColor = v; draw(); });
  draw();
}
function pieceSheet(p) {
  openSheet('Фишка', meaningHtml(p) + '<p class="mute" style="margin:12px 0 4px">Сменить фазу:</p>' + phaseButtons(p.color, p.combo),
    [{ label: 'Убрать', fn: () => { play.game.removePiece(p.id); saveModel(); view(); } },
      { label: 'Сменить цвет', fn: () => { recolor(p); } }, { label: 'Закрыть', cls: 'btn-red' }]);
  $$('#sheetBody [data-combo]').forEach((btn) => btn.onclick = () => {
    play.game.editPiece(p.id, { combo: +btn.dataset.combo }); closeSheet(); saveModel(); view();
  });
}
function recolor(p) {
  const g = play.game, { board, row, col, combo } = p, color = E.other(p.color);
  g.removePiece(p.id); g.addPiece(color, combo, board, row, col); saveModel(); view();
}
function bars(title, rows) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return `<div class="synth"><h4>${title}</h4>${rows.map(([l, v]) => `<div class="bar"><span>${l}</span><i style="--w:${(v / max) * 100}%"></i><b>${v}</b></div>`).join('')}</div>`;
}
function synthSheet() {
  const s = E.synthesis(play.game.pieces);
  if (!s.total) return openSheet('Синтез', '<p class="mute">На досках нет фишек. Включите «Расстановку» и поставьте фишки.</p>');
  const top = (obj, names) => { const k = Object.keys(obj).reduce((a, b) => (obj[b] > obj[a] ? b : a)); return names[k]; };
  const maxBoard = s.boards.indexOf(Math.max(...s.boards.slice(1)));
  const types = s.types.map((n, c) => [c, n]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const html = `<p class="synth-sum">Фишек: <b>${s.total}</b>. Больше всего — <b>${top(s.outer, { a: 'Соли', l: 'Ртути', w: 'Серы' })}</b> снаружи
      (уровень: ${top(s.outer, E.LEVELS)}), внутри — <b>${top(s.inner, E.FUNCS).toLowerCase()}</b>; плотнее всего занята доска <b>${E.BOARDS[maxBoard].name}</b> (сфера ${E.BOARDS[maxBoard].sphereOf}).</p>
    ${bars('Внешний элемент — как действует · уровень', [['Соль · эго', s.outer.a], ['Ртуть · самость', s.outer.l], ['Сера · за пределами', s.outer.w]])}
    ${bars('Внутренний элемент — функция', [['Чувство', s.inner.a], ['Интуиция', s.inner.l], ['Мышление', s.inner.w]])}
    ${bars('Свет и тьма', [['светлые (каузальное)', s.light], ['тёмные (акаузальное)', s.dark]])}
    ${bars('Доски-звёзды · их сферы', [7, 6, 5, 4, 3, 2, 1].map((b) => [`${E.BOARDS[b].name} · ${E.BOARDS[b].planet}`, s.boards[b]]))}
    <div class="synth"><h4>Чаще всего</h4>${types.map(([c, n]) => `<p>${nota(c)} ${E.JUNG[c]} · ${n}</p>`).join('')}</div>`;
  openSheet('Синтез', html, [{ label: 'Закрыть', cls: 'btn-red' }]);
}
function saveSheet() {
  const all = store.get('models', {});
  const list = Object.keys(all).length ? Object.entries(all).map(([n, v]) => `<div class="jrow"><div class="jhead"><span>${esc(n)}</span><span class="mute">${v.length} фишек</span></div>
      <div class="row-btns"><button class="chip" data-open="${esc(n)}">Открыть</button><button class="chip" data-del="${esc(n)}">Удалить</button></div></div>`).join('')
    : '<p class="mute">Сохранённых моделей пока нет.</p>';
  openSheet('Модели', `<div class="opt"><b>Сохранить текущую</b><div class="save-row"><input id="mName" maxlength="60" placeholder="Название, например имя"><button class="btn btn-red btn-sm" id="mSave">Сохранить</button></div></div>${list}`, [{ label: 'Закрыть' }]);
  $('#mSave').onclick = () => {
    const n = $('#mName').value.trim(); if (!n) return toast('Введите название');
    all[n] = play.game.pieces; store.set('models', all); closeSheet(); toast('Модель сохранена');
  };
  $$('[data-open]').forEach((b) => b.onclick = () => { play.game = new E.Game({ pieces: all[b.dataset.open], targets: { white: [], black: [] }, miraLimit: false }); saveModel(); closeSheet(); newModelView(); });
  $$('[data-del]').forEach((b) => b.onclick = () => { if (confirm('Удалить модель «' + b.dataset.del + '»?')) { delete all[b.dataset.del]; store.set('models', all); closeSheet(); saveSheet(); } });
}
