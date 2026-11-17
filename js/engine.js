/* engine.js — Star Game rules (ES module).
 *
 * Checked against the source: The Sinister Tradition pp. 239–245 (text from NAOS) and the
 * figures of the Star Game booklet (fig. 2 Sirius start, fig. 3 Arcturus start, fig. 4 goal).
 * Same rules as telegram_bot/star_engine.py (v1 bot), which is covered by tests.
 *
 * Piece: {id, color:'white'|'black', combo:0..8, board:1..7, row:1..6, col:1..3, stay}
 * Move:  {type:'move'|'capture', b, r, c, target?}
 * Targets: {white:[[r,c,combo|null],...], black:[...]}  (null = any phase)
 */

export const ROWS = 6, COLS = 3, MIRA = 4, NAOS = 7;

export const BOARDS = [null,
  { id: 1, name: 'Сириус', latin: 'Sirius', planet: 'Луна', aeon: 'Первичный', process: 'Прокаливание', tree: 'Орешник', atu: [18, 15, 13] },
  { id: 2, name: 'Арктур', latin: 'Arcturus', planet: 'Меркурий', aeon: 'Гиперборейский', process: 'Разделение', tree: 'Тис', atu: [0, 8, 16] },
  { id: 3, name: 'Антарес', latin: 'Antares', planet: 'Венера', aeon: 'Шумерский', process: 'Слияние', tree: 'Чёрный тополь', atu: [6, 14, 17] },
  { id: 4, name: 'Мира', latin: 'Mira', planet: 'Солнце', aeon: 'Эллинистический', process: 'Разложение', tree: 'Дуб', atu: [7, 12, 5] },
  { id: 5, name: 'Ригель', latin: 'Rigel', planet: 'Марс', aeon: 'Западный', process: 'Возгонка', tree: 'Ольха', atu: [1, 4, 9] },
  { id: 6, name: 'Денеб', latin: 'Deneb', planet: 'Юпитер', aeon: 'Новый Эон', process: 'Брожение', tree: 'Бук', atu: [11, 3, 2] },
  { id: 7, name: 'Наос', latin: 'Naos', planet: 'Сатурн', aeon: 'за пределами', process: 'Сгущение', tree: 'Ясень', atu: [10, 19, 20] },
];

// genitive of the sphere for phrases like «сфера Луны»
const SPHERE_OF = [null, 'Луны', 'Меркурия', 'Венеры', 'Солнца', 'Марса', 'Юпитера', 'Сатурна'];
for (let b = 1; b <= 7; b++) BOARDS[b].sphereOf = SPHERE_OF[b];

export const ORDER = ['a', 'l', 'w'];
export const ELEMENTS = {
  a: { name: 'Соль', mt: 'salt', role: 'устойчивость, тело' },
  l: { name: 'Ртуть', mt: 'mercury', role: 'подвижность, посредник' },
  w: { name: 'Сера', mt: 'sulphur', role: 'огонь, свобода, преобразование' },
};
// 0 a(a) 1 a(l) 2 a(w) 3 l(a) 4 l(l) 5 l(w) 6 w(a) 7 w(l) 8 w(w)
export const COMBOS = [];
for (const o of ORDER) for (const i of ORDER) COMBOS.push([o, i]);

export const outerOf = (c) => COMBOS[c][0];
export const innerOf = (c) => COMBOS[c][1];
export const nextCombo = (c) => (c + 1) % 9;
export const movementType = (c) => ELEMENTS[outerOf(c)].mt;
// plain-text fallback only; the UI draws symbols with viz.nota / scene.drawNota
export const SYMBOL = { a: '⊖', l: '☿', w: '🜍' };
export const notation = (c) => `${SYMBOL[COMBOS[c][0]]}(${SYMBOL[COMBOS[c][1]]})`;
export const longName = (c) => `${ELEMENTS[COMBOS[c][0]].name} (${ELEMENTS[COMBOS[c][1]].name})`;
export const squareColor = (r, c) => ((r + c) % 2 === 0 ? 'black' : 'white');
export const inBounds = (r, c) => r >= 1 && r <= ROWS && c >= 1 && c <= COLS;
export const other = (color) => (color === 'white' ? 'black' : 'white');

