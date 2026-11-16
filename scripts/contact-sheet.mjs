import { _electron as electron } from 'playwright-core';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const platform = process.argv[2] ?? 'android';
const dir = join(process.cwd(), '.shots', 'scenes', platform);
const files = readdirSync(dir).filter((f) => f.endsWith('.svg')).sort();
const cells = files.map((file) => {
  const name = file.replace('.svg', '');
  return `<figure><img src="${pathToFileURL(join(dir, file)).href}"><figcaption>${name}</figcaption></figure>`;
});
const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#07080a;color:#eef1f5;font:11px -apple-system,Helvetica,sans-serif;padding:18px}
  h1{font-size:16px;margin:0 0 14px;color:#d8ff63}
  .grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}
  figure{margin:0}
  img{width:100%;display:block;border-radius:12px;border:1px solid #2a2e35}
  figcaption{margin-top:5px;color:#8b93a0;font-size:10px}
</style><h1>${platform} scenes</h1><div class="grid">${cells.join('')}</div>`;
const sheet = join(process.cwd(), '.shots', `sheet-${platform}.html`);
writeFileSync(sheet, html);

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.PHONEEXPLORER_E2E = '1';
env.PHONEEXPLORER_DATA_DIR = join(process.cwd(), '.data', 'sheet');
const app = await electron.launch({ args: ['.', '--no-sandbox', '--disable-gpu'], env, timeout: 60000 });
try {
  const page = await app.firstWindow();
  await page.waitForSelector('.app');
  await page.setViewportSize({ width: 1320, height: 1200 });
  await page.goto(pathToFileURL(sheet).href);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(process.cwd(), '.shots', `sheet-${platform}.png`), fullPage: true });
} finally { await app.close(); }
