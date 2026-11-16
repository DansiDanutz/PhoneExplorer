import { _electron as electron } from 'playwright-core';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const shots = join(root, '.shots');
const dataDir = join(root, '.data', 'models-e2e');
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
  page.on('dialog', (dialog) => void dialog.accept());
  await page.waitForSelector('.phone-image', { timeout: 30_000 });
  await page.locator('.rail-heading-link').click();
  await page.waitForSelector('.modal-models', { timeout: 5_000 });
  await page.waitForTimeout(400);
  await page.locator('.model-search-row input').fill('');
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(shots, '20-models.png') });

  const androidRows = page.locator('.model-row');
  if ((await androidRows.count()) < 8) throw new Error('expected the built-in Android models');

  // Search.
  await page.locator('.model-search-row input').fill('galaxy');
  await page.waitForTimeout(250);
  const galaxyRows = await page.locator('.model-row').count();
  if (galaxyRows !== 3) throw new Error(`expected 3 Galaxy models, got ${galaxyRows}`);
  await page.screenshot({ path: join(shots, '21-models-search.png') });

  // Use a model.
  await page.locator('.model-search-row .search-clear').click();
  await page.locator('.model-row').filter({ hasText: 'Galaxy S25 Ultra' }).locator('.model-use').click();
  await page.waitForTimeout(700);
  await page.locator('.model-foot .btn-primary').click();
  await page.waitForTimeout(500);
  const stageTitle = await page.locator('.stage h1').textContent();
  if (!stageTitle?.includes('Galaxy S25 Ultra')) throw new Error(`stage did not switch: ${stageTitle}`);

  // Open again and set it as the default.
  await page.locator('.rail-heading-link').click();
  await page.waitForTimeout(300);
  await page.locator('.model-row').filter({ hasText: 'Galaxy S25 Ultra' }).locator('.model-star').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(shots, '22-models-default.png') });

  // Add a custom model.
  await page.getByRole('button', { name: /Add model/ }).click();
  await page.getByLabel('Model name').fill('Aurora X');
  await page.getByLabel('Manufacturer').fill('Northstar');
  await page.getByLabel('OS version').fill('17');
  await page.getByLabel('Screen size (inches)').fill('6.4');
  await page.getByLabel('Width (px)').fill('1200');
  await page.getByLabel('Height (px)').fill('2600');
  await page.getByRole('button', { name: /Add & set default/ }).click();
  await page.waitForTimeout(900);
  const customRow = page.locator('.model-row').filter({ hasText: 'Aurora X' });
  if ((await customRow.count()) !== 1) throw new Error('custom model was not added');
  await page.screenshot({ path: join(shots, '23-models-custom.png') });
  await page.locator('.model-foot .btn-primary').click();
  await page.waitForTimeout(500);
  const customTitle = await page.locator('.stage h1').textContent();
  if (!customTitle?.includes('Aurora X')) throw new Error(`custom model not active: ${customTitle}`);

  // Check defaults in Settings.
  await page.locator('.titlebar .icon-btn[aria-label="Settings"]').click();
  await page.waitForTimeout(500);
  const settingsText = await page.locator('.settings-scroll').textContent();
  if (!settingsText?.includes('Aurora X')) throw new Error('default Android not shown in settings');
  if (!settingsText.includes('iPhone 16 Pro')) throw new Error('default iPhone not shown in settings');
  await page.screenshot({ path: join(shots, '24-defaults-settings.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Persisted values.
  const settings = JSON.parse(await readFile(join(dataDir, 'settings.json'), 'utf8'));
  const custom = settings.customModels.find((model) => model.name === 'Aurora X');
  if (!custom) throw new Error('custom model was not persisted');
  if (custom.screen.width !== 1200 || custom.screen.height !== 2600) {
    throw new Error(`unexpected custom screen: ${JSON.stringify(custom.screen)}`);
  }
  if (settings.defaultAndroidModelId !== custom.id) {
    throw new Error(`unexpected default Android: ${settings.defaultAndroidModelId}`);
  }
  if (settings.defaultIosModelId !== 'iphone-16-pro') {
    throw new Error(`unexpected default iPhone: ${settings.defaultIosModelId}`);
  }

  // Change the iPhone default.
  await page.locator('.rail-heading-link').click();
  await page.getByRole('tab', { name: /iPhone/ }).click();
  await page.waitForTimeout(300);
  await page.locator('.model-row').filter({ hasText: 'iPhone 16 Pro Max' }).locator('.model-star').click();
  await page.waitForTimeout(500);
  const footer = await page.locator('.model-defaults').textContent();
  if (!footer?.includes('iPhone 16 Pro Max')) throw new Error(`footer did not update: ${footer}`);
  await page.locator('.model-foot .btn-primary').click();

  const settings2 = JSON.parse(await readFile(join(dataDir, 'settings.json'), 'utf8'));
  if (settings2.defaultIosModelId !== 'iphone-16-pro-max') {
    throw new Error(`unexpected iPhone default: ${settings2.defaultIosModelId}`);
  }

  // Delete the custom model.
  await page.locator('.rail-heading-link').click();
  await page.getByRole('tab', { name: /Android/ }).click();
  await page.waitForTimeout(300);
  await page.locator('.model-row').filter({ hasText: 'Aurora X' }).locator('.model-delete').click();
  await page.waitForTimeout(900);
  if ((await page.locator('.model-row').filter({ hasText: 'Aurora X' }).count()) !== 0) {
    throw new Error('custom model was not deleted');
  }
  const settings3 = JSON.parse(await readFile(join(dataDir, 'settings.json'), 'utf8'));
  if (settings3.defaultAndroidModelId !== 'pixel-9-pro') {
    throw new Error(`default Android did not fall back: ${settings3.defaultAndroidModelId}`);
  }
  await page.locator('.model-foot .btn-primary').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(shots, '25-models-final.png') });

  console.log('MODELS_E2E_OK');
} finally {
  await app.close();
}