// fig. 2 / fig. 3: [row, col, inner element index]; same squares for Mercury and Sulphur boards
export const START_FULL = {
  black: [[1, 1, 1], [1, 3, 0], [2, 2, 2], [3, 1, 1], [3, 3, 0], [4, 2, 2]],
  white: [[3, 2, 2], [4, 1, 0], [4, 3, 1], [5, 2, 2], [6, 1, 0], [6, 3, 1]],
};
export const START_HALF = { black: START_FULL.black.slice(0, 3), white: START_FULL.white.slice(3) };
// board -> [outer element index, layout]
export const START_BOARDS = { 1: [0, START_FULL], 2: [0, START_HALF], 3: [1, START_FULL], 5: [1, START_HALF], 6: [2, START_FULL], 7: [2, START_HALF] };

// fig. 4: white takes the top triangle of Mira, black the bottom one
export const FIG4 = { white: [[1, 1, 1], [1, 3, 0], [2, 2, 2]], black: [[5, 2, 2], [6, 1, 0], [6, 3, 1]] };
export const PATTERNS = {
  classic: { name: 'Два треугольника', strict: false },
  strict: { name: 'Два треугольника, точные фишки', strict: true },
};
export function makeTargets(key = 'classic') {
  const strict = (PATTERNS[key] || PATTERNS.classic).strict;
  const t = {};
  for (const color of ['white', 'black']) t[color] = FIG4[color].map(([r, c, cb]) => [r, c, strict ? cb : null]);
  return t;
}

export function standardSetup() {
  const pieces = [];
  let id = 1;
  for (const [b, [outer, layout]] of Object.entries(START_BOARDS)) {
    for (const color of ['black', 'white']) {
      for (const [r, c, inner] of layout[color]) {
        pieces.push({ id: id++, color, combo: outer * 3 + inner, board: +b, row: r, col: c, stay: 0 });
      }
    }
  }
  return pieces;
}
export const soloSetup = () => standardSetup().filter((p) => p.color === 'white');
const clonePieces = (arr) => arr.map((p) => ({ ...p }));

/* ================= Advanced game: four levels per board ================= */
// Extra squares of every board, exactly as on the scheme of the advanced board (section IX):
// [row, col, level, colour]. Rows/cols are virtual: rows < 1 lie beyond row 1, rows > 6 beyond row 6,
// cols -1..5 spread sideways. Level 1 is the ordinary 6×3 board. Level 3 squares are the "null" squares.
const W = 'white', B = 'black';
export const EXTRA = [
  // row-1 end: level 4 (row of 3 + front), level 3 (null), level 2 (two T-sections)
  [-4, 1, 4, W], [-4, 2, 4, B], [-4, 3, 4, W], [-3, 2, 4, W],
  [-2, 2, 3, W],
  [-1, -1, 2, W], [-1, 0, 2, B], [-1, 1, 2, W], [0, 0, 2, W], [-1, 3, 2, W], [-1, 4, 2, B], [-1, 5, 2, W], [0, 4, 2, W],
  // row-6 end: level 2 (two T-sections), level 3 (null), level 4 (front + row of 3)
  [7, 0, 2, B], [8, -1, 2, B], [8, 0, 2, W], [8, 1, 2, B], [7, 4, 2, B], [8, 3, 2, B], [8, 4, 2, W], [8, 5, 2, B],
  [9, 2, 3, B],
  [10, 2, 4, B], [11, 1, 4, B], [11, 2, 4, W], [11, 3, 4, B],
];
const EXTRA_AT = new Map(EXTRA.map(([r, c, lv, col]) => [`${r},${c}`, { lv, col }]));
export const levelOf = (r, c) => (inBounds(r, c) ? 1 : (EXTRA_AT.get(`${r},${c}`) || { lv: 0 }).lv);
export const colorAt = (r, c) => (inBounds(r, c) ? squareColor(r, c) : (EXTRA_AT.get(`${r},${c}`) || {}).col);
export const isNull = (r, c) => levelOf(r, c) === 3;
const L1_SQ = []; for (let r = 1; r <= ROWS; r++) for (let c = 1; c <= COLS; c++) L1_SQ.push([r, c]);
const ADV_SQ = L1_SQ.concat(EXTRA.map(([r, c]) => [r, c]));
// precomputed for speed: [row, col, level, colour] of every square, and the occupancy keys per board
const ADV_INFO = ADV_SQ.map(([r, c]) => [r, c, inBounds(r, c) ? 1 : EXTRA_AT.get(`${r},${c}`).lv, inBounds(r, c) ? squareColor(r, c) : EXTRA_AT.get(`${r},${c}`).col]);
const ADV_KEYS = [null]; for (let b = 1; b <= 7; b++) ADV_KEYS.push(ADV_SQ.map(([r, c]) => `${b},${r},${c}`));
/** position on the single ladder of 28 levels: Sirius 1-4, Arcturus 1-4, … ; a step up/down the ladder
 *  counts like a step up/down the boards in the ordinary game (level 4 leads to level 1 of the next board) */
