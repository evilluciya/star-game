/* scene.js — the seven boards in 3D (Three.js): spiral tower you can rotate and zoom,
 * pieces with glyph tops, move highlights, animated moves, layout modes.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as E from './engine.js?v=202611170128';

const RED = 0xd3122a, WHITE_SQ = 0xe9e6df, BLACK_SQ = 0x0c0c0c;
const CELL = 1, CELL_H = 0.08, SLAB_H = 0.18;
const PIECE_R = 0.36, PIECE_H = 0.22;
// advanced board: height of levels 2-4 above the slab, and the scheme's y of each virtual row (scheme units, 25 = one square)
const LV_H = [0, 0, 0.55, 0.95, 1.35];
const FIG_Y = { '-4': 3, '-3': 28, '-2': 57, '-1': 85, 0: 110, 7: 295, 8: 320, 9: 350, 10: 380, 11: 405 };

/* ---------- glyph textures ---------- */
function drawGlyph(ctx, el, cx, cy, size, color) {
  const k = size / 100, x0 = cx - size / 2, y0 = cy - size / 2;
  const P = (x, y) => [x0 + x * k, y0 + y * k];
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, 8 * k); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (el === 'a') {
    ctx.arc(...P(50, 50), 34 * k, 0, Math.PI * 2); ctx.moveTo(...P(16, 50)); ctx.lineTo(...P(84, 50));
  } else if (el === 'l') {
    ctx.arc(...P(50, 14), 20 * k, 0, Math.PI); ctx.moveTo(...P(70, 46)); ctx.arc(...P(50, 46), 20 * k, 0, Math.PI * 2);
    ctx.moveTo(...P(50, 66)); ctx.lineTo(...P(50, 92)); ctx.moveTo(...P(34, 80)); ctx.lineTo(...P(66, 80));
  } else {
    ctx.moveTo(...P(50, 16)); ctx.lineTo(...P(78, 60)); ctx.lineTo(...P(22, 60)); ctx.closePath();
    ctx.moveTo(...P(50, 60)); ctx.lineTo(...P(50, 92)); ctx.moveTo(...P(34, 78)); ctx.lineTo(...P(66, 78));
  }
  ctx.stroke();
}
/** notation on a canvas, symbols only, one line, same size: X(Y); s = box size (same layout as viz.nota) */
function drawNota(ctx, combo, cx, cy, s, color) {
  const u = s / 100, X = (v) => cx + (v - 50) * u, Y = (v) => cy + (v - 50) * u;
  drawGlyph(ctx, E.outerOf(combo), X(30), Y(50), 36 * u, color);
  drawGlyph(ctx, E.innerOf(combo), X(62), Y(50), 36 * u, color);
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, 2.6 * u); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(X(47), Y(35)); ctx.quadraticCurveTo(X(42), Y(50), X(47), Y(65));
  ctx.moveTo(X(77), Y(35)); ctx.quadraticCurveTo(X(82), Y(50), X(77), Y(65));
  ctx.stroke();
}
export { drawGlyph, drawNota };

const texCache = new Map();
function topTexture(color, combo) {
  const key = color + combo;
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  const bg = color === 'white' ? '#f4f1ea' : '#0e0e0e', ink = color === 'white' ? '#0e0e0e' : '#f4f1ea';
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 256);
  // the top cap of a CylinderGeometry maps u along z and v along x (transposed): draw rotated so
  // the glyph and the notation read normally (not mirrored) when the board is seen from the front
  ctx.setTransform(0, -1, 1, 0, 0, 256);
  ctx.strokeStyle = '#d3122a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(128, 128, 118, 0, Math.PI * 2); ctx.stroke();
  drawNota(ctx, combo, 128, 128, 256, ink);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

