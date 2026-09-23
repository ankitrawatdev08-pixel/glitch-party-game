// public/js/avatar.js
// Procedural SVG avatar generator (Zero external image files)

export function generateAvatarSvg(color = '#8B5CF6', seed = 0, size = 64) {
  // Use numeric hash from seed if string
  let numSeed = 0;
  if (typeof seed === 'string') {
    for (let i = 0; i < seed.length; i++) {
      numSeed = (numSeed << 5) - numSeed + seed.charCodeAt(i);
      numSeed |= 0;
    }
    numSeed = Math.abs(numSeed);
  } else {
    numSeed = Math.abs(seed || 0);
  }

  const visorType = numSeed % 5;
  const crestType = (numSeed >> 2) % 4;
  const accentType = (numSeed >> 4) % 3;

  // Features based on seeds
  let visorMarkup = '';
  switch (visorType) {
    case 0:
      // Cyclops Neon Visor
      visorMarkup = `<rect x="24" y="44" width="52" height="12" rx="6" fill="#07060E" stroke="${color}" stroke-width="3" />
                     <circle cx="50" cy="50" r="4" fill="${color}" filter="drop-shadow(0 0 4px ${color})" />`;
      break;
    case 1:
      // Dual Cyber Goggles
      visorMarkup = `<circle cx="38" cy="50" r="9" fill="#07060E" stroke="${color}" stroke-width="3" />
                     <circle cx="62" cy="50" r="9" fill="#07060E" stroke="${color}" stroke-width="3" />
                     <line x1="47" y1="50" x2="53" y2="50" stroke="${color}" stroke-width="3" />
                     <circle cx="38" cy="50" r="3" fill="#06F9EC" />
                     <circle cx="62" cy="50" r="3" fill="#06F9EC" />`;
      break;
    case 2:
      // Angular Hex Visor
      visorMarkup = `<polygon points="26,45 74,45 68,58 32,58" fill="#07060E" stroke="${color}" stroke-width="3" />
                     <line x1="34" y1="51" x2="66" y2="51" stroke="${color}" stroke-width="2" />`;
      break;
    case 3:
      // Retro Robot Slots
      visorMarkup = `<rect x="30" y="44" width="40" height="14" rx="3" fill="#07060E" stroke="${color}" stroke-width="3" />
                     <line x1="38" y1="51" x2="44" y2="51" stroke="#FBBF24" stroke-width="3" />
                     <line x1="56" y1="51" x2="62" y2="51" stroke="#FBBF24" stroke-width="3" />`;
      break;
    default:
      // Slit Visor
      visorMarkup = `<polygon points="28,47 72,47 66,55 34,55" fill="#07060E" stroke="${color}" stroke-width="2.5" />
                     <rect x="42" y="49" width="16" height="4" rx="2" fill="${color}" />`;
      break;
  }

  let crestMarkup = '';
  switch (crestType) {
    case 0:
      // Cyber Antennae
      crestMarkup = `<line x1="50" y1="20" x2="50" y2="10" stroke="${color}" stroke-width="3" stroke-linecap="round" />
                     <circle cx="50" cy="8" r="4" fill="${color}" />`;
      break;
    case 1:
      // Dual Horns / Wings
      crestMarkup = `<polygon points="34,22 24,10 38,18" fill="${color}" />
                     <polygon points="66,22 76,10 62,18" fill="${color}" />`;
      break;
    case 2:
      // Cyber Crown Crest
      crestMarkup = `<polygon points="40,22 50,12 60,22 55,20 50,16 45,20" fill="${color}" />`;
      break;
    default:
      // Geometric Fin
      crestMarkup = `<polygon points="47,22 50,12 53,22" fill="${color}" />`;
      break;
  }

  let accentMarkup = '';
  if (accentType === 0) {
    // Cyber Cheek Plates
    accentMarkup = `<circle cx="22" cy="62" r="3" fill="${color}" opacity="0.8" />
                    <circle cx="78" cy="62" r="3" fill="${color}" opacity="0.8" />`;
  } else if (accentType === 1) {
    // Chin Barb
    accentMarkup = `<polygon points="46,74 54,74 50,80" fill="${color}" />`;
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="avatar-svg">
      <!-- Glow Filter -->
      <defs>
        <filter id="glow-${numSeed}" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${color}" flood-opacity="0.5"/>
        </filter>
      </defs>

      <!-- Head Base -->
      <circle cx="50" cy="50" r="32" fill="#12101F" stroke="${color}" stroke-width="4" filter="url(#glow-${numSeed})" />

      <!-- Head Crest / Antenna -->
      ${crestMarkup}

      <!-- Visor / Eyes -->
      ${visorMarkup}

      <!-- Accents -->
      ${accentMarkup}
    </svg>
  `.trim();
}
