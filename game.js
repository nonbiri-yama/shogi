// --- 基本状態 ---------------------------------------------------------------
const boardEl = document.getElementById('board');
const kifuEl  = document.getElementById('kifuView');
const turnView = document.getElementById('turnView');
const modeView = document.getElementById('modeView');

const manualToggle = document.getElementById('manualToggle');
const editToggle   = document.getElementById('editToggle');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const resetBtn = document.getElementById('resetBtn');
const blackSideSel = document.getElementById('blackSide');
const whiteSideSel = document.getElementById('whiteSide');

const SIZE = 9;

// 盤面： [y][x] に {type:'FU', color:'black'|'white', promoted?:true} or null
let board = createEmptyBoard();

// 手番とモード
let currentPlayer = 'black'; // 'black' 先手, 'white' 後手
let mode = 'cpu';            // 'cpu' | 'manual'

// 棋譜履歴とやり直し用
const history = [];
const redoStack = [];

// UI選択状態
let selected = null;         // {x,y,piece}
let lastMove = null;         // {from,to}

// --- 初期化 ---------------------------------------------------------------
init();

function init() {
  buildBoardSquares();
  loadInitialPosition(); // 初期配置
  bindUI();
  renderAll();
  maybeLetCpuMove();
}

function bindUI() {
  manualToggle.addEventListener('change', () => {
    mode = manualToggle.checked ? 'manual' : 'cpu';
    reflectModeView();
    maybeLetCpuMove();
  });
  editToggle.addEventListener('change', () => {
    // 何もしなくてOK（判定側で参照）
  });
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  resetBtn.addEventListener('click', () => {
    loadInitialPosition();
    history.length = 0; redoStack.length = 0;
    currentPlayer = 'black'; selected = null; lastMove = null;
    renderAll();
  });

  blackSideSel.addEventListener('change', reflectModeView);
  whiteSideSel.addEventListener('change', reflectModeView);
}

function reflectModeView() {
  const manual = mode === 'manual';
  modeView.textContent = manual ? '手動モード' : 'CPUモード';
}

// --- 盤生成/描画 -----------------------------------------------------------
function buildBoardSquares() {
  boardEl.innerHTML = '';
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const sq = document.createElement('div');
      sq.className = 'square';
      sq.dataset.x = x; sq.dataset.y = y;
      sq.addEventListener('click', onSquareClick);
      boardEl.appendChild(sq);
    }
  }
}

function renderAll() {
  renderBoard();
  renderKifu();
  turnView.textContent = currentPlayer === 'black' ? '先手' : '後手';
}

function renderBoard() {
  // 盤
  for (const sq of boardEl.children) {
    sq.innerHTML = '';
    const x = +sq.dataset.x, y = +sq.dataset.y;
    const piece = board[y][x];

    // 最後の着手マーキング
    if (lastMove && lastMove.to.x === x && lastMove.to.y === y) {
      const m = document.createElement('div');
      m.className = 'mark-last'; sq.appendChild(m);
    }

    if (!piece) continue;
    const el = document.createElement('div');
    el.className = `piece ${piece.color}`;
    el.textContent = pieceLabel(piece);
    el.draggable = false;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onPieceClick(x, y, piece);
    });
    sq.appendChild(el);
  }

  // 選択表示
  if (selected) {
    const idx = selected.y * SIZE + selected.x;
    const sq = boardEl.children[idx];
    const mark = document.createElement('div');
    mark.className = 'mark-select';
    sq.appendChild(mark);
  }
}

function renderKifu() {
  kifuEl.innerHTML = '';
  history.forEach((m, i) => {
    const li = document.createElement('li');
    li.textContent = humanMove(m, i);
    kifuEl.appendChild(li);
  });
}

