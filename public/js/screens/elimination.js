// public/js/screens/elimination.js
import { sound } from '../audio.js';
import { generateAvatarSvg } from '../avatar.js';

export class EliminationScreen {
  constructor(container) {
    this.container = container;
  }

  show({ eliminatedPlayerId, eliminatedPlayerName, tieBreakInfo, remainingCount, isNextShowdown, standings, myPlayerId }) {
    sound.playElimination();

    const isMe = eliminatedPlayerId === myPlayerId;
    const eliminatedPlayer = (standings || []).find(p => p.id === eliminatedPlayerId) || {
      id: eliminatedPlayerId,
      name: eliminatedPlayerName,
      color: '#F43F7A'
    };

    this.container.innerHTML = `
      <div class="elimination-screen-wrap ${isMe ? 'eliminated-is-me' : ''}">
        <div class="elim-spotlight"></div>

        <div class="elim-card glass-panel">
          <header class="elim-header">
            <h1 class="elim-banner-title glitch-heavy" data-text="GLITCHED OUT">GLITCHED OUT</h1>
            <p class="elim-subtitle">Lowest Phase Performer Eliminated</p>
          </header>

          <!-- Shattering Avatar Container -->
          <div class="shatter-avatar-stage">
            <div class="shatter-shards-wrapper">
              <div class="shard shard-1"></div>
              <div class="shard shard-2"></div>
              <div class="shard shard-3"></div>
              <div class="shard shard-4"></div>
              <div class="shard shard-5"></div>
              <div class="shard shard-6"></div>
            </div>
            <div class="victim-avatar-wrap">
              ${generateAvatarSvg(eliminatedPlayer.color, eliminatedPlayer.id, 96)}
            </div>
          </div>

          <div class="elim-victim-meta">
            <h2 class="victim-name">${eliminatedPlayer.name}</h2>
            ${tieBreakInfo ? `<p class="tie-break-note">${tieBreakInfo}</p>` : ''}
          </div>

          <!-- Ghost Mode / Survivor Notice -->
          <div class="elim-status-notice">
            ${isMe ? `
              <div class="ghost-awakening-box glow-pulse-pink">
                <span class="ghost-icon-big">👻</span>
                <h3>YOU ARE NOW A GHOST!</h3>
                <p>Death is not the end. You get <strong>1 FREE GLITCH</strong> each round to haunt survivors and alter the fate of the game!</p>
              </div>
            ` : `
              <div class="survivor-count-box">
                <span class="count-num">${remainingCount}</span>
                <span class="count-label">PLAYERS REMAIN STANDING</span>
                ${isNextShowdown ? '<p class="showdown-alert">⚡ NEXT UP: THE 1v1 FINAL SHOWDOWN! ⚡</p>' : ''}
              </div>
            `}
          </div>

          <div class="elim-timer-bar">
            <div class="elim-timer-fill"></div>
          </div>
        </div>
      </div>
    `;

    // Screen shake effect
    this.container.classList.add('screen-shake');
    setTimeout(() => {
      this.container.classList.remove('screen-shake');
    }, 600);
  }
}
