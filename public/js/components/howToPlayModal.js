// public/js/components/howToPlayModal.js
import { sound } from '../audio.js';

export class HowToPlayModal {
  static open() {
    // Remove any existing instance
    HowToPlayModal.close();

    sound.playClick();

    const overlay = document.createElement('div');
    overlay.id = 'how-to-play-modal-overlay';
    overlay.className = 'htp-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'htp-modal-title');

    overlay.innerHTML = `
      <div class="htp-modal-card glass-panel" id="htp-modal-card">
        <header class="htp-modal-header">
          <div class="htp-badge-wrap">
            <span class="badge-pill">HOW TO PLAY</span>
          </div>
          <h2 id="htp-modal-title" class="htp-title">SURVIVE THE GLITCH</h2>
          <p class="htp-subtitle">The rapid-fire sabotage party game. 2–8 players.</p>
          <button id="btn-close-htp" class="htp-close-btn" aria-label="Close rules">✕</button>
        </header>

        <div class="htp-modal-body">
          <!-- Navigation tabs -->
          <div class="htp-tabs">
            <button class="htp-tab-btn active" data-tab="rules">CORE RULES</button>
            <button class="htp-tab-btn" data-tab="glitches">GLITCH ARSENAL</button>
          </div>

          <!-- TAB 1: Core Rules (Scannable Cards) -->
          <div id="htp-tab-rules" class="htp-tab-content">
            <div class="htp-rule-grid">

              <div class="htp-rule-card">
                <div class="htp-rule-icon">🚪</div>
                <div class="htp-rule-text">
                  <h3>1. Room Code Join</h3>
                  <p>Create a room or enter the 4-letter room code on any phone or browser. 2 to 8 players compete in real time.</p>
                </div>
              </div>

              <div class="htp-rule-card">
                <div class="htp-rule-icon">⚡</div>
                <div class="htp-rule-text">
                  <h3>2. 8-Second Micro-Challenges</h3>
                  <p>All players face simultaneous rapid-fire challenges (Quick Math, Odd One Out, Trace The Path, etc.). You have 8 seconds to maximize your score.</p>
                </div>
              </div>

              <div class="htp-rule-card htp-highlight-card">
                <div class="htp-rule-icon">💥</div>
                <div class="htp-rule-text">
                  <h3>3. Always-On Sabotage Bar</h3>
                  <p>Attack opponents mid-game! Tap any player on your bottom Sabotage Bar during gameplay to inject real-time glitches onto their screen.</p>
                </div>
              </div>

              <div class="htp-rule-card">
                <div class="htp-rule-icon">🪙</div>
                <div class="htp-rule-text">
                  <h3>4. Earn & Spend Tokens</h3>
                  <p>Score 50+ in a round to earn Glitch Tokens. Each sabotage costs 1 token. Bank up to 5 tokens to unleash combo attacks.</p>
                </div>
              </div>

              <div class="htp-rule-card">
                <div class="htp-rule-icon">💀</div>
                <div class="htp-rule-text">
                  <h3>5. Elimination Every 3 Rounds</h3>
                  <p>Matches run in 3-round Phases. At the end of each Phase, the player with the lowest cumulative Phase score is eliminated.</p>
                </div>
              </div>

              <div class="htp-rule-card htp-ghost-card">
                <div class="htp-rule-icon">👻</div>
                <div class="htp-rule-text">
                  <h3>6. Ghost Mode Revenge</h3>
                  <p>Eliminated players become Ghosts! Ghosts get <strong>1 FREE Glitch</strong> every round to haunt survivors and influence the match.</p>
                </div>
              </div>

              <div class="htp-rule-card htp-showdown-card">
                <div class="htp-rule-icon">⚔️</div>
                <div class="htp-rule-text">
                  <h3>7. 1v1 Final Showdown</h3>
                  <p>The last 2 survivors face off in a 3-round showdown. Ghost sabotage is disabled for a pure skill finale. Highest score wins the crown!</p>
                </div>
              </div>

            </div>
          </div>

          <!-- TAB 2: Glitch Arsenal -->
          <div id="htp-tab-glitches" class="htp-tab-content hidden">
            <p class="htp-tab-intro">When you attack, the server randomly applies an eligible active sabotage to your target:</p>
            <div class="htp-glitch-list">
              <div class="htp-glitch-item">
                <span class="glitch-icon">🔄</span>
                <div>
                  <strong>Screen Flip</strong>
                  <p>Flips the opponent's entire playing arena upside down (180°).</p>
                </div>
              </div>
              <div class="htp-glitch-item">
                <span class="glitch-icon">🍮</span>
                <div>
                  <strong>Jelly Mode</strong>
                  <p>Distorts and wobbles the screen with violent liquid elasticity.</p>
                </div>
              </div>
              <div class="htp-glitch-item">
                <span class="glitch-icon">🌫️</span>
                <div>
                  <strong>Fog of War</strong>
                  <p>Blinds the canvas in thick smoke, cleared only by touching or dragging.</p>
                </div>
              </div>
              <div class="htp-glitch-item">
                <span class="glitch-icon">🔀</span>
                <div>
                  <strong>Input Swap</strong>
                  <p>Mirrors touch coordinates—left becomes right, top becomes bottom.</p>
                </div>
              </div>
              <div class="htp-glitch-item">
                <span class="glitch-icon">⏩</span>
                <div>
                  <strong>Speed Demon</strong>
                  <p>Accelerates minigame simulation speed by 2.2x.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer class="htp-modal-footer">
          <button id="btn-htp-got-it" class="btn btn-primary btn-large glow-pulse">
            <span>GOT IT, LET'S PLAY!</span>
          </button>
        </footer>
      </div>
    `;

    document.body.appendChild(overlay);

    // Bind interaction events
    const closeBtn = overlay.querySelector('#btn-close-htp');
    const gotItBtn = overlay.querySelector('#btn-htp-got-it');
    const tabBtns = overlay.querySelectorAll('.htp-tab-btn');
    const card = overlay.querySelector('#htp-modal-card');

    const handleClose = () => {
      sound.playClick();
      HowToPlayModal.close();
    };

    if (closeBtn) closeBtn.addEventListener('click', handleClose);
    if (gotItBtn) gotItBtn.addEventListener('click', handleClose);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        handleClose();
      }
    });

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeydown, { once: true });

    // Tabs switching
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tabTarget = btn.getAttribute('data-tab');
        const rulesTab = overlay.querySelector('#htp-tab-rules');
        const glitchesTab = overlay.querySelector('#htp-tab-glitches');

        if (tabTarget === 'rules') {
          rulesTab.classList.remove('hidden');
          glitchesTab.classList.add('hidden');
        } else {
          rulesTab.classList.add('hidden');
          glitchesTab.classList.remove('hidden');
        }
      });
    });
  }

  static close() {
    const existing = document.getElementById('how-to-play-modal-overlay');
    if (existing) {
      existing.remove();
    }
  }
}
