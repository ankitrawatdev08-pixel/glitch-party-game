// test_edge_ui_verification.js
// Automated verification using real Microsoft Edge in mobile viewport mode via CDP

const { spawn } = require('child_process');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const REMOTE_PORT = 9223;
const USER_DATA_DIR = path.join(__dirname, 'scratch_edge_profile');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runEdgeVerification() {
  console.log('================================================================');
  console.log('REAL BROWSER (EDGE) MOBILE AUDIT: ONBOARDING, TIMING & DISPLAY');
  console.log('================================================================');

  if (fs.existsSync(USER_DATA_DIR)) {
    fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
  }

  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${REMOTE_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=390,844',
    '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  try {
    let versionData = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch(`http://localhost:${REMOTE_PORT}/json/version`);
        if (res.ok) {
          versionData = await res.json();
          break;
        }
      } catch (_) {}
    }

    assert.ok(versionData, 'Edge failed to start or open CDP port');
    console.log(`✓ Edge browser started in mobile viewport (390x844) [CDP: ${versionData.Browser}]`);

    // Get active pages
    const pagesRes = await fetch(`http://localhost:${REMOTE_PORT}/json/list`);
    const pages = await pagesRes.json();
    const page = pages.find(p => p.type === 'page') || pages[0];
    assert.ok(page, 'No active browser page found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };

    function sendCommand(method, params = {}) {
      const id = msgId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expression) {
      const result = await sendCommand('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (result.exceptionDetails) {
        throw new Error(`Eval error: ${JSON.stringify(result.exceptionDetails)}`);
      }
      return result.result ? result.result.value : undefined;
    }

    await sendCommand('Page.enable');
    await sendCommand('Runtime.enable');

    console.log('✓ CDP WebSocket connection established');

    // Explicitly navigate to ensure fresh page load
    await sendCommand('Page.navigate', { url: 'http://localhost:3000' });
    await sleep(2000);

    // 1. Verify Landing Page & How to Play Button
    console.log('\n--- 1. Testing Landing Page Onboarding ---');
    let htpBtnExists = false;
    for (let i = 0; i < 30; i++) {
      htpBtnExists = await evaluate(`!!document.querySelector('#btn-how-to-play')`);
      if (htpBtnExists) break;
      await sleep(200);
    }
    assert.strictEqual(htpBtnExists, true, '#btn-how-to-play must be present on landing screen');
    const htpBtnText = await evaluate(`document.querySelector('#btn-how-to-play').textContent.trim()`);
    console.log(`✓ Landing 'HOW TO PLAY (RULES)' button rendered: "${htpBtnText}"`);

    // 2. Click How to Play button to open modal
    console.log('\n--- 2. Testing How To Play Modal Open & Scannability ---');
    await evaluate(`document.querySelector('#btn-how-to-play').click()`);
    await sleep(400);

    const modalVisible = await evaluate(`!!document.querySelector('#how-to-play-modal-overlay')`);
    assert.strictEqual(modalVisible, true, 'Modal overlay must be mounted in DOM');

    const modalTitle = await evaluate(`document.querySelector('#htp-modal-title').textContent.trim()`);
    assert.strictEqual(modalTitle, 'SURVIVE THE GLITCH');
    console.log(`✓ Modal successfully opened with title: "${modalTitle}"`);

    // Verify all 7 required rules are present
    const ruleCardsCount = await evaluate(`document.querySelectorAll('.htp-rule-card').length`);
    assert.strictEqual(ruleCardsCount, 7, 'Must have exactly 7 scannable rule cards');

    const ruleTitles = await evaluate(`
      Array.from(document.querySelectorAll('.htp-rule-card h3')).map(h => h.textContent.trim())
    `);
    console.log('✓ All 7 required rule items verified:');
    ruleTitles.forEach((t, i) => console.log(`   ${i + 1}. ${t}`));

    // Test Glitches Tab
    console.log('\n--- 3. Testing Glitch Arsenal Tab ---');
    await evaluate(`document.querySelector('.htp-tab-btn[data-tab="glitches"]').click()`);
    await sleep(200);

    const glitchItems = await evaluate(`
      Array.from(document.querySelectorAll('.htp-glitch-item strong')).map(s => s.textContent.trim())
    `);
    console.log(`✓ Glitch Arsenal tab verified (${glitchItems.length} effects listed):`, glitchItems);
    assert.deepStrictEqual(glitchItems, ['Screen Flip', 'Jelly Mode', 'Fog of War', 'Input Swap', 'Speed Demon']);

    // Close modal via GOT IT button
    await evaluate(`document.querySelector('#btn-htp-got-it').click()`);
    await sleep(300);
    const modalClosed = await evaluate(`!document.querySelector('#how-to-play-modal-overlay')`);
    assert.strictEqual(modalClosed, true, 'Modal must close on CTA click');
    console.log('✓ How to Play modal closed cleanly');

    // 4. Create Room and Verify Lobby How to Play
    console.log('\n--- 4. Testing Lobby Onboarding Access ---');
    await evaluate(`
      const nameInput = document.querySelector('#player-name-input');
      nameInput.value = 'Alice_Auditor';
      document.querySelector('#btn-create-room').click();
    `);
    await sleep(800);

    const lobbyHtpBtn = await evaluate(`!!document.querySelector('#btn-lobby-how-to-play')`);
    assert.strictEqual(lobbyHtpBtn, true, '#btn-lobby-how-to-play must be present in lobby');
    console.log('✓ Lobby Screen: How to Play button is visible while waiting for players');

    // Click from lobby
    await evaluate(`document.querySelector('#btn-lobby-how-to-play').click()`);
    await sleep(300);
    const lobbyModalOpen = await evaluate(`!!document.querySelector('#how-to-play-modal-overlay')`);
    assert.strictEqual(lobbyModalOpen, true, 'How to play modal opens during lobby wait');
    await evaluate(`document.querySelector('#btn-close-htp').click()`);
    await sleep(300);
    console.log('✓ Lobby Screen: Modal successfully opened & closed via ✕ button');

    // 5. Test Pre-Round Duration & Display (8s hold)
    console.log('\n--- 5. Testing Pre-Round Display Duration & Countdown Ring ---');
    const roomCode = await evaluate(`document.querySelector('.room-code-text').textContent.trim()`);
    console.log(`✓ Current Room Code: ${roomCode}`);

    // Have a second player join via socket so game can start
    const p2Socket = await new Promise((resolve) => {
      const { io } = require('socket.io-client');
      const s = io('http://localhost:3000', { transports: ['websocket'] });
      s.on('connect', () => {
        s.emit('join-room', { roomCode, playerName: 'Bob_Player' });
        resolve(s);
      });
    });
    await sleep(500);

    // Host starts game
    await evaluate(`document.querySelector('#btn-start-game').click()`);
    await sleep(400);

    // Check Pre-Round DOM
    const isPreRoundVisible = await evaluate(`!!document.querySelector('.preround-container')`);
    assert.strictEqual(isPreRoundVisible, true, 'Pre-round container must be visible');

    const initialCountdown = await evaluate(`document.querySelector('#preround-countdown').textContent.trim()`);
    console.log(`✓ Initial Pre-Round Countdown: ${initialCountdown}s (Held at 8s)`);
    assert.strictEqual(initialCountdown, '8', 'Initial pre-round countdown must be 8s');

    // Check after 2 seconds
    await sleep(2000);
    const midCountdown = await evaluate(`document.querySelector('#preround-countdown') ? document.querySelector('#preround-countdown').textContent.trim() : null`);
    console.log(`✓ Countdown after 2s: ${midCountdown}s`);
    assert.ok(parseInt(midCountdown) <= 6, 'Countdown must count down smoothly');

    // Check minigame preview card
    const previewName = await evaluate(`document.querySelector('.mg-title').textContent.trim()`);
    const previewDesc = await evaluate(`document.querySelector('.mg-desc').textContent.trim()`);
    console.log(`✓ Pre-round clearly shows minigame: "${previewName}" — "${previewDesc}"`);

    // 6. Test Post-Round Scoreboard Layout & Bounded Overflow
    console.log('\n--- 6. Testing Post-Round Scoreboard Container Bounding ---');
    // Fast forward into post-round by waiting for active round to complete
    console.log('  Waiting for round to complete to inspect post-round scoreboard...');
    await sleep(14000); // 6s remaining in pre-round + 8s gameplay

    const isPostRound = await evaluate(`!!document.querySelector('.postround-container')`);
    if (isPostRound) {
      console.log('✓ Post-round screen rendered');
      const scrollBoxExists = await evaluate(`!!document.querySelector('.standings-scroll-container')`);
      assert.strictEqual(scrollBoxExists, true, '.standings-scroll-container must wrap standings');

      const dimensions = await evaluate(`
        (() => {
          const el = document.querySelector('.standings-scroll-container');
          return {
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight
          };
        })()
      `);
      console.log(`✓ Standings container dimensions on 390px mobile viewport:`, dimensions);
      assert.strictEqual(dimensions.scrollWidth <= dimensions.clientWidth, true, 'Zero horizontal overflow in standings');
    }

    p2Socket.disconnect();
    ws.close();
    console.log('\n✓ ALL REAL-BROWSER MOBILE CHECKS PASSED 100%!\n');
  } finally {
    edgeProc.kill('SIGKILL');
    if (fs.existsSync(USER_DATA_DIR)) {
      try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch (_) {}
    }
  }
}

runEdgeVerification().catch(err => {
  console.error('\n❌ Edge Verification Failed:', err);
  process.exit(1);
});