export const ladder = (b, r, c) => (b - 1) * 4 + levelOf(r, c) - 1;
/** short name of a square: "3·2" on the board itself, "ур.2" / "нулевая" on the extra levels */
export function cellName(r, c) {
  const lv = levelOf(r, c);
  if (lv <= 1) return `${r}·${c}`;
  const end = r < 1 ? 'верх' : 'низ';
  return lv === 3 ? `нулевая (${end})` : `ур.${lv} ${end}`;
}

/** advanced setup: the ordinary three sets + one more full set of each colour on levels 2 and 4 of Sirius and
 *  Arcturus (black on the black squares, white on the white ones); the null squares stay empty */
export function advancedSetup() {
  const pieces = standardSetup();
  let id = pieces.length + 1;
  for (const b of [1, 2]) for (const color of [B, W]) {
    const squares = EXTRA.filter(([, , lv, col]) => (lv === 2 || lv === 4) && col === color);
    // 12 squares of a colour on levels 2+4; the full set of nine takes the end where that colour dominates
    const end = squares.filter(([r]) => (color === B ? r > 6 : r < 1)).slice(0, 9);
    end.forEach(([r, c], k) => pieces.push({ id: id++, color, combo: k, board: b, row: r, col: c, stay: 0 }));
  }
  return pieces;
}
/** reserve for the null squares: one full spare set of each colour; a random piece is drawn from it */
export const fullReserve = () => [...Array(9).keys()].map((k) => ({ color: W, combo: k })).concat([...Array(9).keys()].map((k) => ({ color: B, combo: k })));

export class Game {
  constructor(opts = {}) {
    this.miraLimit = opts.miraLimit !== false;           // standard rule: 3 moves on Mira
    this.naosCaptureMira = opts.naosCaptureMira !== false; // standard rule: Naos may capture on Mira
    this.naosLimit = !!opts.naosLimit && !this.miraLimit; // variation 1b: w(w) on Naos max 3 moves
    this.targets = opts.targets || makeTargets('classic');
    this.advanced = !!opts.advanced;                       // four levels per board, null squares, 45 pieces a side
    this.pieces = opts.pieces ? clonePieces(opts.pieces) : this.advanced ? advancedSetup() : standardSetup();
    this.reserve = this.advanced ? (opts.reserve ? opts.reserve.map((x) => ({ ...x })) : fullReserve()) : [];
    this.rnd = opts.rnd || Math.random;
    this.turn = opts.turn || 'white';
    this.winner = null;
    this.log = [];
    this.history = [];
  }

  get(id) { return this.pieces.find((p) => p.id === id) || null; }
  pieceAt(b, r, c) { return this.pieces.find((p) => p.board === b && p.row === r && p.col === c) || null; }
  occ() { const s = new Set(); for (const p of this.pieces) s.add(`${p.board},${p.row},${p.col}`); return s; }

  targetAt(r, c) {
    for (const color of ['white', 'black']) for (const [tr, tc, cb] of this.targets[color]) if (tr === r && tc === c) return { color, combo: cb };
    return null;
  }

  // a piece whose waiting time is over must be moved before any other
  limited(p) {
    if (this.miraLimit) return p.board === MIRA;
    if (this.naosLimit) return p.board === NAOS && p.combo === 8;
    return false;
  }
  forced(color) { return this.pieces.filter((p) => p.color === color && this.limited(p) && p.stay >= 3); }

