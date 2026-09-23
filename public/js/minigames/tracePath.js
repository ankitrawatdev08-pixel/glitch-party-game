// public/js/minigames/tracePath.js
import { BaseMiniGame } from './base.js';
import { sound } from '../audio.js';

export class TracePathGame extends BaseMiniGame {
  initGame(config) {
    this.waypoints = config.waypoints || [];
    this.previewDurationMs = config.previewDurationMs || 2000;
    this.elapsedMs = 0;
    this.state = 'PREVIEW'; // 'PREVIEW' | 'TRACING' | 'FINISHED'
    this.currentStep = 0;
    this.tappedPoints = [];
  }

  update(dt) {
    this.elapsedMs += dt * 1000;
    if (this.state === 'PREVIEW' && this.elapsedMs >= this.previewDurationMs) {
      this.state = 'TRACING';
    }
  }

  render(ctx) {
    ctx.save();

    // 1. Status prompt
    ctx.textAlign = 'center';
    ctx.font = '700 20px "Space Grotesk", sans-serif';

    if (this.state === 'PREVIEW') {
      ctx.fillStyle = '#FBBF24';
      const timeLeft = Math.max(0, ((this.previewDurationMs - this.elapsedMs) / 1000).toFixed(1));
      ctx.fillText(`MEMORIZE THE PATH! (${timeLeft}s)`, this.width / 2, this.height * 0.16);
    } else if (this.state === 'TRACING') {
      ctx.fillStyle = '#06F9EC';
      ctx.fillText(`TRACE THE WAYPOINTS (${this.currentStep}/${this.waypoints.length})`, this.width / 2, this.height * 0.16);
    } else {
      ctx.fillStyle = '#10B981';
      ctx.fillText('PATH COMPLETED! ✨', this.width / 2, this.height * 0.16);
    }

    // 2. Connecting Lines
    if (this.state === 'PREVIEW') {
      ctx.beginPath();
      this.waypoints.forEach((wp, idx) => {
        const x = wp.x * this.width;
        const y = wp.y * this.height;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#06F9EC';
      ctx.shadowColor = '#06F9EC';
      ctx.shadowBlur = 12;
      ctx.stroke();
    } else if (this.tappedPoints.length > 0) {
      // Draw already solved path segments
      ctx.beginPath();
      this.tappedPoints.forEach((idx, step) => {
        const wp = this.waypoints[idx];
        const x = wp.x * this.width;
        const y = wp.y * this.height;
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#10B981';
      ctx.shadowColor = '#10B981';
      ctx.shadowBlur = 10;
      ctx.stroke();
    }

    // 3. Render Waypoint Dots
    const baseRadius = Math.min(this.width, this.height) * 0.055;

    this.waypoints.forEach((wp, idx) => {
      const cx = wp.x * this.width;
      const cy = wp.y * this.height;
      const isAlreadyTapped = this.tappedPoints.includes(idx);
      const isNextTarget = this.state === 'TRACING' && idx === this.currentStep;

      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);

      if (isAlreadyTapped) {
        ctx.fillStyle = '#10B981';
        ctx.shadowColor = '#10B981';
        ctx.shadowBlur = 14;
      } else if (this.state === 'PREVIEW') {
        ctx.fillStyle = '#8B5CF6';
        ctx.shadowColor = '#8B5CF6';
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = '#1E1B2E';
        ctx.shadowBlur = 0;
      }

      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = isAlreadyTapped ? '#10B981' : '#06F9EC';
      ctx.stroke();

      // Number badge inside dot
      ctx.font = '700 16px "Space Grotesk", sans-serif';
      ctx.fillStyle = isAlreadyTapped ? '#07060E' : '#EDECF2';
      ctx.shadowBlur = 0;
      ctx.fillText(idx + 1, cx, cy + 6);
    });

    ctx.restore();
  }

  pointerDown(x, y) {
    if (this.state !== 'TRACING') return;

    const baseRadius = Math.min(this.width, this.height) * 0.055;
    const targetWp = this.waypoints[this.currentStep];
    if (!targetWp) return;

    const cx = targetWp.x * this.width;
    const cy = targetWp.y * this.height;
    const dist = Math.hypot(x - cx, y - cy);

    // Hit test with generous radius
    if (dist <= baseRadius * 1.5) {
      this.tappedPoints.push(this.currentStep);
      this.currentStep++;
      sound.playScoreChime();

      if (this.currentStep >= this.waypoints.length) {
        this.state = 'FINISHED';
      }

      if (this.onScoreUpdate) {
        const score = Math.round((this.currentStep / this.waypoints.length) * 100);
        this.onScoreUpdate(score);
      }
    } else {
      sound.playClick();
    }
  }

  pointerMove(x, y) {
    if (this.state !== 'TRACING') return;

    const baseRadius = Math.min(this.width, this.height) * 0.055;
    const targetWp = this.waypoints[this.currentStep];
    if (!targetWp) return;

    const cx = targetWp.x * this.width;
    const cy = targetWp.y * this.height;
    const dist = Math.hypot(x - cx, y - cy);

    // Hit test: smoothly advance if finger enters waypoint radius during drag
    if (dist <= baseRadius * 1.5) {
      this.tappedPoints.push(this.currentStep);
      this.currentStep++;
      sound.playScoreChime();

      if (this.currentStep >= this.waypoints.length) {
        this.state = 'FINISHED';
      }

      if (this.onScoreUpdate) {
        const score = Math.round((this.currentStep / this.waypoints.length) * 100);
        this.onScoreUpdate(score);
      }
    }
  }

  getRawData() {
    return {
      correctWaypoints: this.currentStep,
      totalWaypoints: this.waypoints.length
    };
  }
}
