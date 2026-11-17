import { _electron as electron } from 'playwright-core';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Manual/device test. Requires a real Android phone, tesseract and the local
// Laya service. CI has no phone, so this is not part of the CI matrix.
const root = fileURLToPath(new URL('..', import.meta.url));
const shots = join(root, '.shots');
const dataDir = join(root, '.data', 'phone-artefacts-e2e');
const shotDir = join(dataDir, 'screenshots');
const artefactDir = join(dataDir, 'Artefacts');
await mkdir(shots, { recursive: true });
await rm(dataDir, { recursive: true, force: true });
await mkdir(shotDir, { recursive: true });
await mkdir(artefactDir, { recursive: true });
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.PHONEEXPLORER_E2E = '1';
env.PHONEEXPLORER_DATA_DIR = dataDir;
env.PHONEEXPLORER_SCREENSHOT_DIR = shotDir;
env.PHONEEXPLORER_ARTEFACT_DIR = artefactDir;
const app = await electron.launch({ args: ['.', '--no-sandbox', '--disable-gpu'], env, timeout: 60_000 });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForSelector('.phone-screen', { timeout: 30_000 });
  await page.waitForTimeout(1200);
  await page.getByRole('tab', { name: /Artefacts/ }).click();
  await page.getByRole('button', { name: 'Record an artefact' }).click();
  await page.waitForSelector('.recording-hud', { timeout: 10_000 });
  for (const [x, y] of [[0.5, 0.95], [0.5, 0.55], [0.5, 0.95]]) {
    await page.evaluate(([px, py]) => window.phone.tap(px, py), [x, y]);
    await page.waitForTimeout(1700);
  }
  await page.getByRole('button', { name: 'Stop recording' }).first().click();
  await page.waitForSelector('.artefact-page', { timeout: 120_000 });
  await page.waitForTimeout(1200);
  const pages = await page.locator('.artefact-page').count();
  const titles = await page.locator('.artefact-page h4').allTextContents();
  if (pages < 2) throw new Error(`expected at least 2 phone views, got ${pages}`);
  const files = (await readdir(shotDir, { recursive: true })).filter((f) => f.endsWith('.png'));
  if (files.length < pages) throw new Error('phone screenshots missing from Library');
  const videos = (await readdir(join(shotDir, 'Recordings'))).filter((f) => f.endsWith('.mp4'));
  if (videos.length === 0) throw new Error('recording video missing');
  const dismiss = page.getByRole('button', { name: 'Dismiss notification' });
  while (await dismiss.count()) await dismiss.first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, '97-phone-artefacts.png') });
  if (errors.length) throw new Error(`renderer errors: ${errors.join('; ')}`);
  console.log(`PHONE_ARTEFACTS_E2E_OK pages=${pages} files=${files.length}`);
  console.log(titles);
} finally {
  await app.close();
}
