// test_diagnose_glitches.js
// Verification Suite: Glitch Interactivity & Touch-Isolation Regression

const { JSDOM } = require('jsdom');
const assert = require('assert');

// Setup JSDOM environment
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="container"></div><div id="toast-container"></div></body></html>`, {
  url: 'http://localhost:3000'
});

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.PointerEvent = dom.window.PointerEvent || dom.window.MouseEvent;
global.performance = { now: () => Date.now() };

// Mock canvas context
HTMLCanvasElement.prototype.getContext = function() {
  return {
    clearRect: () => {},
    fillRect: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    arc: () => {},
    stroke: () => {},
    fill: () => {},
    fillText: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
    setTransform: () => {},
    drawImage: () => {},
    roundRect: () => {},
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    font: '',
    shadowColor: '',
    shadowBlur: 0
  };
};

HTMLCanvasElement.prototype.getBoundingClientRect = function() {
  return {
    left: 100,
    top: 200,
    right: 500,
    bottom: 600,
    width: 400,
    height: 400,
    x: 100,
    y: 200
  };
};

async function runDiagnosis() {
  console.log('================================================================');
  console.log('GLITCH INTERACTIVITY VERIFICATION & REGRESSION SUITE');
  console.log('================================================================\n');

  // Dynamic import of client modules
  const { glitchManager } = await import('./public/js/glitch.js');
  const { GameScreenManager } = await import('./public/js/screens/game.js');
  const { TargetTapGame } = await import('./public/js/minigames/targetTap.js');
  const { TracePathGame } = await import('./public/js/minigames/tracePath.js');

  const container = document.getElementById('container');
  let glitchSentTarget = null;

  const gameScreen = new GameScreenManager(container, {
    onSendGlitch: (targetId) => {
      glitchSentTarget = targetId;
    },
    onSubmitScore: () => {}
  });

  gameScreen.setPlayerId('player-human');

  const GLITCH_EFFECTS = ['SCREEN_FLIP', 'JELLY_MODE', 'FOG_OF_WAR', 'INPUT_SWAP', 'SPEED_DEMON'];

  // =========================================================================
  // PART 1: TEST SABOTAGE BAR INTERACTIVITY UNDER EACH GLITCH EFFECT
  // =========================================================================
  console.log('----------------------------------------------------------------');
  console.log('PART 1: TESTING SABOTAGE BAR TAPPING UNDER EACH GLITCH EFFECT');
  console.log('----------------------------------------------------------------');

  const sabotageResults = {};

  for (const effect of GLITCH_EFFECTS) {
    glitchSentTarget = null;
    gameScreen.cleanupCurrentGame();
    gameScreen.glitchedTargetsThisRound.clear();

    // Start a round with 2 tokens and 1 bot opponent
    gameScreen.showRound({
      duration: 8000,
      isShowdown: false,
      players: [
        { id: 'player-human', name: 'Human', status: 'PLAYING', glitchTokens: 2, color: '#06F9EC' },
        { id: 'bot-1', name: '🤖 Blip', status: 'PLAYING', glitchTokens: 1, color: '#F43F7A' }
      ]
    }, 'targetTap', { totalTargets: 8 });

    // Bot attacks the human with this glitch effect:
    gameScreen.notifyGlitchIncoming(effect, '🤖 Blip', 0, false);
    gameScreen.updateActiveGlitches({ 'player-human': [effect] });

    const sabotageBar = container.querySelector('#sabotage-bar');
    const btn = sabotageBar.querySelector('.sabotage-avatar-btn');

    const isBarDisabled = sabotageBar.classList.contains('sabotage-bar-disabled');
    const isBtnDisabled = btn.disabled || btn.classList.contains('sabotage-target-disabled');

    // Simulate pointerup on avatar button (mobile touch tap release)
    const pointerUpEvt = new dom.window.CustomEvent('pointerup', { bubbles: true, cancelable: true });
    btn.dispatchEvent(pointerUpEvt);

    const attackFired = glitchSentTarget === 'bot-1';
    sabotageResults[effect] = { isBarDisabled, isBtnDisabled, attackFired };
    console.log(`[Effect: ${effect.padEnd(12)}] Sabotage Bar: BarDisabled=${isBarDisabled}, BtnDisabled=${isBtnDisabled}, AttackFired=${attackFired} -> ${attackFired ? '✓ FUNCTIONAL' : '❌ UNRESPONSIVE'}`);
    assert.strictEqual(attackFired, true, `Sabotage Bar should be tappable under ${effect}`);
  }

  // =========================================================================
  // PART 2: TEST MINIGAME CANVAS HIT REGISTRATION UNDER EACH GLITCH EFFECT
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('PART 2: TESTING MINIGAME CANVAS HIT REGISTRATION UNDER EACH GLITCH');
  console.log('----------------------------------------------------------------');

  const canvas = document.createElement('canvas');
  const targetConfig = {
    totalTargets: 8,
    targets: [
      { x: 0.25, y: 0.25, radius: 0.08, lifetimeMs: 8000, delayMs: 0 } // placed at internal (100, 100) on 400x400
    ]
  };

  const canvasResults = {};

  for (const effect of GLITCH_EFFECTS) {
    glitchManager.clearGlitches();
    glitchManager.addGlitch(effect);

    const game = new TargetTapGame(canvas, () => {});
    game.start(targetConfig);

    // Target is internally at (x: 100, y: 100).
    // Where does the player visually SEE the target on the screen?
    let visualX = 100;
    let visualY = 100;

    if (effect === 'SCREEN_FLIP') {
      // In CSS, transform: rotate(180deg) rotates the visual canvas by 180 degrees.
      // So target at (100, 100) visually appears at (400 - 100, 400 - 100) = (300, 300).
      visualX = 300;
      visualY = 300;
    } else if (effect === 'INPUT_SWAP') {
      // Input Swap is motor confusion: player taps the mirrored position (300, 100) to hit (100, 100)
      visualX = 300;
      visualY = 100;
    }

    // The player touches the screen directly at visual location:
    const touchEvent = {
      clientX: 100 + visualX,
      clientY: 200 + visualY,
      pointerId: 1
    };

    game.onCanvasPointerDown(touchEvent);

    const hitSuccess = (game.hits === 1);
    canvasResults[effect] = { visualX, visualY, hits: game.hits, misses: game.misses, hitSuccess };
    console.log(`[Effect: ${effect.padEnd(12)}] Canvas Hit-Test: VisualTap=(${visualX}, ${visualY}), Hits=${game.hits}, Misses=${game.misses} -> ${hitSuccess ? '✓ HIT REGISTERED' : '❌ FULL LOCKOUT (MISS)'}`);
    assert.strictEqual(hitSuccess, true, `Minigame canvas should register hit under ${effect}`);
    game.stop();
  }

  // =========================================================================
  // PART 3: TEST STACKED GLITCH COMBINATIONS
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('PART 3: TESTING STACKED GLITCH COMBINATIONS');
  console.log('----------------------------------------------------------------');

  {
    // 3A: SCREEN_FLIP + INPUT_SWAP
    glitchManager.clearGlitches();
    glitchManager.addGlitch('SCREEN_FLIP');
    glitchManager.addGlitch('INPUT_SWAP');

    const game = new TargetTapGame(canvas, () => {});
    game.start(targetConfig);

    // Target internally at (100, 100).
    // Screen is flipped 180 (visual Y = 300).
    // Input is swapped (player mirrors horizontal coordinate: visual X = 100 instead of 300).
    const visualX = 100;
    const visualY = 300;

    const touchEvent = {
      clientX: 100 + visualX,
      clientY: 200 + visualY,
      pointerId: 1
    };

    game.onCanvasPointerDown(touchEvent);
    console.log(`[Stacked: SCREEN_FLIP + INPUT_SWAP] Hits=${game.hits}, Misses=${game.misses} -> ${game.hits === 1 ? '✓ HIT REGISTERED' : '❌ FULL LOCKOUT (MISS)'}`);
    assert.strictEqual(game.hits, 1, 'Stacked SCREEN_FLIP + INPUT_SWAP should register hit with motor compensation');
    game.stop();
  }

  {
    // 3B: SCREEN_FLIP + FOG_OF_WAR (Verify flashlight coordinates)
    glitchManager.clearGlitches();
    glitchManager.addGlitch('SCREEN_FLIP');
    glitchManager.addGlitch('FOG_OF_WAR');

    // Player touches at visual (300, 300).
    // Flashlight internal coordinates must be (100, 100) so that after 180deg canvas rotation,
    // the beam appears visually at (300, 300) directly under player's touch!
    glitchManager.updateFogPointer(300, 300, 400, 400);
    const torchCorrect = (glitchManager.fogPointer.x === 100 && glitchManager.fogPointer.y === 100);
    console.log(`[Stacked: SCREEN_FLIP + FOG_OF_WAR] TouchVisual=(300, 300), InternalTorch=(${glitchManager.fogPointer.x}, ${glitchManager.fogPointer.y}) -> ${torchCorrect ? '✓ TORCH ALIGNED UNDER FINGER' : '❌ TORCH MISALIGNED'}`);
    assert.strictEqual(torchCorrect, true, 'Torchlight should align under finger during SCREEN_FLIP');
  }

  // =========================================================================
  // PART 4: TOUCH-ISOLATION REGRESSION CHECK (TracePath drag vs Sabotage Bar)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('PART 4: TOUCH-ISOLATION REGRESSION CHECK (TracePath Drag vs Sabotage)');
  console.log('----------------------------------------------------------------');

  {
    glitchSentTarget = null;
    gameScreen.cleanupCurrentGame();
    gameScreen.showRound({
      duration: 8000,
      isShowdown: false,
      players: [
        { id: 'player-human', name: 'Human', status: 'PLAYING', glitchTokens: 2, color: '#06F9EC' },
        { id: 'bot-1', name: '🤖 Blip', status: 'PLAYING', glitchTokens: 1, color: '#F43F7A' }
      ]
    }, 'tracePath', {
      waypoints: [
        { x: 0.5, y: 0.7 },
        { x: 0.5, y: 0.3 }
      ]
    });

    const sabotageBar = container.querySelector('#sabotage-bar');
    const avatarBtn = sabotageBar.querySelector('.sabotage-avatar-btn');
    const minigameCanvas = container.querySelector('#minigame-canvas');

    let sabotageTapsCount = 0;
    avatarBtn.addEventListener('pointerup', () => { sabotageTapsCount++; });
    avatarBtn.addEventListener('click', () => { sabotageTapsCount++; });

    // Simulate drag start on minigame canvas
    let pointerCaptured = false;
    minigameCanvas.setPointerCapture = () => { pointerCaptured = true; };
    minigameCanvas.releasePointerCapture = () => { pointerCaptured = false; };
    minigameCanvas.hasPointerCapture = () => pointerCaptured;

    const canvasPointerDown = new dom.window.CustomEvent('pointerdown', {
      bubbles: true,
      cancelable: true
    });
    canvasPointerDown.clientX = 300;
    canvasPointerDown.clientY = 480;
    canvasPointerDown.pointerId = 1;
    minigameCanvas.dispatchEvent(canvasPointerDown);

    assert.strictEqual(pointerCaptured, true, 'Canvas must capture pointer on drag start');

    // Simulate moving pointer upwards over Sabotage Bar button during drag
    const moveOverBar = new dom.window.CustomEvent('pointermove', { bubbles: true, cancelable: true });
    moveOverBar.clientX = 250;
    moveOverBar.clientY = 50; // Coordinates over Sabotage Bar
    moveOverBar.pointerId = 1;
    minigameCanvas.dispatchEvent(moveOverBar);

    // Release drag on minigame canvas
    const canvasPointerUp = new dom.window.CustomEvent('pointerup', { bubbles: true, cancelable: true });
    canvasPointerUp.clientX = 300;
    canvasPointerUp.clientY = 320;
    canvasPointerUp.pointerId = 1;
    minigameCanvas.dispatchEvent(canvasPointerUp);

    console.log(`Trace Drag Over Sabotage Bar: DragCompleted=true, SabotageFiredCount=${sabotageTapsCount}`);
    assert.strictEqual(sabotageTapsCount, 0, 'Canvas drag passing over Sabotage Bar must NEVER misfire sabotage');

    // Now test a direct, intentional tap on the Sabotage Bar avatar button:
    const deliberateTap = new dom.window.CustomEvent('pointerup', { bubbles: true, cancelable: true });
    avatarBtn.dispatchEvent(deliberateTap);

    console.log(`Deliberate Sabotage Bar Tap: AttackFiredTarget=${glitchSentTarget}`);
    assert.strictEqual(glitchSentTarget, 'bot-1', 'Deliberate tap on Sabotage Bar must cleanly fire attack');
    console.log('✓ PASS: Touch isolation verified — drag does not misfire sabotage, and deliberate tap works cleanly.');
  }

  console.log('\n================================================================');
  console.log('FINAL CONFIRMATION: ALL 5 GLITCH EFFECTS MAINTAIN FULL INTERACTIVITY');
  console.log('================================================================');
  for (const effect of GLITCH_EFFECTS) {
    console.log(`  ✓ ${effect.padEnd(14)}: Sabotage Bar = OPERATIONAL | Minigame Canvas = INTERACTIVE`);
  }
  console.log('  ✓ STACKED EFFECTS: SCREEN_FLIP + INPUT_SWAP = FULLY FUNCTIONAL');
  console.log('  ✓ STACKED EFFECTS: SCREEN_FLIP + FOG_OF_WAR  = ALIGNED & FUNCTIONAL');
  console.log('  ✓ TOUCH ISOLATION: Trace the Path drag vs Sabotage Bar tap = CLEANLY ISOLATED');
  console.log('================================================================\n');

  gameScreen.cleanupCurrentGame();
  process.exit(0);
}

runDiagnosis().catch(err => {
  console.error('DIAGNOSIS SUITE FAILED:', err);
  process.exit(1);
});
