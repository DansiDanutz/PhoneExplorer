import { _electron as electron } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, '.shots', 'showcase');
await mkdir(out, { recursive: true });
const dataDir = join(root, '.data', 'showcase');
await mkdir(dataDir, { recursive: true });
await writeFile(
  join(dataDir, 'settings.json'),
  JSON.stringify({ fps: 5, quality: 80, autoPreview: true, adbPath: '', demoPlatform: 'android', reduceMotion: false }, null, 2),
);

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.PHONEEXPLORER_E2E = '1';
env.PHONEEXPLORER_DATA_DIR = dataDir;

const app = await electron.launch({ args: ['.', '--no-sandbox', '--disable-gpu'], env, timeout: 60_000 });
try {
  const page = await app.firstWindow();
  await page.waitForSelector('.phone-image', { timeout: 30_000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(out, '01-home.png') });

  await page.locator('.stage-actions .btn-primary').click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(out, '02-store.png') });

  await page.getByRole('button', { name: 'Install Spotify', exact: true }).first().click();
  await page.getByRole('button', { name: 'Open Spotify', exact: true }).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(5600);
  await page.screenshot({ path: join(out, '03-app-detail.png') });

  await page.getByRole('button', { name: 'Open Spotify', exact: true }).first().click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(out, '04-spotify.png') });

  await page.locator('.control-btn[aria-label="Home"]').click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(out, '05-home-installed.png') });

  await page.getByRole('tab', { name: /Installed/ }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, '06-installed.png') });

  await page.getByRole('tab', { name: /Discover/ }).click();
  await page.locator('.app-row').filter({ hasText: 'Spotify' }).first().locator('.app-row-main').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, '07-app-sheet.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await page.locator('.stage-actions .icon-btn').last().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, '08-focus.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await page.locator('.demo-card').filter({ hasText: 'iPhone 16 Pro' }).locator('.demo-card-pick').click();
  await page.waitForTimeout(1200);
  await page.getByRole('tab', { name: /Discover/ }).click();
  await page.locator('.stage-actions .btn-primary').click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(out, '09-iphone-store.png') });

  await page.getByRole('button', { name: 'Install WhatsApp', exact: true }).first().click();
  await page.getByRole('button', { name: 'Open WhatsApp', exact: true }).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Open WhatsApp', exact: true }).first().click();
  await page.waitForTimeout(5600);
  await page.screenshot({ path: join(out, '10-iphone-chat.png') });

  await page.locator('.titlebar .icon-btn[aria-label="Settings"]').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, '11-settings.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await page.locator('.no-device').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, '12-connect.png') });

  console.log('SHOWCASE_OK');
} finally {
  await app.close();
}
