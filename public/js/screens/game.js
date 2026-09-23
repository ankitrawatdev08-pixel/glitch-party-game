// public/js/screens/game.js
import { sound } from '../audio.js';
import { generateAvatarSvg } from '../avatar.js';
import { GLITCH_METADATA, glitchManager } from '../glitch.js';

// Minigame instances map
import { TargetTapGame } from '../minigames/targetTap.js';
import { ColorMatchGame } from '../minigames/colorMatch.js';
import { SequenceMemoryGame } from '../minigames/sequenceMemory.js';
import { QuickMathGame } from '../minigames/quickMath.js';
import { OddOneOutGame } from '../minigames/oddOneOut.js';
import { TracePathGame } from '../minigames/tracePath.js';

export class GameScreenManager {
  constructor(container, { onSendGlitch, onSubmitScore }) {
    this.container = container;
    this.onSendGlitch = onSendGlitch;
    this.onSubmitScore = onSubmitScore;

    this.myPlayerId = '';
    this.currentMiniGameInstance = null;
    this.preRoundTimer = null;
    this.roundTimer = null;
    this.postRoundTimer = null;

    // Pre-round targeting state
    this.selectedTargetId = null;
    this.selectedGlitchType = null;
    this.incomingGlitches = [];
  }

  setPlayerId(id) {
    this.myPlayerId = id;
  }

  // --- 1. PRE-ROUND SCREEN ---

