const board = document.getElementById('board');
let cells = Array(9).fill(null);
let turn = 'player'; // 'player', 'enemy', or 'animating'

// 初期配置
cells[6] = 'P';
cells[7] = 'P';
cells[8] = 'P';
cells[0] = 'E';
cells[1] = 'E';
cells[2] = 'E';

function render() {
  board.innerHTML = '';
  cells.forEach((piece, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';

    if (piece === 'P' || piece === 'E') {
      const koma = document.createElement('div');
      koma.className = 'koma';
      koma.textContent = '歩';
      if (piece === 'P') cell.classList.add('player');
      else cell.classList.add('enemy');
      cell.appendChild(koma);
    }

    cell.onclick = () => handleClick(i);
    board.appendChild(cell);
  });
}

function handleClick(i) {
  if (turn !== 'player' || cells[i] !== 'P') return;

  const target = i - 3;
  if (target >= 0 && (!cells[target] || cells[target] === 'E')) {
    turn = 'animating';
    animateMove(i, target, 'P', () => {
      cells[i] = null;
      cells[target] = 'P';
      checkWin();
      turn = 'enemy';
      setTimeout(enemyMove, 100);
    });
  }
}

function enemyMove() {
  for (let i = 0; i < 6; i++) {
    if (cells[i] === 'E' && (!cells[i + 3] || cells[i + 3] === 'P')) {
      const from = i;
      const to = i + 3;
      turn = 'animating';
      animateMove(from, to, 'E', () => {
        cells[from] = null;
        cells[to] = 'E';
        checkWin();
        turn = 'player';
      });
      return;
    }
  }
  turn = 'player';
  render();
}

function animateMove(from, to, piece, callback) {
  const fromCell = board.children[from];
  const toCell = board.children[to];

  fromCell.innerHTML = ''; // 元のマスを即座に消す

  // ラッパー（.cell）を作成
  const wrapper = document.createElement('div');
  wrapper.className = 'cell';
  wrapper.style.position = 'absolute';
  wrapper.style.zIndex = '10';
  wrapper.style.transition = 'all 0.5s ease';

  // 駒（.koma）を作成
  const koma = document.createElement('div');
  koma.className = 'koma';
  koma.textContent = '歩';

  // 向きのクラスをラッパーに付与
  if (piece === 'P') wrapper.classList.add('player');
  else wrapper.classList.add('enemy');

  wrapper.appendChild(koma);

  const boardRect = board.getBoundingClientRect();
  const fromRect = fromCell.getBoundingClientRect();
  const toRect = toCell.getBoundingClientRect();

  wrapper.style.left = `${fromRect.left - boardRect.left}px`;
  wrapper.style.top = `${fromRect.top - boardRect.top}px`;
  board.appendChild(wrapper);

  requestAnimationFrame(() => {
    wrapper.style.left = `${toRect.left - boardRect.left}px`;
    wrapper.style.top = `${toRect.top - boardRect.top}px`;
  });

  setTimeout(() => {
    board.removeChild(wrapper);
    callback();
    render();
  }, 500);
}

function checkWin() {
  const playerLeft = cells.filter(c => c === 'P').length;
  const enemyLeft = cells.filter(c => c === 'E').length;
  if (playerLeft === 0) alert('敵の勝ち');
  if (enemyLeft === 0) alert('あなたの勝ち');
}

render();

