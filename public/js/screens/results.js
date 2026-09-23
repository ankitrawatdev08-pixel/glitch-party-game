// public/js/screens/results.js
import { sound } from '../audio.js';
import { generateAvatarSvg } from '../avatar.js';

export class ResultsScreen {
  constructor(container, { onPlayAgain, onNewRoom, onLeaveRoom }) {
    this.container = container;
    this.onPlayAgain = onPlayAgain;
    this.onNewRoom = onNewRoom;
    this.onLeaveRoom = onLeaveRoom;
  }

  show({ winner, finalStandings, isHost }) {
    sound.playVictory();

    this.container.innerHTML = `
      <div class="results-screen-wrap">
        <!-- Confetti Particle Container -->
        <div class="confetti-container" id="confetti-container"></div>

        <div class="results-card glass-panel">
          <!-- Winner Celebration Banner -->
          <header class="winner-hero">
            <div class="crown-wrapper">
              <svg width="64" height="48" viewBox="0 0 64 48" fill="none" class="animated-crown" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 38L12 12L26 26L32 6L38 26L52 12L60 38H4Z" fill="#FBBF24" stroke="#F59E0B" stroke-width="2.5" stroke-linejoin="round"/>
                <circle cx="12" cy="12" r="3" fill="#06F9EC"/>
                <circle cx="32" cy="6" r="3.5" fill="#F43F7A"/>
                <circle cx="52" cy="12" r="3" fill="#06F9EC"/>
              </svg>
            </div>

            <div class="winner-avatar-wrap">
              ${winner ? generateAvatarSvg(winner.color, winner.id, 88) : ''}
            </div>

            <h1 class="winner-title">
              <span class="trophy-emoji">🏆</span>
              <span class="winner-name">${winner ? winner.name : 'PLAYER'}</span>
              <span class="wins-text">WINS!</span>
            </h1>
            <p class="winner-sub">The ultimate survivor of the glitch chaos</p>
          </header>

          <!-- Final Standings Table -->
          <section class="standings-table-section">
            <h2 class="table-heading">FINAL STANDINGS</h2>
            <div class="standings-table">
              <div class="table-header-row">
                <span class="th-rank">RANK</span>
                <span class="th-player">PLAYER</span>
                <span class="th-score">TOTAL SCORE</span>
                <span class="th-rounds">ROUNDS</span>
                <span class="th-tokens">TOKENS</span>
              </div>

              <div class="table-body">
                ${(finalStandings || []).map((p) => {
                  const isGold = p.rank === 1;
                  return `
                    <div class="table-row ${isGold ? 'row-winner' : ''}">
                      <div class="td-rank">
                        ${isGold ? '<span class="gold-badge">1st</span>' : `#${p.rank}`}
                      </div>
                      <div class="td-player">
                        <div class="avatar-cell">
                          ${generateAvatarSvg(p.color, p.id, 32)}
                        </div>
                        <span class="name-cell">${p.name}</span>
                      </div>
                      <div class="td-score">
                        <strong>${p.totalScore}</strong>
                      </div>
                      <div class="td-rounds">
                        ${p.roundsSurvived}
                      </div>
                      <div class="td-tokens">
                        🪙 ${p.tokensEarned}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </section>

          <!-- Action Buttons -->
          <footer class="results-actions">
            ${isHost ? `
              <button id="btn-play-again" class="btn btn-primary btn-large glow-pulse">
                <span>PLAY AGAIN</span>
              </button>
            ` : `
              <p class="guest-reset-hint">Waiting for host to restart or choose new room...</p>
            `}
            <button id="btn-new-room" class="btn btn-secondary">
              <span>NEW ROOM</span>
            </button>
            <button id="btn-leave-results" class="btn-text-link">
              Leave Game
            </button>
          </footer>
        </div>
      </div>
    `;

    this.spawnConfetti();
    this.bindEvents();
  }

  spawnConfetti() {
    const container = this.container.querySelector('#confetti-container');
    if (!container) return;

    const colors = ['#06F9EC', '#F43F7A', '#FBBF24', '#8B5CF6', '#10B981', '#FFFFFF'];
    const count = 60;

    for (let i = 0; i < count; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti-piece';
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = `${Math.random() * 3}s`;
      confetti.style.animationDuration = `${2.5 + Math.random() * 2.5}s`;
      confetti.style.transform = `scale(${0.6 + Math.random() * 0.8})`;
      container.appendChild(confetti);
    }
  }

  bindEvents() {
    const btnPlayAgain = this.container.querySelector('#btn-play-again');
    const btnNewRoom = this.container.querySelector('#btn-new-room');
    const btnLeave = this.container.querySelector('#btn-leave-results');

    if (btnPlayAgain) {
      btnPlayAgain.addEventListener('click', () => {
        sound.playClick();
        this.onPlayAgain();
      });
    }

    if (btnNewRoom) {
      btnNewRoom.addEventListener('click', () => {
        sound.playClick();
        this.onNewRoom();
      });
    }

    if (btnLeave) {
      btnLeave.addEventListener('click', () => {
        sound.playClick();
        this.onLeaveRoom();
      });
    }
  }
}
