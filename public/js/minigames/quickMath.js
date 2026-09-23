// public/js/minigames/quickMath.js
import { BaseMiniGame } from './base.js';
import { sound } from '../audio.js';

export class QuickMathGame extends BaseMiniGame {
  initGame(config) {
    this.questions = config.questions || [];
    this.currentIndex = 0;
    this.correct = 0;
    this.wrong = 0;
    this.buttons = [];
    this.feedbackState = null;
    this.feedbackTimer = 0;
  }

  update(dt) {
    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) {
        this.feedbackState = null;
      }
    }
  }

  render(ctx) {
    const q = this.questions[this.currentIndex];
    if (!q) return;

    ctx.save();

    // 1. Title instruction
    ctx.textAlign = 'center';
    ctx.font = '600 16px "Inter", sans-serif';
    ctx.fillStyle = '#7A7893';
    ctx.fillText('SOLVE RAPIDLY!', this.width / 2, this.height * 0.16);

    // 2. Equation Display
    ctx.font = '700 52px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#EDECF2';
    ctx.shadowColor = '#8B5CF6';
    ctx.shadowBlur = 14;
    ctx.fillText(`${q.expr} = ?`, this.width / 2, this.height * 0.34);

    // 3. 4 Answer Options (2x2 grid)
    const btnWidth = Math.min(160, this.width * 0.42);
    const btnHeight = Math.min(68, this.height * 0.18);
    const gapX = 16;
    const gapY = 16;

    const startX = this.width / 2 - btnWidth - gapX / 2;
    const startY = this.height * 0.52;

    this.buttons = [];

    q.options.forEach((opt, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const bx = startX + col * (btnWidth + gapX);
      const by = startY + row * (btnHeight + gapY);

      this.buttons.push({
        x: bx,
        y: by,
        w: btnWidth,
        h: btnHeight,
        value: opt
      });

      // Glass button with neon outline
      ctx.beginPath();
      ctx.roundRect(bx, by, btnWidth, btnHeight, 14);
      ctx.fillStyle = '#1E1B2E';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#06F9EC';
      ctx.shadowColor = 'rgba(6, 249, 236, 0.4)';
      ctx.shadowBlur = 6;
      ctx.stroke();

      // Number text
      ctx.font = '700 28px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#06F9EC';
      ctx.shadowBlur = 0;
      ctx.fillText(opt, bx + btnWidth / 2, by + btnHeight / 2 + 9);
    });

    // Score status
    ctx.font = '500 14px "Inter", sans-serif';
    ctx.fillStyle = '#EDECF2';
    ctx.fillText(`Solved: ${this.correct} | Mistakes: ${this.wrong}`, this.width / 2, this.height * 0.94);

    ctx.restore();
  }

  pointerDown(x, y) {
    const q = this.questions[this.currentIndex];
    if (!q) return;

    for (const btn of this.buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        if (btn.value === q.answer) {
          this.correct++;
          this.feedbackState = 'correct';
          this.feedbackTimer = 0.18;
          sound.playScoreChime();
        } else {
          this.wrong++;
          this.feedbackState = 'wrong';
          this.feedbackTimer = 0.2;
          sound.playClick();
        }

        this.currentIndex = (this.currentIndex + 1) % this.questions.length;

        if (this.onScoreUpdate) {
          const total = this.correct + this.wrong;
          let score = total > 0 ? (this.correct / total) * 100 : 0;
          if (this.correct > 3) {
            score = Math.min(100, score + (this.correct - 3) * 5);
          }
          this.onScoreUpdate(Math.round(score));
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
