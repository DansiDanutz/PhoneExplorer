import { existsSync } from 'node:fs';
import { devices, webkit, type Browser } from 'playwright-core';

const previews = new Set<Browser>();

// Historical models share screen geometry, not their original version of Safari.
const classic = (height: number, deviceScaleFactor: number) => ({
  ...devices['iPhone SE'], screen: { width: 320, height }, viewport: { width: 320, height }, deviceScaleFactor,
});
const profiles = new Map(Object.entries(devices).filter(([name]) => name.startsWith('iPhone ') && !name.endsWith(' landscape')));
profiles.delete('iPhone SE');
for (const name of ['iPhone (original)', 'iPhone 3G', 'iPhone 3GS']) profiles.set(name, classic(480, 1));
for (const name of ['iPhone 4', 'iPhone 4s']) profiles.set(name, classic(480, 2));
for (const name of ['iPhone 5', 'iPhone 5c', 'iPhone 5s', 'iPhone SE (1st gen)']) profiles.set(name, devices['iPhone SE']);
for (const [name, equivalent] of Object.entries({
  'iPhone 6s': 'iPhone 6', 'iPhone 6s Plus': 'iPhone 6 Plus', 'iPhone XS': 'iPhone X',
  'iPhone XS Max': 'iPhone 11 Pro Max', 'iPhone SE (2nd gen)': 'iPhone SE (3rd gen)',
  'iPhone 18 Pro': 'iPhone 17 Pro', 'iPhone 18 Pro Max': 'iPhone 17 Pro Max',
})) profiles.set(name, devices[equivalent]);
export const previewModels = [...profiles.keys()].sort((a,b) => a.localeCompare(b,'en',{numeric:true}));
export function previewProfile(model: string) {
  const profile = profiles.get(model);
  if (!profile) throw new Error('Choose a supported iPhone model.');
  return profile;
}

export function previewUrl(input: string): string {
  const url = new URL(input);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Enter an HTTP or HTTPS address without credentials.');
  return url.href;
}

export async function openWebPreview(input: string, model: string): Promise<void> {
  const url = previewUrl(input);
  const profile = previewProfile(model);
  if (!existsSync(webkit.executablePath()))
    throw new Error('WebKit is missing. See the iPhone web preview setup in the PhoneExplorer README.');
  const browser = await webkit.launch({ headless: false });
  previews.add(browser);
  browser.once('disconnected', () => previews.delete(browser));
  try {
    const page = await browser.newPage(profile);
    page.once('close', () => { void browser.close().catch(() => {}); });
    await page.goto(url, { waitUntil: 'commit' });
  } catch (error) {
    await browser.close();
    throw error;
  }
}

export function closeWebPreviews(): void {
  for (const browser of previews) void browser.close().catch(() => {});
}
