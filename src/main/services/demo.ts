import { CATALOG, CATALOG_BY_ID, searchCatalog } from '../../shared/catalog';
import { markToSvg } from '../../shared/marks';
import { defaultPhoneModel } from '../../shared/phone-models';
import type {
  CatalogApp,
  DeviceInfo,
  Hotspot,
  MarkName,
  PhoneModel,
  PhonePlatform,
} from '../../shared/types';

export const DEMO_WIDTH = 402;
export const DEMO_HEIGHT = 874;

const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'SF Mono', 'JetBrains Mono', Menlo, monospace";

type Screen =
  | { kind: 'home' }
  | { kind: 'store' }
  | { kind: 'detail'; appId: string }
  | { kind: 'app'; appId: string }
  | { kind: 'system'; name: string };

interface DemoInstall {
  appId: string;
  startedAt: number;
  duration: number;
}

export interface DemoFrame {
  svg: string;
  hotspots: Hotspot[];
  width: number;
  height: number;
}

export interface DemoTick {
  changed: boolean;
  completedAppId?: string;
  install?: { appId: string; progress: number; phase: 'downloading' | 'installing' | 'done' };
}

const SEED_INSTALLED = ['maps', 'gmail', 'youtube'];

interface SystemTile {
  name: string;
  color: string;
  ink: string;
  mark: MarkName;
}

const SYSTEM_TILES: SystemTile[] = [
  { name: 'Camera', color: '#5f6673', ink: '#ffffff', mark: 'camera' },
  { name: 'Photos', color: '#f3c552', ink: '#3a2703', mark: 'grid' },
  { name: 'Clock', color: '#1f2127', ink: '#ffffff', mark: 'clock' },
  { name: 'Weather', color: '#3478f6', ink: '#ffffff', mark: 'cloud' },
  { name: 'Calendar', color: '#e5484d', ink: '#ffffff', mark: 'calendar' },
  { name: 'Settings', color: '#3b3f46', ink: '#e5e7eb', mark: 'gear' },
];

interface DockApp {
  name: string;
  color: string;
  ink: string;
  mark: MarkName;
}

const DOCK_APPS: DockApp[] = [
  { name: 'Phone', color: '#2fbf5b', ink: '#ffffff', mark: 'phone' },
  { name: 'Messages', color: '#2fbf5b', ink: '#ffffff', mark: 'chat' },
  { name: 'Browser', color: '#3478f6', ink: '#ffffff', mark: 'compass' },
  { name: 'Music', color: '#e5484d', ink: '#ffffff', mark: 'music' },
];

const BUILTIN_APPS = new Map<string, SystemTile | DockApp>(
  [...SYSTEM_TILES, ...DOCK_APPS].map((app) => [app.name, app]),
);

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function text(
  x: number,
  y: number,
  size: number,
  weight: number,
  fill: string,
  value: string,
  extra = '',
): string {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(value)}</text>`;
}

function mono(
  x: number,
  y: number,
  size: number,
  fill: string,
  value: string,
  extra = '',
): string {
  const tracking = /letter-spacing=/.test(extra) ? '' : 'letter-spacing=".4"';
  return `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size}" fill="${fill}" ${tracking} ${extra}>${esc(value)}</text>`;
}

function rr(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  extra = '',
): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
}

function shade(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = Number.parseInt(full, 16);
  if (!Number.isFinite(num)) return hex;
  const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (num & 255) + amount));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function wrapLines(value: string, maxChars: number, maxLines: number): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = next;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;]$/, '')}…`;
  }
  return lines.slice(0, maxLines);
}

function statusBar(
  platform: PhonePlatform,
  dark: boolean,
  time: string,
  battery: number,
): string {
  const ink = dark ? '#101114' : '#ffffff';
  const soft = dark ? 'rgba(16,17,20,.55)' : 'rgba(255,255,255,.7)';
  const bars = [0, 1, 2, 3]
    .map(
      (i) =>
        `<rect x="${296 + i * 5}" y="${25 - i * 2.4}" width="3" height="${4 + i * 2.4}" rx="1" fill="${ink}" opacity="${i === 0 ? 0.55 : 0.92}"/>`,
    )
    .join('');
  const wifi = `<path d="M325 22.4a8.4 8.4 0 0 1 10.2 0M327.6 25.4a4.6 4.6 0 0 1 5 0" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/><circle cx="330.2" cy="27.8" r="1.2" fill="${ink}"/>`;
  const batt = `<rect x="346" y="18.6" width="22" height="11" rx="3.4" fill="none" stroke="${ink}" stroke-opacity=".42" stroke-width="1.2"/><rect x="348" y="20.6" width="${Math.max(3, (18 * battery) / 100)}" height="7" rx="1.8" fill="${ink}"/><path d="M369.6 22.2v4.4a3 3 0 0 0 0-4.4z" fill="${ink}" opacity=".5"/>`;
  const island =
    platform === 'ios'
      ? `<rect x="139" y="11" width="124" height="35" rx="17.5" fill="#04050a"/><circle cx="245" cy="27.5" r="4.4" fill="#101a28"/><circle cx="244" cy="27" r="1.7" fill="#1f3b5c" opacity=".55"/>`
      : `<circle cx="201" cy="26" r="5.2" fill="#04050a"/><circle cx="201" cy="26" r="2.1" fill="#0d2233"/>`;
  return `<g>
    ${text(24, 30, 14.5, 600, ink, time, 'letter-spacing=".2"')}
    ${bars}${wifi}${batt}
    ${island}
    <path d="M0 54h402" stroke="${soft}" stroke-opacity=".12"/>
  </g>`;
}

function homeIndicator(dark: boolean): string {
  return `<rect x="141" y="858" width="120" height="5" rx="2.5" fill="${dark ? 'rgba(10,12,16,.32)' : 'rgba(255,255,255,.55)'}"/>`;
}

function appTile(app: CatalogApp, x: number, y: number, size: number): string {
  const radius = size * 0.245;
  const glyph = size * 0.52;
  const mark = markToSvg(app.mark, { color: app.ink, size: glyph });
  return `<g>
    ${rr(x, y + 4, size, size, radius, '#000000', 'opacity=".22"')}
    ${rr(x, y, size, size, radius, app.color)}
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="url(#tileSheen)"/>
    <g transform="translate(${x + (size - glyph) / 2}, ${y + (size - glyph) / 2})">${mark}</g>
  </g>`;
}

function systemTile(tile: SystemTile, x: number, y: number, size: number): string {
  const radius = size * 0.245;
  const glyph = size * 0.52;
  const mark = markToSvg(tile.mark, { color: tile.ink, size: glyph });
  return `<g>
    ${rr(x, y + 4, size, size, radius, '#000000', 'opacity=".22"')}
    ${rr(x, y, size, size, radius, tile.color)}
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="url(#tileSheen)"/>
    <g transform="translate(${x + (size - glyph) / 2}, ${y + (size - glyph) / 2})">${mark}</g>
  </g>`;
}

function storeBadge(platform: PhonePlatform, x: number, y: number, size: number): string {
  const bg = platform === 'ios' ? '#0a84ff' : '#0f9d58';
  const glyph =
    platform === 'ios'
      ? `<path d="M${x + size * 0.3} ${y + size * 0.72}  ${x + size * 0.52} ${y + size * 0.26}  ${x + size * 0.74} ${y + size * 0.72}z" fill="#fff"/>`
      : `<path d="M${x + size * 0.34} ${y + size * 0.26}v${size * 0.48}l${size * 0.4}-${size * 0.24}z" fill="#fff"/>`;
  return `${rr(x, y, size, size, size * 0.24, bg)}${glyph}`;
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

function renderHome(
  platform: PhonePlatform,
  installed: Set<string>,
  hot: (h: Omit<Hotspot, 'label'> & { label: string }) => void,
  dark: boolean,
  time: string,
  battery: number,
): string {
  const installedApps = CATALOG.filter((app) => installed.has(app.id));
  const slots: Array<
    | { kind: 'app'; app: CatalogApp }
    | { kind: 'store' }
    | { kind: 'system'; tile: SystemTile }
  > = [{ kind: 'store' }, ...installedApps.map((app) => ({ kind: 'app' as const, app }))];
  for (const tile of SYSTEM_TILES) {
    slots.push({ kind: 'system', tile });
  }

  const parts: string[] = [];
  const size = 58;
  const columns = 4;
  const startX = 30;
  const gapX = 95;
  const startY = 136;
  const gapY = 98;

  slots.forEach((slot, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = startX + col * gapX;
    const y = startY + row * gapY;
    parts.push(rr(x - 3, y - 3, size + 6, size + 6, 20, '#ffffff', 'opacity="0"'));
    if (slot.kind === 'store') {
      parts.push(storeBadge(platform, x, y, size));
      hot({ x, y, w: size, h: size, label: platform === 'ios' ? 'Open App Store' : 'Open Play Store', action: 'store' });
      parts.push(text(x + size / 2, y + size + 17, 11.5, 500, '#fff', platform === 'ios' ? 'App Store' : 'Play Store', 'text-anchor="middle"'));
    } else if (slot.kind === 'app') {
      const app = slot.app;
      parts.push(appTile(app, x, y, size));
      hot({ x, y, w: size, h: size, label: `Open ${app.name}`, action: 'app', value: app.id });
      parts.push(text(x + size / 2, y + size + 17, 11.5, 500, '#fff', app.name, 'text-anchor="middle"'));
    } else {
      const tile = slot.tile;
      parts.push(systemTile(tile, x, y, size));
      hot({ x, y, w: size, h: size, label: `Open ${tile.name}`, action: 'system', value: tile.name });
      parts.push(text(x + size / 2, y + size + 17, 11.5, 500, '#fff', tile.name, 'text-anchor="middle"'));
    }
  });

  const dockParts: string[] = [
    rr(18, 714, 366, 102, 34, platform === 'ios' ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.07)'),
    `<rect x="18.5" y="714.5" width="365" height="101" rx="33.5" fill="none" stroke="rgba(255,255,255,.14)"/>`,
  ];
  DOCK_APPS.forEach((item, i) => {
    const x = 43 + i * 82;
    const y = 728;
    dockParts.push(rr(x, y, 54, 54, 15, item.color));
    dockParts.push(
      `<g transform="translate(${x + 14}, ${y + 14})">${markToSvg(item.mark, { color: item.ink, size: 26 })}</g>`,
    );
    dockParts.push(text(x + 27, y + 71, 9.5, 500, 'rgba(255,255,255,.72)', item.name, 'text-anchor="middle"'));
    hot({ x, y, w: 54, h: 54, label: `Open ${item.name}`, action: 'system', value: item.name });
  });

  const search =
    platform === 'android'
      ? `${rr(31, 632, 340, 40, 20, 'rgba(255,255,255,.14)')}<circle cx="53" cy="652" r="6.2" fill="none" stroke="rgba(255,255,255,.72)" stroke-width="1.8"/><path d="m57.6 656.6 4.2 4.2" stroke="rgba(255,255,255,.72)" stroke-width="1.8" stroke-linecap="round"/>${text(70, 657, 12, 400, 'rgba(255,255,255,.66)', 'Search apps, web and more')}`
      : `${rr(31, 632, 340, 38, 19, 'rgba(255,255,255,.1)')}<circle cx="53" cy="651" r="5.8" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.7"/>${text(68, 656, 12, 500, 'rgba(255,255,255,.55)', 'Search', 'text-anchor="middle"')}`;

  const wallpaper =
    platform === 'ios'
      ? `<defs>
          <radialGradient id="wpA" cx="18%" cy="10%" r="70%"><stop offset="0" stop-color="#1d7d86"/><stop offset=".55" stop-color="#0c2c3d"/><stop offset="1" stop-color="#080d18"/></radialGradient>
          <radialGradient id="wpB" cx="88%" cy="82%" r="65%"><stop offset="0" stop-color="#3346a8" stop-opacity=".9"/><stop offset="1" stop-color="#0a0f1d" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="402" height="874" fill="url(#wpA)"/><rect width="402" height="874" fill="url(#wpB)"/>
        <circle cx="330" cy="120" r="170" fill="#41e0c0" opacity=".07"/>
        <circle cx="40" cy="760" r="190" fill="#7c8cff" opacity=".09"/>`
      : `<defs>
          <radialGradient id="wpA" cx="82%" cy="6%" r="75%"><stop offset="0" stop-color="#33511a"/><stop offset=".5" stop-color="#121f15"/><stop offset="1" stop-color="#070b09"/></radialGradient>
          <radialGradient id="wpB" cx="8%" cy="92%" r="70%"><stop offset="0" stop-color="#7be04a" stop-opacity=".38"/><stop offset="1" stop-color="#0a120c" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="402" height="874" fill="url(#wpA)"/><rect width="402" height="874" fill="url(#wpB)"/>
        <path d="M-30 610C90 540 210 660 430 560" fill="none" stroke="rgba(198,255,120,.12)" stroke-width="1.2"/>`;

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const widget = `<g>
    ${rr(30, 442, 342, 150, 24, 'rgba(255,255,255,.075)')}
    <rect x="30.5" y="442.5" width="341" height="149" rx="23.5" fill="none" stroke="rgba(255,255,255,.13)"/>
    ${mono(50, 472, 8, 'rgba(255,255,255,.52)', 'LISBON, PT', 'letter-spacing="1.3"')}
    ${text(50, 536, 52, 300, '#ffffff', '24°', 'letter-spacing="-2"')}
    ${text(50, 558, 10.5, 500, 'rgba(255,255,255,.62)', 'Clear skies  ·  H 26°  L 17°')}
    <circle cx="318" cy="500" r="25" fill="rgba(255,212,120,.2)"/>
    <circle cx="318" cy="500" r="14" fill="rgba(255,212,120,.92)"/>
    ${[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => `<rect x="317" y="466" width="2" height="7" rx="1" fill="rgba(255,212,120,.75)" transform="rotate(${deg} 318 500)"/>`).join('')}
    ${text(50, 578, 9.5, 500, 'rgba(255,255,255,.45)', 'Next up  ·  Design review at 10:30')}
  </g>`;
  hot({ x: 30, y: 442, w: 342, h: 150, label: 'Open Weather widget', action: 'system', value: 'Weather' });
  hot({ x: 31, y: 632, w: 340, h: 40, label: 'Search apps', action: 'store' });
  return `<g>${wallpaper}
    ${text(32, 100, 10.5, 650, 'rgba(255,255,255,.82)', dateLabel, 'letter-spacing=".2"')}
    ${text(32, 116, 9, 500, 'rgba(255,255,255,.48)', '24°  ·  Clear skies')}
    ${widget}
    ${search}${parts.join('')}${dockParts.join('')}
    ${rr(188, 696, 6, 6, 3, 'rgba(255,255,255,.86)')}${rr(202, 696, 6, 6, 3, 'rgba(255,255,255,.28)')}
    ${statusBar(platform, dark, time, battery)}${homeIndicator(false)}
  </g>`;
}

