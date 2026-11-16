import { writeFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import { DemoDevice } from '../demo';

test('renders valid home SVG', () => {
  const device = new DemoDevice('android');
  const frame = device.render(Date.now());
  writeFileSync('.shots/home.svg', frame.svg);
  expect(frame.svg.length).toBeGreaterThan(1000);
});


test('opens a built-in app from every home tile', () => {
  const device = new DemoDevice('android');
  const home = device.render(Date.now());
  const camera = home.hotspots.find((h) => h.label === 'Open Camera');
  expect(camera).toBeTruthy();
  expect(device.tap(camera!.x + 2, camera!.y + 2)).toBe(true);
  const screen = device.render(Date.now());
  writeFileSync('.shots/system.svg', screen.svg);
  expect(screen.svg).toContain('BUILT-IN DEMO APP');
  expect(screen.svg).toContain('Camera');
  const back = screen.hotspots.find((h) => h.label === 'Back');
  expect(back).toBeTruthy();
  expect(device.tap(back!.x + 2, back!.y + 2)).toBe(true);
  expect(device.currentScreen.kind).toBe('home');
});
