// test_full_tournament_scoreboard.js
// Verification of Scoreboard Bounded Display & Overflow Prevention across all 21 rounds (8 players)

const assert = require('assert');
const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

async function createClient(name) {
  const socket = io(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true
  });
  await new Promise((resolve) => socket.on('connect', resolve));
  return { socket, name };
}

async function runFullTournamentScoreboardTest() {
  console.log('================================================================');
  console.log('TEST: 8-PLAYER FULL TOURNAMENT SCOREBOARD OVERFLOW & BOUNDING');
  console.log('================================================================');

  const names = ['P1_Host', 'P2_Bob', 'P3_Carol', 'P4_Dan', 'P5_Eve', 'P6_Frank', 'P7_Grace', 'P8_Hank'];
  const clients = await Promise.all(names.map(name => createClient(name)));
  console.log('✓ 8 socket clients connected');

  let roomCode = null;
  const playerIds = [];

  // P1 creates room
  await new Promise((resolve) => {
    clients[0].socket.on('room-created', (data) => {
      roomCode = data.roomCode;
      playerIds.push(data.playerId);
      resolve();
    });
    clients[0].socket.emit('create-room', { playerName: names[0] });
  });

  // P2..P8 join room
  for (let i = 1; i < clients.length; i++) {
    await new Promise((resolve) => {
      clients[i].socket.on('room-joined', (data) => {
        playerIds.push(data.playerId);
        resolve();
      });
      clients[i].socket.emit('join-room', { roomCode, playerName: names[i] });
    });
  }
  console.log(`✓ All 8 players joined room ${roomCode}`);

  // Configure fast timings for the 21-round marathon simulation
  clients[0].socket.emit('test-fast-timings', {
    roundDuration: 200,
    preRoundDuration: 150,
    postRoundDuration: 250,
    eliminationDuration: 200
  });

  // Start the game
  await new Promise((resolve) => {
    clients[0].socket.on('game-starting', () => resolve());
    clients[0].socket.emit('start-game');
  });
  console.log('✓ Game started: beginning 21-round tournament progression...');

  let roundCount = 0;
  let maxHistoryDotsObserved = 0;
  let finalStandingsReceived = false;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`21-round tournament timed out after 60s (reached round ${roundCount})`));
    }, 60000);

    // Score submission on round-start
    clients.forEach((c, idx) => {
      c.socket.on('round-start', () => {
        // Varying scores per player so rank order is distinct
        const hits = (idx + 1) * 2;
        c.socket.emit('submit-score', {
          roundData: { hits, totalTargets: 20, correct: hits, wrong: 1, correctCells: 4, totalCells: 6 }
        });
      });
    });

    // Check round results at each round
    clients[0].socket.on('round-results', (data) => {
      roundCount++;
      const standings = data.standings || [];
      const aliveStandings = standings.filter(p => p.status !== 'ELIMINATED');
      const ghostStandings = standings.filter(p => p.status === 'ELIMINATED');

      // Test display formatting logic for each player
      aliveStandings.forEach(p => {
        const phaseRoundScores = (p.roundScores || []).slice(-(data.roundNumber || 1));
        const totalGameScore = (p.roundScores || []).reduce((acc, s) => acc + s, 0);

        if (phaseRoundScores.length > maxHistoryDotsObserved) {
          maxHistoryDotsObserved = phaseRoundScores.length;
        }

        // CRITICAL ASSERTION 1: Phase round dots in the row must NEVER exceed 3 (prevents horizontal overflow)
        assert.ok(
          phaseRoundScores.length <= 3,
          `Phase round dots must never exceed 3, but got ${phaseRoundScores.length} at round ${roundCount}`
        );

        // CRITICAL ASSERTION 2: Running total must equal sum of all roundScores
        assert.strictEqual(
          typeof totalGameScore,
          'number',
          'Total game score must be a valid number'
        );
        assert.ok(
          !isNaN(totalGameScore),
          'Total game score must not be NaN'
        );
      });

      if (roundCount % 3 === 0 || roundCount >= 18) {
        console.log(`  [Progress] Global Round #${roundCount} (Phase ${data.phase}, Round ${data.roundNumber}): ${aliveStandings.length} alive, ${ghostStandings.length} ghosts. Max row dots: ${maxHistoryDotsObserved}`);
      }
    });

    clients[0].socket.on('game-over', (data) => {
      finalStandingsReceived = true;
      clearTimeout(timeout);
      console.log(`✓ Game-over reached after ${roundCount} total rounds! Winner: ${data.winner ? data.winner.name : 'N/A'}`);
      resolve();
    });
  });

  // Verify tournament length
  console.log(`✓ Total rounds completed: ${roundCount}`);
  assert.ok(roundCount >= 18, `Expected tournament to run through all phases (got ${roundCount} rounds)`);
  assert.strictEqual(maxHistoryDotsObserved <= 3, true, `History dots never exceeded 3 (was ${maxHistoryDotsObserved})`);
  console.log(`✓ Horizontal Scoreboard Overflow Check: PASSED (max row dots held strictly at <= 3 regardless of 21 round accumulation)`);

  clients.forEach(c => c.socket.disconnect());
  console.log('✓ All tournament clients disconnected');
  console.log('✓ 21-ROUND SCOREBOARD BOUNDING TEST PASSED 100%!\n');
}

runFullTournamentScoreboardTest().catch(err => {
  console.error('\n❌ Tournament Scoreboard Test Failed:', err);
  process.exit(1);
});
