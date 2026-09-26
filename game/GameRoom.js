// game/GameRoom.js
const {
  GAME_STATES,
  PLAYER_STATUS,
  GLITCH_TYPES,
  MINIGAMES,
  TIMINGS,
  TOKEN_RULES,
  AVATAR_COLORS
} = require('./constants');
const MiniGameEngine = require('./MiniGameEngine');

const BOT_NAMES = ['Sparky', 'Zapper', 'Pixel', 'Bit', 'Byte', 'Neon', 'Volt', 'Circuit', 'Dash', 'Blip'];

class GameRoom {
  constructor(code, hostPlayer, io, onDestroy) {
    this.code = code;
    this.io = io;
    this.onDestroy = onDestroy; // callback when room should be removed
    this.hostId = hostPlayer.id;
    this.status = GAME_STATES.LOBBY;

    this.players = new Map(); // playerId -> Player
    this.playerOrder = []; // playerIds in join order

    this.settings = {
      roundDuration: TIMINGS.ROUND_DURATION,
      preRoundDuration: TIMINGS.PRE_ROUND_DURATION,
      postRoundDuration: TIMINGS.POST_ROUND_DURATION,
      eliminationDuration: TIMINGS.ELIMINATION_DURATION
    };

    this.totalPhases = 1;
    this.totalRounds = 3;
    this.currentPhase = 1;
    this.currentRound = 1; // 1-3 within current phase
    this.globalRound = 0; // overall round count

    this.miniGameQueue = [];
    this.currentMiniGame = null;
    this.miniGameConfig = null;
    this.roundStartedAt = 0;

    // Glitch tracking
    // targetPlayerId -> Array of { glitchType, fromPlayerId, fromPlayerName, remainingOwedMs, appliedAt }
    this.activeGlitches = new Map();
    // targetPlayerId -> Array of { glitchType, fromPlayerId, fromPlayerName, remainingOwedMs }
    this.carriedOverGlitches = new Map();
    // attackerPlayerId -> Set<targetPlayerId> for anti-spam duplicate prevention per round
    this.attackerGlitchedTargetsThisRound = new Map();
    this.ghostGlitchUsed = new Set(); // ghost playerIds who used their free glitch this round
    this.activeGlitchTimeouts = []; // timeouts for expiring carried-over or mid-round glitches
    this.botIds = new Set(); // IDs of AI bot players
    this.botActionTimeouts = []; // timeouts for bot score/glitch scheduling

    // Scoring & History
    this.phaseScores = new Map(); // playerId -> number
    this.allScores = new Map(); // playerId -> number[]
    this.submittedScores = new Map(); // playerId -> rawData
    this.totalTokensEarned = new Map(); // playerId -> number (for tie-breaking)
    this.eliminationOrder = []; // playerIds from first eliminated to last
    this.tieBreakInfo = null;

    // Timers
    this.stateTimer = null;
    this.disconnectTimers = new Map(); // playerId -> timeout
    this.idleTimer = null;
    this.createdAt = Date.now();

    this.addPlayer(hostPlayer);
    this.resetLobbyIdleTimer();
  }

  // --- ROOM & PLAYER MANAGEMENT ---

  addPlayer(playerData) {
    const colorIndex = this.players.size % AVATAR_COLORS.length;
    const player = {
      id: playerData.id,
      name: this.formatPlayerName(playerData.name),
      socketId: playerData.socketId,
      color: AVATAR_COLORS[colorIndex],
      status: PLAYER_STATUS.WAITING,
      glitchTokens: 0,
      totalScore: 0,
      activeGlitches: [],
      disconnectedAt: null
    };

    this.players.set(player.id, player);
    if (!this.playerOrder.includes(player.id)) {
      this.playerOrder.push(player.id);
    }
    this.allScores.set(player.id, []);
    this.phaseScores.set(player.id, 0);
    this.totalTokensEarned.set(player.id, 0);

    this.resetLobbyIdleTimer();
    return player;
  }

  formatPlayerName(rawName) {
    let name = (rawName || 'Player').trim().slice(0, 12);
    if (!name) name = 'Player';

    // Duplicate name handling: auto-append number
    let finalName = name;
    let counter = 2;
    const existingNames = Array.from(this.players.values()).map(p => p.name.toLowerCase());
    while (existingNames.includes(finalName.toLowerCase())) {
      finalName = `${name} ${counter}`;
      counter++;
    }
    return finalName;
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;

    this.players.delete(playerId);
    this.playerOrder = this.playerOrder.filter(id => id !== playerId);
    this.clearDisconnectTimer(playerId);

    // Host migration
    if (this.hostId === playerId && this.players.size > 0) {
      this.hostId = this.playerOrder.find(id => !this.botIds.has(id)) || this.playerOrder[0];
      this.io.to(this.code).emit('host-changed', { newHostId: this.hostId });
    }

    this.io.to(this.code).emit('player-left', { playerId });

    // Check if empty
    if (this.players.size === 0) {
      this.scheduleEmptyRoomCleanup();
    } else if (this.status !== GAME_STATES.LOBBY && this.status !== GAME_STATES.GAME_OVER) {
      this.checkRemainingPlayers();
    }
  }

