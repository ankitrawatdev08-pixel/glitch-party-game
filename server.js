// server.js
const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const crypto = require('crypto');
const RoomManager = require('./game/RoomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// If running in Render environment, ensure NODE_ENV defaults to production if unset
if (process.env.RENDER && !process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Serve static assets from public/ (strictly production assets: index.html, css, js)
app.use(express.static(path.join(__dirname, 'public')));

// Gated dev/test harness route (strictly excluded from production)
if (process.env.NODE_ENV !== 'production') {
  app.use('/tests', express.static(path.join(__dirname, 'tests')));
}

// Health check endpoint (reports exact environment and uptime for verification audits)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isRender: !!process.env.RENDER
  });
});

// Fallback to index.html for client routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
  // CREATE ROOM
  socket.on('create-room', ({ playerName }) => {
    try {
      const playerId = crypto.randomUUID();
      const hostData = {
        id: playerId,
        name: playerName,
        socketId: socket.id
      };

      const room = roomManager.createRoom(hostData);
      socket.join(room.code);

      const hostPlayer = room.players.get(playerId);
      socket.emit('room-created', {
        roomCode: room.code,
        playerId: hostPlayer.id,
        player: room.getPublicPlayer(hostPlayer),
        players: room.getPublicPlayersState(),
        hostId: room.hostId
      });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // JOIN ROOM
  socket.on('join-room', ({ roomCode, playerName, playerId }) => {
    try {
      const effectivePlayerId = playerId || crypto.randomUUID();
      const playerData = {
        id: effectivePlayerId,
        name: playerName,
        socketId: socket.id
      };

      const { room, player, isReconnect } = roomManager.joinRoom(roomCode, playerData);
      socket.join(room.code);

      socket.emit('room-joined', {
        roomCode: room.code,
        playerId: player.id,
        player: room.getPublicPlayer(player),
        players: room.getPublicPlayersState(),
        hostId: room.hostId,
        isReconnect,
        status: room.status
      });

      if (!isReconnect) {
        socket.to(room.code).emit('player-joined', {
          player: room.getPublicPlayer(player)
        });
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // START GAME
  socket.on('start-game', () => {
    try {
      const binding = roomManager.socketToRoom.get(socket.id);
      if (!binding) throw new Error('Not connected to a room.');

      const room = roomManager.getRoom(binding.roomCode);
      if (!room) throw new Error('Room not found.');

      room.startGame(binding.playerId);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ADD BOT (Host only, lobby only)
  socket.on('add-bot', () => {
    try {
      const binding = roomManager.socketToRoom.get(socket.id);
      if (!binding) throw new Error('Not connected to a room.');

      const room = roomManager.getRoom(binding.roomCode);
      if (!room) throw new Error('Room not found.');

      const bot = room.addBot(binding.playerId);
      io.to(room.code).emit('player-joined', {
        player: room.getPublicPlayer(bot)
      });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // REMOVE BOT (Host only, lobby only)
  socket.on('remove-bot', ({ botId }) => {
    try {
      const binding = roomManager.socketToRoom.get(socket.id);
      if (!binding) throw new Error('Not connected to a room.');

      const room = roomManager.getRoom(binding.roomCode);
      if (!room) throw new Error('Room not found.');

      room.removeBot(botId, binding.playerId);
      // removeBot calls removePlayer which already emits 'player-left'
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // SUBMIT SCORE
  socket.on('submit-score', ({ roundData }) => {
    try {
      const binding = roomManager.socketToRoom.get(socket.id);
      if (!binding) return;

      const room = roomManager.getRoom(binding.roomCode);
      if (room) {
        room.submitScore(binding.playerId, roundData);
      }
    } catch (err) {
      // Ignored during real-time tick to avoid interruption
    }
  });

  // SEND GLITCH
  socket.on('send-glitch', ({ targetPlayerId, glitchType }) => {
    try {
      const binding = roomManager.socketToRoom.get(socket.id);
      if (!binding) throw new Error('Not in an active room.');

      const room = roomManager.getRoom(binding.roomCode);
      if (!room) throw new Error('Room not found.');

      // Client-supplied glitchType override is strictly ignored in production.
      // The server ALWAYS selects the effect server-side from the eligible pool.
      const overrideType = (process.env.NODE_ENV !== 'production') ? glitchType : undefined;
      room.sendGlitch(binding.playerId, targetPlayerId, overrideType);
    } catch (err) {
      socket.emit('error', { message: err.message, targetPlayerId, action: 'send-glitch' });
    }
  });

  // TEST HELPERS (Only active during non-production test simulations)
  if (process.env.NODE_ENV !== 'production') {
    socket.on('test-grant-tokens', ({ count, all }) => {
      try {
        const binding = roomManager.socketToRoom.get(socket.id);
        if (binding) {
          const room = roomManager.getRoom(binding.roomCode);
          if (room) {
            if (all) {
              for (const player of room.players.values()) {
                player.glitchTokens = count || 2;
              }
            } else {
              const player = room.players.get(binding.playerId);
              if (player) {
                player.glitchTokens = count || 2;
              }
            }
          }
        }
      } catch (_) {}
    });

    socket.on('test-fast-timings', (timings) => {
      try {
        const binding = roomManager.socketToRoom.get(socket.id);
        if (binding) {
          const room = roomManager.getRoom(binding.roomCode);
          if (room && timings) {
            if (timings.roundDuration !== undefined) room.settings.roundDuration = timings.roundDuration;
            if (timings.preRoundDuration !== undefined) room.settings.preRoundDuration = timings.preRoundDuration;
            if (timings.postRoundDuration !== undefined) room.settings.postRoundDuration = timings.postRoundDuration;
            if (timings.eliminationDuration !== undefined) room.settings.eliminationDuration = timings.eliminationDuration;
          }
        }
      } catch (_) {}
    });

    socket.on('test-force-minigame', ({ miniGameId }) => {
      try {
        const binding = roomManager.socketToRoom.get(socket.id);
        if (binding) {
          const room = roomManager.getRoom(binding.roomCode);
          if (room && miniGameId) {
            room.forcedNextMiniGame = miniGameId;
            room.miniGameQueue.unshift(miniGameId);
          }
        }
      } catch (_) {}
    });

    socket.on('test-inspect-room-state', (callback) => {
      try {
        const binding = roomManager.socketToRoom.get(socket.id);
        if (binding) {
          const room = roomManager.getRoom(binding.roomCode);
          if (room && typeof callback === 'function') {
            const botGhostCount = Array.from(room.botIds).filter(bId => {
              const b = room.players.get(bId);
              return b && b.status === 'ELIMINATED';
            }).length;

            callback({
              attackerGlitchedTargetsCount: room.attackerGlitchedTargetsThisRound.size,
              carriedOverGlitchesCount: room.carriedOverGlitches.size,
              ghostGlitchUsedCount: room.ghostGlitchUsed.size,
              activeGlitchTimeoutsCount: room.activeGlitchTimeouts.length,
              botActionTimeoutsCount: room.botActionTimeouts.length,
              disconnectTimersCount: room.disconnectTimers.size,
              submittedScoresCount: room.submittedScores.size,
              tieBreakInfo: room.tieBreakInfo,
              eliminationOrderLength: room.eliminationOrder.length,
              activeGlitchesCount: room.activeGlitches.size,
              botCount: room.botIds.size,
              playersCount: room.players.size,
              botGhostCount
            });
          }
        }
      } catch (_) {}
    });
  }

  // PLAY AGAIN
  socket.on('play-again', () => {
    try {
      const binding = roomManager.socketToRoom.get(socket.id);
      if (!binding) throw new Error('Not connected to a room.');

      const room = roomManager.getRoom(binding.roomCode);
      if (!room) throw new Error('Room not found.');

      room.playAgain(binding.playerId);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // LEAVE ROOM
  socket.on('leave-room', () => {
    const binding = roomManager.socketToRoom.get(socket.id);
    if (binding) {
      const room = roomManager.getRoom(binding.roomCode);
      if (room) {
        socket.leave(room.code);
        room.removePlayer(binding.playerId);
      }
      roomManager.socketToRoom.delete(socket.id);
    }
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    roomManager.handleDisconnect(socket.id);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`GLITCH server listening on http://${HOST}:${PORT} [NODE_ENV=${process.env.NODE_ENV || 'development'}]`);
});
