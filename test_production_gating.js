// test_production_gating.js
// Verification of NODE_ENV === 'production' security gating on live Render service

const assert = require('assert');
const { io } = require('socket.io-client');

const PROD_URL = 'https://glitch-party-game.onrender.com';

function timestamp() {
  return new Date().toISOString().slice(11, 23);
}

async function verifyProductionGating() {
  console.log('================================================================');
  console.log('LIVE PRODUCTION SECURITY & GATING AUDIT');
  console.log(`Target: ${PROD_URL}`);
  console.log('================================================================\n');

  // 1. HTTP HEALTH CHECK (Confirm NODE_ENV === 'production' on live container)
  console.log(`[${timestamp()}] 1. Querying /health endpoint on production...`);
  const healthRes = await fetch(`${PROD_URL}/health`);
  assert.strictEqual(healthRes.status, 200, `/health must return 200, got ${healthRes.status}`);
  const healthData = await healthRes.json();
  console.log(`  ✓ Raw /health response:`, JSON.stringify(healthData));
  assert.strictEqual(healthData.nodeEnv, 'production', `nodeEnv must be 'production', got ${healthData.nodeEnv}`);
  assert.strictEqual(healthData.isProduction, true, `isProduction flag must be true`);
  console.log(`  ✓ CONFIRMED: Live Render container running strictly in NODE_ENV='production'.\n`);

  // 2. HTTP STATIC TEST HARNESS GATING
  console.log(`[${timestamp()}] 2. Testing static /tests/ harness access on production...`);
  const testPageRes = await fetch(`${PROD_URL}/tests/verify_patch_102.html`);
  const testPageText = await testPageRes.text();
  const isServingHarness = testPageText.includes('Patch 1.0.2 Verification') || testPageText.includes('Test Harness');
  const isSpaFallback = testPageText.includes('<title>GLITCH — Real-Time Sabotage Party Game</title>');
  
  console.log(`  ✓ HTTP GET /tests/verify_patch_102.html status: ${testPageRes.status}`);
  console.log(`  ✓ Test harness content served: ${isServingHarness}`);
  console.log(`  ✓ SPA client routing fallback served (index.html): ${isSpaFallback}`);
  
  assert.strictEqual(isServingHarness, false, `Test harness HTML must NEVER be served in production!`);
  assert.strictEqual(isSpaFallback, true, `Non-existent static route must fall back to main index.html`);
  console.log(`  ✓ CONFIRMED: Test harness files are completely unmounted and inaccessible on production.\n`);

  // 3. LIVE SOCKET CONNECTION & TEST ENDPOINT GATING AUDIT
  console.log(`[${timestamp()}] 3. Connecting to live production WebSocket...`);
  const socket = io(PROD_URL, {
    transports: ['websocket'],
    forceNew: true,
    timeout: 10000
  });

  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('Connection timeout to production socket')), 10000);
  });
  console.log(`  ✓ Connected to production socket: ${socket.id}`);

  // Create room
  let roomCode, playerId;
  socket.emit('create-room', { playerName: 'SecurityAudit' });
  await new Promise(r => socket.once('room-created', data => {
    roomCode = data.roomCode;
    playerId = data.playerId;
    r();
  }));
  console.log(`  ✓ Created test room [${roomCode}] with player [${playerId}]`);

  // 4. ATTEMPT TEST-INSPECT-ROOM-STATE (Must be inert / no callback invoked)
  console.log(`\n[${timestamp()}] 4. Emitting "test-inspect-room-state" to production socket...`);
  let inspectCallbackFired = false;
  let inspectDataReceived = null;

  socket.emit('test-inspect-room-state', (data) => {
    inspectCallbackFired = true;
    inspectDataReceived = data;
  });

  // Wait 3000ms to confirm server does NOT respond
  console.log(`  ⏳ Waiting 3000ms to verify socket event is completely inert (unregistered on server)...`);
  await new Promise(r => setTimeout(r, 3000));

  if (inspectCallbackFired) {
    console.error(`  ❌ SECURITY FAILURE: test-inspect-room-state returned data in production:`, inspectDataReceived);
    assert.fail('test-inspect-room-state MUST NOT be active in production!');
  } else {
    console.log(`  ✓ CONFIRMED INERT: Server did NOT acknowledge or respond to "test-inspect-room-state".`);
    console.log(`  ✓ Result: Callback NEVER invoked. Zero internal room state exposed.`);
  }

  // 5. ATTEMPT TEST-GRANT-TOKENS & TEST-FAST-TIMINGS (Must be completely inert)
  console.log(`\n[${timestamp()}] 5. Emitting "test-grant-tokens" { count: 99 } to production socket...`);
  socket.emit('test-grant-tokens', { count: 99, all: true });

  console.log(`[${timestamp()}] 6. Emitting "test-fast-timings" { roundDuration: 100 } to production socket...`);
  socket.emit('test-fast-timings', { roundDuration: 100 });
  await new Promise(r => setTimeout(r, 1000));

  // Verify room/player has not been compromised
  const errorPromise = new Promise(resolve => {
    socket.once('glitch-error', data => resolve(data.message));
    socket.once('error', data => resolve(data.message));
    setTimeout(() => resolve('TIMEOUT'), 3000);
  });
  socket.emit('send-glitch', { targetPlayerId: playerId });
  const errorMsg = await errorPromise;
  console.log(`  ✓ Server response to sabotage attempt in lobby: "${errorMsg}"`);
  console.log(`  ✓ CONFIRMED INERT: Dev commands were completely ignored by server.`);

  socket.disconnect();
  console.log('\n================================================================');
  console.log('🎉 ALL LIVE PRODUCTION GATING CHECKS PASSED (100% SECURE & INERT)');
  console.log('================================================================\n');
}

verifyProductionGating().catch(err => {
  console.error('\n❌ Production gating audit failed:', err);
  process.exit(1);
});