  // --- BOT MANAGEMENT ---

  addBot(requestingPlayerId) {
    if (requestingPlayerId !== this.hostId) {
      throw new Error('Only the host can add bots.');
    }
    if (this.status !== GAME_STATES.LOBBY) {
      throw new Error('Can only add bots in lobby.');
    }
    if (this.players.size >= 8) {
      throw new Error('Room is full (8/8 players).');
    }

    const botId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const baseName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];

    const botData = {
      id: botId,
      name: `\u{1F916} ${baseName}`,
      socketId: null
    };

    const bot = this.addPlayer(botData);
    this.botIds.add(botId);
    return bot;
  }

  removeBot(botId, requestingPlayerId) {
    if (requestingPlayerId !== this.hostId) {
      throw new Error('Only the host can remove bots.');
    }
    if (this.status !== GAME_STATES.LOBBY) {
      throw new Error('Can only remove bots in lobby.');
    }
    if (!this.botIds.has(botId)) {
      throw new Error('Not a bot player.');
    }
    this.botIds.delete(botId);
    this.removePlayer(botId);
  }

  handleDisconnect(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;

    this.clearDisconnectTimer(playerId);
    player.status = PLAYER_STATUS.DISCONNECTED;
    player.disconnectedAt = Date.now();
    this.io.to(this.code).emit('player-disconnected', { playerId, playerName: player.name });

    if (this.status === GAME_STATES.LOBBY) {
      // 15 seconds grace in lobby
      this.disconnectTimers.set(playerId, setTimeout(() => {
        this.removePlayer(playerId);
      }, TIMINGS.LOBBY_DISCONNECT_GRACE));
    } else {
      // 30 seconds grace in game
      this.disconnectTimers.set(playerId, setTimeout(() => {
        this.finalizeEliminationOnDisconnect(playerId);
      }, TIMINGS.DISCONNECT_GRACE_PERIOD));
    }

    // If host disconnected, migrate immediately so room doesn't stall
    if (this.hostId === playerId) {
      const nextActive = this.playerOrder.find(id => {
        const p = this.players.get(id);
        return p && p.status !== PLAYER_STATUS.DISCONNECTED && !this.botIds.has(id);
      });
      if (nextActive) {
        this.hostId = nextActive;
        this.io.to(this.code).emit('host-changed', { newHostId: this.hostId });
      }
    }
  }

  handleReconnect(playerId, socketId) {
    const player = this.players.get(playerId);
    if (!player) return null;

    this.clearDisconnectTimer(playerId);
    player.socketId = socketId;
    player.disconnectedAt = null;

    if (this.eliminationOrder.includes(playerId)) {
      player.status = PLAYER_STATUS.ELIMINATED;
    } else {
      player.status = this.status === GAME_STATES.LOBBY ? PLAYER_STATUS.WAITING : PLAYER_STATUS.PLAYING;
    }

    this.io.to(this.code).emit('player-reconnected', { playerId, playerName: player.name });
    return player;
  }

  clearDisconnectTimer(playerId) {
    if (this.disconnectTimers.has(playerId)) {
      clearTimeout(this.disconnectTimers.get(playerId));
      this.disconnectTimers.delete(playerId);
    }
  }

  finalizeEliminationOnDisconnect(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;

    if (this.status !== GAME_STATES.GAME_OVER && !this.eliminationOrder.includes(playerId)) {
      player.status = PLAYER_STATUS.ELIMINATED;
      this.eliminationOrder.push(playerId);
      this.io.to(this.code).emit('player-eliminated-disconnect', { playerId, playerName: player.name });
      this.checkRemainingPlayers();
    }
  }

  checkRemainingPlayers() {
    const activeAlivePlayers = Array.from(this.players.values()).filter(p =>
      p.status === PLAYER_STATUS.PLAYING || (p.status === PLAYER_STATUS.DISCONNECTED && !this.eliminationOrder.includes(p.id))
    );

    if (activeAlivePlayers.length <= 1 && this.players.size >= 2) {
      // 1 player left standing by default!
      const winner = activeAlivePlayers[0] || Array.from(this.players.values())[0];
      this.triggerGameOver(winner);
    }
  }

  // --- GAME LIFECYCLE & STATE MACHINE ---

  startGame(requestingPlayerId) {
    if (requestingPlayerId !== this.hostId) {
      throw new Error('Only the host can start the game.');
    }
    if (this.players.size < 2) {
      throw new Error('Need at least 2 players to start.');
    }
    if (this.status !== GAME_STATES.LOBBY) {
      throw new Error('Game already in progress.');
    }

    this.clearTimer();
    const count = this.players.size;

    if (count === 2) {
      this.totalPhases = 2; // 2 phases = 6 rounds total, no eliminations
      this.totalRounds = 6;
    } else {
      this.totalPhases = count - 1;
      this.totalRounds = this.totalPhases * 3;
    }

    this.currentPhase = 1;
    this.currentRound = 1;
    this.globalRound = 0;
    this.eliminationOrder = [];
    this.refillMiniGameQueue();

    // Set all players to PLAYING
    for (const player of this.players.values()) {
      player.status = PLAYER_STATUS.PLAYING;
      player.glitchTokens = 0;
      player.totalScore = 0;
      this.phaseScores.set(player.id, 0);
      this.allScores.set(player.id, []);
      this.totalTokensEarned.set(player.id, 0);
    }

    this.io.to(this.code).emit('game-starting', {
      totalPhases: this.totalPhases,
      totalRounds: this.totalRounds,
      playerCount: count
    });

    this.startPreRound();
  }

  refillMiniGameQueue() {
    const games = MINIGAMES.map(g => g.id).sort(() => Math.random() - 0.5);
    this.miniGameQueue = [...games];
  }

  getNextMiniGame() {
    if (this.miniGameQueue.length === 0) {
      this.refillMiniGameQueue();
    }
    return this.miniGameQueue.shift();
  }

  isCurrentPhaseShowdown() {
    return this.players.size > 2 && this.getAlivePlayers().length === 2;
  }

  getAllActiveGlitchesPublic() {
    const res = {};
    for (const p of this.players.values()) {
      const active = this.activeGlitches.get(p.id) || [];
      const carried = this.carriedOverGlitches.get(p.id) || [];
      const types = Array.from(new Set([
        ...active.map(g => g.glitchType),
        ...carried.map(g => g.glitchType)
      ]));
      res[p.id] = types;
    }
    return res;
  }

  expireGlitch(playerId, glitchType) {
    const list = this.activeGlitches.get(playerId);
    if (!list) return;
    const idx = list.findIndex(g => g.glitchType === glitchType);
    if (idx !== -1) {
      list.splice(idx, 1);
      const player = this.players.get(playerId);
      if (player) {
        player.activeGlitches = list.map(g => g.glitchType);
      }
      this.io.to(this.code).emit('active-glitches-updated', {
        activeGlitches: this.getAllActiveGlitchesPublic()
      });
    }
  }

  startPreRound() {
    this.clearTimer();
    this.status = GAME_STATES.PRE_ROUND;
    this.globalRound++;
    this.ghostGlitchUsed.clear();
    this.submittedScores.clear();

    // Check if 2 players remain in 3+ player game -> Showdown!
    const isShowdown = this.isCurrentPhaseShowdown();

    this.currentMiniGame = this.getNextMiniGame();
    this.miniGameConfig = MiniGameEngine.generateRoundConfig(this.currentMiniGame, this.globalRound);

    const miniGameInfo = MINIGAMES.find(g => g.id === this.currentMiniGame);

    this.io.to(this.code).emit('pre-round', {
      roundNumber: this.currentRound,
      globalRound: this.globalRound,
      phase: this.currentPhase,
      totalPhases: this.totalPhases,
      totalRounds: this.totalRounds,
      miniGame: miniGameInfo,
      miniGameConfig: this.miniGameConfig,
      duration: this.settings.preRoundDuration,
      isShowdown,
      players: this.getPublicPlayersState()
    });

    this.stateTimer = setTimeout(() => {
      this.startRound();
    }, this.settings.preRoundDuration);
  }

  startRound() {
    this.clearTimer();
    this.status = GAME_STATES.PLAYING;
    this.roundStartedAt = Date.now();
    this.attackerGlitchedTargetsThisRound.clear();
    this.ghostGlitchUsed.clear();

    if (this.isCurrentPhaseShowdown()) {
      for (const player of this.players.values()) {
        if (player.status === PLAYER_STATUS.ELIMINATED) {
          this.ghostGlitchUsed.add(player.id);
        }
      }

      // Purge any carried-over glitches originated by an eliminated ghost (Health Check 3)
      for (const [playerId, list] of this.carriedOverGlitches.entries()) {
        const nonGhostList = list.filter(item => {
          const sender = this.players.get(item.fromPlayerId);
          return sender && sender.status !== PLAYER_STATUS.ELIMINATED;
        });
        if (nonGhostList.length > 0) {
          this.carriedOverGlitches.set(playerId, nonGhostList);
        } else {
          this.carriedOverGlitches.delete(playerId);
        }
      }
    }

    for (const t of this.activeGlitchTimeouts) {
      clearTimeout(t);
    }
    this.activeGlitchTimeouts = [];

    // Transfer carried-over glitches into active glitches and schedule their expiration
    for (const [playerId, list] of this.carriedOverGlitches.entries()) {
      let activeList = this.activeGlitches.get(playerId);
      if (!activeList) {
        activeList = [];
        this.activeGlitches.set(playerId, activeList);
      }
      for (const item of list) {
        if (item.remainingOwedMs > 0) {
          activeList.push({
            glitchType: item.glitchType,
            fromPlayerId: item.fromPlayerId,
            fromPlayerName: item.fromPlayerName,
            remainingOwedMs: item.remainingOwedMs,
            appliedAt: Date.now()
          });

          const t = setTimeout(() => {
            this.expireGlitch(playerId, item.glitchType);
          }, item.remainingOwedMs);
          this.activeGlitchTimeouts.push(t);
        }
      }
    }
    this.carriedOverGlitches.clear();

    // Attach active glitches to each player's state
    for (const [playerId, player] of this.players.entries()) {
      const glitches = this.activeGlitches.get(playerId) || [];
      player.activeGlitches = glitches.map(g => g.glitchType);
    }

    const isShowdown = this.isCurrentPhaseShowdown();

    this.io.to(this.code).emit('round-start', {
      duration: this.settings.roundDuration,
      isShowdown,
      activeGlitches: this.getAllActiveGlitchesPublic(),
      players: this.getPublicPlayersState()
    });

    this.stateTimer = setTimeout(() => {
      this.endRound();
    }, this.settings.roundDuration);

    // Schedule bot actions (score submission & sabotage) with randomized delays
    this.scheduleBotActions();
  }

  // --- BOT ROUND ACTIONS ---

  scheduleBotActions() {
    for (const t of this.botActionTimeouts) clearTimeout(t);
    this.botActionTimeouts = [];
    this.scheduledBotDelays = { scoreDelays: [], glitchDelays: [] };

    const isShowdown = this.isCurrentPhaseShowdown();

    const duration = this.settings.roundDuration;

    for (const botId of this.botIds) {
      const bot = this.players.get(botId);
      if (!bot) continue;

      const isGhost = bot.status === PLAYER_STATUS.ELIMINATED;

      // Living bots: submit scores after a randomized delay (proportionate to roundDuration)
      if (!isGhost) {
        const minScoreDelay = Math.min(1500, Math.max(300, duration * 0.2));
        const maxScoreDelay = Math.min(5500, Math.max(800, duration * 0.7));
        const scoreDelay = minScoreDelay + Math.random() * (maxScoreDelay - minScoreDelay);
        this.scheduledBotDelays.scoreDelays.push({ botId, delayMs: Math.round(scoreDelay) });
        const t = setTimeout(() => {
          if (this.status !== GAME_STATES.PLAYING) return;
          const rawData = this.generateBotScoreData(this.currentMiniGame);
          this.submitScore(botId, rawData);
        }, scoreDelay);
        this.botActionTimeouts.push(t);
      }

      // Sabotage: living bots with tokens, or ghost bots outside Showdown
      let canGlitch = false;
      if (isGhost) {
        canGlitch = !isShowdown && !this.ghostGlitchUsed.has(botId);
      } else {
        canGlitch = bot.glitchTokens >= TOKEN_RULES.COST_PER_GLITCH;
      }

      if (canGlitch) {
        const minGlitchDelay = Math.min(2000, Math.max(400, duration * 0.25));
        const maxGlitchDelay = Math.min(6000, Math.max(1000, duration * 0.75));
        const glitchDelay = minGlitchDelay + Math.random() * (maxGlitchDelay - minGlitchDelay);
        this.scheduledBotDelays.glitchDelays.push({ botId, delayMs: Math.round(glitchDelay) });
        const t = setTimeout(() => {
          this.executeBotGlitch(botId);
        }, glitchDelay);
        this.botActionTimeouts.push(t);
      }
    }
  }

  chooseBotTarget(botId) {
    const alivePlayers = this.getAlivePlayers().filter(p => p.id !== botId);
    if (alivePlayers.length === 0) return null;

    // Pick target: 70% highest scorer, 30% random
    if (Math.random() < 0.7) {
      const sorted = [...alivePlayers].sort((a, b) => b.totalScore - a.totalScore);
      return sorted[0];
    } else {
      return alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    }
  }

  executeBotGlitch(botId) {
    if (this.status !== GAME_STATES.PLAYING) return;

    const target = this.chooseBotTarget(botId);
    if (!target) return;

    try {
      this.sendGlitch(botId, target.id);
    } catch (e) {
      // Silently accept rejection — bots play by the same rules as humans
    }
  }

  generateBotScoreData(miniGameId) {
    const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

    switch (miniGameId) {
      case 'targetTap':
        return { hits: rand(3, 6), totalTargets: 8 };
      case 'colorMatch':
        return { correct: rand(4, 7), wrong: rand(2, 4) };
      case 'sequenceMemory':
        return { correctCells: rand(2, 3), totalCells: 4 };
      case 'quickMath':
        return { correct: rand(3, 5), wrong: rand(2, 4) };
      case 'oddOneOut':
        return { correct: rand(4, 6), wrong: rand(2, 3) };
      case 'tracePath':
        return { correctWaypoints: rand(3, 4), totalWaypoints: 5 };
      default:
        return { hits: rand(4, 6), totalTargets: 8 };
    }
  }

  submitScore(playerId, rawData) {
    if (this.status !== GAME_STATES.PLAYING) return;
    this.submittedScores.set(playerId, rawData);
  }

  sendGlitch(fromPlayerId, targetPlayerId, optionalGlitchType) {
    if (this.status !== GAME_STATES.PLAYING) {
      throw new Error('Glitches can only be activated during an active round.');
    }
    const sender = this.players.get(fromPlayerId);
    const target = this.players.get(targetPlayerId);

    if (!sender || !target) {
      throw new Error('Player not found.');
    }
    if (target.status === PLAYER_STATUS.ELIMINATED) {
      throw new Error('Cannot glitch an eliminated player.');
    }
    if (fromPlayerId === targetPlayerId) {
      throw new Error('Cannot glitch yourself.');
    }

    const isGhost = sender.status === PLAYER_STATUS.ELIMINATED;
    const isShowdown = this.isCurrentPhaseShowdown();

    // 1. Showdown Check for Ghosts (Pure skill finale)
    if (isShowdown && isGhost) {
      throw new Error('Ghost glitches are disabled during Final Showdown.');
    }

    // 2. Cost / Token availability
    if (isGhost) {
      if (this.ghostGlitchUsed.has(fromPlayerId)) {
        throw new Error('Ghosts can only send 1 glitch per round.');
      }
    } else {
      if (sender.glitchTokens < TOKEN_RULES.COST_PER_GLITCH) {
        throw new Error('Not enough Glitch Tokens.');
      }
    }

    // 3. Anti-Spam Check: One glitch per attacker per target per round (Server-enforced)
    if (!this.attackerGlitchedTargetsThisRound.has(fromPlayerId)) {
      this.attackerGlitchedTargetsThisRound.set(fromPlayerId, new Set());
    }
    const glitchedSet = this.attackerGlitchedTargetsThisRound.get(fromPlayerId);
    if (glitchedSet.has(targetPlayerId)) {
      throw new Error('You have already glitched this target this round.');
    }

    // 4. Target Caps & Eligibility (active + carried-over)
    if (!this.activeGlitches.has(targetPlayerId)) {
      this.activeGlitches.set(targetPlayerId, []);
    }
    const currentActive = this.activeGlitches.get(targetPlayerId);
    const activeTypes = new Set(currentActive.map(g => g.glitchType));

    const carried = this.carriedOverGlitches.get(targetPlayerId) || [];
    carried.forEach(c => activeTypes.add(c.glitchType));

    if (activeTypes.size >= TOKEN_RULES.MAX_GLITCHES_PER_PLAYER) {
      throw new Error('Target has reached the maximum 3 active glitch limit.');
    }

    const allTypes = Object.keys(GLITCH_TYPES);
    const eligiblePool = allTypes.filter(type => !activeTypes.has(type));

    if (eligiblePool.length === 0) {
      throw new Error('All glitch effects are currently active on this target.');
    }

    // Select randomized effect strictly from eligible pool.
    // Explicit overrides are strictly disabled in production (dev/test harnesses only).
    const allowOverride = (process.env.NODE_ENV !== 'production');
    let chosenGlitch;
    if (allowOverride && optionalGlitchType && eligiblePool.includes(optionalGlitchType)) {
      chosenGlitch = optionalGlitchType;
    } else {
      chosenGlitch = eligiblePool[Math.floor(Math.random() * eligiblePool.length)];
    }

    // 5. Deduct token
    if (isGhost) {
      this.ghostGlitchUsed.add(fromPlayerId);
    } else {
      sender.glitchTokens -= TOKEN_RULES.COST_PER_GLITCH;
    }

    // 6. Record Anti-Spam
    glitchedSet.add(targetPlayerId);

    // 7. Calculate Late-Round Minimum Duration (2.5s guarantee)
    const now = Date.now();
    const timeRemaining = Math.max(0, (this.roundStartedAt + this.settings.roundDuration) - now);
    let remainingOwedMs = 0;
    if (timeRemaining < 2500) {
      remainingOwedMs = 2500 - timeRemaining;
    }

    const glitchRecord = {
      glitchType: chosenGlitch,
      fromPlayerId,
      fromPlayerName: sender.name,
      remainingOwedMs,
      appliedAt: now
    };

    currentActive.push(glitchRecord);
    target.activeGlitches = currentActive.map(g => g.glitchType);

    // Notify sender & target
    if (sender.socketId) {
      this.io.to(sender.socketId).emit('glitch-confirmed', {
        targetPlayerId,
        targetPlayerName: target.name,
        glitchType: chosenGlitch,
        remainingTokens: sender.glitchTokens,
        tokensLeft: sender.glitchTokens,
        isGhost
      });
    }

    if (target.socketId) {
      this.io.to(target.socketId).emit('glitch-incoming', {
        glitchType: chosenGlitch,
        fromPlayerName: sender.name,
        attackerName: sender.name,
        remainingOwedMs,
        isGhost
      });
    }

    // Broadcast updated active glitches to all players in the room
    this.io.to(this.code).emit('active-glitches-updated', {
      activeGlitches: this.getAllActiveGlitchesPublic()
    });

    return true;
  }

  endRound() {
    this.status = GAME_STATES.POST_ROUND;
    this.clearTimer();

    for (const t of this.activeGlitchTimeouts) {
      clearTimeout(t);
    }
    this.activeGlitchTimeouts = [];
    for (const t of this.botActionTimeouts) {
      clearTimeout(t);
    }
    this.botActionTimeouts = [];

    // Check which active glitches have carryover owed (Section 6)
    this.carriedOverGlitches.clear();
    for (const [playerId, list] of this.activeGlitches.entries()) {
      const carryList = [];
      for (const item of list) {
        if (item.remainingOwedMs > 0) {
          carryList.push({
            glitchType: item.glitchType,
            fromPlayerId: item.fromPlayerId,
            fromPlayerName: item.fromPlayerName,
            remainingOwedMs: item.remainingOwedMs
          });
        }
      }
      if (carryList.length > 0) {
        this.carriedOverGlitches.set(playerId, carryList);
      }
    }
    this.activeGlitches.clear();

    // Clear visual active glitches on players for post-round transition
    for (const player of this.players.values()) {
      player.activeGlitches = [];
    }

    this.io.to(this.code).emit('round-end');

    // Calculate scores and tokens
    const roundScores = {};
    const tokenChanges = {};

    for (const player of this.players.values()) {
      if (player.status === PLAYER_STATUS.ELIMINATED) continue;

      const raw = this.submittedScores.get(player.id) || {};
      const score = MiniGameEngine.calculateScore(this.currentMiniGame, raw);

      roundScores[player.id] = score;
      player.totalScore += score;

      const currentPhaseScore = (this.phaseScores.get(player.id) || 0) + score;
      this.phaseScores.set(player.id, currentPhaseScore);

      const history = this.allScores.get(player.id) || [];
      history.push(score);
      this.allScores.set(player.id, history);

      // Token earning
      let tokensEarned = 0;
      if (score >= TOKEN_RULES.HIGH_SCORE_THRESHOLD) {
        tokensEarned = TOKEN_RULES.HIGH_SCORE_TOKENS;
      } else if (score >= TOKEN_RULES.MID_SCORE_THRESHOLD) {
        tokensEarned = TOKEN_RULES.MID_SCORE_TOKENS;
      }

      tokenChanges[player.id] = tokensEarned;
      player.glitchTokens = Math.min(TOKEN_RULES.MAX_TOKENS, player.glitchTokens + tokensEarned);

      const totalTokens = (this.totalTokensEarned.get(player.id) || 0) + tokensEarned;
      this.totalTokensEarned.set(player.id, totalTokens);
    }

    const standings = this.getStandings();

    this.io.to(this.code).emit('round-results', {
      scores: roundScores,
      tokenChanges,
      standings,
      duration: this.settings.postRoundDuration,
      roundNumber: this.currentRound,
      phase: this.currentPhase
    });

    this.stateTimer = setTimeout(() => {
      this.handlePostRoundTransition();
    }, this.settings.postRoundDuration);
  }

  handlePostRoundTransition() {
    // Check if phase is complete (every 3 rounds)
    if (this.currentRound >= 3) {
      const alivePlayers = this.getAlivePlayers();

      // 2-player game mode: 6 rounds, no elimination
      if (this.players.size === 2) {
        if (this.currentPhase >= this.totalPhases) {
          const winner = this.resolveWinnerBetween(alivePlayers[0], alivePlayers[1]);
          this.triggerGameOver(winner);
          return;
        } else {
          this.advancePhase();
          this.startPreRound();
          return;
        }
      }

      // 3+ player game: elimination after each phase
      if (alivePlayers.length > 2) {
        this.triggerElimination();
      } else if (alivePlayers.length === 2) {
        // Showdown finished!
        const winner = this.resolveWinnerBetween(alivePlayers[0], alivePlayers[1]);
        this.triggerGameOver(winner);
      } else {
        const winner = alivePlayers[0] || Array.from(this.players.values())[0];
        this.triggerGameOver(winner);
      }
    } else {
      // Continue next round in same phase
      this.currentRound++;
      this.startPreRound();
    }
  }

  advancePhase() {
    this.currentPhase++;
    this.currentRound = 1;
    // Reset phase scores for the new phase
    for (const id of this.players.keys()) {
      this.phaseScores.set(id, 0);
    }
  }

  triggerElimination() {
    this.status = GAME_STATES.ELIMINATION;
    this.clearTimer();

    const alivePlayers = this.getAlivePlayers();
    const eliminatedPlayer = this.determineEliminatedPlayer(alivePlayers);

    eliminatedPlayer.status = PLAYER_STATUS.ELIMINATED;
    this.eliminationOrder.push(eliminatedPlayer.id);

    const remainingCount = this.getAlivePlayers().length;
    const isNextShowdown = remainingCount === 2;

    this.io.to(this.code).emit('elimination', {
      eliminatedPlayerId: eliminatedPlayer.id,
      eliminatedPlayerName: eliminatedPlayer.name,
      tieBreakInfo: this.tieBreakInfo,
      remainingCount,
      isNextShowdown,
      duration: this.settings.eliminationDuration,
      standings: this.getStandings()
    });

    this.stateTimer = setTimeout(() => {
      this.advancePhase();
      if (isNextShowdown) {
        this.status = GAME_STATES.SHOWDOWN;
        const [p1, p2] = this.getAlivePlayers();
        this.io.to(this.code).emit('showdown-start', {
          player1: this.getPublicPlayer(p1),
          player2: this.getPublicPlayer(p2)
        });
      }
      this.startPreRound();
    }, this.settings.eliminationDuration);
  }

  determineEliminatedPlayer(candidates) {
    this.tieBreakInfo = null;

    // Sort by phase score ascending (lowest first)
    const sorted = [...candidates].sort((a, b) => {
      const scoreA = this.phaseScores.get(a.id) || 0;
      const scoreB = this.phaseScores.get(b.id) || 0;
      return scoreA - scoreB;
    });

    const lowestScore = this.phaseScores.get(sorted[0].id) || 0;
    const tied = sorted.filter(p => (this.phaseScores.get(p.id) || 0) === lowestScore);

    if (tied.length === 1) {
      return tied[0];
    }

    // Tie-break 1: lowest score on most recent round
    const tiedSortedByRecent = [...tied].sort((a, b) => {
      const aHistory = this.allScores.get(a.id) || [];
      const bHistory = this.allScores.get(b.id) || [];
      const aRecent = aHistory[aHistory.length - 1] || 0;
      const bRecent = bHistory[bHistory.length - 1] || 0;
      return aRecent - bRecent;
    });

    const lowestRecent = (this.allScores.get(tiedSortedByRecent[0].id) || []).slice(-1)[0] || 0;
    const tied2 = tiedSortedByRecent.filter(p => {
      const h = this.allScores.get(p.id) || [];
      return (h[h.length - 1] || 0) === lowestRecent;
    });

    if (tied2.length === 1) {
      this.tieBreakInfo = `Tie-break: Lower most recent round score (${lowestRecent})`;
      return tied2[0];
    }

    // Tie-break 2: fewer total tokens earned
    const tiedSortedByTokens = [...tied2].sort((a, b) => {
      const aTokens = this.totalTokensEarned.get(a.id) || 0;
      const bTokens = this.totalTokensEarned.get(b.id) || 0;
      return aTokens - bTokens;
    });

    const lowestTokens = this.totalTokensEarned.get(tiedSortedByTokens[0].id) || 0;
    const tied3 = tiedSortedByTokens.filter(p => (this.totalTokensEarned.get(p.id) || 0) === lowestTokens);

    if (tied3.length === 1) {
      this.tieBreakInfo = `Tie-break: Fewer tokens earned overall (${lowestTokens})`;
      return tied3[0];
    }

    // Tie-break 3: server random coin flip
    const victim = tied3[Math.floor(Math.random() * tied3.length)];
    this.tieBreakInfo = `Tie-break: Server random coin flip landed on ${victim.name}!`;
    return victim;
  }

  resolveWinnerBetween(p1, p2) {
    if (!p1) return p2;
    if (!p2) return p1;

    if (p1.totalScore > p2.totalScore) return p1;
    if (p2.totalScore > p1.totalScore) return p2;

    // Tie-break for winner:
    const p1Recent = (this.allScores.get(p1.id) || []).slice(-1)[0] || 0;
    const p2Recent = (this.allScores.get(p2.id) || []).slice(-1)[0] || 0;
    if (p1Recent > p2Recent) return p1;
    if (p2Recent > p1Recent) return p2;

    const p1Tokens = this.totalTokensEarned.get(p1.id) || 0;
    const p2Tokens = this.totalTokensEarned.get(p2.id) || 0;
    if (p1Tokens > p2Tokens) return p1;
    if (p2Tokens > p1Tokens) return p2;

    return Math.random() < 0.5 ? p1 : p2;
  }

  triggerGameOver(winner) {
    this.status = GAME_STATES.GAME_OVER;
    this.clearTimer();

    const finalStandings = this.getFinalStandings(winner);

    this.io.to(this.code).emit('game-over', {
      winner: this.getPublicPlayer(winner),
      finalStandings
    });

    // Auto-cleanup after 120s idle
    this.stateTimer = setTimeout(() => {
      this.destroy();
    }, TIMINGS.GAME_OVER_IDLE_TIMEOUT);
  }

  playAgain(requestingPlayerId) {
    if (requestingPlayerId !== this.hostId) {
      throw new Error('Only host can trigger Play Again.');
    }

    this.clearTimer();
    this.status = GAME_STATES.LOBBY;
    this.currentPhase = 1;
    this.currentRound = 1;
    this.globalRound = 0;
    this.eliminationOrder = [];
    this.carriedOverGlitches.clear();
    this.activeGlitches.clear();
    this.ghostGlitchUsed.clear();
    this.attackerGlitchedTargetsThisRound.clear();
    this.submittedScores.clear();
    this.tieBreakInfo = null;
    for (const t of this.activeGlitchTimeouts) clearTimeout(t);
    this.activeGlitchTimeouts = [];
    for (const t of this.botActionTimeouts) clearTimeout(t);
    this.botActionTimeouts = [];
    for (const t of this.disconnectTimers.values()) clearTimeout(t);
    this.disconnectTimers.clear();

    // Reset players
    for (const player of this.players.values()) {
      player.status = PLAYER_STATUS.WAITING;
      player.glitchTokens = 0;
      player.totalScore = 0;
      player.activeGlitches = [];
      this.phaseScores.set(player.id, 0);
      this.allScores.set(player.id, []);
      this.totalTokensEarned.set(player.id, 0);
    }

    this.io.to(this.code).emit('room-reset', {
      players: this.getPublicPlayersState(),
      hostId: this.hostId
    });

    this.resetLobbyIdleTimer();
  }

  // --- HELPERS ---

  getAlivePlayers() {
    return Array.from(this.players.values()).filter(p =>
      p.status === PLAYER_STATUS.PLAYING || (p.status === PLAYER_STATUS.DISCONNECTED && !this.eliminationOrder.includes(p.id))
    );
  }

  getStandings() {
    return Array.from(this.players.values())
      .map(p => ({
        ...this.getPublicPlayer(p),
        phaseScore: this.phaseScores.get(p.id) || 0,
        roundScores: this.allScores.get(p.id) || [],
        isNearElimination: false
      }))
      .sort((a, b) => b.phaseScore - a.phaseScore);
  }

  getFinalStandings(winner) {
    const list = Array.from(this.players.values());

    // Rank 1: winner
    // Ranks based on survival order and score
    return list.map(p => {
      const isWinner = winner && p.id === winner.id;
      let rank = 1;
      if (!isWinner) {
        const elimIndex = this.eliminationOrder.indexOf(p.id);
        if (elimIndex !== -1) {
          // Eliminated earlier = lower rank
          rank = list.length - elimIndex;
        } else {
          rank = 2;
        }
      }
      return {
        rank,
        id: p.id,
        name: p.name,
        color: p.color,
        isWinner,
        totalScore: p.totalScore,
        tokensEarned: this.totalTokensEarned.get(p.id) || 0,
        roundsSurvived: (this.allScores.get(p.id) || []).length
      };
    }).sort((a, b) => a.rank - b.rank || b.totalScore - a.totalScore);
  }

  getPublicPlayer(p) {
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      status: p.status,
      glitchTokens: p.glitchTokens,
      totalScore: p.totalScore,
      isHost: p.id === this.hostId,
      isBot: this.botIds.has(p.id)
    };
  }

  getPublicPlayersState() {
    return Array.from(this.players.values()).map(p => this.getPublicPlayer(p));
  }

  clearTimer() {
    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = null;
    }
  }

  resetLobbyIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.status === GAME_STATES.LOBBY) {
        this.destroy();
      }
    }, TIMINGS.LOBBY_IDLE_TIMEOUT);
  }

  scheduleEmptyRoomCleanup() {
    this.clearTimer();
    this.idleTimer = setTimeout(() => {
      if (this.players.size === 0) {
        this.destroy();
      }
    }, TIMINGS.EMPTY_ROOM_TIMEOUT);
  }

  destroy() {
    this.clearTimer();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    for (const t of this.activeGlitchTimeouts) clearTimeout(t);
    this.activeGlitchTimeouts = [];
    for (const t of this.botActionTimeouts) clearTimeout(t);
    this.botActionTimeouts = [];
    for (const t of this.disconnectTimers.values()) clearTimeout(t);
    this.disconnectTimers.clear();
    if (typeof this.onDestroy === 'function') {
      this.onDestroy(this.code);
    }
  }
}

module.exports = GameRoom;
