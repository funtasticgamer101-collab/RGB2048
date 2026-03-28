'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const SIZE     = 4;
const GAP      = 10;
const SLIDE_MS = 110;   // must match CSS transition duration

// ── State ─────────────────────────────────────────────────────────────────────
// grid[r][c] = { id, value } | null
let grid     = [];
let score    = 0;
let best     = parseInt(localStorage.getItem('best2048') || '0');
let gameOver    = false;
let won         = false;
let keepPlaying = false;
let moving      = false;   // blocks input during slide
let nextId      = 1;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const boardEl    = document.getElementById('board');
const tileLayer  = document.getElementById('tile-layer');
const scoreEl    = document.getElementById('score');
const bestEl     = document.getElementById('best');
const overlay    = document.getElementById('overlay');
const overlayH2  = document.getElementById('overlay-title');
const overlayP   = document.getElementById('overlay-msg');
const overlayCTA = document.getElementById('overlay-cta');
const btnNew     = document.getElementById('btn-new');
const btnInstall = document.getElementById('btn-install');

// ── Install prompt ────────────────────────────────────────────────────────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.style.display = 'inline-flex';
});
btnInstall.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') btnInstall.style.display = 'none';
  deferredPrompt = null;
});
window.addEventListener('appinstalled', () => { btnInstall.style.display = 'none'; });

// ── Layout helpers ────────────────────────────────────────────────────────────
function cellSize() {
  return (tileLayer.offsetWidth - (SIZE - 1) * GAP) / SIZE;
}
function cellPos(idx) {
  return idx * (cellSize() + GAP);
}
function fontSize(value, cs) {
  const d = String(value).length;
  return d <= 2 ? cs * 0.38 : d === 3 ? cs * 0.28 : d === 4 ? cs * 0.22 : cs * 0.17;
}

// ── Create tile DOM element ───────────────────────────────────────────────────
function createTileEl(tile, r, c, cs, animate) {
  const el = document.createElement('div');
  el.className   = 'tile' + (animate === 'new' ? ' new' : animate === 'merge' ? ' merge' : '');
  el.id          = 'tile-' + tile.id;
  el.dataset.val = tile.value;
  el.style.width  = cs + 'px';
  el.style.height = cs + 'px';
  el.style.left   = cellPos(c) + 'px';
  el.style.top    = cellPos(r) + 'px';
  el.style.fontSize = fontSize(tile.value, cs) + 'px';
  el.textContent  = tile.value;
  return el;
}

// ── Score ─────────────────────────────────────────────────────────────────────
function addScore(delta) {
  score += delta;
  scoreEl.textContent = score;
  if (score > best) {
    best = score;
    localStorage.setItem('best2048', best);
  }
  bestEl.textContent = best;
  const box = document.getElementById('score-box');
  box.classList.remove('pop');
  void box.offsetWidth;
  box.classList.add('pop');
}

// ── New game ──────────────────────────────────────────────────────────────────
function newGame() {
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  score       = 0;
  gameOver    = false;
  won         = false;
  keepPlaying = false;
  moving      = false;
  overlay.classList.remove('show');
  scoreEl.textContent = 0;
  bestEl.textContent  = best;
  tileLayer.innerHTML = '';
  spawnRandom(true);
  spawnRandom(true);
}

// ── Spawn a random tile ───────────────────────────────────────────────────────
function spawnRandom(instant) {
  const empties = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!grid[r][c]) empties.push([r, c]);
  if (!empties.length) return false;

  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const tile   = { id: nextId++, value: Math.random() < 0.9 ? 2 : 4 };
  grid[r][c]   = tile;

  const cs = cellSize();
  const el = createTileEl(tile, r, c, cs, instant ? 'none' : 'new');
  if (instant) el.style.transition = 'none';
  tileLayer.appendChild(el);
  // Re-enable transition next frame so resize etc. works
  if (instant) requestAnimationFrame(() => { el.style.transition = ''; });
  return true;
}

