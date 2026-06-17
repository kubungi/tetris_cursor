// 게임 보드 크기
const COLS = 10;
const ROWS = 20;
const DROP_INTERVAL_MS = 800;

const LINE_SCORES = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

const GAME_STATE = {
  IDLE: "idle",
  PLAYING: "playing",
  GAMEOVER: "gameover",
};

// DOM 요소
const boardElement = document.getElementById("game-board");
const scoreElement = document.getElementById("score");
const gameStatusElement = document.getElementById("game-status");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");

// 테트로미노 정의
const PIECES = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: "#00f0f0",
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "#f0f000",
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#a000f0",
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: "#00f000",
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: "#f00000",
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#0000f0",
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#f0a000",
  },
};

const PIECE_TYPES = Object.keys(PIECES);

// 고정된 블록만 저장 (0 = 빈 칸, 색상 문자열 = 고정 블록)
let board = createEmptyBoard();
let currentPiece = null;
let gameState = GAME_STATE.IDLE;
let dropTimerId = null;
let score = 0;

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function getRandomPieceType() {
  const index = Math.floor(Math.random() * PIECE_TYPES.length);
  return PIECE_TYPES[index];
}

function createPiece(type) {
  const pieceDef = PIECES[type];
  const shapeWidth = pieceDef.shape[0].length;

  return {
    type,
    shape: pieceDef.shape.map((row) => [...row]),
    color: pieceDef.color,
    row: 0,
    col: Math.floor((COLS - shapeWidth) / 2),
  };
}

function canMove(piece, dx, dy, matrix) {
  for (let row = 0; row < piece.shape.length; row++) {
    for (let col = 0; col < piece.shape[row].length; col++) {
      if (!piece.shape[row][col]) {
        continue;
      }

      const boardRow = piece.row + row + dy;
      const boardCol = piece.col + col + dx;

      if (
        boardCol < 0 ||
        boardCol >= COLS ||
        boardRow < 0 ||
        boardRow >= ROWS
      ) {
        return false;
      }

      if (matrix[boardRow][boardCol] !== 0) {
        return false;
      }
    }
  }

  return true;
}

function lockPiece() {
  if (!currentPiece) {
    return;
  }

  for (let row = 0; row < currentPiece.shape.length; row++) {
    for (let col = 0; col < currentPiece.shape[row].length; col++) {
      if (!currentPiece.shape[row][col]) {
        continue;
      }

      const boardRow = currentPiece.row + row;
      const boardCol = currentPiece.col + col;

      if (
        boardRow >= 0 &&
        boardRow < ROWS &&
        boardCol >= 0 &&
        boardCol < COLS
      ) {
        board[boardRow][boardCol] = currentPiece.color;
      }
    }
  }
}

function clearLines() {
  const remainingRows = board.filter((row) => !row.every((cell) => cell !== 0));
  const linesCleared = ROWS - remainingRows.length;

  while (remainingRows.length < ROWS) {
    remainingRows.unshift(Array(COLS).fill(0));
  }

  board = remainingRows;
  return linesCleared;
}

function addScore(linesCleared) {
  if (linesCleared <= 0) {
    return;
  }

  score += LINE_SCORES[linesCleared] || 0;
  scoreElement.textContent = String(score);
}

function updateScoreUI() {
  scoreElement.textContent = String(score);
}

function tryMovePiece(dx, dy) {
  if (!currentPiece || gameState !== GAME_STATE.PLAYING) {
    return false;
  }

  if (!canMove(currentPiece, dx, dy, board)) {
    return false;
  }

  currentPiece.row += dy;
  currentPiece.col += dx;
  renderBoard();
  return true;
}

function rotateMatrix(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      rotated[col][rows - 1 - row] = matrix[row][col];
    }
  }

  return rotated;
}

function tryRotatePiece() {
  if (!currentPiece || gameState !== GAME_STATE.PLAYING) {
    return false;
  }

  const originalShape = currentPiece.shape.map((row) => [...row]);
  currentPiece.shape = rotateMatrix(currentPiece.shape);

  if (!canMove(currentPiece, 0, 0, board)) {
    currentPiece.shape = originalShape;
    return false;
  }

  renderBoard();
  return true;
}

function softDrop() {
  tryMovePiece(0, 1);
}

function lockAndSpawnNext() {
  lockPiece();

  const linesCleared = clearLines();
  addScore(linesCleared);

  spawnNextPiece();
}

function hardDrop() {
  if (!currentPiece || gameState !== GAME_STATE.PLAYING) {
    return;
  }

  while (canMove(currentPiece, 0, 1, board)) {
    currentPiece.row += 1;
  }

  lockAndSpawnNext();
}