  legalMoves(piece, occ) {
    if (this.winner) return [];
    const forced = this.forced(piece.color);
    if (forced.length && !forced.includes(piece)) return [];
    occ = occ || this.occ();
    if (this.advanced) return this.advMoves(piece, occ);
    const moves = [];
    const b = piece.board;
    const addAllFree = (nb) => {
      if (nb < 1 || nb > 7) return;
      for (let r = 1; r <= ROWS; r++) for (let c = 1; c <= COLS; c++) if (!occ.has(`${nb},${r},${c}`)) moves.push({ type: 'move', b: nb, r, c });
    };
    // capture: w(w) on Naos takes any piece of the opposite colour on any square except Naos
    if (b === NAOS && piece.combo === 8) {
      for (const q of this.pieces) {
        if (q.color === piece.color || q.board === NAOS) continue;
        if (!this.naosCaptureMira && q.board === MIRA) continue;
        moves.push({ type: 'capture', b: q.board, r: q.row, c: q.col, target: q.id });
      }
    }
    const mt = movementType(piece.combo);
    if (mt === 'salt') {
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const r = piece.row + dr, c = piece.col + dc;
        if (inBounds(r, c) && !occ.has(`${b},${r},${c}`)) moves.push({ type: 'move', b, r, c });
      }
      const cur = squareColor(piece.row, piece.col);
      for (const nb of [b - 1, b + 1]) {
        if (nb < 1 || nb > 7) continue;
        for (let r = 1; r <= ROWS; r++) for (let c = 1; c <= COLS; c++)
          if (squareColor(r, c) === cur && !occ.has(`${nb},${r},${c}`)) moves.push({ type: 'move', b: nb, r, c });
      }
    } else if (mt === 'mercury') {
      for (const nb of [b, b - 1, b - 2, b + 1, b + 2]) addAllFree(nb);
    } else {
      for (let nb = 1; nb <= 7; nb++) addAllFree(nb);
    }
    return moves;
  }

  /** advanced game: the same three ways of moving, counted on the ladder of levels instead of boards */
  advMoves(piece, occ) {
    const moves = [], b = piece.board, here = ladder(b, piece.row, piece.col), lv = levelOf(piece.row, piece.col);
    const free = (nb, r, c) => !occ.has(`${nb},${r},${c}`);
    // capture: Sulphur (Sulphur) on any level of Naos takes a piece of ANY colour on any level of any other board
    if (b === NAOS && piece.combo === 8) {
      for (const q of this.pieces) {
        if (q.id === piece.id || q.board === NAOS) continue;
        if (!this.naosCaptureMira && q.board === MIRA) continue;
        moves.push({ type: 'capture', b: q.board, r: q.row, c: q.col, target: q.id });
      }
    }
    const mt = movementType(piece.combo), myCol = colorAt(piece.row, piece.col);
    // only boards that can be reached at all: salt ±1 level, mercury ±2 levels (a level step never jumps two boards)
    const reach = mt === 'sulphur' ? 99 : mt === 'mercury' ? 2 : 1;
    for (let nb = 1; nb <= 7; nb++) {
      if (Math.abs((nb - 1) * 4 - (b - 1) * 4) > reach + 3) continue;
      const keys = ADV_KEYS[nb];
      for (let i = 0; i < ADV_INFO.length; i++) {
        const [r, c, sqLv, sqCol] = ADV_INFO[i];
        if (occ.has(keys[i]) || (nb === b && r === piece.row && c === piece.col)) continue;
        const d = Math.abs((nb - 1) * 4 + sqLv - 1 - here);
        let ok;
        if (mt === 'sulphur') ok = true;
        else if (mt === 'mercury') ok = d <= 2;
        else if (d === 1) ok = sqCol === myCol; // salt: same colour, one level up or down
        else if (d === 0 && nb === b) ok = lv === 1 ? Math.abs(r - piece.row) === 1 && Math.abs(c - piece.col) === 1 : sqCol === myCol;
        else ok = false;
        if (ok) moves.push({ type: 'move', b: nb, r, c });
      }
    }
    return moves;
  }

  legalMovesForColor(color) {
    const occ = this.occ(), out = [];
    for (const p of this.pieces) if (p.color === color) for (const m of this.legalMoves(p, occ)) out.push({ id: p.id, move: m });
    return out;
  }

  static sameMove(a, b) { return a.type === b.type && a.b === b.b && a.r === b.r && a.c === b.c && (a.target || 0) === (b.target || 0); }

  apply(id, move) {
    if (this.winner) return false;
    const piece = this.get(id);
    if (!piece || piece.color !== this.turn) return false;
    if (!this.legalMoves(piece).some((m) => Game.sameMove(m, move))) return false;
    this.history.push(this.snapshot());
    if (this.history.length > 60) this.history.shift();

    const from = { b: piece.board, r: piece.row, c: piece.col };
    let captured = null;
    if (move.type === 'capture') {
      captured = { ...this.get(move.target) };
      this.pieces = this.pieces.filter((p) => p.id !== move.target);
      piece.combo = nextCombo(piece.combo); // w(w) -> a(a), stays on Naos
      piece.stay = 0;
    } else {
      piece.board = move.b; piece.row = move.r; piece.col = move.c;
      piece.combo = nextCombo(piece.combo);
      piece.stay = this.limited(piece) ? 1 : 0; // arrival counts as the first of the three moves
    }
    // null square (advanced): the piece is replaced by one drawn blind from the spare set — it may be of either colour
    let nul = null;
    if (this.advanced && move.type === 'move' && isNull(move.r, move.c) && this.reserve.length) {
      const k = Math.floor(this.rnd() * this.reserve.length), drawn = this.reserve.splice(k, 1)[0];
      const id = this.pieces.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      nul = { gone: piece.combo, goneColor: piece.color, color: drawn.color, combo: drawn.combo, id };
      this.pieces = this.pieces.filter((p) => p.id !== piece.id);
      this.pieces.push({ id, color: drawn.color, combo: drawn.combo, board: move.b, row: move.r, col: move.c, stay: 0 });
    }
    this.log.push({ n: this.log.length + 1, color: this.turn, id: piece.id, capture: move.type === 'capture',
      from, to: { b: move.b, r: move.r, c: move.c }, combo: piece.combo, captured, nul });
    for (const p of this.pieces) if (p.color === this.turn && p.id !== piece.id && this.limited(p)) p.stay += 1;

    if (this.checkWin(this.turn)) { this.winner = this.turn; return true; }
    this.turn = other(this.turn);
    if (!this.legalMovesForColor(this.turn).length) {
      const tc = this.turn;
      if (this.pieces.some((p) => p.color === tc)) this.log.push({ n: this.log.length + 1, color: tc, skip: true });
      this.turn = other(this.turn);
    }
    return true;
  }

  /* --- model editor (free placement, no win condition) --- */
  addPiece(color, combo, b, r, c) {
    if (this.pieceAt(b, r, c)) return null;
    const id = this.pieces.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    const p = { id, color, combo, board: b, row: r, col: c, stay: 0 };
    this.history.push(this.snapshot());
    this.pieces.push(p);
    return p;
  }
  removePiece(id) { this.history.push(this.snapshot()); this.pieces = this.pieces.filter((p) => p.id !== id); }
  editPiece(id, changes) { const p = this.get(id); if (!p) return; this.history.push(this.snapshot()); Object.assign(p, changes); }
  /** move any piece by its own rules regardless of whose turn it is (model mode) */
  freeMove(id, move) {
    const p = this.get(id); if (!p) return false;
    this.turn = p.color;
    const ok = this.apply(id, move);
    this.winner = null;
    return ok;
  }

  /** nobody can move (after the automatic skip the player to move still has no move): a draw */
  isDraw() {
    return !this.winner && this.pieces.length > 0 && !this.legalMovesForColor(this.turn).length
      && !this.legalMovesForColor(other(this.turn)).length;
  }

  targetOk(color, r, c, cb) { const p = this.pieceAt(MIRA, r, c); return !!p && p.color === color && (cb === null || p.combo === cb); }
  checkWin(color) { const t = this.targets[color]; return t.length > 0 && t.every(([r, c, cb]) => this.targetOk(color, r, c, cb)); }
  progress(color) { return this.targets[color].filter(([r, c, cb]) => this.targetOk(color, r, c, cb)).length; }

  snapshot() { return { pieces: clonePieces(this.pieces), turn: this.turn, winner: this.winner, loglen: this.log.length, reserve: this.reserve.map((x) => ({ ...x })) }; }
  /** same rules and position in a new object (for look-ahead) */
  copy(extra = {}) {
    return new Game(Object.assign({ pieces: this.pieces, targets: this.targets, miraLimit: this.miraLimit, naosCaptureMira: this.naosCaptureMira,
      naosLimit: this.naosLimit, turn: this.turn, advanced: this.advanced, reserve: this.reserve, rnd: this.rnd }, extra));
  }
  undo() {
    const s = this.history.pop();
    if (!s) return false;
    this.pieces = s.pieces; this.turn = s.turn; this.winner = s.winner; this.log = this.log.slice(0, s.loglen);
    if (s.reserve) this.reserve = s.reserve;
    return true;
  }
}

