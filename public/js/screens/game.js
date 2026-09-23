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
    this.bannerTimeout = null;

    // Mid-round sabotage state
    this.glitchedTargetsThisRound = new Set();
    this.activeGlitchesMap = {};
    this.myTokens = 0;
    this.isGhost = false;
    this.hasGhostGlitch = false;
    this.isShowdown = false;
  }

  setPlayerId(id) {
    this.myPlayerId = id;
  }

  // --- 1. PRE-ROUND SCREEN (Preview & Countdown Only) ---

  showPreRound(data) {
    this.cleanupCurrentGame();
    this.glitchedTargetsThisRound.clear();

    const isShowdown = !!data.isShowdown;
    this.isShowdown = isShowdown;

    const me = (data.players || []).find(p => p.id === this.myPlayerId) || {};
    this.isGhost = me.status === 'ELIMINATED';
    this.myTokens = me.glitchTokens || 0;
    this.hasGhostGlitch = this.isGhost && !isShowdown;

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

        <!-- Sabotage Prompt Hint -->
        <div class="preround-sabotage-hint">
          <span class="hint-icon">⚡</span>
          <span>${this.isGhost
            ? (isShowdown ? 'Ghost sabotage disabled during Final Showdown — pure skill finale.' : 'Ghost Haunt active! Tap any player during the round to glitch them for free.')
            : 'Always-On Sabotage Bar is active during gameplay! Tap an opponent to glitch them.'}</span>
        </div>
      </div>
    `;

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

  // --- 2. GAMEPLAY SCREEN (ROUND ACTIVE & ALWAYS-ON SABOTAGE BAR) ---

  showRound(data, miniGameId, miniGameConfig) {
    this.cleanupCurrentGame();
    sound.playRoundStart();

    const isShowdown = !!data.isShowdown;
    this.isShowdown = isShowdown;
    this.activeGlitchesMap = data.activeGlitches || {};

    // Get current players state
    const players = data.players || [];
    const me = players.find(p => p.id === this.myPlayerId) || {};
    this.isGhost = me.status === 'ELIMINATED';
    if (me.glitchTokens !== undefined) {
      this.myTokens = me.glitchTokens;
    }
    this.hasGhostGlitch = this.isGhost && !isShowdown;

    // Check my active glitches from server
    const activeGlitchesForMe = this.activeGlitchesMap[this.myPlayerId] || [];

    // Filter alive opponents (cannot glitch yourself or eliminated players)
    const opponents = players.filter(p => p.id !== this.myPlayerId && p.status !== 'ELIMINATED');

    const canSabotage = !this.isGhost
      ? (this.myTokens >= 1)
      : (this.hasGhostGlitch && !isShowdown);

    this.container.innerHTML = `
      <div class="gameplay-wrapper" id="gameplay-wrapper">
        <!-- Sticky Mid-Round Sabotage Bar (or Showdown Ghost Notice) -->
        ${this.isGhost && isShowdown ? `
          <div class="showdown-ghost-notice" id="showdown-ghost-notice">
            <span>👻 Ghost sabotage disabled during Final Showdown — pure skill finale</span>
          </div>
        ` : `
          <div class="sabotage-bar ${!canSabotage ? 'sabotage-bar-disabled' : ''}" id="sabotage-bar">
            <div class="sabotage-bar-left">
              <span class="sabotage-bar-title">${this.isGhost ? '👻 GHOST' : '⚡ ATTACK'}</span>
              <span class="sabotage-token-pill" id="sabotage-token-pill">
                ${this.isGhost ? (this.hasGhostGlitch ? '1 FREE' : '0 LEFT') : `🪙 ${this.myTokens}`}
              </span>
            </div>
            <div class="sabotage-targets-list" id="sabotage-targets-list">
              ${opponents.map(opp => {
                const targetGlitches = this.activeGlitchesMap[opp.id] || [];
                const isCapped = targetGlitches.length >= 3;
                const isAlreadyGlitched = this.glitchedTargetsThisRound.has(opp.id);
                const isDisabled = isCapped || isAlreadyGlitched || !canSabotage;

                return `
                  <button class="sabotage-avatar-btn ${isDisabled ? 'sabotage-target-disabled' : ''}" 
                          data-target-id="${opp.id}" 
                          data-target-name="${opp.name}"
                          title="Glitch ${opp.name}"
                          ${isDisabled ? 'disabled' : ''}>
                    <div class="avatar-sabotage-wrap">
                      ${generateAvatarSvg(opp.color, opp.id, 28)}
                    </div>
                    <span class="target-btn-name">${opp.name}</span>
                    ${isCapped ? '<span class="target-cap-tag">MAX</span>' : ''}
                  </button>
                `;
              }).join('')}
            </div>
            <div id="sabotage-bar-feedback" class="sabotage-bar-feedback"></div>
          </div>
        `}

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
          <!-- Mid-round incoming glitch alert overlay -->
          <div id="incoming-glitch-banner" class="incoming-glitch-banner hidden"></div>
        </div>
      </div>
    `;

    this.bindSabotageBarEvents();

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

  bindSabotageBarEvents() {
    const sabotageBar = this.container.querySelector('#sabotage-bar');
    if (!sabotageBar) return;

    // Pointer isolation: stop propagation of all pointer events so canvas is never affected
    const stopProp = (e) => e.stopPropagation();
    sabotageBar.addEventListener('pointerdown', stopProp);
    sabotageBar.addEventListener('touchstart', stopProp);
    sabotageBar.addEventListener('mousedown', stopProp);

    const buttons = sabotageBar.querySelectorAll('.sabotage-avatar-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-target-id');
        if (!targetId || btn.disabled) return;

        // Optimistically record anti-spam and disable button
        this.glitchedTargetsThisRound.add(targetId);
        btn.disabled = true;
        btn.classList.add('sabotage-target-disabled');

        sound.playClick();
        if (this.isGhost) {
          sound.playGhostGlitch();
          this.hasGhostGlitch = false;
        }

        // Trigger socket emit (1-tap: server picks randomized eligible effect)
        this.onSendGlitch(targetId);

        this.updateSabotageBarState();
      });
    });
  }

  updateSabotageBarState() {
    const sabotageBar = this.container.querySelector('#sabotage-bar');
    if (!sabotageBar) return;

    const tokenPill = this.container.querySelector('#sabotage-token-pill');
    const canSabotage = !this.isGhost ? (this.myTokens >= 1) : (this.hasGhostGlitch && !this.isShowdown);

    if (tokenPill) {
      tokenPill.textContent = this.isGhost
        ? (this.hasGhostGlitch ? '1 FREE' : '0 LEFT')
        : `🪙 ${this.myTokens}`;
    }

    if (!canSabotage) {
      sabotageBar.classList.add('sabotage-bar-disabled');
    } else {
      sabotageBar.classList.remove('sabotage-bar-disabled');
    }

    const buttons = sabotageBar.querySelectorAll('.sabotage-avatar-btn');
    buttons.forEach(btn => {
      const targetId = btn.getAttribute('data-target-id');
      const targetGlitches = (this.activeGlitchesMap && this.activeGlitchesMap[targetId]) || [];
      const isCapped = targetGlitches.length >= 3;
      const isAlreadyGlitched = this.glitchedTargetsThisRound.has(targetId);

      let capTag = btn.querySelector('.target-cap-tag');
      if (isCapped) {
        if (!capTag) {
          capTag = document.createElement('span');
          capTag.className = 'target-cap-tag';
          capTag.textContent = 'MAX';
          btn.appendChild(capTag);
        }
      } else if (capTag) {
        capTag.remove();
      }

      if (isCapped || isAlreadyGlitched || !canSabotage) {
        btn.disabled = true;
        btn.classList.add('sabotage-target-disabled');
      } else {
        btn.disabled = false;
        btn.classList.remove('sabotage-target-disabled');
      }
    });
  }

  updateActiveGlitches(activeGlitchesMap) {
    this.activeGlitchesMap = activeGlitchesMap || {};

    // Update active visual effects on my game canvas
    const myGlitches = this.activeGlitchesMap[this.myPlayerId] || [];
    const canvasContainer = this.container.querySelector('#game-canvas-container');
    if (canvasContainer) {
      glitchManager.applyGlitches(myGlitches, canvasContainer);
    }

    // Refresh Sabotage Bar avatar caps in real-time
    this.updateSabotageBarState();
  }

  notifyGlitchConfirmed(targetPlayerId, glitchType, remainingTokens, isGhost) {
    if (remainingTokens !== undefined) {
      this.myTokens = remainingTokens;
    }
    if (isGhost) {
      this.hasGhostGlitch = false;
    }
    this.glitchedTargetsThisRound.add(targetPlayerId);

    const feedbackEl = this.container.querySelector('#sabotage-bar-feedback');
    const meta = GLITCH_METADATA[glitchType] || { name: glitchType, icon: '⚡' };

    if (feedbackEl) {
      feedbackEl.textContent = `⚡ Sent ${meta.name}!`;
      feedbackEl.className = 'sabotage-bar-feedback text-success';
      setTimeout(() => {
        if (feedbackEl) feedbackEl.textContent = '';
      }, 2000);
    }

    this.updateSabotageBarState();
  }

  handleGlitchError(errorMessage) {
    const feedbackEl = this.container.querySelector('#sabotage-bar-feedback');
    if (feedbackEl) {
      feedbackEl.textContent = errorMessage;
      feedbackEl.className = 'sabotage-bar-feedback text-danger';
      setTimeout(() => {
        if (feedbackEl) feedbackEl.textContent = '';
      }, 2500);
    }
    this.updateSabotageBarState();
  }

  notifyGlitchIncoming(glitchType, fromPlayerName) {
    sound.playGlitchHit();
    const meta = GLITCH_METADATA[glitchType] || { name: glitchType, icon: '⚡' };

    // Dynamically apply glitch effect immediately to active screen
    const canvasContainer = this.container.querySelector('#game-canvas-container');
    glitchManager.addGlitch(glitchType, canvasContainer);

    // Show mid-round non-blocking incoming banner
    const banner = this.container.querySelector('#incoming-glitch-banner');
    if (banner) {
      banner.innerHTML = `<span>⚠️ <strong>${fromPlayerName}</strong> glitched you with <strong>${meta.icon} ${meta.name}</strong>!</span>`;
      banner.classList.remove('hidden');
      clearTimeout(this.bannerTimeout);
      this.bannerTimeout = setTimeout(() => {
        if (banner) banner.classList.add('hidden');
      }, 2500);
    }
  }

  endRound() {
    sound.playRoundEnd();

    // Freeze minigame
    if (this.currentMiniGameInstance) {
      const finalRawData = this.currentMiniGameInstance.getRawData();
      this.onSubmitScore(finalRawData);
      this.currentMiniGameInstance.stop();
    }

    // Clear glitch visual classes during intermission
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
    if (this.bannerTimeout) {
      clearTimeout(this.bannerTimeout);
      this.bannerTimeout = null;
    }
    if (this.currentMiniGameInstance) {
      this.currentMiniGameInstance.destroy();
      this.currentMiniGameInstance = null;
    }
    glitchManager.clearGlitches();
  }
}