// ---------------------------------------------------------------------------
// Built-in system / dock apps
// ---------------------------------------------------------------------------

function builtinInfo(
  name: string,
  time: string,
): { headline: string; caption: string; rows: string[][] } {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  switch (name) {
    case 'Camera':
      return {
        headline: '24 MP',
        caption: 'Photo · Video · Portrait',
        rows: [
          ['Mode', 'Photo'],
          ['Resolution', '24 MP'],
          ['Storage', '128 GB'],
        ],
      };
    case 'Photos':
      return {
        headline: '1,284',
        caption: 'Photos · 32 videos',
        rows: [
          ['Photos', '1,284'],
          ['Videos', '32'],
          ['Albums', '14'],
        ],
      };
    case 'Clock':
      return {
        headline: time,
        caption: `Lisbon · ${date}`,
        rows: [
          ['Alarm', '07:30'],
          ['World clock', '3 cities'],
          ['Timer', '00:00'],
        ],
      };
    case 'Weather':
      return {
        headline: '24°',
        caption: 'Clear skies · Lisbon',
        rows: [
          ['Feels like', '25°'],
          ['Wind', '12 km/h'],
          ['Humidity', '58%'],
        ],
      };
    case 'Calendar':
      return {
        headline: String(new Date().getDate()),
        caption: date,
        rows: [
          ['Next', 'Design review 10:30'],
          ['Later', 'Focus time 14:00'],
          ['Tomorrow', '2 events'],
        ],
      };
    case 'Settings':
      return {
        headline: 'Control center',
        caption: 'Wi-Fi · Bluetooth · Display',
        rows: [
          ['Wi-Fi', 'Home'],
          ['Bluetooth', 'On'],
          ['Display', 'Auto'],
        ],
      };
    case 'Phone':
      return {
        headline: 'Keypad',
        caption: 'Recents · Contacts · Voicemail',
        rows: [
          ['Missed', '3'],
          ['Contacts', '42'],
          ['Voicemail', '1'],
        ],
      };
    case 'Messages':
      return {
        headline: '2 unread',
        caption: 'Design team · Maya · Lumen',
        rows: [
          ['Pinned', 'Design team'],
          ['Recent', 'Maya · 09:41'],
          ['Recent', 'Lumen · 09:12'],
        ],
      };
    case 'Browser':
      return {
        headline: 'Start page',
        caption: 'Bookmarks · Tabs · Reading list',
        rows: [
          ['Bookmarks', '12'],
          ['Tabs', '3'],
          ['Reading list', '4'],
        ],
      };
    case 'Music':
      return {
        headline: 'Night Drive',
        caption: 'Lumen · Recently played',
        rows: [
          ['Playing', 'Night Drive'],
          ['Artist', 'Lumen'],
          ['Queue', '12 tracks'],
        ],
      };
    default:
      return {
        headline: name,
        caption: 'Built-in demo app',
        rows: [
          ['Status', 'Ready'],
          ['Mode', 'Simulated'],
          ['Back', 'Return home'],
        ],
      };
  }
}