/* --- AI: immediate win, then heuristic (block / break the opponent's pattern, reach own targets) --- */
export function pickMove(game, color, rnd = Math.random, opts = {}) {
  const cands = game.legalMovesForColor(color);
  if (!cands.length) return null;
  const own = new Map(game.targets[color].map(([r, c, cb]) => [`${r},${c}`, cb]));
  // blind: the opponent's pattern is secret (a working where the opponent does not know the goal)
  const opp = new Map(opts.blind ? [] : game.targets[other(color)].map(([r, c, cb]) => [`${r},${c}`, cb]));
  if (own.size) {
    for (const cand of cands) {
      const m = cand.move;
      if (m.type !== 'move' || m.b !== MIRA) continue;
      const probe = game.copy({ miraLimit: false });
      const p = probe.get(cand.id);
      p.board = MIRA; p.row = m.r; p.col = m.c; p.combo = nextCombo(p.combo);
      if (probe.checkWin(color)) return cand;
    }
  }
  const oc = other(color);
  // squares of the opponent's pattern that are still missing
  const miss = opts.blind ? [] : game.targets[oc].filter(([r, c, cb]) => !game.targetOk(oc, r, c, cb));
  const missKeys = new Set(miss.map(([r, c]) => `${r},${c}`));
  // the first step of the planned path gets a bonus (still below blocking a near-complete opponent)
  const pl = own.size ? plan(game, color) : null;
  const planned = pl && cands.find((x) => x.id === pl.id && Game.sameMove(x.move, pl.move));
  if (planned && !game.targets[oc].length) return planned; // solo: nobody to block, follow the plan
  const score = (cand) => {
    const s0 = baseScore(cand);
    return planned && cand === planned ? s0 + 40 - 3 * pl.d : s0;
  };
  const baseScore = (cand) => {
    const m = cand.move, piece = game.get(cand.id);
    let s;
    if (m.type === 'capture') {
      const t = game.get(m.target);
      if (t && t.color === color) return -100; // advanced rules allow it, but taking your own piece never helps
      s = 40;
      if (t && t.board === MIRA && opp.has(`${t.row},${t.col}`)) s += 60;
      return s + rnd() * 3;
    }
    s = 0;
    if (game.advanced && isNull(m.r, m.c)) s -= 8; // the null square gives the piece away to chance
    const key = `${m.r},${m.c}`, nc = nextCombo(piece.combo);
    if (m.b === MIRA && own.has(key)) s += (own.get(key) === null || own.get(key) === nc) ? 50 : 12;
    else if (m.b === MIRA && missKeys.has(key)) s += miss.length <= 2 ? 35 : 18; // block the opponent
    else if (m.b === MIRA && opp.has(key)) s += 10;
    else if (m.b === MIRA) s += 6;
    const here = `${piece.row},${piece.col}`;
    if (piece.board === MIRA && own.has(here) && (own.get(here) === null || own.get(here) === piece.combo)) s -= 45;
    if (piece.board === MIRA && missKeys.has(here)) s -= 30; // do not give up a blocking square
    return s + (7 - Math.abs(m.b - MIRA)) * 0.5 + rnd() * 4;
  };
  const after = (cand) => {
    const g = game.copy({ turn: color });
    g.apply(cand.id, cand.move);
    return g;
  };
  // the opponent needs one more square: never leave it an immediate win
  if (miss.length === 1) {
    const danger = (g) => !g.winner && canWinNow(g, oc);
    let pool = cands, check = false;
    if (danger(game)) { // only blocking the square or a capture can help: simulate just those
      pool = cands.filter((x) => x.move.type === 'capture' || (x.move.b === MIRA && missKeys.has(`${x.move.r},${x.move.c}`)));
      check = true;
    } else {
      const blocker = game.pieceAt(MIRA, miss[0][0], miss[0][1]);
      if (blocker && blocker.color === color) pool = cands.filter((x) => x.id !== blocker.id || !danger(after(x)));
    }
    let best = null, bs = -Infinity;
    for (const cand of pool) {
      if (check && danger(after(cand))) continue;
      const s = score(cand);
      if (s > bs) { bs = s; best = cand; }
    }
    if (best) return best;
  }
  let best = null, bestScore = -Infinity;
  for (const cand of cands) {
    const s = score(cand);
    if (s > bestScore) { bestScore = s; best = cand; }
  }
  return best;
}

