// public/js/app.js
// Main client entrypoint for GLITCH Party Game

import { sound } from './audio.js';
import {
  $,
  getStoredPlayerId,
  setStoredPlayerId,
  getStoredRoomCode,
  setStoredRoomCode,
  clearSession,
  showToast
} from './utils.js';

import { LandingScreen } from './screens/landing.js';
import { LobbyScreen } from './screens/lobby.js';
import { GameScreenManager } from './screens/game.js';
import { EliminationScreen } from './screens/elimination.js';
import { ResultsScreen } from './screens/results.js';

class GlitchApp {
  constructor() {
    this.socket = null;
    this.currentScreenId = null;

    this.roomCode = null;
    this.playerId = null;
    this.hostId = null;
    this.players = [];

    // Current round info for instant game start
    this.currentMiniGameId = null;
    this.currentMiniGameConfig = null;

    this.screenContainer = $('#app-screen-container');
    this.initScreens();
    this.initSocket();
    this.initAudioUnlock();
    this.initVisibilityListener();
  }

  initScreens() {
    this.landingScreen = new LandingScreen(this.screenContainer, {
      onCreateRoom: (name) => this.socket.emit('create-room', { playerName: name }),
      onJoinRoom: (code, name) => this.socket.emit('join-room', { roomCode: code, playerName: name, playerId: this.playerId })
    });

    this.lobbyScreen = new LobbyScreen(this.screenContainer, {
      onStartGame: () => this.socket.emit('start-game'),
      onLeaveRoom: () => this.leaveRoom(),
      onAddBot: () => this.socket.emit('add-bot'),
      onRemoveBot: (botId) => this.socket.emit('remove-bot', { botId })
    });

    this.gameScreen = new GameScreenManager(this.screenContainer, {
      onSendGlitch: (targetPlayerId) => this.socket.emit('send-glitch', { targetPlayerId }),
      onSubmitScore: (roundData) => this.socket.emit('submit-score', { roundData })
    });

    this.eliminationScreen = new EliminationScreen(this.screenContainer);

    this.resultsScreen = new ResultsScreen(this.screenContainer, {
      onPlayAgain: () => this.socket.emit('play-again'),
      onNewRoom: () => this.leaveRoom(),
      onLeaveRoom: () => this.leaveRoom()
    });
  }

