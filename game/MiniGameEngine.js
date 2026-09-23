// game/MiniGameEngine.js
const { MINIGAMES } = require('./constants');

class MiniGameEngine {
  /**
   * Generates identical deterministic configuration for all players in a round.
   */
  static generateRoundConfig(miniGameId, roundNumber = 1) {
    switch (miniGameId) {
      case 'targetTap':
        return this.generateTargetTapConfig(roundNumber);
      case 'colorMatch':
        return this.generateColorMatchConfig(roundNumber);
      case 'sequenceMemory':
        return this.generateSequenceMemoryConfig(roundNumber);
      case 'quickMath':
        return this.generateQuickMathConfig(roundNumber);
      case 'oddOneOut':
        return this.generateOddOneOutConfig(roundNumber);
      case 'tracePath':
        return this.generateTracePathConfig(roundNumber);
      default:
        return this.generateTargetTapConfig(roundNumber);
    }
  }

  // 1. TARGET TAP
  static generateTargetTapConfig(roundNumber) {
    const totalTargets = 8;
    const targets = [];
    const minDelay = 0;
    const interval = 850; // ms

    for (let i = 0; i < totalTargets; i++) {
      targets.push({
        id: i + 1,
        // Normalized coordinates between 0.15 and 0.85 to avoid edge-clipping
        x: Math.round((0.15 + Math.random() * 0.7) * 1000) / 1000,
        y: Math.round((0.18 + Math.random() * 0.64) * 1000) / 1000,
        delayMs: minDelay + i * interval,
        lifetimeMs: 1200,
        radius: 0.08
      });
    }

    return {
      type: 'targetTap',
      totalTargets,
      targets
    };
  }

  // 2. COLOR MATCH (Stroop Test)
  static generateColorMatchConfig(roundNumber) {
    const colors = [
      { name: 'RED', hex: '#F43F7A' },
      { name: 'BLUE', hex: '#3B82F6' },
      { name: 'GREEN', hex: '#10B981' },
      { name: 'YELLOW', hex: '#FBBF24' }
    ];

    const questions = [];
    const count = 10;

    for (let i = 0; i < count; i++) {
      const wordIdx = Math.floor(Math.random() * colors.length);
      let inkIdx = Math.floor(Math.random() * colors.length);
      // Stroop effect: ensure ink color differs from word 80% of the time
      if (inkIdx === wordIdx && Math.random() < 0.8) {
        inkIdx = (inkIdx + 1 + Math.floor(Math.random() * (colors.length - 1))) % colors.length;
      }

      questions.push({
        word: colors[wordIdx].name,
        inkColorHex: colors[inkIdx].hex,
        correctColorName: colors[inkIdx].name,
        options: colors.map(c => c.name)
      });
    }

    return {
      type: 'colorMatch',
      questions
    };
  }

  // 3. SEQUENCE MEMORY
  static generateSequenceMemoryConfig(roundNumber) {
    const gridSize = 3; // 3x3 grid (9 cells)
    const sequenceLength = roundNumber <= 3 ? 4 : (roundNumber <= 6 ? 5 : 6);
    const sequence = [];

    let lastCell = -1;
    for (let i = 0; i < sequenceLength; i++) {
      let nextCell;
      do {
        nextCell = Math.floor(Math.random() * (gridSize * gridSize));
      } while (nextCell === lastCell);
      sequence.push(nextCell);
      lastCell = nextCell;
    }

    return {
      type: 'sequenceMemory',
      gridSize,
      flashDuration: 400,
      gapDuration: 200,
      sequence
    };
  }

  // 4. QUICK MATH
  static generateQuickMathConfig(roundNumber) {
    const questions = [];
    const count = 10;
    const operators = ['+', '-', '×'];

    for (let i = 0; i < count; i++) {
      const op = operators[Math.floor(Math.random() * operators.length)];
      let a, b, answer, expr;

      if (op === '+') {
        a = Math.floor(Math.random() * 25) + 3;
        b = Math.floor(Math.random() * 25) + 3;
        answer = a + b;
        expr = `${a} + ${b}`;
      } else if (op === '-') {
        answer = Math.floor(Math.random() * 20) + 1;
        b = Math.floor(Math.random() * 20) + 2;
        a = answer + b;
        expr = `${a} − ${b}`;
      } else {
        a = Math.floor(Math.random() * 8) + 2;
        b = Math.floor(Math.random() * 8) + 2;
        answer = a * b;
        expr = `${a} × ${b}`;
      }

      // Generate 3 unique wrong options near the answer
      const optionsSet = new Set([answer]);
      const deltas = [-3, -2, -1, 1, 2, 3, 5, 10, -5, -10];
      while (optionsSet.size < 4) {
        const delta = deltas[Math.floor(Math.random() * deltas.length)];
        const distractor = Math.max(1, answer + delta);
        optionsSet.add(distractor);
      }

      const options = Array.from(optionsSet).sort(() => Math.random() - 0.5);

      questions.push({
        expr,
        answer,
        options
      });
    }

    return {
      type: 'quickMath',
      questions
    };
  }

