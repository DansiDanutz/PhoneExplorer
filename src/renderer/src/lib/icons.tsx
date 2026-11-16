import type { ReactElement } from 'react';

export type IconName =
  | 'refresh'
  | 'settings'
  | 'search'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'home'
  | 'back'
  | 'recents'
  | 'volume'
  | 'power'
  | 'keyboard'
  | 'camera'
  | 'external'
  | 'apple'
  | 'android'
  | 'play'
  | 'grid'
  | 'check'
  | 'x'
  | 'wifi'
  | 'usb'
  | 'battery'
  | 'monitor'
  | 'qr'
  | 'copy'
  | 'plus'
  | 'sliders'
  | 'sparkles'
  | 'download'
  | 'maximize'
  | 'minimize'
  | 'info'
  | 'alert'
  | 'folder'
  | 'terminal'
  | 'arrow-right'
  | 'arrow-up-right'
  | 'device'
  | 'layers'
  | 'store'
  | 'lock'
  | 'pulse'
  | 'smartphone'
  | 'trash'
  | 'star'
  | 'zoom-in'
  | 'zoom-out'
  | 'clock';

const PATHS: Record<IconName, ReactElement> = {
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M20 20v-4h-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.08a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06A2 2 0 1 1 3.15 16.94l.06-.06A1.7 1.7 0 0 0 3.55 15a1.7 1.7 0 0 0-1.55-1H2a2 2 0 1 1 0-4h.08A1.7 1.7 0 0 0 3.63 8.9a1.7 1.7 0 0 0-.34-1.88l-.06-.06A2 2 0 1 1 6.06 4.13l.06.06A1.7 1.7 0 0 0 8 4.53h.08a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.47 9v.08a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.08a1.7 1.7 0 0 0-1.52.92z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.4" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),
  'chevron-right': <path d="m9.5 5 7 7-7 7" />,
  'chevron-left': <path d="m14.5 5-7 7 7 7" />,
  'chevron-down': <path d="m5 9.5 7 7 7-7" />,
  home: (
    <>
      <path d="M3.5 10.8 12 3.6l8.5 7.2" />
      <path d="M5.7 9.5V20h12.6V9.5" />
      <path d="M9.8 20v-5.6h4.4V20" />
    </>
  ),
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  recents: (
    <>
      <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="3.2" />
      <path d="M9 9h6M9 12h6M9 15h4" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
      <path d="M16 9a4.4 4.4 0 0 1 0 6M18.8 6.6a8 8 0 0 1 0 10.8" />
    </>
  ),
  power: (
    <>
      <path d="M12 3v9" />
      <path d="M6.7 6.6a8 8 0 1 0 10.6 0" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.6" y="6.3" width="18.8" height="11.4" rx="2.4" />
      <path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 13h.01M9 13h.01M12 13h.01M15 13h.01M18 13h.01M7.5 16h9" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.2h2.6L8.2 5.8h7.6l1.6 2.4H20v10.2H4z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  apple: (
    <path d="M15.4 12.4c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.7.8-3.4 2.1-1.4 2.5-.4 6.2 1 8.2.7 1 1.5 2.1 2.5 2 1-.1 1.4-.6 2.6-.6s1.6.6 2.7.6c1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.4-.1 0-2.1-.8-2.2-3.1zM13.3 6.1c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.6-1 1.6-.9 2.6 1 .1 2-.5 2.6-1.2z" />
  ),
  android: (
    <>
      <path d="M7 9.2h10v7.2a1.6 1.6 0 0 1-1.6 1.6H8.6A1.6 1.6 0 0 1 7 16.4z" />
      <path d="m8 6.4-1-1.7M16 6.4l1-1.7" />
      <circle cx="10" cy="8.2" r=".5" fill="currentColor" />
      <circle cx="14" cy="8.2" r=".5" fill="currentColor" />
      <path d="M9.3 18v2.4M14.7 18v2.4" />
    </>
  ),
  play: <path d="M8.2 5.4v13.2L19 12z" />,
  grid: (
    <>
      <rect x="4" y="4" width="6.2" height="6.2" rx="1.4" />
      <rect x="13.8" y="4" width="6.2" height="6.2" rx="1.4" />
      <rect x="4" y="13.8" width="6.2" height="6.2" rx="1.4" />
      <rect x="13.8" y="13.8" width="6.2" height="6.2" rx="1.4" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  x: <path d="M5 5l14 14M19 5 5 19" />,
  wifi: (
    <>
      <path d="M2.8 8.8a15 15 0 0 1 18.4 0" />
      <path d="M6.2 12.4a10 10 0 0 1 11.6 0" />
      <path d="M9.6 15.9a5 5 0 0 1 4.8 0" />
      <circle cx="12" cy="19.2" r=".8" fill="currentColor" />
    </>
  ),
  usb: (
    <>
      <path d="M12 21V5" />
      <path d="m8.4 8.6 3.6-3.6 3.6 3.6" />
      <circle cx="12" cy="13.5" r="1.6" />
      <path d="M12 15.1 8.4 18v2.4M12 15.1 15.6 18v2.4" />
    </>
  ),
  battery: (
    <>
      <rect x="2.6" y="7.2" width="17" height="9.6" rx="2.6" />
      <path d="M22 10.4v3.2" />
      <rect x="4.8" y="9.4" width="10.4" height="5.2" rx="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  monitor: (
    <>
      <rect x="2.8" y="4" width="18.4" height="12.4" rx="2.2" />
      <path d="M9 20h6M12 16.4V20" />
    </>
  ),
  qr: (
    <>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
      <path d="M14.5 14.5h2.6v2.6h-2.6zM20.5 14.5h.01M14.5 20.5h.01M20.5 20.5h.01M20.5 17.4h.01" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.2" />
      <path d="M15.5 5.8V5a1.4 1.4 0 0 0-1.4-1.4H5A1.4 1.4 0 0 0 3.6 5v9.1A1.4 1.4 0 0 0 5 15.5h.8" />
    </>
  ),
  plus: <path d="M12 4v16M4 12h16" />,
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M18.5 14.5 19.4 17l2.6 1-2.6 1-.9 2.5-.9-2.5-2.6-1 2.6-1z" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-4.5-4.5L12 15l4.5-4.5" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  maximize: (
    <>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </>
  ),
  minimize: <path d="M9 9H4V4M15 9h5V4M9 15H4v5M15 15h5v5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11v5M12 7.8h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.4 21 19.8H3z" />
      <path d="M12 9.6v4.2M12 17h.01" />
    </>
  ),
  folder: (
    <>
      <path d="M3.4 7.2A2.2 2.2 0 0 1 5.6 5h4l2 2.4h6.8a2.2 2.2 0 0 1 2.2 2.2v7.2a2.2 2.2 0 0 1-2.2 2.2H5.6a2.2 2.2 0 0 1-2.2-2.2z" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.4" />
      <path d="m7 9 3 3-3 3M12.5 15H17" />
    </>
  ),
  'arrow-right': <path d="M4 12h16m-6-6 6 6-6 6" />,
  'arrow-up-right': <path d="M6 18 18 6M8 6h10v10" />,
  device: (
    <>
      <rect x="7" y="2.8" width="10" height="18.4" rx="2.6" />
      <path d="M10.5 5.4h3" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  store: (
    <>
      <path d="M4 9.4V20h16V9.4" />
      <path d="M3 9.4 5 4h14l2 5.4a3 3 0 0 1-5.4 1.6 3 3 0 0 1-5.2 0A3 3 0 0 1 3 9.4z" />
      <path d="M9.6 20v-5.6h4.8V20" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.2" width="15" height="10.4" rx="2.4" />
      <path d="M8 10V7.4a4 4 0 0 1 8 0V10" />
    </>
  ),
  pulse: <path d="M2.5 12h4l2.4-6 4.2 12 2.4-6h6" />,
  smartphone: (
    <>
      <rect x="6.4" y="2.4" width="11.2" height="19.2" rx="2.8" />
      <path d="M11 5h2" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 13h9.2l.9-13" />
      <path d="M10 11v5.5M14 11v5.5" />
    </>
  ),
  star: <path d="m12 3.4 2.7 5.4 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.7l6-.9z" />,
  'zoom-in': (
    <>
      <circle cx="10.6" cy="10.6" r="6.2" />
      <path d="m19.8 19.8-4.4-4.4M8 10.6h5.2M10.6 8v5.2" />
    </>
  ),
  'zoom-out': (
    <>
      <circle cx="10.6" cy="10.6" r="6.2" />
      <path d="m19.8 19.8-4.4-4.4M8 10.6h5.2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.4V12l3.2 2" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 18, strokeWidth = 1.6, className }: IconProps): ReactElement {
  const filled = name === 'play' || name === 'apple';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
