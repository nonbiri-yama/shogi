const board = document.getElementById('board');
let cells = Array(25).fill(null); // ← 9 → 25 に変更
let turn = 'player';

// 初期配置
// プレイヤー（下段）
cells[20] = 'P';
cells[21] = 'P';
cells[22] = 'P';
cells[23] = 'P';
cells[24] = 'P';

// 敵（上段）
cells[0] = 'E';
cells[1] = 'E';
cells[2] = 'E';
cells[3] = 'E';
cells[4] = 'E';

function render() {
  board.innerHTML = '';
  cells.forEach((piece, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';

    if (i === selectedIndex) {
      cell.classList.add('selected');
    }

    if (piece === 'P') {
      cell.appendChild(createKomaSVG('歩', 'player'));
    } else if (piece === 'E') {
      cell.appendChild(createKomaSVG('歩', 'enemy'));
    }

    // 移動可能マスに赤丸表示
    if (selectedIndex !== null && isValidMove(selectedIndex, i)) {
      cell.appendChild(createHintSVG());
    }

    cell.onclick = () => handleClick(i);
    board.appendChild(cell);
  });
}

function createKomaSVG(text, role) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.classList.add("koma-svg");
  svg.classList.add(role); // 'player' or 'enemy'

  const polygon = document.createElementNS(svgNS, "polygon");
  polygon.setAttribute("points", "50,5 95,25 95,95 5,95 5,25");
  polygon.setAttribute("fill", "#f5deb3");
  polygon.setAttribute("stroke", "#333");
  polygon.setAttribute("stroke-width", "4");

  const label = document.createElementNS(svgNS, "text");
  label.setAttribute("x", "50");
  label.setAttribute("y", "65");
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("font-size", "32");
  label.setAttribute("font-weight", "bold");
  label.setAttribute("fill", "#000");
  label.textContent = text;

  svg.appendChild(polygon);
  svg.appendChild(label);
  return svg;
}

function createHintSVG() {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.classList.add("hint-svg");

  const circle = document.createElementNS(svgNS, "circle");
  circle.setAttribute("cx", "50");
  circle.setAttribute("cy", "50");
  circle.setAttribute("r", "15");
  circle.setAttribute("fill", "red");
  circle.setAttribute("opacity", "0.6");

  svg.appendChild(circle);
  return svg;
}

let selectedIndex = null;

function handleClick(i) {
  if (turn !== 'player') return;

  if (selectedIndex === null) {
    if (cells[i] === 'P') {
      selectedIndex = i;
      render();
    }
  } else {
    const from = selectedIndex;
    const to = i;

    if (isValidMove(from, to)) {
      turn = 'animating';
      animateMove(from, to, 'P', () => {
        cells[from] = null;
        cells[to] = 'P';
        selectedIndex = null;
        checkWin();
        turn = 'enemy';
        setTimeout(enemyMove, 100);
      });
    } else {
      selectedIndex = null;
      render();
    }
  }
}

function isValidMove(from, to) {
  return to === from - 5 && (!cells[to] || cells[to] === 'E');
}

function enemyMove() {
  for (let i = 0; i < 6; i++) {
    if (cells[i] === 'E' && (!cells[i + 5] || cells[i + 5] === 'P')) {
      const from = i;
      const to = i + 5;
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

  const svg = createKomaSVG('歩', piece === 'P' ? 'player' : 'enemy');
  svg.style.position = 'absolute';
  svg.style.zIndex = '10';
  svg.style.transition = 'all 0.5s ease';

  const boardRect = board.getBoundingClientRect();
  const fromRect = fromCell.getBoundingClientRect();
  const toRect = toCell.getBoundingClientRect();

  svg.style.left = `${fromCell.offsetLeft}px`;
  svg.style.top  = `${fromCell.offsetTop}px`;

  board.appendChild(svg);

  requestAnimationFrame(() => {
    svg.style.left = `${toCell.offsetLeft}px`;
    svg.style.top  = `${toCell.offsetTop}px`;
  });

  setTimeout(() => {
    board.removeChild(svg);
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

