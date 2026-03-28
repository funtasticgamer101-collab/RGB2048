'use strict';

// ── State ────────────────────────────────────────────────────────────────────
const SIZE = 4;
let grid = [];          // [row][col] = value or 0
let score = 0;
let best  = parseInt(localStorage.getItem('best2048') || '0');
let gameOver = false;
let won = false;
let keepPlaying = false;

// ── DOM refs ─────────────────────────────────────────────────────────────────
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

// ── Init ─────────────────────────────────────────────────────────────────────
function newGame() {
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  score = 0;
  gameOver = false;
  won = false;
  keepPlaying = false;
  overlay.classList.remove('show');
  updateScore(0);
  render();
  addRandom();
  addRandom();
  render();
}

function addRandom() {
  const empties = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!grid[r][c]) empties.push([r, c]);
  if (!empties.length) return false;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return [r, c];
}

// ── Render ───────────────────────────────────────────────────────────────────
function cellSize() {
  return (tileLayer.offsetWidth - (SIZE - 1) * 10) / SIZE;
}
function cellPos(idx) {
  return idx * (cellSize() + 10);
}

function render(newCells, mergedCells) {
  tileLayer.innerHTML = '';
  const cs = cellSize();

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (!v) continue;

      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.val = v;
      tile.style.width  = cs + 'px';
      tile.style.height = cs + 'px';
      tile.style.left   = cellPos(c) + 'px';
      tile.style.top    = cellPos(r) + 'px';

      // Font size based on digit length
      const digits = String(v).length;
      const fs = digits <= 2 ? cs * 0.38
               : digits === 3 ? cs * 0.28
               : digits === 4 ? cs * 0.22
               : cs * 0.17;
      tile.style.fontSize = fs + 'px';
      tile.textContent = v;

      // Classify for animation
      if (newCells && newCells.some(([nr, nc]) => nr === r && nc === c))
        tile.classList.add('new');
      if (mergedCells && mergedCells.some(([mr, mc]) => mr === r && mc === c))
        tile.classList.add('merge');

      tileLayer.appendChild(tile);
    }
  }
}

// ── Score ────────────────────────────────────────────────────────────────────
function updateScore(delta) {
  score += delta;
  scoreEl.textContent = score;
  if (score > best) {
    best = score;
    localStorage.setItem('best2048', best);
  }
  bestEl.textContent = best;

  // Pop animation
  const box = document.getElementById('score-box');
  box.classList.remove('pop');
  void box.offsetWidth; // reflow
  box.classList.add('pop');
}

// ── Move logic ───────────────────────────────────────────────────────────────
function slide(row) {
  // Compress
  let arr = row.filter(x => x);
  const merged = [];
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2;
      merged.push(arr[i]);
      updateScore(arr[i]);
      arr.splice(i + 1, 1);
    }
  }
  while (arr.length < SIZE) arr.push(0);
  return { row: arr, merged };
}

function rotateGrid(g) {
  // 90° clockwise
  return Array.from({ length: SIZE }, (_, r) =>
    Array.from({ length: SIZE }, (_, c) => g[SIZE - 1 - c][r])
  );
}

function move(dir) {
  // dir: 0=left 1=right 2=up 3=down
  let rotations = 0;
  if (dir === 1) rotations = 2;
  if (dir === 2) rotations = 3;
  if (dir === 3) rotations = 1;

  let g = grid;
  for (let i = 0; i < rotations; i++) g = rotateGrid(g);

  let changed = false;
  const mergedCells = [];
  const newGrid = g.map((row, r) => {
    const { row: slid } = slide(row);
    if (slid.join(',') !== row.join(',')) changed = true;
    return slid;
  });

  if (!changed) return;

  // Un-rotate
  let resultGrid = newGrid;
  for (let i = 0; i < (4 - rotations) % 4; i++) resultGrid = rotateGrid(resultGrid);
  grid = resultGrid;

  const newCell = addRandom();
  render(newCell ? [newCell] : [], []);

  // Win / lose checks
  if (!won || !keepPlaying) {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] === 2048 && !won) {
          won = true;
          if (!keepPlaying) { showOverlay('win'); return; }
        }
  }

  if (isGameOver()) {
    gameOver = true;
    showOverlay('over');
  }
}

function isGameOver() {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (!grid[r][c]) return false;
      if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return false;
      if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return false;
    }
  return true;
}

function showOverlay(type) {
  if (type === 'win') {
    overlayH2.textContent = '🌈 You Win!';
    overlayP.textContent  = 'You reached 2048!';
    overlayCTA.textContent = 'Keep Going';
    overlayCTA.onclick = () => {
      keepPlaying = true;
      overlay.classList.remove('show');
    };
  } else {
    overlayH2.textContent = 'Game Over';
    overlayP.textContent  = `Final score: ${score}`;
    overlayCTA.textContent = 'Try Again';
    overlayCTA.onclick = newGame;
  }
  overlay.classList.add('show');
}

// ── Input: keyboard ───────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (gameOver && !overlay.classList.contains('show')) return;
  const map = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3 };
  if (map[e.key] !== undefined) {
    e.preventDefault();
    move(map[e.key]);
  }
});

// ── Input: touch swipe ────────────────────────────────────────────────────────
let touchStartX = 0, touchStartY = 0;
const SWIPE_MIN = 30;

boardEl.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

boardEl.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 0 : 1);
  else                             move(dy < 0 ? 2 : 3);
}, { passive: true });

// ── Button ────────────────────────────────────────────────────────────────────
btnNew.addEventListener('click', newGame);

// ── Start ─────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  bestEl.textContent = best;
  newGame();
});

// Re-render on resize (tile positions are pixel-based)
window.addEventListener('resize', () => render([], []));
