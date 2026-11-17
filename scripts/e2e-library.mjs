import { _electron as electron } from 'playwright-core';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const shots = join(root, '.shots');
const dataDir = join(root, '.data', 'library-e2e');
const shotDir = join(dataDir, 'screenshots');
await mkdir(shots, { recursive: true });
await rm(dataDir, { recursive: true, force: true });
await mkdir(shotDir, { recursive: true });

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.PHONEEXPLORER_E2E = '1';
env.PHONEEXPLORER_DATA_DIR = dataDir;
env.PHONEEXPLORER_SCREENSHOT_DIR = shotDir;

const app = await electron.launch({ args: ['.', '--no-sandbox', '--disable-gpu'], env, timeout: 60_000 });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => void dialog.accept());
  await page.waitForSelector('.phone-image', { timeout: 30_000 });
  await page.waitForTimeout(700);

  await page.locator('.phone-side--shot').click();
  await page.waitForTimeout(1200);
  const files = (await readdir(shotDir)).filter((file) => file.endsWith('.png'));
  if (files.length !== 1) throw new Error(`expected one screenshot file, got ${files.length}`);
  if (!(await page.locator('.toast-copy strong').last().textContent())?.includes('Screenshot saved')) {
    throw new Error('no screenshot confirmation');
  }

  await page.getByRole('tab', { name: /Library/ }).click();
  await page.waitForSelector('.shot-card', { timeout: 5_000 });
  if ((await page.locator('.shot-card').count()) !== 1) throw new Error('library did not list the shot');
  const dismiss = page.getByRole('button', { name: 'Dismiss notification' });
  if (await dismiss.count()) await dismiss.first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, '40-library.png') });

  await page.locator('.shot-card').first().click();
  await page.waitForSelector('.modal-shot', { timeout: 5_000 });
  await page.waitForTimeout(500);
  const src = await page.locator('.shot-view img').getAttribute('src');
  if (!src?.startsWith('data:image/png;base64,')) throw new Error('full screenshot did not load');
  await page.screenshot({ path: join(shots, '41-shot-viewer.png') });

  await page.locator('.modal-shot .btn.is-danger').click();
  await page.waitForTimeout(900);
  if ((await page.locator('.shot-card').count()) !== 0) throw new Error('deleted shot remains in library');
  if ((await readdir(shotDir)).filter((file) => file.endsWith('.png')).length !== 0) {
    throw new Error('screenshot file was not deleted');
  }
  if (errors.length) throw new Error(`renderer errors: ${errors.join('; ')}`);
  console.log('LIBRARY_E2E_OK');
} finally {
  await app.close();
}