/* --- planner: shortest way through the transformations to the missing target squares --- */
const ALL_SQ = []; for (let r = 1; r <= ROWS; r++) for (let c = 1; c <= COLS; c++) ALL_SQ.push([r, c]);
function movesFrom(b, r, c, combo, occ, game) {
  if (game && game.advanced) // the ladder rules; null squares are never part of a plan (the piece would be lost to chance)
    return game.advMoves({ id: -1, board: b, row: r, col: c, combo }, occ).filter((m) => m.type === 'move' && !isNull(m.r, m.c)).map((m) => [m.b, m.r, m.c]);
  const mt = movementType(combo), out = [];
  if (mt === 'salt') {
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) { const nr = r + dr, nc = c + dc; if (inBounds(nr, nc) && !occ.has(`${b},${nr},${nc}`)) out.push([b, nr, nc]); }
    const cur = squareColor(r, c);
    for (const nb of [b - 1, b + 1]) if (nb >= 1 && nb <= 7) for (const [rr, cc] of ALL_SQ) if (squareColor(rr, cc) === cur && !occ.has(`${nb},${rr},${cc}`)) out.push([nb, rr, cc]);
  } else {
    const boards = mt === 'mercury' ? [b, b - 1, b - 2, b + 1, b + 2] : [1, 2, 3, 4, 5, 6, 7];
    for (const nb of boards) if (nb >= 1 && nb <= 7) for (const [rr, cc] of ALL_SQ) if (!occ.has(`${nb},${rr},${cc}`)) out.push([nb, rr, cc]);
  }
  return out;
}
/** arrivals on Mira by number of moves: Map "d,r,c" -> first step [b,r,c]. All positions after d moves
 *  share one phase, so the search is layer by layer over positions; no intermediate stops on Mira. */