// --- 入力処理 --------------------------------------------------------------
function onPieceClick(x, y, piece) {
  // 編集モードは誰でも掴める
  if (editToggle.checked) {
    selected = { x, y, piece };
    renderAll();
    return;
  }

  // 手番の駒だけ選択（ここが「両軍を人が動かす」の肝）
  if (piece.color !== currentPlayer) return;

  selected = { x, y, piece };
  renderAll();
}

function onSquareClick(e) {
  const x = +e.currentTarget.dataset.x;
  const y = +e.currentTarget.dataset.y;

  // 編集モード：選択していた駒を強制移動（合法手無視）
  if (editToggle.checked) {
    if (!selected) return;
    forceMove(selected, { x, y });
    selected = null;
    renderAll();
    return;
  }

  if (!selected) {
    // 空マスクリック → 何もしない
    return;
  }

  const from = { x: selected.x, y: selected.y };
  const to = { x, y };
  const piece = selected.piece;

  if (!isLegalMoveWrapper(piece, from, to)) {
    // 不成・成りなど詳細ルールは各自の実装へ
    return;
  }

  // 合法 → 適用
  const capture = board[y][x] ? { ...board[y][x] } : null;
  const promote = shouldPromoteAutomatically(piece, from, to); // 簡易。必要に応じて置換

  applyMove({ from, to, piece: { ...piece }, capture, promote });
  selected = null;
  renderAll();
}

// --- 着手適用・巻き戻し ----------------------------------------------------
function applyMove(move) {
  makeBoardChange(move);
  history.push(move);
  redoStack.length = 0;

  lastMove = { from: move.from, to: move.to };

  // 手番交代
  currentPlayer = flip(currentPlayer);
  renderAll();

  maybeLetCpuMove(); // CPUモード時のみ動く
}

function makeBoardChange(move) {
  // 盤面を更新（ここでは単純に駒移動のみ。持ち駒などは任意拡張）
  const { from, to, piece, capture, promote } = move;

  // 移動元を空に
  board[from.y][from.x] = null;

  // 成り
  const nextPiece = { ...piece };
  if (promote) nextPiece.promoted = true;

  // 移動先に駒を置く（取りは上書き）
  board[to.y][to.x] = nextPiece;
}

function unmakeBoardChange(move) {
  const { from, to, piece, capture, promote } = move;

  // 移動先を元に戻す
  board[to.y][to.x] = capture ? { ...capture } : null;

  // 移動元に駒を戻す（成り解除）
  const back = { ...piece };
  if (promote) back.promoted = false;
  board[from.y][from.x] = back;
}

function undo() {
  if (!history.length) return;
  const last = history.pop();
  unmakeBoardChange(last);
  redoStack.push(last);
  lastMove = history.length ? { from: history.at(-1).from, to: history.at(-1).to } : null;
  currentPlayer = flip(currentPlayer);
  selected = null;
  renderAll();
}

function redo() {
  if (!redoStack.length) return;
  const m = redoStack.pop();
  makeBoardChange(m);
  history.push(m);
  lastMove = { from: m.from, to: m.to };
  currentPlayer = flip(currentPlayer);
  selected = null;
  renderAll();
}

// 編集モードの強制移動（棋譜には積まない）
function forceMove(sel, to) {
  const capture = board[to.y][to.x] ? { ...board[to.y][to.x] } : null;
  board[sel.y][sel.x] = null;
  board[to.y][to.x] = { ...sel.piece };
  lastMove = { from: { x: sel.x, y: sel.y }, to };
}

// --- CPU連携 ---------------------------------------------------------------
function maybeLetCpuMove() {
  if (mode === 'manual') return; // 何もしない
  const sideBlack = blackSideSel.value;
  const sideWhite = whiteSideSel.value;

  const who = currentPlayer === 'black' ? sideBlack : sideWhite;
  if (who !== 'cpu') return;

  // 非同期に一手指させる（簡易ランダム例。既存AIがあるなら置き換え）
  setTimeout(() => {
    const move = pickRandomLegalMove(currentPlayer);
    if (!move) return;
    applyMove(move);
  }, 250);
}

