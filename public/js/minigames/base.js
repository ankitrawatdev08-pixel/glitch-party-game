// public/js/minigames/base.js
// Base class for Canvas minigames with glitch integration

import { glitchManager } from '../glitch.js';
import { sound } from '../audio.js';

export class BaseMiniGame {
  constructor(canvas, onScoreUpdate) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onScoreUpdate = onScoreUpdate; // callback to update local HUD score

    this.width = 0;
    this.height = 0;
    this.dpr = window.devicePixelRatio || 1;

    this.running = false;
    this.rafId = null;
    this.lastTime = 0;

    // Bind event handlers
    this.handleResize = this.resize.bind(this);
    this.handlePointerDown = this.onCanvasPointerDown.bind(this);
    this.handlePointerMove = this.onCanvasPointerMove.bind(this);
    this.handlePointerUp = this.onCanvasPointerUp.bind(this);

    this.resize();
    window.addEventListener('resize', this.handleResize);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.floor(rect.width);
    this.height = Math.floor(rect.height);

    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  start(config) {
    this.resize();
    this.running = true;
    this.lastTime = performance.now();

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);

    this.initGame(config);
    this.loop(performance.now());
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.cleanupGame();
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
  }

  loop(currentTime) {
    if (!this.running) return;

    const rawDt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    // Apply speed multiplier if SPEED_DEMON glitch is active
    const speed = glitchManager.getSpeedMultiplier();
    const dt = rawDt * speed;

    this.update(dt);

    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Render minigame specific elements
    this.render(this.ctx);

    // Render Fog of War overlay if active
    glitchManager.renderFog(this.ctx, this.width, this.height);

    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  onCanvasPointerDown(e) {
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    let rawX = e.clientX - rect.left;
    let rawY = e.clientY - rect.top;

    glitchManager.updateFogPointer(rawX, rawY, this.width, this.height);

    // Check INPUT_SWAP
    const { x, y } = glitchManager.modifyCoordinates(rawX, rawY, this.width, this.height);
    this.pointerDown(x, y, e);
  }

  onCanvasPointerMove(e) {
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    let rawX = e.clientX - rect.left;
    let rawY = e.clientY - rect.top;

    glitchManager.updateFogPointer(rawX, rawY, this.width, this.height);

    const { x, y } = glitchManager.modifyCoordinates(rawX, rawY, this.width, this.height);
    this.pointerMove(x, y, e);
  }

  onCanvasPointerUp(e) {
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    let rawX = e.clientX - rect.left;
    let rawY = e.clientY - rect.top;

    const { x, y } = glitchManager.modifyCoordinates(rawX, rawY, this.width, this.height);
    this.pointerUp(x, y, e);
  }

  // Lifecycle methods to override in subclasses
  initGame(config) {}
  cleanupGame() {}
  update(dt) {}
  render(ctx) {}
  pointerDown(x, y, e) {}
  pointerMove(x, y, e) {}
  pointerUp(x, y, e) {}
  getRawData() { return {}; }
}