function renderBuiltinApp(
  name: string,
  platform: PhonePlatform,
  hot: (h: Omit<Hotspot, 'label'> & { label: string }) => void,
  time: string,
  battery: number,
): string {
  const app = BUILTIN_APPS.get(name) ?? {
    name,
    color: '#4b5563',
    ink: '#ffffff',
    mark: 'grid' as MarkName,
  };
  const info = builtinInfo(name, time);
  const iconSize = 92;
  const iconX = 201 - iconSize / 2;
  const iconY = 112;
  const glyph = 58;
  const cardY = 396;
  const rows = info.rows
    .map(([label, value], index) => {
      const y = cardY + 54 + index * 58;
      return `<g>
        ${mono(52, y, 8, 'rgba(255,255,255,.45)', label.toUpperCase(), 'letter-spacing="1.1"')}
        ${text(52, y + 21, 13, 500, '#ffffff', value)}
        ${index < info.rows.length - 1 ? `<path d="M52 ${y + 36}h298" stroke="rgba(255,255,255,.08)"/>` : ''}
      </g>`;
    })
    .join('');

  return `<g>
    <rect width="402" height="874" fill="#080b10"/>
    <circle cx="338" cy="70" r="190" fill="${app.color}" opacity=".16"/>
    <circle cx="18" cy="780" r="210" fill="${app.color}" opacity=".08"/>
    ${statusBar(platform, false, time, battery)}
    ${rr(22, 56, 96, 32, 16, 'rgba(255,255,255,.09)')}
    <path d="M40 67.5 31 76l9 8.5" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    ${text(52, 80, 10, 600, '#ffffff', 'Home')}
    ${hot({ x: 22, y: 56, w: 96, h: 32, label: 'Back', action: 'back' })}

    ${rr(iconX, iconY + 5, iconSize, iconSize, 24, '#000000', 'opacity=".28"')}
    ${rr(iconX, iconY, iconSize, iconSize, 24, app.color)}
    <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="24" fill="url(#tileSheen)"/>
    <g transform="translate(${201 - glyph / 2}, ${iconY + (iconSize - glyph) / 2})">${markToSvg(app.mark, { color: app.ink, size: glyph })}</g>

    ${text(201, 246, 26, 650, '#ffffff', app.name, 'text-anchor="middle"')}
    ${text(201, 266, 10, 500, 'rgba(255,255,255,.5)', 'BUILT-IN DEMO APP', 'text-anchor="middle" letter-spacing="1.6"')}
    ${text(201, 330, 40, 300, '#ffffff', info.headline, 'text-anchor="middle" letter-spacing="-1.2"')}
    ${text(201, 354, 11, 500, 'rgba(255,255,255,.58)', info.caption, 'text-anchor="middle"')}

    ${rr(30, cardY, 342, 238, 22, 'rgba(255,255,255,.055)')}
    <rect x="30.5" y="${cardY + 0.5}" width="341" height="237" rx="21.5" fill="none" stroke="rgba(255,255,255,.1)"/>
    ${rows}

    ${text(201, 680, 9.5, 500, 'rgba(255,255,255,.38)', 'Simulated system app · tap Home to go back', 'text-anchor="middle"')}
    ${homeIndicator(false)}
  </g>`;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

function renderStore(
  platform: PhonePlatform,
  installed: Set<string>,
  install: DemoInstall | null,
  hot: (h: Omit<Hotspot, 'label'> & { label: string }) => void,
  time: string,
  battery: number,
  query: string,
): string {
  const accent = platform === 'ios' ? '#0a84ff' : '#0f9d58';
  const title = platform === 'ios' ? 'App Store' : 'Google Play';
  const results = query ? searchCatalog(query) : CATALOG;
  const recommended = results.find((app) => !installed.has(app.id)) ?? results[0] ?? null;
  const chart = results.filter((app) => app.id !== recommended?.id).slice(0, 4);
  const progressFor = (appId: string): number | null =>
    install && install.appId === appId
      ? Math.min(0.99, (Date.now() - install.startedAt) / install.duration)
      : null;

  const button = (app: CatalogApp, x: number, y: number, w: number, h: number): string => {
    const progress = progressFor(app.id);
    const isInstalled = installed.has(app.id);
    if (progress !== null) {
      const pct = Math.max(0.04, progress);
      return `<g>
        ${rr(x, y, w, h, h / 2, '#eef1f4')}
        <rect x="${x}" y="${y}" width="${Math.max(h, w * pct)}" height="${h}" rx="${h / 2}" fill="${accent}" opacity=".18"/>
        <circle cx="${x + 16}" cy="${y + h / 2}" r="7" fill="none" stroke="${accent}" stroke-width="2" opacity=".25"/>
        <circle cx="${x + 16}" cy="${y + h / 2}" r="7" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="${(44 * pct).toFixed(1)} 44" stroke-linecap="round" transform="rotate(-90 ${x + 16} ${y + h / 2})"/>
        ${text(x + 29, y + h / 2 + 3.5, 10, 700, accent, progress < 0.9 ? 'INSTALLING' : 'OPEN', 'letter-spacing=".3"')}
      </g>`;
    }
    if (isInstalled) {
      return `<g>${rr(x, y, w, h, h / 2, '#eef1f4')}${text(x + w / 2, y + h / 2 + 4, 10.5, 800, '#1a1d21', 'OPEN', 'text-anchor="middle" letter-spacing=".5"')}</g>`;
    }
    return `<g>${rr(x, y, w, h, h / 2, accent)}${text(x + w / 2, y + h / 2 + 4, 10.5, 800, '#ffffff', 'GET', 'text-anchor="middle" letter-spacing=".6"')}</g>`;
  };

  const addButtonHotspot = (app: CatalogApp, x: number, y: number, w: number, h: number): void => {
    const progress = progressFor(app.id);
    if (progress !== null) return;
    hot({
      x,
      y,
      w,
      h,
      label: installed.has(app.id) ? `Open ${app.name}` : `Install ${app.name}`,
      action: installed.has(app.id) ? 'open' : 'install',
      value: app.id,
    });
  };

  const hero = recommended ? `<g>
    ${rr(20, 206, 362, 188, 22, '#ffffff')}
    <path d="M20 228a22 22 0 0 1 22-22h318a22 22 0 0 1 22 22v92H20z" fill="${recommended.color}"/>
    <circle cx="322" cy="244" r="70" fill="#ffffff" opacity=".12"/>
    <circle cx="356" cy="306" r="44" fill="#ffffff" opacity=".08"/>
    ${text(38, 246, 10.5, 700, recommended.ink, 'EDITOR’S CHOICE', 'letter-spacing="1.2" opacity=".72"')}
    ${text(38, 280, 24, 800, recommended.ink, recommended.name, 'letter-spacing="-.4"')}
    ${text(38, 302, 12.5, 500, recommended.ink, recommended.tagline, 'opacity=".78"')}
    ${appTile(recommended, 330, 264, 54)}
    ${text(38, 344, 11, 500, 'rgba(20,24,30,.56)', `${recommended.category}  ·  ★ ${recommended.rating.toFixed(1)}  ·  ${recommended.installs} installs`)}
    ${button(recommended, 286, 356, 76, 30)}
    ${text(38, 374, 10.5, 600, accent, 'FEATURED TODAY')}
  </g>` : `<g>
    ${rr(20, 206, 362, 188, 22, '#ffffff')}
    <g transform="translate(176, 246)">${markToSvg('compass', { color: '#aab2bd', size: 50 })}</g>
    ${text(201, 330, 14, 700, '#4b5563', `No results for “${query.slice(0, 24)}”`, 'text-anchor="middle"')}
    ${text(201, 352, 10.5, 400, '#8b939f', 'Try a name like Spotify, Maps or Slack.', 'text-anchor="middle"')}
  </g>`;
  if (recommended) addButtonHotspot(recommended, 286, 356, 76, 30);

  const rows = chart.map((app, index) => {
    const y = 430 + index * 76;
    return `<g>
      ${rr(20, y, 362, 68, 16, '#ffffff')}
      ${appTile(app, 32, y + 8, 52)}
      ${text(96, y + 27, 14, 650, '#14171c', app.name)}
      ${text(96, y + 45, 11, 450, '#727a86', `${app.category}  ·  ★ ${app.rating.toFixed(1)}`)}
      ${button(app, 300, y + 18, 70, 30)}
    </g>`;
  });
  chart.forEach((app, index) => {
    const y = 430 + index * 76;
    addButtonHotspot(app, 300, y + 18, 70, 30);
    hot({ x: 32, y: y + 8, w: 250, h: 52, label: `View ${app.name}`, action: 'detail', value: app.id });
  });

  const tabs = [
    { label: 'For you', mark: 'home' as MarkName },
    { label: 'Games', mark: 'game' as MarkName },
    { label: 'Apps', mark: 'grid' as MarkName },
    { label: 'Search', mark: 'compass' as MarkName },
  ];
  const tabBar = tabs
    .map((tab, i) => {
      const x = 32 + i * 88;
      const active = i === 0;
      return `${`<g transform="translate(${x}, 812)">${markToSvg(tab.mark, { color: active ? accent : '#8b939f', size: 21 })}</g>`}${text(x + 10.5, 850, 9, active ? 700 : 500, active ? accent : '#8b939f', tab.label, 'text-anchor="middle"')}`;
    })
    .join('');

  return `<g>
    <rect width="402" height="874" fill="#f4f6f8"/>
    <rect width="402" height="54" fill="#f4f6f8"/>
    ${statusBar(platform, true, time, battery)}
    <circle cx="39" cy="82" r="16" fill="#e7eaee"/>
    <path d="m42 76-6 6 6 6" fill="none" stroke="#1b1f26" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    ${text(66, 80, 23, 800, '#12151a', title, 'letter-spacing="-.5"')}
    ${text(66, 98, 10.5, 500, '#7d8590', platform === 'ios' ? 'Curated by the editors' : 'Apps and games for you')}
    <circle cx="366" cy="82" r="17" fill="${accent}"/>
    <g transform="translate(355, 71)">${markToSvg(platform === 'ios' ? 'cloud' : 'grid', { color: '#fff', size: 22 })}</g>
    ${rr(20, 126, 362, 44, 14, '#e8ebef')}
    <g transform="translate(35, 141)">${markToSvg('compass', { color: '#7d8590', size: 17 })}</g>
    ${text(60, 153, 12.5, 500, query ? '#14181d' : '#8a919c', query ? (query.length > 34 ? `${query.slice(0, 34)}…` : query) : platform === 'ios' ? 'Search games, apps, stories' : 'Search apps & games')}
    ${text(20, 198, 13, 750, '#14181d', query ? `Results for “${query.slice(0, 28)}”` : 'Recommended for you')}
    <g>${hero}</g>
    ${text(20, 422, 13, 750, '#14181d', platform === 'ios' ? 'Apps we love' : 'Top charts')}
    ${rows.join('')}
    ${rr(0, 796, 402, 78, 0, '#fbfcfd')}
    <rect x="0" y="796" width="402" height="1" fill="#e3e7ec"/>
    ${tabBar}
    ${homeIndicator(true)}
  </g>`;
}

// ---------------------------------------------------------------------------
// App detail
// ---------------------------------------------------------------------------

function renderDetail(
  app: CatalogApp,
  platform: PhonePlatform,
  installed: Set<string>,
  install: DemoInstall | null,
  hot: (h: Omit<Hotspot, 'label'> & { label: string }) => void,
  time: string,
  battery: number,
): string {
  const accent = platform === 'ios' ? '#0a84ff' : '#0f9d58';
  const isInstalled = installed.has(app.id);
  const progress = install && install.appId === app.id ? Math.min(0.99, (Date.now() - install.startedAt) / install.duration) : null;
  const cta = progress !== null
    ? `${rr(20, 248, 362, 48, 14, '#e9edf1')}${text(201, 277, 12, 700, accent, progress < 0.9 ? `Installing… ${Math.round(progress * 100)}%` : 'Opening…', 'text-anchor="middle"')}`
    : isInstalled
      ? `${rr(20, 248, 362, 48, 14, '#eef1f4')}${text(201, 277, 12.5, 750, '#14171c', 'OPEN', 'text-anchor="middle" letter-spacing=".6"')}`
      : `${rr(20, 248, 362, 48, 14, accent)}${text(201, 277, 12.5, 750, '#ffffff', platform === 'ios' ? 'GET THE APP' : 'INSTALL', 'text-anchor="middle" letter-spacing=".6"')}`;
  if (progress === null) {
    hot({
      x: 20,
      y: 248,
      w: 362,
      h: 48,
      label: isInstalled ? `Open ${app.name}` : `Install ${app.name}`,
      action: isInstalled ? 'open' : 'install',
      value: app.id,
    });
  }

  const screenshotColors = [shade(app.color, -36), shade(app.color, 26), '#20242b'];
  const shots = screenshotColors
    .map(
      (color, i) => `<g>
        ${rr(20 + i * 214, 322, 200, 336, 18, color)}
        <rect x="${20 + i * 214}" y="322" width="200" height="336" rx="18" fill="url(#shotSheen)"/>
        ${i === 0 ? `${rr(38, 344, 60, 12, 6, 'rgba(255,255,255,.5)')}${text(38, 390, 24, 800, '#ffffff', app.scene === 'music' ? 'Your mix' : app.name)}${text(38, 414, 11, 500, 'rgba(255,255,255,.65)', app.tagline)}${rr(38, 446, 164, 150, 14, 'rgba(255,255,255,.14)')}` : ''}
        ${i === 1 ? `${rr(38 + 214, 344, 120, 12, 6, 'rgba(255,255,255,.5)')}${rr(38 + 214, 380, 164, 98, 14, 'rgba(255,255,255,.16)')}${rr(38 + 214, 494, 120, 10, 5, 'rgba(255,255,255,.34)')}${rr(38 + 214, 514, 150, 10, 5, 'rgba(255,255,255,.22)')}` : ''}
        ${i === 2 ? `${text(38 + 428, 376, 26, 800, '#ffffff', '★★★★★')}${text(38 + 428, 412, 12, 500, 'rgba(255,255,255,.6)', 'Loved by millions')}${rr(38 + 428, 438, 164, 120, 14, 'rgba(255,255,255,.1)')}` : ''}
      </g>`,
    )
    .join('');

  return `<g>
    <rect width="402" height="874" fill="#f4f6f8"/>
    ${statusBar(platform, true, time, battery)}
    <circle cx="39" cy="82" r="16" fill="#e7eaee"/>
    <path d="m42 76-6 6 6 6" fill="none" stroke="#1b1f26" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    ${text(66, 87, 16, 700, '#12151a', 'App details')}
    ${rr(20, 112, 362, 120, 20, app.color)}
    <rect x="20" y="112" width="362" height="120" rx="20" fill="url(#detailFade)"/>
    ${appTile(app, 38, 136, 72)}
    ${text(126, 154, 21, 800, '#ffffff', app.name, 'letter-spacing="-.3"')}
    ${text(126, 176, 11.5, 500, 'rgba(255,255,255,.82)', app.publisher)}
    ${text(126, 200, 11, 600, 'rgba(255,255,255,.9)', `${app.category}   ★ ${app.rating.toFixed(1)}`)}
    ${cta}
    ${text(20, 310, 12.5, 750, '#14181d', 'Preview')}
    <g clip-path="url(#shotClip)">${shots}</g>
    <defs><clipPath id="shotClip"><rect x="0" y="318" width="402" height="344"/></clipPath></defs>
    ${text(20, 690, 12.5, 750, '#14181d', 'About this app')}
    ${wrapLines(app.description, 58, 2)
      .map((line, i) => text(20, 712 + i * 18, 11.5, 400, '#5c6570', line))
      .join('')}
    ${text(20, 758, 11, 500, '#8b939f', `${app.size}   ·   ${app.installs} installs   ·   ${app.category}`)}
    ${rr(0, 796, 402, 78, 0, '#fbfcfd')}
    <rect x="0" y="796" width="402" height="1" fill="#e3e7ec"/>
    ${text(201, 840, 12, 700, accent, 'Developer website  ·  Privacy  ·  Support', 'text-anchor="middle"')}
    ${homeIndicator(true)}
  </g>`;
}

// ---------------------------------------------------------------------------
// App scenes
// ---------------------------------------------------------------------------

interface SceneInput {
  app: CatalogApp;
  platform: PhonePlatform;
  time: string;
  battery: number;
  dark: boolean;
  hot: (h: Omit<Hotspot, 'label'> & { label: string }) => void;
}

function sceneHeader(_input: SceneInput, title: string, subtitle?: string, dark = true): string {
  const ink = dark ? '#ffffff' : '#14171c';
  const soft = dark ? 'rgba(255,255,255,.6)' : 'rgba(20,23,28,.5)';
  return `<g>
    <circle cx="38" cy="82" r="17" fill="${dark ? 'rgba(255,255,255,.12)' : 'rgba(20,23,28,.07)'}"/>
    <path d="m41 76-6 6 6 6" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    ${text(66, 80, 16, 750, ink, title, 'letter-spacing="-.2"')}
    ${subtitle ? text(66, 98, 10, 500, soft, subtitle) : ''}
    <circle cx="364" cy="82" r="3" fill="${soft}"/>
    <circle cx="352" cy="82" r="3" fill="${soft}"/>
    <circle cx="340" cy="82" r="3" fill="${soft}"/>
  </g>`;
}

function sceneFooter(input: SceneInput, items: Array<{ label: string; mark: MarkName }>): string {
  const { dark, app } = input;
  const bg = dark ? 'rgba(10,12,16,.72)' : 'rgba(255,255,255,.88)';
  const ink = dark ? 'rgba(255,255,255,.52)' : 'rgba(20,23,28,.45)';
  return `<g>
    ${rr(0, 792, 402, 82, 0, bg)}
    <rect x="0" y="792" width="402" height="1" fill="${dark ? 'rgba(255,255,255,.08)' : 'rgba(20,23,28,.06)'}"/>
    ${items
      .map((item, i) => {
        const x = 62 + i * 92;
        const active = i === 0;
        return `<g transform="translate(${x - 10}, 810)">${markToSvg(item.mark, { color: active ? app.color : ink, size: 20 })}</g>${text(x, 848, 9, active ? 700 : 500, active ? app.color : ink, item.label, 'text-anchor="middle"')}`;
      })
      .join('')}
    ${homeIndicator(dark)}
  </g>`;
}

function sceneMusic(input: SceneInput): string {
  const { app, time, battery, platform, hot } = input;
  const bg = '#0a0b0d';
  const accent = app.color;
  return `<g>
    <rect width="402" height="874" fill="${bg}"/>
    <circle cx="330" cy="210" r="220" fill="${accent}" opacity=".1"/>
    <circle cx="60" cy="700" r="200" fill="${accent}" opacity=".06"/>
    ${statusBar(platform, false, time, battery)}
    ${sceneHeader(input, app.name, 'Now playing')}
    <g>
      ${rr(61, 132, 280, 280, 16, shade(app.color, -70))}
      <circle cx="201" cy="272" r="118" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1"/>
      <circle cx="201" cy="272" r="84" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1"/>
      <circle cx="201" cy="272" r="46" fill="${accent}" opacity=".9"/>
      <circle cx="201" cy="272" r="12" fill="${bg}"/>
      <path d="M154 336c30 22 64 22 94 0" fill="none" stroke="rgba(255,255,255,.32)" stroke-width="1.4"/>
      ${text(201, 160, 9.5, 700, 'rgba(255,255,255,.55)', 'PHONEEXPLORER SESSIONS', 'text-anchor="middle" letter-spacing="1.6"')}
    </g>
    ${text(201, 458, 21, 750, '#ffffff', 'Midnight City', 'text-anchor="middle" letter-spacing="-.3"')}
    ${text(201, 482, 12, 500, 'rgba(255,255,255,.55)', 'M83  ·  Hurry Up, We’re Dreaming', 'text-anchor="middle"')}
    ${rr(40, 516, 322, 4, 2, 'rgba(255,255,255,.14)')}
    ${rr(40, 516, 206, 4, 2, accent)}
    <circle cx="246" cy="518" r="5" fill="#fff"/>
    ${text(40, 540, 9.5, 500, 'rgba(255,255,255,.45)', '1:42')}
    ${text(336, 540, 9.5, 500, 'rgba(255,255,255,.45)', '4:03')}
    <g>
      <path d="M92 600h14m-7-7v14" stroke="rgba(255,255,255,.5)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M129 588v24l-13-12z" fill="#fff"/>
      <circle cx="201" cy="600" r="34" fill="#fff"/>
      <path d="M193 585v30l24-15z" fill="#0a0b0d"/>
      <path d="M273 588v24l13-12z" fill="#fff"/>
      <path d="M301 593a15 15 0 1 1 0 14" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.5" stroke-linecap="round"/>
    </g>
    ${rr(40, 664, 322, 58, 14, 'rgba(255,255,255,.06)')}
    <g transform="translate(56, 682)">${markToSvg('music', { color: accent, size: 19 })}</g>
    ${text(84, 690, 11.5, 650, '#fff', 'Up next')}
    ${text(84, 706, 9.5, 400, 'rgba(255,255,255,.5)', 'Tycho — Awake')}
    ${text(330, 698, 18, 400, '›', 'text-anchor="middle" fill="rgba(255,255,255,.4)"')}
    ${sceneFooter(input, [
      { label: 'Home', mark: 'home' },
      { label: 'Search', mark: 'compass' },
      { label: 'Library', mark: 'grid' },
      { label: 'Profile', mark: 'camera' },
    ])}
    ${hot({ x: 20, y: 60, w: 38, h: 38, label: 'Back to home screen', action: 'home' })}
  </g>`;
}

function sceneSocial(input: SceneInput): string {
  const { app, time, battery, platform, hot } = input;
  const dark = app.id === 'x';
  const bg = dark ? '#050505' : '#fafafa';
  const ink = dark ? '#f2f3f5' : '#16181c';
  const soft = dark ? 'rgba(255,255,255,.5)' : 'rgba(20,23,28,.48)';
  const accent = app.color;
  return `<g>
    <rect width="402" height="874" fill="${bg}"/>
    ${statusBar(platform, !dark, time, battery)}
    ${sceneHeader(input, app.name, dark ? 'For you' : 'Following', dark)}
    <g>
      <circle cx="48" cy="150" r="25" fill="none" stroke="${accent}" stroke-width="2"/>
      <circle cx="48" cy="150" r="21" fill="${shade(accent, -30)}"/>
      <circle cx="92" cy="150" r="25" fill="none" stroke="${dark ? 'rgba(255,255,255,.14)' : 'rgba(20,23,28,.08)'}" stroke-width="2"/>
      <circle cx="92" cy="150" r="21" fill="#2e3440"/>
      <circle cx="136" cy="150" r="25" fill="none" stroke="${dark ? 'rgba(255,255,255,.14)' : 'rgba(20,23,28,.08)'}" stroke-width="2"/>
      <circle cx="136" cy="150" r="21" fill="#4d5a6c"/>
      <circle cx="180" cy="150" r="25" fill="none" stroke="${dark ? 'rgba(255,255,255,.14)' : 'rgba(20,23,28,.08)'}" stroke-width="2"/>
      <circle cx="180" cy="150" r="21" fill="#8b5a3c"/>
      ${text(48, 190, 8, 600, soft, 'You', 'text-anchor="middle"')}
      ${text(92, 190, 8, 500, soft, 'Maya', 'text-anchor="middle"')}
      ${text(136, 190, 8, 500, soft, 'Theo', 'text-anchor="middle"')}
      ${text(180, 190, 8, 500, soft, 'Lena', 'text-anchor="middle"')}
    </g>
    ${rr(16, 208, 370, 420, 18, dark ? '#101114' : '#ffffff')}
    <g>
      <circle cx="44" cy="238" r="16" fill="${accent}"/>
      <g transform="translate(35, 229)">${markToSvg('camera', { color: app.ink, size: 18 })}</g>
      ${text(70, 236, 11.5, 700, ink, 'studio.maya')}
      ${text(70, 250, 9, 400, soft, 'Lisbon, Portugal')}
      ${text(362, 240, 16, 700, soft, '•••')}
    </g>
    ${rr(16, 266, 370, 252, 4, shade(accent, -42))}
    <circle cx="300" cy="330" r="110" fill="${accent}" opacity=".45"/>
    <circle cx="90" cy="470" r="90" fill="#ffffff" opacity=".12"/>
    <path d="M16 460c80-50 140 20 204-30s110-30 166 10v78H16z" fill="#0c0e12" opacity=".35"/>
    ${text(36, 300, 9, 600, 'rgba(255,255,255,.75)', 'FEATURED', 'letter-spacing="1.4"')}
    ${text(36, 340, 24, 800, '#ffffff', 'Golden hour,', 'letter-spacing="-.4"')}
    ${text(36, 364, 24, 800, '#ffffff', 'slow mornings.', 'letter-spacing="-.4"')}
    ${text(36, 492, 10, 500, 'rgba(255,255,255,.65)', '1 / 4')}
    <g>
      <path d="M30 538c8-8 20-8 28 0 8-8 20-8 28 0" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>
      ${text(96, 544, 10, 500, soft, '2,418 likes')}
      ${text(330, 544, 20, 400, soft, '♡')}
      ${text(362, 544, 20, 400, soft, '↗')}
    </g>
    ${text(30, 572, 11, 650, ink, 'studio.maya  ', '')}${text(118, 572, 11, 400, soft, 'chasing the light in Lisbon.')}
    ${text(30, 592, 10.5, 400, soft, 'View all 184 comments')}
    ${text(30, 614, 8.5, 500, soft, '2 HOURS AGO')}
    ${text(30, 660, 12.5, 700, ink, 'Suggested for you')}
    ${rr(16, 674, 370, 96, 16, dark ? '#101114' : '#ffffff')}
    ${rr(30, 688, 68, 68, 14, shade(app.color, 20))}
    ${text(114, 708, 12, 700, ink, 'Field notes')}
    ${text(114, 726, 10, 400, soft, 'A slower feed for curious people')}
    ${text(114, 748, 9.5, 600, accent, 'Follow')}
    ${sceneFooter(input, [
      { label: 'Home', mark: 'home' },
      { label: 'Search', mark: 'compass' },
      { label: 'Create', mark: 'camera' },
      { label: 'Profile', mark: 'grid' },
    ])}
    ${hot({ x: 20, y: 60, w: 38, h: 38, label: 'Back to home screen', action: 'home' })}
  </g>`;
}

function sceneChat(input: SceneInput): string {
  const { app, time, battery, platform, hot } = input;
  const bg = app.id === 'telegram' ? '#0e1621' : '#0b141a';
  const accent = app.color;
  const bubbles = [
    { side: 'in', y: 226, h: 58, lines: ['Hey! The new build is on TestFlight.', '9:38'] },
    { side: 'out', y: 300, h: 50, lines: ['Just installed it on the Pixel.', '9:39'] },
    { side: 'in', y: 366, h: 76, lines: ['The device mirror looks sharp.', 'Try the store → open flow next.', '9:40'] },
    { side: 'out', y: 458, h: 42, lines: ['On it. This is much faster than screenshots.', '9:41'] },
    { side: 'in', y: 516, h: 56, lines: ['Agreed. Ship it.', '9:42'] },
  ];
  const bubblesSvg = bubbles
    .map((b) => {
      const out = b.side === 'out';
      const x = out ? 402 - 24 - 238 : 24;
      const fill = out ? accent : 'rgba(255,255,255,.08)';
      const ink = out ? app.ink : '#eef1f4';
      const meta = out ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.38)';
      return `<g>
        ${rr(x, b.y, 238, b.h, 15, fill)}
        ${b.lines
          .slice(0, -1)
          .map((line, i) => text(x + 14, b.y + 24 + i * 18, 11.5, 400, ink, line))
          .join('')}
        ${mono(x + 238 - 34, b.y + b.h - 8, 7.5, meta, b.lines[b.lines.length - 1], 'text-anchor="end"')}
      </g>`;
    })
    .join('');
  return `<g>
    <rect width="402" height="874" fill="${bg}"/>
    <circle cx="360" cy="80" r="190" fill="${accent}" opacity=".05"/>
    ${statusBar(platform, false, time, battery)}
    <g>
      <circle cx="38" cy="82" r="17" fill="rgba(255,255,255,.1)"/>
      <path d="m41 76-6 6 6 6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="86" cy="82" r="18" fill="${accent}" opacity=".9"/>
      <g transform="translate(77, 73)">${markToSvg('chat', { color: app.ink, size: 18 })}</g>
      ${text(114, 78, 13, 700, '#f2f4f7', 'Design crew')}
      ${text(114, 94, 9.5, 500, 'rgba(255,255,255,.45)', 'Maya, Theo and 4 others · online')}
      <circle cx="364" cy="82" r="16" fill="rgba(255,255,255,.08)"/>
      <path d="M357 82a3 3 0 1 1 6 0 3 3 0 0 1-6 0zM365 82a3 3 0 1 1 6 0 3 3 0 0 1-6 0z" fill="rgba(255,255,255,.6)" transform="translate(-2,-6)"/>
    </g>
    ${text(201, 132, 8.5, 600, 'rgba(255,255,255,.32)', 'TODAY', 'text-anchor="middle" letter-spacing="1.4"')}
    ${bubblesSvg}
    ${rr(24, 656, 354, 46, 23, 'rgba(255,255,255,.08)')}
    ${rr(38, 668, 276, 22, 11, 'rgba(255,255,255,.04)')}
    ${text(52, 683, 11, 400, 'rgba(255,255,255,.38)', 'Message')}
    <circle cx="352" cy="679" r="17" fill="${accent}"/>
    <path d="M346 679h12m-5-5 5 5-5 5" stroke="${app.ink}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${rr(24, 714, 354, 54, 16, 'rgba(255,255,255,.05)')}
    <g transform="translate(40, 730)">${markToSvg('calendar', { color: accent, size: 20 })}</g>
    ${text(70, 738, 10.5, 600, '#e8ecf1', 'Shared plan')}
    ${text(70, 753, 9, 400, 'rgba(255,255,255,.4)', 'Launch checklist · 8 tasks')}
    ${sceneFooter(input, [
      { label: 'Chats', mark: 'chat' },
      { label: 'Calls', mark: 'phone' },
      { label: 'Updates', mark: 'compass' },
      { label: 'Settings', mark: 'gear' },
    ])}
    ${hot({ x: 20, y: 60, w: 38, h: 38, label: 'Back to home screen', action: 'home' })}
  </g>`;
}