// --- 合法判定ラッパー ------------------------------------------------------
// 既存の isLegalMove(piece, from, to, board, currentPlayer) があれば使用。
// 無ければ非常に簡易な「自殺手以外OK」判定で代用（※実戦用ではありません）
function isLegalMoveWrapper(piece, from, to) {
  if (editToggle.checked) return true;
  if (typeof window.isLegalMove === 'function') {
    return window.isLegalMove(piece, from, to, board, currentPlayer);
  }
  // 暫定：自駒の上には行けない／同一マス禁止。駒種の動きは未チェック
  const dst = board[to.y][to.x];
  if (from.x === to.x && from.y === to.y) return false;
  if (dst && dst.color === piece.color) return false;
  return true;
}

// 成り自動判定（必要なら差し替え）
function shouldPromoteAutomatically(piece, from, to) {
  // 暫定：成りは自動では行わない
  return false;
}

// --- ユーティリティ --------------------------------------------------------
function flip(c) { return c === 'black' ? 'white' : 'black'; }

function humanMove(m, i) {
  // 盤座標を「９一～１九」風にしたければここで変換
  const s = `${i + 1}. ${labelPos(m.from)}→${labelPos(m.to)} ${m.piece ? pieceLabel(m.piece) : ''}${m.capture ? ' 取' : ''}${m.promote ? ' 成' : ''}`;
  return s.trim();
}
function labelPos(p) { return `${p.x + 1},${p.y + 1}`; } // 簡易。必要なら筋・段表記に
function pieceLabel(piece) {
  const map = { FU:'歩', KY:'香', KE:'桂', GI:'銀', KI:'金', KA:'角', HI:'飛', OU:'王' };
  const base = map[piece.type] || '？';
  return piece.promoted ? ('成' + base) : base;
}

function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));
}

// 初期配置（ベーシック）。詳細は必要に応じて調整
function loadInitialPosition() {
  board = createEmptyBoard();
  // 先手(black) 1段目
  put(0,8,'KY','black'); put(1,8,'KE','black'); put(2,8,'GI','black'); put(3,8,'KI','black'); put(4,8,'OU','black'); put(5,8,'KI','black'); put(6,8,'GI','black'); put(7,8,'KE','black'); put(8,8,'KY','black');
  // 2段目：角・飛
  put(1,7,'KA','black'); put(7,7,'HI','black');
  // 3段目：歩
  for (let x=0;x<9;x++) put(x,6,'FU','black');
  // 後手(white) 9段目
  put(0,0,'KY','white'); put(1,0,'KE','white'); put(2,0,'GI','white'); put(3,0,'KI','white'); put(4,0,'OU','white'); put(5,0,'KI','white'); put(6,0,'GI','white'); put(7,0,'KE','white'); put(8,0,'KY','white');
  // 8段目：角・飛
  put(7,1,'KA','white'); put(1,1,'HI','white');
  // 7段目：歩
  for (let x=0;x<9;x++) put(x,2,'FU','white');
}

function put(x,y,type,color) {
  board[y][x] = { type, color, promoted:false };
}

// 既存AIがあるならここを差し替え
function pickRandomLegalMove(color) {
  const moves = [];
  for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) {
    const p = board[y][x];
    if (!p || p.color !== color) continue;
    for (let ty=0;ty<SIZE;ty++) for (let tx=0;tx<SIZE;tx++) {
      if (x===tx && y===ty) continue;
      const from={x,y}, to={x:tx,y:ty};
      if (isLegalMoveWrapper(p, from, to)) {
        const capture = board[ty][tx] ? { ...board[ty][tx] } : null;
        moves.push({ from, to, piece:{...p}, capture, promote:false });
      }
    }
  }
  if (!moves.length) return null;
  return moves[Math.floor(Math.random()*moves.length)];
}