function labelSprite(lines, color = '#f4f1ea', accent = false) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
  const ctx = cv.getContext('2d');
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  // soft dark backing: the label is drawn over the boards, it must stay readable on white squares
  ctx.font = '600 64px "Cormorant SC", "Cormorant Garamond", serif';
  const w = Math.min(512, Math.max(ctx.measureText(lines[0]).width, 200) + 28);
  const grd = ctx.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0, 'rgba(5,5,5,.72)'); grd.addColorStop(0.85, 'rgba(5,5,5,.55)'); grd.addColorStop(1, 'rgba(5,5,5,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, w, 142);
  ctx.fillStyle = accent ? '#d3122a' : color;
  ctx.fillText(lines[0], 8, 4);
  ctx.fillStyle = '#8d8a84'; ctx.font = '34px "JetBrains Mono", monospace'; ctx.fillText(lines[1], 10, 92);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  // depthTest off: a board in front must not cut the label in half
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sp.renderOrder = 10;
  sp.scale.set(3.2, 1.0, 1);
  return sp;
}

/* ---------- tweens ---------- */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Tower {
  constructor(container, opts = {}) {
    this.el = container;
    this.opts = opts;
    this.layoutMode = opts.layout || 'spiral';
    this.gap = opts.gap || 1.9;
    this.tweens = [];
    this.pieceMeshes = new Map();
    this.highlight = true;
    this.state = { sel: null, targets: [], last: [] };

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.25;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);

    const s = this.scene = new THREE.Scene();
    s.fog = new THREE.FogExp2(0x050505, 0.022);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.camera.position.set(15, 12, 15);

    s.add(new THREE.HemisphereLight(0xffffff, 0x220000, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(8, 20, 10); s.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.8); fill.position.set(-10, 8, -4); s.add(fill);
    const rim = new THREE.PointLight(RED, 40, 40, 1.6); rim.position.set(-8, 6, -6); s.add(rim);
    this.rim = rim;

    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 3, maxDistance: 45,
      autoRotate: !!opts.autoRotate, autoRotateSpeed: 0.6, enablePan: opts.interactive !== false });
    if (opts.interactive === false) { this.controls.enableZoom = false; }
    else this.controls.zoomToCursor = true;  // pinch / wheel brings you closer to the board under the fingers

    this.buildTower();
    this.buildDust();
    this.applyLayout(this.layoutMode, 0);
    this.resetView(0);

    this.ray = new THREE.Raycaster();
    if (opts.interactive) this.bindPicking();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.clock = new THREE.Clock();
    r.setAnimationLoop(() => this.frame());
  }

  /* ---------- construction ---------- */
  buildTower() {
    this.root = new THREE.Group(); this.scene.add(this.root);
    const slabGeo = new THREE.BoxGeometry(CELL * 3 + 0.36, SLAB_H, CELL * 6 + 0.36);
    const cellGeo = new THREE.BoxGeometry(CELL * 0.98, CELL_H, CELL * 0.98);
    const mWhite = new THREE.MeshStandardMaterial({ color: WHITE_SQ, roughness: 0.55, metalness: 0.0 });
    const mBlack = new THREE.MeshStandardMaterial({ color: BLACK_SQ, roughness: 0.35, metalness: 0.15 });
    const mSlab = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.6, metalness: 0.3 });
    this.boards = [null];
    this.cells = [];
    this.nullMat = new THREE.LineBasicMaterial({ color: RED });  // frame of the null squares (link to the Abyss)
    for (let b = 1; b <= 7; b++) {
      const g = new THREE.Group(); g.userData.board = b;
      // own materials per board, so one board can be made see-through without the others
      const bm = { slab: mSlab.clone(), white: mWhite.clone(), black: mBlack.clone(),
        edge: new THREE.LineBasicMaterial({ color: b === E.MIRA ? RED : 0x555555, transparent: true, opacity: b === E.MIRA ? 1 : 0.6 }) };
      g.userData.mats = Object.values(bm);
      const slab = new THREE.Mesh(slabGeo, bm.slab); slab.position.y = -SLAB_H / 2; g.add(slab);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo), bm.edge);
      edges.position.y = -SLAB_H / 2; g.add(edges);
      for (let r = 1; r <= 6; r++) for (let c = 1; c <= 3; c++) {
        const m = new THREE.Mesh(cellGeo, E.squareColor(r, c) === 'black' ? bm.black : bm.white);
        m.position.set(...this.local(r, c, CELL_H / 2));
        m.userData = { cell: true, b, r, c };
        g.add(m); this.cells.push(m);
      }
      // advanced game: levels 2-4 at both ends of the board (shown only in the advanced version)
      g.userData.extra = [];
      for (const [r, c, lv, col] of E.EXTRA) {
        const m = new THREE.Mesh(cellGeo, col === 'black' ? bm.black : bm.white);
        m.position.set(...this.local(r, c, CELL_H / 2));
        m.userData = { cell: true, extra: true, b, r, c };
        const fr = new THREE.LineSegments(new THREE.EdgesGeometry(cellGeo), lv === 3 ? this.nullMat : bm.edge);
        if (lv === 3) fr.scale.set(1.04, 1.6, 1.04);
        m.add(fr);
        m.visible = false;
        g.add(m); this.cells.push(m); g.userData.extra.push(m);
      }
      const lab = labelSprite([`${b} · ${E.BOARDS[b].name}`, E.BOARDS[b].planet], '#f4f1ea', b === E.MIRA);
      lab.position.set(3.4, 0.6, -2.2); g.add(lab);
      g.userData.label = lab;
      this.root.add(g); this.boards.push(g);
    }
    // central column + arms
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 12), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, emissive: 0x330005, roughness: 0.4 }));
    this.root.add(this.column);
    this.arms = [];
    const armMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5 });
    for (let b = 1; b <= 7; b++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.05), armMat); this.root.add(arm); this.arms.push(arm);
    }
    // markers (pooled)
    this.markerGroup = new THREE.Group(); this.root.add(this.markerGroup);
    this.dotGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.03, 24);
    this.dotMat = new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.9 });
    this.ringGeo = new THREE.TorusGeometry(0.47, 0.035, 8, 40);
    this.ringMat = new THREE.MeshBasicMaterial({ color: RED });
    this.frameGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 0.01, 0.9));
    this.pieceGeo = new THREE.CylinderGeometry(PIECE_R, PIECE_R * 1.04, PIECE_H, 40);
  }

  buildDust() {
    const n = 500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, rr = 4 + Math.random() * 22;
      pos[i * 3] = Math.cos(a) * rr; pos[i * 3 + 1] = Math.random() * 26 - 6; pos[i * 3 + 2] = Math.sin(a) * rr;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    // round dots (a plain point is a square, and one near the camera showed up as a grey box)
    const dc = document.createElement('canvas'); dc.width = dc.height = 32;
    const dx = dc.getContext('2d'), rg = dx.createRadialGradient(16, 16, 0, 16, 16, 16);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.5, 'rgba(255,255,255,.6)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    dx.fillStyle = rg; dx.fillRect(0, 0, 32, 32);
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbbbbbb, size: 0.07, map: new THREE.CanvasTexture(dc), transparent: true, opacity: 0.55, depthWrite: false }));
    this.scene.add(this.dust);
  }

  local(r, c, y = 0) {
    const lv = E.levelOf(r, c);
    // extra levels: laid out like the scheme of the advanced board, each level a step higher above the slab
    if (lv > 1) return [(c - 2) * CELL, y + LV_H[lv], (FIG_Y[r] + 12.5 - 215) / 25 * CELL];
    return [(c - 2) * CELL, y, (r - 3.5) * CELL];
  }

  /** show or hide levels 2-4 of every board (advanced version of the game) */
  setAdvanced(on) {
    this.advanced = !!on;
    for (let b = 1; b <= 7; b++) this.boards[b].userData.extra.forEach((m) => (m.visible = this.advanced));
    this.applyLayout(this.layoutMode, 0);
  }

  /* ---------- layouts ---------- */
  layoutOf(mode, b) {
    const i = b - 1;
    if (mode === 'stack') return { x: 0, y: i * this.gap, z: 0, ry: 0 };
    if (mode === 'flat') return { x: (i - 3) * (this.advanced ? 7.4 : 4.4), y: 0, z: 0, ry: 0 };
    const th = i * (2 * Math.PI / 7) * 0.9, R = this.advanced ? 6.5 : 3.0; // spiral (the long advanced boards need room)
    return { x: Math.cos(th) * R, y: i * this.gap, z: Math.sin(th) * R, ry: -th };
  }

  applyLayout(mode, dur = 900) {
    this.layoutMode = mode;
    if (dur && this.markerGroup) this.markerGroup.visible = false; // markers are in world space
    for (let b = 1; b <= 7; b++) {
      const g = this.boards[b], to = this.layoutOf(mode, b);
      const from = { x: g.position.x, y: g.position.y, z: g.position.z, ry: g.rotation.y };
      const set = (k) => {
        g.position.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, from.z + (to.z - from.z) * k);
        g.rotation.y = from.ry + (to.ry - from.ry) * k;
        g.userData.label.position.set(mode === 'flat' ? -1.5 : 3.4, mode === 'flat' ? 0.4 : 0.6, mode === 'flat' ? -4.2 : -2.2);
      };
      if (!dur) set(1); else this.tween(dur, set, null, b * 40);
    }
    const showCol = mode !== 'flat';
    this.column.visible = showCol; this.arms.forEach((a) => (a.visible = mode === 'spiral'));
    if (!dur) this.updateColumn(); else this.tween(dur + 300, () => this.updateColumn());
  }

  updateColumn() {
    const top = 6 * this.gap + 1.2;
    this.column.scale.y = top + 1.2; this.column.position.set(0, top / 2 - 0.6, 0);
    for (let b = 1; b <= 7; b++) {
      const g = this.boards[b], arm = this.arms[b - 1];
      const d = Math.hypot(g.position.x, g.position.z), len = Math.max(0.01, d - 1.6), ux = g.position.x / (d || 1), uz = g.position.z / (d || 1);
      arm.scale.x = len; arm.position.set(ux * len / 2, g.position.y - 0.12, uz * len / 2);
      arm.rotation.y = -Math.atan2(g.position.z, g.position.x);
    }
    this.markerGroup.visible = true;
    this.renderMarkers();
  }

  setGap(v) { this.gap = v; this.applyLayout(this.layoutMode, 0); }

  worldOf(b, r, c, y = 0) {
    const v = new THREE.Vector3(...this.local(r, c, y));
    this.boards[b].updateMatrixWorld();
    return this.boards[b].localToWorld(v);
  }
  centerOf(b) { return this.worldOf(b, 3.5, 2, 0); }

  /* ---------- camera ---------- */
  resetView(dur = 900) {
    const mid = this.layoutMode === 'flat' ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(0, 3 * this.gap, 0);
    const pos = this.layoutMode === 'flat' ? new THREE.Vector3(0, 22, 14) : new THREE.Vector3(15, 3 * this.gap + 8, 15);
    // portrait screens (phones) need the camera further away to fit the tower
    const aspect = (this.el.clientWidth || 1) / (this.el.clientHeight || 1);
    const k = (aspect < 1 ? Math.min(2.2, 1 / aspect * 0.95) : 1) * (this.advanced ? 1.6 : 1);
    pos.sub(mid).multiplyScalar(k).add(mid);
    this.flyTo(pos, mid, dur);
  }
  topView(dur = 900) {
    const mid = new THREE.Vector3(0, this.layoutMode === 'flat' ? 0 : 3 * this.gap, 0);
    this.flyTo(new THREE.Vector3(0.01, mid.y + 26, 0.01), mid, dur);
  }
  focusBoard(b, dur = 900) {
    const c = this.centerOf(b);
    const g = this.boards[b];
    const out = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y);
    // a narrow phone screen needs more distance for the whole board to fit; the advanced board with its levels is ~2.5× longer
    const k = Math.max(1, 1.25 / this.camera.aspect) * (this.advanced ? 2 : 1);
    const pos = c.clone().add(out.multiplyScalar((this.layoutMode === 'flat' ? 0.1 : 5.5) * k)).add(new THREE.Vector3(0, 7 * k, 0));
    if (this.layoutMode === 'flat') pos.z += 4 * k;
    this.flyTo(pos, c, dur);
  }
  flyTo(pos, target, dur) {
    const p0 = this.camera.position.clone(), t0 = this.controls.target.clone();
    if (!dur) { this.camera.position.copy(pos); this.controls.target.copy(target); this.controls.update(); return; }
    this.tween(dur, (k) => { this.camera.position.lerpVectors(p0, pos, k); this.controls.target.lerpVectors(t0, target, k); });
  }

  /* ---------- pieces ---------- */
  makePiece(p) {
    const side = new THREE.MeshStandardMaterial({ color: p.color === 'white' ? 0xf1eee7 : 0x111111, roughness: p.color === 'white' ? 0.45 : 0.3, metalness: p.color === 'white' ? 0 : 0.25 });
    const top = new THREE.MeshStandardMaterial({ map: topTexture(p.color, p.combo), roughness: 0.5 });
    const mesh = new THREE.Mesh(this.pieceGeo, [side, top, side]);
    mesh.userData = { piece: true, id: p.id, combo: p.combo, color: p.color };
    this.boards[p.board].add(mesh);
    return mesh;
  }
  /** piece position in its board's local frame (boards only rotate around Y) */
  pieceHome(p) { return new THREE.Vector3(...this.local(p.row, p.col, CELL_H + PIECE_H / 2)); }
  pieceWorld(p) { return this.worldOf(p.board, p.row, p.col, CELL_H + PIECE_H / 2); }

  /** Sync meshes with the game state. view.animate=true moves pieces along an arc. */
  sync(game, view = {}) {
    this.game = game;
    Object.assign(this.state, view);
    const alive = new Set();
    for (const p of game.pieces) {
      alive.add(p.id);
      let mesh = this.pieceMeshes.get(p.id);
      const home = this.pieceHome(p);
      if (!mesh) {
        mesh = this.makePiece(p); mesh.position.copy(home); this.pieceMeshes.set(p.id, mesh);
        if (view.dropIn) { const y = home.y, h = 7 + Math.random() * 5; mesh.position.y += h; this.tween(900 + Math.random() * 700, (k) => (mesh.position.y = y + (1 - k) * h), null, Math.random() * 900); }
        continue;
      }
      if (mesh.userData.moving) continue;
      const onBoard = mesh.parent === this.boards[p.board];
      const moved = !onBoard || Math.hypot(mesh.position.x - home.x, mesh.position.z - home.z) > 0.01;
      if (mesh.userData.combo !== p.combo) {
        const setTex = () => { mesh.material[1].map = topTexture(p.color, p.combo); mesh.material[1].needsUpdate = true; mesh.userData.combo = p.combo; };
        if (view.animate && moved) setTimeout(setTex, 520); else setTex();
      }
      if (moved && view.animate) this.arcMove(mesh, p);
      else { this.boards[p.board].add(mesh); mesh.position.copy(home); mesh.rotation.set(0, 0, 0); }
    }
    for (const [id, mesh] of this.pieceMeshes) {
      if (alive.has(id)) continue;
      this.pieceMeshes.delete(id);
      const drop = () => mesh.parent && mesh.parent.remove(mesh);
      if (view.animate) this.tween(700, (k) => { mesh.scale.setScalar(Math.max(0.001, 1 - k)); mesh.position.y += 0.04; mesh.rotation.z = k * 4; }, drop, 250);
      else drop();
    }
    this.renderMarkers();
  }

  arcMove(mesh, p) {
    this.root.attach(mesh);                     // keep world transform while flying
    const from = mesh.position.clone();
    const to = this.root.worldToLocal(this.pieceWorld(p));
    const h = Math.max(1.2, from.distanceTo(to) * 0.35);
    mesh.userData.moving = true;
    this.tween(650, (k) => {
      mesh.position.lerpVectors(from, to, k); mesh.position.y += Math.sin(Math.PI * k) * h;
      mesh.rotation.x = Math.sin(Math.PI * k) * 0.5;
    }, () => {
      mesh.userData.moving = false;
      this.boards[p.board].add(mesh); mesh.position.copy(this.pieceHome(p)); mesh.rotation.set(0, 0, 0);
    });
  }

  setHighlight(on) { this.highlight = on; this.renderMarkers(); }

  renderMarkers() {
    const g = this.game; if (!g) return;
    const grp = this.markerGroup;
    while (grp.children.length) grp.remove(grp.children[0]);
    const st = this.state;
    // lift the selected piece, put the others down
    for (const [id, mesh] of this.pieceMeshes) {
      const p = g.get(id); if (!p || mesh.userData.moving || mesh.parent !== this.boards[p.board]) continue;
      mesh.position.y = this.pieceHome(p).y + (id === st.sel ? 0.35 : 0);
    }
    if (st.sel != null) {
      const p = g.get(st.sel);
      if (p) { const ring = new THREE.Mesh(this.ringGeo, this.ringMat); ring.rotation.x = Math.PI / 2; ring.position.copy(this.pieceWorld(p)); ring.position.y += 0.35; ring.userData.pulse = true; grp.add(ring); }
    }
    if (this.highlight) {
      for (const m of st.targets || []) {
        if (m.type === 'capture') {
          const tp = g.get(m.target); if (!tp) continue;
          const ring = new THREE.Mesh(this.ringGeo, this.ringMat); ring.rotation.x = Math.PI / 2; ring.position.copy(this.pieceWorld(tp)); ring.userData.pulse = true; grp.add(ring);
        } else {
          const dot = new THREE.Mesh(this.dotGeo, this.dotMat); dot.position.copy(this.worldOf(m.b, m.r, m.c, CELL_H + 0.02));
          dot.rotation.y = this.boards[m.b].rotation.y; dot.userData.pulse = true; grp.add(dot);
        }
      }
    }
    // hint: big white ring on the suggested square (shown even when highlighting is off)
    if (st.hint) {
      const h = st.hint, ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      ring.rotation.x = Math.PI / 2; ring.position.copy(this.worldOf(h.b, h.r, h.c, CELL_H + 0.05)); ring.userData.pulse = true; grp.add(ring);
    }
    // last move: red outline on from / to squares
    for (const e of st.last || []) {
      if (e.skip) continue;
      const cells = e.capture ? [e.to] : [e.from, e.to];
      for (const s of cells) {
        const f = new THREE.LineSegments(this.frameGeo, new THREE.LineBasicMaterial({ color: 0xff5a6a, transparent: true, opacity: 0.8 }));
        f.position.copy(this.worldOf(s.b, s.r, s.c, CELL_H + 0.01)); f.rotation.y = this.boards[s.b].rotation.y; grp.add(f);
      }
    }
    // Mira targets: frame in owner colour + ghost piece where empty
    for (const color of ['white', 'black']) {
      if (this.opts.soloHideBlack && color === 'black') continue;
      for (const [r, c, cb] of g.targets[color]) {
        const f = new THREE.LineSegments(this.frameGeo, new THREE.LineBasicMaterial({ color: RED }));
        f.position.copy(this.worldOf(E.MIRA, r, c, CELL_H + 0.012)); f.rotation.y = this.boards[E.MIRA].rotation.y; f.scale.setScalar(1.04); grp.add(f);
        if (!g.pieceAt(E.MIRA, r, c)) {
          const ghost = new THREE.Mesh(this.pieceGeo, new THREE.MeshBasicMaterial({ color: color === 'white' ? 0xffffff : 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
          if (cb !== null) { ghost.material = [ghost.material, new THREE.MeshBasicMaterial({ map: topTexture(color, cb), transparent: true, opacity: 0.45 }), ghost.material]; }
          ghost.position.copy(this.worldOf(E.MIRA, r, c, CELL_H + PIECE_H / 2)); ghost.scale.set(0.9, 0.4, 0.9); grp.add(ghost);
        }
      }
    }
  }

  /* ---------- picking ---------- */
  bindPicking() {
    const dom = this.renderer.domElement;
    let down = null;
    dom.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    dom.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) { down = null; return; }
      down = null;
      const rect = dom.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.ray.setFromCamera(ndc, this.camera);
      const objs = [...this.pieceMeshes.values(), ...this.cells.filter((m) => m.visible)];
      // a see-through board in front must not catch the tap: prefer the first hit on a solid board
      const hits = this.ray.intersectObjects(objs, false);
      const boardOf = (h) => (h.object.userData.piece ? h.object.parent && h.object.parent.userData.board : h.object.userData.b);
      const hit = hits.find((h) => this.alphaOf(boardOf(h)) >= 0.5) || hits[0];
      if (!hit) { this.opts.onPick && this.opts.onPick(null); return; }
      const ud = hit.object.userData;
      if (ud.piece) { const p = this.game.get(ud.id); this.opts.onPick && this.opts.onPick({ b: p.board, r: p.row, c: p.col, piece: p }); }
      else this.opts.onPick && this.opts.onPick({ b: ud.b, r: ud.r, c: ud.c, piece: this.game && this.game.pieceAt(ud.b, ud.r, ud.c) });
    });
  }

  /* ---------- intro (hero) ---------- */
  intro() {
    for (let b = 1; b <= 7; b++) {
      const g = this.boards[b], to = this.layoutOf(this.layoutMode, b);
      const fromY = to.y + 14 + b * 2, fromRy = to.ry + Math.PI * (b % 2 ? 1.5 : -1.5);
      g.position.set(to.x * 3, fromY, to.z * 3); g.rotation.y = fromRy;
      this.tween(1600, (k) => {
        g.position.set(to.x * (3 - 2 * k), fromY + (to.y - fromY) * k, to.z * (3 - 2 * k)); g.rotation.y = fromRy + (to.ry - fromRy) * k;
      }, () => this.updateColumn(), 250 + (7 - b) * 180);
    }
  }

  /* ---------- loop ---------- */
  tween(dur, update, done, delay = 0) { this.tweens.push({ t0: performance.now() + delay, dur, update, done }); }

  /* ---------- see-through boards and free panning (optional, from the "Вид" panel) ---------- */
  /** a: opacity of the boards (1 = solid); the focused board, if any, stays solid */
  setFade(a) { this.fade = a; this.applyFade(); }
  setFadeFocus(b) { this.fadeFocus = b; this.applyFade(); }
  alphaOf(b) { return b && b === this.fadeFocus ? 1 : (this.fade == null ? 1 : this.fade); }
  applyFade() {
    const set = (m, a) => {
      if (m.userData.base == null) m.userData.base = { o: m.opacity, t: m.transparent };
      const o = m.userData.base.o * a;
      if (Math.abs(m.opacity - o) < 1e-3) return;
      m.opacity = o; m.transparent = m.userData.base.t || a < 0.999; m.depthWrite = a >= 0.999; m.needsUpdate = true;
    };
    for (let b = 1; b <= 7; b++) { const a = this.alphaOf(b); this.boards[b].userData.mats.forEach((m) => set(m, a)); }
    for (const mesh of this.pieceMeshes.values()) {
      const b = mesh.parent && mesh.parent.userData.board, a = this.alphaOf(b);
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => set(m, a));
    }
  }
  /** on: one finger / left mouse moves the view sideways instead of rotating it */
  setPanMode(on) {
    this.controls.touches.ONE = on ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    this.controls.mouseButtons.LEFT = on ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  }

  frame() {
    if (this.fade != null && this.fade < 1) this.applyFade();  // pieces change boards while moving
    const now = performance.now(), t = this.clock.getElapsedTime();
    this.tweens = this.tweens.filter((tw) => {
      if (now < tw.t0) return true;
      const k = Math.min(1, (now - tw.t0) / tw.dur);
      tw.update(ease(k));
      if (k >= 1) { tw.done && tw.done(); return false; }
      return true;
    });
    for (const m of this.markerGroup.children) if (m.userData.pulse) { const s = 1 + Math.sin(t * 5) * 0.12; m.scale.set(s, m.scale.y, s); }
    this.dust.rotation.y = t * 0.02;
    this.rim.intensity = 18 + Math.sin(t * 1.3) * 5;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    // hero: shift the tower to the right so it does not sit under the title
    if (this.opts.offsetX && w > 900) this.camera.setViewOffset(w, h, -w * this.opts.offsetX, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  setAutoRotate(on) { this.controls.autoRotate = on; }
}
