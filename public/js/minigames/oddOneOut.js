// public/js/minigames/oddOneOut.js
import { BaseMiniGame } from './base.js';
import { sound } from '../audio.js';

export class OddOneOutGame extends BaseMiniGame {
  initGame(config) {
    this.puzzles = config.puzzles || [];
    this.currentIndex = 0;
    this.correct = 0;
    this.wrong = 0;
    this.cells = [];
  }

  update(dt) {}

  render(ctx) {
    const puzzle = this.puzzles[this.currentIndex];
    if (!puzzle) return;

    const minDim = Math.min(this.width, this.height);
    const boardSize = Math.min(minDim * 0.76, 360);
    const gridSize = puzzle.gridSize || 3;
    const cellSize = (boardSize - 16 * (gridSize - 1)) / gridSize;
    const startX = (this.width - boardSize) / 2;
    const startY = this.height * 0.28;

    this.cells = [];

    ctx.save();

    // 1. Title instruction
    ctx.textAlign = 'center';
    ctx.font = '600 16px "Inter", sans-serif';
    ctx.fillStyle = '#7A7893';
    ctx.fillText('FIND THE ODD ONE OUT!', this.width / 2, this.height * 0.16);

    // 2. Render shapes grid
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const idx = r * gridSize + c;
        const x = startX + c * (cellSize + 16);
        const y = startY + r * (cellSize + 16);
        const isOdd = idx === puzzle.oddIndex;

        this.cells.push({ idx, x, y, size: cellSize, isOdd });

        // Cell background
        ctx.beginPath();
        ctx.roundRect(x, y, cellSize, cellSize, 14);
        ctx.fillStyle = '#1E1B2E';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
        ctx.stroke();

        // Draw shape inside cell
        const centerX = x + cellSize / 2;
        const centerY = y + cellSize / 2;

        let shapeColor = puzzle.baseColor;
        let scale = 1.0;
        let rotation = 0;

        if (isOdd) {
          if (puzzle.diffType === 'color') {
            shapeColor = puzzle.oddColor;
          } else if (puzzle.diffType === 'size') {
            scale = 0.72; // noticeably smaller
          } else if (puzzle.diffType === 'rotation') {
            rotation = Math.PI / 4; // 45 degree tilt
          }
        }

        const baseRadius = (cellSize * 0.28) * scale;
        this.drawShape(ctx, puzzle.baseShape, centerX, centerY, baseRadius, shapeColor, rotation);
      }
    }

    // Score ticker
    ctx.font = '500 14px "Inter", sans-serif';
    ctx.fillStyle = '#EDECF2';
    ctx.fillText(`Puzzles Solved: ${this.correct} | Mistakes: ${this.wrong}`, this.width / 2, this.height * 0.94);

    ctx.restore();
  }

  drawShape(ctx, type, cx, cy, r, color, rotation) {
    ctx.save();
    ctx.translate(cx, cy);
    if (rotation) ctx.rotate(rotation);

    ctx.fillStyle = color;
    ctx.strokeStyle = '#06F9EC';
    ctx.lineWidth = 2;

    ctx.beginPath();
    if (type === 'circle') {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else if (type === 'square') {
      ctx.roundRect(-r, -r, r * 2, r * 2, 4);
    } else if (type === 'triangle') {
      ctx.moveTo(0, -r * 1.1);
      ctx.lineTo(r, r * 0.9);
      ctx.lineTo(-r, r * 0.9);
      ctx.closePath();
    } else if (type === 'diamond') {
      ctx.moveTo(0, -r * 1.2);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r * 1.2);
      ctx.lineTo(-r, 0);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  pointerDown(x, y) {
    const puzzle = this.puzzles[this.currentIndex];
    if (!puzzle) return;

    for (const cell of this.cells) {
      if (x >= cell.x && x <= cell.x + cell.size && y >= cell.y && y <= cell.y + cell.size) {
        if (cell.isOdd) {
          this.correct++;
          sound.playScoreChime();
        } else {
          this.wrong++;
          sound.playClick();
        }

        this.currentIndex = (this.currentIndex + 1) % this.puzzles.length;

        if (this.onScoreUpdate) {
          const total = Math.max(1, this.correct + this.wrong);
          const score = Math.round((this.correct / total) * 100);
          this.onScoreUpdate(score);
        }
        break;
      }
    }
  }

  getRawData() {
    return {
      correct: this.correct,
      wrong: this.wrong,
      total: this.correct + this.wrong
    };
  }
}