// ── Core slide-row logic ──────────────────────────────────────────────────────
// row: array of SIZE items, each { id, value } | null
// Returns: { result (new row), slides (array of move descriptors) }
function slideRow(row) {
  // Collect non-null tiles with their original indices
  let tiles = [];
  for (let i = 0; i < SIZE; i++) {
    if (row[i]) tiles.push({ tile: row[i], from: i });
  }

  const result = Array(SIZE).fill(null);
  const slides = [];   // { id, from, to, consume } — describes DOM operations
  let ri = 0, i = 0;

  while (i < tiles.length) {
    const cur  = tiles[i];
    const nxt  = tiles[i + 1];

    if (nxt && cur.tile.value === nxt.tile.value) {
      // Merge: both source tiles slide to ri, then a new merged tile appears
      const merged = { id: nextId++, value: cur.tile.value * 2 };
      result[ri] = merged;

      slides.push({ id: cur.tile.id, from: cur.from, to: ri, consume: true });
      slides.push({ id: nxt.tile.id, from: nxt.from, to: ri, consume: true });
      slides.push({ id: merged.id,   from: ri,       to: ri, merged: true, value: merged.value });

      addScore(merged.value);
      i += 2;
    } else {
      // Plain slide
      result[ri] = cur.tile;
      slides.push({ id: cur.tile.id, from: cur.from, to: ri, consume: false });
      i++;
    }
    ri++;
  }

  return { result, slides };
}

// ── Move (all four directions) ────────────────────────────────────────────────
function move(dir) {
  if (moving) return;

  // dir: 0=left 1=right 2=up 3=down
  const horiz   = dir === 0 || dir === 1;
  const reverse = dir === 1 || dir === 3;

  let changed = false;
  // allOps: { id, fromR, fromC, toR, toC, consume, merged, value }
  const allOps = [];

  for (let line = 0; line < SIZE; line++) {
    // Extract row/column
    let row = [];
    for (let i = 0; i < SIZE; i++) {
      const [r, c] = horiz ? [line, i] : [i, line];
      row.push(grid[r][c]);
    }

    const origIds = row.map(t => t ? t.id : 0);
    if (reverse) row.reverse();

    const { result, slides } = slideRow(row);

    if (reverse) result.reverse();

    // Write result back to grid
    for (let i = 0; i < SIZE; i++) {
      const [r, c] = horiz ? [line, i] : [i, line];
      grid[r][c] = result[i];
    }

    // Check changed
    const newIds = result.map(t => t ? t.id : 0);
    if (newIds.join() !== origIds.join()) changed = true;

    // Map slide indices back to r,c (accounting for reverse)
    for (const s of slides) {
      const fi = reverse ? SIZE - 1 - s.from : s.from;
      const ti = reverse ? SIZE - 1 - s.to   : s.to;
      const [fromR, fromC] = horiz ? [line, fi] : [fi, line];
      const [toR,   toC  ] = horiz ? [line, ti] : [ti, line];
      allOps.push({ ...s, fromR, fromC, toR, toC });
    }
  }

  if (!changed) return;
  moving = true;

  const cs = cellSize();

  // ── Phase 1: animate slides ───────────────────────────────────────────────
  for (const op of allOps) {
    if (op.merged) continue;   // new tile, not in DOM yet
    const el = document.getElementById('tile-' + op.id);
    if (!el) continue;
    el.style.left = cellPos(op.toC) + 'px';
    el.style.top  = cellPos(op.toR) + 'px';
    el.style.zIndex = op.consume ? '1' : '2';
  }

  // ── Phase 2: after slide, swap merged tiles & spawn new ──────────────────
  setTimeout(() => {
    // Remove consumed tiles
    for (const op of allOps) {
      if (op.consume) {
        document.getElementById('tile-' + op.id)?.remove();
      }
    }

    // Insert merged tiles with pop animation
    for (const op of allOps) {
      if (op.merged) {
        const tile = grid[op.toR][op.toC];
        if (!tile) continue;
        const el = createTileEl(tile, op.toR, op.toC, cs, 'merge');
        tileLayer.appendChild(el);
      }
    }

    // Spawn new random tile
    spawnRandom(false);

    // Win / lose check
    checkEndConditions();

    moving = false;
  }, SLIDE_MS + 15);
}

// ── Win / lose ────────────────────────────────────────────────────────────────
function checkEndConditions() {
  if (!won || keepPlaying) {
    outer:
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] && grid[r][c].value === 2048 && !won) {
          won = true;
          if (!keepPlaying) { showOverlay('win'); return; }
          break outer;
        }
  }
  if (isGridFull()) { gameOver = true; showOverlay('over'); }
}

