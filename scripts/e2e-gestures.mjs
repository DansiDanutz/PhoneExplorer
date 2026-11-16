import { _electron as electron } from 'playwright-core';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const shots = join(root, '.shots');
const dataDir = join(root, '.data', 'gestures-e2e');
await mkdir(shots, { recursive: true });
await rm(dataDir, { recursive: true, force: true });
await mkdir(dataDir, { recursive: true });

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.PHONEEXPLORER_E2E = '1';
env.PHONEEXPLORER_DATA_DIR = dataDir;
const app = await electron.launch({ args: ['.', '--no-sandbox', '--disable-gpu'], env, timeout: 60_000 });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForSelector('.phone-image', { timeout: 30_000 });
  await page.waitForTimeout(900);

  // Gesture guide.
  await page.locator('.control-btn[aria-label="Gesture guide"]').click();
  await page.waitForSelector('.modal-guide', { timeout: 5_000 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(shots, '30-guide.png') });
  await page.getByRole('button', { name: 'Got it' }).click();

  // Right-click should act as Back: open the store, then go back.
  const before = await page.locator('.phone-image').getAttribute('src');
  await page.locator('.stage-actions .btn-primary').click();
  await page.waitForTimeout(700);
  const store = await page.locator('.phone-image').getAttribute('src');
  if (before === store) throw new Error('store did not open');
  const box = await page.locator('.phone-screen').boundingBox();
  if (!box) throw new Error('phone has no box');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  await page.waitForTimeout(700);
  const back = await page.locator('.phone-image').getAttribute('src');
  if (back === store) throw new Error('right-click did not send Back');

  // Scroll / pinch / long-press explain that demo screens are static.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(300);
  const scrollToast = await page.locator('.toast-copy strong').last().textContent();
  if (!scrollToast?.includes('Demo screens are static')) {
    throw new Error(`unexpected scroll toast: ${scrollToast}`);
  }
  await page.waitForTimeout(700);
  await page.locator('.control-btn[aria-label="Pinch to zoom in"]').click();
  await page.waitForTimeout(300);
  const pinchToast = await page.locator('.toast-copy strong').last().textContent();
  if (!pinchToast?.includes('Pinch is not simulated')) {
    throw new Error(`unexpected pinch toast: ${pinchToast}`);
  }
  await page.waitForTimeout(700);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(760);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const holdToast = await page.locator('.toast-copy strong').last().textContent();
  if (!holdToast?.includes('Long-press is not simulated')) {
    throw new Error(`unexpected hold toast: ${holdToast}`);
  }
  if (errors.length) throw new Error(`renderer errors: ${errors.join('; ')}`);
  await page.screenshot({ path: join(shots, '31-gestures.png') });
  console.log('GESTURES_E2E_OK');
} finally {
  await app.close();
}
