// test_simulation.js
// Automated comprehensive verification test for GLITCH Patch 1.0.1
// Covers phase rejection (PRE_ROUND, POST_ROUND, ELIMINATION), Showdown ghost rejection,
// anti-spam, 3-cap eligibility, mid-round sabotage, and full game loop.

const assert = require('assert');
const { io } = require('socket.io-client');
const GameRoom = require('./game/GameRoom.js');
const { GAME_STATES, PLAYER_STATUS } = require('./game/constants.js');

const SERVER_URL = 'http://localhost:3000';

// =========================================================================
// PART 1: DIRECT UNIT TESTS FOR STATE MACHINE & REJECTION RULES
// =========================================================================

function runUnitTests() {
  console.log('\n======================================================');
  console.log('PART 1: VERIFYING GAME ROOM RULES & PHASE VALIDATIONS');
  console.log('======================================================');

  const mockIo = {
    to: () => ({ emit: () => {} }),
    emit: () => {}
  };

  const room = new GameRoom('TEST', { id: 'p1', name: 'Alice', socketId: 's1' }, mockIo);
  room.addPlayer({ id: 'p2', name: 'Bob', socketId: 's2' });
  room.addPlayer({ id: 'p3', name: 'Charlie', socketId: 's3' });
  room.addPlayer({ id: 'p4', name: 'Dave', socketId: 's4' });

  const p1 = room.players.get('p1');
  const p2 = room.players.get('p2');
  const p3 = room.players.get('p3');
  const p4 = room.players.get('p4');

  // Test 1: Rejection during LOBBY
  console.log('Testing glitch rejection during LOBBY...');
  assert.throws(
    () => room.sendGlitch('p1', 'p2'),
    /Glitches can only be activated during an active round/,
    'Failed to reject during LOBBY'
  );
  console.log('✓ Rejected during LOBBY');

  // Test 2: Rejection during PRE_ROUND
  console.log('Testing glitch rejection during PRE_ROUND...');
  room.status = GAME_STATES.PRE_ROUND;
  assert.throws(
    () => room.sendGlitch('p1', 'p2'),
    /Glitches can only be activated during an active round/,
    'Failed to reject during PRE_ROUND'
  );
  console.log('✓ Rejected during PRE_ROUND');

  // Test 3: Rejection during POST_ROUND
  console.log('Testing glitch rejection during POST_ROUND...');
  room.status = GAME_STATES.POST_ROUND;
  assert.throws(
    () => room.sendGlitch('p1', 'p2'),
    /Glitches can only be activated during an active round/,
    'Failed to reject during POST_ROUND'
  );
  console.log('✓ Rejected during POST_ROUND');

  // Test 4: Rejection during ELIMINATION
  console.log('Testing glitch rejection during ELIMINATION...');
  room.status = GAME_STATES.ELIMINATION;
  assert.throws(
    () => room.sendGlitch('p1', 'p2'),
    /Glitches can only be activated during an active round/,
    'Failed to reject during ELIMINATION'
  );
  console.log('✓ Rejected during ELIMINATION');

  // Test 5: Rejection with 0 tokens during PLAYING
  console.log('Testing 0-token rejection during PLAYING...');
  room.status = GAME_STATES.PLAYING;
  room.roundStartedAt = Date.now();
  p1.glitchTokens = 0;
  p1.status = PLAYER_STATUS.PLAYING;
  p2.status = PLAYER_STATUS.PLAYING;
  assert.throws(
    () => room.sendGlitch('p1', 'p2'),
    /Not enough Glitch Tokens/,
    'Failed to reject 0 tokens'
  );
  console.log('✓ Rejected 0 tokens');

  // Test 6: Valid mid-round glitch activation & token deduction
  console.log('Testing valid mid-round glitch activation...');
  p1.glitchTokens = 2;
  const result = room.sendGlitch('p1', 'p2', 'SCREEN_FLIP');
  assert.strictEqual(result, true);
  assert.strictEqual(p1.glitchTokens, 1, 'Token not deducted');
  assert.strictEqual(p2.activeGlitches.length, 1);
  assert.strictEqual(p2.activeGlitches[0], 'SCREEN_FLIP');
  console.log('✓ Glitch successfully applied and 1 token deducted');

  // Test 7: Anti-Spam: Duplicate attack on same target in same round rejected
  console.log('Testing Anti-Spam duplicate attack rejection...');
  assert.throws(
    () => room.sendGlitch('p1', 'p2'),
    /You have already glitched this target this round/,
    'Failed to reject duplicate attack on same target'
  );
  assert.strictEqual(p1.glitchTokens, 1, 'Token deducted on rejected attack');
  console.log('✓ Duplicate attack rejected and token preserved');

  // Test 8: Attacking different target in same round allowed
  console.log('Testing attack on different target in same round...');
  room.sendGlitch('p1', 'p3', 'JELLY_MODE');
  assert.strictEqual(p1.glitchTokens, 0);
  assert.strictEqual(p3.activeGlitches[0], 'JELLY_MODE');
  console.log('✓ Attack on different target allowed');

  // Test 9: 3-Glitch Cap enforcement
  console.log('Testing 3-Glitch Cap enforcement on target...');
  p1.glitchTokens = 5;
  // Clear anti-spam for test
  room.attackerGlitchedTargetsThisRound.clear();
  room.sendGlitch('p1', 'p2', 'FOG_OF_WAR'); // 2nd glitch on p2
  room.attackerGlitchedTargetsThisRound.clear();
  room.sendGlitch('p1', 'p2', 'SPEED_DEMON'); // 3rd glitch on p2
  assert.strictEqual(p2.activeGlitches.length, 3);
  room.attackerGlitchedTargetsThisRound.clear();
  assert.throws(
    () => room.sendGlitch('p1', 'p2'),
    /Target has reached the maximum 3 active glitch limit/,
    'Failed to enforce 3-glitch cap'
  );
  console.log('✓ 3-Glitch cap strictly enforced');

  // Test 10: Ghost mechanics in normal phase (1 free glitch)
  console.log('Testing Ghost free glitch mechanics in normal phase...');
  p1.status = PLAYER_STATUS.PLAYING;
  p2.status = PLAYER_STATUS.PLAYING;
  p3.status = PLAYER_STATUS.PLAYING;
  p4.status = PLAYER_STATUS.ELIMINATED;
  room.eliminationOrder = ['p4'];
  assert.strictEqual(room.isCurrentPhaseShowdown(), false, 'Room should NOT be in Showdown (3 players alive)');

  room.attackerGlitchedTargetsThisRound.clear();
  room.ghostGlitchUsed.clear();
  room.activeGlitches.set('p1', []);
  // P4 is ghost, targets P1
  room.sendGlitch('p4', 'p1');
  assert.strictEqual(room.activeGlitches.get('p1').length, 1);
  // Second ghost glitch in same round rejected
  room.attackerGlitchedTargetsThisRound.clear();
  assert.throws(
    () => room.sendGlitch('p4', 'p1'),
    /Ghosts can only send 1 glitch per round/,
    'Failed to enforce 1 ghost glitch per round'
  );
  console.log('✓ Ghost gets 1 free glitch in normal phase, second attempt rejected');

  // Test 11: Final Showdown Ghost Disabling (Defense-in-Depth)
  console.log('Testing Ghost glitch rejection during Final Showdown...');
  // P3 also eliminated -> 2 alive (p1, p2) in a 4-player game -> Showdown!
  p3.status = PLAYER_STATUS.ELIMINATED;
  room.eliminationOrder = ['p4', 'p3'];
  assert.strictEqual(room.isCurrentPhaseShowdown(), true, 'Room should now be in Showdown state (2 alive)');

  room.ghostGlitchUsed.clear();
  room.attackerGlitchedTargetsThisRound.clear();
  assert.throws(
    () => room.sendGlitch('p4', 'p1'),
    /Ghost glitches are disabled during Final Showdown/,
    'Failed to reject ghost glitch during Final Showdown'
  );
  assert.throws(
    () => room.sendGlitch('p3', 'p2'),
    /Ghost glitches are disabled during Final Showdown/,
    'Failed to reject ghost glitch during Final Showdown'
  );
  console.log('✓ Ghost glitch strictly rejected for all ghosts during Final Showdown');

  // Living finalists CAN still sabotage each other during Showdown
  p1.glitchTokens = 2;
  room.activeGlitches.set('p2', []);
  const showdownSabotage = room.sendGlitch('p1', 'p2');
  assert.strictEqual(showdownSabotage, true);
  console.log('✓ Living finalists CAN sabotage each other during Showdown');

  // Test 12: Late-Round Minimum Duration Carryover (2.5s rule)
  console.log('Testing late-round <2.5s carryover calculation...');
  room.activeGlitches.clear();
  room.carriedOverGlitches.clear();
  room.attackerGlitchedTargetsThisRound.clear();
  p1.glitchTokens = 2;
  // Simulate 1 second remaining in round
  room.roundStartedAt = Date.now() - (room.settings.roundDuration - 1000);
  room.sendGlitch('p1', 'p2', 'INPUT_SWAP');
  const activeRecord = room.activeGlitches.get('p2')[0];
  assert.strictEqual(activeRecord.remainingOwedMs > 1400, true, 'Remaining owed should be ~1500ms');

  // End round -> carryover preserved
  room.endRound();
  assert.strictEqual(room.carriedOverGlitches.has('p2'), true);
  const carried = room.carriedOverGlitches.get('p2')[0];
  assert.strictEqual(carried.glitchType, 'INPUT_SWAP');
  assert.strictEqual(carried.remainingOwedMs > 1400, true);
  console.log(`✓ Glitch with <2.5s correctly carried over: ${carried.remainingOwedMs}ms owed`);

  // Start next round -> resumed into activeGlitches
  room.startRound();
  assert.strictEqual(room.activeGlitches.get('p2')[0].glitchType, 'INPUT_SWAP');
  console.log('✓ Carried-over glitch resumed at start of next round');

  console.log('✓ ALL UNIT TESTS PASSED 100%!\n');
}