function sceneVideo(input: SceneInput): string {
  const { app, time, battery, platform, hot } = input;
  const bg = '#08090b';
  const accent = app.color;
  return `<g>
    <rect width="402" height="874" fill="${bg}"/>
    ${statusBar(platform, false, time, battery)}
    ${sceneHeader(input, app.name, 'Home', true)}
    ${rr(0, 124, 402, 226, 0, '#14161a')}
    <rect x="0" y="124" width="402" height="226" fill="url(#videoHero)"/>
    <circle cx="201" cy="237" r="34" fill="rgba(0,0,0,.45)"/>
    <path d="M193 222v30l24-15z" fill="#fff"/>
    ${text(24, 332, 18, 750, '#ffffff', 'The quiet architecture of', 'letter-spacing="-.3"')}
    ${text(24, 352, 18, 750, '#ffffff', 'a perfect workspace', 'letter-spacing="-.3"')}
    ${text(24, 374, 10, 500, 'rgba(255,255,255,.5)', '1.2M views · 2 days ago')}
    <g>
      <circle cx="38" cy="410" r="18" fill="${accent}"/>
      <g transform="translate(29, 401)">${markToSvg('play', { color: app.ink, size: 18 })}</g>
      ${text(66, 408, 12, 650, '#fff', 'Field Studio')}
      ${text(66, 424, 9, 400, 'rgba(255,255,255,.45)', '1.8M subscribers')}
      ${rr(272, 396, 106, 32, 16, '#ffffff')}
      ${text(325, 416, 10.5, 750, '#0a0b0d', 'SUBSCRIBE', 'text-anchor="middle" letter-spacing=".3"')}
    </g>
    ${rr(24, 448, 354, 52, 8, 'rgba(255,255,255,.05)')}
    ${text(38, 470, 10, 400, 'rgba(255,255,255,.6)', 'A calm, practical guide to building a desk')}
    ${text(38, 486, 10, 400, 'rgba(255,255,255,.6)', 'that disappears when you sit down to work.')}
    ${text(24, 530, 12.5, 700, '#fff', 'Up next')}
    <g>
      ${rr(24, 546, 150, 84, 10, '#1e232b')}${rr(24, 546, 150, 84, 10, 'url(#thumbA)')}
      ${text(190, 562, 11, 600, '#fff', 'Lighting a tiny studio')}
      ${text(190, 578, 9, 400, 'rgba(255,255,255,.45)', 'Field Studio · 842K views')}
      ${text(190, 606, 9, 400, 'rgba(255,255,255,.35)', '12:04')}
    </g>
    <g>
      ${rr(24, 644, 150, 84, 10, '#1e232b')}${rr(24, 644, 150, 84, 10, 'url(#thumbB)')}
      ${text(190, 660, 11, 600, '#fff', 'One cable, zero clutter')}
      ${text(190, 676, 9, 400, 'rgba(255,255,255,.45)', 'Field Studio · 611K views')}
      ${text(190, 704, 9, 400, 'rgba(255,255,255,.35)', '08:47')}
    </g>
    ${sceneFooter(input, [
      { label: 'Home', mark: 'home' },
      { label: 'Shorts', mark: 'play' },
      { label: 'Subs', mark: 'grid' },
      { label: 'You', mark: 'camera' },
    ])}
    ${hot({ x: 20, y: 60, w: 38, h: 38, label: 'Back to home screen', action: 'home' })}
  </g>`;
}

