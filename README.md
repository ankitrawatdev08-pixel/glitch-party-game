# ⚡ GLITCH — Real-Time Sabotage Party Game

> **Contest Entry for Handshake AI Skills Studio × OpenAI "Create a Multiplayer Game" Challenge**  
> *"WarioWare meets Mario Kart items — a party game where skill matters, but chaos keeps everyone dangerous."*

---

## 🏆 Project Overview

- **Title**: GLITCH
- **Format**: Real-time multiplayer web party game (2–8 players)
- **Tech Stack**: Node.js + Express + Socket.io (Server) | Vanilla HTML5 + CSS3 + Canvas + Web Audio API (Client)
- **Constraint Compliance**:
  - **Zero external image files** — all UI, badges, and avatars rendered via CSS, procedural SVG, and HTML5 Canvas.
  - **Zero external audio files** — all sound effects synthesized dynamically with the Web Audio API.
  - **No client framework dependencies** — fast, lightweight, and mobile-first responsive design.

---

## 🎮 Game Concept & Rules

Players compete in simultaneous **8-second micro-challenges** (tapping targets, solving Stroop tests, memorizing sequences, quick math, finding odd shapes, tracing paths).

1. **Earn Glitch Tokens**:
   - Score ≥ 80 pts ➔ **+2 Tokens**
   - Score ≥ 50 pts ➔ **+1 Token**
   - Score < 50 pts ➔ **0 Tokens** (Max bank: 5 tokens)
2. **Real-Time Sabotage (Pre-Round)**:
   - Spend tokens during the 3-second pre-round to attack opponents' screens:
     - 🔄 **Screen Flip**: Inverts their entire screen 180° via CSS.
     - 🍮 **Jelly Mode**: Distorts their UI with rapid fluid sine waves.
     - 🌫️ **Fog of War**: Covers 70% of their display in dark fog with a moving flashlight.
     - 🔀 **Input Swap**: Mirrors left and right touch/click coordinates.
     - ⚡ **Speed Demon**: Accelerates minigame pace and timer to 1.5× speed.
3. **Phases & Eliminations**:
   - Every 3 rounds = 1 Phase.
   - Lowest cumulative Phase scorer is **GLITCHED OUT**!
   - Eliminated players become **Ghosts** who haunt survivors with **1 free glitch per round**.
4. **Final Showdown**:
   - When 2 players remain, an intense 1v1 Final Showdown begins (pure skill finale, no ghost glitches).
   - In 2-player games: 6 rounds, 0 eliminations, highest cumulative score wins.

---

## 🕹️ The 6 Minigames

1. **Target Tap**: High-speed circular target popping with scale animations and particle bursts.
2. **Color Match (Stroop Test)**: Read color words written in contrasting ink — tap the ink color, not the word!
3. **Sequence Memory**: Dynamic tile memory test flashing sequences of 4–6 cells.
4. **Quick Math**: Rapid arithmetic challenges under intense countdown pressure.
5. **Odd One Out**: Procedural geometric grid where one shape differs by color, size, or rotation.
6. **Trace The Path**: Memorize waypoint paths before the connections vanish and tap them in order.

---

## 🚀 Running Locally

1. **Clone & Install**:
   ```bash
   git clone <repo-url>
   cd "Game project"
   npm install
   ```

2. **Start Server**:
   ```bash
   npm start
   ```

3. **Open in Browser**:
   Navigate to `http://localhost:3000` on your desktop or phone (on the same local Wi-Fi via your machine's local IP address).

---

## ☁️ Deployment Guide (Render & Railway)

### Option 1: Render.com (Recommended Free Tier)
1. Push your repository to GitHub.
2. Sign in to [Render.com](https://render.com) and click **New + ➔ Web Service**.
3. Select your GitHub repository.
4. Configure service settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Auto-Deploy**: `Yes`
5. Render automatically provides `process.env.PORT` and HTTPS WebSockets.
6. Share your live `https://<app-name>.onrender.com` link!

### Option 2: Railway.app
1. Go to [Railway.app](https://railway.app) and click **New Project ➔ Deploy from GitHub repo**.
2. Railway detects the `package.json` and runs `npm start` automatically.
3. Under **Settings ➔ Networking**, click **Generate Domain** to get a public URL.

---

## 🧪 Automated Test Suite

Run the full end-to-end multi-client simulation test (3 simultaneous socket clients playing through pre-rounds, attacks, elimination, ghost mode, showdown, and play-again reset):

```bash
node test_simulation.js
```
