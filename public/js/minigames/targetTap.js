// public/js/minigames/targetTap.js
import { BaseMiniGame } from './base.js';
import { sound } from '../audio.js';

export class TargetTapGame extends BaseMiniGame {
  initGame(config) {
    this.totalTargets = config.totalTargets || 8;
    this.targetQueue = (config.targets || []).map(t => ({
      ...t,
      spawned: false,
      hit: false,
      expired: false,
      age: 0,
      scale: 0
    }));

    this.activeTargets = [];
    this.particles = [];
    this.elapsedMs = 0;
    this.hits = 0;
    this.misses = 0;
  }

  update(dt) {
    this.elapsedMs += dt * 1000;

    // Check targets to spawn based on delayMs
    for (const t of this.targetQueue) {
      if (!t.spawned && this.elapsedMs >= t.delayMs) {
        t.spawned = true;
        this.activeTargets.push(t);
      }
    }

    // Update active targets
    for (let i = this.activeTargets.length - 1; i >= 0; i--) {
      const t = this.activeTargets[i];
      t.age += dt * 1000;

      // Scale in during first 150ms
      if (t.age < 150) {
        t.scale = t.age / 150;
      } else {
        t.scale = 1.0;
      }

      // Check expiration
      if (t.age >= t.lifetimeMs) {
        t.expired = true;
        this.misses++;
        this.activeTargets.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx) {
    const minDim = Math.min(this.width, this.height);

    // Draw active targets
    for (const t of this.activeTargets) {
      const cx = t.x * this.width;
      const cy = t.y * this.height;
      const baseR = minDim * t.radius;
      const r = baseR * Math.max(0.01, t.scale);

      ctx.save();
      // Outer pulse ring
      const pulseProgress = (t.age % 400) / 400;
      ctx.beginPath();
      ctx.arc(cx, cy, r + pulseProgress * 12, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(6, 249, 236, ${0.6 * (1 - pulseProgress)})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Outer glow disc
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#06F9EC';
      ctx.shadowColor = '#06F9EC';
      ctx.shadowBlur = 12;
      ctx.stroke();

      // Middle ring
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#F43F7A';
      ctx.stroke();

      // Center bullseye
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = '#FBBF24';
      ctx.shadowColor = '#FBBF24';
      ctx.shadowBlur = 8;
      ctx.fill();

      // Shrinking timer indicator along outer edge
      const timeLeftRatio = Math.max(0, 1 - (t.age / t.lifetimeMs));
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * timeLeftRatio);
      ctx.strokeStyle = timeLeftRatio > 0.3 ? '#06F9EC' : '#F43F7A';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.restore();
    }

    // Draw particles
    for (const p of this.particles) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * (p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();
    }
  }

  pointerDown(x, y) {
    const minDim = Math.min(this.width, this.height);
    let hitAny = false;

    for (let i = this.activeTargets.length - 1; i >= 0; i--) {
      const t = this.activeTargets[i];
      const cx = t.x * this.width;
      const cy = t.y * this.height;
      const r = minDim * t.radius;

      const dist = Math.hypot(x - cx, y - cy);
      // Generous hit tolerance for mobile touch
      if (dist <= r * 1.25) {
        hitAny = true;
        t.hit = true;
        this.hits++;
        sound.playScoreChime();

        // Spawn hit particle burst
        this.spawnBurst(cx, cy);

        this.activeTargets.splice(i, 1);
        break;
      }
    }

    if (!hitAny) {
      this.misses++;
      sound.playClick();
    }

    if (this.onScoreUpdate) {
      const currentScore = Math.round((this.hits / this.totalTargets) * 100);
      this.onScoreUpdate(currentScore);
    }
  }

  spawnBurst(x, y) {
    const colors = ['#06F9EC', '#F43F7A', '#FBBF24', '#8B5CF6'];
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.2;
      const speed = 120 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 4,
        life: 0.35 + Math.random() * 0.2,
        maxLife: 0.5,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  getRawData() {
    return {
      hits: this.hits,
      misses: this.misses,
      totalTargets: this.totalTargets
    };
  }
}