function sceneMaps(input: SceneInput): string {
  const { app, time, battery, platform, hot } = input;
  const accent = app.color;
  const roads = `
    <path d="M-20 180 180 240 430 160" fill="none" stroke="#ffffff" stroke-width="14"/>
    <path d="M-20 330 150 300 430 380" fill="none" stroke="#ffffff" stroke-width="9"/>
    <path d="M60 -20 120 300 60 900" fill="none" stroke="#ffffff" stroke-width="12"/>
    <path d="M250 -20 280 260 330 900" fill="none" stroke="#ffffff" stroke-width="10"/>
    <path d="M-20 560 200 520 430 600" fill="none" stroke="#ffffff" stroke-width="17"/>
    <path d="M-20 700 160 680 430 740" fill="none" stroke="#ffffff" stroke-width="8"/>
    <path d="M180 200 300 320 260 520" fill="none" stroke="#ffffff" stroke-width="7"/>
    <path d="M0 440 140 420 220 460" fill="none" stroke="#ffffff" stroke-width="6"/>
    <path d="M330 240 380 420 340 620" fill="none" stroke="#ffffff" stroke-width="6"/>
  `;
  const parks = `<circle cx="330" cy="210" r="46" fill="#cfe6c4"/><circle cx="90" cy="640" r="60" fill="#cfe6c4"/><rect x="200" y="700" width="90" height="70" rx="18" fill="#cfe6c4"/>`;
  return `<g>
    <rect width="402" height="874" fill="#e8e4dc"/>
    ${parks}${roads}
    <path d="M86 640 150 560 210 540 260 470 300 420" fill="none" stroke="#3b82f6" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M86 640 150 560 210 540 260 470 300 420" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="2 10" stroke-linecap="round"/>
    <circle cx="86" cy="640" r="10" fill="#fff" stroke="#3b82f6" stroke-width="4"/>
    <g>
      <circle cx="300" cy="420" r="16" fill="#ea4335"/>
      <circle cx="300" cy="420" r="6" fill="#fff"/>
      <path d="M300 436v12" stroke="#ea4335" stroke-width="3"/>
    </g>
    ${statusBar(platform, true, time, battery)}
    ${rr(20, 66, 362, 46, 23, '#ffffff')}
    <g transform="translate(36, 79)">${markToSvg('compass', { color: '#3b82f6', size: 21 })}</g>
    ${text(64, 94, 12, 500, '#4b5563', 'Search here')}
    <circle cx="352" cy="89" r="15" fill="#eef2f7"/>
    <g transform="translate(343, 80)">${markToSvg('camera', { color: '#4b5563', size: 18 })}</g>
    ${rr(20, 610, 362, 184, 22, '#ffffff')}
    <rect x="185" y="622" width="34" height="4" rx="2" fill="#cbd5e1"/>
    ${text(38, 656, 18, 750, '#111827', 'Blue Bottle Coffee')}
    ${text(38, 676, 10.5, 500, '#6b7280', 'Coffee shop · 0.4 mi · Open until 6 PM')}
    ${text(38, 700, 11, 600, '#f59e0b', '★★★★☆')}${text(100, 700, 10, 400, '#6b7280', '4.4 (2,183)')}
    ${rr(38, 716, 110, 36, 18, '#e8f0fe')}
    ${text(93, 739, 10.5, 650, '#1a73e8', 'Directions', 'text-anchor="middle"')}
    ${rr(158, 716, 110, 36, 18, '#f1f3f4')}
    ${text(213, 739, 10.5, 650, '#3c4043', 'Save', 'text-anchor="middle"')}
    ${rr(278, 716, 84, 36, 18, '#f1f3f4')}
    ${text(320, 739, 10.5, 650, '#3c4043', 'Share', 'text-anchor="middle"')}
    ${rr(0, 804, 402, 70, 0, '#ffffff')}
    ${text(201, 846, 10.5, 600, accent, 'Explore  ·  Go  ·  Saved  ·  Contribute', 'text-anchor="middle"')}
    ${homeIndicator(true)}
    ${hot({ x: 20, y: 60, w: 38, h: 38, label: 'Back to home screen', action: 'home' })}
  </g>`;
}

