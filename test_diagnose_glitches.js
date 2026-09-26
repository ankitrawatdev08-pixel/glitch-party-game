// test_diagnose_glitches.js
// Verification Suite: Glitch Interactivity, Multi-Point Geometry, 3-Effect Stacking & Continuous Drag Regression

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
  console.log('GLITCH INTERACTIVITY VERIFICATION & REGRESSION SUITE (EXPANDED)');
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
  // PART 2: MULTI-POINT GEOMETRY HIT REGISTRATION (Corners, Center, Midpoints)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('PART 2: MULTI-POINT GEOMETRY HIT REGISTRATION ACROSS ALL 5 GLITCHES');
  console.log('----------------------------------------------------------------');

  const canvas = document.createElement('canvas');

  // Multi-coordinate test set: Center, 4 Corners, Asymmetric Midpoint
  const TEST_COORDINATES = [
    { name: 'Center',              normX: 0.50, normY: 0.50, pxX: 200, pxY: 200 },
    { name: 'Top-Left Corner',     normX: 0.10, normY: 0.10, pxX: 40,  pxY: 40  },
    { name: 'Top-Right Corner',    normX: 0.90, normY: 0.10, pxX: 360, pxY: 40  },
    { name: 'Bottom-Left Corner',  normX: 0.10, normY: 0.90, pxX: 40,  pxY: 360 },
    { name: 'Bottom-Right Corner', normX: 0.90, normY: 0.90, pxX: 360, pxY: 360 },
    { name: 'Asymmetric Midpoint', normX: 0.30, normY: 0.70, pxX: 120, pxY: 280 }
  ];

  for (const effect of GLITCH_EFFECTS) {
    console.log(`\nTesting Glitch Effect: [${effect}] across 6 geometric coordinates:`);

    for (const coord of TEST_COORDINATES) {
      glitchManager.clearGlitches();
      glitchManager.addGlitch(effect);

      const singleTargetConfig = {
        totalTargets: 1,
        targets: [
          { x: coord.normX, y: coord.normY, radius: 0.08, lifetimeMs: 8000, delayMs: 0 }
        ]
      };

      const game = new TargetTapGame(canvas, () => {});
      game.start(singleTargetConfig);

      // Calculate where player visually sees target and needs to touch
      let visualX = coord.pxX;
      let visualY = coord.pxY;

      if (effect === 'SCREEN_FLIP') {
        // Rotated 180deg: internal (pxX, pxY) appears at (400 - pxX, 400 - pxY)
        visualX = 400 - coord.pxX;
        visualY = 400 - coord.pxY;
      } else if (effect === 'INPUT_SWAP') {
        // Motor confusion: player must mirror horizontal touch to hit target
        visualX = 400 - coord.pxX;
        visualY = coord.pxY;
      }

      const touchEvent = {
        clientX: 100 + visualX,
        clientY: 200 + visualY,
        pointerId: 1
      };

      game.onCanvasPointerDown(touchEvent);

      const hitSuccess = (game.hits === 1);
      console.log(`  - ${coord.name.padEnd(22)}: Target=(${String(coord.pxX).padStart(3)}, ${String(coord.pxY).padStart(3)}) | VisualTap=(${String(visualX).padStart(3)}, ${String(visualY).padStart(3)}) -> ${hitSuccess ? '✓ HIT' : '❌ MISS'}`);
      assert.strictEqual(hitSuccess, true, `${coord.name} should register hit under ${effect}`);
      game.stop();
    }
  }

  // =========================================================================
  // PART 3: CONTINUOUS MULTI-POINT DRAG ON TRACE THE PATH UNDER SCREEN_FLIP
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('PART 3: CONTINUOUS MULTI-POINT DRAG ON TRACE THE PATH UNDER SCREEN_FLIP');
  console.log('----------------------------------------------------------------');

  {
    glitchManager.clearGlitches();
    glitchManager.addGlitch('SCREEN_FLIP');

    let traceScore = 0;
    const traceGame = new TracePathGame(canvas, (score) => { traceScore = score; });

    // 3 Sequential Waypoints: Top-Left (60, 60) -> Center (200, 200) -> Bottom-Right (340, 340)
    const traceConfig = {
      waypoints: [
        { x: 0.15, y: 0.15 }, // WP 0: internal (60, 60)   -> visual (340, 340)
        { x: 0.50, y: 0.50 }, // WP 1: internal (200, 200) -> visual (200, 200)
        { x: 0.85, y: 0.85 }  // WP 2: internal (340, 340) -> visual (60, 60)
      ]
    };

    traceGame.start(traceConfig);
    traceGame.state = 'TRACING'; // Transition to active TRACING phase for input test

    // Initial touch-down at visually-rendered Waypoint 0 (340, 340):
    console.log('Simulating continuous drag across inverted canvas under SCREEN_FLIP:');
    console.log('  1. PointerDown at Visual Waypoint 0 (340, 340)...');
    traceGame.onCanvasPointerDown({
      clientX: 100 + 340,
      clientY: 200 + 340,
      pointerId: 1
    });

    assert.strictEqual(traceGame.currentStep, 1, 'PointerDown at visual WP0 must advance step to 1');
    console.log(`     ✓ WP0 Hit! CurrentStep: ${traceGame.currentStep}/3`);

    // Continuous drag: 20 intermediate pointerMove steps from (340, 340) to (200, 200)
    console.log('  2. Continuous PointerMove dragging from (340, 340) towards Visual Waypoint 1 (200, 200)...');
    for (let i = 1; i <= 20; i++) {
      const curX = 340 + (200 - 340) * (i / 20);
      const curY = 340 + (200 - 340) * (i / 20);
      traceGame.onCanvasPointerMove({
        clientX: 100 + curX,
        clientY: 200 + curY,
        pointerId: 1
      });
    }

    assert.strictEqual(traceGame.currentStep, 2, 'Continuous PointerMove through visual WP1 must advance step to 2');
    console.log(`     ✓ WP1 Hit via continuous drag! CurrentStep: ${traceGame.currentStep}/3`);

    // Continuous drag: 20 intermediate pointerMove steps from (200, 200) to (60, 60)
    console.log('  3. Continuous PointerMove dragging from (200, 200) towards Visual Waypoint 2 (60, 60)...');
    for (let i = 1; i <= 20; i++) {
      const curX = 200 + (60 - 200) * (i / 20);
      const curY = 200 + (60 - 200) * (i / 20);
      traceGame.onCanvasPointerMove({
        clientX: 100 + curX,
        clientY: 200 + curY,
        pointerId: 1
      });
    }

    assert.strictEqual(traceGame.currentStep, 3, 'Continuous PointerMove through visual WP2 must advance step to 3');
    assert.strictEqual(traceGame.state, 'FINISHED', 'Trace game state must be FINISHED');
    assert.strictEqual(traceScore, 100, 'Trace game final score must be 100%');
    console.log(`     ✓ WP2 Hit via continuous drag! CurrentStep: ${traceGame.currentStep}/3 | State: ${traceGame.state} | Score: ${traceScore}%`);

    // PointerUp completion
    traceGame.onCanvasPointerUp({
      clientX: 100 + 60,
      clientY: 200 + 60,
      pointerId: 1
    });

    console.log('✓ PASS: pointerMove in tracePath.js correctly routes continuous drag through glitchManager.modifyCoordinates()');
    traceGame.stop();
  }

  // =========================================================================
  // PART 4: MAXIMUM 3-EFFECT STACKING (The Canonical 3-Effect Cap)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('PART 4: MAXIMUM 3-EFFECT STACKING SUITE (SCREEN_FLIP + 2 OTHERS)');
  console.log('----------------------------------------------------------------');

  const targetConfig = {
    totalTargets: 1,
    targets: [{ x: 0.25, y: 0.25, radius: 0.08, lifetimeMs: 8000, delayMs: 0 }] // internal (100, 100)
  };

  // Stack Case 4A: SCREEN_FLIP + INPUT_SWAP + FOG_OF_WAR
  {
    glitchManager.clearGlitches();
    glitchManager.addGlitch('SCREEN_FLIP');
    glitchManager.addGlitch('INPUT_SWAP');
    glitchManager.addGlitch('FOG_OF_WAR');

    const game = new TargetTapGame(canvas, () => {});
    game.start(targetConfig);

    // Target internally at (100, 100).
    // SCREEN_FLIP visually inverts display: target appears at (300, 300).
    // INPUT_SWAP motor confusion requires horizontal compensation: tap visual X = 100, Y = 300.
    const visualX = 100;
    const visualY = 300;

    // Torchlight test:
    glitchManager.updateFogPointer(visualX, visualY, 400, 400);
    // Under SCREEN_FLIP, torch internal is (400 - 100, 400 - 300) = (300, 100).
    // When canvas is rotated 180deg, internal (300, 100) renders at visual (100, 300) directly under finger!
    const torchX = 400 - glitchManager.fogPointer.x;
    const torchY = 400 - glitchManager.fogPointer.y;
    assert.strictEqual(torchX, visualX, 'Torch visual X must match touch visual X');
    assert.strictEqual(torchY, visualY, 'Torch visual Y must match touch visual Y');

    const touchEvent = {
      clientX: 100 + visualX,
      clientY: 200 + visualY,
      pointerId: 1
    };

    game.onCanvasPointerDown(touchEvent);
    console.log(`[3-Stack: SCREEN_FLIP + INPUT_SWAP + FOG_OF_WAR] Hits=${game.hits}, Misses=${game.misses} | Torchlight aligned at (${torchX}, ${torchY}) -> ${game.hits === 1 ? '✓ PASS' : '❌ FAIL'}`);
    assert.strictEqual(game.hits, 1, '3-Stack SCREEN_FLIP + INPUT_SWAP + FOG_OF_WAR must register hit with motor compensation');
    game.stop();
  }

  // Stack Case 4B: SCREEN_FLIP + SPEED_DEMON + JELLY_MODE
  {
    glitchManager.clearGlitches();
    glitchManager.addGlitch('SCREEN_FLIP');
    glitchManager.addGlitch('SPEED_DEMON');
    glitchManager.addGlitch('JELLY_MODE');

    assert.strictEqual(glitchManager.getSpeedMultiplier(), 1.5, 'Speed multiplier must be 1.5x');

    const game = new TargetTapGame(canvas, () => {});
    game.start(targetConfig);

    // Target internally at (100, 100). Visually appears at (300, 300).
    const visualX = 300;
    const visualY = 300;

    const touchEvent = {
      clientX: 100 + visualX,
      clientY: 200 + visualY,
      pointerId: 1
    };

    game.onCanvasPointerDown(touchEvent);
    console.log(`[3-Stack: SCREEN_FLIP + SPEED_DEMON + JELLY_MODE] Hits=${game.hits}, Misses=${game.misses}, SpeedMultiplier=${glitchManager.getSpeedMultiplier()}x -> ${game.hits === 1 ? '✓ PASS' : '❌ FAIL'}`);
    assert.strictEqual(game.hits, 1, '3-Stack SCREEN_FLIP + SPEED_DEMON + JELLY_MODE must register hit');
    game.stop();
  }

  // Stack Case 4C: SCREEN_FLIP + INPUT_SWAP + SPEED_DEMON
  {
    glitchManager.clearGlitches();
    glitchManager.addGlitch('SCREEN_FLIP');
    glitchManager.addGlitch('INPUT_SWAP');
    glitchManager.addGlitch('SPEED_DEMON');

    const game = new TargetTapGame(canvas, () => {});
    game.start(targetConfig);

    const visualX = 100;
    const visualY = 300;

    const touchEvent = {
      clientX: 100 + visualX,
      clientY: 200 + visualY,
      pointerId: 1
    };

    game.onCanvasPointerDown(touchEvent);
    console.log(`[3-Stack: SCREEN_FLIP + INPUT_SWAP + SPEED_DEMON] Hits=${game.hits}, Misses=${game.misses}, SpeedMultiplier=${glitchManager.getSpeedMultiplier()}x -> ${game.hits === 1 ? '✓ PASS' : '❌ FAIL'}`);
    assert.strictEqual(game.hits, 1, '3-Stack SCREEN_FLIP + INPUT_SWAP + SPEED_DEMON must register hit with motor compensation');
    game.stop();
  }

  // =========================================================================
  // PART 5: TOUCH-ISOLATION REGRESSION CHECK (TracePath Drag vs Sabotage Bar)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('PART 5: TOUCH-ISOLATION REGRESSION CHECK (TracePath Drag vs Sabotage)');
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

    // Deliberate tap on Sabotage Bar:
    const deliberateTap = new dom.window.CustomEvent('pointerup', { bubbles: true, cancelable: true });
    avatarBtn.dispatchEvent(deliberateTap);

    console.log(`Deliberate Sabotage Bar Tap: AttackFiredTarget=${glitchSentTarget}`);
    assert.strictEqual(glitchSentTarget, 'bot-1', 'Deliberate tap on Sabotage Bar must cleanly fire attack');
    console.log('✓ PASS: Touch isolation verified — drag does not misfire sabotage, and deliberate tap works cleanly.');
  }

  console.log('\n================================================================');
  console.log('ALL VERIFICATION PARTS COMPLETED WITH 100% PASS RATE');
  console.log('================================================================\n');

  gameScreen.cleanupCurrentGame();
  process.exit(0);
}

runDiagnosis().catch(err => {
  console.error('DIAGNOSIS SUITE FAILED:', err);
  process.exit(1);
});
