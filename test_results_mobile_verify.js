// test_results_mobile_verify.js
// Verify the fix for mobile results screen bug: player names visibility on mobile & desktop
const { chromium } = require('playwright-core');
const assert = require('assert');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/PC/.gemini/antigravity-ide/brain/adc7661b-8ace-4b2c-8987-dd5150086848';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function runVerification() {
  console.log('================================================================');
  console.log('VERIFYING MOBILE RESULTS SCREEN FIX (AFTER FIX)');
  console.log('Testing 8-player match standings on Mobile (390x844) & Desktop (1280x800)');
  console.log('================================================================\n');

  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true
  });

  // --- 1. MOBILE VIEWPORT (390x844) ---
  console.log('--- 1. Testing Mobile Viewport (390x844) ---');
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true
  });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Create room with 1 human + 7 bots
  await mobilePage.fill('#player-name-input', 'HumanTester');
  await mobilePage.click('#btn-create-room');
  await mobilePage.waitForSelector('#btn-start-game', { state: 'visible', timeout: 5000 });

  for (let i = 0; i < 7; i++) {
    await mobilePage.click('#btn-add-bot');
    await mobilePage.waitForTimeout(200);
  }

  // Fast timings for rapid completion
  await mobilePage.evaluate(() => {
    window.glitchApp.socket.emit('test-fast-timings', {
      roundDuration: 1200,
      preRoundDuration: 400,
      postRoundDuration: 400,
      eliminationDuration: 400
    });
  });
  await mobilePage.waitForTimeout(200);

  // Start game
  await mobilePage.click('#btn-start-game');

  console.log('Waiting for match completion to reach Results screen...');
  await mobilePage.waitForSelector('.results-screen-wrap', { state: 'visible', timeout: 120000 });
  console.log('✓ Mobile Results screen reached!\n');

  // Take AFTER screenshot (mobile)
  const afterMobilePath = path.join(ARTIFACTS_DIR, 'results_mobile_AFTER_fix.png');
  await mobilePage.screenshot({ path: afterMobilePath });
  console.log(`📸 AFTER screenshot (mobile): ${afterMobilePath}`);

  // Inspect mobile standings rows
  const mobileStandings = await mobilePage.evaluate(() => {
    const rows = document.querySelectorAll('.table-row');
    const results = [];
    rows.forEach(row => {
      const rankEl = row.querySelector('.td-rank');
      const nameEl = row.querySelector('.name-cell');
      const playerCol = row.querySelector('.td-player');
      const scoreEl = row.querySelector('.td-score');
      if (nameEl && playerCol) {
        const nameRect = nameEl.getBoundingClientRect();
        const playerRect = playerCol.getBoundingClientRect();
        const rankRect = rankEl.getBoundingClientRect();
        const scoreRect = scoreEl.getBoundingClientRect();
        results.push({
          rankText: rankEl.textContent.trim(),
          name: nameEl.textContent.trim(),
          nameVisible: nameRect.width > 0 && nameRect.height > 0,
          nameWidth: Math.round(nameRect.width),
          nameHeight: Math.round(nameRect.height),
          playerColWidth: Math.round(playerRect.width),
          rankWidth: Math.round(rankRect.width),
          scoreWidth: Math.round(scoreRect.width),
          playerColOverflow: window.getComputedStyle(playerCol).overflow
        });
      }
    });
    return results;
  });

  console.log('\n--- MOBILE STANDINGS DOM INSPECTION (390px) ---');
  let allMobileVisible = true;
  mobileStandings.forEach((s, i) => {
    console.log(`  Row ${i + 1} (${s.rankText}): name="${s.name}" | visible=${s.nameVisible} | nameWidth=${s.nameWidth}px | playerColWidth=${s.playerColWidth}px | scoreWidth=${s.scoreWidth}px`);
    if (!s.nameVisible || s.nameWidth < 20 || s.playerColWidth < 80) {
      allMobileVisible = false;
    }
  });

  const mobileGridInfo = await mobilePage.evaluate(() => {
    const headerRow = document.querySelector('.table-header-row');
    const dataRow = document.querySelector('.table-row');
    const tableEl = document.querySelector('.standings-table');
    return {
      tableWidth: Math.round(tableEl?.getBoundingClientRect().width || 0),
      headerCols: Array.from(headerRow?.children || []).map(el => ({
        text: el.textContent.trim(),
        width: Math.round(el.getBoundingClientRect().width),
        display: window.getComputedStyle(el).display
      })),
      dataCols: Array.from(dataRow?.children || []).map(el => ({
        class: el.className,
        width: Math.round(el.getBoundingClientRect().width),
        display: window.getComputedStyle(el).display
      }))
    };
  });

  console.log('\n--- MOBILE GRID COLUMN DETAILS ---');
  console.log(`  Standings table total width: ${mobileGridInfo.tableWidth}px`);
  mobileGridInfo.headerCols.forEach((c, i) => {
    console.log(`  Header col ${i}: "${c.text}" → width=${c.width}px, display=${c.display}`);
  });
  mobileGridInfo.dataCols.forEach((c, i) => {
    console.log(`  Data col ${i}: .${c.class} → width=${c.width}px, display=${c.display}`);
  });

  assert.strictEqual(mobileStandings.length, 8, 'Should have 8 players in final standings');
  assert.ok(allMobileVisible, 'All player names must be clearly visible and wide on mobile');
  assert.ok(mobileStandings[0].playerColWidth >= 120, 'Player column should be at least 120px wide on mobile');

  // --- 2. DESKTOP VIEWPORT (1280x800) ---
  console.log('\n--- 2. Testing Desktop Viewport (1280x800) to confirm zero regression ---');
  const desktopCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const desktopPage = await desktopCtx.newPage();
  await desktopPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  await desktopPage.fill('#player-name-input', 'DesktopHost');
  await desktopPage.click('#btn-create-room');
  await desktopPage.waitForSelector('#btn-start-game', { state: 'visible', timeout: 5000 });

  for (let i = 0; i < 7; i++) {
    await desktopPage.click('#btn-add-bot');
    await desktopPage.waitForTimeout(200);
  }

  await desktopPage.evaluate(() => {
    window.glitchApp.socket.emit('test-fast-timings', {
      roundDuration: 1200,
      preRoundDuration: 400,
      postRoundDuration: 400,
      eliminationDuration: 400
    });
  });
  await desktopPage.waitForTimeout(200);
  await desktopPage.click('#btn-start-game');

  console.log('Waiting for desktop match completion to reach Results screen...');
  await desktopPage.waitForSelector('.results-screen-wrap', { state: 'visible', timeout: 120000 });
  console.log('✓ Desktop Results screen reached!\n');

  const afterDesktopPath = path.join(ARTIFACTS_DIR, 'results_desktop_AFTER_fix.png');
  await desktopPage.screenshot({ path: afterDesktopPath });
  console.log(`📸 AFTER screenshot (desktop): ${afterDesktopPath}`);

  const desktopGridInfo = await desktopPage.evaluate(() => {
    const headerRow = document.querySelector('.table-header-row');
    const dataRow = document.querySelector('.table-row');
    const tableEl = document.querySelector('.standings-table');
    return {
      tableWidth: Math.round(tableEl?.getBoundingClientRect().width || 0),
      headerCols: Array.from(headerRow?.children || []).map(el => ({
        text: el.textContent.trim(),
        width: Math.round(el.getBoundingClientRect().width),
        display: window.getComputedStyle(el).display
      })),
      dataCols: Array.from(dataRow?.children || []).map(el => ({
        class: el.className,
        width: Math.round(el.getBoundingClientRect().width),
        display: window.getComputedStyle(el).display
      }))
    };
  });

  console.log('\n--- DESKTOP GRID COLUMN DETAILS ---');
  console.log(`  Standings table total width: ${desktopGridInfo.tableWidth}px`);
  desktopGridInfo.headerCols.forEach((c, i) => {
    console.log(`  Header col ${i}: "${c.text}" → width=${c.width}px, display=${c.display}`);
  });
  desktopGridInfo.dataCols.forEach((c, i) => {
    console.log(`  Data col ${i}: .${c.class} → width=${c.width}px, display=${c.display}`);
  });

  // Verify desktop still has all 5 columns visible
  const visibleHeaderCols = desktopGridInfo.headerCols.filter(c => c.display !== 'none');
  const visibleDataCols = desktopGridInfo.dataCols.filter(c => c.display !== 'none');
  assert.strictEqual(visibleHeaderCols.length, 5, 'Desktop should have all 5 header columns visible');
  assert.strictEqual(visibleDataCols.length, 5, 'Desktop should have all 5 data columns visible');

  await browser.close();
  console.log('\n================================================================');
  console.log('✓ ALL VERIFICATIONS PASSED: Mobile player names are 100% visible');
  console.log('  and desktop rendering remains completely intact!');
  console.log('================================================================\n');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