function sceneLearning(input: SceneInput): string {
  const { app, time, battery, platform, hot } = input;
  const accent = app.color;
  return `<g>
    <rect width="402" height="874" fill="#fbfbf7"/>
    ${statusBar(platform, true, time, battery)}
    ${sceneHeader(input, app.name, 'Section 2 · Unit 4', false)}
    <g>
      ${rr(20, 118, 362, 74, 18, '#ffffff')}
      <rect x="20" y="118" width="362" height="74" rx="18" fill="none" stroke="#e7e9e2"/>
      <g transform="translate(38, 134)">${markToSvg('owl', { color: accent, size: 34 })}</g>
      ${text(84, 146, 12, 750, '#1d2418', 'Daily streak')}
      ${text(84, 164, 10, 400, '#6b7463', 'You’re on a roll. Keep it going!')}
      ${text(348, 154, 24, 800, accent, '12', 'text-anchor="middle"')}
      ${text(348, 172, 7.5, 600, '#9aa394', 'DAYS', 'text-anchor="middle" letter-spacing=".6"')}
    </g>
    ${text(20, 226, 12.5, 700, '#1d2418', 'Lesson path')}
    ${rr(20, 242, 362, 8, 4, '#e7eadf')}
    ${rr(20, 242, 196, 8, 4, accent)}
    ${text(382, 238, 8.5, 600, '#9aa394', '54%', 'text-anchor="end"')}
    <g>
      <circle cx="96" cy="330" r="34" fill="${accent}"/>
      <g transform="translate(79, 313)">${markToSvg('owl', { color: '#ffffff', size: 34 })}</g>
      ${text(96, 386, 9, 600, '#8b9482', 'Lesson 1', 'text-anchor="middle"')}
      <path d="M130 330h66" stroke="#dfe4d7" stroke-width="4" stroke-dasharray="2 10"/>
      <circle cx="230" cy="330" r="34" fill="#ffffff" stroke="#dfe4d7" stroke-width="2"/>
      <g transform="translate(213, 313)">${markToSvg('play', { color: '#b6c0ad', size: 34 })}</g>
      ${text(230, 386, 9, 600, '#8b9482', 'Lesson 2', 'text-anchor="middle"')}
      <path d="M264 330h66" stroke="#dfe4d7" stroke-width="4" stroke-dasharray="2 10"/>
      <circle cx="364" cy="330" r="34" fill="#f0f2ea"/>
      <g transform="translate(347, 313)">${markToSvg('grid', { color: '#c3cbb9', size: 34 })}</g>
      ${text(364, 386, 9, 600, '#8b9482', 'Checkpoint', 'text-anchor="middle"')}
    </g>
    ${rr(20, 418, 362, 190, 20, '#ffffff')}
    <rect x="20" y="418" width="362" height="190" rx="20" fill="none" stroke="#e7e9e2"/>
    ${rr(20, 418, 362, 8, 4, accent)}
    ${text(40, 454, 10.5, 700, accent, 'UNIT 4 · FOOD & DRINK')}
    ${text(40, 482, 20, 800, '#1d2418', 'Ordering at a café')}
    ${text(40, 504, 10.5, 400, '#6b7463', '12 new words · 4 listening exercises')}
    <g>
      ${rr(40, 526, 100, 30, 15, '#eef7e6')}
      ${text(90, 546, 9.5, 650, '#4f7a2c', '★ 4.8', 'text-anchor="middle"')}
      ${rr(148, 526, 100, 30, 15, '#eef7e6')}
      ${text(198, 546, 9.5, 650, '#4f7a2c', '12 min', 'text-anchor="middle"')}
      ${rr(256, 526, 100, 30, 15, '#eef7e6')}
      ${text(306, 546, 9.5, 650, '#4f7a2c', 'A1 level', 'text-anchor="middle"')}
    </g>
    ${rr(40, 570, 322, 20, 10, '#f2f4ec')}
    ${rr(40, 570, 200, 20, 10, '#dcefc9')}
    ${text(40, 610, 9.5, 500, '#98a18f', 'Keep the streak alive — 120 XP')}
    ${text(40, 660, 12.5, 700, '#1d2418', 'Words you’re learning')}
    <g>
      ${rr(20, 676, 174, 66, 16, '#ffffff')}
      ${text(36, 702, 12, 700, '#1d2418', 'la cuenta')}
      ${text(36, 720, 9.5, 400, '#8b9482', 'the bill')}
      ${rr(206, 676, 176, 66, 16, '#ffffff')}
      ${text(222, 702, 12, 700, '#1d2418', 'sin hielo')}
      ${text(222, 720, 9.5, 400, '#8b9482', 'without ice')}
    </g>
    ${rr(20, 770, 362, 48, 16, accent)}
    ${text(201, 800, 12, 750, '#ffffff', 'CONTINUE LESSON', 'text-anchor="middle" letter-spacing=".6"')}
    ${homeIndicator(true)}
    ${hot({ x: 20, y: 60, w: 38, h: 38, label: 'Back to home screen', action: 'home' })}
  </g>`;
}

function sceneNotes(input: SceneInput): string {
  const { time, battery, platform, hot } = input;
  return `<g>
    <rect width="402" height="874" fill="#fbfaf7"/>
    ${statusBar(platform, true, time, battery)}
    ${sceneHeader(input, 'Product notes', 'Workspace · Design', false)}
    ${text(20, 132, 8.5, 600, '#9a958c', 'PRODUCT / RESEARCH', 'letter-spacing="1.4"')}
    ${text(20, 168, 28, 800, '#20201e', 'Stage 01', 'letter-spacing="-.8"')}
    ${text(20, 194, 12, 500, '#8b867d', 'What we learned from the device lab')}
    <g>
      <circle cx="32" cy="226" r="12" fill="#d9d4c9"/>
      <text x="32" y="230" font-family="${FONT}" font-size="9" font-weight="700" fill="#5c574e" text-anchor="middle">DS</text>
      ${text(52, 230, 10, 500, '#7a746a', 'Dan · 12 min read · Edited today')}
    </g>
    <rect x="20" y="252" width="362" height="1" fill="#e8e4db"/>
    ${rr(20, 272, 362, 92, 12, '#f2ede2')}
    ${text(36, 298, 9, 700, '#a08a52', 'TL;DR', 'letter-spacing="1.2"')}
    ${text(36, 320, 11, 400, '#5f594e', 'Mirroring closes the feedback loop between')}
    ${text(36, 337, 11, 400, '#5f594e', 'the desktop and the phone. Store-first installs')}
    ${text(36, 354, 11, 400, '#5f594e', 'keep the device secure and the flow honest.')}
    ${text(20, 402, 19, 750, '#20201e', '1. The first five minutes')}
    ${text(20, 428, 11.5, 400, '#6b665d', 'A new device should be useful before the user')}
    ${text(20, 446, 11.5, 400, '#6b665d', 'reads a single line of documentation.')}
    ${text(20, 476, 16, 700, '#20201e', 'Principles')}
    ${['Mirror the real screen, never a mock', 'Open the real store, never a fake catalog', 'Detect installs by package id', 'Keep touch, home and back within reach'].map(
      (item, i) => `<g>
        ${rr(20, 494 + i * 34, 18, 18, 5, i < 2 ? '#20201e' : '#ffffff')}
        ${i < 2 ? `<path d="m24.5 ${503 + i * 34} 3 3 6-6" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` : `<rect x="20.5" y="${494.5 + i * 34}" width="17" height="17" rx="5" fill="none" stroke="#c9c4b9"/>`}
        ${text(48, 508 + i * 34, 11, 450, i < 2 ? '#8b867d' : '#3c3933', item, i < 2 ? 'text-decoration="line-through"' : '')}
      </g>`,
    ).join('')}
    ${rr(20, 646, 362, 96, 14, '#ffffff')}
    <rect x="20" y="646" width="362" height="96" rx="14" fill="none" stroke="#e8e4db"/>
    ${text(36, 672, 9, 600, '#a19b90', 'OPEN QUESTION', 'letter-spacing="1.2"')}
    ${text(36, 694, 12, 500, '#2a2722', 'How do we make App Store installs')}
    ${text(36, 712, 12, 500, '#2a2722', 'feel native without automating them?')}
    ${text(36, 734, 9.5, 400, '#9a958c', 'Owner: Dan · Review Friday')}
    ${rr(20, 764, 362, 1, 0, '#e8e4db')}
    <circle cx="354" cy="792" r="24" fill="#20201e"/>
    <path d="M354 782v20M344 792h20" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
    ${homeIndicator(true)}
    ${hot({ x: 20, y: 60, w: 38, h: 38, label: 'Back to home screen', action: 'home' })}
  </g>`;
}