function arrivals(p, occ, maxDepth = 5, game = null) {
  let layer = new Map([[`${p.board},${p.row},${p.col}`, null]]), combo = p.combo;
  const out = new Map(), SQ = game && game.advanced ? ADV_SQ.filter(([r, c]) => !isNull(r, c)) : ALL_SQ;
  for (let d = 1; d <= maxDepth; d++) {
    const next = new Map();
    if (movementType(combo) === 'sulphur') {
      const f0 = layer.values().next().value;
      for (let nb = 1; nb <= 7; nb++) for (const [rr, cc] of SQ) { const k = `${nb},${rr},${cc}`; if (!occ.has(k) && !next.has(k)) next.set(k, f0 || [nb, rr, cc]); }
    } else {
      for (const [key, f] of layer) {
        const [b, r, c] = key.split(',').map(Number);
        for (const q of movesFrom(b, r, c, combo, occ, game)) { const k = q.join(','); if (!next.has(k)) next.set(k, f || q); }
      }
    }
    layer = new Map();
    for (const [k, f] of next) {
      const [b, r, c] = k.split(',').map(Number);
      if (b === MIRA) { const a = `${d},${r},${c}`; if (!out.has(a)) out.set(a, f); } else layer.set(k, f);
    }
    combo = nextCombo(combo);
    if (!layer.size) break;
  }
  return out;
}
/** next step of a plan: each missing square gets its own piece; with the Mira limit the pieces are
 *  prepared off Mira first and arrive one per move. Returns {d, id, move} or null. */
