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
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(500);
  if ((await page.locator('.phone-image').getAttribute('src')) === store) {
    throw new Error('store wheel scroll did not change the chart');
  }
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(500);
  await page.mouse.click(cx, cy, { button: 'right' });
  await page.waitForTimeout(700);
  const back = await page.locator('.phone-image').getAttribute('src');
  if (back === store) throw new Error('right-click did not send Back');

  // Arrow keys swipe / scroll the demo. The store hotspot only exists on
  // the first home page, so it is a stable page marker.
  const onFirstPage = async () =>
    (await page.locator('.hotspot[aria-label="Open Play Store"]').count()) === 1;
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(450);
  if (await onFirstPage()) throw new Error('ArrowLeft did not swipe the home screen');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(450);
  if (!(await onFirstPage())) throw new Error('ArrowRight did not return to the first home page');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(450);
  if (await onFirstPage()) throw new Error('ArrowUp did not scroll the home screen');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(450);
  if (!(await onFirstPage())) throw new Error('ArrowDown did not return to the first home page');

  // Every home tile is a real hit target, not just artwork.
  await page.locator('.hotspot[aria-label="Open Camera"]').click();
  await page.waitForTimeout(600);
  const camera = await page.locator('.phone-image').getAttribute('src');
  if (camera === back) throw new Error('Camera tile did not open');
  if ((await page.locator('.hotspot[aria-label="Back"]').count()) !== 1) {
    throw new Error('Camera screen has no Back hotspot');
  }
  await page.screenshot({ path: join(shots, '32-camera.png') });
  await page.locator('.hotspot[aria-label="Back"]').click();
  await page.waitForTimeout(600);
  if (!(await onFirstPage())) throw new Error('Camera Back did not return home');

  // Wheel scrolls the demo between home pages.
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(450);
  if (await onFirstPage()) throw new Error('wheel up did not scroll the home screen');
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(450);
  if (!(await onFirstPage())) throw new Error('wheel down did not return to the first home page');
  await page.waitForTimeout(300);
  await page.locator('.control-btn[aria-label="Pinch to zoom in"]').click();
  await page.waitForTimeout(300);
  const zoomTransform = await page.locator('.stage-phone-zoom').evaluate(
    (element) => getComputedStyle(element).transform,
  );
  if (zoomTransform === 'none') throw new Error('demo pinch did not zoom the mirror');
  const zoomLabel = await page.locator('.control-state').textContent();
  if (!zoomLabel?.includes('DEMO ZOOM')) throw new Error(`unexpected zoom label: ${zoomLabel}`);
  await page.locator('.control-state').click();
  await page.waitForTimeout(350);
  await page.mouse.move(cx, cy);
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
