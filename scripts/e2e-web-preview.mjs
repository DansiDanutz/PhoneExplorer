import { _electron as electron } from 'playwright-core';
import { createServer } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const server = createServer((req, res) => {
  res.end('<meta name="viewport" content="width=device-width"><script>fetch("/metrics?w="+innerWidth)</scr' + 'ipt>');
});
let resolveMetrics;
const metrics = new Promise(resolve => { resolveMetrics = resolve; });
server.on('request', req => {
  if (req.url.startsWith('/metrics?')) resolveMetrics([req.url, req.headers['user-agent']]);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, PHONEEXPLORER_E2E: '1', PHONEEXPLORER_DATA_DIR: await mkdtemp(join(tmpdir(), 'phone-preview-')) };
delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
  app = await electron.launch({executablePath: process.argv[2], args: process.argv[2] ? ['--demo'] : ['.', '--demo'], env});
  const page = await app.firstWindow();
  await page.locator('.status-pill').click();
  await page.getByLabel('iPhone model', {exact:true}).selectOption('iPhone 18 Pro Max');
  await page.getByLabel('iPhone web preview').fill('http://127.0.0.1:'+server.address().port);
  await page.getByRole('button', {name:'Preview', exact:true}).click();
  let timer;
  try {
    const [url, ua] = await Promise.race([metrics, new Promise((_,reject) => {timer=setTimeout(()=>reject(Error('No WebKit viewport report')),20000)})]);
    assert.equal(url,'/metrics?w=440'); assert.match(ua,/iPhone/);
  } finally { clearTimeout(timer); }
  console.log('PhoneExplorer opened iPhone WebKit at 440 CSS pixels.');
} finally { await app?.close(); server.close(); }
