// public/js/audio.js
// Synthesized Web Audio API sound engine (Zero external audio files)

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  ensureContext() {
    this.init();
    return this.ctx && this.ctx.state === 'running';
  }

  // 1. UI Click: short sine wave blip, 800Hz, 50ms, quick decay
  playClick() {
    if (!this.ensureContext() || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  // 2. Countdown tick: 440Hz square wave, 30ms, staccato
  playTick() {
    if (!this.ensureContext() || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.03);
  }

  // 3. Round start: ascending 3-note arpeggio (C5-E5-G5), sine wave, 80ms each
  playRoundStart() {
    if (!this.ensureContext() || this.muted) return;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const noteDuration = 0.08;

    notes.forEach((freq, idx) => {
      const startTime = this.ctx.currentTime + idx * noteDuration;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + noteDuration);
    });
  }

  // 4. Round end: descending 2-note (G4-C4), triangle wave, 120ms each
  playRoundEnd() {
    if (!this.ensureContext() || this.muted) return;
    const notes = [392.00, 261.63]; // G4, C4
    const noteDuration = 0.12;

    notes.forEach((freq, idx) => {
      const startTime = this.ctx.currentTime + idx * noteDuration;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + noteDuration);
    });
  }

  // 5. Glitch hit received: low distorted buzz — 150Hz sawtooth, 200ms with distortion
  playGlitchHit() {
    if (!this.ensureContext() || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const distortion = this.ctx.createWaveShaper();

    // Distortion curve (bitcrusher / saturation effect)
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + 20) * x * 20 * deg) / (Math.PI + 20 * Math.abs(x));
    }
    distortion.curve = curve;
    distortion.oversample = '4x';

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

    osc.connect(distortion);
    distortion.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // 6. Score increment: bright chime, 1200Hz sine, 40ms, light reverb
  playScoreChime() {
    if (!this.ensureContext() || this.muted) return;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2400, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc2.start();
    osc.stop(this.ctx.currentTime + 0.08);
    osc2.stop(this.ctx.currentTime + 0.08);
  }

  // 7. Elimination: dramatic descending sweep, 600Hz->100Hz, sawtooth, 500ms
  playElimination() {
    if (!this.ensureContext() || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  // 8. Victory: major chord (C4+E4+G4+C5), sine waves, 800ms, slow decay
  playVictory() {
    if (!this.ensureContext() || this.muted) return;
    const freqs = [261.63, 329.63, 392.00, 523.25];
    const duration = 0.8;

    freqs.forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    });
  }

  // 9. Token earned: metallic ping, 2000Hz, 25ms, quick decay
  playTokenEarned() {
    if (!this.ensureContext() || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2600, this.ctx.currentTime + 0.035);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  // 10. Ghost glitch sent: spooky whoosh — filtered white noise sweep, 300ms
  playGhostGlitch() {
    if (!this.ensureContext() || this.muted) return;
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.15);
    filter.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.3);
    filter.Q.value = 4.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    whiteNoise.start();
    whiteNoise.stop(this.ctx.currentTime + 0.3);
  }
}

export const sound = new SoundEngine();
