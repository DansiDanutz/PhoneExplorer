import type { MarkName } from './types';

export interface MarkPrimitive {
  d: string;
  mode?: 'stroke' | 'fill';
  opacity?: number;
}

export interface MarkDefinition {
  primitives: MarkPrimitive[];
  strokeWidth?: number;
}

/**
 * Original, geometric monogram marks used for app tiles. Keeping them as raw
 * path data lets the same artwork render in React and in the demo SVG frames.
 * Everything is drawn on a 24×24 grid.
 */
export const MARKS: Record<MarkName, MarkDefinition> = {
  music: {
    strokeWidth: 1.9,
    primitives: [
      { d: 'M4 8.4c5-1.7 11.1-1.3 16 1.4' },
      { d: 'M5 12.6c4.1-1.3 9-.9 13 1.2' },
      { d: 'M6 16.6c3.1-1 7-.7 10 .9' },
    ],
  },
  camera: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M3.2 8.2a5 5 0 0 1 5-5h7.6a5 5 0 0 1 5 5v7.6a5 5 0 0 1-5 5H8.2a5 5 0 0 1-5-5z' },
      { d: 'M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z' },
      { d: 'M17.1 6.9h.01', mode: 'fill' },
    ],
  },
  chat: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M4.2 5.4h15.6v9.8H9.9l-5.7 4.1z' },
      { d: 'M8.7 10.3h.01M12 10.3h.01M15.3 10.3h.01', mode: 'fill' },
    ],
  },
  plane: {
    strokeWidth: 1.7,
    primitives: [
      { d: 'M3.1 11.4 20.9 3.3l-7.3 17.4-2.4-7.2z' },
      { d: 'm11.2 13.5 9.7-10.2' },
    ],
  },
  play: {
    primitives: [{ d: 'M9.3 7.2v9.6l7.8-4.8z', mode: 'fill' }],
  },
  pin: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M12 21.2c3.8-4.5 6.7-7.8 6.7-11.2a6.7 6.7 0 1 0-13.4 0c0 3.4 2.9 6.7 6.7 11.2z' },
      { d: 'M12 7.4a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z' },
    ],
  },
  film: {
    strokeWidth: 1.7,
    primitives: [
      { d: 'M3.6 5.6h16.8v12.8H3.6z' },
      { d: 'M8.4 5.7v12.6M15.6 5.7v12.6' },
      { d: 'M10.6 11.9v.01', mode: 'fill' },
    ],
  },
  owl: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M12 3.9a8 8 0 1 0 0 16 8 8 0 0 0 0-16z' },
      { d: 'M9.1 10.4h.01M14.9 10.4h.01', mode: 'fill' },
      { d: 'm12 12.4-1.4 2.5h2.8z', mode: 'fill' },
    ],
  },
  game: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M8 6.3h8a5.7 5.7 0 0 1 5.7 5.7v.3a5.2 5.2 0 0 1-9.4 3H11.7a5.2 5.2 0 0 1-9.4-3V12A5.7 5.7 0 0 1 8 6.3z' },
      { d: 'M9.4 11.3h.01M14.6 11.3h.01', mode: 'fill' },
    ],
  },
  note: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M6.4 3.6h7.4l3.8 3.8v13H6.4z' },
      { d: 'M13.6 3.7v4h4' },
      { d: 'M9.3 12.2h5.4M9.3 15.6h5.4' },
    ],
  },
  home: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M3.9 11.2 12 3.9l8.1 7.3v8.8H3.9z' },
      { d: 'M9.7 20v-5.3h4.6V20' },
    ],
  },
  car: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M4.4 15.4h15.2l-1.4-4.2H5.8z' },
      { d: 'M6.9 11.2 8.1 7.4h7.8l1.2 3.8' },
      { d: 'M4.5 15.4v2.2M19.5 15.4v2.2' },
      { d: 'M7.4 17.7a1.7 1.7 0 1 0 0 .1M16.6 17.7a1.7 1.7 0 1 0 0 .1' },
    ],
  },
  mail: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M3.6 7.1a2.6 2.6 0 0 1 2.6-2.6h11.6a2.6 2.6 0 0 1 2.6 2.6v9.8a2.6 2.6 0 0 1-2.6 2.6H6.2a2.6 2.6 0 0 1-2.6-2.6z' },
      { d: 'm4.8 7.2 7.2 5.4 7.2-5.4' },
    ],
  },
  hash: {
    strokeWidth: 1.9,
    primitives: [
      { d: 'M9.4 3.4 8.1 20.6M15.9 3.4l-1.3 17.2M3.8 9h16.4M3.2 15h16.4' },
    ],
  },
  x: {
    strokeWidth: 2,
    primitives: [{ d: 'M5.2 5.2 18.8 18.8M18.8 5.2 5.2 18.8' }],
  },
  grid: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M4 4h6.2v6.2H4zM13.8 4H20v6.2h-6.2zM4 13.8h6.2V20H4zM13.8 13.8H20V20h-6.2z' },
    ],
  },
  gear: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z' },
      { d: 'M12 2.9v2.2M12 18.9v2.2M2.9 12h2.2M18.9 12h2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6' },
    ],
  },
  clock: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2z' },
      { d: 'M12 7.6V12l3.2 2' },
    ],
  },
  cloud: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M7.3 18.2a4.1 4.1 0 0 1-.3-8.2 5.5 5.5 0 0 1 10.5 1.1 3.6 3.6 0 0 1-.5 7.1z' },
    ],
  },
  phone: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M7.4 3.9h3l1.3 4.2-2 1.5a11 11 0 0 0 4.7 4.7l1.5-2 4.2 1.3v3a2.5 2.5 0 0 1-2.6 2.5C10.8 18.5 5.5 13.2 4.9 6.5a2.5 2.5 0 0 1 2.5-2.6z' },
    ],
  },
  compass: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2z' },
      { d: 'm15.4 8.6-2 5-5 2 2-5z' },
    ],
  },
  calendar: {
    strokeWidth: 1.8,
    primitives: [
      { d: 'M4.3 6.8h15.4v13H4.3z' },
      { d: 'M4.4 10.8h15.2M8.4 4v4M15.6 4v4' },
      { d: 'M8.3 14h.01M12 14h.01M15.7 14h.01', mode: 'fill' },
    ],
  },
};

export function markToSvg(name: MarkName, options: { color?: string; size?: number } = {}): string {
  const def = MARKS[name];
  const color = options.color ?? 'currentColor';
  const size = options.size ?? 24;
  const scale = size / 24;
  const stroke = def.strokeWidth ?? 1.8;
  const body = def.primitives
    .map((p) => {
      if (p.mode === 'fill') {
        return `<path d="${p.d}" fill="${color}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" opacity="${p.opacity ?? 1}"/>`;
      }
      return `<path d="${p.d}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" opacity="${p.opacity ?? 1}"/>`;
    })
    .join('');
  return `<g transform="scale(${scale})" fill="none">${body}</g>`;
}
