/**
 * screenshot-all.js
 * Captures desktop (1280x800) and mobile (390x844) screenshots of every page.
 * Run: node scripts/screenshot-all.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE         = 'http://localhost:5173';
const DESKTOP_DIR  = path.join(__dirname, '..', 'screenshots', 'desktop');
const MOBILE_DIR   = path.join(__dirname, '..', 'screenshots', 'mobile');

// Ensure output dirs exist
fs.mkdirSync(DESKTOP_DIR, { recursive: true });
fs.mkdirSync(MOBILE_DIR,  { recursive: true });

const BOSS_PAGES = [
  { url: '/boss/dashboard',         name: 'dashboard'          },
  { url: '/boss/submit-for-broker', name: 'submit-for-broker'  },
  { url: '/boss/entries',           name: 'entries'            },
  { url: '/boss/results',           name: 'results'            },
  { url: '/boss/settlements',       name: 'settlements'        },
  { url: '/boss/brokers',           name: 'brokers'            },
  { url: '/boss/employees',         name: 'employees'          },
  { url: '/boss/markets',           name: 'markets'            },
  { url: '/boss/rates',             name: 'rates'              },
  { url: '/boss/reports',           name: 'reports'            },
  { url: '/boss/search',            name: 'search'             },
  { url: '/boss/audit',             name: 'audit-logs'         },
];

const BROKER_PAGES = [
  { url: '/broker/home',       name: 'broker-home'         },
  { url: '/broker/submit',     name: 'broker-submit-entry' },
  { url: '/broker/entries',    name: 'broker-my-entries'   },
  { url: '/broker/tokens',     name: 'broker-my-tokens'    },
  { url: '/broker/settlement', name: 'broker-settlement'   },
];

async function screenshotPage(page, url, filePath) {
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(800); // let animations / charts settle
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`  ✅  ${path.basename(filePath)}`);
  } catch (err) {
    console.warn(`  ⚠️  ${path.basename(filePath)} — ${err.message.split('\n')[0]}`);
    // Still try a basic screenshot even if networkidle timed out
    try {
      await page.screenshot({ path: filePath, fullPage: true });
    } catch {}
  }
}

async function loginAs(page, username, password) {
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.fill('input[type="text"]',     username);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from login page
  await page.waitForFunction(() => !window.location.pathname.endsWith('/'), { timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(1000);
}

async function runViewport(browser, label, dir, viewport) {
  console.log(`\n📸  ${label} screenshots (${viewport.width}×${viewport.height})`);
  const ctx  = await browser.newContext({ viewport });
  const page = await ctx.newPage();

  // ── Login page ─────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(dir, 'login.png'), fullPage: true });
  console.log(`  ✅  login.png`);

  // ── Boss pages ─────────────────────────────────────────────────
  console.log('\n  Boss panel:');
  await loginAs(page, 'boss', 'boss123');
  for (const p of BOSS_PAGES) {
    await screenshotPage(page, p.url, path.join(dir, `${p.name}.png`));
  }

  // ── Broker pages ───────────────────────────────────────────────
  console.log('\n  Broker panel:');
  await loginAs(page, 'BRK001', 'broker123');
  for (const p of BROKER_PAGES) {
    await screenshotPage(page, p.url, path.join(dir, `${p.name}.png`));
  }

  await ctx.close();
}

async function main() {
  console.log('🚀  MatkaBook Pro — Screenshot Capture');
  console.log('    Frontend: http://localhost:5173');
  console.log('    Backend:  http://localhost:5000\n');

  const browser = await chromium.launch({ headless: true });

  await runViewport(browser, 'Desktop', DESKTOP_DIR, { width: 1280, height: 800  });
  await runViewport(browser, 'Mobile',  MOBILE_DIR,  { width: 390,  height: 844  });

  await browser.close();

  // ── Summary ────────────────────────────────────────────────────
  const desktopFiles = fs.readdirSync(DESKTOP_DIR).filter(f => f.endsWith('.png'));
  const mobileFiles  = fs.readdirSync(MOBILE_DIR).filter(f => f.endsWith('.png'));
  console.log(`\n✅  Done!`);
  console.log(`    Desktop: ${desktopFiles.length} screenshots → ${DESKTOP_DIR}`);
  console.log(`    Mobile:  ${mobileFiles.length} screenshots → ${MOBILE_DIR}`);
  console.log(`    Total:   ${desktopFiles.length + mobileFiles.length} screenshots`);
}

main().catch((err) => { console.error('\n❌  Fatal error:', err); process.exit(1); });