// =========================================================================
// PART 2: END-TO-END MULTIPLAYER SOCKET INTEGRATION TEST
// =========================================================================

function createClient(name) {
  return new Promise((resolve) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true
    });
    socket.on('connect', () => {
      resolve({ socket, name });
    });
  });
}

async function runSocketIntegrationTest() {
  console.log('======================================================');
  console.log('PART 2: RUNNING 3-PLAYER SOCKET.IO INTEGRATION TEST');
  console.log('======================================================');

  const playerA = await createClient('Alpha');
  const playerB = await createClient('Bravo');
  const playerC = await createClient('Charlie');
  console.log('✓ Connected Alpha, Bravo, Charlie to server');

  let roomCode = null;
  let playerAId = null;
  let playerBId = null;
  let playerCId = null;

  // Create room
  await new Promise((resolve) => {
    playerA.socket.on('room-created', (data) => {
      roomCode = data.roomCode;
      playerAId = data.playerId;
      console.log(`✓ Room created: ${roomCode}`);
      resolve();
    });
    playerA.socket.emit('create-room', { playerName: 'Alpha' });
  });

  // Join Bravo & Charlie
  await new Promise((resolve) => {
    playerB.socket.on('room-joined', (data) => {
      playerBId = data.playerId;
      resolve();
    });
    playerB.socket.emit('join-room', { roomCode, playerName: 'Bravo' });
  });

  await new Promise((resolve) => {
    playerC.socket.on('room-joined', (data) => {
      playerCId = data.playerId;
      resolve();
    });
    playerC.socket.emit('join-room', { roomCode, playerName: 'Charlie' });
  });
  console.log('✓ All 3 players joined room');

  // Start Game
  await new Promise((resolve) => {
    playerA.socket.on('game-starting', () => resolve());
    playerA.socket.emit('start-game');
  });
  console.log('✓ Game started by host');

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Simulation timed out after 120s'));
    }, 120000);

    let preRoundRejectTested = false;
    let midRoundGlitchSent = false;
    let antiSpamRejectTested = false;
    let eliminatedPlayerId = null;
    let showdownGhostRejectTested = false;

    // Track errors received
    playerA.socket.on('error', (err) => {
      console.log(`[Alpha Socket Error Received]: "${err.message}"`);
      if (err.message.includes('Glitches can only be activated during an active round')) {
        console.log('✓ Socket verified: Glitch during PRE_ROUND was correctly rejected!');
        preRoundRejectTested = true;
      }
      if (err.message.includes('You have already glitched this target this round')) {
        console.log('✓ Socket verified: Duplicate attack was correctly rejected (anti-spam)!');
        antiSpamRejectTested = true;
      }
    });

    playerC.socket.on('error', (err) => {
      console.log(`[Charlie Socket Error Received]: "${err.message}"`);
      if (err.message.includes('Ghost glitches are disabled during Final Showdown')) {
        console.log('✓ Socket verified: Ghost sabotage during Final Showdown was rejected!');
        showdownGhostRejectTested = true;
      }
    });

    // Listen for pre-round
    playerA.socket.on('pre-round', (data) => {
      console.log(`\n▶ [PRE-ROUND] Phase ${data.phase}, Round ${data.roundNumber} (${data.miniGame.name})`);

      // Test: Attempting glitch during PRE_ROUND should be rejected
      if (!preRoundRejectTested) {
        console.log('Testing socket send-glitch during PRE_ROUND (should fail)...');
        playerA.socket.emit('send-glitch', { targetPlayerId: playerBId });
      }
    });

    // Score handlers
    const setupScoreSubmitter = (socket, scoreData) => {
      socket.on('round-start', () => {
        setTimeout(() => {
          socket.emit('submit-score', { roundData: scoreData });
        }, 500);
      });
    };

    // Alpha gets 100 (tokens earned), Bravo gets 60 (tokens earned), Charlie gets 20 (eliminated)
    setupScoreSubmitter(playerA.socket, { hits: 10, totalTargets: 10, correct: 10, wrong: 0, correctCells: 6, totalCells: 6 });
    setupScoreSubmitter(playerB.socket, { hits: 6, totalTargets: 10, correct: 6, wrong: 2, correctCells: 4, totalCells: 6 });
    setupScoreSubmitter(playerC.socket, { hits: 1, totalTargets: 10, correct: 1, wrong: 8, correctCells: 1, totalCells: 6 });

    // Mid-round glitch test during ROUND_START (Round 2 onwards, once Alpha has tokens)
    playerA.socket.on('round-start', (data) => {
      console.log(`\n▶ [ROUND-START] Duration: ${data.duration}ms, Showdown: ${data.isShowdown}`);

      // If Charlie is eliminated and we are in Showdown, test ghost rejection
      if (data.isShowdown && eliminatedPlayerId === playerCId && !showdownGhostRejectTested) {
        setTimeout(() => {
          console.log('👻 Charlie (Ghost) attempting glitch during Final Showdown (should be rejected)...');
          playerC.socket.emit('send-glitch', { targetPlayerId: playerAId });
        }, 600);
      }

      // If Alpha has tokens, test mid-round sabotage
      if (!midRoundGlitchSent && data.players) {
        const alphaPlayer = data.players.find(p => p.id === playerAId);
        if (alphaPlayer && alphaPlayer.glitchTokens >= 1) {
          setTimeout(() => {
            console.log('⚡ Alpha sending mid-round sabotage to Bravo via 1-tap...');
            playerA.socket.emit('send-glitch', { targetPlayerId: playerBId });
            midRoundGlitchSent = true;

            // Immediately test anti-spam duplicate attack
            setTimeout(() => {
              console.log('⚡ Alpha attempting rapid duplicate attack on Bravo (should be rejected)...');
              playerA.socket.emit('send-glitch', { targetPlayerId: playerBId });
            }, 300);
          }, 800);
        }
      }
    });

    playerA.socket.on('glitch-confirmed', (data) => {
      console.log(`✓ [GLITCH CONFIRMED] Alpha sabotaged target with ${data.glitchType}! Tokens left: ${data.remainingTokens}`);
    });

    playerB.socket.on('glitch-incoming', (data) => {
      console.log(`✓ [GLITCH INCOMING] Bravo received mid-round glitch: ${data.glitchType} from ${data.fromPlayerName}!`);
    });

    playerA.socket.on('active-glitches-updated', (data) => {
      console.log('✓ [ACTIVE GLITCHES BROADCAST RECEIVED] Active room glitch state updated');
    });

    playerA.socket.on('elimination', (data) => {
      eliminatedPlayerId = data.eliminatedPlayerId;
      console.log(`\n💀 [ELIMINATION] ${data.eliminatedPlayerName} was eliminated!`);
      assert.strictEqual(eliminatedPlayerId, playerCId, 'Charlie should be eliminated');
    });

    playerA.socket.on('game-over', (data) => {
      console.log(`\n🏆 [GAME OVER] Winner: ${data.winner.name}!`);
      // Test Play Again
      playerA.socket.emit('play-again');
    });

    playerA.socket.on('room-reset', () => {
      console.log('✓ [ROOM RESET] Rematch ready, room reset to lobby');
      clearTimeout(timeout);
      resolve();
    });
  });

  playerA.socket.disconnect();
  playerB.socket.disconnect();
  playerC.socket.disconnect();

  console.log('\n======================================================');
  console.log('✓ ALL MULTIPLAYER & SOCKET TESTS COMPLETED SUCCESSFULLY!');
  console.log('======================================================\n');
}

async function main() {
  runUnitTests();
  await runSocketIntegrationTest();
}

main().catch((err) => {
  console.error('\n❌ Test Execution Failed:', err);
  process.exit(1);
});
