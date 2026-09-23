// public/js/screens/landing.js
import { sound } from '../audio.js';
import { getStoredPlayerName, setStoredPlayerName } from '../utils.js';

export class LandingScreen {
  constructor(container, { onCreateRoom, onJoinRoom }) {
    this.container = container;
    this.onCreateRoom = onCreateRoom;
    this.onJoinRoom = onJoinRoom;
    this.isJoinMode = false;
  }

  render() {
    const savedName = getStoredPlayerName();

    this.container.innerHTML = `
      <div class="landing-card glass-panel">
        <div class="logo-wrapper">
          <h1 class="glitch-logo" data-text="GLITCH">GLITCH</h1>
          <p class="tagline">Sabotage your friends. Survive the chaos.</p>
        </div>

        <div class="form-group">
          <label for="player-name-input" class="input-label">YOUR NAME</label>
          <input 
            type="text" 
            id="player-name-input" 
            class="glow-input" 
            placeholder="Enter nickname" 
            maxlength="12" 
            value="${savedName}"
            autocomplete="off"
            spellcheck="false"
          />
          <div id="landing-name-error" class="inline-error"></div>
        </div>

        <div id="join-code-container" class="form-group hidden">
          <label for="room-code-input" class="input-label">4-CHARACTER ROOM CODE</label>
          <input 
            type="text" 
            id="room-code-input" 
            class="glow-input room-code-field" 
            placeholder="ABCD" 
            maxlength="4" 
            autocomplete="off"
            spellcheck="false"
          />
          <div id="landing-code-error" class="inline-error"></div>
        </div>

        <div class="landing-actions">
          <button id="btn-create-room" class="btn btn-primary btn-large">
            <span>CREATE ROOM</span>
          </button>
          <button id="btn-join-toggle" class="btn btn-secondary btn-large">
            <span>JOIN ROOM</span>
          </button>
          <button id="btn-submit-join" class="btn btn-primary btn-large hidden">
            <span>ENTER ROOM</span>
          </button>
          <button id="btn-cancel-join" class="btn btn-ghost hidden">
            <span>Back to Create</span>
          </button>
        </div>

        <!-- How To Play Accordion -->
        <div class="how-to-play-section">
          <button id="how-to-play-toggle" class="how-to-play-header" aria-expanded="false">
            <span>HOW TO PLAY</span>
            <span class="accordion-arrow">▼</span>
          </button>
          <div id="how-to-play-content" class="how-to-play-content hidden">
            <div class="rule-step">
              <div class="step-num">1</div>
              <div class="step-desc">
                <strong>Simultaneous Micro-Challenges</strong>
                <p>Everyone plays 8-second rapid micro-games at the exact same time.</p>
              </div>
            </div>
            <div class="rule-step">
              <div class="step-num">2</div>
              <div class="step-desc">
                <strong>Earn Glitch Tokens</strong>
                <p>Score 50+ to earn tokens. Spend them in pre-round to flip screens, wobble displays, or fog enemies!</p>
              </div>
            </div>
            <div class="rule-step">
              <div class="step-num">3</div>
              <div class="step-desc">
                <strong>Survive Eliminations</strong>
                <p>Lowest scorer after 3 rounds is eliminated to Ghost mode (1 free glitch/round). Last standing wins!</p>
              </div>
            </div>
          </div>
        </div>

        <footer class="landing-footer">
          <span>Built for Handshake AI Skills Studio × OpenAI Game Challenge</span>
        </footer>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const nameInput = this.container.querySelector('#player-name-input');
    const codeInput = this.container.querySelector('#room-code-input');
    const nameError = this.container.querySelector('#landing-name-error');
    const codeError = this.container.querySelector('#landing-code-error');

    const btnCreate = this.container.querySelector('#btn-create-room');
    const btnJoinToggle = this.container.querySelector('#btn-join-toggle');
    const btnSubmitJoin = this.container.querySelector('#btn-submit-join');
    const btnCancelJoin = this.container.querySelector('#btn-cancel-join');
    const joinCodeContainer = this.container.querySelector('#join-code-container');

    const htpToggle = this.container.querySelector('#how-to-play-toggle');
    const htpContent = this.container.querySelector('#how-to-play-content');
    const arrow = this.container.querySelector('.accordion-arrow');

    // Auto-uppercase room code
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      codeError.textContent = '';
    });

    nameInput.addEventListener('input', () => {
      nameError.textContent = '';
      setStoredPlayerName(nameInput.value.trim());
    });

    btnCreate.addEventListener('click', () => {
      sound.playClick();
      const name = nameInput.value.trim();
      if (!name) {
        nameError.textContent = 'Please enter your name to play.';
        nameInput.focus();
        return;
      }
      this.onCreateRoom(name);
    });

    btnJoinToggle.addEventListener('click', () => {
      sound.playClick();
      this.isJoinMode = true;
      joinCodeContainer.classList.remove('hidden');
      btnCreate.classList.add('hidden');
      btnJoinToggle.classList.add('hidden');
      btnSubmitJoin.classList.remove('hidden');
      btnCancelJoin.classList.remove('hidden');
      codeInput.focus();
    });

    btnCancelJoin.addEventListener('click', () => {
      sound.playClick();
      this.isJoinMode = false;
      joinCodeContainer.classList.add('hidden');
      btnCreate.classList.remove('hidden');
      btnJoinToggle.classList.remove('hidden');
      btnSubmitJoin.classList.add('hidden');
      btnCancelJoin.classList.add('hidden');
      codeError.textContent = '';
    });

    btnSubmitJoin.addEventListener('click', () => {
      sound.playClick();
      const name = nameInput.value.trim();
      const code = codeInput.value.trim().toUpperCase();

      if (!name) {
        nameError.textContent = 'Please enter your name.';
        nameInput.focus();
        return;
      }
      if (code.length !== 4) {
        codeError.textContent = 'Room code must be 4 characters.';
        codeInput.focus();
        return;
      }

      this.onJoinRoom(code, name);
    });

    htpToggle.addEventListener('click', () => {
      sound.playClick();
      const isExpanded = htpContent.classList.toggle('hidden');
      arrow.textContent = isExpanded ? '▼' : '▲';
      htpToggle.setAttribute('aria-expanded', (!isExpanded).toString());
    });
  }

  showError(message) {
    const codeError = this.container.querySelector('#landing-code-error');
    const nameError = this.container.querySelector('#landing-name-error');
    if (this.isJoinMode && codeError) {
      codeError.textContent = message;
    } else if (nameError) {
      nameError.textContent = message;
    }
  }
}
