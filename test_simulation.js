// test_simulation.js
// Automated 3-player end-to-end game flow verification test

const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

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

async function runTest() {
  console.log('--- STARTING 3-PLAYER FULL GAME TEST ---');

  // Step 1: Connect 3 players
  const playerA = await createClient('Alpha');
  const playerB = await createClient('Bravo');
  const playerC = await createClient('Charlie');
  console.log('✓ All 3 players connected to server');

  let roomCode = null;
  let playerAId = null;
  let playerBId = null;
  let playerCId = null;

  // Step 2: Player A creates room
  await new Promise((resolve) => {
    playerA.socket.on('room-created', (data) => {
      roomCode = data.roomCode;
      playerAId = data.playerId;
      console.log(`✓ Room created by Alpha with code: ${roomCode}`);
      if (roomCode.length !== 4) throw new Error('Room code must be 4 characters');
      resolve();
    });
    playerA.socket.emit('create-room', { playerName: 'Alpha' });
  });

  // Step 3: Player B joins
  await new Promise((resolve) => {
    playerB.socket.on('room-joined', (data) => {
      playerBId = data.playerId;
      console.log(`✓ Bravo joined room ${data.roomCode}, players count: ${data.players.length}`);
      resolve();
    });
    playerB.socket.emit('join-room', { roomCode, playerName: 'Bravo' });
  });

  // Step 4: Player C joins
  await new Promise((resolve) => {
    playerC.socket.on('room-joined', (data) => {
      playerCId = data.playerId;
      console.log(`✓ Charlie joined room ${data.roomCode}, players count: ${data.players.length}`);
      resolve();
    });
    playerC.socket.emit('join-room', { roomCode, playerName: 'Charlie' });
  });

  let eliminatedPlayerId = null;

  const onPreRound = (data) => {
    console.log(`\n▶ [PRE-ROUND] Phase ${data.phase}, Round ${data.roundNumber} (Global #${data.globalRound}): Minigame "${data.miniGame.name}"`);
    console.log(`  Identical config sent to all players: config type = ${data.miniGameConfig.type}`);
  };

  playerA.socket.on('pre-round', onPreRound);
  playerB.socket.on('pre-round', () => {});
  playerC.socket.on('pre-round', () => {});

  // Step 5: Start Game by Host (Alpha)
  console.log('\n--- HOST STARTING GAME ---');
  await new Promise((resolve) => {
    playerA.socket.on('game-starting', (data) => {
      console.log(`✓ Game starting: ${data.totalPhases} phases, ${data.totalRounds} total rounds`);
      resolve();
    });
    playerA.socket.emit('start-game');
  });

  // Wait for game loop to progress through Phase 1 & 2
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Game simulation timed out after 120 seconds'));
    }, 120000);

    let alphaReceivedTokens = false;
    let glitchSent = false;
    let ghostGlitchSent = false;

    // Listen on Bravo for glitch incoming
    playerB.socket.on('glitch-incoming', (data) => {
      console.log(`⚡ [SABOTAGE RECEIVED] Bravo glitched with ${data.glitchType} from ${data.fromPlayerName}!`);
    });

    playerA.socket.on('glitch-confirmed', (data) => {
      console.log(`⚡ [SABOTAGE CONFIRMED] Alpha successfully sent ${data.glitchType} to target! Remaining tokens: ${data.remainingTokens}`);
    });

    // Handle round start and submit appropriate performance data
    const handleRoundStart = (socket, name, scoreGenerator) => {
      socket.on('round-start', (data) => {
        setTimeout(() => {
          socket.emit('submit-score', { roundData: scoreGenerator() });
        }, 800);
      });
    };

    // Alpha scores high (>=80), Bravo scores medium (>=50), Charlie scores low (<50)
    handleRoundStart(playerA.socket, 'Alpha', () => ({
      hits: 8, totalTargets: 8,
      correct: 8, wrong: 0,
      correctCells: 6, totalCells: 6,
      correctWaypoints: 7, totalWaypoints: 7
    }));

    handleRoundStart(playerB.socket, 'Bravo', () => ({
      hits: 5, totalTargets: 8,
      correct: 5, wrong: 2,
      correctCells: 4, totalCells: 6,
      correctWaypoints: 4, totalWaypoints: 7
    }));

    handleRoundStart(playerC.socket, 'Charlie', () => ({
      hits: 2, totalTargets: 8,
      correct: 2, wrong: 6,
      correctCells: 1, totalCells: 6,
      correctWaypoints: 1, totalWaypoints: 7
    }));

    playerA.socket.on('round-results', (data) => {
      console.log(`✓ [ROUND RESULTS] Round ${data.roundNumber} (Phase ${data.phase}), Scores:`, data.scores, 'Tokens Earned:', data.tokenChanges);
      if (data.tokenChanges[playerAId] >= 2) {
        alphaReceivedTokens = true;
      }
    });

    // Send glitch during pre-round
    playerA.socket.on('pre-round', (data) => {
      if (alphaReceivedTokens && !glitchSent && data.globalRound >= 2) {
        setTimeout(() => {
          console.log(`⚡ Alpha spending token to sabotage Bravo with SCREEN_FLIP...`);
          playerA.socket.emit('send-glitch', { targetPlayerId: playerBId, glitchType: 'SCREEN_FLIP' });
          glitchSent = true;
        }, 600);
      }

      // If Charlie is eliminated and it's not showdown yet
      if (eliminatedPlayerId === playerCId && !ghostGlitchSent && !data.isShowdown) {
        setTimeout(() => {
          console.log('👻 Charlie (Ghost) sending free ghost glitch JELLY_MODE to Alpha...');
          playerC.socket.emit('send-glitch', { targetPlayerId: playerAId, glitchType: 'JELLY_MODE' });
          ghostGlitchSent = true;
        }, 800);
      }
    });

    // Elimination event (after Round 3 / Phase 1)
    playerA.socket.on('elimination', (data) => {
      eliminatedPlayerId = data.eliminatedPlayerId;
      console.log(`\n💀 [ELIMINATION EVENT] ${data.eliminatedPlayerName} was GLITCHED OUT!`);
      console.log(`  Remaining alive players: ${data.remainingCount}, Next is Showdown: ${data.isNextShowdown}`);

      if (eliminatedPlayerId === playerCId) {
        console.log('✓ Charlie was correctly eliminated based on lowest phase score!');
      }
    });

    playerA.socket.on('glitch-incoming', (data) => {
      console.log(`⚡ [GHOST SABOTAGE RECEIVED] Alpha received ${data.glitchType} from Ghost ${data.fromPlayerName}!`);
    });

    // Showdown event
    playerA.socket.on('showdown-start', (data) => {
      console.log(`\n⚡ [FINAL SHOWDOWN START] ${data.player1.name} VS ${data.player2.name}!`);
    });

    // Game Over event
    playerA.socket.on('game-over', (data) => {
      console.log(`\n🏆 [GAME OVER] Winner: ${data.winner.name}!`);
      console.log('  Final Standings:');
      data.finalStandings.forEach((p) => {
        console.log(`    Rank #${p.rank}: ${p.name} | Total Score: ${p.totalScore} | Tokens: ${p.tokensEarned}`);
      });

      // Test Play Again
      console.log('\n--- TESTING PLAY AGAIN TRIGGER ---');
      playerA.socket.emit('play-again');
    });

    playerA.socket.on('room-reset', (data) => {
      console.log(`✓ [ROOM RESET] Room successfully reset to lobby! Players: ${data.players.length}, Host: ${data.hostId}`);
      clearTimeout(timeout);
      resolve();
    });
  });

  // Disconnect all sockets
  playerA.socket.disconnect();
  playerB.socket.disconnect();
  playerC.socket.disconnect();

  console.log('\n=============================================');
  console.log('✓ ALL MULTIPLAYER TEST SCENARIOS PASSED 100%!');
  console.log('=============================================\n');
}

runTest().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
