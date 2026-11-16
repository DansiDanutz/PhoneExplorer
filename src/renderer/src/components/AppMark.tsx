import type { CSSProperties, ReactElement } from 'react';
import { MARKS } from '@shared/marks';
import type { CatalogApp, MarkName } from '@shared/types';
import { shade } from '../lib/format';

export function Mark({
  name,
  size = 24,
  color = 'currentColor',
  className,
}: {
  name: MarkName;
  size?: number;
  color?: string;
  className?: string;
}): ReactElement {
  const def = MARKS[name];
  const stroke = def.strokeWidth ?? 1.8;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {def.primitives.map((primitive, index) =>
        primitive.mode === 'fill' ? (
          <path
            key={index}
            d={primitive.d}
            fill={color}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={primitive.opacity ?? 1}
          />
        ) : (
          <path
            key={index}
            d={primitive.d}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={primitive.opacity ?? 1}
          />
        ),
      )}
    </svg>
  );
}

export function AppTile({
  app,
  size = 46,
  radius,
  className,
}: {
  app: CatalogApp;
  size?: number;
  radius?: number;
  className?: string;
}): ReactElement {
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius ?? size * 0.26,
    background: `linear-gradient(155deg, ${app.color}, ${shade(app.color, -26)})`,
    color: app.ink,
  };
  return (
    <span className={`app-tile ${className ?? ''}`} style={style}>
      <span className="app-tile-gloss" aria-hidden="true" />
      <Mark name={app.mark} size={size * 0.52} color={app.ink} />
    </span>
  );
}

export function MonogramTile({
  name,
  size = 46,
  tone = 'slate',
  className,
}: {
  name: string;
  size?: number;
  tone?: 'slate' | 'dark';
  className?: string;
}): ReactElement {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className={`app-tile monogram ${tone} ${className ?? ''}`}
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
    >
      <span className="app-tile-gloss" aria-hidden="true" />
      {initials || '?'}
    </span>
  );
}

export function StoreGlyph({
  platform,
  size = 40,
}: {
  platform: 'android' | 'ios';
  size?: number;
}): ReactElement {
  return (
    <span
      className="store-glyph"
      data-platform={platform}
      style={{ width: size, height: size, borderRadius: size * 0.27 }}
    >
      {platform === 'ios' ? (
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.6 21.4 19H2.6z" fill="#fff" opacity=".22" />
          <path d="M12 7.2 17.6 17H6.4z" fill="#fff" />
        </svg>
      ) : (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 3.6v16.8L20 12z" fill="#fff" />
        </svg>
      )}
    </span>
  );
}