  showPreRound(data) {
    this.cleanupCurrentGame();
    this.incomingGlitches = [];
    this.selectedTargetId = null;
    this.selectedGlitchType = null;

    const me = (data.players || []).find(p => p.id === this.myPlayerId) || {};
    const isGhost = me.status === 'ELIMINATED';
    const tokens = me.glitchTokens || 0;
    const canGlitch = isGhost || tokens >= 1;
    const isShowdown = data.isShowdown;

    // Filter alive opponents
    const opponents = (data.players || []).filter(p => p.id !== this.myPlayerId && p.status !== 'ELIMINATED');

    this.container.innerHTML = `
      <div class="preround-container glass-panel">
        <header class="preround-header">
          <div class="round-badge-group">
            <span class="badge-phase">PHASE ${data.phase} OF ${data.totalPhases}</span>
            <span class="badge-round">ROUND ${data.roundNumber} OF 3 (GLOBAL #${data.globalRound})</span>
            ${isShowdown ? '<span class="badge-showdown">⚡ FINAL SHOWDOWN ⚡</span>' : ''}
          </div>
          <div class="preround-countdown-ring">
            <span id="preround-countdown" class="preround-num">3</span>
          </div>
        </header>

        <!-- Minigame Preview Card -->
        <section class="minigame-preview-card">
          <div class="mg-icon-circle">${data.miniGame.icon}</div>
          <div class="mg-meta">
            <h2 class="mg-title">${data.miniGame.name}</h2>
            <p class="mg-desc">${data.miniGame.instruction}</p>
          </div>
        </section>

        <!-- Incoming Glitches Alert Area -->
        <div id="incoming-glitches-alert" class="incoming-glitches-box hidden"></div>

        <!-- Sabotage Glitch Console -->
        <section class="sabotage-console">
          <div class="sabotage-header">
            <div class="sabotage-title-row">
              <span class="console-title">${isGhost ? '👻 GHOST SABOTAGE' : '⚡ SPEND GLITCH TOKENS'}</span>
              <span class="token-balance-badge" id="token-balance-badge">
                ${isGhost ? '1 FREE GHOST GLITCH' : `🪙 ${tokens} TOKENS`}
              </span>
            </div>
            <p class="console-subtitle">
              ${isGhost ? (isShowdown ? 'Ghost glitches disabled during Showdown' : 'Select an alive player & choose an attack') : 'Sabotage an opponent’s screen in real-time'}
            </p>
          </div>

          ${canGlitch && opponents.length > 0 && !(isGhost && isShowdown) ? `
            <div class="targeting-flow">
              <!-- Target Selection -->
              <div class="target-select-row">
                <span class="flow-label">1. CHOOSE TARGET:</span>
                <div class="target-avatars-row">
                  ${opponents.map(opp => `
                    <button class="target-avatar-btn" data-target-id="${opp.id}" title="${opp.name}">
                      <div class="avatar-mini">
                        ${generateAvatarSvg(opp.color, opp.id, 40)}
                      </div>
                      <span class="target-name">${opp.name}</span>
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- Glitch Type Selection -->
              <div class="glitch-select-row">
                <span class="flow-label">2. CHOOSE SABOTAGE (1 TOKEN):</span>
                <div class="glitch-types-row">
                  ${Object.values(GLITCH_METADATA).map(g => `
                    <button class="glitch-type-btn" data-glitch-id="${g.id}" title="${g.name}: ${g.desc}">
                      <span class="g-icon">${g.icon}</span>
                      <span class="g-name">${g.name}</span>
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- Submit Attack -->
              <div class="attack-action-row">
                <button id="btn-fire-glitch" class="btn btn-primary btn-attack btn-disabled" disabled>
                  <span>SEND SABOTAGE ⚡</span>
                </button>
                <div id="glitch-action-feedback" class="action-feedback"></div>
              </div>
            </div>
          ` : `
            <div class="no-tokens-box">
              <p>${isGhost && isShowdown ? 'Ghost glitches are disabled during the 1v1 Final Showdown.' : (isGhost ? 'No alive opponents to haunt.' : 'Score 50+ in challenges to earn Glitch Tokens!')}</p>
            </div>
          `}
        </section>
      </div>
    `;

    this.bindPreRoundEvents(me, isGhost);

    // 3-second visual countdown with ticks
    let secondsLeft = Math.floor((data.duration || 3000) / 1000);
    const countdownEl = this.container.querySelector('#preround-countdown');

    sound.playTick();
    this.preRoundTimer = setInterval(() => {
      secondsLeft--;
      if (secondsLeft > 0) {
        if (countdownEl) countdownEl.textContent = secondsLeft;
        sound.playTick();
      } else {
        clearInterval(this.preRoundTimer);
        this.preRoundTimer = null;
      }
    }, 1000);
  }

  bindPreRoundEvents(me, isGhost) {
    const targetBtns = this.container.querySelectorAll('.target-avatar-btn');
    const glitchBtns = this.container.querySelectorAll('.glitch-type-btn');
    const fireBtn = this.container.querySelector('#btn-fire-glitch');
    const feedbackEl = this.container.querySelector('#glitch-action-feedback');

    const updateFireBtnState = () => {
      if (!fireBtn) return;
      if (this.selectedTargetId && this.selectedGlitchType) {
        fireBtn.disabled = false;
        fireBtn.classList.remove('btn-disabled');
      } else {
        fireBtn.disabled = true;
        fireBtn.classList.add('btn-disabled');
      }
    };

    targetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        targetBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedTargetId = btn.getAttribute('data-target-id');
        updateFireBtnState();
      });
    });

    glitchBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        glitchBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedGlitchType = btn.getAttribute('data-glitch-id');
        updateFireBtnState();
      });
    });

    if (fireBtn) {
      fireBtn.addEventListener('click', () => {
        if (!this.selectedTargetId || !this.selectedGlitchType) return;
        sound.playClick();

        if (isGhost) {
          sound.playGhostGlitch();
        }

        this.onSendGlitch(this.selectedTargetId, this.selectedGlitchType);
        fireBtn.disabled = true;
        fireBtn.classList.add('btn-disabled');
        if (feedbackEl) {
          feedbackEl.textContent = 'Attack launched! ⚡';
          feedbackEl.className = 'action-feedback text-success';
        }
      });
    }
  }

  notifyGlitchIncoming(glitchType, fromPlayerName) {
    sound.playGlitchHit();
    const alertBox = this.container.querySelector('#incoming-glitches-alert');
    if (!alertBox) return;

    alertBox.classList.remove('hidden');
    const meta = GLITCH_METADATA[glitchType] || { name: glitchType, icon: '⚡' };
    const alertItem = document.createElement('div');
    alertItem.className = 'incoming-alert-pill glow-pulse-pink';
    alertItem.innerHTML = `
      <span>⚠️ <strong>${fromPlayerName}</strong> glitched you with <strong>${meta.icon} ${meta.name}</strong>!</span>
    `;
    alertBox.appendChild(alertItem);
  }

  notifyGlitchConfirmed(targetPlayerId, glitchType, remainingTokens) {
    const feedbackEl = this.container.querySelector('#glitch-action-feedback');
    const badge = this.container.querySelector('#token-balance-badge');
    const meta = GLITCH_METADATA[glitchType] || { name: glitchType };

    if (badge && remainingTokens !== undefined) {
      badge.textContent = `🪙 ${remainingTokens} TOKENS`;
    }
    if (feedbackEl) {
      feedbackEl.textContent = `Sent ${meta.name}!`;
      feedbackEl.className = 'action-feedback text-success';
    }
  }

  // --- 2. GAMEPLAY SCREEN (ROUND ACTIVE) ---

  showRound(data, miniGameId, miniGameConfig) {
    this.cleanupCurrentGame();
    sound.playRoundStart();

    // Check my active glitches
    const activeGlitchesForMe = (data.activeGlitches && data.activeGlitches[this.myPlayerId]) || [];

    this.container.innerHTML = `
      <div class="gameplay-wrapper" id="gameplay-wrapper">
        <!-- Top HUD Bar -->
        <header class="gameplay-hud">
          <div class="hud-left">
            <span class="hud-score-label">SCORE:</span>
            <span id="hud-current-score" class="hud-score-val">0</span>
          </div>

          <div class="hud-center">
            <div class="hud-timer-badge" id="hud-timer-badge">
              <span id="hud-timer-num">8</span>s
            </div>
          </div>

          <div class="hud-right" id="active-glitches-hud"></div>
        </header>

        <!-- Canvas Container with glitch transforms -->
        <div class="game-canvas-container" id="game-canvas-container">
          <canvas id="minigame-canvas"></canvas>
          <div id="game-freeze-overlay" class="game-freeze-overlay hidden">
            <span class="freeze-text">TIME!</span>
          </div>
        </div>
      </div>
    `;

    const canvas = this.container.querySelector('#minigame-canvas');
    const canvasContainer = this.container.querySelector('#game-canvas-container');
    const hudScore = this.container.querySelector('#hud-current-score');
    const timerNum = this.container.querySelector('#hud-timer-num');
    const timerBadge = this.container.querySelector('#hud-timer-badge');

    // Apply active glitches visually & to input/modifiers
    glitchManager.applyGlitches(activeGlitchesForMe, canvasContainer);

    // Instantiate appropriate minigame
    const onScoreTick = (score) => {
      if (hudScore) hudScore.textContent = score;
      // Send live score progress to server
      if (this.currentMiniGameInstance) {
        this.onSubmitScore(this.currentMiniGameInstance.getRawData());
      }
    };

    switch (miniGameId) {
      case 'targetTap':
        this.currentMiniGameInstance = new TargetTapGame(canvas, onScoreTick);
        break;
      case 'colorMatch':
        this.currentMiniGameInstance = new ColorMatchGame(canvas, onScoreTick);
        break;
      case 'sequenceMemory':
        this.currentMiniGameInstance = new SequenceMemoryGame(canvas, onScoreTick);
        break;
      case 'quickMath':
        this.currentMiniGameInstance = new QuickMathGame(canvas, onScoreTick);
        break;
      case 'oddOneOut':
        this.currentMiniGameInstance = new OddOneOutGame(canvas, onScoreTick);
        break;
      case 'tracePath':
        this.currentMiniGameInstance = new TracePathGame(canvas, onScoreTick);
        break;
      default:
        this.currentMiniGameInstance = new TargetTapGame(canvas, onScoreTick);
    }

    this.currentMiniGameInstance.start(miniGameConfig);

    // 8-second synchronized timer countdown
    const roundDurationSec = Math.floor((data.duration || 8000) / 1000);
    let secondsLeft = roundDurationSec;

    this.roundTimer = setInterval(() => {
      secondsLeft--;
      if (secondsLeft >= 0) {
        if (timerNum) timerNum.textContent = secondsLeft;
        if (secondsLeft <= 3 && timerBadge) {
          timerBadge.classList.add('timer-warning');
          sound.playTick();
        }
      }
      if (secondsLeft <= 0) {
        clearInterval(this.roundTimer);
        this.roundTimer = null;
      }
    }, 1000);
  }

  endRound() {
    sound.playRoundEnd();

    // Freeze minigame
    if (this.currentMiniGameInstance) {
      const finalRawData = this.currentMiniGameInstance.getRawData();
      this.onSubmitScore(finalRawData);
      this.currentMiniGameInstance.stop();
    }

    // Clear glitch visual classes
    glitchManager.clearGlitches();

    // Show "TIME!" freeze banner
    const freezeOverlay = this.container.querySelector('#game-freeze-overlay');
    if (freezeOverlay) {
      freezeOverlay.classList.remove('hidden');
    }
  }

  // --- 3. POST-ROUND SCREEN ---

  showPostRound(data) {
    this.cleanupCurrentGame();

    const myScore = (data.scores && data.scores[this.myPlayerId]) !== undefined
      ? data.scores[this.myPlayerId]
      : 0;

    const myTokensEarned = (data.tokenChanges && data.tokenChanges[this.myPlayerId]) || 0;

    if (myTokensEarned > 0) {
      sound.playTokenEarned();
    } else {
      sound.playScoreChime();
    }

    // Separate alive vs ghost players in standings
    const aliveStandings = (data.standings || []).filter(p => p.status !== 'ELIMINATED');
    const ghostStandings = (data.standings || []).filter(p => p.status === 'ELIMINATED');

    // Lowest phase score alive players flagged near elimination
    const minPhaseScore = aliveStandings.length > 0
      ? Math.min(...aliveStandings.map(p => p.phaseScore))
      : 0;

    this.container.innerHTML = `
      <div class="postround-container glass-panel">
        <header class="postround-header">
          <span class="badge-pill">ROUND ${data.roundNumber} COMPLETED</span>
          <h2 class="postround-title">ROUND PERFORMANCE</h2>
        </header>

        <!-- Your Score Callout -->
        <section class="personal-score-box">
          <div class="score-dial">
            <span class="score-number-big" id="dial-score-num">0</span>
            <span class="score-max">/100</span>
          </div>

          <div class="token-reward-row">
            ${myTokensEarned > 0 ? `
              <div class="token-earn-banner glow-pulse">
                <span class="coin-icon">🪙</span>
                <span>+${myTokensEarned} GLITCH TOKENS EARNED!</span>
              </div>
            ` : `
              <div class="token-no-earn">
                <span>Score 50+ to earn Glitch Tokens</span>
              </div>
            `}
          </div>
        </section>

        <!-- Phase Leaderboard -->
        <section class="phase-leaderboard-section">
          <div class="lb-title-row">
            <span class="lb-title">PHASE ${data.phase} STANDINGS (CUMULATIVE)</span>
            <span class="lb-hint">Lowest cumulative score faces elimination!</span>
          </div>

          <div class="standings-list">
            ${aliveStandings.map((p, idx) => {
              const isDanger = p.phaseScore === minPhaseScore && aliveStandings.length > 2;
              const isMe = p.id === this.myPlayerId;

              return `
                <div class="standing-row ${isDanger ? 'row-danger' : ''} ${isMe ? 'row-me' : ''}">
                  <div class="rank-col">#${idx + 1}</div>
                  <div class="avatar-col">${generateAvatarSvg(p.color, p.id, 38)}</div>
                  <div class="name-col">
                    <span class="s-name">${p.name}</span>
                    ${isMe ? '<span class="you-tag">(YOU)</span>' : ''}
                    ${isDanger ? '<span class="danger-tag">DANGER</span>' : ''}
                  </div>
                  <div class="scores-history-col">
                    ${(p.roundScores || []).map(s => `<span class="score-dot">${s}</span>`).join('')}
                  </div>
                  <div class="phase-total-col">
                    <strong>${p.phaseScore}</strong> pts
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          ${ghostStandings.length > 0 ? `
            <div class="ghosts-section-divider">
              <span>👻 GHOSTS</span>
            </div>
            <div class="ghosts-list">
              ${ghostStandings.map(g => `
                <div class="ghost-row">
                  <div class="avatar-col">${generateAvatarSvg(g.color, g.id, 32)}</div>
                  <span class="ghost-name">${g.name}</span>
                  <span class="ghost-status">Haunting</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </section>

        <footer class="postround-footer">
          <div class="countdown-bar-wrap">
            <div class="countdown-bar-fill"></div>
          </div>
          <span class="next-hint">Next round starting shortly...</span>
        </footer>
      </div>
    `;

    // Counting animation for player's score
    const dialEl = this.container.querySelector('#dial-score-num');
    if (dialEl) {
      let currentVal = 0;
      const step = Math.max(1, Math.floor(myScore / 25));
      const countInterval = setInterval(() => {
        currentVal += step;
        if (currentVal >= myScore) {
          currentVal = myScore;
          clearInterval(countInterval);
        }
        dialEl.textContent = currentVal;
      }, 25);
    }
  }

  cleanupCurrentGame() {
    if (this.preRoundTimer) {
      clearInterval(this.preRoundTimer);
      this.preRoundTimer = null;
    }
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
    if (this.postRoundTimer) {
      clearInterval(this.postRoundTimer);
      this.postRoundTimer = null;
    }
    if (this.currentMiniGameInstance) {
      this.currentMiniGameInstance.destroy();
      this.currentMiniGameInstance = null;
    }
    glitchManager.clearGlitches();
  }
}
