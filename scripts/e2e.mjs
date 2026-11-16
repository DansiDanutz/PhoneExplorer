import { _electron as electron } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const shots = new URL('../.shots/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.PHONEEXPLORER_E2E = '1';
env.PHONEEXPLORER_DATA_DIR = new URL('../.data/e2e/', import.meta.url).pathname;

const app = await electron.launch({
  args: ['.', '--no-sandbox', '--disable-gpu'],
  env,
  timeout: 60_000,
});

try {
const page = await app.firstWindow();
page.on('console', (message) => {
  if (message.type() === 'error') console.log('[renderer]', message.text());
});
page.on('pageerror', (error) => console.log('[pageerror]', error.message));
app.process().stdout?.on('data', (d) => console.log('[main]', String(d).trim()));
app.process().stderr?.on('data', (d) => console.log('[main:err]', String(d).trim()));

await page.waitForSelector('.app', { timeout: 30_000 });
await page.waitForTimeout(3000);
const diag = await page.evaluate(async () => {
  const s = await window.phone.getState();
  return {
    active: s.activeDeviceId,
    preview: s.preview,
    devices: s.devices.map((d) => ({ id: d.id, status: d.status, demo: d.isDemo })),
    frameEl: Boolean(document.querySelector('.phone-image')),
    placeholder: document.querySelector('.placeholder-title')?.textContent,
    settings: s.settings,
  };
});
console.log('DIAG', JSON.stringify(diag, null, 2));
await page.screenshot({ path: `${shots}00-diag.png` });
await page.waitForSelector('.phone-image', { timeout: 20_000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${shots}01-home.png` });

// Open the simulated Play Store from the stage action.
await page.locator('.stage-actions .btn-primary').click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${shots}02-store.png` });

// Install Spotify the way a user would: tap Get inside the mirror.
const install = page.getByRole('button', { name: 'Install Spotify', exact: true }).first();
await install.waitFor({ timeout: 10_000 });
await install.click();
await page.waitForTimeout(1100);
await page.screenshot({ path: `${shots}03-installing.png` });

await page.getByRole('button', { name: 'Open Spotify', exact: true }).first().waitFor({ timeout: 12_000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${shots}04-installed.png` });
await page.getByRole('button', { name: 'Open Spotify', exact: true }).first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${shots}05-app.png` });

// Back to the home screen, then look at the installed tab.
await page.locator('.control-btn[aria-label="Home"]').click();
await page.waitForTimeout(500);
await page.getByRole('tab', { name: /Installed/ }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}06-installed-tab.png` });

// Back to Discover, then open the app detail sheet.
await page.getByRole('tab', { name: /Discover/ }).click();
await page.waitForTimeout(300);
await page.locator('.app-row').filter({ hasText: 'Spotify' }).first().locator('.app-row-main').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}06b-app-sheet.png` });
await page.getByRole('button', { name: 'QR code', exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}06c-qr.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// Focus mode.
await page.locator('.stage-actions .icon-btn').last().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}06d-focus.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// iPhone demo.
await page.locator('.demo-btn').filter({ hasText: 'iPhone 16 Pro' }).click();
await page.waitForTimeout(900);
await page.getByRole('tab', { name: /Discover/ }).click();
await page.locator('.stage-actions .btn-primary').click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${shots}07-ios-store.png` });

// Install WhatsApp on the iPhone demo and open its chat screen.
await page.getByRole('button', { name: 'Install WhatsApp', exact: true }).first().click();
await page.getByRole('button', { name: 'Open WhatsApp', exact: true }).first().waitFor({ timeout: 12_000 });
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Open WhatsApp', exact: true }).first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${shots}07b-ios-app.png` });

// Settings sheet.
await page.locator('.titlebar .icon-btn[aria-label="Settings"]').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}08-settings.png` });
await page.keyboard.press('Escape');

// Connect sheet.
await page.locator('.no-device').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}09-connect.png` });
await page.keyboard.press('Escape');

console.log('E2E_OK', await page.title());
} finally {
  await app.close();
}