function sceneTravel(input: SceneInput): string {
  const { app, time, battery, platform, hot } = input;
  const accent = app.color;
  return `<g>
    <rect width="402" height="874" fill="#ffffff"/>
    <rect x="0" y="0" width="402" height="360" fill="url(#travelHero)"/>
    <circle cx="310" cy="120" r="150" fill="#ffffff" opacity=".06"/>
    ${statusBar(platform, false, time, battery)}
    ${sceneHeader(input, app.name, 'Stays in Lisbon', true)}
    ${rr(20, 300, 362, 76, 20, '#ffffff')}
    ${text(38, 326, 9, 700, '#9aa1ad', 'WHERE')}
    ${text(38, 346, 13, 650, '#111827', 'Lisbon, Portugal')}
    <rect x="30" y="358" width="1" height="1" fill="none"/>
    ${text(38, 366, 9, 700, '#9aa1ad', 'WHEN')}
    ${text(38, 384, 13, 650, '#111827', '12 – 16 Sep  ·  2 guests')}
    <circle cx="342" cy="338" r="22" fill="${accent}"/>
    <g transform="translate(332, 328)">${markToSvg('compass', { color: '#ffffff', size: 20 })}</g>
    ${text(20, 414, 12.5, 750, '#111827', 'Popular stays')}
    ${text(300, 414, 10, 600, accent, 'See all')}
    <g>
      ${rr(20, 430, 174, 156, 16, '#f2f4f7')}
      ${rr(20, 430, 174, 100, 16, '#e8b48a')}
      <circle cx="140" cy="470" r="60" fill="#ffffff" opacity=".18"/>
      ${text(32, 552, 11.5, 700, '#111827', 'Alfama loft')}
      ${text(32, 568, 9.5, 400, '#6b7280', 'Lisbon · ★ 4.92')}
      ${text(32, 584, 10.5, 700, '#111827', '€148 / night')}
      ${rr(208, 430, 174, 156, 16, '#f2f4f7')}
      ${rr(208, 430, 174, 100, 16, '#8ea6b8')}
      <circle cx="320" cy="480" r="52" fill="#ffffff" opacity=".16"/>
      ${text(220, 552, 11.5, 700, '#111827', 'Príncipe real')}
      ${text(220, 568, 9.5, 400, '#6b7280', 'Lisbon · ★ 4.88')}
      ${text(220, 584, 10.5, 700, '#111827', '€122 / night')}
    </g>
    ${rr(20, 608, 362, 126, 18, '#f7f4ef')}
    ${text(36, 636, 9, 700, '#9a8f7c', 'EXPERIENCES')}
    ${text(36, 660, 17, 750, '#1f1b16', 'A morning with a local baker')}
    ${text(36, 680, 10, 400, '#6b655c', 'Pastéis, coffee and a walk through Alfama.')}
    ${text(36, 706, 10.5, 700, accent, 'From €42 per person')}
    <circle cx="342" cy="690" r="24" fill="${accent}"/>
    <path d="M336 690h12m-5-5 5 5-5 5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${rr(0, 792, 402, 82, 0, '#ffffff')}
    <rect x="0" y="792" width="402" height="1" fill="#eceff3"/>
    ${['Explore', 'Wishlist', 'Trips', 'Inbox'].map(
      (label, i) => `<g transform="translate(${50 + i * 92}, 810)">${markToSvg((['compass', 'grid', 'home', 'mail'] as MarkName[])[i], { color: i === 0 ? accent : '#9aa1ad', size: 20 })}</g>${text(60 + i * 92, 848, 9, i === 0 ? 700 : 500, i === 0 ? accent : '#9aa1ad', label, 'text-anchor="middle"')}`,
    ).join('')}
    ${homeIndicator(true)}
    ${hot({ x: 20, y: 60, w: 38, h: 38, label: 'Back to home screen', action: 'home' })}
  </g>`;
}

function sceneMail(input: SceneInput): string {
  const { app, time, battery, platform, hot } = input;
  const accent = app.color;
  const mails = [
    { from: 'Maya Chen', subject: 'Device lab notes', snippet: 'The mirror flow feels instant…', color: '#8b5cf6', unread: true, time: '9:32' },
    { from: 'Theo Alvarez', subject: 'Play Store listing draft', snippet: 'Added the new screenshots and…', color: '#0ea5e9', unread: true, time: '8:14' },
    { from: 'Lena Ortiz', subject: 'Re: App Store review', snippet: 'Looks like the metadata is ready…', color: '#f97316', unread: false, time: 'Yest' },
    { from: 'Device Weekly', subject: 'The week in mobile', snippet: 'New foldables, USB-C everything…', color: '#22c55e', unread: false, time: 'Yest' },
    { from: 'Stripe', subject: 'Your invoice is ready', snippet: 'Invoice #0042 for September…', color: '#635bff', unread: false, time: 'Mon' },
  ];
  return `<g>
    <rect width="402" height="874" fill="#ffffff"/>
    ${statusBar(platform, true, time, battery)}
    ${sceneHeader(input, 'Inbox', 'you@phoneexplorer.app', false)}
    ${rr(20, 122, 362, 42, 21, '#f1f3f5')}
    <g transform="translate(35, 136)">${markToSvg('compass', { color: '#8b939f', size: 17 })}</g>
    ${text(60, 148, 12, 400, '#9aa1ad', 'Search in mail')}
    ${text(20, 196, 11, 700, '#6b7280', 'PRIMARY')}${text(120, 196, 11, 500, '#9aa1ad', 'SOCIAL')}${text(206, 196, 11, 500, '#9aa1ad', 'PROMOTIONS')}
    <rect x="20" y="208" width="58" height="2" rx="1" fill="${accent}"/>
    ${mails
      .map((mail, i) => {
        const y = 224 + i * 96;
        return `<g>
          ${rr(20, y, 362, 86, 16, i < 2 ? '#fafbfc' : '#ffffff')}
          <circle cx="52" cy="${y + 30}" r="17" fill="${mail.color}"/>
          ${text(52, y + 35, 11, 750, '#ffffff', mail.from.split(' ').map((p) => p[0]).join(''), 'text-anchor="middle"')}
          ${text(82, y + 24, 12, mail.unread ? 750 : 600, '#111827', mail.from)}
          ${text(340, y + 24, 8.5, 500, '#9aa1ad', mail.time, 'text-anchor="end"')}
          ${text(82, y + 44, 11, mail.unread ? 650 : 500, '#1f2937', mail.subject)}
          ${text(82, y + 62, 9.5, 400, '#8b939f', mail.snippet)}
          ${mail.unread ? `<circle cx="371" cy="${y + 44}" r="4" fill="${accent}"/>` : ''}
        </g>`;
      })
      .join('')}
    ${rr(20, 716, 362, 1, 0, '#eceff3')}
    <circle cx="350" cy="774" r="27" fill="${accent}"/>
    <path d="M340 778h20M344 774l6-6 6 6M350 768v14" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${homeIndicator(true)}
    ${hot({ x: 20, y: 60, w: 38, h: 38, label: 'Back to home screen', action: 'home' })}
  </g>`;
}

function sceneWorkspace(input: SceneInput): string {
  const { app, time, battery, platform, hot } = input;
  const accent = app.color;
  const messages = [
    { name: 'Maya', time: '9:24', text: 'Pushed the new device header. The stage is a lot calmer now.', color: '#e8a33d' },
    { name: 'Theo', time: '9:26', text: 'Nice. Can we show install progress inside the store card?', color: '#4a9fe0' },
    { name: 'You', time: '9:28', text: 'Already in. It polls the package list and flips to Open.', color: accent, me: true },
    { name: 'Lena', time: '9:31', text: 'The App Store path needs a QR fallback for locked-down phones.', color: '#3eb489' },
  ];
  return `<g>
    <rect width="402" height="874" fill="#ffffff"/>
    ${statusBar(platform, true, time, battery)}
    ${sceneHeader(input, '# design-system', 'Workspace · 24 members', false)}
    ${rr(20, 120, 362, 44, 12, '#f8f5fb')}
    <g transform="translate(34, 133)">${markToSvg('hash', { color: accent, size: 18 })}</g>
    ${text(58, 147, 11.5, 600, '#3b2a4f', 'Channel · design-system')}
    ${text(330, 147, 9.5, 600, accent, '24 members', 'text-anchor="end"')}
    ${messages
      .map((m, i) => {
        const y = 190 + i * 104;
        return `<g>
          <circle cx="38" cy="${y + 14}" r="15" fill="${m.color}"/>
          ${text(38, y + 19, 9.5, 750, '#ffffff', m.name[0], 'text-anchor="middle"')}
          <text x="62" y="${y + 13}" font-family="${FONT}" font-size="12" font-weight="750" fill="#1f2937">${m.name}</text>
          ${text(62 + m.name.length * 7.2 + 8, y + 13, 8.5, 500, '#9aa1ad', m.time)}
          ${text(62, y + 32, 10.5, 400, '#4b5563', m.text.slice(0, 56))}
          ${text(62, y + 48, 10.5, 400, '#4b5563', m.text.slice(56, 112))}
          ${m.text.length > 112 ? text(62, y + 64, 10.5, 400, '#4b5563', m.text.slice(112, 168)) : ''}
        </g>`;
      })
      .join('')}
    ${rr(20, 612, 362, 62, 16, '#f8f5fb')}
    ${text(36, 636, 9.5, 650, '#3b2a4f', 'Thread · Device preview')}
    ${text(36, 654, 10, 400, '#6b7280', '3 replies · last activity 2m ago')}
    ${text(36, 690, 12.5, 700, '#1f2937', 'Today')}
    ${rr(20, 704, 362, 72, 14, '#ffffff')}
    <rect x="20" y="704" width="362" height="72" rx="14" fill="none" stroke="#ece7f2"/>
    ${text(36, 730, 10, 500, '#8b5cf6', 'Reminder')}
    ${text(36, 750, 11.5, 600, '#1f2937', 'Ship the demo fallback before review')}
    ${rr(20, 792, 362, 44, 14, '#f1edf7')}
    ${text(38, 819, 11, 400, '#9a8fb0', 'Message #design-system')}
    <circle cx="356" cy="814" r="15" fill="${accent}"/>
    <path d="M350 814h12m-5-5 5 5-5 5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${homeIndicator(true)}
    ${hot({ x: 20, y: 60, w: 38, h: 38, label: 'Back to home screen', action: 'home' })}
  </g>`;
}