function dropPiece() {
  if (gameState !== GAME_STATE.PLAYING || !currentPiece) {
    return;
  }

  if (tryMovePiece(0, 1)) {
    return;
  }

  lockAndSpawnNext();
}

function spawnNextPiece() {
  currentPiece = createPiece(getRandomPieceType());
  renderBoard();

  if (!canMove(currentPiece, 0, 0, board)) {
    setGameOver();
  }
}

function drawPiece(displayBoard, piece) {
  const result = displayBoard.map((row) => [...row]);

  for (let row = 0; row < piece.shape.length; row++) {
    for (let col = 0; col < piece.shape[row].length; col++) {
      if (!piece.shape[row][col]) {
        continue;
      }

      const boardRow = piece.row + row;
      const boardCol = piece.col + col;

      if (
        boardRow >= 0 &&
        boardRow < ROWS &&
        boardCol >= 0 &&
        boardCol < COLS
      ) {
        result[boardRow][boardCol] = piece.color;
      }
    }
  }

  return result;
}

function renderBoard() {
  let displayBoard = board.map((row) => [...row]);

  if (currentPiece) {
    displayBoard = drawPiece(displayBoard, currentPiece);
  }

  boardElement.innerHTML = "";

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";

      const cellValue = displayBoard[row][col];
      if (cellValue !== 0) {
        cell.classList.add("filled");
        cell.style.backgroundColor = cellValue;
      }

      boardElement.appendChild(cell);
    }
  }
}

function spawnPiece() {
  currentPiece = createPiece(getRandomPieceType());
  renderBoard();
}

function stopDropTimer() {
  if (dropTimerId !== null) {
    clearInterval(dropTimerId);
    dropTimerId = null;
  }
}

function startDropTimer() {
  stopDropTimer();

  if (gameState !== GAME_STATE.PLAYING) {
    return;
  }

  dropTimerId = setInterval(dropPiece, DROP_INTERVAL_MS);
}

function updateButtons() {
  if (gameState === GAME_STATE.IDLE) {
    startBtn.disabled = false;
    restartBtn.disabled = false;
    restartBtn.textContent = "재시작";
    return;
  }

  startBtn.disabled = true;

  if (gameState === GAME_STATE.GAMEOVER) {
    restartBtn.textContent = "다시 하기";
  } else {
    restartBtn.textContent = "재시작";
  }
}

function updateStatusMessage() {
  if (gameState === GAME_STATE.IDLE) {
    gameStatusElement.textContent = "시작 버튼을 눌러주세요.";
    return;
  }

  if (gameState === GAME_STATE.GAMEOVER) {
    gameStatusElement.textContent = "게임 오버";
    return;
  }

  gameStatusElement.textContent = "";
}

function updateUI() {
  updateButtons();
  updateStatusMessage();
}

function resetGameData() {
  stopDropTimer();
  board = createEmptyBoard();
  score = 0;
  updateScoreUI();
  spawnPiece();
}

function enterIdleState() {
  resetGameData();
  gameState = GAME_STATE.IDLE;
  updateUI();
}

function startGame() {
  gameState = GAME_STATE.PLAYING;
  startDropTimer();
  updateUI();
}

function setGameOver() {
  stopDropTimer();
  gameState = GAME_STATE.GAMEOVER;
  updateUI();
}

function handleStart() {
  if (gameState !== GAME_STATE.IDLE) {
    return;
  }

  startGame();
}

function handleRestart() {
  resetGameData();
  startGame();
}

const GAME_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowDown",
  "ArrowUp",
  "Space",
]);

function handleKeyDown(event) {
  if (gameState !== GAME_STATE.PLAYING) {
    return;
  }

  if (!GAME_KEYS.has(event.code)) {
    return;
  }

  event.preventDefault();

  switch (event.code) {
    case "ArrowLeft":
      tryMovePiece(-1, 0);
      break;
    case "ArrowRight":
      tryMovePiece(1, 0);
      break;
    case "ArrowDown":
      softDrop();
      break;
    case "ArrowUp":
      tryRotatePiece();
      break;
    case "Space":
      hardDrop();
      break;
    default:
      break;
  }
}

function setupKeyboardControls() {
  document.addEventListener("keydown", handleKeyDown);
}

startBtn.addEventListener("click", handleStart);
restartBtn.addEventListener("click", handleRestart);
setupKeyboardControls();

// 페이지 로드 시 대기 상태로 미리보기 블록만 표시
enterIdleState();