  initAudioUnlock() {
    const unlock = () => {
      sound.init();
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('keydown', unlock);
  }

  initVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Tab hidden - client remains connected via socket, pauses animation timers
      }
    });
  }

  initSocket() {
    this.socket = io({
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    // Check reconnection on connect
    this.socket.on('connect', () => {
      const storedId = getStoredPlayerId();
      const storedCode = getStoredRoomCode();
      if (storedId && storedCode && !this.roomCode) {
        this.socket.emit('join-room', {
          roomCode: storedCode,
          playerName: '',
          playerId: storedId
        });
      }
    });

    // ROOM CREATED
    this.socket.on('room-created', (data) => {
      this.roomCode = data.roomCode;
      this.playerId = data.playerId;
      this.hostId = data.hostId;
      this.players = data.players;

      setStoredPlayerId(this.playerId);
      setStoredRoomCode(this.roomCode);
      this.gameScreen.setPlayerId(this.playerId);

      this.switchScreen('lobby', () => {
        this.lobbyScreen.updateData({
          roomCode: this.roomCode,
          players: this.players,
          hostId: this.hostId,
          myPlayerId: this.playerId
        });
      });
    });

    // ROOM JOINED
    this.socket.on('room-joined', (data) => {
      this.roomCode = data.roomCode;
      this.playerId = data.playerId;
      this.hostId = data.hostId;
      this.players = data.players;

      setStoredPlayerId(this.playerId);
      setStoredRoomCode(this.roomCode);
      this.gameScreen.setPlayerId(this.playerId);

      this.switchScreen('lobby', () => {
        this.lobbyScreen.updateData({
          roomCode: this.roomCode,
          players: this.players,
          hostId: this.hostId,
          myPlayerId: this.playerId
        });
      });
    });

    // PLAYER JOINED
    this.socket.on('player-joined', (data) => {
      if (!this.players.some(p => p.id === data.player.id)) {
        this.players.push(data.player);
      }
      sound.playClick();
      if (this.currentScreenId === 'lobby') {
        this.lobbyScreen.updateData({
          roomCode: this.roomCode,
          players: this.players,
          hostId: this.hostId,
          myPlayerId: this.playerId
        });
      }
      showToast(`${data.player.name} joined the room!`, 'info');
    });

    // PLAYER LEFT
    this.socket.on('player-left', (data) => {
      this.players = this.players.filter(p => p.id !== data.playerId);
      if (this.currentScreenId === 'lobby') {
        this.lobbyScreen.updateData({
          roomCode: this.roomCode,
          players: this.players,
          hostId: this.hostId,
          myPlayerId: this.playerId
        });
      }
    });

    // HOST CHANGED
    this.socket.on('host-changed', (data) => {
      this.hostId = data.newHostId;
      const hostPlayer = this.players.find(p => p.id === this.hostId);
      const hostName = hostPlayer ? hostPlayer.name : 'Another player';
      showToast(`${hostName} is now the host!`, 'warning');

      if (this.currentScreenId === 'lobby') {
        this.lobbyScreen.updateData({
          roomCode: this.roomCode,
          players: this.players,
          hostId: this.hostId,
          myPlayerId: this.playerId
        });
      }
    });

    // GAME STARTING
    this.socket.on('game-starting', () => {
      showToast('Game is starting! Prepare for micro-challenges...', 'success');
    });

    // PRE-ROUND
    this.socket.on('pre-round', (data) => {
      this.currentMiniGameId = data.miniGame.id;
      this.currentMiniGameConfig = data.miniGameConfig;

      this.switchScreen('game', () => {
        this.gameScreen.showPreRound(data);
      });
    });

    // GLITCH INCOMING
    this.socket.on('glitch-incoming', (data) => {
      const fromName = data.fromPlayerName || data.attackerName || 'Opponent';
      this.gameScreen.notifyGlitchIncoming(data.glitchType, fromName, data.remainingOwedMs, data.isGhost);
    });

    // GLITCH CONFIRMED
    this.socket.on('glitch-confirmed', (data) => {
      const remainingTokens = data.remainingTokens !== undefined ? data.remainingTokens : data.tokensLeft;
      this.gameScreen.notifyGlitchConfirmed(data.targetPlayerId, data.targetPlayerName, data.glitchType, remainingTokens, data.isGhost);
    });

    // ACTIVE GLITCHES UPDATED
    this.socket.on('active-glitches-updated', (data) => {
      this.gameScreen.updateActiveGlitches(data.activeGlitches);
    });

    // ROUND START
    this.socket.on('round-start', (data) => {
      this.gameScreen.showRound(data, this.currentMiniGameId, this.currentMiniGameConfig);
    });

    // ROUND END
    this.socket.on('round-end', () => {
      this.gameScreen.endRound();
    });

    // ROUND RESULTS
    this.socket.on('round-results', (data) => {
      this.gameScreen.showPostRound(data);
    });

    // ELIMINATION
    this.socket.on('elimination', (data) => {
      this.switchScreen('elimination', () => {
        this.eliminationScreen.show({
          ...data,
          myPlayerId: this.playerId
        });
      });
    });

    // SHOWDOWN START
    this.socket.on('showdown-start', (data) => {
      showToast(`FINAL SHOWDOWN: ${data.player1.name} VS ${data.player2.name}!`, 'danger');
    });

    // GAME OVER
    this.socket.on('game-over', (data) => {
      this.switchScreen('results', () => {
        this.resultsScreen.show({
          winner: data.winner,
          finalStandings: data.finalStandings,
          isHost: this.playerId === this.hostId
        });
      });
    });

    // ROOM RESET (Play Again)
    this.socket.on('room-reset', (data) => {
      this.players = data.players;
      this.hostId = data.hostId;
      this.switchScreen('lobby', () => {
        this.lobbyScreen.updateData({
          roomCode: this.roomCode,
          players: this.players,
          hostId: this.hostId,
          myPlayerId: this.playerId
        });
      });
      showToast('Game reset! Ready for a rematch.', 'info');
    });

    // DISCONNECT & RECONNECT NOTIFICATIONS
    this.socket.on('player-disconnected', (data) => {
      showToast(`${data.playerName} disconnected (30s grace window)`, 'warning');
    });

    this.socket.on('player-reconnected', (data) => {
      showToast(`${data.playerName} reconnected!`, 'success');
    });

    // ERROR
    this.socket.on('error', (err) => {
      if (this.currentScreenId === 'landing') {
        this.landingScreen.showError(err.message);
      } else {
        showToast(err.message, 'danger');
        if (this.gameScreen && typeof this.gameScreen.handleGlitchError === 'function') {
          this.gameScreen.handleGlitchError(err.message, err.targetPlayerId);
        }
      }
    });

    // Initial render
    this.switchScreen('landing', () => {
      this.landingScreen.render();
    });
  }

  switchScreen(screenId, renderCallback) {
    // Screen transition with subtle glitch-flicker effect (150ms)
    this.screenContainer.classList.add('screen-glitch-transition');

    setTimeout(() => {
      this.currentScreenId = screenId;
      if (typeof renderCallback === 'function') {
        renderCallback();
      }
      setTimeout(() => {
        this.screenContainer.classList.remove('screen-glitch-transition');
      }, 80);
    }, 70);
  }

  leaveRoom() {
    this.socket.emit('leave-room');
    clearSession();
    this.roomCode = null;
    this.playerId = null;
    this.hostId = null;
    this.players = [];
    this.switchScreen('landing', () => {
      this.landingScreen.render();
    });
  }
}

// Start application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.glitchApp = new GlitchApp();
});
