// public/js/glitch.js
// Client-side glitch orchestrator for real-time sabotage effects

export const GLITCH_METADATA = {
  SCREEN_FLIP: {
    id: 'SCREEN_FLIP',
    name: 'Screen Flip',
    icon: '🔄',
    desc: 'Inverts entire game display 180°'
  },
  JELLY_MODE: {
    id: 'JELLY_MODE',
    name: 'Jelly Mode',
    icon: '🍮',
    desc: 'Fluid wobble sine distortion'
  },
  FOG_OF_WAR: {
    id: 'FOG_OF_WAR',
    name: 'Fog of War',
    icon: '🌫️',
    desc: '70% dark mist with moving torchlight'
  },
  INPUT_SWAP: {
    id: 'INPUT_SWAP',
    name: 'Input Swap',
    icon: '🔀',
    desc: 'Mirrors left and right touch input'
  },
  SPEED_DEMON: {
    id: 'SPEED_DEMON',
    name: 'Speed Demon',
    icon: '⚡',
    desc: 'Accelerates gameplay to 1.5× speed'
  }
};

class GlitchManager {
  constructor() {
    this.activeGlitches = new Set();
    this.fogPointer = { x: 0.5, y: 0.5 }; // normalized
    this.containerEl = null;
  }

  setContainer(el) {
    this.containerEl = el;
  }

  applyGlitches(glitchList = [], containerEl = this.containerEl) {
    this.clearGlitches(containerEl);
    this.containerEl = containerEl;
    this.activeGlitches = new Set(glitchList);

    if (!containerEl) return;

    if (this.activeGlitches.has('SCREEN_FLIP')) {
      containerEl.classList.add('glitch-screen-flip');
    }
    if (this.activeGlitches.has('JELLY_MODE')) {
      containerEl.classList.add('glitch-jelly-mode');
    }
    if (this.activeGlitches.has('FOG_OF_WAR')) {
      containerEl.classList.add('glitch-fog-active');
    }
    if (this.activeGlitches.has('INPUT_SWAP')) {
      containerEl.classList.add('glitch-input-swap');
    }
    if (this.activeGlitches.has('SPEED_DEMON')) {
      containerEl.classList.add('glitch-speed-demon');
    }

    this.updateHudBadges();
  }

  addGlitch(glitchId, containerEl = this.containerEl) {
    if (!glitchId) return;
    this.activeGlitches.add(glitchId);
    this.containerEl = containerEl;
    if (containerEl) {
      if (glitchId === 'SCREEN_FLIP') containerEl.classList.add('glitch-screen-flip');
      if (glitchId === 'JELLY_MODE') containerEl.classList.add('glitch-jelly-mode');
      if (glitchId === 'FOG_OF_WAR') containerEl.classList.add('glitch-fog-active');
      if (glitchId === 'INPUT_SWAP') containerEl.classList.add('glitch-input-swap');
      if (glitchId === 'SPEED_DEMON') containerEl.classList.add('glitch-speed-demon');
    }
    this.updateHudBadges();
  }

  removeGlitch(glitchId, containerEl = this.containerEl) {
    if (!glitchId) return;
    this.activeGlitches.delete(glitchId);
    if (containerEl) {
      if (glitchId === 'SCREEN_FLIP') containerEl.classList.remove('glitch-screen-flip');
      if (glitchId === 'JELLY_MODE') containerEl.classList.remove('glitch-jelly-mode');
      if (glitchId === 'FOG_OF_WAR') containerEl.classList.remove('glitch-fog-active');
      if (glitchId === 'INPUT_SWAP') containerEl.classList.remove('glitch-input-swap');
      if (glitchId === 'SPEED_DEMON') containerEl.classList.remove('glitch-speed-demon');
    }
    this.updateHudBadges();
  }

  clearGlitches(containerEl = this.containerEl) {
    this.activeGlitches.clear();
    if (containerEl) {
      containerEl.classList.remove(
        'glitch-screen-flip',
        'glitch-jelly-mode',
        'glitch-fog-active',
        'glitch-input-swap',
        'glitch-speed-demon'
      );
    }
    this.updateHudBadges();
  }

  hasGlitch(glitchId) {
    return this.activeGlitches.has(glitchId);
  }

  getSpeedMultiplier() {
    return this.hasGlitch('SPEED_DEMON') ? 1.5 : 1.0;
  }

  // Modifies input touch/pointer coordinates if INPUT_SWAP is active
  modifyCoordinates(x, y, width, height) {
    if (this.hasGlitch('INPUT_SWAP')) {
      return { x: width - x, y };
    }
    return { x, y };
  }

  updateFogPointer(x, y, width, height) {
    this.fogPointer = {
      x: Math.max(0, Math.min(width, x)),
      y: Math.max(0, Math.min(height, y))
    };
  }

  // Renders the Fog of War dynamic overlay on canvas
  renderFog(ctx, width, height) {
    if (!this.hasGlitch('FOG_OF_WAR')) return;

    ctx.save();
    // 70% dark mist overlay
    const px = this.fogPointer.x;
    const py = this.fogPointer.y;
    const radius = Math.min(width, height) * 0.22;

    const gradient = ctx.createRadialGradient(px, py, radius * 0.35, px, py, radius);
    gradient.addColorStop(0, 'rgba(7, 6, 14, 0)');
    gradient.addColorStop(0.7, 'rgba(7, 6, 14, 0.7)');
    gradient.addColorStop(1, 'rgba(7, 6, 14, 0.94)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle neon flashlight edge ring
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(6, 249, 236, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  updateHudBadges() {
    const badgeContainer = document.getElementById('active-glitches-hud');
    if (!badgeContainer) return;

    if (this.activeGlitches.size === 0) {
      badgeContainer.innerHTML = '';
      badgeContainer.classList.remove('has-glitches');
      return;
    }

    badgeContainer.classList.add('has-glitches');
    let html = '';
    for (const gId of this.activeGlitches) {
      const meta = GLITCH_METADATA[gId];
      if (meta) {
        html += `
          <div class="glitch-hud-badge" title="${meta.name}: ${meta.desc}">
            <span class="glitch-icon">${meta.icon}</span>
            <span class="glitch-label">${meta.name}</span>
          </div>
        `;
      }
    }
    badgeContainer.innerHTML = html;
  }
}

export const glitchManager = new GlitchManager();
