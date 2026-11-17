import { _electron as electron } from 'playwright-core';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const shots = join(root, '.shots');
const dataDir = join(root, '.data', 'artefacts-e2e');
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
  await page.waitForSelector('.phone-image', { timeout: 30_000 });
  await page.waitForTimeout(800);

  await page.getByRole('tab', { name: /Artefacts/ }).click();
  await page.getByRole('button', { name: 'Capture walkthrough' }).click();
  await page.waitForSelector('.artefact-page', { timeout: 60_000 });
  await page.waitForTimeout(1200);

  const pages = await page.locator('.artefact-page').count();
  const titles = await page.locator('.artefact-page h4').allTextContents();
  for (const expected of ['Discover', 'Installed', 'Activity', 'Library', 'Settings', 'Artefacts']) {
    if (!titles.includes(expected)) throw new Error(`missing artefact page: ${expected}`);
  }
  if (pages < 14) throw new Error(`expected at least 14 pages, got ${pages}`);

  const dismiss = page.getByRole('button', { name: 'Dismiss notification' });
  while (await dismiss.count()) await dismiss.first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, '80-artefacts.png') });

  await page.locator('.artefact-page').first().click();
  await page.waitForSelector('.artefact-viewer', { timeout: 5_000 });
  await page.waitForTimeout(450);
  await page.screenshot({ path: join(shots, '81-artefact-page.png') });
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  await page.getByRole('tab', { name: /Library/ }).click();
  await page.waitForSelector('.shot-card', { timeout: 5_000 });
  const cards = await page.locator('.shot-card').count();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, '82-artefact-library.png') });
  if (cards < pages) throw new Error(`Library has ${cards} cards, expected ${pages}`);
  const files = (await readdir(shotDir)).filter((file) => file.endsWith('.png'));
  if (files.length < pages) throw new Error(`only ${files.length} screenshots saved`);
  const html = await readFile(join(artefactDir, 'artefact.html'), 'utf8');
  if (!html.includes('<!doctype html>') || !html.includes('PHONEEXPLORER · ARTEFACTS')) {
    throw new Error('artefact HTML was not written');
  }
  if (errors.length) throw new Error(`renderer errors: ${errors.join('; ')}`);
  console.log(`ARTEFACTS_E2E_OK pages=${pages} cards=${cards} files=${files.length}`);
} finally {
  await app.close();
}