export function plan(game, color) {
  const t = game.targets[color];
  const need = t.filter(([r, c, cb]) => !game.targetOk(color, r, c, cb));
  if (!need.length) return null;
  const done = new Set(t.filter(([r, c, cb]) => game.targetOk(color, r, c, cb)).map(([r, c]) => `${r},${c}`));
  const occAll = game.occ(), pairs = [];
  for (const p of game.pieces) {
    if (p.color !== color || (p.board === MIRA && done.has(`${p.row},${p.col}`))) continue;
    const occ = new Set(occAll); occ.delete(`${p.board},${p.row},${p.col}`);
    for (const [k, f] of arrivals(p, occ, game.advanced ? 4 : 5, game)) {
      const [d, r, c] = k.split(',').map(Number);
      for (const [tr, tc, cb] of need) if (tr === r && tc === c && (cb === null || cb === (p.combo + d) % 9)) pairs.push({ d, sq: `${r},${c}`, id: p.id, f });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const usedT = new Set(), usedP = new Set(), chosen = [];
  for (const x of pairs) {
    if (usedT.has(x.sq) || usedP.has(x.id)) continue;
    usedT.add(x.sq); usedP.add(x.id);
    chosen.push({ d: x.d, id: x.id, move: { type: 'move', b: x.f[0], r: x.f[1], c: x.f[2] } });
  }
  if (!chosen.length) return null;
  const pick = game.miraLimit && chosen.length === need.length
    ? chosen.reduce((a, b) => (b.d > a.d ? b : a)) : chosen.reduce((a, b) => (b.d < a.d ? b : a));
  return pick;
}

/** can `who` complete its pattern with a single move in position g? */
export function canWinNow(g, who) {
  const t = g.targets[who];
  if (!t.length) return false;
  const miss = t.filter(([r, c, cb]) => !g.targetOk(who, r, c, cb));
  if (miss.length !== 1) return false;
  const [mr, mc, cb] = miss[0];
  if (g.pieceAt(MIRA, mr, mc)) return false; // occupied: only a capture could free it
  const done = new Set(t.filter(([r, c, x]) => g.targetOk(who, r, c, x)).map(([r, c]) => `${r},${c}`));
  const occ = g.occ();
  for (const p of g.pieces) {
    if (p.color !== who || (p.board === MIRA && done.has(`${p.row},${p.col}`))) continue;
    if (cb !== null && nextCombo(p.combo) !== cb) continue;
    if (g.legalMoves(p, occ).some((m) => m.type === 'move' && m.b === MIRA && m.r === mr && m.c === mc)) return true;
  }
  return false;
}

/* --- correspondences of a piece in its place (individual level) --- */
export const JUNG = ['Чувствующий экстраверт', 'Интуитивный экстраверт', 'Мыслительный экстраверт', 'Чувствующий интроверт',
  'Интуитивный интроверт', 'Мыслительный интроверт', 'Мастер Храма / Госпожа', 'Гранд Мастер / Гранд Госпожа', 'Homo Galactica'];
export const LEVELS = { a: 'эго', l: 'самость', w: 'за пределами индивидуации' };
export const FUNCS = { a: 'Чувство', l: 'Интуиция', w: 'Мышление' };

export function meaning(p) {
  const B = BOARDS[p.board], o = outerOf(p.combo), i = innerOf(p.combo);
  return {
    piece: `${p.color === 'white' ? 'светлая' : 'тёмная'} · ${longName(p.combo)}`,
    sphere: `доска-звезда ${B.name} · сфера ${B.sphereOf}`, aeon: B.aeon, process: B.process, tree: B.tree,
    atu: B.atu[ORDER.indexOf(o)], type: JUNG[p.combo], level: LEVELS[o], func: FUNCS[i],
  };
}

/** aggregate picture of a placement (the "synthesis" panel) */
export function synthesis(pieces) {
  const s = { total: pieces.length, outer: { a: 0, l: 0, w: 0 }, inner: { a: 0, l: 0, w: 0 }, light: 0, dark: 0,
    boards: Array(8).fill(0), types: Array(9).fill(0) };
  for (const p of pieces) {
    s.outer[outerOf(p.combo)]++; s.inner[innerOf(p.combo)]++; s.boards[p.board]++; s.types[p.combo]++;
    if (p.color === 'white') s.light++; else s.dark++;
  }
  return s;
}

/* how many boards/squares a phase can reach from a board (for the visualizations) */
export function reach(combo, board) {
  const g = new Game({ pieces: [{ id: 1, color: 'white', combo, board, row: 3, col: board % 2 ? 1 : 2, stay: 0 }], targets: { white: [], black: [] }, miraLimit: false });
  const per = Array(8).fill(0);
  for (const m of g.legalMoves(g.get(1))) per[m.b]++;
  return per;
}
