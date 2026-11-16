import { describe, expect, it } from 'vitest';
import {
  isPng,
  parseGetprop,
  parsePackageList,
  parseWmSize,
  prettyPackageName,
} from '../adb';

describe('adb output parsers', () => {
  it('parses getprop blocks', () => {
    const props = parseGetprop(
      ['[ro.product.marketname]: [Pixel 9 Pro]', '[ro.build.version.release]: [16]', 'garbage'].join('\n'),
    );
    expect(props['ro.product.marketname']).toBe('Pixel 9 Pro');
    expect(props['ro.build.version.release']).toBe('16');
    expect(Object.keys(props)).toHaveLength(2);
  });

  it('prefers an override display size', () => {
    expect(parseWmSize('Physical size: 1080x2400\nOverride size: 720x1600')).toEqual({
      width: 720,
      height: 1600,
    });
  });

  it('handles a physical-only display', () => {
    expect(parseWmSize('Physical size: 1440x3120')).toEqual({ width: 1440, height: 3120 });
  });

  it('returns null for unparseable sizes', () => {
    expect(parseWmSize('nonsense')).toBeNull();
  });

  it('parses package lists', () => {
    const set = parsePackageList('package:com.spotify.music\npackage:notion.id\nnoise');
    expect(set.has('com.spotify.music')).toBe(true);
    expect(set.has('notion.id')).toBe(true);
    expect(set.size).toBe(2);
  });

  it('detects PNG signatures', () => {
    expect(isPng(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(true);
    expect(isPng(Buffer.from('not a png'))).toBe(false);
  });

  it('prettifies unknown package names', () => {
    expect(prettyPackageName('com.example.field_notes')).toBe('Field Notes');
    expect(prettyPackageName('com.acme.coolApp')).toBe('Cool App');
  });
});
