// public/js/minigames/colorMatch.js
import { BaseMiniGame } from './base.js';
import { sound } from '../audio.js';

export class ColorMatchGame extends BaseMiniGame {
  initGame(config) {
    this.questions = config.questions || [];
    this.currentIndex = 0;
    this.correct = 0;
    this.wrong = 0;
    this.feedbackState = null; // 'correct' | 'wrong'
    this.feedbackTimer = 0;

    // Button colors definition
    this.buttonColors = [
      { name: 'RED', hex: '#F43F7A' },
      { name: 'BLUE', hex: '#3B82F6' },
      { name: 'GREEN', hex: '#10B981' },
      { name: 'YELLOW', hex: '#FBBF24' }
    ];

    this.buttons = [];
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

    const minDim = Math.min(this.width, this.height);

    ctx.save();

    // 1. Instruction prompt
    ctx.textAlign = 'center';
    ctx.font = '600 16px "Inter", sans-serif';
    ctx.fillStyle = '#7A7893';
    ctx.fillText('TAP THE INK COLOR (NOT THE WORD)', this.width / 2, this.height * 0.16);

    // 2. Big Stroop Word
    ctx.font = '700 52px "Space Grotesk", sans-serif';
    ctx.fillStyle = q.inkColorHex;
    ctx.shadowColor = q.inkColorHex;
    ctx.shadowBlur = 18;
    ctx.fillText(q.word, this.width / 2, this.height * 0.35);

    // Feedback pulse behind text
    if (this.feedbackState === 'correct') {
      ctx.beginPath();
      ctx.arc(this.width / 2, this.height * 0.32, 60, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6, 249, 236, 0.2)';
      ctx.fill();
    } else if (this.feedbackState === 'wrong') {
      ctx.beginPath();
      ctx.arc(this.width / 2, this.height * 0.32, 60, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244, 63, 122, 0.3)';
      ctx.fill();
    }

    // 3. Render 4 Color Buttons in 2x2 grid
    const btnWidth = Math.min(160, this.width * 0.42);
    const btnHeight = Math.min(68, this.height * 0.18);
    const gapX = 16;
    const gapY = 16;

    const startX = this.width / 2 - btnWidth - gapX / 2;
    const startY = this.height * 0.52;

    this.buttons = [];

    this.buttonColors.forEach((color, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const bx = startX + col * (btnWidth + gapX);
      const by = startY + row * (btnHeight + gapY);

      this.buttons.push({
        x: bx,
        y: by,
        w: btnWidth,
        h: btnHeight,
        color: color.name,
        hex: color.hex
      });

      // Draw glass button
      ctx.beginPath();
      ctx.roundRect(bx, by, btnWidth, btnHeight, 14);
      ctx.fillStyle = '#1E1B2E';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = color.hex;
      ctx.shadowColor = color.hex;
      ctx.shadowBlur = 8;
      ctx.stroke();

      // Button label
      ctx.font = '700 20px "Space Grotesk", sans-serif';
      ctx.fillStyle = color.hex;
      ctx.shadowBlur = 0;
      ctx.fillText(color.name, bx + btnWidth / 2, by + btnHeight / 2 + 7);
    });

    // Score ticker at bottom
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
        if (btn.color === q.correctColorName) {
          // Correct!
          this.correct++;
          this.feedbackState = 'correct';
          this.feedbackTimer = 0.2;
          sound.playScoreChime();
        } else {
          // Wrong!
          this.wrong++;
          this.feedbackState = 'wrong';
          this.feedbackTimer = 0.25;
          sound.playClick();
        }

        // Advance to next prompt
        this.currentIndex = (this.currentIndex + 1) % this.questions.length;

        if (this.onScoreUpdate) {
          const total = this.correct + this.wrong;
          const score = total > 0 ? Math.round((this.correct / total) * 100) : 0;
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
