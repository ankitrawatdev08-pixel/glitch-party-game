// public/js/screens/lobby.js
import { sound } from '../audio.js';
import { generateAvatarSvg } from '../avatar.js';
import { copyToClipboard } from '../utils.js';
import { HowToPlayModal } from '../components/howToPlayModal.js';

export class LobbyScreen {
  constructor(container, { onStartGame, onLeaveRoom, onAddBot, onRemoveBot }) {
    this.container = container;
    this.onStartGame = onStartGame;
    this.onLeaveRoom = onLeaveRoom;
    this.onAddBot = onAddBot || (() => {});
    this.onRemoveBot = onRemoveBot || (() => {});
    this.roomCode = '';
    this.players = [];
    this.hostId = '';
    this.myPlayerId = '';
  }

  updateData({ roomCode, players, hostId, myPlayerId }) {
    this.roomCode = roomCode || this.roomCode;
    this.players = players || this.players;
    this.hostId = hostId || this.hostId;
    this.myPlayerId = myPlayerId || this.myPlayerId;
    this.render();
  }

  render() {
    const isHost = this.myPlayerId === this.hostId;
    const count = this.players.length;
    const canStart = count >= 2;

    this.container.innerHTML = `
      <div class="lobby-card glass-panel">
        <header class="lobby-header">
          <span class="badge-pill">ROOM CODE</span>
          <div class="room-code-wrapper" id="copy-code-btn" title="Tap to copy room code">
            <span class="room-code-text">${this.roomCode}</span>
            <span class="copy-icon">📋</span>
            <div id="copy-tooltip" class="copy-tooltip">COPIED!</div>
          </div>
          <p class="lobby-subtitle">Share this 4-letter code with your friends</p>
          <div class="lobby-htp-wrap">
            <button id="btn-lobby-how-to-play" class="btn-htp-trigger btn-htp-compact" type="button">
              <span class="htp-btn-icon">📖</span>
              <span class="htp-btn-text">HOW TO PLAY (RULES)</span>
            </button>
          </div>
        </header>

        <section class="player-roster-section">
          <div class="roster-meta">
            <span class="roster-title">PLAYERS IN LOBBY</span>
            <span class="roster-count badge-accent">${count}/8</span>
          </div>

          <div class="player-cards-grid" id="player-cards-grid">
            ${this.players.map((p) => {
              const isThisHost = p.id === this.hostId;
              const isMe = p.id === this.myPlayerId;
              const avatarSvg = generateAvatarSvg(p.color, p.id, 56);

              return `
                <div class="player-card ${isMe ? 'player-card-me' : ''} ${p.isBot ? 'player-card-bot' : ''}" data-player-id="${p.id}">
                  <div class="player-avatar-wrap">
                    ${avatarSvg}
                  </div>
                  <div class="player-info">
                    <div class="player-name-row">
                      <span class="player-name">${p.name}</span>
                      ${isMe ? '<span class="you-tag">(YOU)</span>' : ''}
                    </div>
                    ${isThisHost ? '<span class="host-badge">HOST</span>' : '<span class="status-dot-ready">READY</span>'}
                  </div>
                  ${isHost && p.isBot ? `<button class="btn-remove-bot" data-bot-id="${p.id}" title="Remove bot">\u2715</button>` : ''}
                </div>
              `;
            }).join('')}
          </div>

          ${isHost && count < 8 ? `
            <button id="btn-add-bot" class="btn btn-add-bot" type="button">
              <span>\u{1F916}</span> <span>+ Add Bot</span>
            </button>
          ` : ''}
        </section>

        <footer class="lobby-footer">
          ${isHost ? `
            <div class="host-controls">
              <button 
                id="btn-start-game" 
                class="btn btn-primary btn-large btn-start-glow ${canStart ? 'glow-pulse' : 'btn-disabled'}"
                ${!canStart ? 'disabled' : ''}
              >
                <span>START GAME</span>
              </button>
              ${!canStart ? '<p class="host-hint">Need at least 2 players to begin</p>' : ''}
            </div>
          ` : `
            <div class="guest-waiting-box">
              <div class="loading-spinner"></div>
              <p class="waiting-text">Waiting for host to start...</p>
            </div>
          `}

          <button id="btn-leave-room" class="btn-text-link">
            Leave Room
          </button>
        </footer>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const copyBtn = this.container.querySelector('#copy-code-btn');
    const copyTooltip = this.container.querySelector('#copy-tooltip');
    const btnStart = this.container.querySelector('#btn-start-game');
    const btnLeave = this.container.querySelector('#btn-leave-room');
    const btnHtp = this.container.querySelector('#btn-lobby-how-to-play');

    if (btnHtp) {
      btnHtp.addEventListener('click', () => {
        HowToPlayModal.open();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        sound.playClick();
        await copyToClipboard(this.roomCode, copyTooltip);
      });
    }

    if (btnStart) {
      btnStart.addEventListener('click', () => {
        if (this.players.length < 2) return;
        sound.playClick();
        this.onStartGame();
      });
    }

    if (btnLeave) {
      btnLeave.addEventListener('click', () => {
        sound.playClick();
        this.onLeaveRoom();
      });
    }

    // Bot controls (host only)
    const btnAddBot = this.container.querySelector('#btn-add-bot');
    if (btnAddBot) {
      btnAddBot.addEventListener('click', () => {
        sound.playClick();
        this.onAddBot();
      });
    }

    const removeBotBtns = this.container.querySelectorAll('.btn-remove-bot');
    removeBotBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.playClick();
        const botId = btn.getAttribute('data-bot-id');
        if (botId) this.onRemoveBot(botId);
      });
    });
  }
}