function sceneRide(input: SceneInput): string {
  const { app, time, battery, platform, hot } = input;
  const accent = app.color;
  return `<g>
    <rect width="402" height="874" fill="#121417"/>
    <g opacity=".9">
      <rect width="402" height="874" fill="#15181c"/>
      <path d="M-20 140 160 200 430 120" fill="none" stroke="#242a31" stroke-width="16"/>
      <path d="M-20 320 140 280 430 360" fill="none" stroke="#242a31" stroke-width="10"/>
      <path d="M70 -20 130 280 80 900" fill="none" stroke="#242a31" stroke-width="14"/>
      <path d="M260 -20 290 240 340 900" fill="none" stroke="#242a31" stroke-width="12"/>
      <path d="M-20 560 200 520 430 620" fill="none" stroke="#242a31" stroke-width="18"/>
      <path d="M0 700 180 660 430 740" fill="none" stroke="#242a31" stroke-width="9"/>
      <path d="M120 200 250 330 220 520" fill="none" stroke="#242a31" stroke-width="7"/>
      <circle cx="320" cy="180" r="42" fill="#1b2a1e"/>
      <circle cx="90" cy="640" r="56" fill="#1b2a1e"/>
    </g>
    <path d="M86 650 150 560 200 540 250 470 300 430" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>
    <circle cx="86" cy="650" r="8" fill="${accent}"/>
    <circle cx="300" cy="430" r="10" fill="${accent}" opacity=".4"/>
    <circle cx="300" cy="430" r="4" fill="#121417"/>
    <g transform="translate(274, 500) rotate(-18)">
      ${rr(0, 0, 52, 26, 8, '#f4f6f8')}
      <rect x="10" y="4" width="30" height="10" rx="3" fill="#2b333d"/>
      <circle cx="10" cy="26" r="4" fill="#0a0b0d"/>
      <circle cx="42" cy="26" r="4" fill="#0a0b0d"/>
    </g>
    ${statusBar(platform, false, time, battery)}
    ${rr(20, 66, 362, 42, 21, 'rgba(20,24,30,.82)')}
    <circle cx="42" cy="87" r="12" fill="${accent}"/>
    <g transform="translate(34, 79)">${markToSvg('pin', { color: '#0a0b0d', size: 16 })}</g>
    ${text(64, 84, 10, 600, '#ffffff', 'Home')}
    ${text(64, 98, 9, 400, 'rgba(255,255,255,.4)', '12 Avenida da Liberdade')}
    ${text(348, 92, 14, 700, 'rgba(255,255,255,.5)', '⌕', 'text-anchor="middle"')}
    ${rr(0, 604, 402, 270, 26, '#ffffff')}
    <rect x="183" y="618" width="36" height="4" rx="2" fill="#e2e5e9"/>
    ${text(24, 656, 10, 700, '#8a919c', 'ARRIVING IN 3 MIN')}
    ${text(24, 684, 21, 800, '#111827', 'UberX', 'letter-spacing="-.4"')}
    ${text(24, 704, 10.5, 400, '#6b7280', 'White Toyota Prius · 7GHT239')}
    ${rr(24, 720, 354, 66, 14, '#f5f6f8')}
    <circle cx="58" cy="753" r="22" fill="#2f3742"/>
    ${text(58, 758, 12, 700, '#ffffff', 'AM', 'text-anchor="middle"')}
    ${text(92, 746, 12, 700, '#111827', 'Alex M.')}
    ${text(92, 764, 9.5, 400, '#8a919c', '4.96 ★  ·  3,214 trips')}
    ${text(350, 756, 10, 700, accent, 'Call', 'text-anchor="end"')}
    ${rr(24, 798, 354, 48, 14, '#111827')}
    ${text(201, 828, 11.5, 700, '#ffffff', 'CONFIRM RIDE  ·  €14.20', 'text-anchor="middle" letter-spacing=".5"')}
    ${homeIndicator(false)}
    ${hot({ x: 20, y: 60, w: 38, h: 38, label: 'Back to home screen', action: 'home' })}
  </g>`;
}

const SCENES: Record<CatalogApp['scene'], (input: SceneInput) => string> = {
  music: sceneMusic,
  social: sceneSocial,
  chat: sceneChat,
  video: sceneVideo,
  maps: sceneMaps,
  learning: sceneLearning,
  notes: sceneNotes,
  travel: sceneTravel,
  mail: sceneMail,
  workspace: sceneWorkspace,
  ride: sceneRide,
};

// ---------------------------------------------------------------------------
// Device
// ---------------------------------------------------------------------------

export class DemoDevice {
  readonly platform: PhonePlatform;
  readonly id: string;
  private installed = new Set<string>(SEED_INSTALLED);
  private query = '';
  private stack: Screen[] = [{ kind: 'home' }];
  private install: DemoInstall | null = null;
  private battery = 86;
  private lastTick = 0;
  private lastMinute = '';
  private bootedAt = Date.now();
  private model: PhoneModel;

  constructor(platform: PhonePlatform, model: PhoneModel = defaultPhoneModel(platform)) {
    this.platform = platform;
    this.id = `demo-${platform}`;
    this.model = model;
  }

  /** Swap the demo hardware profile. Resets navigation, keeps installed apps. */
  setModel(model: PhoneModel): void {
    if (model.platform !== this.platform) return;
    this.model = model;
    this.stack = [{ kind: 'home' }];
    this.install = null;
    this.query = '';
    this.bootedAt = Date.now();
  }

  info(): DeviceInfo {
    return {
      id: this.id,
      name: this.model.name,
      model: this.model.name,
      platform: this.platform,
      osVersion: this.model.osVersion,
      connection: 'virtual',
      status: 'online',
      serial: `DEMO-${this.model.id.replace(/[^a-z0-9]+/gi, '-').toUpperCase().slice(0, 18)}`,
      resolution: { ...this.model.screen },
      battery: this.battery,
      isDemo: true,
      modelId: this.model.id,
      frameColor: this.model.frameColor,
      displayInches: this.model.displayInches,
      controlEngine: 'demo',
      capabilities: {
        mirror: true,
        input: true,
        store: true,
        launch: true,
        installFile: false,
        installedApps: true,
      },
      hint: `Interactive demo · ${this.model.manufacturer} ${this.model.name} · ${this.model.screen.width}×${this.model.screen.height}`,
    };
  }

  get currentScreen(): Screen {
    return this.stack[this.stack.length - 1];
  }

  isInstalled(appId: string): boolean {
    return this.installed.has(appId);
  }

  installedIds(): string[] {
    return Array.from(this.installed);
  }

  installState(): DemoInstall | null {
    return this.install ? { ...this.install } : null;
  }

  installProgress(now = Date.now()): number | null {
    if (!this.install) return null;
    return Math.max(0, Math.min(1, (now - this.install.startedAt) / this.install.duration));
  }

  openStore(): void {
    this.query = '';
    if (this.currentScreen.kind !== 'store') this.stack.push({ kind: 'store' });
  }

  search(query: string): void {
    this.query = query;
    if (this.currentScreen.kind !== 'store') this.stack.push({ kind: 'store' });
  }

  openDetail(appId: string): void {
    if (!CATALOG_BY_ID[appId]) return;
    if (this.currentScreen.kind === 'home') this.stack.push({ kind: 'store' });
    this.stack.push({ kind: 'detail', appId });
  }

  openApp(appId: string): boolean {
    const app = CATALOG_BY_ID[appId];
    if (!app || !this.installed.has(appId)) return false;
    this.stack.push({ kind: 'app', appId });
    return true;
  }

  openPackage(packageId: string): boolean {
    const app = CATALOG.find(
      (candidate) =>
        candidate.androidPackage === packageId || candidate.iosBundleId === packageId,
    );
    if (app) return this.openApp(app.id);
    return false;
  }

  startInstall(appId: string, now = Date.now()): boolean {
    if (!CATALOG_BY_ID[appId]) return false;
    if (this.installed.has(appId)) return this.openApp(appId);
    if (this.install) return false;
    if (this.currentScreen.kind !== 'detail' || this.currentScreen.appId !== appId) {
      this.openDetail(appId);
    }
    this.install = { appId, startedAt: now, duration: 3400 };
    return true;
  }

  home(): void {
    this.stack = [{ kind: 'home' }];
  }

  back(): boolean {
    if (this.stack.length <= 1) return false;
    this.stack.pop();
    return true;
  }

  press(key: string): boolean {
    switch (key) {
      case 'home':
        this.home();
        return true;
      case 'back':
        return this.back();
      case 'recents':
        this.home();
        return true;
      case 'power':
        return false;
      default:
        return false;
    }
  }

  tick(now: number): DemoTick {
    const result: DemoTick = { changed: false };
    if (now - this.lastTick < 80) return result;
    this.lastTick = now;
    if (this.install) {
      const progress = Math.max(0, Math.min(1, (now - this.install.startedAt) / this.install.duration));
      if (progress >= 1) {
        const completedAppId = this.install.appId;
        this.installed.add(completedAppId);
        this.install = null;
        // Stay wherever the user is. The store button flips to Open on its own.
        return { changed: true, completedAppId, install: { appId: completedAppId, progress: 1, phase: 'done' } };
      }
      return {
        changed: true,
        install: {
          appId: this.install.appId,
          progress,
          phase: progress < 0.16 ? 'downloading' : 'installing',
        },
      };
    }
    const minute = new Date(now).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
    if (minute !== this.lastMinute) {
      this.lastMinute = minute;
      result.changed = true;
    }
    if (now - this.bootedAt < 2000) result.changed = true;
    return result;
  }

  render(now = Date.now()): DemoFrame {
    const hotspots: Hotspot[] = [];
    const hot = (h: Hotspot) => {
      hotspots.push(h);
    };
    const time = new Date(now).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
    const screen = this.currentScreen;
    let body: string;

    if (screen.kind === 'home') {
      body = renderHome(this.platform, this.installed, hot, false, time, this.battery);
    } else if (screen.kind === 'store') {
      body = renderStore(this.platform, this.installed, this.install, hot, time, this.battery, this.query);
    } else if (screen.kind === 'detail') {
      const app = CATALOG_BY_ID[screen.appId];
      body = renderDetail(app, this.platform, this.installed, this.install, hot, time, this.battery);
    } else if (screen.kind === 'system') {
      body = renderBuiltinApp(screen.name, this.platform, hot, time, this.battery);
    } else {
      const app = CATALOG_BY_ID[screen.appId];
      const scene = SCENES[app.scene];
      body = scene({
        app,
        platform: this.platform,
        time,
        battery: this.battery,
        dark: ['music', 'video', 'chat', 'ride'].includes(app.scene) || app.id === 'x',
        hot,
      });
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${DEMO_WIDTH}" height="${DEMO_HEIGHT}" viewBox="0 0 ${DEMO_WIDTH} ${DEMO_HEIGHT}">
      <defs>
        <linearGradient id="tileSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".22"/>
          <stop offset=".55" stop-color="#ffffff" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="shotSheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".18"/>
          <stop offset=".6" stop-color="#ffffff" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="detailFade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#000000" stop-opacity=".28"/>
          <stop offset=".7" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="videoHero" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#2b3a4a"/>
          <stop offset=".55" stop-color="#4c5b6b"/>
          <stop offset="1" stop-color="#1b232d"/>
        </linearGradient>
        <linearGradient id="thumbA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#3c4a58"/>
          <stop offset="1" stop-color="#1a2028"/>
        </linearGradient>
        <linearGradient id="thumbB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#4a3c58"/>
          <stop offset="1" stop-color="#1a2028"/>
        </linearGradient>
        <linearGradient id="travelHero" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#3f5b6b"/>
          <stop offset=".5" stop-color="#b98b6a"/>
          <stop offset="1" stop-color="#2b3a41"/>
        </linearGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
      </defs>
      ${body}
      <rect width="402" height="874" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="2"/>
    </svg>`;

    return { svg, hotspots, width: DEMO_WIDTH, height: DEMO_HEIGHT };
  }

  tap(x: number, y: number): boolean {
    const { hotspots } = this.render();
    const hit = hotspots.find(
      (h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h,
    );
    if (!hit) return false;
    switch (hit.action) {
      case 'store':
        this.openStore();
        return true;
      case 'home':
        this.home();
        return true;
      case 'back':
        return this.back();
      case 'app':
        return hit.value ? this.openApp(hit.value) : false;
      case 'detail':
        if (hit.value) this.openDetail(hit.value);
        return true;
      case 'install':
        return hit.value ? this.startInstall(hit.value) : false;
      case 'open':
        return hit.value ? this.openApp(hit.value) : false;
      case 'system':
        if (!hit.value || !BUILTIN_APPS.has(hit.value)) return false;
        this.stack.push({ kind: 'system', name: hit.value });
        return true;
      default:
        return false;
    }
  }
}
