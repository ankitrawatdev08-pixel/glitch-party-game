// game/constants.js

const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 30 unambiguous characters
const ROOM_CODE_LENGTH = 4;

const GAME_STATES = {
  LOBBY: 'LOBBY',
  PRE_ROUND: 'PRE_ROUND',
  PLAYING: 'PLAYING',
  POST_ROUND: 'POST_ROUND',
  ELIMINATION: 'ELIMINATION',
  SHOWDOWN: 'SHOWDOWN',
  GAME_OVER: 'GAME_OVER'
};

const PLAYER_STATUS = {
  WAITING: 'WAITING',
  PLAYING: 'PLAYING',
  ELIMINATED: 'ELIMINATED',
  DISCONNECTED: 'DISCONNECTED'
};

const GLITCH_TYPES = {
  SCREEN_FLIP: {
    id: 'SCREEN_FLIP',
    name: 'Screen Flip',
    description: 'Rotates entire game area 180°',
    icon: '🔄'
  },
  JELLY_MODE: {
    id: 'JELLY_MODE',
    name: 'Jelly Mode',
    description: 'Wobbles UI with fluid sine distortion',
    icon: '🍮'
  },
  FOG_OF_WAR: {
    id: 'FOG_OF_WAR',
    name: 'Fog of War',
    description: '70% obscured dark mist with small torch spotlight',
    icon: '🌫️'
  },
  INPUT_SWAP: {
    id: 'INPUT_SWAP',
    name: 'Input Swap',
    description: 'Mirrors left and right tap coordinates',
    icon: '🔀'
  },
  SPEED_DEMON: {
    id: 'SPEED_DEMON',
    name: 'Speed Demon',
    description: 'Game logic & animations rush at 1.5× speed',
    icon: '⚡'
  }
};

const MINIGAMES = [
  { id: 'targetTap', name: 'Target Tap', instruction: 'Tap every target as fast as you can!', icon: '🎯' },
  { id: 'colorMatch', name: 'Color Match', instruction: 'Tap the INK color, not the word!', icon: '🎨' },
  { id: 'sequenceMemory', name: 'Sequence Memory', instruction: 'Remember the sequence & tap in order!', icon: '🧠' },
  { id: 'quickMath', name: 'Quick Math', instruction: 'Solve equations rapidly & tap the answer!', icon: '⚡' },
  { id: 'oddOneOut', name: 'Odd One Out', instruction: 'Find and tap the shape that is subtly different!', icon: '🔍' },
  { id: 'tracePath', name: 'Trace The Path', instruction: 'Memorize the path and tap waypoints in order!', icon: '✨' }
];

const TIMINGS = {
  ROUND_DURATION: 8000,
  PRE_ROUND_DURATION: 5000, // 5-second pre-round hold (Patch 1.0.5 pacing tune-up)
  POST_ROUND_DURATION: 4000,
  ELIMINATION_DURATION: 5000,
  DISCONNECT_GRACE_PERIOD: 30000,
  LOBBY_DISCONNECT_GRACE: 15000,
  LOBBY_IDLE_TIMEOUT: 300000, // 5 min
  GAME_OVER_IDLE_TIMEOUT: 120000, // 2 min
  EMPTY_ROOM_TIMEOUT: 60000 // 1 min
};

const TOKEN_RULES = {
  HIGH_SCORE_THRESHOLD: 80,
  HIGH_SCORE_TOKENS: 2,
  MID_SCORE_THRESHOLD: 50,
  MID_SCORE_TOKENS: 1,
  MAX_TOKENS: 5,
  GHOST_FREE_TOKENS: 1,
  COST_PER_GLITCH: 1,
  MAX_GLITCHES_PER_PLAYER: 3
};

const AVATAR_COLORS = [
  '#06F9EC', // Cyan
  '#F43F7A', // Pink
  '#8B5CF6', // Purple
  '#FBBF24', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Electric Blue
  '#F97316', // Orange
  '#EC4899'  // Magenta
];

module.exports = {
  ROOM_CODE_CHARS,
  ROOM_CODE_LENGTH,
  GAME_STATES,
  PLAYER_STATUS,
  GLITCH_TYPES,
  MINIGAMES,
  TIMINGS,
  TOKEN_RULES,
  AVATAR_COLORS
};