  // 5. ODD ONE OUT
  static generateOddOneOutConfig(roundNumber) {
    const shapes = ['circle', 'square', 'triangle', 'diamond'];
    const diffTypes = ['color', 'size', 'rotation'];
    const puzzles = [];
    const count = 8;
    const gridSize = 3; // 3x3 = 9 shapes

    for (let i = 0; i < count; i++) {
      const baseShape = shapes[Math.floor(Math.random() * shapes.length)];
      const diffType = diffTypes[Math.floor(Math.random() * diffTypes.length)];
      const oddIndex = Math.floor(Math.random() * (gridSize * gridSize));

      puzzles.push({
        gridSize,
        baseShape,
        diffType,
        oddIndex,
        baseColor: '#8B5CF6',
        oddColor: diffType === 'color' ? '#EC4899' : '#8B5CF6'
      });
    }

    return {
      type: 'oddOneOut',
      puzzles
    };
  }

  // 6. TRACE THE PATH
  static generateTracePathConfig(roundNumber) {
    const waypointCount = roundNumber <= 3 ? 5 : (roundNumber <= 6 ? 6 : 7);
    const waypoints = [];
    const minDistance = 0.16; // ensure dots aren't too close

    for (let i = 0; i < waypointCount; i++) {
      let attempts = 0;
      let valid = false;
      let x, y;

      while (!valid && attempts < 50) {
        x = Math.round((0.15 + Math.random() * 0.7) * 1000) / 1000;
        y = Math.round((0.18 + Math.random() * 0.64) * 1000) / 1000;
        valid = true;
        for (const wp of waypoints) {
          const dx = wp.x - x;
          const dy = wp.y - y;
          if (Math.hypot(dx, dy) < minDistance) {
            valid = false;
            break;
          }
        }
        attempts++;
      }

      waypoints.push({ id: i + 1, x, y });
    }

    return {
      type: 'tracePath',
      previewDurationMs: 2000,
      waypoints
    };
  }

  /**
   * Normalizes client performance data into a 0–100 score.
   */
  static calculateScore(miniGameId, rawData = {}) {
    if (!rawData) return 0;

    let score = 0;
    switch (miniGameId) {
      case 'targetTap': {
        const hits = Number(rawData.hits) || 0;
        const total = Number(rawData.totalTargets) || 8;
        score = total > 0 ? (hits / total) * 100 : 0;
        break;
      }
      case 'colorMatch': {
        const correct = Number(rawData.correct) || 0;
        const wrong = Number(rawData.wrong) || 0;
        const total = correct + wrong;
        if (total > 0) {
          score = (correct / total) * 100;
          if (wrong === 0 && correct >= 3) {
            score = Math.min(100, score + 10);
          }
        }
        break;
      }
      case 'sequenceMemory': {
        const correct = Number(rawData.correctCells) || 0;
        const total = Number(rawData.totalCells) || 4;
        score = total > 0 ? (correct / total) * 100 : 0;
        break;
      }
      case 'quickMath': {
        const correct = Number(rawData.correct) || 0;
        const wrong = Number(rawData.wrong) || 0;
        const total = correct + wrong;
        if (total > 0) {
          score = (correct / total) * 100;
          if (correct > 3) {
            score = Math.min(100, score + (correct - 3) * 5);
          }
        }
        break;
      }
      case 'oddOneOut': {
        const correct = Number(rawData.correct) || 0;
        const wrong = Number(rawData.wrong) || 0;
        const total = Math.max(1, correct + wrong);
        score = (correct / total) * 100;
        break;
      }
      case 'tracePath': {
        const correct = Number(rawData.correctWaypoints) || 0;
        const total = Number(rawData.totalWaypoints) || 5;
        score = total > 0 ? (correct / total) * 100 : 0;
        break;
      }
      default:
        score = 0;
    }

    return Math.min(100, Math.max(0, Math.round(score)));
  }
}

module.exports = MiniGameEngine;
