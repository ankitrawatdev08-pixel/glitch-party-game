// public/js/minigames/sequenceMemory.js
import { BaseMiniGame } from './base.js';
import { sound } from '../audio.js';

export class SequenceMemoryGame extends BaseMiniGame {
  initGame(config) {
    this.gridSize = config.gridSize || 3;
    this.sequence = config.sequence || [0, 4, 8, 2];
    this.flashDuration = config.flashDuration || 400;
    this.gapDuration = config.gapDuration || 200;

    this.state = 'DEMO'; // 'DEMO' | 'INPUT' | 'FINISHED'
    this.demoStep = 0;
    this.demoTimer = 0;
    this.activeFlashCell = -1;

    this.playerStep = 0;
    this.correctCells = 0;
    this.tapFlashCell = -1;
    this.tapFlashTimer = 0;

    this.gridCells = [];
  }

  update(dt) {
    const dtMs = dt * 1000;

    if (this.tapFlashTimer > 0) {
      this.tapFlashTimer -= dtMs;
      if (this.tapFlashTimer <= 0) {
        this.tapFlashCell = -1;
      }
    }

    if (this.state === 'DEMO') {
      this.demoTimer += dtMs;
      const stepTotal = this.flashDuration + this.gapDuration;

      const currentStepIndex = Math.floor(this.demoTimer / stepTotal);
      const stepPhase = this.demoTimer % stepTotal;

      if (currentStepIndex < this.sequence.length) {
        if (stepPhase < this.flashDuration) {
          if (this.activeFlashCell !== this.sequence[currentStepIndex]) {
            this.activeFlashCell = this.sequence[currentStepIndex];
            sound.playTick();
          }
        } else {
          this.activeFlashCell = -1;
        }
      } else {
        // Demo complete, transition to player input
        this.state = 'INPUT';
        this.activeFlashCell = -1;
      }
    }
  }

  render(ctx) {
    const minDim = Math.min(this.width, this.height);
    const boardSize = Math.min(minDim * 0.76, 360);
    const cellSize = (boardSize - 16 * (this.gridSize - 1)) / this.gridSize;
    const startX = (this.width - boardSize) / 2;
    const startY = this.height * 0.28;

    this.gridCells = [];

    ctx.save();

    // 1. Status prompt
    ctx.textAlign = 'center';
    ctx.font = '700 20px "Space Grotesk", sans-serif';

    if (this.state === 'DEMO') {
      ctx.fillStyle = '#FBBF24';
      ctx.fillText('WATCH CAREFULLY...', this.width / 2, this.height * 0.16);
    } else if (this.state === 'INPUT') {
      ctx.fillStyle = '#06F9EC';
      ctx.fillText(`YOUR TURN! (${this.playerStep}/${this.sequence.length})`, this.width / 2, this.height * 0.16);
    } else {
      ctx.fillStyle = '#10B981';
      ctx.fillText('SEQUENCE COMPLETED! 🎉', this.width / 2, this.height * 0.16);
    }

    // 2. Grid Render
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const idx = r * this.gridSize + c;
        const x = startX + c * (cellSize + 16);
        const y = startY + r * (cellSize + 16);

        this.gridCells.push({ idx, x, y, size: cellSize });

        const isFlashing = this.activeFlashCell === idx || this.tapFlashCell === idx;

        ctx.beginPath();
        ctx.roundRect(x, y, cellSize, cellSize, 16);

        if (isFlashing) {
          ctx.fillStyle = '#06F9EC';
          ctx.shadowColor = '#06F9EC';
          ctx.shadowBlur = 24;
          ctx.fill();
        } else {
          ctx.fillStyle = '#1E1B2E';
          ctx.shadowBlur = 0;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
          ctx.stroke();
        }

        // Cell number hint
        ctx.font = '700 16px "Space Grotesk", sans-serif';
        ctx.fillStyle = isFlashing ? '#07060E' : 'rgba(237, 236, 242, 0.2)';
        ctx.fillText(idx + 1, x + cellSize / 2, y + cellSize / 2 + 6);
      }
    }

    ctx.restore();
  }

  pointerDown(x, y) {
    if (this.state !== 'INPUT') return;

    for (const cell of this.gridCells) {
      if (x >= cell.x && x <= cell.x + cell.size && y >= cell.y && y <= cell.y + cell.size) {
        this.tapFlashCell = cell.idx;
        this.tapFlashTimer = 180;

        const expectedCell = this.sequence[this.playerStep];

        if (cell.idx === expectedCell) {
          this.playerStep++;
          this.correctCells++;
          sound.playScoreChime();

          if (this.playerStep >= this.sequence.length) {
            this.state = 'FINISHED';
          }
        } else {
          // Miss
          sound.playClick();
          this.state = 'FINISHED';
        }

        if (this.onScoreUpdate) {
          const score = Math.round((this.correctCells / this.sequence.length) * 100);
          this.onScoreUpdate(score);
        }
        break;
      }
    }
  }

  getRawData() {
    return {
      correctCells: this.correctCells,
      totalCells: this.sequence.length,
      completed: this.state === 'FINISHED' && this.correctCells === this.sequence.length
    };
  }
}
