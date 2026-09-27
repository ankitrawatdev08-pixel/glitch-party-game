// test_results_mobile.js
// Reproduce the mobile results screen bug: player names hidden/clipped
const { chromium } = require('playwright-core');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/PC/.gemini/antigravity-ide/brain/adc7661b-8ace-4b2c-8987-dd5150086848';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function run() {
  console.log('=== MOBILE RESULTS SCREEN BUG REPRODUCTION ===\n');

  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true
  });

  // --- MOBILE viewport (390x844) ---
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true
  });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Create room with 1 human + 7 bots and start game
  await mobilePage.fill('#player-name-input', 'TestPlayer');
  await mobilePage.click('#btn-create-room');
  await mobilePage.waitForSelector('#btn-start-game', { state: 'visible', timeout: 5000 });

  // Add 7 bots
  for (let i = 0; i < 7; i++) {
    await mobilePage.click('#btn-add-bot');
    await mobilePage.waitForTimeout(250);
  }

  // Fast timings for quick game completion
  await mobilePage.evaluate(() => {
    window.glitchApp.socket.emit('test-fast-timings', {
      roundDuration: 1500,
      preRoundDuration: 500,
      postRoundDuration: 500,
      eliminationDuration: 500
    });
  });
  await mobilePage.waitForTimeout(200);

  // Start game
  await mobilePage.click('#btn-start-game');

  // Wait for results screen to appear (game-over event triggers it)
  console.log('Waiting for game to complete and results screen to appear...');
  try {
    await mobilePage.waitForSelector('.results-screen-wrap', { state: 'visible', timeout: 120000 });
    console.log('✓ Results screen appeared!\n');
  } catch (e) {
    console.log('Timeout waiting for results screen. Taking diagnostic screenshot...');
    await mobilePage.screenshot({ path: path.join(ARTIFACTS_DIR, 'results_mobile_timeout.png') });
    
    // Check current DOM state
    const bodyText = await mobilePage.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('Current page text:', bodyText);
    
    await browser.close();
    process.exit(1);
  }

  // Take BEFORE screenshot (bug state)
  const beforePath = path.join(ARTIFACTS_DIR, 'results_mobile_BEFORE_fix.png');
  await mobilePage.screenshot({ path: beforePath });
  console.log(`📸 BEFORE screenshot (mobile): ${beforePath}`);

  // Inspect DOM for player names
  const standings = await mobilePage.evaluate(() => {
    const rows = document.querySelectorAll('.table-row');
    const results = [];
    rows.forEach(row => {
      const nameEl = row.querySelector('.name-cell');
      const playerCol = row.querySelector('.td-player');
      if (nameEl && playerCol) {
        const nameRect = nameEl.getBoundingClientRect();
        const playerRect = playerCol.getBoundingClientRect();
        results.push({
          name: nameEl.textContent.trim(),
          nameVisible: nameRect.width > 0 && nameRect.height > 0,
          nameWidth: Math.round(nameRect.width),
          playerColWidth: Math.round(playerRect.width),
          playerColOverflow: window.getComputedStyle(playerCol).overflow
        });
      }
    });
    return results;
  });

  console.log('\n--- STANDINGS DOM INSPECTION (MOBILE 390px) ---');
  standings.forEach((s, i) => {
    console.log(`  Row ${i + 1}: name="${s.name}" | visible=${s.nameVisible} | nameWidth=${s.nameWidth}px | playerColWidth=${s.playerColWidth}px | overflow=${s.playerColOverflow}`);
  });

  // Also check grid column actual widths
  const gridInfo = await mobilePage.evaluate(() => {
    const headerRow = document.querySelector('.table-header-row');
    const dataRow = document.querySelector('.table-row');
    if (!headerRow || !dataRow) return null;
    
    const headerCols = Array.from(headerRow.children).map(el => ({
      text: el.textContent.trim(),
      width: Math.round(el.getBoundingClientRect().width)
    }));
    
    const dataCols = Array.from(dataRow.children).map(el => ({
      class: el.className,
      width: Math.round(el.getBoundingClientRect().width)
    }));
    
    return {
      totalTableWidth: Math.round(document.querySelector('.standings-table')?.getBoundingClientRect().width || 0),
      headerCols,
      dataCols
    };
  });

  console.log('\n--- GRID COLUMN WIDTHS ---');
  console.log(`  Table total width: ${gridInfo?.totalTableWidth}px`);
  gridInfo?.headerCols.forEach((c, i) => {
    console.log(`  Header col ${i}: "${c.text}" → ${c.width}px`);
  });
  gridInfo?.dataCols.forEach((c, i) => {
    console.log(`  Data col ${i}: .${c.class} → ${c.width}px`);
  });

  // --- DESKTOP viewport (1280x800) for comparison ---
  const desktopCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const desktopPage = await desktopCtx.newPage();
  await desktopPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await desktopPage.fill('#player-name-input', 'DesktopTest');
  await desktopPage.click('#btn-create-room');
  await desktopPage.waitForSelector('#btn-start-game', { state: 'visible', timeout: 5000 });

  for (let i = 0; i < 7; i++) {
    await desktopPage.click('#btn-add-bot');
    await desktopPage.waitForTimeout(250);
  }

  await desktopPage.evaluate(() => {
    window.glitchApp.socket.emit('test-fast-timings', {
      roundDuration: 1500,
      preRoundDuration: 500,
      postRoundDuration: 500,
      eliminationDuration: 500
    });
  });
  await desktopPage.waitForTimeout(200);
  await desktopPage.click('#btn-start-game');

  try {
    await desktopPage.waitForSelector('.results-screen-wrap', { state: 'visible', timeout: 120000 });
    console.log('\n✓ Desktop results screen appeared!');
    const desktopPath = path.join(ARTIFACTS_DIR, 'results_desktop_reference.png');
    await desktopPage.screenshot({ path: desktopPath });
    console.log(`📸 Desktop reference screenshot: ${desktopPath}`);

    const desktopGrid = await desktopPage.evaluate(() => {
      const dataRow = document.querySelector('.table-row');
      if (!dataRow) return null;
      return Array.from(dataRow.children).map(el => ({
        class: el.className,
        width: Math.round(el.getBoundingClientRect().width)
      }));
    });

    console.log('\n--- DESKTOP GRID COLUMN WIDTHS ---');
    desktopGrid?.forEach((c, i) => {
      console.log(`  Data col ${i}: .${c.class} → ${c.width}px`);
    });
  } catch (e) {
    console.log('Desktop test timed out');
  }

  await browser.close();
  console.log('\n=== DONE ===');
  process.exit(0);
}

run().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
