import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import { CATALOG } from '../../../shared/catalog';
import { DemoDevice } from '../demo';

const outDir = '.shots/scenes';
mkdirSync(outDir, { recursive: true });

test('every demo scene renders well-formed SVG', () => {
  for (const platform of ['android', 'ios'] as const) {
    const now = Date.now();
    let clock = now + 60_000;
    const device = new DemoDevice(platform);
    mkdirSync(`${outDir}/${platform}`, { recursive: true });

    const home = device.render(now);
    writeFileSync(`${outDir}/${platform}/home.svg`, home.svg);
    expect(home.hotspots.length).toBeGreaterThan(3);

    device.openStore();
    const store = device.render(now);
    writeFileSync(`${outDir}/${platform}/store.svg`, store.svg);

    for (const app of CATALOG) {
      clock += 10_000;
      const started = clock;
      device.startInstall(app.id, started);
      const detail = device.render(started + 400);
      writeFileSync(`${outDir}/${platform}/${app.id}-detail.svg`, detail.svg);
      device.tick(started + 5000);
      device.openApp(app.id);
      const scene = device.render(started + 5100);
      writeFileSync(`${outDir}/${platform}/${app.id}.svg`, scene.svg);
      expect(scene.svg).toContain('<svg');
    }
  }
});