function isGridFull() {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (!grid[r][c]) return false;
      const v = grid[r][c].value;
      if (c < SIZE - 1 && grid[r][c + 1] && grid[r][c + 1].value === v) return false;
      if (r < SIZE - 1 && grid[r + 1][c] && grid[r + 1][c].value === v) return false;
    }
  return true;
}

function showOverlay(type) {
  if (type === 'win') {
    overlayH2.textContent  = '🌈 You Win!';
    overlayP.textContent   = 'You reached 2048!';
    overlayCTA.textContent = 'Keep Going';
    overlayCTA.onclick = () => { keepPlaying = true; overlay.classList.remove('show'); };
  } else {
    overlayH2.textContent  = 'Game Over';
    overlayP.textContent   = `Final score: ${score}`;
    overlayCTA.textContent = 'Try Again';
    overlayCTA.onclick     = newGame;
  }
  overlay.classList.add('show');
}

// ── Resize: reposition all tiles without animation ────────────────────────────
function repositionAll() {
  const cs = cellSize();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const tile = grid[r][c];
      if (!tile) continue;
      const el = document.getElementById('tile-' + tile.id);
      if (!el) continue;
      el.style.transition = 'none';
      el.style.left       = cellPos(c) + 'px';
      el.style.top        = cellPos(r) + 'px';
      el.style.width      = cs + 'px';
      el.style.height     = cs + 'px';
      el.style.fontSize   = fontSize(tile.value, cs) + 'px';
      requestAnimationFrame(() => { el.style.transition = ''; });
    }
  }
}

// ── Input: keyboard ───────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const map = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3 };
  if (map[e.key] !== undefined) { e.preventDefault(); move(map[e.key]); }
});

// ── Input: touch swipe ────────────────────────────────────────────────────────
let touchStartX = 0, touchStartY = 0;
const SWIPE_MIN = 30;

document.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 0 : 1);
  else                              move(dy < 0 ? 2 : 3);
}, { passive: true });

// ── Buttons ───────────────────────────────────────────────────────────────────
btnNew.addEventListener('click', newGame);

// ── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  bestEl.textContent = best;
  newGame();
});

window.addEventListener('resize', repositionAll);

// ── Toast helper ──────────────────────────────────────────────────────────────
function showToast(msg, color = '#a259ff') {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed', bottom: '32px', left: '50%',
    transform: 'translateX(-50%) translateY(20px)',
    background: color, color: '#fff',
    fontFamily: "'Exo 2', sans-serif", fontWeight: '700',
    fontSize: '0.85rem', letterSpacing: '0.5px',
    padding: '10px 22px', borderRadius: '999px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    opacity: '0', transition: 'opacity 0.25s, transform 0.25s',
    zIndex: '9999', whiteSpace: 'nowrap'
  });
  document.body.appendChild(t);
  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => t.remove(), 300);
  }, 2800);
}

// ── /bust command ─────────────────────────────────────────────────────────────
// On desktop: type /bust anywhere.
// On mobile: tap the score label 5 times quickly.
let bustBuffer = '';
document.addEventListener('keypress', e => {
  bustBuffer += e.key;
  if (bustBuffer.length > 5) bustBuffer = bustBuffer.slice(-5);
  if (bustBuffer.endsWith('/bust')) { bustBuffer = ''; bustCache(); }
});

// Mobile tap trigger: tap the SCORE label 5 times within 2 seconds
let tapCount = 0, tapTimer = null;
document.getElementById('score-box').addEventListener('pointerdown', () => {
  tapCount++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { tapCount = 0; }, 2000);
  if (tapCount >= 5) { tapCount = 0; clearTimeout(tapTimer); bustCache(); }
});

function bustCache() {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    showToast('⚠️ No service worker active', '#ff2d87');
    return;
  }
  showToast('🔄 Busting cache…', '#2979ff');
  navigator.serviceWorker.controller.postMessage({ type: 'BUST_CACHE' });
}

// Confirmation from service worker → reload
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'BUST_DONE') {
      showToast('✅ Cache cleared! Reloading…', '#00e676');
      setTimeout(() => location.reload(true), 1200);
    }
  });
}
