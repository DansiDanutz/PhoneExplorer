import { _electron as electron } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const svg = readFileSync(join(root, 'build', 'icon.svg'), 'utf8');
const html = `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`;

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.PHONEEXPLORER_E2E = '1';
env.PHONEEXPLORER_DATA_DIR = join(root, '.data', 'icon');
const app = await electron.launch({ args: ['.', '--no-sandbox', '--disable-gpu'], env, timeout: 60_000 });
try {
  const page = await app.firstWindow();
  await page.waitForSelector('.app');
  await page.setViewportSize({ width: 1024, height: 1024 });
  await page.setContent(html);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(root, 'build', 'icon.png'), omitBackground: true });
  const iconset = join(root, 'build', 'icon.iconset');
  mkdirSync(iconset, { recursive: true });
  const { execFileSync } = await import('node:child_process');
  for (const size of [16, 32, 128, 256, 512]) {
    execFileSync('sips', ['-z', String(size), String(size), join(root, 'build', 'icon.png'), '--out', join(iconset, `icon_${size}x${size}.png`)]);
    execFileSync('sips', ['-z', String(size * 2), String(size * 2), join(root, 'build', 'icon.png'), '--out', join(iconset, `icon_${size}x${size}@2x.png`)]);
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(root, 'build', 'icon.icns')]);
} finally {
  await app.close();
}
