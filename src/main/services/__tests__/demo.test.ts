import { writeFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import { DemoDevice } from '../demo';

test('renders valid home SVG', () => {
  const device = new DemoDevice('android');
  const frame = device.render(Date.now());
  writeFileSync('.shots/home.svg', frame.svg);
  expect(frame.svg.length).toBeGreaterThan(1000);
});
